'use client';

import { useEffect, useRef, useState } from 'react';
import { playSound } from '../utils/soundManager';

const STEPS = [
  { key: '3', label: '3', duration: 1000, playSound: true },
  { key: '2', label: '2', duration: 1000, playSound: true },
  { key: '1', label: '1', duration: 1000, playSound: true },
  { key: 'go', label: 'GET READY! 🎮', duration: 800, isFinal: true },
];

export default function GameCountdownOverlay({ active, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setVisible(false);
      return undefined;
    }

    setStepIndex(0);
    setVisible(true);

    let cancelled = false;
    let timeoutId;

    function scheduleNext(index) {
      if (cancelled || index >= STEPS.length) {
        if (!cancelled) {
          onCompleteRef.current?.();
        }
        return;
      }

      const step = STEPS[index];
      setStepIndex(index);
      if (step.playSound) {
        playSound('countdown');
      }

      timeoutId = window.setTimeout(() => scheduleNext(index + 1), step.duration);
    }

    scheduleNext(0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active]);

  if (!active || !visible) {
    return null;
  }

  const step = STEPS[stepIndex];
  if (!step) {
    return null;
  }

  return (
    <div className={`countdown-overlay ${step.isFinal ? 'final' : ''}`} key={step.key}>
      <div className="countdown-number">{step.label}</div>
      {step.isFinal && <p className="countdown-subtitle">First question coming up...</p>}
      <style jsx>{`
        .countdown-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-content: center;
          justify-items: center;
          background: rgba(24, 6, 56, 0.92);
          animation: fade-in 0.2s ease;
        }
        .countdown-number {
          font-family: var(--font-display);
          font-size: 120px;
          color: var(--accent-gold);
          text-shadow: 3px 4px 0 #7700CC, 6px 8px 0 rgba(119, 0, 204, 0.3);
          animation: countdown-pop 0.8s ease forwards;
        }
        .final .countdown-number {
          font-size: 48px;
          color: #FFFFFF;
          text-shadow: 3px 4px 0 #7700CC, 6px 8px 0 rgba(119, 0, 204, 0.3);
        }
        .countdown-subtitle {
          margin: 16px 0 0;
          color: var(--text-dim);
          font-size: 18px;
          font-weight: 800;
          animation: fade-in 0.3s ease 0.2s both;
        }
        @keyframes countdown-pop {
          0% { transform: scale(0.3); opacity: 0; }
          40% { transform: scale(1.2); opacity: 1; }
          70% { transform: scale(0.95); }
          85% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
