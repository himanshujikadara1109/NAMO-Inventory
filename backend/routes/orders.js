/**
 * NAMO IMS — Orders Routes
 * GET    /api/orders              list + search + filter
 * POST   /api/orders              create
 * GET    /api/orders/:id          get one
 * PUT    /api/orders/:id          update
 * PATCH  /api/orders/:id/status   update status only
 * PATCH  /api/orders/:id/payment  update payment status
 * DELETE /api/orders/:id          cancel/delete
 */

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const db       = require('../database/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const auditLog = require('../middleware/audit');

const router = express.Router();
router.use(requireAuth);

// Valid status transitions
const STATUS_FLOW = {
  pending:    ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered', 'cancelled'],
  delivered:  [],
  cancelled:  [],
};

const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'];

// ─── Generate order number ────────────────────────────────────────────────────
function generateOrderNumber(companyId) {
  const total  = db.count(companyId, 'orders') + 1;
  const prefix = 'ORD';
  return `${prefix}-${String(total).padStart(5, '0')}`;
}

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const {
      q, status, paymentStatus, customerId,
      page = 1, limit = 50, sort = 'createdAt', dir = 'desc',
      from, to,
    } = req.query;

    const filter = {};
    if (status)        filter.status        = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (customerId)    filter.customerId    = customerId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to)   filter.createdAt.$lte = to;
    }

    const options = {
      filter,
      sort:  [sort, dir],
      skip:  (Number(page) - 1) * Number(limit),
      limit: Number(limit),
    };
    if (q) options.search = q;

    const orders = db.find(req.companyId, 'orders', options);
    const total  = db.count(req.companyId, 'orders', filter);

    return res.json({
      orders,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('[Orders/list]', err);
    return res.status(500).json({ error: 'Failed to list orders' });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const order = db.findById(req.companyId, 'orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json(order);
});

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', auditLog('CREATE_ORDER', 'orders'), (req, res) => {
  try {
    const {
      customerId, customerName, customerMobile, customerEmail,
      lineItems = [], notes = '',
      paymentMethod = 'cash', discount = 0,
    } = req.body;

    if (!lineItems.length) {
      return res.status(400).json({ error: 'Order must have at least one line item' });
    }

    // Resolve & validate line items (snapshot product data)
    const resolvedItems = [];
    for (const item of lineItems) {
      if (!item.productId && !item.productName) {
        return res.status(400).json({ error: 'Each line item must have productId or productName' });
      }
      const product = item.productId
        ? db.findById(req.companyId, 'products', item.productId)
        : null;

      const qty   = Number(item.qty   || 1);
      const price = Number(item.price || product?.price || 0);

      resolvedItems.push({
        productId:   product?.id   || '',
        productName: product?.name || item.productName || '',
        sku:         product?.sku  || item.sku || '',
        price,
        qty,
        total:       price * qty,
      });

      // Deduct stock
      if (product) {
        const newStock = Math.max(0, Number(product.stock || 0) - qty);
        db.update(req.companyId, 'products', product.id, { stock: newStock });

        // Low stock notification
        if (newStock <= Number(product.minStock || 5)) {
          db.insert(req.companyId, 'notifications', {
            companyId: req.companyId,
            userId:    req.user.id,
            type:      'LOW_STOCK',
            title:     `Low Stock: ${product.name}`,
            message:   `Stock is now ${newStock} (min: ${product.minStock || 5})`,
            read:      false,
            meta:      { productId: product.id },
          });
        }
      }
    }

    const settings   = db.findOne(req.companyId, 'settings', { companyId: req.companyId });
    const taxRate     = Number(settings?.taxRate || 0);
    const subtotal    = resolvedItems.reduce((s, i) => s + i.total, 0);
    const discountAmt = Number(discount || 0);
    const taxable     = subtotal - discountAmt;
    const tax         = Math.round(taxable * taxRate / 100 * 100) / 100;
    const total       = Math.round((taxable + tax) * 100) / 100;

    const order = db.insert(req.companyId, 'orders', {
      orderNumber:     generateOrderNumber(req.companyId),
      companyId:       req.companyId,
      customerId:      customerId || '',
      customerName:    customerName  || '',
      customerMobile:  customerMobile || '',
      customerEmail:   customerEmail  || '',
      lineItems:       resolvedItems,
      subtotal,
      discount:        discountAmt,
      taxRate,
      tax,
      total,
      status:          'pending',
      paymentStatus:   'unpaid',
      paymentMethod,
      notes,
      createdBy:       req.user.id,
    });

    // Update customer stats
    if (customerId) {
      const customer = db.findById(req.companyId, 'customers', customerId);
      if (customer) {
        db.update(req.companyId, 'customers', customerId, {
          totalOrders: (Number(customer.totalOrders) || 0) + 1,
        });
      }
    }

    const broadcast = req.app.get('broadcast');
    broadcast(req.companyId, 'ORDER_CREATED', { id: order.id, orderNumber: order.orderNumber });

    return res.status(201).json(order);
  } catch (err) {
    console.error('[Orders/create]', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', auditLog('UPDATE_ORDER', 'orders'), (req, res) => {
  try {
    const existing = db.findById(req.companyId, 'orders', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (['delivered', 'cancelled'].includes(existing.status)) {
      return res.status(400).json({ error: `Cannot edit a ${existing.status} order` });
    }

    const allowed = ['notes', 'paymentMethod', 'customerName', 'customerMobile', 'customerEmail'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updated = db.update(req.companyId, 'orders', req.params.id, updates);
    return res.json(updated);
  } catch (err) {
    console.error('[Orders/update]', err);
    return res.status(500).json({ error: 'Failed to update order' });
  }
});

// ─── PATCH /:id/status ────────────────────────────────────────────────────────
router.patch('/:id/status', auditLog('UPDATE_ORDER_STATUS', 'orders'), (req, res) => {
  try {
    const { status } = req.body;
    const order = db.findById(req.companyId, 'orders', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const allowed = STATUS_FLOW[order.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from "${order.status}" to "${status}". Allowed: ${(allowed || []).join(', ') || 'none'}`,
      });
    }

    const updated = db.update(req.companyId, 'orders', req.params.id, { status });

    const broadcast = req.app.get('broadcast');
    broadcast(req.companyId, 'ORDER_STATUS_CHANGED', { id: order.id, status });

    return res.json(updated);
  } catch (err) {
    console.error('[Orders/status]', err);
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ─── PATCH /:id/payment ───────────────────────────────────────────────────────
router.patch('/:id/payment', auditLog('UPDATE_PAYMENT_STATUS', 'orders'), (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ error: `Invalid payment status. Valid: ${PAYMENT_STATUSES.join(', ')}` });
    }

    const order = db.findById(req.companyId, 'orders', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const updated = db.update(req.companyId, 'orders', req.params.id, { paymentStatus });

    // Update customer totalSpent if paid
    if (paymentStatus === 'paid' && order.customerId) {
      const customer = db.findById(req.companyId, 'customers', order.customerId);
      if (customer) {
        db.update(req.companyId, 'customers', order.customerId, {
          totalSpent: (Number(customer.totalSpent) || 0) + Number(order.total),
        });
      }
    }

    return res.json(updated);
  } catch (err) {
    console.error('[Orders/payment]', err);
    return res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('admin'), auditLog('DELETE_ORDER', 'orders'), (req, res) => {
  const order = db.findById(req.companyId, 'orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  db.delete(req.companyId, 'orders', req.params.id);
  return res.json({ message: 'Order deleted', id: req.params.id });
});

module.exports = router;
