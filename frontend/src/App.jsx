import { useAuth } from './context/AuthContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 12, color: 'var(--text-2)',
      }}>
        <div className="spinner" />
        <span>Loading NAMO IMS…</span>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AuthProvider>
  );
}
