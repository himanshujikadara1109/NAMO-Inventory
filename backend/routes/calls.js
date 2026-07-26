/**
 * NAMO IMS — Calls & Signaling Routes
 */

const express = require('express');
const db      = require('../database/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/calls/active — Check if there is an active team call
router.get('/active', (req, res) => {
  try {
    const activeCalls = db.find(req.companyId, 'active_calls', {
      filter: { companyId: req.companyId, status: 'active' },
      sort:   ['createdAt', 'desc'],
      limit:  1,
    });
    return res.json({ activeCall: activeCalls[0] || null });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch active call' });
  }
});

// POST /api/calls/start — Start a team call (video or audio)
router.post('/start', (req, res) => {
  try {
    const { type = 'video' } = req.body;
    const callerName = req.user.name || 'Team Member';

    // 1. Create or update active call in DB
    const callData = {
      companyId:  req.companyId,
      callerId:   req.user.id,
      callerName: callerName,
      type:       type, // 'video' or 'audio'
      status:     'active',
      createdAt:  new Date().toISOString(),
    };

    const callRecord = db.insert(req.companyId, 'active_calls', callData);

    // 2. Create a notification for all users in the company
    const notif = db.insert(req.companyId, 'notifications', {
      companyId: req.companyId,
      type:      'CALL',
      title:     `Incoming ${type === 'video' ? 'Video Meeting' : 'Audio Call'}`,
      message:   `${callerName} started a Team ${type === 'video' ? 'Video Meeting' : 'Audio Call'}.`,
      read:      false,
      callId:    callRecord.id,
      callType:  type,
      createdAt: new Date().toISOString(),
    });

    // 3. Broadcast to all connected WebSocket clients of the company
    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      broadcast(req.companyId, 'INCOMING_CALL', {
        callRecord,
        notification: notif,
      });
    }

    return res.status(201).json({ callRecord, notif });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to start call' });
  }
});

// POST /api/calls/end — End active call
router.post('/end', (req, res) => {
  try {
    const { callId } = req.body;
    if (callId) {
      db.update(req.companyId, 'active_calls', callId, { status: 'ended', endedAt: new Date().toISOString() });
    }

    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      broadcast(req.companyId, 'CALL_ENDED', { callId });
    }

    return res.json({ status: 'ended', callId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to end call' });
  }
});

module.exports = router;
