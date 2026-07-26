/**
 * NAMO IMS — Notifications Routes
 */

const express = require('express');
const db      = require('../database/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications
router.get('/', (req, res) => {
  try {
    const { unread } = req.query;
    const filter = { companyId: req.companyId };
    if (unread === 'true') filter.read = false;

    const notifications = db.find(req.companyId, 'notifications', {
      filter,
      sort:  ['createdAt', 'desc'],
      limit: 50,
    });
    const unreadCount = db.count(req.companyId, 'notifications', { companyId: req.companyId, read: false });

    return res.json({ notifications, unreadCount });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  try {
    const n = db.findById(req.companyId, 'notifications', req.params.id);
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    const updated = db.update(req.companyId, 'notifications', req.params.id, { read: true });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', (req, res) => {
  try {
    const unread = db.find(req.companyId, 'notifications', {
      filter: { companyId: req.companyId, read: false },
    });
    for (const n of unread) {
      db.update(req.companyId, 'notifications', n.id, { read: true });
    }
    return res.json({ marked: unread.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  const n = db.findById(req.companyId, 'notifications', req.params.id);
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  db.delete(req.companyId, 'notifications', req.params.id);
  return res.json({ message: 'Deleted', id: req.params.id });
});

module.exports = router;
