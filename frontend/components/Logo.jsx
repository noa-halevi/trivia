export default function Logo() {
  return (
    <div className="logo-wrap">
      <span className="star s1">⭐</span>
      <span className="star s2">✨</span>
      <span className="star s3">🌟</span>
      <div className="logo">TRIVIUM</div>
      <div className="subtitle">🏆 Who Knows Best?</div>
      <style jsx>{`
        .logo-wrap {
          position: relative;
          display: inline-block;
          text-align: center;
        }
        .logo {
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 52px;
          -webkit-text-stroke: 3px var(--accent-gold-stroke);
          text-shadow: 3px 4px 0 #7700cc, 6px 8px 0 rgba(119, 0, 204, 0.3);
        }
        .subtitle {
          color: white;
          font-weight: 900;
          font-size: 15px;
          letter-spacing: 2px;
          animation: pglow 1.9s infinite ease-in-out;
        }
        .star {
          position: absolute;
          animation: bop 1.6s infinite ease-in-out;
        }
        .s1 { left: -22px; top: -6px; }
        .s2 { right: -20px; top: 8px; animation-delay: 0.2s; }
        .s3 { right: 12px; bottom: 16px; animation-delay: 0.4s; }
        @keyframes bop {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.2); }
        }
        @keyframes pglow {
          0%, 100% { text-shadow: 0 0 8px rgba(255,215,0,0.8), 0 0 18px rgba(255,215,0,0.5); }
          50% { text-shadow: 0 0 14px rgba(255,215,0,1), 0 0 28px rgba(255,215,0,0.8), 0 0 55px rgba(200,100,255,0.6); }
        }
      `}</style>
    </div>
  );
}
