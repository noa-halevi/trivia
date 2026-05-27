const DEFAULT_QUESTION_TIME = 15;

function timerColor(percentRemaining) {
  if (percentRemaining > 0.5) {
    return 'linear-gradient(90deg, var(--accent-gold), #FFE866)';
  }
  if (percentRemaining > 0.25) {
    return 'linear-gradient(90deg, #FF8C00, #FFB347)';
  }
  return 'linear-gradient(90deg, var(--wrong), #FF6B8A)';
}

export default function TimerBar({
  seconds = DEFAULT_QUESTION_TIME,
  secondsLeft,
  running = true,
}) {
  const duration = Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Number(seconds) : DEFAULT_QUESTION_TIME;
  const resolvedLeft = Number.isFinite(Number(secondsLeft)) ? Math.max(0, Number(secondsLeft)) : duration;
  const percentRemaining = duration > 0 ? resolvedLeft / duration : 0;
  const useLiveProgress = Number.isFinite(Number(secondsLeft));

  return (
    <div className="track" aria-hidden="true">
      <div
        className={running ? 'fill running' : 'fill'}
        style={{
          width: useLiveProgress ? `${percentRemaining * 100}%` : undefined,
          background: timerColor(percentRemaining),
        }}
      />
      <style jsx>{`
        .track {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          overflow: hidden;
          background: var(--bg-card);
        }
        .fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.15s linear, background 0.25s ease;
        }
        .running {
          animation: drain ${duration}s linear forwards;
        }
        @keyframes drain {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
