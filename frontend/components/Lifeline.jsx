export default function Lifeline({
  icon,
  label,
  used = false,
  loading = false,
  disabled: disabledProp = false,
  plain = false,
  answerLocked = false,
  onClick,
}) {
  const disabled = used || loading || disabledProp;

  return (
    <button
      className={`lifeline ${loading ? 'loading' : ''} ${plain ? 'plain' : ''} ${plain && answerLocked ? 'plain-locked' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={loading ? 'phone-calling' : ''}>{icon}</span>
      <strong>{label}</strong>
      <style jsx>{`
        .lifeline {
          flex: 1;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-btn);
          background: transparent;
          color: var(--accent-purple-light);
          padding: 12px;
          font-weight: 900;
          transition: 0.16s ease;
        }
        .lifeline.loading {
          border-color: var(--accent-gold);
          color: var(--accent-gold);
        }
        .lifeline:hover:not(:disabled) {
          border-color: var(--accent-gold);
          transform: scale(1.04);
        }
        .lifeline:disabled {
          opacity: 0.22;
          cursor: not-allowed;
        }
        .lifeline.loading:disabled {
          opacity: 1;
          cursor: wait;
        }
        .lifeline.plain {
          border: 1px solid var(--border-color);
          background: transparent;
          box-shadow: none;
          color: var(--text-primary);
        }
        .lifeline.plain.plain-locked:not(:disabled) {
          color: var(--text-dim);
          opacity: 0.6;
        }
        .lifeline.plain:disabled {
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-dim);
          box-shadow: none;
        }
        .lifeline.plain:hover:not(:disabled) {
          border-color: var(--border-color);
          transform: none;
        }
        .phone-calling {
          display: inline-block;
          animation: phone-vibrate 0.6s ease-in-out infinite;
        }
        @keyframes phone-vibrate {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(-15deg); }
          30% { transform: rotate(15deg); }
          45% { transform: rotate(-10deg); }
          60% { transform: rotate(10deg); }
          75% { transform: rotate(-5deg); }
          90% { transform: rotate(5deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </button>
  );
}
