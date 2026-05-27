import { useEffect, useRef, useState } from 'react';

const emojis = ['🔥', '👀', '💀', '😤', '🏆', '🤯', '💜', '🥳'];

export default function ChatBox({
  messages = [],
  nameColors = {},
  onlineCount = 0,
  fillHeight = false,
  onSend,
  onEmoji,
}) {
  const [draft, setDraft] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const messagesRef = useRef(null);
  const seenCountRef = useRef(0);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    if (messages.length > seenCountRef.current) {
      setHasUnread(true);
    }
  }, [messages.length]);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) {
      return undefined;
    }

    function handleScroll() {
      const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
      if (nearBottom) {
        seenCountRef.current = messages.length;
        setHasUnread(false);
      }
    }

    node.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => node.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  function sendDraft() {
    const clean = draft.trim();
    if (!clean) {
      return;
    }

    onSend?.(clean);
    setDraft('');
  }

  function displayName(message) {
    const avatar = message.avatar ?? (message.isBot ? '🤖' : '');
    const name = message.player_name ?? 'Player';
    if (avatar) {
      return `${avatar} ${name}`;
    }
    return name;
  }

  function nameColor(message) {
    const name = message.player_name ?? 'Player';
    if (message.isBot) {
      return '#67E8F9';
    }
    return nameColors[name] ?? (message.isYou ? 'var(--accent-gold)' : 'var(--text-muted)');
  }

  return (
    <aside className={`chat ${fillHeight ? 'fill' : ''}`}>
      <div className="chat-header">
        <span className="header-label">Live Chat</span>
        <span className="live-dot" aria-hidden="true" />
        <span className="online-count">{onlineCount} online</span>
        {hasUnread && <span className="unread-dot" aria-label="New messages" />}
      </div>
      <div className="messages" ref={messagesRef}>
        {messages.map((message, index) => (
          <p
            key={message.client_id ?? `${message.player_name}-${index}`}
            className={`message ${message.isBot ? 'bot' : message.isYou ? 'you' : 'other'}`}
          >
            <strong style={{ color: nameColor(message) }}>{displayName(message)}</strong>: {message.text}
            {message.pending && <span className="pending"> sending...</span>}
          </p>
        ))}
      </div>
      <div className="emoji-row">
        {emojis.map((emoji) => (
          <button key={emoji} type="button" onClick={() => onEmoji?.(emoji)}>{emoji}</button>
        ))}
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        sendDraft();
      }}>
        <input
          name="message"
          placeholder="Send a spicy thought..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" aria-label="Send chat message">💌</button>
      </form>
      <style jsx>{`
        .chat {
          display: flex;
          flex-direction: column;
          padding: 14px;
          border: 1px solid #1a0a30;
          border-radius: 14px;
          background: #08041a;
        }
        .chat.fill {
          flex: 1;
          min-height: 0;
        }
        .chat-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          margin-bottom: 10px;
        }
        .header-label {
          color: var(--text-dim);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--correct);
          box-shadow: 0 0 8px rgba(0, 230, 118, 0.8);
          animation: live-pulse 1.2s ease-in-out infinite;
        }
        .online-count {
          margin-left: auto;
          color: var(--text-dim);
          font-size: 11px;
          font-weight: 700;
        }
        .unread-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-gold);
        }
        .messages {
          flex: 1;
          min-height: 120px;
          overflow: auto;
        }
        .fill .messages {
          min-height: 0;
        }
        .message {
          margin: 8px 0;
          color: var(--text-muted);
          animation: message-slide-in 0.28s ease both;
        }
        .pending { color: var(--text-dim); font-size: 12px; }
        .emoji-row {
          display: flex;
          gap: 10px;
          margin: 10px 0;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .emoji-row button, form button {
          border: 0;
          border-radius: 10px;
          background: transparent;
          font-size: 20px;
          padding: 4px 6px;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .emoji-row button:hover, form button:hover {
          transform: scale(1.2);
          background: rgba(255, 215, 0, 0.12);
        }
        form {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        input {
          flex: 1;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-btn);
          background: var(--bg-card);
          color: var(--text-primary);
          padding: 10px;
        }
        input::placeholder { color: var(--border-color); }
        @keyframes live-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes message-slide-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </aside>
  );
}
