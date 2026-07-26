import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Package, ShoppingCart, RefreshCw, Bell, X, CheckCheck } from 'lucide-react';
import './NotificationsPanel.css';

const TYPE_ICONS = {
  LOW_STOCK:     <Package      size={18} strokeWidth={1.7} style={{ color: '#ff9f0a' }} />,
  ORDER_CREATED: <ShoppingCart size={18} strokeWidth={1.7} style={{ color: '#0071e3' }} />,
  ORDER_STATUS:  <RefreshCw    size={18} strokeWidth={1.7} style={{ color: '#28cd41' }} />,
  default:       <Bell         size={18} strokeWidth={1.7} style={{ color: '#6e6e73' }} />,
};

export default function NotificationsPanel({ onClose }) {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [count,   setCount]   = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/notifications');
      setNotifs(data.notifications);
      setCount(data.unreadCount);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const markAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      setCount(0);
    } catch {}
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const formatTime = (iso) => {
    const d   = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000)    return 'just now';
    if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <div className="notif-backdrop" onClick={onClose} />
      <aside className="notif-panel">
        <div className="notif-header">
          <div>
            <span className="notif-title">Notifications</span>
            {count > 0 && <span className="badge badge-accent" style={{ marginLeft: 8 }}>{count}</span>}
          </div>
          <div className="flex gap-2">
            {count > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAll} id="btn-notif-read-all"
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCheck size={13} strokeWidth={2} />
                Mark all read
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose} id="btn-notif-close">
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="notif-list">
          {loading && <div className="page-loader"><div className="spinner" /></div>}
          {!loading && notifs.length === 0 && (
            <div className="empty-state">
              <span className="icon" style={{ opacity: 0.4 }}>
                <Bell size={36} strokeWidth={1.4} />
              </span>
              <p>No notifications yet</p>
            </div>
          )}
          {notifs.map(n => (
            <div
              key={n.id}
              className={`notif-item ${n.read ? '' : 'unread'}`}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div className="notif-icon">
                {TYPE_ICONS[n.type] || TYPE_ICONS.default}
              </div>
              <div className="notif-content">
                <div className="notif-item-title">{n.title}</div>
                <div className="notif-item-msg">{n.message}</div>
                <div className="notif-time">{formatTime(n.createdAt)}</div>
              </div>
              <button
                className="btn btn-ghost btn-icon notif-del"
                onClick={(e) => deleteNotif(n.id, e)}
                title="Delete"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
