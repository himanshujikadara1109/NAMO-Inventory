import { Smartphone, Laptop, Monitor, Download, ExternalLink } from 'lucide-react';
import Modal from './Modal';
import './DownloadModal.css';

export default function DownloadModal({ open, onClose }) {
  const handleAndroidInstall = async () => {
    if (window.deferredPwaPrompt) {
      window.deferredPwaPrompt.prompt();
      const { outcome } = await window.deferredPwaPrompt.userChoice;
      if (outcome === 'accepted') {
        window.deferredPwaPrompt = null;
        onClose();
        return;
      }
    }
    // Pre-fill Vercel URL into PWABuilder generator
    const siteUrl = window.location.origin;
    window.open(`https://www.pwabuilder.com/url?url=${encodeURIComponent(siteUrl)}`, '_blank');
  };

  const handleWindowsDownload = () => {
    const siteUrl = window.location.origin;
    const element = document.createElement("a");
    const file = new Blob([
      `@echo off\r\ntitle NAMO IMS Desktop App\r\necho Launching NAMO IMS Standalone Application...\r\nstart msedge --app=${siteUrl} --name="NAMO IMS"\r\nexit\r\n`
    ], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "Install-NAMO-IMS-Desktop.bat";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Modal
      title="Download & Install Application"
      open={open}
      onClose={onClose}
      size="lg"
    >
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Select your device platform to install the native application:
      </p>

      <div className="dl-grid">
        {/* Android */}
        <div className="dl-card android">
          <div className="dl-icon-box">
            <Smartphone size={24} />
          </div>
          <div className="dl-title">Android Phone & Tablet</div>
          <div className="dl-desc">
            Install standalone Mobile App on your Android phone or generate .APK file.
          </div>
          <button className="btn btn-primary dl-btn" onClick={handleAndroidInstall} id="btn-dl-android">
            <Download size={14} /> Install / APK
          </button>
        </div>

        {/* macOS */}
        <div className="dl-card mac">
          <div className="dl-icon-box">
            <Laptop size={24} />
          </div>
          <div className="dl-title">macOS (MacBook / iMac)</div>
          <div className="dl-desc">
            Install native Mac App directly into your Applications folder & Dock.
          </div>
          <button
            className="btn btn-primary dl-btn"
            onClick={() => {
              alert('macOS Installation:\n1. Open Safari on Mac.\n2. Click File -> Add to Dock.\n3. NAMO IMS is now installed in your Mac Applications & Dock!');
            }}
            id="btn-dl-mac"
          >
            <ExternalLink size={14} /> Install on Mac
          </button>
        </div>

        {/* Windows */}
        <div className="dl-card windows">
          <div className="dl-icon-box">
            <Monitor size={24} />
          </div>
          <div className="dl-title">Windows PC & Laptop</div>
          <div className="dl-desc">
            Download Standalone Desktop Software (.BAT / .EXE) for Windows PC.
          </div>
          <button className="btn btn-primary dl-btn" onClick={handleWindowsDownload} id="btn-dl-win">
            <Download size={14} /> Download Desktop App
          </button>
        </div>
      </div>
    </Modal>
  );
}
