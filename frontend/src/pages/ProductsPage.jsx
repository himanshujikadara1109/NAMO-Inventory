import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import Modal       from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { FileText } from 'lucide-react';
import './PageStyles.css';

const CATEGORIES = [
  'A4 Paper', 'A3 Paper', 'A2 Paper', 'A1 Paper',
  'Legal Size Paper', 'Letter Size Paper',
  'Bond Paper', 'Newsprint', 'Kraft Paper',
  'Tissue Paper', 'Carbon Paper', 'Tracing Paper',
  'Art Paper / Glossy', 'Cardboard / Board',
  'Corrugated Paper', 'Other',
];

const PAPER_SIZES = ['A4', 'A3', 'A2', 'A1', 'A0', 'Legal', 'Letter', 'Foolscap', 'Custom'];

const PAPER_UNITS = ['Ream', 'Sheet', 'Box', 'Bundle', 'Roll', 'Kg', 'Packet', 'Carton'];

const EMPTY_FORM = {
  name: '', sku: '', barcode: '', category: '', brand: '',
  gsm: '', size: '',
  description: '', price: '', costPrice: '', stock: '', minStock: '5',
  unit: 'Ream', status: 'active',
};

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const [q,       setQ]       = useState('');
  const [cat,     setCat]     = useState('');
  const [statFlt, setStatFlt] = useState('');
  const [page,    setPage]    = useState(1);
  const LIMIT = 25;

  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null); // null = create
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [delId,   setDelId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (q)      params.set('q',      q);
      if (cat)    params.set('category', cat);
      if (statFlt) params.set('status', statFlt);
      const data = await api.get(`/products?${params}`);
      setProducts(data.products);
      setTotal(data.total);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  }, [q, cat, statFlt, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit   = (p) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode, category: p.category,
      brand: p.brand, description: p.description,
      gsm: p.gsm || '', size: p.size || '',
      price: p.price, costPrice: p.costPrice,
      stock: p.stock, minStock: p.minStock,
      unit: p.unit || 'Ream', status: p.status,
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast('Product name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, form);
        toast('Product updated', 'success');
      } else {
        await api.post('/products', form);
        toast('Product created', 'success');
      }
      setModal(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!delId) return;
    try {
      await api.delete(`/products/${delId}`);
      toast('Product deleted', 'success');
      setDelId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="list-page">
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="text-muted">{total} products total</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="btn-create-product">
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="input filter-search"
          placeholder="Search products…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          id="product-search"
        />
        <select className="input filter-select" value={cat} onChange={e => { setCat(e.target.value); setPage(1); }} id="filter-category">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="input filter-select" value={statFlt} onChange={e => { setStatFlt(e.target.value); setPage(1); }} id="filter-status">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Name / Brand</th>
                <th>SKU</th>
                <th>Category</th>
                <th>GSM / Size</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8}><div className="page-loader"><div className="spinner" /></div></td></tr>
              )}
              {!loading && products.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <span className="icon"><FileText size={36} strokeWidth={1.3} style={{ color: 'var(--text-3)' }} /></span>
                    <p>No products found</p>
                    <button className="btn btn-primary btn-sm" onClick={openCreate}>Add first product</button>
                  </div>
                </td></tr>
              )}
              {products.map(p => {
                const isLow = Number(p.stock) <= Number(p.minStock || 5);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.brand && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.brand}</div>}
                    </td>
                    <td className="font-mono text-sm" style={{ color: 'var(--text-2)' }}>{p.sku || '—'}</td>
                    <td>{p.category || '—'}</td>
                    <td>
                      {p.gsm ? <span style={{ fontWeight: 600 }}>{p.gsm} GSM</span> : '—'}
                      {p.size ? <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.size}</div> : null}
                    </td>
                    <td style={{ fontWeight: 600 }}>₹{Number(p.price).toLocaleString('en-IN')}</td>
                    <td>
                      <span style={{ color: isLow ? 'var(--danger)' : 'var(--text)', fontWeight: isLow ? 700 : 400 }}>
                        {p.stock} {p.unit}
                      </span>
                      {isLow && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 9 }}>Low</span>}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} id={`btn-edit-product-${p.id}`}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(p.id)} id={`btn-del-product-${p.id}`}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
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
      <Modal
        title={editing ? 'Edit Product' : 'Add Product'}
        open={modal}
        onClose={() => setModal(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-product">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Product'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Product Name *</label>
              <input className="input" value={form.name} onChange={f('name')} required placeholder="e.g. JK Copier A4 Paper 75 GSM" />
            </div>
            <div className="form-group">
              <label>SKU</label>
              <input className="input" value={form.sku} onChange={f('sku')} placeholder="JK-A4-75" />
            </div>
            <div className="form-group">
              <label>Barcode</label>
              <input className="input" value={form.barcode} onChange={f('barcode')} placeholder="8901234567890" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={f('category')}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Brand</label>
              <input className="input" value={form.brand} onChange={f('brand')} placeholder="JK Paper, ITC, Bilt, TNPL…" />
            </div>

            {/* Paper-specific fields */}
            <div className="form-group">
              <label>GSM (Paper Weight)</label>
              <input
                className="input"
                type="number"
                min="20" max="400" step="1"
                value={form.gsm}
                onChange={f('gsm')}
                placeholder="e.g. 70, 75, 80, 90, 100"
              />
            </div>
            <div className="form-group">
              <label>Size</label>
              <select className="input" value={form.size} onChange={f('size')}>
                <option value="">Select size…</option>
                {PAPER_SIZES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Selling Price (₹) *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={f('price')} required />
            </div>
            <div className="form-group">
              <label>Cost Price (₹)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.costPrice} onChange={f('costPrice')} />
            </div>
            <div className="form-group">
              <label>Stock Qty</label>
              <input className="input" type="number" min="0" value={form.stock} onChange={f('stock')} />
            </div>
            <div className="form-group">
              <label>Min Stock Alert</label>
              <input className="input" type="number" min="0" value={form.minStock} onChange={f('minStock')} />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select className="input" value={form.unit} onChange={f('unit')}>
                {PAPER_UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="input" value={form.status} onChange={f('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Description</label>
              <textarea className="input" value={form.description} onChange={f('description')} rows={2} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        title="Delete Product"
        open={!!delId}
        onClose={() => setDelId(null)}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDelId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} id="btn-confirm-delete">Delete</button>
          </>
        }
      >
        <p style={{ color: 'var(--text-2)' }}>
          Are you sure you want to delete this product? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
