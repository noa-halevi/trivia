export default function CallFriendScreen({ advice, confidence, onClose }) {
  return (
    <div className="overlay">
      <section className="card">
        <div className="avatar">🤖</div>
        <p className="section-label">Prof. Trivius says</p>
        <h2>{advice ?? "I have a hunch, but don't quote me in front of the trivia gods. Look for the answer that feels like it belongs in the category!"}</h2>
        <strong>{confidence ?? 0}% confidence</strong>
        <button className="primary-button" onClick={onClose}>Got it</button>
      </section>
      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(19, 4, 40, 0.78);
        }
        .card {
          width: min(480px, 92vw);
          padding: 26px;
          border: 2px solid var(--border-hover);
          border-radius: var(--radius-card);
          background: var(--bg-card);
          text-align: center;
        }
        .avatar {
          font-size: 52px;
          filter: drop-shadow(0 0 18px var(--accent-gold));
          animation: pulse 1.4s infinite;
        }
        h2 { color: var(--text-primary); }
        strong { color: var(--accent-gold); display: block; margin: 12px; }
        @keyframes pulse { 50% { transform: scale(1.08); } }
      `}</style>
    </div>
  );
}
