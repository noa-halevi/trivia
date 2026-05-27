import { sortScoresByTotal } from './rankColors';

export default function LeadingThisRound({
  scores = [],
  roundResult,
  playerName,
  streak = 0,
}) {
  const sorted = sortScoresByTotal(scores);
  const overallLeader = sorted[0];
  const roundWinner = roundResult?.round_winner;
  const leader = roundWinner
    ? {
        name: roundWinner.nickname ?? roundWinner.name,
        avatar: roundWinner.avatar ?? '🦊',
      }
    : overallLeader
      ? {
          name: overallLeader.nickname ?? overallLeader.name,
          avatar: overallLeader.avatar ?? '🦊',
        }
      : null;

  if (!leader) {
    return null;
  }

  const leaderName = leader.name ?? 'Player';
  const pointsThisRound = roundWinner
    ? Number(roundWinner.points_earned ?? 0)
    : null;
  const pointsLabel = pointsThisRound !== null
    ? `+${formatNumber(pointsThisRound)} pts this round`
    : overallLeader
      ? `${formatNumber(Number(overallLeader.score) || 0)} pts total`
      : '';
  const leaderStreak = leaderName === playerName ? streak : 0;

  return (
    <div className="leading-card">
      <p className="label">Leading This Round</p>
      <div className="leader-row">
        <span className="avatar" aria-hidden="true">{leader.avatar}</span>
        <div className="leader-meta">
          <span className="name">{leaderName}</span>
          {pointsLabel && <span className="points">{pointsLabel}</span>}
        </div>
      </div>
      {leaderStreak >= 1 && (
        <span className="streak-badge">🔥 {leaderStreak} streak</span>
      )}
      <style jsx>{`
        .leading-card {
          flex-shrink: 0;
          padding: 12px 14px;
          border: 1px solid var(--border-color);
          border-radius: 14px;
          background: var(--bg-card);
        }
        .label {
          margin: 0 0 10px;
          color: var(--text-dim);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .leader-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .avatar {
          font-size: 28px;
          line-height: 1;
        }
        .leader-meta {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 15px;
        }
        .points {
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 700;
        }
        .streak-badge {
          display: inline-block;
          margin-top: 8px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(255, 140, 0, 0.14);
          color: #ff8c00;
          font-size: 11px;
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
