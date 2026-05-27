const RANK_COLORS = [
  { hex: '#FFD700', rgb: '255, 215, 0' },
  { hex: '#00E5CC', rgb: '0, 229, 204' },
  { hex: '#C084FC', rgb: '192, 132, 252' },
  { hex: '#FF6B9D', rgb: '255, 107, 157' },
  { hex: '#00B4FF', rgb: '0, 180, 255' },
];

function rankColorFor(index) {
  return RANK_COLORS[Math.min(index, RANK_COLORS.length - 1)];
}

export default function MiniScoreboard({ scores = [], playerName }) {
  const sortedScores = [...scores].sort((left, right) => (Number(right.score) || 0) - (Number(left.score) || 0));
  const maxScore = Math.max(1, ...sortedScores.map((entry) => Number(entry.score) || 0));

  return (
    <div className="mini-scoreboard" aria-label="Live standings">
      {sortedScores.map((entry, index) => {
        const displayName = entry.nickname ?? entry.name ?? 'Player';
        const numericScore = Number(entry.score) || 0;
        const isYou = displayName === playerName;
        const barWidth = `${(numericScore / maxScore) * 100}%`;
        const { hex, rgb } = rankColorFor(index);

        return (
          <div
            key={`${displayName}-${index}`}
            className={`row ${isYou ? 'you' : ''}`}
            style={{
              borderLeftColor: hex,
              background: `rgba(${rgb}, 0.04)`,
            }}
          >
            <span className="rank" style={{ color: hex }}>
              #{index + 1}
            </span>
            <span className="avatar">{entry.avatar ?? '🦊'}</span>
            <span className="name">
              {displayName}
              {isYou && (
                <span className="you-label" style={{ color: hex }}>
                  (you)
                </span>
              )}
            </span>
            <span className="bar-track" aria-hidden="true">
              <span
                className="bar-fill"
                style={{
                  width: barWidth,
                  background: hex,
                  boxShadow: `0 0 8px rgba(${rgb}, 0.5)`,
                }}
              />
            </span>
            <span className="score">{formatNumber(numericScore)}</span>
          </div>
        );
      })}
      <style jsx>{`
        .mini-scoreboard {
          display: grid;
          gap: 8px;
          margin-top: 18px;
          padding: 12px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-card);
          background: rgba(19, 4, 40, 0.55);
        }
        .row {
          display: grid;
          grid-template-columns: 28px 24px minmax(0, 1fr) minmax(80px, 1.2fr) 44px;
          gap: 8px;
          align-items: center;
          padding: 6px 8px;
          border-radius: 10px;
          border: 1px solid transparent;
          border-left-width: 3px;
          border-left-style: solid;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
        }
        .rank {
          font-family: var(--font-display);
          font-size: 11px;
        }
        .avatar {
          font-size: 16px;
          line-height: 1;
        }
        .name {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary);
        }
        .you-label {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          opacity: 0.85;
        }
        .bar-track {
          height: 6px;
          border-radius: 999px;
          background: var(--bg-card);
        }
        .bar-fill {
          display: block;
          height: 100%;
          border-radius: 999px;
          transition: width 0.45s ease, box-shadow 0.45s ease;
        }
        .score {
          text-align: right;
          color: var(--text-primary);
          font-family: var(--font-display);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
