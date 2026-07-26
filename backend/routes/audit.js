/**
 * NAMO IMS — Audit Log Routes
 */

const express = require('express');
const db      = require('../database/index');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'manager'));

// GET /api/audit?action=&userId=&collection=&page=&limit=
router.get('/', (req, res) => {
  try {
    const { action, userId, collection, page = 1, limit = 100 } = req.query;
    const filter = { companyId: req.companyId };
    if (action)     filter.action     = action;
    if (userId)     filter.userId     = userId;
    if (collection) filter.collection = collection;

    const logs  = db.find(req.companyId, 'audit_logs', {
      filter,
      sort:  ['createdAt', 'desc'],
      skip:  (Number(page) - 1) * Number(limit),
      limit: Number(limit),
    });
    const total = db.count(req.companyId, 'audit_logs', filter);

    return res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
