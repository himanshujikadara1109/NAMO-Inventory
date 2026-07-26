/**
 * NAMO IMS — Dashboard Routes
 * GET /api/dashboard/stats
 */

const express = require('express');
const db      = require('../database/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  try {
    const cid = req.companyId;

    // Counts
    const totalProducts  = db.count(cid, 'products', { status: 'active' });
    const totalCustomers = db.count(cid, 'customers');
    const totalOrders    = db.count(cid, 'orders');

    // Revenue (sum of paid orders)
    const paidOrders = db.find(cid, 'orders', { filter: { paymentStatus: 'paid' } });
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // Orders this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const ordersThisMonth = db.count(cid, 'orders', { createdAt: { $gte: monthStart } });

    // Revenue this month
    const paidThisMonth = db.find(cid, 'orders', {
      filter: {
        paymentStatus: 'paid',
        createdAt: { $gte: monthStart },
      },
    });
    const revenueThisMonth = paidThisMonth.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // Low stock products (stock <= minStock)
    const allProducts = db.find(cid, 'products');
    const lowStock = allProducts.filter(p => Number(p.stock ?? 0) <= Number(p.minStock ?? 5));

    // Recent orders (last 10)
    const recentOrders = db.find(cid, 'orders', {
      sort: ['createdAt', 'desc'],
      limit: 10,
    });

    // Orders by status (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recent30 = db.find(cid, 'orders', {
      filter: { createdAt: { $gte: thirtyDaysAgo } },
    });
    const statusBreakdown = {
      pending:    0,
      processing: 0,
      shipped:    0,
      delivered:  0,
      cancelled:  0,
    };
    for (const o of recent30) {
      if (statusBreakdown[o.status] !== undefined) statusBreakdown[o.status]++;
    }

    // Daily revenue for last 7 days
    const dailyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
      const dayOrders = db.find(cid, 'orders', {
        filter: {
          paymentStatus: 'paid',
          createdAt: { $gte: dayStart, $lt: dayEnd },
        },
      });
      const rev = dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      dailyRevenue.push({
        date:    d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        revenue: rev,
        orders:  dayOrders.length,
      });
    }

    return res.json({
      totalProducts,
      totalCustomers,
      totalOrders,
      totalRevenue,
      ordersThisMonth,
      revenueThisMonth,
      lowStockCount:  lowStock.length,
      lowStockItems:  lowStock.slice(0, 5),
      recentOrders,
      statusBreakdown,
      dailyRevenue,
    });
  } catch (err) {
    console.error('[Dashboard/stats]', err);
    return res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

module.exports = router;
