/**
 * NAMO IMS — Audit Middleware Factory
 * Returns a middleware that logs a structured audit record after the response.
 */

const db = require('../database/index');

/**
 * auditLog(action) — factory that returns Express middleware
 * @param {string} action  e.g. 'CREATE_ORDER', 'UPDATE_PRODUCT'
 * @param {string} [collection]  optional collection name for context
 */
function auditLog(action, collection = '') {
  return (req, _res, next) => {
    // Run after response so we don't block
    const origJson = _res.json.bind(_res);
    _res.json = function (body) {
      // Only log on success (2xx)
      if (_res.statusCode >= 200 && _res.statusCode < 300 && req.companyId) {
        try {
          db.insert(req.companyId, 'audit_logs', {
            userId:     req.user?.id     || 'system',
            userName:   req.user?.name   || 'system',
            action,
            collection: collection || '',
            targetId:   req.params?.id   || body?.id || '',
            method:     req.method,
            path:       req.originalUrl,
            ip:         req.ip,
            companyId:  req.companyId,
          });
        } catch (e) {
          // Never crash a request due to audit failure
          console.error('[Audit] Failed to write log:', e.message);
        }
      }
      return origJson(body);
    };
    next();
  };
}

module.exports = auditLog;
