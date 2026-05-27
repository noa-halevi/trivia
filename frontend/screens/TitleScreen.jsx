import { useEffect, useState } from 'react';
import Logo from '../components/Logo';

const TAGLINES = [
  'Fast answers. Glory awaits. ⚡',
  'Outsmart the bots. Beat your friends. 🤖',
  '10 rounds. One winner. Are you ready? 🏆',
];

const PARTICLE_CHARS = ['✦', '✧', '⭐', '✨'];
const PLAYERS_ONLINE = 1247;

export default function TitleScreen({ onStartPublic, onCreatePrivate, onJoinPrivate, initialRoomCode = '' }) {
  const [showPrivate, setShowPrivate] = useState(Boolean(initialRoomCode));
  const [activeTab, setActiveTab] = useState(initialRoomCode ? 'join' : 'create');
  const [roomCode, setRoomCode] = useState(formatRoomCode(initialRoomCode));
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [taglineVisible, setTaglineVisible] = useState(true);
  const playersOnline = useCountUp(PLAYERS_ONLINE, 1500, 1500);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    setParticles(createParticles(18));
  }, []);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(formatRoomCode(initialRoomCode));
      setActiveTab('join');
      setShowPrivate(true);
    }
  }, [initialRoomCode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTaglineVisible(false);
      window.setTimeout(() => {
        setTaglineIndex((current) => (current + 1) % TAGLINES.length);
        setTaglineVisible(true);
      }, 300);
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  function openPrivateModal() {
    setJoinError('');
    setShowPrivate(true);
  }

  function closePrivateModal() {
    setJoinError('');
    setShowPrivate(false);
  }

  function handleRoomCodeChange(event) {
    setRoomCode(formatRoomCode(event.target.value));
    setJoinError('');
  }

  async function handleJoinRoom() {
    const normalizedCode = formatRoomCode(roomCode);
    if (!normalizedCode) {
      setJoinError('Room not found! Check the code 🤔');
      return;
    }

    setIsJoining(true);
    setJoinError('');
    const result = await onJoinPrivate?.(normalizedCode);
    setIsJoining(false);

    if (result?.ok === false) {
      setJoinError(result.message ?? 'Room not found! Check the code 🤔');
    }
  }

  return (
    <main className="app-shell title-screen">
      <div className="title-bg" aria-hidden="true">
        <div className="logo-glow" />
        <div className="particles">
          {particles.map((particle) => (
            <span
              key={particle.id}
              className="particle"
              style={{
                left: `${particle.left}%`,
                bottom: `${particle.bottom}%`,
                fontSize: `${particle.size}px`,
                '--particle-peak': particle.opacity,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
              }}
            >
              {particle.char}
            </span>
          ))}
        </div>
      </div>

      <div className="title-content">
        <div className="logo-block entrance-logo">
          <Logo />
        </div>

        <p
          className={`cycling-tagline entrance-tagline ${taglineVisible ? 'visible' : 'hidden'}`}
          aria-live="polite"
        >
          {TAGLINES[taglineIndex]}
        </p>

        <div className="title-actions">
          <button type="button" className="play-now-btn entrance-play" onClick={onStartPublic}>
            🌍 Play Now — Quick Match
          </button>
          <button type="button" className="private-room-btn entrance-private" onClick={openPrivateModal}>
            🔒 Private Room with Friends
          </button>
        </div>

        <div className="stats-row entrance-stats" aria-label="Game stats">
          <span>⚡ {playersOnline.toLocaleString()} players online</span>
          <span className="stat-dot" aria-hidden="true">·</span>
          <span>🧩 250+ questions</span>
          <span className="stat-dot" aria-hidden="true">·</span>
          <span>🏆 Real-time multiplayer</span>
        </div>
      </div>

      {showPrivate && (
        <div className="modal-backdrop" role="presentation">
          <section className="private-modal" role="dialog" aria-modal="true" aria-label="Private room">
            <button className="close-button" aria-label="Close" onClick={closePrivateModal}>×</button>
            <header className="modal-header">
              <h2 className="modal-title">🔒 Play with Friends</h2>
              <p className="modal-subtitle">
                Create a room and share the code — or join a friend&apos;s game
              </p>
            </header>
            <div className="tabs-wrap">
              <div className="tabs" role="tablist" aria-label="Private room actions">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'create'}
                  className={activeTab === 'create' ? 'active' : ''}
                  onClick={() => setActiveTab('create')}
                >
                  Create Room 🏠
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'join'}
                  className={activeTab === 'join' ? 'active' : ''}
                  onClick={() => setActiveTab('join')}
                >
                  Join Room 🔑
                </button>
              </div>
              <div className="tabs-divider" aria-hidden="true" />
            </div>

            {activeTab === 'create' ? (
              <div className="tab-panel" role="tabpanel">
                <div className="host-preview">
                  <p className="host-preview-title">🎮 You will be the HOST</p>
                  <ul className="host-preview-list">
                    <li>👥 Your friends join with your code</li>
                    <li>▶️ You decide when to start</li>
                    <li>🏆 Compete for the top spot together</li>
                  </ul>
                </div>
                <button type="button" className="modal-gold-btn" onClick={onCreatePrivate}>
                  Create Room →
                </button>
              </div>
            ) : (
              <div className="tab-panel" role="tabpanel">
                <label className="field-label" htmlFor="room-code">Enter room code 🔑</label>
                <input
                  id="room-code"
                  className="room-code-input"
                  value={roomCode}
                  onChange={handleRoomCodeChange}
                  placeholder="e.g. TRIV-4X"
                  autoComplete="off"
                  spellCheck={false}
                />
                {joinError && <p className="join-error">{joinError}</p>}
                <button
                  type="button"
                  className="modal-gold-btn"
                  onClick={handleJoinRoom}
                  disabled={isJoining}
                >
                  {isJoining ? 'Checking...' : 'Join Room →'}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <style jsx>{`
        .title-screen {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 32px 24px;
          overflow: hidden;
          text-align: center;
          background: var(--bg-deep);
        }

        .title-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .logo-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 60% 40% at 50% 35%,
            rgba(119, 0, 204, 0.25) 0%,
            transparent 70%
          );
        }

        .particles {
          position: absolute;
          inset: 0;
        }

        .particle {
          position: absolute;
          line-height: 1;
          animation-name: particle-rise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }

        @keyframes particle-rise {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          8% {
            opacity: var(--particle-peak, 0.25);
          }
          88% {
            opacity: var(--particle-peak, 0.25);
          }
          100% {
            transform: translateY(-115vh);
            opacity: 0;
          }
        }

        .title-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: min(100%, 520px);
        }

        .logo-block :global(.logo) {
          font-size: 62px;
        }

        .logo-block {
          margin-bottom: 10px;
          animation: entrance-logo 0.5s ease forwards;
          animation-delay: 0.2s;
          opacity: 0;
        }

        .logo-block :global(.subtitle) {
          animation: entrance-subtitle 0.4s ease forwards;
          animation-delay: 0.5s;
          opacity: 0;
        }

        @keyframes entrance-logo {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes entrance-subtitle {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .cycling-tagline {
          margin: 0 0 28px;
          min-height: 1.4em;
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 700;
          color: var(--text-dim);
          transition: opacity 0.3s ease;
          animation: entrance-tagline 0.3s ease forwards;
          animation-delay: 0.8s;
          opacity: 0;
        }

        .cycling-tagline.entrance-tagline.visible {
          opacity: 1;
        }

        .cycling-tagline.hidden {
          opacity: 0 !important;
        }

        @keyframes entrance-tagline {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .title-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          width: 100%;
        }

        .play-now-btn,
        .private-room-btn {
          width: 340px;
          max-width: 100%;
          border-radius: var(--radius-btn);
          font-family: var(--font-body);
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        .play-now-btn {
          padding: 18px 48px;
          border: 0;
          font-size: 18px;
          color: var(--bg-deep);
          background: linear-gradient(105deg, #ffd700 40%, #fff5a0 50%, #ffd700 60%);
          background-size: 200% auto;
          animation:
            entrance-play 0.45s ease forwards,
            shine-sweep 2.5s linear infinite,
            btn-glow 2s ease-in-out infinite;
          animation-delay: 1s, 1.45s, 1.45s;
          opacity: 0;
        }

        .play-now-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 0 32px rgba(255, 215, 0, 0.95), 0 0 60px rgba(255, 215, 0, 0.45);
        }

        .private-room-btn {
          padding: 16px 48px;
          font-size: 16px;
          color: white;
          background: rgba(255, 255, 255, 0.06);
          border: 2px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(4px);
          animation: entrance-private 0.45s ease forwards;
          animation-delay: 1.2s;
          opacity: 0;
        }

        .private-room-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: var(--accent-gold);
          color: var(--accent-gold);
          transform: scale(1.02);
        }

        @keyframes shine-sweep {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        @keyframes btn-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.4); }
          50% { box-shadow: 0 0 28px rgba(255, 215, 0, 0.8), 0 0 50px rgba(255, 215, 0, 0.3); }
        }

        @keyframes entrance-play {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes entrance-private {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .stats-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 28px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 800;
          color: var(--text-dim);
          animation: entrance-stats 0.6s ease forwards;
          animation-delay: 1.5s;
          opacity: 0;
        }

        @keyframes entrance-stats {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .stat-dot {
          opacity: 0.45;
          user-select: none;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(12, 3, 30, 0.72);
        }

        .private-modal {
          position: relative;
          display: grid;
          gap: 20px;
          width: min(100%, 520px);
          min-width: 480px;
          padding: 32px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-card);
          background: var(--bg-card);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.38);
        }

        .modal-header {
          display: grid;
          gap: 8px;
          padding-right: 28px;
        }

        .modal-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 400;
          line-height: 1.2;
          color: var(--accent-gold);
        }

        .modal-subtitle {
          margin: 0;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 700;
          line-height: 1.45;
          color: var(--text-dim);
        }

        .tabs-wrap {
          display: grid;
          gap: 0;
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .tabs button {
          border: 0;
          border-radius: var(--radius-pill);
          padding: 10px 24px;
          background: transparent;
          color: #ffffff;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 800;
          transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .tabs button:hover:not(.active) {
          background: rgba(255, 255, 255, 0.06);
        }

        .tabs .active {
          background: var(--accent-gold);
          color: var(--bg-deep);
        }

        .tabs-divider {
          height: 1px;
          margin-top: 14px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.12) 20%,
            rgba(255, 255, 255, 0.12) 80%,
            transparent
          );
        }

        .tab-panel {
          display: grid;
          gap: 18px;
        }

        .host-preview {
          padding: 12px 16px;
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 12px;
          background: rgba(255, 215, 0, 0.06);
          text-align: left;
        }

        .host-preview-title {
          margin: 0 0 10px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
          color: var(--text-dim);
        }

        .host-preview-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
          color: var(--text-dim);
        }

        .field-label {
          margin: 0;
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-dim);
          text-align: left;
        }

        .room-code-input {
          width: 100%;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-btn);
          background: var(--bg-dark);
          color: var(--accent-gold);
          padding: 14px 18px;
          text-align: center;
          font-family: var(--font-display);
          font-size: 18px;
          letter-spacing: 3px;
          text-transform: uppercase;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .room-code-input::placeholder {
          color: rgba(255, 255, 255, 0.22);
          letter-spacing: 2px;
        }

        .room-code-input:focus {
          outline: none;
          border-color: var(--accent-gold);
          box-shadow: 0 0 16px rgba(255, 215, 0, 0.28);
        }

        .modal-gold-btn {
          width: 100%;
          border: 0;
          border-radius: var(--radius-btn);
          padding: 15px;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 400;
          color: var(--bg-deep);
          cursor: pointer;
          background: linear-gradient(105deg, #ffd700 40%, #fff5a0 50%, #ffd700 60%);
          background-size: 200% auto;
          animation: shine-sweep 2.5s linear infinite, btn-glow 2s ease-in-out infinite;
          transition: transform 0.2s ease;
        }

        .modal-gold-btn:hover:not(:disabled) {
          transform: scale(1.02);
        }

        .modal-gold-btn:disabled {
          opacity: 0.65;
          cursor: wait;
          animation: none;
        }

        .join-error {
          margin: -8px 0 0;
          color: var(--wrong);
          font-size: 14px;
          font-weight: 800;
          text-align: center;
        }

        .close-button {
          position: absolute;
          top: 12px;
          right: 14px;
          border: 0;
          background: transparent;
          color: var(--text-muted);
          font-size: 28px;
          font-weight: 900;
          line-height: 1;
          transition: color 0.16s ease;
        }

        .close-button:hover {
          color: var(--accent-gold);
        }

        @media (max-width: 520px) {
          .private-modal {
            min-width: 0;
            width: 100%;
            padding: 24px 20px;
          }

          .modal-header {
            padding-right: 20px;
          }

          .tabs button {
            padding: 10px 16px;
            font-size: 13px;
          }
        }

        @media (max-width: 400px) {
          .logo-block :global(.logo) {
            font-size: 48px;
          }

          .play-now-btn,
          .private-room-btn {
            width: 100%;
          }

          .stats-row {
            font-size: 11px;
            gap: 6px;
          }
        }
      `}</style>
    </main>
  );
}

function createParticles(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    char: PARTICLE_CHARS[Math.floor(Math.random() * PARTICLE_CHARS.length)],
    left: Math.random() * 100,
    bottom: Math.random() * 100,
    size: 10 + Math.random() * 8,
    opacity: 0.15 + Math.random() * 0.2,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 10,
  }));
}

function useCountUp(target, duration, delay = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frameId;
    let startTimeout;

    function animate() {
      const start = performance.now();

      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - (1 - progress) ** 3;
        setValue(Math.round(target * eased));

        if (progress < 1) {
          frameId = requestAnimationFrame(tick);
        }
      }

      frameId = requestAnimationFrame(tick);
    }

    startTimeout = window.setTimeout(animate, delay);

    return () => {
      window.clearTimeout(startTimeout);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [target, duration, delay]);

  return value;
}

function formatRoomCode(value) {
  const compact = String(value ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  if (compact.length <= 4) {
    return compact;
  }

  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}
