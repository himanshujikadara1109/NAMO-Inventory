/**
 * NAMO IMS — Auth Middleware
 * Verifies JWT access token and attaches user + companyId to req.
 */

const jwt = require('jsonwebtoken');
const db  = require('../database/index');

const JWT_SECRET = process.env.JWT_SECRET || 'namo_ims_jwt_secret';

/**
 * requireAuth — validates Bearer token, attaches req.user & req.companyId
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    // Ensure session still exists
    const session = db.findOne(payload.companyId, 'sessions', {
      userId: payload.userId,
      deviceId: payload.deviceId,
    });

    if (!session) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    req.user      = { id: payload.userId, role: payload.role, name: payload.name };
    req.companyId = payload.companyId;
    req.deviceId  = payload.deviceId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * requireRole — must come after requireAuth
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
