'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import SoundControls from '../components/SoundControls';
import TitleScreen from '../screens/TitleScreen';
import NameEntryScreen from '../screens/NameEntryScreen';
import LobbyScreen from '../screens/LobbyScreen';
import PrivateRoomScreen from '../screens/PrivateRoomScreen';
import QuestionScreen from '../screens/QuestionScreen';
import CallFriendScreen from '../screens/CallFriendScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import GameCountdownOverlay from '../components/GameCountdownOverlay';
import {
  fadeOutMusic,
  initSounds,
  playMusic,
  playSound,
  playUrgentTick,
  primeAudio,
} from '../utils/soundManager';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8000';
const DEFAULT_QUESTION_TIME = 15;
const LOBBY_MAX_PLAYERS = 4;
const emptyHelps = {
  fifty_fifty: false,
  call_a_friend: false,
  double_score: false,
};

function getQuestionTimeLimit(question) {
  const timeLimit = Number(question?.time_limit);
  return Number.isFinite(timeLimit) && timeLimit > 0 ? timeLimit : DEFAULT_QUESTION_TIME;
}

export default function Home() {
  const [screen, setScreen] = useState('title');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦊');
  const [difficulty, setDifficulty] = useState('adaptive');
  const [socket, setSocket] = useState(null);
  const [pendingJoin, setPendingJoin] = useState({ type: 'public', code: '' });
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [lobbyJoinNotification, setLobbyJoinNotification] = useState('');
  const [lobbyEveryoneHere, setLobbyEveryoneHere] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [scorePop, setScorePop] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [privateRoomCode, setPrivateRoomCode] = useState('');
  const [privateRoomPlayers, setPrivateRoomPlayers] = useState([]);
  const [privateRoomHostSid, setPrivateRoomHostSid] = useState('');
  const [privateIsHost, setPrivateIsHost] = useState(false);
  const [privateRoomError, setPrivateRoomError] = useState('');
  const [privateJoinNotification, setPrivateJoinNotification] = useState('');
  const [privateHostPromoted, setPrivateHostPromoted] = useState(false);
  const [gameCountdownActive, setGameCountdownActive] = useState(false);
  const privateRoomPlayersRef = useRef([]);
  const [roomId, setRoomId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(DEFAULT_QUESTION_TIME);
  const [scores, setScores] = useState([]);
  const [messages, setMessages] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [lockedAnswer, setLockedAnswer] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [visibleOptions, setVisibleOptions] = useState(null);
  const [helpsUsed, setHelpsUsed] = useState(emptyHelps);
  const [friendAdvice, setFriendAdvice] = useState(null);
  const [friendLoading, setFriendLoading] = useState(false);
  const [localStats, setLocalStats] = useState({ correct: 0, averageSpeed: '--', bestStreak: 0 });
  const [streak, setStreak] = useState(0);
  const answerStartedAt = useRef(null);
  const answerSpeeds = useRef([]);
  const countdownBeepSecond = useRef(null);
  const nextChatId = useRef(0);
  const selectedAnswerRef = useRef(null);
  const lockedAnswerRef = useRef(null);
  const socketRef = useRef(null);
  const gameCountdownActiveRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const pendingQuestionRef = useRef(null);
  const previousMyScoreRef = useRef(0);
  const pendingJoinTypeRef = useRef('public');
  const lobbyEveryoneHereRef = useRef(false);

  function resetCountdownState() {
    countdownStartedRef.current = false;
    gameCountdownActiveRef.current = false;
    pendingQuestionRef.current = null;
    setGameCountdownActive(false);
  }

  function startCountdown() {
    if (countdownStartedRef.current) {
      return;
    }

    countdownStartedRef.current = true;
    gameCountdownActiveRef.current = true;
    setGameCountdownActive(true);
  }

  function markLobbyEveryoneHere() {
    if (lobbyEveryoneHereRef.current) {
      return;
    }

    lobbyEveryoneHereRef.current = true;
    setLobbyEveryoneHere(true);
    countdownBeepSecond.current = null;
  }

  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    if (!roomFromUrl) {
      return;
    }

    const normalizedCode = roomFromUrl.trim().toUpperCase();
    setInitialRoomCode(normalizedCode);
    setPendingJoin({ type: 'private-join', code: normalizedCode });
  }, []);

  useEffect(() => {
    const handleFirstInteraction = () => {
      primeAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    initSounds();

    function handleButtonClick(event) {
      const button = event.target.closest('button');

      if (!button || button.disabled) {
        return;
      }

      primeAudio();
      playSound('buttonClick');
    }

    document.addEventListener('click', handleButtonClick, true);

    return () => {
      document.removeEventListener('click', handleButtonClick, true);
    };
  }, []);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    lobbyEveryoneHereRef.current = lobbyEveryoneHere;
  }, [lobbyEveryoneHere]);

  useEffect(() => {
    if (friendAdvice) {
      console.log('friendAdvice state:', friendAdvice);
    }
  }, [friendAdvice]);

  useEffect(() => () => {
    socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (screen === 'title') {
      playMusic('title', { volume: 0.2, fadeDuration: 2000 });
      return;
    }

    if (screen === 'name') {
      playMusic('title');
      return;
    }

    if (screen === 'lobby' || screen === 'privateRoom' || screen === 'question') {
      playMusic('gameplay');
      return;
    }

    fadeOutMusic(800);
  }, [screen]);

  useEffect(() => {
    if (
      screen !== 'lobby'
      || lobbyEveryoneHere
      || secondsLeft > 5
      || secondsLeft <= 0
      || countdownBeepSecond.current === secondsLeft
    ) {
      return;
    }

    countdownBeepSecond.current = secondsLeft;
    playSound('countdown');
  }, [screen, secondsLeft, lobbyEveryoneHere]);

  useEffect(() => {
    if (
      screen !== 'lobby'
      || pendingJoinTypeRef.current !== 'public'
      || secondsLeft !== 0
    ) {
      return;
    }

    startCountdown();
  }, [screen, secondsLeft]);

  useEffect(() => {
    if (screen !== 'question' || !question || roundResult) {
      return undefined;
    }

    let lastTickSecond = null;
    const timeLimit = getQuestionTimeLimit(question);
    setQuestionSecondsLeft(Math.ceil(timeLimit));
    const interval = window.setInterval(() => {
      const elapsedSeconds = answerStartedAt.current ? (Date.now() - answerStartedAt.current) / 1000 : 0;
      const remainingSeconds = Math.max(0, Math.ceil(timeLimit - elapsedSeconds));
      setQuestionSecondsLeft((current) => (current === remainingSeconds ? current : remainingSeconds));

      if (remainingSeconds <= 0) {
        window.clearInterval(interval);
        return;
      }

      if (remainingSeconds <= 5 && remainingSeconds !== lastTickSecond) {
        lastTickSecond = remainingSeconds;
        playUrgentTick(remainingSeconds);
      }
    }, 150);

    return () => {
      window.clearInterval(interval);
    };
  }, [screen, question, roundResult]);

  useEffect(() => {
    if (screen !== 'question' || !question || roundResult) {
      return undefined;
    }

    const timeLimit = getQuestionTimeLimit(question);
    const elapsedMs = answerStartedAt.current ? Date.now() - answerStartedAt.current : 0;
    const remainingMs = Math.max(0, (timeLimit * 1000) - elapsedMs);
    const timeout = window.setTimeout(() => {
      if (lockedAnswerRef.current) {
        return;
      }

      if (selectedAnswerRef.current) {
        submitSelectedAnswer();
        return;
      }

      lockedAnswerRef.current = '__timeout__';
      setLockedAnswer('__timeout__');
    }, remainingMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [screen, question, roundResult]);

  function beginQuestion(data) {
    setScreen('question');
    setQuestion(data);
    setQuestionSecondsLeft(getQuestionTimeLimit(data));
    setSelectedAnswer(null);
    selectedAnswerRef.current = null;
    setLockedAnswer(null);
    lockedAnswerRef.current = null;
    setRoundResult(null);
    setVisibleOptions(null);
    setFriendLoading(false);
    answerStartedAt.current = Date.now();
  }

  function handleGameCountdownComplete() {
    gameCountdownActiveRef.current = false;
    setGameCountdownActive(false);

    const pendingQuestion = pendingQuestionRef.current;
    if (pendingQuestion) {
      pendingQuestionRef.current = null;
      beginQuestion(pendingQuestion);
    }
  }

  function playerCardsFromServer(players, playerName, socketId) {
    return (players ?? []).map((playerFromServer) => {
      if (typeof playerFromServer === 'string') {
        return {
          name: playerFromServer,
          avatar: playerFromServer === playerName ? avatar : '🧠',
          isYou: playerFromServer === playerName,
          isHost: false,
          isBot: false,
          isPending: false,
        };
      }

      const displayName = playerFromServer.name ?? playerFromServer.nickname ?? 'Player';

      const isBot = Boolean(playerFromServer.is_bot);

      return {
        sid: playerFromServer.sid,
        name: displayName,
        nickname: displayName,
        avatar: playerFromServer.avatar ?? (isBot ? '🤖' : avatar),
        isYou: Boolean(playerFromServer.is_you)
          || playerFromServer.sid === socketId
          || displayName === playerName
          || playerFromServer.nickname === playerName,
        isHost: Boolean(playerFromServer.is_host),
        isBot,
        isPending: Boolean(playerFromServer.is_pending),
      };
    });
  }

  function lobbyPlayerFromJoined(data) {
    const player = data.player ?? data;
    const displayName = player.nickname ?? player.name ?? data.nickname ?? data.name ?? 'Player';
    const isBot = Boolean(player.is_bot ?? data.is_bot);

    return {
      name: displayName,
      nickname: displayName,
      avatar: player.avatar ?? data.avatar ?? (isBot ? '🤖' : avatar),
      isBot,
      isYou: false,
      isPending: false,
      justJoined: true,
    };
  }

  function normalizeScorePlayers(players, playerName) {
    return (players ?? []).map((playerFromServer) => {
      if (typeof playerFromServer === 'string') {
        return {
          name: playerFromServer,
          nickname: playerFromServer,
          avatar: playerFromServer === playerName ? avatar : '🦊',
          is_bot: false,
          score: 0,
        };
      }

      const displayName = playerFromServer.nickname ?? playerFromServer.name ?? 'Player';
      return {
        name: displayName,
        nickname: displayName,
        avatar: playerFromServer.avatar ?? '🦊',
        is_bot: Boolean(playerFromServer.is_bot),
        score: Number(playerFromServer.score) || 0,
      };
    });
  }

  function connectAndJoin(joinRequest = pendingJoin) {
    const playerName = name.trim() || 'Player';
    pendingJoinTypeRef.current = joinRequest.type;
    socket?.disconnect();
    const nextSocket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    function applyPrivateRoomUpdate(data, { trackJoins = false } = {}) {
      const code = data.room_code ?? data.code ?? joinRequest.code ?? '';
      const socketId = nextSocket.id ?? '';
      console.log('=== PRIVATE ROOM UPDATE ===', { code, is_host: data.is_host, players: data.players, socketId });

      const nextPlayers = playerCardsFromServer(data.players, playerName, socketId);
      if (trackJoins) {
        const previousNames = new Set(privateRoomPlayersRef.current.map((player) => player.name));
        const joinedPlayer = nextPlayers.find(
          (player) => !previousNames.has(player.name) && !player.isYou,
        );
        if (joinedPlayer) {
          setPrivateJoinNotification(`🎉 ${joinedPlayer.name} joined the room!`);
        }
      }

      const resolvedIsHost = typeof data.is_host === 'boolean'
        ? data.is_host
        : Boolean(data.host_sid && data.host_sid === socketId);

      privateRoomPlayersRef.current = nextPlayers;
      setPrivateRoomCode(code);
      setPrivateRoomHostSid(data.host_sid ?? '');
      setPrivateIsHost(resolvedIsHost);
      setPrivateRoomPlayers(nextPlayers);
      setPrivateRoomError('');
      setScreen('privateRoom');
    }

    nextSocket.on('connect', () => {
      if (joinRequest.type === 'private-create') {
        const createPayload = { player_name: playerName, avatar, difficulty };
        nextSocket.emit('create_private_room', createPayload, (response) => {
          console.log('=== CREATE ROOM RESPONSE ===', response);
          if (response) {
            applyPrivateRoomUpdate(response);
          }
        });
        return;
      }

      if (joinRequest.type === 'private-join') {
        const joinPayload = {
          player_name: playerName,
          avatar,
          difficulty,
          code: joinRequest.code,
        };
        nextSocket.emit('join_private_room', joinPayload, (response) => {
          console.log('=== JOIN ROOM RESPONSE ===', response);
          if (response?.ok !== false && (response?.room_code || joinRequest.code)) {
            applyPrivateRoomUpdate(response);
          }
        });
        return;
      }

      nextSocket.emit('join_lobby', { player_name: playerName, avatar, difficulty });
    });

    nextSocket.on('lobby_status', (data) => {
      setScreen('lobby');
      if (!lobbyEveryoneHereRef.current) {
        setSecondsLeft(data.seconds_left ?? 30);
      }
      if (pendingJoinTypeRef.current === 'public') {
        setLobbyPlayers((prev) => {
          const fromServer = playerCardsFromServer(data.players, playerName, nextSocket.id);
          const justJoinedNames = new Set(
            prev.filter((player) => player.justJoined).map((player) => player.nickname ?? player.name),
          );
          return fromServer.map((player) => {
            const displayName = player.nickname ?? player.name;
            if (justJoinedNames.has(displayName)) {
              return { ...player, justJoined: true };
            }
            return player;
          });
        });
      }
    });

    nextSocket.on('all_players_ready', () => {
      if (pendingJoinTypeRef.current !== 'public') {
        return;
      }
      markLobbyEveryoneHere();
    });

    nextSocket.on('room_created', (data) => {
      console.log('=== ROOM CREATED EVENT ===', data);
      applyPrivateRoomUpdate(data);
    });

    nextSocket.on('room_joined', (data) => {
      console.log('=== ROOM JOINED EVENT ===', data);
      applyPrivateRoomUpdate(data);
    });

    nextSocket.on('private_room_created', (data) => {
      console.log('=== PRIVATE ROOM CREATED EVENT ===', data);
      applyPrivateRoomUpdate(data);
    });

    nextSocket.on('join_success', (data) => {
      applyPrivateRoomUpdate(data);
    });

    nextSocket.on('player_joined', (data) => {
      if (pendingJoinTypeRef.current === 'public') {
        console.log('Player joined lobby:', data);
        const newPlayer = lobbyPlayerFromJoined(data);

        setLobbyPlayers((prev) => {
          const exists = prev.find(
            (player) => (player.nickname ?? player.name) === newPlayer.nickname,
          );
          if (exists) {
            return prev;
          }
          const nextPlayers = [...prev, newPlayer];
          if (nextPlayers.length >= LOBBY_MAX_PLAYERS) {
            window.setTimeout(() => markLobbyEveryoneHere(), 0);
          }
          return nextPlayers;
        });

        setLobbyJoinNotification(`${newPlayer.avatar} ${newPlayer.nickname} joined the arena! ⚡`);
        return;
      }

      applyPrivateRoomUpdate(data, { trackJoins: true });
    });

    nextSocket.on('player_joined_room', (data) => {
      applyPrivateRoomUpdate(data);
    });

    nextSocket.on('player_joined_notification', (data) => {
      if (data?.message) {
        setPrivateJoinNotification(data.message);
      }
    });

    nextSocket.on('host_promoted', (data) => {
      setPrivateIsHost(true);
      setPrivateHostPromoted(true);
      if (data?.host_sid) {
        setPrivateRoomHostSid(data.host_sid);
      }
      if (data?.room_code) {
        setPrivateRoomCode(data.room_code);
      }
    });

    nextSocket.on('private_room_error', (data) => {
      setPrivateRoomCode(joinRequest.code ?? '');
      setPrivateRoomHostSid('');
      setPrivateIsHost(false);
      setPrivateRoomPlayers([]);
      privateRoomPlayersRef.current = [];
      setPrivateRoomError(data.message ?? 'Unable to join private room.');
      setScreen('privateRoom');
    });

    nextSocket.on('game_countdown_start', () => {
      if (pendingJoinTypeRef.current === 'public') {
        markLobbyEveryoneHere();
      }
      startCountdown();
    });

    function handleGameStart(data) {
      startCountdown();
      setRoomId(data.room_id);
      const initialScores = normalizeScorePlayers(data.players, playerName);
      setScores(initialScores);
      const myEntry = initialScores.find((entry) => entry.name === playerName);
      previousMyScoreRef.current = myEntry?.score ?? 0;
      setScorePop(false);
      setMessages([]);
      setLeaderboard([]);
      setHelpsUsed(emptyHelps);
      setPrivateRoomError('');
      setPrivateJoinNotification('');
      setPrivateHostPromoted(false);
      countdownBeepSecond.current = null;
    }

    nextSocket.on('game_starting', handleGameStart);

    nextSocket.on('game_start', handleGameStart);

    nextSocket.on('question', (data) => {
      if (gameCountdownActiveRef.current) {
        pendingQuestionRef.current = data;
        return;
      }

      beginQuestion(data);
    });

    nextSocket.on('fifty_fifty_result', (data) => {
      setVisibleOptions(data.remaining_options ?? null);
      setHelpsUsed((current) => ({ ...current, fifty_fifty: true }));
    });

    nextSocket.on('double_score_active', () => {
      setHelpsUsed((current) => ({ ...current, double_score: true }));
    });

    nextSocket.on('friend_advice', (data) => {
      console.log('=== FRIEND ADVICE RECEIVED ===', data);
      setFriendLoading(false);
      setFriendAdvice({ advice: data.advice, confidence: data.confidence });
      setHelpsUsed((current) => ({ ...current, call_a_friend: true }));
    });

    nextSocket.on('chat_message', (data) => {
      const message = {
        ...data,
        isYou: data.player_name === playerName,
        isBot: Boolean(data.is_bot) || (typeof data.player_name === 'string' && data.player_name.toLowerCase().includes('bot')),
        pending: false,
      };
      const isReplacingPendingMessage = data.client_id
        ? messages.some((currentMessage) => currentMessage.client_id === data.client_id)
        : false;

      if (!message.isYou && !isReplacingPendingMessage) {
        playSound('chatMessage');
      }

      setMessages((current) => {
        if (data.client_id) {
          const existingIndex = current.findIndex((currentMessage) => currentMessage.client_id === data.client_id);
          if (existingIndex !== -1) {
            const nextMessages = [...current];
            nextMessages[existingIndex] = message;
            return nextMessages;
          }
        }

        return [...current, message];
      });
    });

    nextSocket.on('round_result', (data) => {
      setRoundResult(data);
      setQuestionSecondsLeft(0);
      const nextScores = normalizeScorePlayers(data.scores, playerName);
      setScores(nextScores);
      const myEntry = nextScores.find((entry) => entry.name === playerName);
      const nextScore = myEntry?.score ?? 0;
      if (nextScore !== previousMyScoreRef.current) {
        previousMyScoreRef.current = nextScore;
        setScorePop(true);
        window.setTimeout(() => setScorePop(false), 500);
      }
      const playerResult = (data.player_results ?? []).find((result) => result.nickname === playerName);
      const answeredCorrectly = playerResult?.was_correct ?? (selectedAnswerRef.current && selectedAnswerRef.current === data.correct_answer);

      playSound(answeredCorrectly ? 'correctAnswer' : 'wrongAnswer');

      if (data.round_winner) {
        window.setTimeout(() => playSound('roundWin'), 1500);
      }

      if (answeredCorrectly) {
        setLocalStats((current) => ({ ...current, correct: current.correct + 1 }));
        setStreak((current) => {
          const nextStreak = current + 1;
          setLocalStats((stats) => ({ ...stats, bestStreak: Math.max(stats.bestStreak, nextStreak) }));
          if (nextStreak >= 3) {
            window.setTimeout(() => playSound('streak'), 180);
          }
          return nextStreak;
        });
      } else {
        setStreak(0);
      }
    });

    nextSocket.on('game_over', (data) => {
      setLeaderboard(data.leaderboard ?? []);
      const averageSpeed = answerSpeeds.current.length
        ? (answerSpeeds.current.reduce((sum, speed) => sum + speed, 0) / answerSpeeds.current.length).toFixed(1)
        : '--';
      setLocalStats((current) => ({ ...current, averageSpeed, roundsComplete: data.rounds_complete ?? 10 }));
      fadeOutMusic(800);
      window.setTimeout(() => playSound('gameOver'), 250);
      setScreen('leaderboard');
    });

    setSocket(nextSocket);
    if (joinRequest.type === 'public') {
      resetCountdownState();
      lobbyEveryoneHereRef.current = false;
      setLobbyEveryoneHere(false);
      setLobbyJoinNotification('');
      setLobbyPlayers([]);
      setScreen('lobby');
    } else if (joinRequest.type === 'private-create' || joinRequest.type === 'private-join') {
      setScreen('privateRoom');
      setPrivateRoomCode('');
      setPrivateRoomPlayers([]);
      privateRoomPlayersRef.current = [];
      setPrivateIsHost(false);
    }
  }

  function continueFromNameEntry() {
    connectAndJoin(pendingJoin);
  }

  function handleAnswer(answer) {
    if (!socket || !question || lockedAnswerRef.current || roundResult) {
      return;
    }
    selectedAnswerRef.current = answer;
    setSelectedAnswer(answer);
    socket.emit('select_answer', {
      question_id: question.question_id,
      answer,
    });
  }

  function getQuestionTimeRemaining() {
    if (!question || !answerStartedAt.current) {
      return 0;
    }

    const timeLimit = getQuestionTimeLimit(question);
    const elapsedSeconds = (Date.now() - answerStartedAt.current) / 1000;
    return Math.max(0, Math.min(timeLimit, timeLimit - elapsedSeconds));
  }

  function submitSelectedAnswer() {
    const answer = selectedAnswerRef.current;
    if (!socket || !question || !answer || lockedAnswerRef.current || roundResult) {
      return;
    }

    const timeRemaining = getQuestionTimeRemaining();
    lockedAnswerRef.current = answer;
    setLockedAnswer(answer);
    if (answerStartedAt.current) {
      answerSpeeds.current.push(getQuestionTimeLimit(question) - timeRemaining);
    }
    socket.emit('submit_answer', {
      question_id: question.question_id,
      answer,
      time_remaining: Number(timeRemaining.toFixed(1)),
    });
  }

  function canUseHelp(type) {
    if (!question || helpsUsed[type] || roundResult) {
      return false;
    }
    if (type === 'call_a_friend' && friendLoading) {
      return false;
    }
    if (!selectedAnswerRef.current && !lockedAnswerRef.current) {
      return true;
    }
    if (selectedAnswerRef.current && !lockedAnswerRef.current) {
      return type !== 'fifty_fifty';
    }
    return type === 'double_score';
  }

  function handleHelp(type) {
    if (!socket || !canUseHelp(type)) {
      return;
    }
    playSound('lifelineUse');
    if (type === 'call_a_friend') {
      setFriendLoading(true);
    }
    socket.emit('use_help', { type });
  }

  function sendChat(text) {
    const clean = text.trim();
    if (!socket || !clean) {
      return;
    }

    nextChatId.current += 1;
    const clientId = `${socket.id ?? 'pending'}-${Date.now()}-${nextChatId.current}`;
    const optimisticMessage = {
      client_id: clientId,
      player_name: name.trim() || 'Player',
      text: clean,
      timestamp: new Date().toISOString(),
      isYou: true,
      isBot: false,
      pending: true,
    };

    setMessages((current) => [...current, optimisticMessage]);
    socket.emit('chat_message', { text: clean, client_id: clientId });
  }

  function playAgain() {
    socket?.disconnect();
    setSocket(null);
    setPendingJoin({ type: 'public', code: '' });
    setPrivateRoomCode('');
    setPrivateRoomPlayers([]);
    privateRoomPlayersRef.current = [];
    setPrivateRoomHostSid('');
    setPrivateIsHost(false);
    setPrivateRoomError('');
    setPrivateJoinNotification('');
    setPrivateHostPromoted(false);
    setRoomId(null);
    setQuestion(null);
    setQuestionSecondsLeft(DEFAULT_QUESTION_TIME);
    setScores([]);
    setMessages([]);
    setLeaderboard([]);
    setSelectedAnswer(null);
    selectedAnswerRef.current = null;
    setLockedAnswer(null);
    lockedAnswerRef.current = null;
    setRoundResult(null);
    setVisibleOptions(null);
    setHelpsUsed(emptyHelps);
    setFriendAdvice(null);
    setFriendLoading(false);
    setStreak(0);
    setLobbyJoinNotification('');
    resetCountdownState();
    lobbyEveryoneHereRef.current = false;
    setLobbyEveryoneHere(false);
    previousMyScoreRef.current = 0;
    setScorePop(false);
    answerSpeeds.current = [];
    setLocalStats({ correct: 0, averageSpeed: '--', bestStreak: 0 });
    setScreen('name');
  }

  function choosePublicMatch() {
    setPendingJoin({ type: 'public', code: '' });
    setScreen('name');
  }

  function chooseCreatePrivateRoom() {
    setPendingJoin({ type: 'private-create', code: '' });
    setScreen('name');
  }

  function validatePrivateRoom(code) {
    return new Promise((resolve) => {
      const validationSocket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      let settled = false;

      function finish(result) {
        if (settled) {
          return;
        }

        settled = true;
        validationSocket.disconnect();
        resolve(result);
      }

      validationSocket.on('connect', () => {
        validationSocket.timeout(5000).emit('join_private_room', { code }, (error, response) => {
          if (error) {
            finish({ ok: false, message: 'Unable to check that room. Try again.' });
            return;
          }

          if (response?.ok) {
            finish({ ok: true });
            return;
          }

          finish({ ok: false, message: response?.message ?? 'Room not found! Check the code 🤔' });
        });
      });

      validationSocket.on('connect_error', () => {
        finish({ ok: false, message: 'Unable to connect to private rooms right now.' });
      });

      window.setTimeout(() => {
        finish({ ok: false, message: 'Unable to check that room. Try again.' });
      }, 6000);
    });
  }

  async function chooseJoinPrivateRoom(code) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      return { ok: false, message: 'Room not found! Check the code 🤔' };
    }

    const result = await validatePrivateRoom(normalizedCode);
    if (!result.ok) {
      return result;
    }

    setPendingJoin({ type: 'private-join', code: normalizedCode });
    setScreen('name');
    return { ok: true };
  }

  function startPrivateGame() {
    if (!socket || !privateRoomCode || !privateIsHost) {
      return;
    }

    socket.emit('start_private_game', {
      room_code: privateRoomCode,
      code: privateRoomCode,
      player_name: name.trim() || 'Player',
      avatar,
      difficulty,
    });
  }

  function backToTitleFromPrivateRoom() {
    socket?.disconnect();
    setSocket(null);
    setPrivateRoomCode('');
    setPrivateRoomPlayers([]);
    privateRoomPlayersRef.current = [];
    setPrivateRoomHostSid('');
    setPrivateIsHost(false);
    setPrivateRoomError('');
    setPrivateJoinNotification('');
    setPrivateHostPromoted(false);
    setPendingJoin({ type: 'public', code: '' });
    setScreen('title');
  }

  useEffect(() => {
    if (!privateJoinNotification) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setPrivateJoinNotification(''), 2000);
    return () => window.clearTimeout(timeout);
  }, [privateJoinNotification]);

  useEffect(() => {
    if (!lobbyJoinNotification) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setLobbyJoinNotification(''), 2000);
    return () => window.clearTimeout(timeout);
  }, [lobbyJoinNotification]);

  useEffect(() => {
    if (!lobbyPlayers.some((player) => player.justJoined)) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setLobbyPlayers((current) => current.map((player) => ({ ...player, justJoined: false })));
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [lobbyPlayers]);

  function getNameEntryLabel() {
    if (pendingJoin.type === 'private-create') {
      return 'Create Room →';
    }

    if (pendingJoin.type === 'private-join') {
      return 'Join Room →';
    }

    return 'Continue to Quick Match →';
  }

  if (screen === 'title') {
    return (
      <>
        <TitleScreen
          onStartPublic={choosePublicMatch}
          onCreatePrivate={chooseCreatePrivateRoom}
          onJoinPrivate={chooseJoinPrivateRoom}
          initialRoomCode={initialRoomCode}
        />
        <SoundControls />
      </>
    );
  }

  if (screen === 'name') {
    return (
      <>
        <NameEntryScreen
          name={name}
          avatar={avatar}
          difficulty={difficulty}
          onNameChange={setName}
          onAvatarChange={setAvatar}
          onDifficultyChange={setDifficulty}
          onJoin={continueFromNameEntry}
          joinLabel={getNameEntryLabel()}
        />
        <SoundControls />
      </>
    );
  }

  if (screen === 'lobby') {
    return (
      <>
        <GameCountdownOverlay active={gameCountdownActive} onComplete={handleGameCountdownComplete} />
        <LobbyScreen
          players={lobbyPlayers}
          secondsLeft={secondsLeft}
          joinNotification={lobbyJoinNotification}
          everyoneHere={lobbyEveryoneHere}
        />
        <SoundControls />
      </>
    );
  }

  if (screen === 'privateRoom') {
    return (
      <>
        <GameCountdownOverlay active={gameCountdownActive} onComplete={handleGameCountdownComplete} />
        <PrivateRoomScreen
          roomCode={privateRoomCode}
          players={privateRoomPlayers}
          isHost={privateIsHost}
          isLoading={!privateRoomCode && !privateRoomError}
          error={privateRoomError}
          joinNotification={privateJoinNotification}
          hostPromotedNotice={privateHostPromoted}
          onStartGame={startPrivateGame}
          onBack={backToTitleFromPrivateRoom}
        />
        <SoundControls />
      </>
    );
  }

  if (screen === 'question') {
    return (
      <>
        <GameCountdownOverlay active={gameCountdownActive} onComplete={handleGameCountdownComplete} />
        <QuestionScreen
          question={question}
          scores={scores}
          messages={messages}
          helpsUsed={helpsUsed}
          selectedAnswer={selectedAnswer}
          lockedAnswer={lockedAnswer}
          roundResult={roundResult}
          playerName={name.trim() || 'Player'}
          myScore={(scores.find((entry) => entry.name === (name.trim() || 'Player'))?.score) ?? 0}
          scorePop={scorePop}
          visibleOptions={visibleOptions}
          streak={streak}
          secondsLeft={questionSecondsLeft}
          onAnswer={handleAnswer}
          onConfirmAnswer={submitSelectedAnswer}
          onHelp={handleHelp}
          onSendChat={sendChat}
          onEmoji={(emoji) => sendChat(emoji)}
          friendLoading={friendLoading}
        />
        {friendAdvice && (
          <CallFriendScreen
            advice={friendAdvice?.advice}
            confidence={friendAdvice?.confidence}
            onClose={() => setFriendAdvice(null)}
          />
        )}
        <SoundControls />
      </>
    );
  }

  return (
    <>
      <LeaderboardScreen leaderboard={leaderboard} stats={localStats} onPlayAgain={playAgain} />
      <SoundControls />
    </>
  );
}
