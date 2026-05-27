import { useEffect, useRef, useState } from 'react';

const ROW_HEIGHT = 52;

export { ROW_HEIGHT };

export default function LiveScoreRow({
  rank,
  rankColor,
  name,
  avatar = '🦊',
  score = 0,
  displayScore,
  maxScore = 1,
  isYou = false,
  showWinnerHighlight = false,
  winnerBadge,
  rankIndicator = null,
  rankDelta = 0,
  flashUp = false,
  dimDown = false,
  countUpActive = false,
  barTransition = false,
  style,
  className = '',
}) {
  const numericScore = Number(score) || 0;
  const targetDisplay = displayScore ?? numericScore;
  const [animatedScore, setAnimatedScore] = useState(targetDisplay);
  const countFromRef = useRef(targetDisplay);
  const previousTarget = useRef(targetDisplay);

  useEffect(() => {
    if (!countUpActive) {
      setAnimatedScore(targetDisplay);
      countFromRef.current = targetDisplay;
      previousTarget.current = targetDisplay;
      return undefined;
    }

    const from = Number(displayScore ?? countFromRef.current) || 0;
    const to = numericScore;
    previousTarget.current = to;
    const startedAt = Date.now();
    const duration = 800;

    const intervalId = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const value = Math.round(from + (to - from) * progress);
      setAnimatedScore(value);
      if (progress >= 1) {
        window.clearInterval(intervalId);
        countFromRef.current = to;
      }
    }, 16);

    return () => window.clearInterval(intervalId);
  }, [countUpActive, numericScore, targetDisplay]);

  useEffect(() => {
    if (!countUpActive) {
      setAnimatedScore(targetDisplay);
    }
  }, [targetDisplay, countUpActive]);

  const shownScore = countUpActive ? animatedScore : targetDisplay;
  const barWidth = `${(Math.max(0, shownScore) / Math.max(1, maxScore)) * 100}%`;
  const { hex, rgb } = rankColor ?? { hex: '#FFD700', rgb: '255, 215, 0' };

  return (
    <div
      className={`row ${isYou ? 'you' : ''} ${showWinnerHighlight ? 'winner' : ''} ${flashUp ? 'flash-up' : ''} ${dimDown ? 'dim-down' : ''} ${className}`}
      style={{
        borderLeftColor: hex,
        background: isYou
          ? `rgba(${rgb}, 0.06)`
          : showWinnerHighlight
            ? `rgba(${rgb}, 0.12)`
            : undefined,
        ...style,
      }}
    >
      <span className="rank" style={{ color: hex }}>
        #{rank}
      </span>
      <span className="avatar" aria-hidden="true">
        {avatar}
      </span>
      <span className="name">
        <span className="name-text">{name}</span>
        {isYou && <span className="you-label">(you)</span>}
        {winnerBadge && <span className="winner-badge" style={{ background: hex }}>{winnerBadge}</span>}
        {rankIndicator === 'up' && rankDelta > 0 && (
          <span className="rank-change up">▲{rankDelta}</span>
        )}
        {rankIndicator === 'down' && rankDelta > 0 && (
          <span className="rank-change down">▼{rankDelta}</span>
        )}
      </span>
      <span className="bar-track" aria-hidden="true">
        <span
          className={`bar-fill ${barTransition ? 'transition' : ''}`}
          style={{
            width: barWidth,
            background: hex,
            boxShadow: `0 0 8px rgba(${rgb}, 0.5)`,
          }}
        />
      </span>
      <span className="score" style={{ color: hex }}>
        {formatNumber(shownScore)}
      </span>
      <style jsx>{`
        .row {
          display: grid;
          grid-template-columns: 40px 30px minmax(0, 1fr) minmax(80px, 1.5fr) 56px;
          gap: 10px;
          align-items: center;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid transparent;
          border-left-width: 4px;
          border-left-style: solid;
          min-height: ${ROW_HEIGHT}px;
          box-sizing: border-box;
          width: 100%;
          transition:
            transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.3s ease,
            border-left-color 0.3s ease,
            background 0.25s ease;
        }
        .you {
          border-left-width: 5px;
        }
        .rank {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 900;
        }
        .avatar {
          font-size: 22px;
          line-height: 1;
        }
        .name {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
          min-width: 0;
          font-size: 15px;
          font-weight: 800;
          color: var(--text-primary);
        }
        .name-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .you-label {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          color: #ffffff;
          opacity: 0.6;
        }
        .winner-badge {
          padding: 2px 8px;
          border-radius: 20px;
          color: #0a0a14;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
          animation: badgePop 0.28s ease both;
        }
        .rank-change {
          font-size: 11px;
          font-weight: 900;
          animation: indicatorFade 3s ease forwards;
        }
        .rank-change.up {
          color: #00e676;
        }
        .rank-change.down {
          color: #ff4466;
        }
        .bar-track {
          height: 7px;
          border-radius: 999px;
          background: var(--bg-card);
          overflow: hidden;
        }
        .bar-fill {
          display: block;
          height: 100%;
          border-radius: 999px;
        }
        .bar-fill.transition {
          transition: width 0.8s ease, box-shadow 0.8s ease;
        }
        .score {
          text-align: right;
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 900;
        }
        .flash-up {
          animation: borderGoldFlash 0.45s ease;
        }
        .dim-down {
          animation: rowDim 0.3s ease;
        }
        @keyframes badgePop {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes indicatorFade {
          0%, 75% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes borderGoldFlash {
          0%, 100% { border-left-color: inherit; }
          40% { border-left-color: #ffd700; box-shadow: inset 3px 0 0 #ffd700; }
        }
        @keyframes rowDim {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @media (max-width: 640px) {
          .row {
            grid-template-columns: 32px 24px minmax(0, 1fr) 48px;
            grid-template-rows: auto auto;
            row-gap: 6px;
          }
          .bar-track {
            grid-column: 1 / -1;
          }
          .score {
            grid-row: 1;
            grid-column: 4;
          }
        }
      `}</style>
    </div>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
