import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import PodiumPlace from '../components/PodiumPlace';

function isEmptyBot(player) {
  const isBot = player.is_bot || player.avatar === '🤖';
  return isBot && player.score === 0 && (player.questions_correct ?? 0) === 0;
}

function qualifiesForPodium(player) {
  if (!player) {
    return false;
  }
  return !isEmptyBot(player);
}

function qualifiesForStats(player) {
  return qualifiesForPodium(player);
}

export default function LeaderboardScreen({ leaderboard = [], stats, onPlayAgain }) {
  const roundsComplete = stats?.roundsComplete ?? 10;
  const podiumPlayers = leaderboard.filter(qualifiesForPodium).slice(0, 3);
  const statsPlayers = leaderboard.filter(qualifiesForStats);
  const [first, second, third] = podiumPlayers;

  useEffect(() => {
    const burst = () => {
      confetti({
        particleCount: 150,
        spread: 80,
        colors: ['#FFD700', '#C9A7EB', '#ffffff'],
        origin: { y: 0.55 },
      });
    };

    burst();
    const followUp = window.setTimeout(burst, 280);
    return () => window.clearTimeout(followUp);
  }, []);

  return (
    <main className="app-shell leaderboard-shell">
      <section className="screen-card">
        <h1 className="game-over">🎉 GAME OVER! 🎉</h1>
        <p className="final-copy">Final Results — {roundsComplete} rounds complete</p>

        {podiumPlayers.length > 0 && (
          <div className="podium">
            {second ? (
              <PodiumPlace
                place={2}
                name={playerName(second)}
                score={second.score ?? 0}
                avatar={playerAvatar(second)}
              />
            ) : (
              <div className="podium-spacer" aria-hidden="true" />
            )}
            {first && (
              <PodiumPlace
                place={1}
                name={playerName(first)}
                score={first.score ?? 0}
                avatar={playerAvatar(first)}
                isWinner
              />
            )}
            {third ? (
              <PodiumPlace
                place={3}
                name={playerName(third)}
                score={third.score ?? 0}
                avatar={playerAvatar(third)}
              />
            ) : (
              <div className="podium-spacer" aria-hidden="true" />
            )}
          </div>
        )}

        <div className="player-stats">
          {statsPlayers.map((player, index) => (
            <article className="stat-card" key={`${playerName(player)}-${index}`}>
              <div className="stat-header">
                <div className="stat-identity">
                  <span className="stat-rank">#{index + 1}</span>
                  <span className="stat-avatar" aria-hidden="true">{playerAvatar(player)}</span>
                  <strong className="stat-name">{playerName(player)}</strong>
                </div>
                <span className="stat-total">{formatNumber(player.score)} pts</span>
              </div>
              <p className="stat-line">
                <span>✅ {player.questions_correct ?? 0}/{roundsComplete}</span>
                <span>⚡ {formatSpeed(player.avg_speed ?? player.averageSpeed, player.questions_correct ?? 0)}</span>
                <span>🔥 Best: {player.best_streak ?? player.bestStreak ?? 0}</span>
                <span>🏆 +{formatNumber(player.best_round ?? player.best_round_points ?? player.bestRound ?? 0)}pts</span>
              </p>
            </article>
          ))}
        </div>

        <button className="primary-button play-again" onClick={onPlayAgain}>Play Again</button>
      </section>
      <style jsx>{`
        .leaderboard-shell {
          min-height: auto;
          padding: 20px 16px 24px;
        }
        .screen-card {
          text-align: center;
          padding: 22px 20px 20px;
        }
        .game-over {
          margin: 0;
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 36px;
          animation: pglow 1.9s infinite ease-in-out;
        }
        .final-copy {
          margin: 6px 0 20px;
          color: var(--text-muted);
          font-size: 16px;
          font-weight: 900;
        }
        .podium {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .podium-spacer {
          width: 30%;
          max-width: 140px;
        }
        .player-stats {
          display: flex;
          flex-direction: column;
          margin: 0 0 18px;
          text-align: left;
        }
        .stat-card {
          padding: 16px 6px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 900;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat-card:first-child {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .stat-identity {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .stat-rank {
          flex-shrink: 0;
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 18px;
        }
        .stat-avatar {
          flex-shrink: 0;
          font-size: 26px;
          line-height: 1;
        }
        .stat-name {
          color: var(--text-primary);
          font-size: 16px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .stat-total {
          flex-shrink: 0;
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 20px;
          white-space: nowrap;
        }
        .stat-line {
          display: flex;
          flex-wrap: wrap;
          gap: 16px 20px;
          margin: 0;
          padding-left: 54px;
          font-size: 14px;
          line-height: 1.6;
        }
        .play-again {
          padding: 16px 40px;
          background: var(--accent-gold);
          color: var(--bg-deep);
          font-family: var(--font-display);
          font-size: 20px;
          animation: ctaPulse 1.25s ease-in-out infinite;
          box-shadow: 0 14px 34px rgba(255, 215, 0, 0.32);
        }
        @keyframes pglow {
          0%, 100% { text-shadow: 0 0 8px rgba(255,215,0,0.8), 0 0 18px rgba(255,215,0,0.5); }
          50% { text-shadow: 0 0 14px rgba(255,215,0,1), 0 0 28px rgba(255,215,0,0.8), 0 0 55px rgba(200,100,255,0.6); }
        }
        @keyframes ctaPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @media (max-width: 640px) {
          .game-over { font-size: 30px; }
          .stat-line {
            gap: 10px 14px;
            padding-left: 0;
          }
        }
      `}</style>
    </main>
  );
}

function playerName(player) {
  return player?.name ?? player?.nickname ?? 'Player';
}

function playerAvatar(player) {
  return player?.avatar ?? '🦊';
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatSpeed(value, correctCount = 0) {
  if (!correctCount || value === null || value === undefined || value === '--') {
    return 'N/A';
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 'N/A';
  }

  return `${numericValue.toFixed(1)}s`;
}
