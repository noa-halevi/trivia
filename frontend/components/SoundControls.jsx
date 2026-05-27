'use client';

import { useEffect, useState } from 'react';
import {
  getSoundPreferences,
  initSounds,
  setMusicMuted,
  setSoundMuted,
  subscribeToSoundPreferences,
} from '../utils/soundManager';

export default function SoundControls() {
  const [preferences, setPreferences] = useState(getSoundPreferences);

  useEffect(() => {
    initSounds();
    return subscribeToSoundPreferences(setPreferences);
  }, []);

  return (
    <div className="sound-controls" aria-label="Sound controls">
      <button
        type="button"
        aria-label={preferences.muted ? 'Unmute all sounds' : 'Mute all sounds'}
        aria-pressed={preferences.muted}
        onClick={() => setSoundMuted(!preferences.muted)}
      >
        {preferences.muted ? '🔇' : '🔊'}
      </button>
      <button
        type="button"
        aria-label={preferences.musicMuted ? 'Turn background music on' : 'Turn background music off'}
        aria-pressed={preferences.musicMuted}
        onClick={() => setMusicMuted(!preferences.musicMuted)}
      >
        {preferences.musicMuted ? '🎵🚫' : '🎵'}
      </button>
      <style jsx>{`
        .sound-controls {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 50;
          display: flex;
          gap: 8px;
          padding: 8px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-pill);
          background: rgba(19, 4, 40, 0.86);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(8px);
        }

        button {
          display: grid;
          place-items: center;
          min-width: 40px;
          height: 40px;
          border: 0;
          border-radius: 999px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 20px;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        button:hover {
          background: var(--border-color);
          transform: scale(1.08);
        }
      `}</style>
    </div>
  );
}
