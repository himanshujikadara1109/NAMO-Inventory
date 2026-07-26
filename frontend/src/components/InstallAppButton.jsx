import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import DownloadModal from './DownloadModal';

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showDlModal, setShowDlModal]       = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        return;
      }
    }
    setShowDlModal(true);
  };

  return (
    <>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleInstallClick}
        id="btn-install-app"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'linear-gradient(180deg, #30d158 0%, #28cd41 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          boxShadow: '0 2px 6px rgba(40,205,65,0.35)',
        }}
        title="Download & Install Application on Device"
      >
        <Download size={14} strokeWidth={2.2} />
        <span>Install App</span>
      </button>

      {/* Download Modal Popup */}
      <DownloadModal open={showDlModal} onClose={() => setShowDlModal(false)} />
    </>
  );
}
