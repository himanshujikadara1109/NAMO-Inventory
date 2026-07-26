/**
 * NAMO IMS — Backups Routes
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database/index');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const backupDir = path.resolve(process.env.BACKUP_DIR || './backups');
const COLLECTIONS = ['orders', 'products', 'customers', 'users', 'settings', 'audit_logs'];

// POST /api/backups — create manual backup
router.post('/', (req, res) => {
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${req.companyId}_manual_${ts}.json`;
    const dest = path.join(backupDir, name);

    const snapshot = {};
    for (const col of COLLECTIONS) {
      snapshot[col] = db.find(req.companyId, col);
    }
    fs.writeFileSync(dest, JSON.stringify(snapshot, null, 2));

    const record = db.insert(req.companyId, 'backups', {
      companyId: req.companyId,
      name,
      type:      'manual',
      path:      dest,
      size:      fs.statSync(dest).size,
      createdBy: req.user.id,
    });

    return res.status(201).json({ message: 'Backup created', backup: record });
  } catch (err) {
    console.error('[Backups/create]', err);
    return res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
});

// GET /api/backups — list backups
router.get('/', (req, res) => {
  try {
    const backups = db.find(req.companyId, 'backups', {
      filter: { companyId: req.companyId },
      sort:  ['createdAt', 'desc'],
    });
    return res.json(backups);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list backups' });
  }
});

// POST /api/backups/:id/restore
router.post('/:id/restore', (req, res) => {
  try {
    const backup = db.findById(req.companyId, 'backups', req.params.id);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });
    if (!fs.existsSync(backup.path)) return res.status(404).json({ error: 'Backup file missing' });

    const snapshot = JSON.parse(fs.readFileSync(backup.path, 'utf8'));

    for (const col of Object.keys(snapshot)) {
      db.invalidateCache(req.companyId, col);
      db.fileStore.write(req.companyId, col, snapshot[col]);
      db.invalidateCache(req.companyId, col);
    }

    return res.json({ message: 'Restore complete', restored: Object.keys(snapshot) });
  } catch (err) {
    console.error('[Backups/restore]', err);
    return res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

module.exports = router;
