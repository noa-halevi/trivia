export default function DifficultyDots({ level = 1 }) {
  return (
    <div className="dots" aria-label={`Difficulty ${level} of 10`}>
      {Array.from({ length: 10 }, (_, index) => (
        <span key={index} className={index < level ? 'active' : ''} />
      ))}
      <style jsx>{`
        .dots { display: flex; gap: 3px; }
        span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--bg-card);
        }
        .active { background: var(--accent-gold); }
      `}</style>
    </div>
  );
}
