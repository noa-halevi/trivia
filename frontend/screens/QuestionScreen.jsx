import { useCallback, useEffect, useState } from 'react';
import AnswerButton from '../components/AnswerButton';
import ChatBox from '../components/ChatBox';
import DifficultyDots from '../components/DifficultyDots';
import LeadingThisRound from '../components/LeadingThisRound';
import Lifeline from '../components/Lifeline';
import LiveScoreboard from '../components/LiveScoreboard';
import ScoreChip from '../components/ScoreChip';
import TimerBar from '../components/TimerBar';

const DEFAULT_QUESTION_TIME = 15;

function getQuestionTimeLimit(question) {
  const timeLimit = Number(question?.time_limit);
  return Number.isFinite(timeLimit) && timeLimit > 0 ? timeLimit : DEFAULT_QUESTION_TIME;
}

export default function QuestionScreen({
  question,
  scores = [],
  messages = [],
  helpsUsed = {},
  selectedAnswer,
  lockedAnswer,
  roundResult,
  playerName,
  myScore = 0,
  scorePop = false,
  visibleOptions,
  streak = 0,
  secondsLeft = DEFAULT_QUESTION_TIME,
  onAnswer,
  onConfirmAnswer,
  onHelp,
  onSendChat,
  onEmoji,
  friendLoading = false,
}) {
  const [revealPhase, setRevealPhase] = useState('playing');
  const [chatNameColors, setChatNameColors] = useState({});
  const options = roundResult ? question?.options ?? [] : visibleOptions ?? question?.options ?? ['Paris', 'Rome', 'Madrid', 'Berlin'];
  const playerResults = roundResult?.player_results ?? roundResult?.round_scores ?? [];
  const playerResult = playerResults.find((result) => (result.nickname ?? result.name) === playerName);
  const revealStarted = revealPhase === 'reveal';
  const resultDisplaySeconds = Number(roundResult?.display_seconds) || 3;
  const timerClass = secondsLeft <= 0 ? 'expired' : secondsLeft <= 3 ? 'urgent' : secondsLeft <= 7 ? 'warning' : 'normal';

  const handleRankColorsChange = useCallback((colors) => {
    setChatNameColors(colors);
  }, []);

  useEffect(() => {
    if (!roundResult) {
      setRevealPhase('playing');
      return undefined;
    }

    setRevealPhase('reveal');
    return undefined;
  }, [roundResult]);

  function answerState(option) {
    if (!roundResult || !revealStarted) {
      if (lockedAnswer === option) {
        return 'locked';
      }
      if (selectedAnswer === option) {
        return 'selected';
      }
      return 'default';
    }
    if (option === roundResult.correct_answer) {
      return 'correct';
    }
    return 'default';
  }

  function answerRevealClass(option) {
    if (!revealStarted || !roundResult) {
      return '';
    }
    return option === roundResult.correct_answer ? 'answer-correct-pop' : 'answer-wrong-blur';
  }

  function resultMessage() {
    if (!playerResult || playerResult.time_taken === null || playerResult.time_taken === undefined) {
      return {
        className: 'too-slow',
        text: '⏱️ Too slow! 0 pts',
      };
    }

    if (playerResult.was_correct ?? playerResult.correct) {
      return {
        className: 'correct-result',
        text: `✅ CORRECT! +${formatPoints(playerResult.points_earned ?? playerResult.points)} pts`,
      };
    }

    return {
      className: 'wrong-result',
      text: `❌ Wrong! The answer was ${roundResult.correct_answer}`,
    };
  }

  function formatPoints(points = 0) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(points);
  }

  const answerLocked = Boolean(lockedAnswer);
  const answerSelected = Boolean(selectedAnswer);
  const lifelinesLocked = Boolean(roundResult);

  function lifelineDisabled(type) {
    if (lifelinesLocked || helpsUsed[type]) {
      return true;
    }
    if (!answerSelected && !answerLocked) {
      return false;
    }
    if (answerSelected && !answerLocked) {
      return type === 'fifty_fifty';
    }
    return type !== 'double_score';
  }

  return (
    <main className="app-shell question-layout">
      <div className="question-grid">
        <section className={`screen-card left-column ${roundResult ? 'revealing' : 'question-enter'}`}>
          <header>
            <ScoreChip value={question?.question_number ?? 1} label="Round" />
            <div className="clock-block">
              <div className={`question-clock ${timerClass}`} aria-label={`${secondsLeft} seconds left`}>
                {secondsLeft}
              </div>
              {!roundResult && (
                <TimerBar
                  key={question?.question_id ?? question?.question_number}
                  seconds={getQuestionTimeLimit(question)}
                  secondsLeft={secondsLeft}
                  running={false}
                />
              )}
            </div>
            <ScoreChip
              value={formatPoints(myScore)}
              label="Your Score"
              pop={scorePop}
              plain
            />
          </header>
          <div className="difficulty-row">
            <DifficultyDots level={question?.difficulty ?? 5} />
            <span className="difficulty-label">Difficulty {question?.difficulty ?? 5}/10</span>
          </div>
          <p className="section-label">Question</p>
          <h1>{question?.question ?? 'Which city is known as the City of Light?'}</h1>
          <div className="lifelines">
            <Lifeline
              icon="⚡"
              label="50/50"
              used={helpsUsed.fifty_fifty}
              disabled={lifelineDisabled('fifty_fifty')}
              onClick={() => onHelp?.('fifty_fifty')}
            />
            <Lifeline
              icon="📞"
              label={friendLoading ? 'Calling...' : 'Call a Friend'}
              used={helpsUsed.call_a_friend}
              loading={friendLoading}
              disabled={lifelineDisabled('call_a_friend')}
              onClick={() => onHelp?.('call_a_friend')}
            />
            <Lifeline
              icon="✖️2"
              label="Double Score"
              used={helpsUsed.double_score}
              disabled={lifelineDisabled('double_score')}
              plain
              answerLocked={answerLocked}
              onClick={() => onHelp?.('double_score')}
            />
          </div>
          <div className="answers">
            {options.map((option, index) => (
              <AnswerButton
                key={option}
                letter={String.fromCharCode(65 + index)}
                text={option}
                state={answerState(option)}
                revealClass={answerRevealClass(option)}
                badgeText={revealStarted && option === roundResult?.correct_answer ? '✅' : undefined}
                disabled={Boolean(roundResult || lockedAnswer)}
                onClick={() => !roundResult && !lockedAnswer && onAnswer?.(option)}
              />
            ))}
          </div>
          {selectedAnswer && !lockedAnswer && !roundResult && (
            <button className="lock-button" onClick={onConfirmAnswer}>
              LOCK IN ANSWER ✅
            </button>
          )}
          {roundResult && (
            <div className="reveal-panel" role="status" aria-live="polite">
              <div className={`result-summary ${resultMessage().className}`}>
                {resultMessage().text}
              </div>
            </div>
          )}
          {scores.length > 0 && (
            <>
              <p className="section-label scores-label">Live Scores</p>
              <LiveScoreboard
                scores={scores}
                playerName={playerName}
                roundResult={roundResult}
                onRankColorsChange={handleRankColorsChange}
              />
            </>
          )}
        </section>

        <aside className="right-column">
          <LeadingThisRound
            scores={scores}
            roundResult={roundResult}
            playerName={playerName}
            streak={streak}
          />
          <ChatBox
            messages={messages}
            nameColors={chatNameColors}
            onlineCount={scores.length}
            fillHeight
            onSend={onSendChat}
            onEmoji={onEmoji}
          />
        </aside>
      </div>
      {roundResult && <div className="next-question-progress" aria-label="Next question loading" />}
      <style jsx>{`
        .question-layout {
          max-width: min(1280px, 100%);
          margin: 0 auto;
        }
        .question-grid {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(240px, 1fr);
          gap: 20px;
          align-items: stretch;
        }
        .left-column {
          width: 100%;
          margin: 0;
        }
        .right-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: calc(100vh - 64px);
        }
        header, .lifelines { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .clock-block {
          display: grid;
          gap: 8px;
          flex: 1;
          max-width: 220px;
        }
        .difficulty-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 8px 0 12px;
        }
        .difficulty-label {
          color: var(--text-dim);
          font-size: 11px;
          font-weight: 800;
        }
        .question-clock {
          min-width: 78px;
          padding: 6px 16px 8px;
          border: 2px solid currentColor;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--accent-gold);
          font-family: var(--font-display);
          font-size: 32px;
          line-height: 1;
          text-align: center;
          box-shadow: 0 0 18px rgba(255, 215, 0, 0.16);
        }
        .question-clock.warning {
          color: #FF8C00;
          box-shadow: 0 0 18px rgba(255, 140, 0, 0.22);
        }
        .question-clock.urgent {
          color: var(--wrong);
          box-shadow: 0 0 18px rgba(255, 68, 102, 0.28);
          animation: urgent-pulse 0.55s ease-in-out infinite;
        }
        .question-clock.expired {
          color: var(--wrong);
          border-color: transparent;
          background: transparent;
          box-shadow: none;
          animation: none;
        }
        h1 { font-family: var(--font-display); font-size: 32px; }
        .answers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 20px; }
        .lock-button {
          width: 100%;
          margin-top: 16px;
          border: 0;
          border-radius: var(--radius-btn);
          padding: 15px 18px;
          background: var(--accent-gold);
          color: var(--bg-deep);
          font-family: var(--font-display);
          font-size: 18px;
          letter-spacing: 0.02em;
          box-shadow: 0 12px 30px rgba(255, 215, 0, 0.24);
        }
        .reveal-panel {
          display: grid;
          gap: 12px;
          margin-top: 18px;
          text-align: center;
        }
        .result-summary {
          padding: 13px 16px;
          border-radius: var(--radius-btn);
          font-weight: 900;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
          font-size: 14px;
          animation: slideUp 0.3s ease forwards;
        }
        .correct-result {
          border: 2px solid var(--correct);
          background: rgba(0, 230, 118, 0.12);
          color: var(--correct);
        }
        .wrong-result {
          border: 2px solid var(--wrong);
          background: rgba(255, 68, 102, 0.12);
          color: var(--wrong);
        }
        .too-slow {
          border: 2px solid var(--text-dim);
          background: rgba(122, 79, 160, 0.14);
          color: var(--text-muted);
        }
        .scores-label {
          margin-top: 22px;
          margin-bottom: 8px;
        }
        .next-question-progress {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          height: 4px;
          overflow: hidden;
          z-index: 50;
          pointer-events: none;
        }
        .next-question-progress::before {
          content: '';
          display: block;
          width: 100%;
          height: 100%;
          background: var(--accent-gold);
          animation: nextQuestionDrain ${resultDisplaySeconds}s linear forwards;
        }
        .left-column { position: relative; overflow: hidden; }
        .question-enter {
          animation: questionFadeIn 0.28s ease both;
        }
        .revealing {
          animation: none;
        }
        @keyframes questionFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes nextQuestionDrain {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes urgent-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @media (max-width: 900px) {
          .question-grid {
            grid-template-columns: 1fr;
          }
          .right-column {
            min-height: 0;
          }
          h1 { font-size: 26px; }
          .answers { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
