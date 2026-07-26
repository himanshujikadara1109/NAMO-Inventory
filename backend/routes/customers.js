/**
 * NAMO IMS — Customers Routes
 */

const express  = require('express');
const db       = require('../database/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const auditLog = require('../middleware/audit');

const router = express.Router();
router.use(requireAuth);

// GET /
router.get('/', (req, res) => {
  try {
    const { q, page = 1, limit = 50, sort = 'createdAt', dir = 'desc' } = req.query;
    const options = {
      filter: {},
      sort:  [sort, dir],
      skip:  (Number(page) - 1) * Number(limit),
      limit: Number(limit),
    };
    if (q) options.search = q;

    const customers = db.find(req.companyId, 'customers', options);
    const total     = db.count(req.companyId, 'customers');
    return res.json({ customers, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list customers' });
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  const customer = db.findById(req.companyId, 'customers', req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Attach order history
  const orders = db.find(req.companyId, 'orders', {
    filter: { customerId: req.params.id },
    sort: ['createdAt', 'desc'],
    limit: 20,
  });

  return res.json({ ...customer, orders });
});

// POST /
router.post('/', auditLog('CREATE_CUSTOMER', 'customers'), (req, res) => {
  try {
    const { name, mobile, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name is required' });

    if (mobile && db.findOne(req.companyId, 'customers', { mobile })) {
      return res.status(409).json({ error: `Mobile ${mobile} already registered` });
    }

    const customer = db.insert(req.companyId, 'customers', {
      name:        name.trim(),
      mobile:      mobile?.trim() || '',
      email:       email?.toLowerCase().trim() || '',
      address:     address?.trim() || '',
      totalOrders: 0,
      totalSpent:  0,
      companyId:   req.companyId,
    });
    return res.status(201).json(customer);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /:id
router.put('/:id', auditLog('UPDATE_CUSTOMER', 'customers'), (req, res) => {
  try {
    const existing = db.findById(req.companyId, 'customers', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });
    const updated = db.update(req.companyId, 'customers', req.params.id, req.body);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /:id
router.delete('/:id', requireRole('admin'), auditLog('DELETE_CUSTOMER', 'customers'), (req, res) => {
  const existing = db.findById(req.companyId, 'customers', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  db.delete(req.companyId, 'customers', req.params.id);
  return res.json({ message: 'Customer deleted', id: req.params.id });
});

module.exports = router;
