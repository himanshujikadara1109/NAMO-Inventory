/**
 * NAMO IMS — Settings Routes
 */

const express = require('express');
const db      = require('../database/index');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const settings = db.findOne(req.companyId, 'settings', { companyId: req.companyId });
    return res.json(settings || {});
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/settings
router.put('/', requireRole('admin'), (req, res) => {
  try {
    const existing = db.findOne(req.companyId, 'settings', { companyId: req.companyId });

    const allowed = [
      'companyName', 'currency', 'currencySymbol', 'taxRate', 'taxLabel',
      'address', 'phone', 'email', 'logo', 'invoicePrefix', 'invoiceFooter',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    let result;
    if (existing) {
      result = db.update(req.companyId, 'settings', existing.id, updates);
    } else {
      result = db.insert(req.companyId, 'settings', { ...updates, companyId: req.companyId });
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
