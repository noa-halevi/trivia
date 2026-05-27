import { Howl, Howler } from 'howler';

const SOUND_MUTED_KEY = 'trivium:sound-muted';
const MUSIC_MUTED_KEY = 'trivium:music-muted';
const EFFECT_VOLUME = 0.7;
const IMPORTANT_EFFECT_VOLUME = 1.0;
const MUSIC_VOLUME = 0.3;

const SOUND_DEFINITIONS = {
  correctAnswer: { src: '/sounds/correct_answer.mp3', volume: IMPORTANT_EFFECT_VOLUME },
  wrongAnswer: { src: '/sounds/wrong_answer.mp3', volume: IMPORTANT_EFFECT_VOLUME },
  tick: { src: '/sounds/tick.mp3', volume: EFFECT_VOLUME },
  countdown: { src: '/sounds/countdown.mp3', volume: EFFECT_VOLUME },
  roundWin: { src: '/sounds/round_win.mp3', volume: EFFECT_VOLUME },
  gameOver: { src: '/sounds/game_over.mp3', volume: EFFECT_VOLUME },
  buttonClick: { src: '/sounds/button_click.mp3', volume: EFFECT_VOLUME },
  chatMessage: { src: '/sounds/chat_message.mp3', volume: EFFECT_VOLUME },
  lifelineUse: { src: '/sounds/lifeline_use.mp3', volume: EFFECT_VOLUME },
  streak: { src: '/sounds/streak.mp3', volume: EFFECT_VOLUME },
};

const MUSIC_DEFINITIONS = {
  title: { src: '/sounds/title_music.mp3' },
  gameplay: { src: '/sounds/gameplay_music.mp3' },
};

const listeners = new Set();
const effects = {};
const music = {};

let initialized = false;
let currentMusic = null;
let preferences = {
  muted: false,
  musicMuted: false,
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function readBooleanPreference(key) {
  if (!isBrowser()) {
    return false;
  }

  return window.localStorage.getItem(key) === 'true';
}

function writeBooleanPreference(key, value) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, String(value));
}

function notifyListeners() {
  listeners.forEach((listener) => listener({ ...preferences }));
}

function applyMuteState() {
  Howler.mute(preferences.muted);
  Object.values(music).forEach((track) => {
    track.mute(preferences.musicMuted || preferences.muted);
  });
}

function createHowl({ src, volume, loop = false }) {
  return new Howl({
    src: [src],
    volume,
    loop,
    preload: true,
    html5: false,
    onloaderror: () => {},
    onplayerror: () => {},
  });
}

export function initSounds() {
  if (!isBrowser() || initialized) {
    return;
  }

  preferences = {
    muted: readBooleanPreference(SOUND_MUTED_KEY),
    musicMuted: readBooleanPreference(MUSIC_MUTED_KEY),
  };

  // Debug: log current mute state on startup
  console.log('[SOUND] Preferences loaded:', preferences);
  console.log('[SOUND] sound-muted:', localStorage.getItem(SOUND_MUTED_KEY));
  console.log('[SOUND] music-muted:', localStorage.getItem(MUSIC_MUTED_KEY));

  // Reset mute state if it was accidentally saved as muted
  // (remove this after confirming sounds work)
  if (localStorage.getItem(SOUND_MUTED_KEY) === 'true') {
    console.warn('[SOUND] Sound was muted from previous session — keeping user preference');
  }

  Howler.autoUnlock = true;

  Object.entries(SOUND_DEFINITIONS).forEach(([key, definition]) => {
    effects[key] = createHowl(definition);
  });

  Object.entries(MUSIC_DEFINITIONS).forEach(([key, definition]) => {
    music[key] = createHowl({
      src: definition.src,
      volume: MUSIC_VOLUME,
      loop: true,
    });
  });

  initialized = true;
  applyMuteState();
  notifyListeners();
}

export function getSoundPreferences() {
  return { ...preferences };
}

export function subscribeToSoundPreferences(listener) {
  listeners.add(listener);
  listener({ ...preferences });

  return () => {
    listeners.delete(listener);
  };
}

export function setSoundMuted(muted) {
  initSounds();
  preferences = { ...preferences, muted };
  writeBooleanPreference(SOUND_MUTED_KEY, muted);
  applyMuteState();
  notifyListeners();
}

export function setMusicMuted(musicMuted) {
  initSounds();
  preferences = { ...preferences, musicMuted };
  writeBooleanPreference(MUSIC_MUTED_KEY, musicMuted);
  applyMuteState();
  notifyListeners();
}

export function primeAudio() {
  initSounds();

  try {
    Howler.ctx?.resume?.();
  } catch {
    // Browsers may reject audio context resumes outside a user gesture.
  }

  if (currentMusic && !music[currentMusic]?.playing()) {
    playMusic(currentMusic);
  }
}

export function playSound(name, options = {}) {
  initSounds();

  if (preferences.muted || !effects[name]) {
    return;
  }

  try {
    const sound = effects[name];
    const id = sound.play();
    const volume = options.volume ?? SOUND_DEFINITIONS[name]?.volume ?? EFFECT_VOLUME;
    const rate = options.rate ?? 1;

    sound.volume(volume, id);
    sound.rate(rate, id);
  } catch {
    // Audio is best-effort only; gameplay should never depend on playback.
  }
}

export function playUrgentTick(remainingSeconds) {
  const urgency = Math.max(0, Math.min(1, (5 - remainingSeconds) / 4));

  playSound('tick', {
    volume: 0.35 + urgency * 0.65,
    rate: 1 + urgency * 1.25,
  });
}

export function playMusic(name, options = {}) {
  initSounds();

  if (!music[name]) {
    return;
  }

  const targetVolume = options.volume ?? MUSIC_VOLUME;
  const fadeDuration = options.fadeDuration ?? 800;

  if (currentMusic && currentMusic !== name) {
    fadeOutMusic(500);
  }

  currentMusic = name;

  try {
    const track = music[name];
    track.mute(preferences.musicMuted || preferences.muted);

    if (!track.playing()) {
      track.volume(0);
      track.play();
      track.fade(0, targetVolume, fadeDuration);
    } else {
      track.fade(track.volume(), targetVolume, fadeDuration);
    }
  } catch {
    // Autoplay policies and missing assets should fail silently.
  }
}

export function fadeOutMusic(duration = 800) {
  initSounds();

  if (!currentMusic || !music[currentMusic]) {
    return;
  }

  try {
    const track = music[currentMusic];
    track.fade(track.volume(), 0, duration);
    window.setTimeout(() => {
      track.stop();
      track.volume(MUSIC_VOLUME);
    }, duration);
  } catch {
    // Missing or locked audio should never surface to players.
  }
}
