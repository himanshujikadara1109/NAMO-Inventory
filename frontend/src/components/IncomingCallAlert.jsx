import { Phone, Video, PhoneOff } from 'lucide-react';
import './TeamCallModal.css';

export default function IncomingCallAlert({ incomingCall, onAccept, onDecline }) {
  if (!incomingCall) return null;

  const { callerName, type = 'video' } = incomingCall;
  const initial = (name) => (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="incoming-call-alert" role="dialog" aria-label="Incoming Call">
      <div className="incoming-call-header">
        <div className="incoming-avatar">
          {initial(callerName)}
        </div>
        <div className="incoming-info">
          <div className="incoming-caller">{callerName || 'Team Member'}</div>
          <div className="incoming-type">
            Incoming Team {type === 'video' ? 'Video Meeting' : 'Audio Call'}…
          </div>
        </div>
      </div>

      <div className="incoming-actions">
        <button
          className="incoming-btn decline"
          onClick={onDecline}
          id="btn-decline-call"
        >
          <PhoneOff size={14} /> Decline
        </button>

        <button
          className="incoming-btn accept"
          onClick={() => onAccept(type)}
          id="btn-accept-call"
        >
          {type === 'video' ? <Video size={14} /> : <Phone size={14} />} Join Call
        </button>
      </div>
    </div>
  );
}
