export default function PlayerCard({
  name,
  nickname,
  avatar = '🦊',
  isYou = false,
  isBot = false,
  isPending = false,
  animationIndex = 0,
  animateIn = false,
}) {
  const displayName = nickname ?? name ?? 'Player';
  const resolvedAvatar = avatar || '🦊';

  return (
    <div
      className={`player ${isBot ? 'bot-player' : ''} ${isPending ? 'pending entering' : ''} ${animateIn ? 'player-card-new entering-live' : ''}`}
      style={isPending ? { animationDelay: `${animationIndex * 0.3}s` } : undefined}
    >
      <span className="avatar">{resolvedAvatar}</span>
      <span className="name">{displayName}</span>
      {isYou && <span className="badge you">YOU</span>}
      {isBot && <span className="badge bot">BOT</span>}
      <style jsx>{`
        .player {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-card);
          background: var(--bg-card);
          font-weight: 900;
        }
        .player.bot-player {
          opacity: 0.8;
        }
        .player.pending {
          opacity: 0.7;
        }
        .player.pending.entering {
          animation: player-enter-pending 0.45s ease both;
        }
        .player.player-card-new.entering-live {
          animation: slide-in 0.35s ease forwards;
        }
        .player.bot-player.player-card-new.entering-live {
          animation: slide-in-bot 0.35s ease forwards;
        }
        .avatar { font-size: 28px; }
        .name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .badge {
          margin-left: auto;
          flex-shrink: 0;
          border-radius: var(--radius-pill);
          font-weight: 900;
        }
        .badge.you {
          padding: 4px 10px;
          background: var(--accent-gold);
          color: var(--bg-deep);
          font-size: 11px;
        }
        .badge.bot {
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-dim);
          font-size: 9px;
          border: 0;
        }
        @keyframes player-enter-pending {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 0.7;
            transform: translateY(0);
          }
        }
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slide-in-bot {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
          }
          to {
            opacity: 0.8;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
