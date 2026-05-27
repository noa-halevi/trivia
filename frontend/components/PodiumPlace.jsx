export default function PodiumPlace({ place, name, score, avatar = '🦊', isWinner = false }) {
  const blockHeights = { 1: 90, 2: 65, 3: 45 };

  return (
    <div className={`podium-column p${place} ${isWinner ? 'winner' : ''}`}>
      {isWinner && <span className="crown" aria-hidden="true">👑</span>}
      <span className="avatar" aria-hidden="true">{avatar}</span>
      <span className="name">{name}</span>
      <em className="score">{formatNumber(score)} pts</em>
      <div className="block" style={{ height: `${blockHeights[place]}px` }}>
        <strong>{place}</strong>
      </div>
      <style jsx>{`
        .podium-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: 30%;
          max-width: 140px;
          position: relative;
        }
        .avatar {
          font-size: 32px;
          line-height: 1;
        }
        .name {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 900;
          text-align: center;
          line-height: 1.2;
        }
        .score {
          color: var(--text-muted);
          font-style: normal;
          font-size: 12px;
          font-weight: 900;
        }
        .block {
          display: grid;
          place-items: center;
          width: 100%;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-card) var(--radius-card) 0 0;
          color: var(--text-primary);
          font-weight: 900;
        }
        .block strong {
          font-family: var(--font-display);
          font-size: 28px;
        }
        .p1 .block {
          background: var(--accent-gold);
          border-color: var(--accent-gold-stroke);
          color: var(--bg-deep);
        }
        .p1 .score {
          color: var(--accent-gold);
        }
        .p2 .block {
          background: #4a2a70;
        }
        .p3 .block {
          background: #3a1a60;
        }
        .winner .block {
          box-shadow: 0 0 24px rgba(255, 215, 0, 0.6);
        }
        .crown {
          position: absolute;
          top: -30px;
          font-size: 28px;
          animation: crownBounce 0.9s ease-in-out infinite;
        }
        @keyframes crownBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
