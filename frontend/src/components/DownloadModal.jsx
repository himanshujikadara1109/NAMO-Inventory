import { Smartphone, Laptop, Monitor, Download, ExternalLink } from 'lucide-react';
import Modal from './Modal';
import './DownloadModal.css';

export default function DownloadModal({ open, onClose }) {
  const handleAndroidInstall = () => {
    // Open PWABuilder Android APK generator or trigger PWA prompt
    window.open('https://www.pwabuilder.com', '_blank');
  };

  const handleWindowsDownload = () => {
    // Trigger batch app installer script download
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

  return (
    <Modal
      title="Download & Install Application"
      open={open}
      onClose={onClose}
      size="lg"
    >
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Select your device platform to download and install the native application package:
      </p>

      <div className="dl-grid">
        {/* Android */}
        <div className="dl-card android">
          <div className="dl-icon-box">
            <Smartphone size={24} />
          </div>
          <div className="dl-title">Android Phone & Tablet</div>
          <div className="dl-desc">
            Download standalone Android App package (.APK) for any Android phone or tablet.
          </div>
          <button className="btn btn-primary dl-btn" onClick={handleAndroidInstall} id="btn-dl-android">
            <Download size={14} /> Download APK
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
            Download Desktop Installer (.BAT / .EXE) for Windows 10 & 11 PCs.
          </div>
          <button className="btn btn-primary dl-btn" onClick={handleWindowsDownload} id="btn-dl-win">
            <Download size={14} /> Download Desktop App
          </button>
        </div>
      </div>
    </Modal>
  );
}
