/**
 * NAMO IMS — Users Routes (admin only)
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const db       = require('../database/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const auditLog = require('../middleware/audit');

const router = express.Router();
router.use(requireAuth);

const ROLES = ['admin', 'manager', 'staff'];

function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// GET /
router.get('/', requireRole('admin', 'manager'), (req, res) => {
  try {
    const users = db.find(req.companyId, 'users', { filter: { companyId: req.companyId } });
    return res.json(users.map(sanitize));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /:id
router.get('/:id', requireRole('admin', 'manager'), (req, res) => {
  const user = db.findById(req.companyId, 'users', req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(sanitize(user));
});

// POST /
router.post('/', requireRole('admin'), auditLog('CREATE_USER', 'users'), async (req, res) => {
  try {
    const { name, email, password, role = 'staff' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: `Invalid role. Valid: ${ROLES.join(', ')}` });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    if (db.findOne(req.companyId, 'users', { email: email.toLowerCase().trim() })) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = db.insert(req.companyId, 'users', {
      name:         name.trim(),
      email:        email.toLowerCase().trim(),
      passwordHash,
      role,
      companyId:    req.companyId,
      active:       true,
    });
    return res.status(201).json(sanitize(user));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /:id
router.put('/:id', requireRole('admin'), auditLog('UPDATE_USER', 'users'), async (req, res) => {
  try {
    const existing = db.findById(req.companyId, 'users', req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updates = {};
    if (req.body.name)   updates.name   = req.body.name.trim();
    if (req.body.role) {
      if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Invalid role' });
      updates.role = req.body.role;
    }
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    if (req.body.password) {
      if (req.body.password.length < 6) return res.status(400).json({ error: 'Password too short' });
      updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const updated = db.update(req.companyId, 'users', req.params.id, updates);
    return res.json(sanitize(updated));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /:id
router.delete('/:id', requireRole('admin'), auditLog('DELETE_USER', 'users'), (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const existing = db.findById(req.companyId, 'users', req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  db.delete(req.companyId, 'users', req.params.id);
  return res.json({ message: 'User deleted', id: req.params.id });
});

module.exports = router;
