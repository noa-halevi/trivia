import { useEffect, useState } from 'react';
import Logo from '../components/Logo';

export default function PrivateRoomScreen({
  roomCode,
  players = [],
  isHost = false,
  isLoading = false,
  error = '',
  joinNotification = '',
  hostPromotedNotice = false,
  onStartGame,
  onBack,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyCode() {
    if (!roomCode) {
      return;
    }

    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
  }

  const showHostView = isHost && Boolean(roomCode);
  const showGuestView = !isHost && Boolean(roomCode);

  return (
    <main className="app-shell private-room-shell">
      {joinNotification && (
        <div className="join-banner" role="status">
          {joinNotification}
        </div>
      )}
      <section className="screen-card private-room">
        <Logo />
        <p className="section-label">🔒 Private Room</p>
        {hostPromotedNotice && (
          <p className="host-promoted">👑 You are now the host!</p>
        )}
        {error ? (
          <>
            <div className="error">{error}</div>
            <button className="ghost-button" onClick={onBack}>Back to Title</button>
          </>
        ) : isLoading || !roomCode ? (
          <p className="loading">Generating code...</p>
        ) : showHostView ? (
          <>
            <div className="code-section">
              <p className="code-label">Your room code:</p>
              <div className="room-code-box">
                <span className="code-text">{roomCode}</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={copyCode}
                  aria-label="Copy room code"
                >
                  {copied ? 'Copied! ✅' : '📋'}
                </button>
              </div>
              <p className="share-hint">Share the code above with friends, then start when ready!</p>
            </div>

            <div className="players-section">
              <h2>Players joined ({players.length}/8):</h2>
              <div className="players">
                {players.map((player, index) => (
                  <div
                    className={`player-row ${player.isHost ? 'host-card' : 'guest-card'}`}
                    key={`${player.sid ?? player.name}-${index}`}
                  >
                    <span className="player-avatar">{player.isHost ? '👑' : (player.avatar ?? '🦊')}</span>
                    <strong>{player.name}</strong>
                    <span className="player-tags">
                      {player.isYou && <em>YOU</em>}
                      {player.isHost && <small>HOST</small>}
                    </span>
                  </div>
                ))}
              </div>
              <p className="waiting">⏳ Waiting for friends to join...</p>
            </div>

            <button className="primary-button start-button btn-gold" onClick={onStartGame}>
              ▶ Start Game
            </button>
            <p className="start-hint">
              You can start now — bots will fill any empty spots automatically 🤖
            </p>
          </>
        ) : showGuestView ? (
          <>
            <p className="guest-room-code">
              Room code: <strong>{roomCode}</strong>
            </p>

            <div className="players-section">
              <h2>Players joined ({players.length}/8):</h2>
              <div className="players">
                {players.map((player, index) => (
                  <div
                    className={`player-row ${player.isHost ? 'host-card' : 'guest-card'}`}
                    key={`${player.sid ?? player.name}-${index}`}
                  >
                    <span className="player-avatar">{player.isHost ? '👑' : (player.avatar ?? '🦊')}</span>
                    <strong>{player.name}</strong>
                    <span className="player-tags">
                      {player.isYou && <em>YOU</em>}
                      {player.isHost && <small>HOST</small>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="waiting guest-waiting">
              ⏳ Waiting for the host to start the game...
            </p>
            <p className="guest-hint">
              Get ready! The game will start when the host clicks Start Game 🎮
            </p>
          </>
        ) : null}
      </section>
      <style jsx>{`
        .private-room-shell {
          display: grid;
          place-items: center;
          position: relative;
        }
        .join-banner {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          padding: 12px 20px;
          border-radius: var(--radius-pill);
          background: var(--bg-card);
          border: 2px solid var(--accent-gold);
          color: var(--text-primary);
          font-weight: 900;
          animation: banner-in 0.25s ease, banner-out 0.25s ease 1.75s forwards;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }
        @keyframes banner-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes banner-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .private-room {
          display: grid;
          gap: 16px;
          max-width: 560px;
          width: 100%;
          text-align: center;
        }
        .loading {
          margin: 0;
          color: var(--text-muted);
          font-weight: 900;
        }
        .host-promoted {
          margin: 0;
          padding: 10px 14px;
          border-radius: var(--radius-btn);
          background: rgba(255, 215, 0, 0.12);
          border: 1px solid var(--accent-gold);
          color: var(--accent-gold);
          font-weight: 900;
        }
        .code-section {
          display: grid;
          gap: 10px;
        }
        .code-label,
        .share-hint,
        .start-hint,
        .guest-hint,
        .guest-room-code {
          margin: 0;
          color: var(--text-muted);
          font-weight: 900;
        }
        .guest-room-code strong {
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 24px;
          letter-spacing: 3px;
        }
        .room-code-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-dark);
          border: 2px solid var(--accent-gold);
          border-radius: 12px;
          padding: 14px 20px;
          margin: 8px 0 16px;
          width: 100%;
        }
        .code-text {
          flex: 1;
          text-align: center;
          font-family: var(--font-display);
          font-size: 32px;
          color: var(--accent-gold);
          letter-spacing: 3px;
        }
        .copy-btn {
          font-size: 22px;
          background: none;
          border: none;
          cursor: pointer;
          transition: transform 0.15s;
          color: var(--text-primary);
          font-family: var(--font-body);
          font-weight: 900;
          white-space: nowrap;
        }
        .copy-btn:hover {
          transform: scale(1.2);
        }
        .players-section {
          display: grid;
          gap: 10px;
          text-align: left;
        }
        h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: 16px;
          text-align: center;
        }
        .players {
          display: grid;
          gap: 8px;
        }
        .player-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: var(--radius-btn);
          background: rgba(255, 255, 255, 0.04);
        }
        .host-card {
          border: 2px solid var(--accent-gold);
        }
        .guest-card {
          border: 2px solid var(--accent-purple-mid);
        }
        .player-row strong {
          color: var(--text-primary);
        }
        .player-avatar {
          font-size: 20px;
        }
        .player-tags {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .player-tags em,
        .player-tags small {
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.04em;
        }
        .player-tags em {
          color: var(--accent-purple-light);
        }
        .player-tags small {
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          background: rgba(255, 215, 0, 0.15);
          border: 1px solid var(--accent-gold);
          color: var(--accent-gold);
        }
        .waiting {
          color: var(--text-muted);
          margin: 0;
          font-weight: 900;
          text-align: center;
        }
        .guest-waiting {
          line-height: 1.5;
        }
        .start-button {
          justify-self: center;
          min-width: 260px;
          font-family: var(--font-display);
          font-size: 18px;
        }
        .error {
          padding: 16px;
          border: 2px solid var(--wrong);
          border-radius: var(--radius-card);
          background: rgba(255, 68, 102, 0.12);
          color: var(--text-primary);
          font-weight: 900;
        }
      `}</style>
    </main>
  );
}
