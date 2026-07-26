import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import Modal     from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import './PageStyles.css';
import './OrdersPage.css';

const STATUS_TRANSITIONS = {
  pending:    ['processing', 'cancelled'],
  processing: ['shipped',    'cancelled'],
  shipped:    ['delivered',  'cancelled'],
  delivered:  [],
  cancelled:  [],
};

const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'];

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const [q,         setQ]         = useState('');
  const [statusFlt, setStatusFlt] = useState('');
  const [payFlt,    setPayFlt]    = useState('');
  const [page,      setPage]      = useState(1);
  const LIMIT = 25;

  // Create order modal
  const [createModal, setCreateModal] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderForm,   setOrderForm]   = useState({
    customerName: '', customerMobile: '', customerEmail: '',
    notes: '', paymentMethod: 'cash', discount: 0,
    lineItems: [{ productId: '', productName: '', sku: '', price: '', qty: 1 }],
  });

  // Detail modal
  const [detailOrder, setDetailOrder] = useState(null);

  // Product search for line items
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProd, setSearchingProd]   = useState(false);
  const lineSearchTimeout = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT, sort: 'createdAt', dir: 'desc' });
      if (q)         params.set('q',             q);
      if (statusFlt) params.set('status',        statusFlt);
      if (payFlt)    params.set('paymentStatus', payFlt);
      const data = await api.get(`/orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  }, [q, statusFlt, payFlt, page]);

  useEffect(() => { load(); }, [load]);

  // Search products for line item picker
  const searchProducts = (term) => {
    clearTimeout(lineSearchTimeout.current);
    if (!term) { setProductResults([]); return; }
    setSearchingProd(true);
    lineSearchTimeout.current = setTimeout(async () => {
      try {
        const data = await api.get(`/products?q=${encodeURIComponent(term)}&limit=8`);
        setProductResults(data.products);
      } catch {}
      setSearchingProd(false);
    }, 300);
  };

  const setLineItem = (idx, key, val) => {
    setOrderForm(f => {
      const items = [...f.lineItems];
      items[idx] = { ...items[idx], [key]: val };
      return { ...f, lineItems: items };
    });
  };

  const selectProduct = (idx, product) => {
    setOrderForm(f => {
      const items = [...f.lineItems];
      items[idx] = {
        productId:   product.id,
        productName: product.name,
        sku:         product.sku,
        price:       product.price,
        qty:         1,
      };
      return { ...f, lineItems: items };
    });
    setProductSearch('');
    setProductResults([]);
  };

  const addLine = () => setOrderForm(f => ({
    ...f,
    lineItems: [...f.lineItems, { productId: '', productName: '', sku: '', price: '', qty: 1 }],
  }));

  const removeLine = (idx) => setOrderForm(f => ({
    ...f,
    lineItems: f.lineItems.filter((_, i) => i !== idx),
  }));

  const orderTotal = () => {
    const sub = orderForm.lineItems.reduce((s, i) => s + (Number(i.price) * Number(i.qty || 1)), 0);
    return sub - Number(orderForm.discount || 0);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    const items = orderForm.lineItems.filter(i => i.productName || i.productId);
    if (!items.length) { toast('Add at least one product', 'error'); return; }
    setSavingOrder(true);
    try {
      await api.post('/orders', { ...orderForm, lineItems: items });
      toast('Order created!', 'success');
      setCreateModal(false);
      setOrderForm({
        customerName: '', customerMobile: '', customerEmail: '',
        notes: '', paymentMethod: 'cash', discount: 0,
        lineItems: [{ productId: '', productName: '', sku: '', price: '', qty: 1 }],
      });
      load();
    } catch (e) { toast(e.message, 'error'); }
    setSavingOrder(false);
  };

  const updateStatus = async (order, status) => {
    try {
      await api.patch(`/orders/${order.id}/status`, { status });
      toast(`Order moved to "${status}"`, 'success');
      load();
      if (detailOrder?.id === order.id) {
        setDetailOrder(prev => ({ ...prev, status }));
      }
    } catch (e) { toast(e.message, 'error'); }
  };

  const updatePayment = async (order, paymentStatus) => {
    try {
      await api.patch(`/orders/${order.id}/payment`, { paymentStatus });
      toast(`Payment status: "${paymentStatus}"`, 'success');
      load();
      if (detailOrder?.id === order.id) {
        setDetailOrder(prev => ({ ...prev, paymentStatus }));
      }
    } catch (e) { toast(e.message, 'error'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="list-page">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p className="text-muted">{total} orders total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateModal(true)} id="btn-create-order">
          + New Order
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="input filter-search"
          placeholder="Search orders…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          id="order-search"
        />
        <select className="input filter-select" value={statusFlt} onChange={e => { setStatusFlt(e.target.value); setPage(1); }} id="filter-order-status">
          <option value="">All Statuses</option>
          {['pending','processing','shipped','delivered','cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
          ))}
        </select>
        <select className="input filter-select" value={payFlt} onChange={e => { setPayFlt(e.target.value); setPage(1); }} id="filter-payment-status">
          <option value="">All Payments</option>
          {PAYMENT_STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8}><div className="page-loader"><div className="spinner" /></div></td></tr>
              )}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <span className="icon">📋</span>
                    <p>No orders found</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setCreateModal(true)}>Create first order</button>
                  </div>
                </td></tr>
              )}
              {orders.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setDetailOrder(o)}>
                  <td className="font-mono text-sm" style={{ color: 'var(--accent)' }}>{o.orderNumber}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.customerName || '—'}</div>
                    {o.customerMobile && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{o.customerMobile}</div>}
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{(o.lineItems||[]).length} items</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    ₹{Number(o.total).toLocaleString('en-IN')}
                  </td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><StatusBadge status={o.paymentStatus} /></td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                    {new Date(o.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setDetailOrder(o)} id={`btn-view-order-${o.id}`}>View</button>
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

      {/* ── Create Order Modal ─────────────────────────── */}
      <Modal
        title="New Order"
        open={createModal}
        onClose={() => setCreateModal(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateOrder} disabled={savingOrder} id="btn-save-order">
              {savingOrder ? 'Creating…' : 'Create Order'}
            </button>
          </>
        }
      >
        <div className="form-grid-2">
          <div className="form-group">
            <label>Customer Name</label>
            <input className="input" value={orderForm.customerName}
              onChange={e => setOrderForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="Walk-in customer" />
          </div>
          <div className="form-group">
            <label>Mobile</label>
            <input className="input" value={orderForm.customerMobile}
              onChange={e => setOrderForm(f => ({ ...f, customerMobile: e.target.value }))}
              placeholder="9876543210" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Email</label>
            <input className="input" value={orderForm.customerEmail}
              onChange={e => setOrderForm(f => ({ ...f, customerEmail: e.target.value }))}
              placeholder="customer@email.com" type="email" />
          </div>

          {/* Line Items */}
          <div className="form-section">
            <div className="form-section-label">Line Items</div>
            {orderForm.lineItems.map((item, idx) => (
              <div key={idx} className="line-item-row">
                <div className="line-item-name">
                  <input
                    className="input"
                    placeholder="Product name or search…"
                    value={item.productName || productSearch}
                    onChange={e => {
                      setLineItem(idx, 'productName', e.target.value);
                      setProductSearch(e.target.value);
                      searchProducts(e.target.value);
                    }}
                  />
                  {productResults.length > 0 && (
                    <div className="product-dropdown">
                      {productResults.map(p => (
                        <button key={p.id} className="product-option" type="button" onClick={() => selectProduct(idx, p)}>
                          <span>{p.name}</span>
                          <span style={{ color: 'var(--accent)', fontSize: 12 }}>₹{p.price}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="input"
                  type="number" min="0" placeholder="Price"
                  value={item.price}
                  onChange={e => setLineItem(idx, 'price', e.target.value)}
                  style={{ width: 90 }}
                />
                <input
                  className="input"
                  type="number" min="1" placeholder="Qty"
                  value={item.qty}
                  onChange={e => setLineItem(idx, 'qty', e.target.value)}
                  style={{ width: 70 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right', color: 'var(--accent)' }}>
                  ₹{(Number(item.price) * Number(item.qty || 1)).toLocaleString('en-IN')}
                </span>
                {orderForm.lineItems.length > 1 && (
                  <button className="btn btn-ghost btn-icon" type="button" onClick={() => removeLine(idx)} title="Remove">✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" type="button" onClick={addLine} style={{ marginTop: 8 }}>
              + Add Item
            </button>
          </div>

          <div className="form-group">
            <label>Discount (₹)</label>
            <input className="input" type="number" min="0"
              value={orderForm.discount}
              onChange={e => setOrderForm(f => ({ ...f, discount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select className="input" value={orderForm.paymentMethod}
              onChange={e => setOrderForm(f => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Notes</label>
            <textarea className="input" rows={2} value={orderForm.notes}
              onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="order-total-preview" style={{ gridColumn: '1/-1' }}>
            <span style={{ color: 'var(--text-2)' }}>Estimated Total:</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
              ₹{orderTotal().toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </Modal>

      {/* ── Order Detail Modal ─────────────────────────── */}
      <Modal
        title={`Order ${detailOrder?.orderNumber || ''}`}
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        size="lg"
      >
        {detailOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Customer */}
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{detailOrder.customerName || 'Walk-in'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{detailOrder.customerMobile} {detailOrder.customerEmail}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status={detailOrder.status} />
                  &nbsp;
                  <StatusBadge status={detailOrder.paymentStatus} />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="form-section-label">Items</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th>SKU</th><th>Price</th><th>Qty</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {(detailOrder.lineItems || []).map((li, i) => (
                      <tr key={i}>
                        <td>{li.productName}</td>
                        <td className="font-mono text-sm">{li.sku || '—'}</td>
                        <td>₹{Number(li.price).toLocaleString('en-IN')}</td>
                        <td>{li.qty}</td>
                        <td style={{ fontWeight: 600 }}>₹{Number(li.total).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Subtotal: ₹{Number(detailOrder.subtotal).toLocaleString('en-IN')}</div>
                {detailOrder.discount > 0 && <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Discount: -₹{Number(detailOrder.discount).toLocaleString('en-IN')}</div>}
                {detailOrder.tax > 0 && <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Tax ({detailOrder.taxRate}%): ₹{Number(detailOrder.tax).toLocaleString('en-IN')}</div>}
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>Total: ₹{Number(detailOrder.total).toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Status actions */}
            {STATUS_TRANSITIONS[detailOrder.status]?.length > 0 && (
              <div>
                <div className="form-section-label">Move to</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STATUS_TRANSITIONS[detailOrder.status].map(s => (
                    <button key={s} className="btn btn-secondary btn-sm"
                      onClick={() => updateStatus(detailOrder, s)}
                      id={`btn-status-${s}`}>
                      → {s.charAt(0).toUpperCase()+s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment actions */}
            <div>
              <div className="form-section-label">Payment Status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PAYMENT_STATUSES.filter(s => s !== detailOrder.paymentStatus).map(s => (
                  <button key={s} className="btn btn-secondary btn-sm"
                    onClick={() => updatePayment(detailOrder, s)}
                    id={`btn-payment-${s}`}>
                    {s.charAt(0).toUpperCase()+s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
