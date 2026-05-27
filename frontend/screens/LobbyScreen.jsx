import Logo from '../components/Logo';
import PlayerCard from '../components/PlayerCard';

const LOBBY_WAIT = 30;
const CIRCUMFERENCE = 2 * Math.PI * 28;

export default function LobbyScreen({
  players = [],
  secondsLeft = 30,
  joinNotification = '',
  everyoneHere = false,
}) {
  const progress = (secondsLeft / LOBBY_WAIT) * CIRCUMFERENCE;
  const isUrgent = !everyoneHere && secondsLeft <= 5 && secondsLeft > 0;

  return (
    <main className="app-shell">
      <section className="screen-card lobby">
        {joinNotification && (
          <div className="join-toast" role="status" aria-live="polite">
            {joinNotification}
          </div>
        )}
        <Logo />
        {everyoneHere ? (
          <p className="everyone-ready" role="status" aria-live="polite">
            🎮 Everyone&apos;s here! Get ready...
          </p>
        ) : (
          <div className={`timer ${isUrgent ? 'urgent' : ''}`}>
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle className="track" cx="38" cy="38" r="28" />
              <circle
                className="progress"
                cx="38"
                cy="38"
                r="28"
                style={{ strokeDashoffset: CIRCUMFERENCE - progress }}
              />
            </svg>
            <strong>{secondsLeft}</strong>
          </div>
        )}
        <p className="section-label">Waiting Room</p>
        <div className="players">
          {players.map((player, index) => (
            <PlayerCard
              key={`${player.name}-${player.sid ?? index}`}
              {...player}
              animateIn={Boolean(player.justJoined && !player.isYou)}
            />
          ))}
        </div>
      </section>
      <style jsx>{`
        .join-toast {
          margin: 0 auto 14px;
          padding: 6px 18px;
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 20px;
          background: rgba(255, 215, 0, 0.1);
          color: var(--accent-gold);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 800;
          animation: toast-slide 2s ease forwards;
          pointer-events: none;
        }
        .lobby { text-align: center; }
        .timer { position: relative; display: inline-grid; place-items: center; margin: 20px; }
        svg { transform: rotate(-90deg); }
        .track,
        .progress {
          fill: none;
          stroke-width: 8;
          stroke-dasharray: ${CIRCUMFERENCE};
        }
        .track {
          stroke: var(--bg-card);
        }
        .progress {
          stroke: var(--accent-gold);
          transition: stroke-dashoffset 1s linear, stroke 0.3s ease;
        }
        .timer.urgent .progress {
          stroke: var(--wrong);
        }
        strong {
          position: absolute;
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 26px;
          transition: color 0.3s ease;
        }
        .timer.urgent strong {
          color: var(--wrong);
          animation: urgent-pulse 0.55s ease-in-out infinite;
        }
        .everyone-ready {
          margin: 20px auto;
          max-width: 280px;
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 18px;
          line-height: 1.35;
          animation: pglow 1.9s infinite ease-in-out;
        }
        .players { display: grid; gap: 10px; margin-top: 16px; }
        @keyframes toast-slide {
          0% {
            opacity: 0;
            transform: translateY(-14px);
          }
          12%, 80% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(0);
          }
        }
        @keyframes urgent-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
        @keyframes pglow {
          0%, 100% { text-shadow: 0 0 8px rgba(255,215,0,0.8), 0 0 18px rgba(255,215,0,0.5); }
          50% { text-shadow: 0 0 14px rgba(255,215,0,1), 0 0 28px rgba(255,215,0,0.8), 0 0 55px rgba(200,100,255,0.6); }
        }
      `}</style>
    </main>
  );
}
