export default function ScoreChip({ value, label, pop = false, plain = false }) {
  return (
    <div className={`chip ${pop ? 'pop' : ''}`}>
      <div>{value}</div>
      <span>{label}</span>
      <style jsx>{`
        .chip {
          min-width: 82px;
          padding: 8px 12px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-pill);
          background: var(--bg-card);
          text-align: center;
        }
        .chip.pop {
          animation: score-pop 0.45s ease;
        }
        div {
          color: ${plain ? '#ffffff' : 'var(--accent-gold)'};
          font-family: var(--font-display);
          font-size: 17px;
        }
        span {
          color: var(--text-dim);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }
        @keyframes score-pop {
          0% { transform: scale(1); }
          50% {
            transform: scale(1.2);
            box-shadow: 0 0 16px rgba(255, 215, 0, 0.6);
          }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
