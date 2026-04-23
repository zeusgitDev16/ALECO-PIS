/**
 * Session gate for non-public /api routes.
 *
 * Public URLs are detected from **req.originalUrl** (full path) so behavior is stable regardless
 * of whether Express reports `req.path` as `/api/foo` or `/foo` under `app.use('/api', ...)`.
 *
 * Legacy session headers beat JWT when present (see requireApiSession body).
 * Dashboard SPA: ProtectedRoute + server RBAC for real enforcement.
 */
import pool from '../config/db.js';
import { verifyAccessToken } from '../utils/sessionJwt.js';

function extractBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function allowLegacySessionHeaders() {
  return String(process.env.ALLOW_LEGACY_SESSION_HEADERS || 'true').toLowerCase() !== 'false';
}

/** @returns {{ email: string, tokenVersion: number } | null} */
function readLegacyHeaders(req) {
  const email = String(req.headers['x-user-email'] || '')
    .trim()
    .toLowerCase();
  const tokenVersionRaw = req.headers['x-token-version'];
  if (!email || tokenVersionRaw === undefined || tokenVersionRaw === null || String(tokenVersionRaw).trim() === '') {
    return null;
  }
  const tokenVersion = Number(tokenVersionRaw);
  if (Number.isNaN(tokenVersion)) return null;
  return { email, tokenVersion };
}

/**
 * Pathname + query string only, stable across mounts (uses full request URL).
 */
function requestPathAndQuery(req) {
  const raw = String(req.originalUrl || req.url || '');
  return raw.split('#')[0];
}

/**
 * Public routes: no login. Match on **full** `/api/...` path so we never depend on `req.path`
 * quirks when middleware is mounted at `/api`.
 *
 * @param {import('express').Request} req
 */
export function isPublicApiRoute(req) {
  const m = String(req.method || 'GET').toUpperCase();
  const full = requestPathAndQuery(req);
  const [pathname, queryStr = ''] = full.split('?');
  const path = pathname.replace(/\/+$/, '') || '/';
  const q = req.query || Object.fromEntries(new URLSearchParams(queryStr));

  if (m === 'OPTIONS') return true;

  if (m === 'GET' && /^\/api\/health$/i.test(path)) return true;

  /** List advisories — public unless admin-only query flags are used */
  if (m === 'GET' && /^\/api\/interruptions$/i.test(path)) {
    const adminList =
      q.includeDeleted === '1' ||
      q.includeDeleted === 'true' ||
      q.deletedOnly === '1' ||
      q.deletedOnly === 'true' ||
      q.includeFuture === '1' ||
      q.includeFuture === 'true' ||
      q.includeScheduled === '1';
    return !adminList;
  }

  /** Public advisory snapshot (poster page, share meta) — numeric id only */
  if (m === 'GET' && /^\/api\/public\/interruptions\/[0-9]+$/i.test(path)) return true;

  /** HTML share page for Open Graph (Facebook crawler) */
  if (m === 'GET' && /^\/api\/share\/interruption\/[0-9]+$/i.test(path)) return true;

  if (m === 'GET' && /^\/api\/contact-numbers$/i.test(path)) return true;
  if (m === 'GET' && /^\/api\/urgent-keywords$/i.test(path)) return true;
  if (m === 'GET' && /^\/api\/feeders$/i.test(path)) return true;

  if (m === 'GET' && /^\/api\/tickets\/track\//i.test(path)) return true;
  if (m === 'GET' && /^\/api\/tickets\/sms\/receive/i.test(path)) return true;

  if (m === 'GET' && /^\/api\/b2b-mail\/contacts\/verify/i.test(path)) return true;

  if (m === 'POST' && /^\/api\/b2b-mail\/inbound\/webhook$/i.test(path)) return true;

  const publicPost = new Set([
    '/api/setup-account',
    '/api/login',
    '/api/google-login',
    '/api/setup-google-account',
    '/api/logout-all',
    '/api/forgot-password',
    '/api/reset-password',
    '/api/verify-session',
    '/api/tickets/submit',
    '/api/check-duplicates',
    '/api/tickets/send-copy',
  ]);
  if (m === 'POST' && publicPost.has(path.toLowerCase())) return true;

  return false;
}

export async function requireApiSession(req, res, next) {
  if (isPublicApiRoute(req)) {
    return next();
  }

  let email = '';
  let tokenVersion = NaN;

  const legacy = allowLegacySessionHeaders() ? readLegacyHeaders(req) : null;
  if (legacy) {
    email = legacy.email;
    tokenVersion = legacy.tokenVersion;
  } else {
    const bearer = extractBearerToken(req);
    if (bearer) {
      try {
        const v = verifyAccessToken(bearer);
        email = v.email;
        tokenVersion = v.tokenVersion;
      } catch {
        return res.status(401).json({
          error: 'Invalid or expired session token.',
          code: 'AUTH_INVALID',
        });
      }
    } else if (!allowLegacySessionHeaders()) {
      return res.status(401).json({
        error: 'Authentication required. Authorization Bearer token missing.',
        code: 'AUTH_TOKEN_REQUIRED',
      });
    } else {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }
  }

  try {
    const [users] = await pool.execute(
      'SELECT status, token_version, role FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({
        error: 'Invalid session.',
        code: 'AUTH_INVALID',
      });
    }
    const user = users[0];
    if (user.status === 'Disabled') {
      return res.status(403).json({
        error: 'Account disabled.',
        code: 'AUTH_DISABLED',
      });
    }
    if (Number(user.token_version) !== tokenVersion) {
      return res.status(401).json({
        error: 'Session expired.',
        code: 'AUTH_STALE',
      });
    }
    req.authUser = {
      email,
      role: user.role != null ? String(user.role) : '',
    };
    return next();
  } catch (e) {
    console.error('[requireApiSession]', e.message);
    return res.status(500).json({ error: 'Authentication check failed.' });
  }
}
