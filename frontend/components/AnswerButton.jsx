export default function AnswerButton({ letter, text, state = 'default', revealClass = '', badgeText, disabled = false, onClick }) {
  return (
    <button className={`answer ${state} ${revealClass}`} disabled={disabled} onClick={onClick}>
      <span className="badge">{badgeText ?? letter}</span>
      <span>{text}</span>
      <style jsx>{`
        .answer {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 72px;
          padding: 18px 16px;
          border: 2px solid var(--border-color);
          border-radius: 14px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 800;
          text-align: left;
          transition: all 0.15s ease;
        }
        .answer:hover:not(:disabled) {
          border-color: var(--accent-gold);
          background: #32135f;
          transform: scale(1.03) translateY(-2px);
          box-shadow: 0 4px 20px rgba(255, 215, 0, 0.2);
        }
        .badge {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 8px;
          background: #3A1A60;
          color: var(--accent-purple-light);
          font-family: var(--font-display);
        }
        .answer:hover:not(:disabled) .badge {
          background: var(--accent-gold);
          color: var(--bg-deep);
        }
        .selected {
          border-color: var(--accent-purple-light);
          background: #3A1A60;
          animation: selectedPulse 1.25s ease-in-out infinite;
          box-shadow: 0 0 0 1px rgba(201, 167, 235, 0.22), 0 0 18px rgba(201, 167, 235, 0.24);
        }
        .selected .badge {
          background: var(--accent-purple-light);
          color: var(--bg-deep);
        }
        .locked {
          border-color: var(--accent-gold);
          background: rgba(255, 215, 0, 0.08);
        }
        .locked .badge {
          background: var(--accent-gold);
          color: var(--bg-deep);
        }
        .correct {
          border-color: var(--correct);
          background: rgba(0, 230, 118, 0.08);
        }
        .correct .badge {
          background: var(--correct);
          color: #003020;
        }
        .wrong {
          border-color: var(--wrong);
          background: rgba(255, 68, 102, 0.07);
          opacity: 0.6;
        }
        .wrong .badge {
          background: var(--wrong);
          color: white;
        }
        .dimmed {
          border-color: var(--border-color);
          background: rgba(42, 16, 80, 0.45);
          opacity: 0.38;
        }
        .answer:disabled {
          cursor: default;
        }
        @keyframes selectedPulse {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(201, 167, 235, 0.22), 0 0 12px rgba(201, 167, 235, 0.18);
          }
          50% {
            box-shadow: 0 0 0 2px rgba(201, 167, 235, 0.38), 0 0 24px rgba(201, 167, 235, 0.34);
          }
        }
      `}</style>
    </button>
  );
}
