import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  PhoneOff,
  Volume2,
  Users,
  AlertCircle,
} from 'lucide-react';
import './TeamCallModal.css';

export default function TeamCallModal({ initialMode = 'video', onClose }) {
  const { user } = useAuth();
  const [isVideo, setIsVideo]       = useState(initialMode === 'video');
  const [isMicOn, setIsMicOn]       = useState(true);
  const [isCamOn, setIsCamOn]       = useState(initialMode === 'video');
  const [isSharing, setIsSharing]   = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [permError, setPermError]   = useState(false);
  const [callId, setCallId]         = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Notify backend API about call start
  useEffect(() => {
    let activeCallId = null;
    api.post('/calls/start', { type: initialMode })
      .then(res => {
        if (res?.callRecord?.id) {
          activeCallId = res.callRecord.id;
          setCallId(res.callRecord.id);
        }
      })
      .catch(() => {});

    return () => {
      if (activeCallId) {
        api.post('/calls/end', { callId: activeCallId }).catch(() => {});
      }
    };
  }, [initialMode]);

  // WebRTC Camera & Audio Stream
  useEffect(() => {
    let isMounted = true;
    const startMedia = async () => {
      try {
        if (isCamOn || initialMode === 'video') {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: isCamOn,
            audio: isMicOn,
          });
          
          if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          streamRef.current = stream;
          setPermError(false);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Webcam / Microphone access notice:', err);
        setPermError(true);
      }
    };

    startMedia();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCamOn, initialMode]);

  const toggleMic = () => {
    const nextMic = !isMicOn;
    setIsMicOn(nextMic);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = nextMic;
      });
    }
  };

  const toggleCam = () => {
    const nextCam = !isCamOn;
    setIsCamOn(nextCam);
    if (!nextCam && streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => track.stop());
    }
  };

  const toggleScreenShare = async () => {
    if (!isSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          videoRef.current.play().catch(() => {});
        }
        setIsSharing(true);
        screenStream.getVideoTracks()[0].onended = () => {
          setIsSharing(false);
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
        };
      } catch {}
    } else {
      setIsSharing(false);
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    }
  };

  const handleEndCall = () => {
    if (callId) {
      api.post('/calls/end', { callId }).catch(() => {});
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    onClose();
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const initial = (name) => (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const mockParticipants = [
    { id: 'me', name: user?.name || 'You', isMe: true },
    { id: 'p1', name: 'Mitesh Shah', isTalking: true },
    { id: 'p2', name: 'Priya Patel', isTalking: false },
  ];

  return (
    <div className="call-backdrop" onClick={(e) => { if (e.target === e.currentTarget) handleEndCall(); }}>
      <div className="call-window">
        {/* Header */}
        <div className="call-header">
          <div className="call-title-box">
            <span className={`call-type-badge ${isVideo ? 'video' : 'audio'}`}>
              {isVideo ? <VideoIcon size={13} /> : <Volume2 size={13} />}
              {isVideo ? 'Team Video Meeting' : 'Team Audio Call'}
            </span>
            <span className="call-timer">{formatTimer(elapsed)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={14} /> 3 Connected
            </span>
          </div>
        </div>

        {/* Permission Alert Notice if blocked */}
        {permError && (
          <div className="call-perm-notice">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} />
              <span>Camera / Microphone access denied in browser. Please allow permissions in your address bar.</span>
            </div>
          </div>
        )}

        {/* Video Grid */}
        <div className="call-grid">
          {mockParticipants.map((p) => {
            if (p.isMe) {
              return (
                <div key={p.id} className={`call-tile ${isMicOn ? 'talking' : ''}`}>
                  {(isCamOn || isSharing) && !permError ? (
                    <video ref={videoRef} autoPlay playsInline muted className="call-video-feed" />
                  ) : (
                    <div className="call-avatar-placeholder">
                      <div className="call-avatar-circle">{initial(p.name)}</div>
                    </div>
                  )}

                  <div className="call-participant-name">
                    <span>{p.name} (You)</span>
                    {!isMicOn && (
                      <span className="call-mic-status">
                        <MicOff size={11} />
                      </span>
                    )}
                    {isMicOn && (
                      <div className="audio-waves">
                        <div className="audio-wave-bar" />
                        <div className="audio-wave-bar" />
                        <div className="audio-wave-bar" />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={p.id} className={`call-tile ${p.isTalking ? 'talking' : ''}`}>
                <div className="call-avatar-placeholder">
                  <div className="call-avatar-circle" style={{ background: p.id === 'p1' ? 'linear-gradient(135deg, #7c3aed, #af52de)' : 'linear-gradient(135deg, #16a34a, #34c759)' }}>
                    {initial(p.name)}
                  </div>
                </div>

                <div className="call-participant-name">
                  <span>{p.name}</span>
                  {p.isTalking && (
                    <div className="audio-waves">
                      <div className="audio-wave-bar" />
                      <div className="audio-wave-bar" />
                      <div className="audio-wave-bar" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Controls Bar */}
        <div className="call-controls-bar">
          <button
            className={`call-btn ${!isMicOn ? 'active-off' : ''}`}
            onClick={toggleMic}
            title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicOn ? <Mic size={20} /> : <MicOff size={20} color="#ff3b30" />}
          </button>

          <button
            className={`call-btn ${!isCamOn ? 'active-off' : ''}`}
            onClick={toggleCam}
            title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCamOn ? <VideoIcon size={20} /> : <VideoOff size={20} color="#ff3b30" />}
          </button>

          <button
            className={`call-btn ${isSharing ? 'active-off' : ''}`}
            onClick={toggleScreenShare}
            title={isSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <Monitor size={20} color={isSharing ? '#0071e3' : '#ffffff'} />
          </button>

          <button
            className="call-btn end-call"
            onClick={handleEndCall}
            title="End Call"
            id="btn-end-team-call"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
