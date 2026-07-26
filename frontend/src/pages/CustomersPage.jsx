import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import './PageStyles.css';

const EMPTY = { name: '', mobile: '', email: '', address: '' };

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [q,    setQ]    = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [viewCust,  setViewCust]  = useState(null);
  const [custDetail, setCustDetail] = useState(null);
  const [loadDetail, setLoadDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (q) params.set('q', q);
      const data = await api.get(`/customers?${params}`);
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const openView = async (c) => {
    setViewCust(c);
    setLoadDetail(true);
    try {
      const data = await api.get(`/customers/${c.id}`);
      setCustDetail(data);
    } catch {}
    setLoadDetail(false);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (c) => { setEditing(c); setForm({ name: c.name, mobile: c.mobile, email: c.email, address: c.address }); setModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, form);
        toast('Customer updated', 'success');
      } else {
        await api.post('/customers', form);
        toast('Customer added', 'success');
      }
      setModal(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="list-page">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="text-muted">{total} customers</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="btn-create-customer">+ Add Customer</button>
      </div>

      <div className="filter-bar">
        <input className="input filter-search" placeholder="Search by name, mobile, email…"
          value={q} onChange={e => { setQ(e.target.value); setPage(1); }} id="customer-search" />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Mobile</th><th>Email</th>
                <th>Orders</th><th>Total Spent</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6}><div className="page-loader"><div className="spinner" /></div></td></tr>}
              {!loading && customers.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <span className="icon">👥</span>
                    <p>No customers yet</p>
                    <button className="btn btn-primary btn-sm" onClick={openCreate}>Add first customer</button>
                  </div>
                </td></tr>
              )}
              {customers.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openView(c)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                        {c.name?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-sm">{c.mobile || '—'}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{c.email || '—'}</td>
                  <td>{c.totalOrders || 0}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    ₹{Number(c.totalSpent || 0).toLocaleString('en-IN')}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} id={`btn-edit-cust-${c.id}`}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openView(c)} id={`btn-view-cust-${c.id}`}>View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal title={editing ? 'Edit Customer' : 'Add Customer'} open={modal} onClose={() => setModal(false)} size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-customer">
              {saving ? 'Saving…' : editing ? 'Save' : 'Add Customer'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Full Name *</label>
            <input className="input" value={form.name} onChange={f('name')} required placeholder="Ramesh Patel" />
          </div>
          <div className="form-group">
            <label>Mobile</label>
            <input className="input" value={form.mobile} onChange={f('mobile')} placeholder="9876543210" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="input" type="email" value={form.email} onChange={f('email')} placeholder="ramesh@email.com" />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea className="input" value={form.address} onChange={f('address')} rows={2} placeholder="123 Main St, Ahmedabad" />
          </div>
        </form>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal title={viewCust?.name || 'Customer'} open={!!viewCust} onClose={() => { setViewCust(null); setCustDetail(null); }} size="lg">
        {loadDetail && <div className="page-loader"><div className="spinner" /></div>}
        {custDetail && !loadDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { l: 'Total Orders', v: custDetail.totalOrders || 0 },
                { l: 'Total Spent', v: `₹${Number(custDetail.totalSpent || 0).toLocaleString('en-IN')}` },
                { l: 'Mobile', v: custDetail.mobile || '—' },
              ].map(({ l, v }) => (
                <div key={l} className="card" style={{ background: 'var(--surface-2)', padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="form-section-label">Recent Orders</div>
              {(custDetail.orders || []).length === 0 ? (
                <p style={{ color: 'var(--text-2)', fontSize: 13 }}>No orders yet</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Order #</th><th>Total</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead>
                    <tbody>
                      {custDetail.orders.map(o => (
                        <tr key={o.id}>
                          <td className="font-mono text-sm" style={{ color: 'var(--accent)' }}>{o.orderNumber}</td>
                          <td style={{ fontWeight: 600 }}>₹{Number(o.total).toLocaleString('en-IN')}</td>
                          <td><StatusBadge status={o.status} /></td>
                          <td><StatusBadge status={o.paymentStatus} /></td>
                          <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
