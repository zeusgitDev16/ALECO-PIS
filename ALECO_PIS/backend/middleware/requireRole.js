/**
 * Role-based guards (RBAC). Use after `requireApiSession` so `req.authUser` is set from the database.
 * Never trust client-sent role headers — only `req.authUser.role` from DB.
 */

/**
 * @param {...string} allowedRoles — e.g. requireRole('admin')
 */
export function requireRole(...allowedRoles) {
  const allow = new Set(allowedRoles.map((r) => String(r).toLowerCase()));
  return (req, res, next) => {
    if (!req.authUser?.email) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }
    const r = String(req.authUser.role || '').toLowerCase();
    if (!allow.has(r)) {
      return res.status(403).json({
        error: 'You do not have permission to access this resource.',
        code: 'FORBIDDEN_ROLE',
      });
    }
    return next();
  };
}

export const requireAdmin = requireRole('admin');

/**
 * Allows access if session user is admin, or if target email matches session user (e.g. profile read/update).
 * @param {string} paramName — 'email'
 * @param {'query'|'body'} from
 */
export function requireSelfOrAdmin(paramName = 'email', from = 'query') {
  return (req, res, next) => {
    if (!req.authUser?.email) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }
    const role = String(req.authUser.role || '').toLowerCase();
    if (role === 'admin') return next();
    const raw = from === 'query' ? req.query?.[paramName] : req.body?.[paramName];
    const sessionEmail = String(req.authUser.email).toLowerCase();
    const target = String(raw || '')
      .trim()
      .toLowerCase();
    if (target && target === sessionEmail) return next();
    return res.status(403).json({
      error: 'You do not have permission to access this resource.',
      code: 'FORBIDDEN_ROLE',
    });
  };
}
