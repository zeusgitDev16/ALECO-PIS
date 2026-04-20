/**
 * Enforces that protected /api routes receive a valid session:
 * X-User-Email + X-Token-Version matching users.token_version and Active status.
 * Public routes (landing, ticket submit, auth, etc.) are skipped — see isPublicApiRoute.
 */
import pool from '../config/db.js';

/**
 * @param {import('express').Request} req
 */
export function isPublicApiRoute(req) {
  const m = String(req.method || 'GET').toUpperCase();
  const p = String(req.path || '/').split('?')[0].replace(/\/$/, '') || '/';

  if (m === 'OPTIONS') return true;

  if (m === 'GET' && p === '/health') return true;

  /** Public bulletin: default filters only — archive / future / admin list flags require a session. */
  if (m === 'GET' && p === '/interruptions') {
    const q = req.query || {};
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
  if (m === 'GET' && p === '/contact-numbers') return true;
  if (m === 'GET' && p === '/urgent-keywords') return true;
  if (m === 'GET' && p === '/feeders') return true;

  if (m === 'GET' && p.startsWith('/tickets/track/')) return true;
  if (m === 'GET' && p.startsWith('/tickets/sms/receive')) return true;

  if (m === 'GET' && p.startsWith('/b2b-mail/contacts/verify')) return true;

  if (m === 'POST' && p === '/b2b-mail/inbound/webhook') return true;

  const publicPost = new Set([
    '/setup-account',
    '/login',
    '/google-login',
    '/setup-google-account',
    '/logout-all',
    '/forgot-password',
    '/reset-password',
    '/verify-session',
    '/tickets/submit',
    '/check-duplicates',
    '/tickets/send-copy',
  ]);
  if (m === 'POST' && publicPost.has(p)) return true;

  return false;
}

export async function requireApiSession(req, res, next) {
  if (isPublicApiRoute(req)) {
    return next();
  }

  const email = String(req.headers['x-user-email'] || '')
    .trim()
    .toLowerCase();
  const tokenVersionRaw = req.headers['x-token-version'];

  if (!email || tokenVersionRaw === undefined || tokenVersionRaw === null || String(tokenVersionRaw).trim() === '') {
    return res.status(401).json({
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED',
    });
  }

  const tokenVersion = Number(tokenVersionRaw);
  if (Number.isNaN(tokenVersion)) {
    return res.status(401).json({
      error: 'Invalid session.',
      code: 'AUTH_INVALID',
    });
  }

  try {
    const [users] = await pool.execute(
      'SELECT status, token_version FROM users WHERE email = ?',
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
    req.authUser = { email };
    return next();
  } catch (e) {
    console.error('[requireApiSession]', e.message);
    return res.status(500).json({ error: 'Authentication check failed.' });
  }
}
