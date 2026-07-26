import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import NotificationsPanel from './NotificationsPanel';
import ChatPanel          from './ChatPanel';
import TeamCallModal      from './TeamCallModal';
import IncomingCallAlert  from './IncomingCallAlert';
import InstallAppButton   from './InstallAppButton';
import DashboardPage  from '../pages/DashboardPage';
import ProductsPage   from '../pages/ProductsPage';
import OrdersPage     from '../pages/OrdersPage';
import CustomersPage  from '../pages/CustomersPage';
import UsersPage      from '../pages/UsersPage';
import SettingsPage   from '../pages/SettingsPage';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  KeyRound,
  Settings,
  Bell,
  MessageSquare,
  Phone,
  Video,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import './AppShell.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { id: 'orders',    label: 'Orders',     Icon: ShoppingCart     },
  { id: 'products',  label: 'Products',   Icon: Package          },
  { id: 'customers', label: 'Customers',  Icon: Users            },
  { id: 'users',     label: 'Users',      Icon: KeyRound, adminOnly: true },
  { id: 'settings',  label: 'Settings',   Icon: Settings         },
];

const PAGE_MAP = {
  dashboard: DashboardPage,
  orders:    OrdersPage,
  products:  ProductsPage,
  customers: CustomersPage,
  users:     UsersPage,
  settings:  SettingsPage,
};

export default function AppShell() {
  const { user, company, logout, isAdmin } = useAuth();
  const { toast } = useToast();

  const [page,         setPage]         = useState('dashboard');
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [showChat,     setShowChat]     = useState(false);
  const [callMode,     setCallMode]     = useState(null); // 'audio' | 'video' | null
  const [incomingCall, setIncomingCall] = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const ActivePage = PAGE_MAP[page] || DashboardPage;
  const filteredNav = NAV.filter(n => !n.adminOnly || isAdmin);
  const initial = (name) => (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Poll for Active Calls & Notifications every 3s
  const checkActiveCalls = useCallback(async () => {
    try {
      const data = await api.get('/calls/active');
      if (data?.activeCall && data.activeCall.callerId !== user?.id && !callMode) {
        setIncomingCall(data.activeCall);
      } else if (!data?.activeCall) {
        setIncomingCall(null);
      }
    } catch {}
  }, [user?.id, callMode]);

  useEffect(() => {
    checkActiveCalls();
    const interval = setInterval(checkActiveCalls, 3000);
    return () => clearInterval(interval);
  }, [checkActiveCalls]);

  // WebSocket for Instant Broadcast (Call / Chat Alerts)
  useEffect(() => {
    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3001?companyId=${company?.companyId}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'INCOMING_CALL' && data.payload?.callRecord?.callerId !== user?.id) {
            setIncomingCall(data.payload.callRecord);
            toast(`Incoming ${data.payload.callRecord.type} call from ${data.payload.callRecord.callerName}!`, 'info');
          } else if (data.event === 'CALL_ENDED') {
            setIncomingCall(null);
          } else if (data.event === 'CHAT_MESSAGE' && data.payload?.message?.userId !== user?.id) {
            toast(`💬 Message from ${data.payload.message.userName}: "${data.payload.message.text}"`, 'info');
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) ws.close();
    };
  }, [company?.companyId, user?.id, toast]);

  const handleAcceptCall = (type) => {
    setCallMode(type || 'video');
    setIncomingCall(null);
  };

  const handleDeclineCall = () => {
    setIncomingCall(null);
  };

  return (
    <div className="shell">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">N</div>
          <div>
            <div className="brand-name">NAMO IMS</div>
            <div className="brand-company truncate">{company?.name || 'Your Company'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {filteredNav.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => { setPage(id); setSidebarOpen(false); }}
              id={`nav-${id}`}
            >
              <span className="nav-icon">
                <Icon size={15} strokeWidth={page === id ? 2.2 : 1.8} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{initial(user?.name)}</div>
            <div className="min-w-0">
              <div className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
              <div className="truncate text-sm" style={{ color: 'var(--text-2)' }}>{user?.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={logout} title="Logout" id="btn-logout">
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      {/* ── Main Area ─────────────────────────────────── */}
      <div className="shell-main">
        {/* Topbar */}
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="btn btn-ghost btn-icon mobile-menu-btn"
              onClick={() => setSidebarOpen(o => !o)}
              id="btn-mobile-menu"
            >
              {sidebarOpen ? <X size={16} strokeWidth={2} /> : <Menu size={16} strokeWidth={2} />}
            </button>
            <h2 className="page-title">
              {NAV.find(n => n.id === page)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* 1-Click Install App Button */}
            <InstallAppButton />

            {/* Team Audio Call Button */}
            <button
              className="btn btn-ghost btn-icon call-audio-btn"
              onClick={() => setCallMode('audio')}
              id="btn-audio-call"
              title="Team Audio Call"
              style={{ color: '#28cd41' }}
            >
              <Phone size={16} strokeWidth={2} />
            </button>

            {/* Team Video Meeting Button */}
            <button
              className="btn btn-ghost btn-icon call-video-btn"
              onClick={() => setCallMode('video')}
              id="btn-video-meeting"
              title="Team Video Meeting"
              style={{ color: '#0071e3' }}
            >
              <Video size={16} strokeWidth={2} />
            </button>

            {/* Team Chat Button */}
            <button
              className="btn btn-ghost btn-icon chat-btn"
              onClick={() => { setShowChat(v => !v); setShowNotifs(false); }}
              id="btn-chat-toggle"
              title="Team Chat"
            >
              <MessageSquare size={16} strokeWidth={1.8} />
            </button>

            {/* Notifications Button */}
            <button
              className="btn btn-ghost btn-icon notif-btn"
              onClick={() => { setShowNotifs(v => !v); setShowChat(false); }}
              id="btn-notifications"
              title="Notifications"
            >
              <Bell size={16} strokeWidth={1.8} />
            </button>

            <div className="avatar topbar-avatar">{initial(user?.name)}</div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          <ActivePage onNavigate={setPage} />
        </main>
      </div>

      {/* Incoming Call Popup Alert for Team Members */}
      {incomingCall && !callMode && (
        <IncomingCallAlert
          incomingCall={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Team Audio / Video Meeting Modal */}
      {callMode && (
        <TeamCallModal initialMode={callMode} onClose={() => setCallMode(null)} />
      )}

      {/* Team Chat panel */}
      {showChat && (
        <ChatPanel onClose={() => setShowChat(false)} />
      )}

      {/* Notifications panel */}
      {showNotifs && (
        <NotificationsPanel onClose={() => setShowNotifs(false)} />
      )}
    </div>
  );
}
