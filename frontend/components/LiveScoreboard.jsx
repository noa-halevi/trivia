import { useEffect, useMemo, useRef, useState } from 'react';
import LiveScoreRow, { ROW_HEIGHT } from './LiveScoreRow';
import { rankColorFor, sortScoresByTotal } from './rankColors';

export default function LiveScoreboard({
  scores = [],
  playerName,
  roundResult,
  onRankColorsChange,
}) {
  const roundScoreLookup = useMemo(() => {
    const results = roundResult?.player_results ?? roundResult?.round_scores ?? [];
    return new Map(results.map((result) => [result.nickname ?? result.name, result]));
  }, [roundResult]);

  const sortedScores = useMemo(() => sortScoresByTotal(scores), [scores]);
  const maxScore = Math.max(1, ...sortedScores.map((entry) => Number(entry.score) || 0));

  const [layoutMode, setLayoutMode] = useState('flow');
  const [rowTops, setRowTops] = useState({});
  const [phase, setPhase] = useState('idle');
  const [showWinnerBadge, setShowWinnerBadge] = useState(false);
  const [rankIndicators, setRankIndicators] = useState({});
  const [countUpActive, setCountUpActive] = useState(false);
  const [barTransition, setBarTransition] = useState(false);
  const [flashUpNames, setFlashUpNames] = useState({});
  const [dimDownNames, setDimDownNames] = useState({});
  const [displayScores, setDisplayScores] = useState({});
  const [displayRanks, setDisplayRanks] = useState({});
  const animationTokenRef = useRef(0);
  const lastRoundIdRef = useRef(null);

  const roundId = roundResult
    ? `${roundResult.question_id ?? ''}-${roundResult.correct_answer ?? ''}-${roundResult.display_seconds ?? ''}`
    : null;

  useEffect(() => {
    const rankColors = {};
    if (layoutMode === 'absolute' && Object.keys(displayRanks).length > 0) {
      Object.entries(displayRanks).forEach(([name, rank]) => {
        rankColors[name] = rankColorFor(rank - 1).hex;
      });
    } else {
      sortedScores.forEach((entry, index) => {
        const name = entry.nickname ?? entry.name;
        rankColors[name] = rankColorFor(index).hex;
      });
    }
    onRankColorsChange?.(rankColors);
  }, [sortedScores, displayRanks, layoutMode, onRankColorsChange]);

  useEffect(() => {
    if (!roundResult || !roundId) {
      setLayoutMode('flow');
      setPhase('idle');
      setShowWinnerBadge(false);
      setRankIndicators({});
      setCountUpActive(false);
      setBarTransition(false);
      setFlashUpNames({});
      setDimDownNames({});
      setRowTops({});
      setDisplayScores({});
      setDisplayRanks({});
      return undefined;
    }

    if (lastRoundIdRef.current === roundId) {
      return undefined;
    }
    lastRoundIdRef.current = roundId;

    const token = animationTokenRef.current + 1;
    animationTokenRef.current = token;

    const newSorted = sortScoresByTotal(scores);
    const oldScoreEntries = newSorted.map((entry) => {
      const name = entry.nickname ?? entry.name;
      const roundEntry = roundScoreLookup.get(name);
      const earned = Number(roundEntry?.points_earned ?? roundEntry?.points ?? 0) || 0;
      const current = Number(entry.score) || 0;
      return {
        ...entry,
        name,
        score: Math.max(0, current - earned),
      };
    });
    const oldSorted = sortScoresByTotal(oldScoreEntries);

    const oldRankByName = new Map(oldSorted.map((entry, index) => [entry.name, index]));
    const newRankByName = new Map(newSorted.map((entry, index) => [entry.name, index]));

    const initialTops = {};
    oldSorted.forEach((entry, index) => {
      initialTops[entry.name] = index * ROW_HEIGHT;
    });

    const initialDisplayScores = {};
    const initialDisplayRanks = {};
    oldSorted.forEach((entry, index) => {
      initialDisplayScores[entry.name] = Number(entry.score) || 0;
      initialDisplayRanks[entry.name] = index + 1;
    });

    const rankDeltas = {};
    const flashUp = {};
    const dimDown = {};
    newSorted.forEach((entry) => {
      const oldRank = oldRankByName.get(entry.name) ?? 0;
      const newRank = newRankByName.get(entry.name) ?? 0;
      const delta = oldRank - newRank;
      if (delta > 0) {
        rankDeltas[entry.name] = { direction: 'up', delta };
        flashUp[entry.name] = true;
      } else if (delta < 0) {
        rankDeltas[entry.name] = { direction: 'down', delta: Math.abs(delta) };
        dimDown[entry.name] = true;
      }
    });

    setLayoutMode('absolute');
    setPhase('highlight');
    setShowWinnerBadge(true);
    setRankIndicators({});
    setCountUpActive(false);
    setBarTransition(false);
    setFlashUpNames({});
    setDimDownNames({});
    setRowTops(initialTops);
    setDisplayScores(initialDisplayScores);
    setDisplayRanks(initialDisplayRanks);

    const timers = [];

    timers.push(window.setTimeout(() => {
      if (animationTokenRef.current !== token) {
        return;
      }
      const nextTops = {};
      newSorted.forEach((entry, index) => {
        nextTops[entry.name] = index * ROW_HEIGHT;
      });
      const nextRanks = {};
      newSorted.forEach((entry, index) => {
        nextRanks[entry.name] = index + 1;
      });
      setPhase('moving');
      setRowTops(nextTops);
      setDisplayRanks(nextRanks);
      setFlashUpNames(flashUp);
      setDimDownNames(dimDown);
    }, 600));

    timers.push(window.setTimeout(() => {
      if (animationTokenRef.current !== token) {
        return;
      }
      setPhase('indicators');
      setRankIndicators(rankDeltas);
    }, 800));

    timers.push(window.setTimeout(() => {
      if (animationTokenRef.current !== token) {
        return;
      }
      setPhase('countup');
      setCountUpActive(true);
      setBarTransition(true);
      const nextScores = {};
      newSorted.forEach((entry) => {
        nextScores[entry.name] = Number(entry.score) || 0;
      });
      setDisplayScores(nextScores);
    }, 1000));

    timers.push(window.setTimeout(() => {
      if (animationTokenRef.current !== token) {
        return;
      }
      setShowWinnerBadge(false);
      setFlashUpNames({});
      setDimDownNames({});
    }, 1600));

    timers.push(window.setTimeout(() => {
      if (animationTokenRef.current !== token) {
        return;
      }
      setRankIndicators({});
    }, 3800));

    timers.push(window.setTimeout(() => {
      if (animationTokenRef.current !== token) {
        return;
      }
      setLayoutMode('flow');
      setPhase('idle');
      setCountUpActive(false);
      setRowTops({});
      setDisplayScores({});
      setDisplayRanks({});
    }, 1900));

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [roundId, roundResult, scores, roundScoreLookup]);

  useEffect(() => {
    if (roundResult) {
      return;
    }
    lastRoundIdRef.current = null;
  }, [roundResult]);

  const playersForRender = layoutMode === 'absolute' ? getPlayersInVisualOrder(sortedScores, rowTops) : sortedScores;

  function getPlayerRank(entry) {
    const name = entry.nickname ?? entry.name;
    if (displayRanks[name]) {
      return displayRanks[name];
    }
    const sortedIndex = sortedScores.findIndex((item) => (item.nickname ?? item.name) === name);
    return sortedIndex + 1;
  }

  function getPlayerScore(entry) {
    const name = entry.nickname ?? entry.name;
    if (layoutMode === 'absolute' && displayScores[name] !== undefined) {
      return displayScores[name];
    }
    return Number(entry.score) || 0;
  }

  function winnerBadgeFor(entry) {
    if (!showWinnerBadge) {
      return null;
    }
    const name = entry.nickname ?? entry.name;
    const roundEntry = roundScoreLookup.get(name);
    if (!roundEntry?.is_top_scorer) {
      return null;
    }
    const points = Number(roundEntry.points_earned ?? roundEntry.points ?? 0) || 0;
    const label = roundEntry.label ?? '';
    if (label.toUpperCase().includes('FASTEST')) {
      return '🔥 FASTEST';
    }
    if (points > 0) {
      return `⚡ +${formatNumber(points)}`;
    }
    return '🔥 FASTEST';
  }

  const containerHeight = layoutMode === 'absolute'
    ? Math.max(sortedScores.length, 1) * ROW_HEIGHT
    : undefined;

  return (
    <div className="live-scoreboard" aria-label="Live standings">
      <div
        className={`board-inner ${layoutMode}`}
        style={containerHeight ? { height: containerHeight } : undefined}
      >
        {playersForRender.map((entry, index) => {
          const name = entry.nickname ?? entry.name;
          const rank = getPlayerRank(entry);
          const rankIndex = rank - 1;
          const rankColor = rankColorFor(rankIndex);
          const isYou = name === playerName;
          const roundEntry = roundScoreLookup.get(name);
          const indicator = rankIndicators[name];
          const rowStyle = layoutMode === 'absolute'
            ? {
                position: 'absolute',
                left: 0,
                right: 0,
                top: rowTops[name] ?? index * ROW_HEIGHT,
                zIndex: showWinnerBadge && roundEntry?.is_top_scorer ? 2 : 1,
                transition: 'top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }
            : undefined;

          return (
            <LiveScoreRow
              key={name}
              rank={rank}
              rankColor={rankColor}
              name={name}
              avatar={entry.avatar ?? '🦊'}
              score={Number(entry.score) || 0}
              displayScore={getPlayerScore(entry)}
              maxScore={maxScore}
              isYou={isYou}
              roundResult={roundEntry}
              showWinnerHighlight={showWinnerBadge && Boolean(roundEntry?.is_top_scorer)}
              winnerBadge={winnerBadgeFor(entry)}
              rankIndicator={indicator?.direction ?? null}
              rankDelta={indicator?.delta ?? 0}
              flashUp={Boolean(flashUpNames[name])}
              dimDown={Boolean(dimDownNames[name])}
              countUpActive={countUpActive}
              barTransition={barTransition || layoutMode === 'flow'}
              style={rowStyle}
            />
          );
        })}
      </div>
      <style jsx>{`
        .live-scoreboard {
          margin-top: 22px;
          padding: 16px 18px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-card);
          background: rgba(19, 4, 40, 0.62);
        }
        .board-inner {
          display: grid;
          gap: 6px;
        }
        .board-inner.absolute {
          position: relative;
          display: block;
        }
      `}</style>
    </div>
  );
}

function getPlayersInVisualOrder(sortedScores, rowTops) {
  return [...sortedScores].sort((left, right) => {
    const leftName = left.nickname ?? left.name;
    const rightName = right.nickname ?? right.name;
    return (rowTops[leftName] ?? 0) - (rowTops[rightName] ?? 0);
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
