import jwt from 'jsonwebtoken';

const ISSUER = 'aleco-pis-api';
const AUDIENCE = 'aleco-pis-spa';
const DELETE_SCOPE = 'tickets_archive_delete';

/**
 * HS256 secret for access tokens. Required in production (min 32 chars recommended).
 */
export function getJwtSecret() {
  const s = String(process.env.JWT_SECRET || process.env.SESSION_JWT_SECRET || '').trim();
  if (s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET (or SESSION_JWT_SECRET) must be set to a strong value (at least 32 characters) in production.'
    );
  }
  console.warn(
    '[sessionJwt] JWT_SECRET missing; using insecure dev default. Set JWT_SECRET in .env for realistic auth.'
  );
  return 'aleco-pis-dev-only-insecure-default-min-32-chars!';
}

/**
 * @param {string} email
 * @param {number|string} tokenVersion — must match users.token_version
 */
export function signAccessToken(email, tokenVersion) {
  const tv = Number(tokenVersion);
  if (!email || Number.isNaN(tv)) {
    throw new Error('signAccessToken: invalid email or tokenVersion');
  }
  const secret = getJwtSecret();
  return jwt.sign({ tv }, secret, {
    subject: String(email).trim().toLowerCase(),
    expiresIn: '30d',
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/**
 * @param {string} token — raw JWT (no "Bearer ")
 * @returns {{ email: string, tokenVersion: number }}
 */
export function verifyAccessToken(token) {
  const secret = getJwtSecret();
  const payload = jwt.verify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const email = String(payload.sub || '')
    .trim()
    .toLowerCase();
  const tokenVersion = Number(payload.tv);
  if (!email || Number.isNaN(tokenVersion)) {
    const err = new Error('Invalid token payload');
    err.code = 'AUTH_INVALID';
    throw err;
  }
  return { email, tokenVersion };
}

/**
 * Short-lived token that authorizes one archive delete action.
 * @param {string} email
 */
export function signArchiveDeleteToken(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw new Error('signArchiveDeleteToken: invalid email');
  const secret = getJwtSecret();
  return jwt.sign({ scope: DELETE_SCOPE }, secret, {
    subject: normalized,
    expiresIn: '10m',
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/**
 * @param {string} token
 * @returns {{ email: string, scope: string }}
 */
export function verifyArchiveDeleteToken(token) {
  const secret = getJwtSecret();
  const payload = jwt.verify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const email = String(payload.sub || '').trim().toLowerCase();
  const scope = String(payload.scope || '');
  if (!email || scope !== DELETE_SCOPE) {
    const err = new Error('Invalid archive delete token');
    err.code = 'AUTH_INVALID';
    throw err;
  }
  return { email, scope };
}
