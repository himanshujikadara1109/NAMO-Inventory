import { useState, useEffect } from 'react';
import api from '../api';
import KpiCard     from '../components/KpiCard';
import StatusBadge from '../components/StatusBadge';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import './DashboardPage.css';

const FMT = (n) =>
  n >= 1e7 ? `₹${(n/1e7).toFixed(2)}Cr`
  : n >= 1e5 ? `₹${(n/1e5).toFixed(1)}L`
  : `₹${Number(n).toLocaleString('en-IN')}`;

export default function DashboardPage({ onNavigate }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const s = stats;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted">Real-time overview of your business</p>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="kpi-grid">
        <KpiCard
          label="Total Revenue"
          value={loading ? null : FMT(s?.totalRevenue ?? 0)}
          sub={`This month: ${FMT(s?.revenueThisMonth ?? 0)}`}
          color="accent"
          loading={loading}
        />
        <KpiCard
          label="Total Orders"
          value={loading ? null : (s?.totalOrders ?? 0).toLocaleString()}
          sub={`This month: ${s?.ordersThisMonth ?? 0}`}
          color="violet"
          loading={loading}
        />
        <KpiCard
          label="Products"
          value={loading ? null : (s?.totalProducts ?? 0).toLocaleString()}
          sub={`${s?.lowStockCount ?? 0} low stock`}
          color="success"
          loading={loading}
        />
        <KpiCard
          label="Customers"
          value={loading ? null : (s?.totalCustomers ?? 0).toLocaleString()}
          color="warning"
          loading={loading}
        />
      </div>

      <div className="dashboard-grid">
        {/* ── Recent Orders ── */}
        <div className="card dashboard-card">
          <div className="card-head">
            <h3>Recent Orders</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('orders')} id="btn-view-all-orders">
              View all →
            </button>
          </div>
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : s?.recentOrders?.length === 0 ? (
            <div className="empty-state">
              <span className="icon"><ClipboardList size={36} strokeWidth={1.3} style={{ color: 'var(--text-3)' }} /></span>
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {(s?.recentOrders || []).map(o => (
                    <tr key={o.id}>
                      <td className="font-mono" style={{ fontSize: 12 }}>{o.orderNumber}</td>
                      <td>{o.customerName || '—'}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        ₹{Number(o.total).toLocaleString('en-IN')}
                      </td>
                      <td><StatusBadge status={o.status} /></td>
                      <td><StatusBadge status={o.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex-col gap-4">
          {/* Revenue Chart */}
          <div className="card dashboard-card">
            <div className="card-head">
              <h3>Revenue — Last 7 Days</h3>
            </div>
            {loading ? (
              <div className="page-loader" style={{ height: 140 }}><div className="spinner" /></div>
            ) : (
              <div className="mini-chart">
                {(s?.dailyRevenue || []).map((d, i) => {
                  const max = Math.max(...(s?.dailyRevenue || []).map(x => x.revenue), 1);
                  const pct = Math.max(4, (d.revenue / max) * 100);
                  return (
                    <div key={i} className="chart-col" title={`${d.date}: ₹${d.revenue.toLocaleString('en-IN')}`}>
                      <div className="chart-bar" style={{ height: `${pct}%` }} />
                      <div className="chart-label">{d.date}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Breakdown */}
          <div className="card dashboard-card">
            <div className="card-head"><h3>Order Status (30d)</h3></div>
            <div className="status-breakdown">
              {Object.entries(s?.statusBreakdown || {}).map(([status, count]) => (
                <div key={status} className="status-row">
                  <StatusBadge status={status} />
                  <div className="status-bar-wrap">
                    <div
                      className="status-bar"
                      style={{
                        width: `${Math.max(2, (count / Math.max(...Object.values(s?.statusBreakdown || { x: 1 }))) * 100)}%`
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 24, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock Alert */}
          {(s?.lowStockItems?.length ?? 0) > 0 && (
            <div className="card dashboard-card low-stock-card">
              <div className="card-head">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} strokeWidth={2} style={{ color: 'var(--danger)' }} />
                  Low Stock
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('products')} id="btn-view-low-stock">
                  View all →
                </button>
              </div>
              <div className="low-stock-list">
                {s.lowStockItems.map(p => (
                  <div key={p.id} className="low-stock-item">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.sku || 'No SKU'}</div>
                    </div>
                    <span className="badge badge-danger">{p.stock} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
