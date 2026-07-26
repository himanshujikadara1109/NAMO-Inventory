import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import './PageStyles.css';

const ROLES = ['admin', 'manager', 'staff'];
const EMPTY = { name: '', email: '', password: '', role: 'staff' };

export default function UsersPage() {
  const { user: me } = useAuth();

  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/users');
      setUsers(data);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing.id}`, payload);
        toast('User updated', 'success');
      } else {
        if (!form.password) { toast('Password is required for new users', 'error'); setSaving(false); return; }
        await api.post('/users', form);
        toast('User created', 'success');
      }
      setModal(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { active: !u.active });
      toast(`User ${u.active ? 'disabled' : 'enabled'}`, 'success');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="list-page">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="text-muted">{users.length} users in your organization</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="btn-create-user">+ Add User</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5}><div className="page-loader"><div className="spinner" /></div></td></tr>}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state"><span className="icon">🔑</span><p>No users found</p></div>
                </td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar">{u.name?.[0]?.toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        {u.id === me?.id && <div style={{ fontSize: 11, color: 'var(--accent)' }}>You</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{u.email}</td>
                  <td><StatusBadge status={u.role} /></td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-success' : 'badge-muted'}`}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} id={`btn-edit-user-${u.id}`}>Edit</button>
                      {u.id !== me?.id && (
                        <button className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => toggleActive(u)} id={`btn-toggle-user-${u.id}`}>
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? 'Edit User' : 'Add User'} open={modal} onClose={() => setModal(false)} size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-user">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Full Name *</label>
            <input className="input" value={form.name} onChange={f('name')} required placeholder="Staff Member Name" />
          </div>
          {!editing && (
            <div className="form-group">
              <label>Email *</label>
              <input className="input" type="email" value={form.email} onChange={f('email')} required placeholder="staff@company.com" />
            </div>
          )}
          <div className="form-group">
            <label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input className="input" type="password" value={form.password} onChange={f('password')}
              placeholder="Min 6 characters" autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select className="input" value={form.role} onChange={f('role')}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
