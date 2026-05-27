const difficulties = [
  {
    value: 'adaptive',
    emoji: '✨',
    title: 'Adaptive',
    subtitle: 'Adjusts to your skill',
    badge: 'RECOMMENDED',
  },
  {
    value: 'easy',
    emoji: '🌱',
    title: 'Easy',
    subtitle: 'Difficulty 1–3',
    timeLabel: '20 sec / question',
  },
  {
    value: 'medium',
    emoji: '⚡',
    title: 'Medium',
    subtitle: 'Difficulty 4–6',
    timeLabel: '15 sec / question',
  },
  {
    value: 'hard',
    emoji: '🔥',
    title: 'Hard',
    subtitle: 'Difficulty 7–10',
    timeLabel: '30 sec / question',
  },
];

export default function DifficultySelector({ value = 'adaptive', onChange }) {
  return (
    <div className="difficulty-selector">
      <p className="difficulty-label">DIFFICULTY 🎯</p>
      <div className="difficulty-grid">
        {difficulties.map((difficulty) => {
          const isSelected = value === difficulty.value;

          return (
            <button
              key={difficulty.value}
              type="button"
              className={`difficulty-card ${isSelected ? 'selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onChange?.(difficulty.value)}
            >
              <span className="emoji" aria-hidden="true">
                {difficulty.emoji}
              </span>
              <span className="copy">
                <span className="header-row">
                  <span className="title">{difficulty.title}</span>
                  {difficulty.badge && <span className="badge">{difficulty.badge}</span>}
                </span>
                <span className="subtitle">{difficulty.subtitle}</span>
                {difficulty.timeLabel && <span className="time-label">{difficulty.timeLabel}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .difficulty-selector {
          width: 100%;
          text-align: left;
        }
        .difficulty-label {
          margin: 0 0 8px;
          color: var(--text-dim);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .difficulty-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: 100%;
        }
        .difficulty-card {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          width: 100%;
          min-height: 80px;
          padding: 14px 16px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-card);
          background: var(--bg-card);
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          transition: all 0.18s ease;
        }
        .difficulty-card:hover:not(.selected) {
          border-color: var(--accent-purple-light);
          background: #2E1050;
        }
        .difficulty-card.selected {
          border: 2.5px solid var(--accent-gold);
          background: rgba(255, 215, 0, 0.08);
          box-shadow: 0 0 16px rgba(255, 215, 0, 0.25);
        }
        .emoji {
          flex: 0 0 auto;
          font-size: 28px;
          line-height: 1;
        }
        .copy {
          display: grid;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .title {
          color: var(--text-primary);
          font-family: var(--font-display);
          font-size: 16px;
          line-height: 1;
        }
        .selected .title {
          color: var(--accent-gold);
        }
        .subtitle {
          color: var(--text-dim);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          line-height: 1.15;
        }
        .time-label {
          color: var(--accent-purple-light);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.15;
        }
        .badge {
          flex: 0 0 auto;
          padding: 2px 7px;
          border: 1px solid var(--accent-gold);
          border-radius: 20px;
          background: rgba(255, 215, 0, 0.15);
          color: var(--accent-gold);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.06em;
          line-height: 1;
          animation: badge-pulse 2s ease-in-out infinite;
        }

        @keyframes badge-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
