import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare, X, Trash2 } from 'lucide-react';
import './ChatPanel.css';

export default function ChatPanel({ onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async () => {
    try {
      const data = await api.get('/chat');
      setMessages(data.messages || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000); // sync every 3s
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const newMsg = await api.post('/chat', { text: text.trim() });
      setMessages(prev => [...prev, newMsg]);
      setText('');
    } catch {}
    setSending(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="chat-backdrop" onClick={onClose} />
      <aside className="chat-panel">
        <div className="chat-header">
          <div className="chat-header-title">
            <MessageSquare size={17} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            <span>Team Chat</span>
            <span className="chat-online-dot" title="Live" />
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} id="btn-chat-close">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="chat-messages">
          {loading && (
            <div className="page-loader" style={{ height: 120 }}>
              <div className="spinner" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="empty-state" style={{ margin: 'auto' }}>
              <span className="icon" style={{ opacity: 0.35 }}>
                <MessageSquare size={36} strokeWidth={1.3} />
              </span>
              <p>No messages yet. Start the team conversation!</p>
            </div>
          )}

          {messages.map((m) => {
            const isMine = m.userId === user?.id;
            return (
              <div key={m.id || m.createdAt} className={`chat-msg-row ${isMine ? 'mine' : 'other'}`}>
                <div className="chat-msg-meta">
                  <span>{isMine ? 'You' : m.userName}</span>
                  {m.userRole && (
                    <span className="badge badge-muted" style={{ fontSize: 9, padding: '1px 5px' }}>
                      {m.userRole}
                    </span>
                  )}
                  {(isMine || user?.role === 'admin') && (
                    <button
                      className="chat-del-btn"
                      onClick={(e) => handleDelete(m.id, e)}
                      title="Delete message"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <div className="chat-msg-bubble">
                  {m.text}
                  <div className="chat-msg-time">{formatTime(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="chat-input-bar">
          <input
            className="chat-input-field"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
            id="chat-input-field"
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!text.trim() || sending}
            id="btn-chat-send"
            title="Send"
          >
            <Send size={14} strokeWidth={2.2} />
          </button>
        </form>
      </aside>
    </>
  );
}
