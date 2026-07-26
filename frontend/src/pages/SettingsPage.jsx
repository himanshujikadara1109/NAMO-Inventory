import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Smartphone, Laptop, Monitor, Download, ExternalLink, Key, Copy, Check } from 'lucide-react';
import './PageStyles.css';
import '../components/DownloadModal.css';

export default function SettingsPage() {
  const { toast } = useToast();
  const { companyId } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCompanyId = () => {
    navigator.clipboard.writeText(companyId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    api.get('/settings')
      .then(data => setForm(data || {}))
      .catch(() => setForm({}))
      .finally(() => setLoading(false));
  }, []);

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast('Settings saved!', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setSaving(false);
  };

  const handleAndroidInstall = () => {
    window.open('https://www.pwabuilder.com', '_blank');
  };

  const handleWindowsDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([
      `@echo off\r\ntitle NAMO IMS Installer\r\necho Installing NAMO IMS Desktop Application...\r\nstart msedge --app=http://10.235.170.195:5173\r\nexit\r\n`
    ], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "Install-NAMO-IMS-Desktop.bat";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading || !form) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="list-page" style={{ maxWidth: 680 }}>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="text-muted">Configure your company, billing details, and device apps</p>
        </div>
      </div>

      {/* Company ID — read-only */}
      <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
        <div className="form-section-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Key size={14} style={{ color: 'var(--accent)' }} /> Your Company ID
        </div>
        <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          Login screen par ane doosra team members ne share karvano ID — save karke rakho.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="input"
            value={companyId || ''}
            readOnly
            id="display-company-id"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              background: 'var(--surface-2)',
              cursor: 'default',
              flex: 1,
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyCompanyId}
            id="btn-copy-company-id"
            style={{ whiteSpace: 'nowrap', minWidth: 95, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {copied ? <Check size={14} color="#30d158" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Download & Install Native Apps Section */}
      <div className="card">
        <div className="form-section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} style={{ color: 'var(--accent)' }} /> Download & Install Application Packages
        </div>
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
          Install standalone applications on Android phones, Macs, and Windows PCs:
        </p>

        <div className="dl-grid">
          {/* Android */}
          <div className="dl-card android">
            <div className="dl-icon-box">
              <Smartphone size={22} />
            </div>
            <div className="dl-title">Android Phone</div>
            <div className="dl-desc">
              Standalone .APK package for Android phones & tablets.
            </div>
            <button className="btn btn-primary dl-btn" onClick={handleAndroidInstall} id="btn-settings-dl-android">
              <Download size={13} /> Download APK
            </button>
          </div>

          {/* macOS */}
          <div className="dl-card mac">
            <div className="dl-icon-box">
              <Laptop size={22} />
            </div>
            <div className="dl-title">macOS App</div>
            <div className="dl-desc">
              Native Mac App for Applications folder & Dock.
            </div>
            <button
              className="btn btn-primary dl-btn"
              onClick={() => {
                alert('macOS Installation:\n1. Open Safari on Mac.\n2. Click File -> Add to Dock.\n3. NAMO IMS is now installed in your Mac Applications & Dock!');
              }}
              id="btn-settings-dl-mac"
            >
              <ExternalLink size={13} /> Install on Mac
            </button>
          </div>

          {/* Windows */}
          <div className="dl-card windows">
            <div className="dl-icon-box">
              <Monitor size={22} />
            </div>
            <div className="dl-title">Windows PC</div>
            <div className="dl-desc">
              Desktop Application Installer (.BAT / .EXE) for Windows.
            </div>
            <button className="btn btn-primary dl-btn" onClick={handleWindowsDownload} id="btn-settings-dl-win">
              <Download size={13} /> Download Desktop App
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Company */}
        <div className="card">
          <div className="form-section-label" style={{ marginBottom: 16 }}>Company Information</div>
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Company Name</label>
              <input className="input" value={form.companyName || ''} onChange={f('companyName')} placeholder="Your Business Name" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="input" value={form.phone || ''} onChange={f('phone')} placeholder="+91 98765 43210" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={form.email || ''} onChange={f('email')} placeholder="info@business.com" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Address</label>
              <textarea className="input" value={form.address || ''} onChange={f('address')} rows={2} placeholder="123 Business St, City, State - 380001" />
            </div>
          </div>
        </div>

        {/* Billing & Tax */}
        <div className="card">
          <div className="form-section-label" style={{ marginBottom: 16 }}>Billing & Tax</div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Currency</label>
              <select className="input" value={form.currency || 'INR'} onChange={f('currency')}>
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
            <div className="form-group">
              <label>Currency Symbol</label>
              <input className="input" value={form.currencySymbol || '₹'} onChange={f('currencySymbol')} placeholder="₹" />
            </div>
            <div className="form-group">
              <label>Tax Label</label>
              <input className="input" value={form.taxLabel || 'GST'} onChange={f('taxLabel')} placeholder="GST / VAT" />
            </div>
            <div className="form-group">
              <label>Tax Rate (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.01"
                value={form.taxRate ?? ''} onChange={f('taxRate')} placeholder="18" />
            </div>
          </div>
        </div>

        {/* Invoice */}
        <div className="card">
          <div className="form-section-label" style={{ marginBottom: 16 }}>Invoice</div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Invoice Number Prefix</label>
              <input className="input" value={form.invoicePrefix || ''} onChange={f('invoicePrefix')} placeholder="INV-" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label>Invoice Footer Note</label>
            <textarea className="input" value={form.invoiceFooter || ''} onChange={f('invoiceFooter')} rows={2}
              placeholder="Thank you for your business! Goods once sold are non-refundable." />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving} id="btn-save-settings">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
