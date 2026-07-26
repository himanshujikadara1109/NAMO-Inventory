/**
 * NAMO IMS — Team Chat Routes
 */

const express = require('express');
const db      = require('../database/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/chat — fetch chat messages for company
router.get('/', (req, res) => {
  try {
    const messages = db.find(req.companyId, 'chat_messages', {
      filter: { companyId: req.companyId },
      sort:   ['createdAt', 'asc'],
      limit:  100,
    });
    return res.json({ messages });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// POST /api/chat — send a new chat message
router.post('/', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const senderName = req.user.name || 'Team Member';

    const newMsg = db.insert(req.companyId, 'chat_messages', {
      companyId: req.companyId,
      userId:    req.user.id,
      userName:  senderName,
      userRole:  req.user.role || 'staff',
      text:      text.trim(),
      createdAt: new Date().toISOString(),
    });

    // Also create a Notification entry for all members
    const notif = db.insert(req.companyId, 'notifications', {
      companyId: req.companyId,
      type:      'CHAT',
      title:     `New Message from ${senderName}`,
      message:   text.trim().length > 40 ? `${text.trim().slice(0, 40)}…` : text.trim(),
      read:      false,
      createdAt: new Date().toISOString(),
    });

    // Broadcast to WebSocket clients
    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      broadcast(req.companyId, 'CHAT_MESSAGE', { message: newMsg, notification: notif });
    }

    return res.status(201).json(newMsg);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send chat message' });
  }
});

// DELETE /api/chat/:id — delete message
router.delete('/:id', (req, res) => {
  try {
    const msg = db.findById(req.companyId, 'chat_messages', req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    
    // Only author or admin can delete
    if (msg.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.delete(req.companyId, 'chat_messages', req.params.id);
    return res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
