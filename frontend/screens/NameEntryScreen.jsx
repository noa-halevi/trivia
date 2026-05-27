import Logo from '../components/Logo';
import DifficultySelector from '../components/DifficultySelector';

const avatars = ['🦊', '🐉', '🦁', '🐺', '🦅', '🐙', '🐯', '🦈', '🦄', '🐸'];

export default function NameEntryScreen({
  name,
  avatar,
  difficulty = 'adaptive',
  onNameChange,
  onAvatarChange,
  onDifficultyChange,
  onJoin,
  joinLabel = 'Join Lobby',
}) {
  const canContinue = Boolean(name?.trim());

  return (
    <main className="app-shell name-entry-shell">
      <section className="screen-card">
        <div className="entrance-logo">
          <Logo />
        </div>
        <p className="legend-label entrance-label">Choose Your Legend</p>

        <div className="field-group entrance-nickname">
          <label className="field-label" htmlFor="player-nickname">Your Nickname 🏷️</label>
          <input
            id="player-nickname"
            value={name}
            onChange={(event) => onNameChange?.(event.target.value)}
            placeholder="Enter a nickname..."
            autoComplete="nickname"
            maxLength={24}
          />
        </div>

        <div className="avatar-section entrance-avatars">
          <p className="field-label">Choose Your Avatar 🎭</p>
          <div className="avatars">
            {avatars.map((item) => (
              <button
                key={item}
                type="button"
                className={avatar === item ? 'selected' : ''}
                aria-label={`Avatar ${item}`}
                aria-pressed={avatar === item}
                onClick={() => onAvatarChange?.(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="entrance-difficulty">
          <DifficultySelector value={difficulty} onChange={onDifficultyChange} />
        </div>

        <button
          type="button"
          className={`continue-btn ${canContinue ? 'enabled' : 'disabled'}`}
          onClick={onJoin}
          disabled={!canContinue}
        >
          {joinLabel}
        </button>
      </section>
      <style jsx>{`
        .name-entry-shell {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .screen-card {
          display: grid;
          gap: 20px;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          padding: 28px 32px;
          text-align: center;
        }

        .entrance-logo {
          animation: fade-in 0.5s ease forwards;
          animation-delay: 0s;
          opacity: 0;
        }

        .entrance-label {
          animation: fade-in 0.45s ease forwards;
          animation-delay: 0.2s;
          opacity: 0;
        }

        .entrance-nickname {
          animation: slide-up 0.45s ease forwards;
          animation-delay: 0.3s;
          opacity: 0;
        }

        .entrance-avatars {
          animation: fade-in 0.5s ease forwards;
          animation-delay: 0.5s;
          opacity: 0;
        }

        .entrance-difficulty {
          animation: fade-in 0.5s ease forwards;
          animation-delay: 0.7s;
          opacity: 0;
        }

        .continue-btn {
          animation: slide-up 0.45s ease forwards;
          animation-delay: 0.9s;
          opacity: 0;
        }

        .continue-btn.enabled {
          animation:
            slide-up 0.45s ease forwards,
            shine-sweep 2.5s linear infinite,
            btn-glow 2s ease-in-out infinite;
          animation-delay: 0.9s, 1.35s, 1.35s;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shine-sweep {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        @keyframes btn-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.4); }
          50% { box-shadow: 0 0 28px rgba(255, 215, 0, 0.8), 0 0 50px rgba(255, 215, 0, 0.3); }
        }

        .legend-label {
          margin: 0;
          font-family: var(--font-display);
          font-size: 22px;
          color: var(--accent-gold);
        }

        .field-group,
        .avatar-section {
          display: grid;
          gap: 10px;
          text-align: left;
        }

        .field-label {
          margin: 0;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-dim);
        }

        input {
          width: 100%;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-btn);
          background: var(--bg-dark);
          color: #ffffff;
          padding: 14px 18px;
          text-align: center;
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 800;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
        }

        input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        input:focus {
          outline: none;
          color: #ffffff;
          border-color: var(--accent-gold);
          box-shadow: 0 0 12px rgba(255, 215, 0, 0.2);
        }

        .avatars {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .avatars button {
          display: grid;
          place-items: center;
          width: 60px;
          height: 60px;
          margin: 0 auto;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-btn);
          background: var(--bg-card);
          font-size: 28px;
          line-height: 1;
          padding: 0;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }

        .avatars button:hover:not(.selected) {
          border-color: var(--accent-purple-light);
          transform: scale(1.05);
        }

        .avatars .selected {
          border: 3px solid var(--accent-gold);
          background: rgba(255, 215, 0, 0.12);
          transform: scale(1.15);
          box-shadow: 0 0 16px rgba(255, 215, 0, 0.35);
        }

        .continue-btn {
          width: 100%;
          border: 0;
          border-radius: var(--radius-btn);
          padding: 16px;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 400;
          color: var(--bg-deep);
        }

        .continue-btn.enabled {
          cursor: pointer;
          background: linear-gradient(105deg, #ffd700 40%, #fff5a0 50%, #ffd700 60%);
          background-size: 200% auto;
        }

        .continue-btn.enabled:hover {
          transform: scale(1.02);
        }

        .continue-btn.disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: var(--accent-gold);
          animation: slide-up 0.45s ease forwards !important;
          animation-delay: 0.9s !important;
          box-shadow: none;
        }

        @media (max-width: 400px) {
          .screen-card {
            padding: 24px 20px;
          }

          .avatars {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .avatars button {
            width: 52px;
            height: 52px;
            font-size: 24px;
          }
        }
      `}</style>
    </main>
  );
}
