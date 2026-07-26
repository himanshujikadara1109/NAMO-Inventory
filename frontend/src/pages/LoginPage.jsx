import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './LoginPage.css';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { toast }           = useToast();

  const [mode,    setMode]    = useState('login');   // 'login' | 'register'
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginForm, setLoginForm] = useState({ email: '', password: '', companyId: '' });

  // Register form
  const [regForm, setRegForm] = useState({
    companyName: '', adminName: '', email: '', password: '',
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.companyId.trim()) {
      toast('Please enter your Company ID', 'error');
      return;
    }
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password, loginForm.companyId.trim());
      toast('Welcome back!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { companyName, adminName, email, password } = regForm;
    if (!companyName || !adminName || !email || !password) {
      toast('All fields are required', 'error');
      return;
    }
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await register(regForm);
      toast(`Welcome, ${adminName}! Your Company ID: ${data.company.companyId}`, 'success', 8000);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card-glass">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-icon">N</div>
          <div>
            <div className="login-brand-name">NAMO IMS</div>
            <div className="login-brand-sub">Inventory & Order Management</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
            id="tab-login"
          >
            Sign In
          </button>
          <button
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
            id="tab-register"
          >
            Register
          </button>
        </div>

        {/* ── Login Form ──────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="login-companyId">Company ID</label>
              <input
                id="login-companyId"
                type="text"
                className="input"
                placeholder="your-company-abc123"
                value={loginForm.companyId}
                onChange={e => setLoginForm(f => ({ ...f, companyId: e.target.value }))}
                required
                autoComplete="organization"
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="admin@company.com"
                value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={loading}
              id="btn-login-submit"
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── Register Form ────────────────────────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label htmlFor="reg-company">Company Name</label>
              <input
                id="reg-company"
                type="text"
                className="input"
                placeholder="Mitesh Traders Pvt Ltd"
                value={regForm.companyName}
                onChange={e => setRegForm(f => ({ ...f, companyName: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-name">Your Name</label>
              <input
                id="reg-name"
                type="text"
                className="input"
                placeholder="Mitesh Shah"
                value={regForm.adminName}
                onChange={e => setRegForm(f => ({ ...f, adminName: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                className="input"
                placeholder="admin@company.com"
                value={regForm.email}
                onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className="input"
                placeholder="Min 6 characters"
                value={regForm.password}
                onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={loading}
              id="btn-register-submit"
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
            <p className="login-hint">
              ⚠ Save your <strong>Company ID</strong> shown after registration — you'll need it to log in.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
