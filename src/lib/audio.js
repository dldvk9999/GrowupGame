/**
 * 사운드 엔진 - 실제 음원 파일 없이 Web Audio API로 직접 합성(오실레이터)해서
 * 효과음/BGM을 만듦. 8비트 게임 느낌의 신스 사운드. 외부 에셋 로딩이 전혀 없어서
 * 가볍고, 브라우저 자동재생 정책 때문에 반드시 사용자의 첫 상호작용(클릭 등) 이후에만
 * 소리가 실제로 나기 시작함(AudioContext는 미리 만들어도 상관없지만 resume은 제스처 필요).
 *
 * 설정(BGM on/off, 효과음 on/off, 볼륨)은 localStorage에 저장 - 서버 관여 없음.
 */

const SETTINGS_KEY = 'growupgame-audio-settings';

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return {
      bgmEnabled: saved?.bgmEnabled ?? true,
      sfxEnabled: saved?.sfxEnabled ?? true,
      volume: saved?.volume ?? 0.5,
    };
  } catch {
    return { bgmEnabled: true, sfxEnabled: true, volume: 0.5 };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패해도 치명적이지 않음 - 이번 세션에서만 적용됨
  }
}

let settings = loadSettings();
let audioCtx = null;
let sfxGain = null;
let bgmGain = null;
let bgmTimeoutId = null;
let bgmPlaying = false;
let bgmNoteIndex = 0;

function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null; // 아주 오래된 브라우저 - 조용히 무음 처리
    audioCtx = new Ctx();
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = settings.volume;
    sfxGain.connect(audioCtx.destination);
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = settings.volume * 0.35; // BGM은 효과음보다 훨씬 은은하게
    bgmGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** 짧은 합성음 하나 재생 (내부용) */
function tone(freq, duration, type, gainNode, peak, delay = 0) {
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + delay;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(env);
  env.connect(gainNode);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function sfx(freq, duration, type = 'square', peak = 0.22, delay = 0) {
  if (!settings.sfxEnabled) return;
  getContext(); // sfxGain이 초기화된 뒤에 참조해야 함(안 그러면 첫 호출 때 sfxGain이 아직 null)
  tone(freq, duration, type, sfxGain, peak, delay);
}

// ---------- 효과음 ----------
export function playAttackSound() { sfx(220, 0.09, 'square', 0.18); }
export function playHealSound() { sfx(660, 0.15, 'sine', 0.15); sfx(880, 0.15, 'sine', 0.12, 0.06); }
export function playBuffSound() { sfx(440, 0.12, 'triangle', 0.15); sfx(660, 0.12, 'triangle', 0.13, 0.05); }
export function playClickSound() { sfx(700, 0.04, 'sine', 0.08); }
export function playErrorSound() { sfx(180, 0.15, 'sawtooth', 0.12); }
export function playGoldSound() { sfx(1046, 0.08, 'sine', 0.12); sfx(1568, 0.1, 'sine', 0.1, 0.05); }

export function playLevelUpSound() {
  [523, 659, 784, 1047].forEach((f, i) => sfx(f, 0.18, 'triangle', 0.16, i * 0.09));
}

export function playVictorySound() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => sfx(f, 0.22, 'triangle', 0.15, i * 0.1));
}

export function playGoldenMonsterSound() {
  [784, 988, 1175, 1568, 1976].forEach((f, i) => sfx(f, 0.14, 'sine', 0.14, i * 0.055));
}

export function playNewRecordSound() {
  [659, 880, 1109, 1568].forEach((f, i) => sfx(f, 0.2, 'square', 0.15, i * 0.08));
}

/** 뽑기 결과 등급별로 조금씩 다른 음색(등급이 높을수록 더 화려하게) */
export function playGachaRevealSound(rarity) {
  const table = {
    normal: [392], rare: [392, 523], epic: [392, 523, 659],
    legendary: [392, 523, 659, 784], mythic: [392, 523, 659, 784, 988],
  };
  const notes = table[rarity] ?? table.normal;
  notes.forEach((f, i) => sfx(f, 0.16, rarity === 'mythic' || rarity === 'legendary' ? 'triangle' : 'sine', 0.14, i * 0.05));
}

// ---------- BGM (오실레이터로 만든 짧은 루프 멜로디, 진짜 음원이 아닌 신스 사운드) ----------
// 5음계(펜타토닉) 기반이라 어떤 순서로 이어붙여도 크게 안 어긋나는 잔잔한 루프
const BGM_MELODY = [392, 440, 523, 587, 659, 587, 523, 440];

function scheduleBgmNote() {
  if (!bgmPlaying || !settings.bgmEnabled) { bgmPlaying = false; return; }
  const ctx = getContext();
  if (ctx) {
    const freq = BGM_MELODY[bgmNoteIndex % BGM_MELODY.length];
    tone(freq, 0.9, 'sine', bgmGain, 0.5);
    bgmNoteIndex++;
  }
  bgmTimeoutId = setTimeout(scheduleBgmNote, 950);
}

/** BGM 시작 - 반드시 사용자 상호작용(클릭 등) 안에서 호출해야 브라우저 자동재생 정책에 안 걸림 */
export function startBgm() {
  if (bgmPlaying || !settings.bgmEnabled) return;
  const ctx = getContext();
  if (!ctx) return;
  bgmPlaying = true;
  scheduleBgmNote();
}

export function stopBgm() {
  bgmPlaying = false;
  if (bgmTimeoutId) clearTimeout(bgmTimeoutId);
}

// ---------- 탭/화면 비활성화 시 BGM 일시정지 ----------
// 모바일에서 앱을 백그라운드로 보내거나 화면을 잠그면 document.hidden이 true가 됨.
// 이때는 "사용자가 설정에서 BGM을 껐다"와는 별개로 일시정지만 하고, 다시 돌아오면
// (BGM 설정이 여전히 켜져있는 경우에만) 자동으로 재개함. settings.bgmEnabled 자체는
// 건드리지 않아서, 사용자가 명시적으로 끈 경우엔 절대 임의로 다시 켜지 않음.
let wasBgmPlayingBeforeHidden = false;

export function pauseBgmForVisibility() {
  wasBgmPlayingBeforeHidden = bgmPlaying;
  if (bgmPlaying) stopBgm();
}

export function resumeBgmForVisibility() {
  if (wasBgmPlayingBeforeHidden && settings.bgmEnabled) {
    startBgm();
  }
  wasBgmPlayingBeforeHidden = false;
}

// ---------- 설정 ----------
export function getAudioSettings() {
  return { ...settings };
}

export function setBgmEnabled(enabled) {
  settings.bgmEnabled = enabled;
  saveSettings();
  if (enabled) startBgm(); else stopBgm();
}

export function setSfxEnabled(enabled) {
  settings.sfxEnabled = enabled;
  saveSettings();
}

export function setAudioVolume(volume) {
  settings.volume = volume;
  saveSettings();
  if (sfxGain) sfxGain.gain.value = volume;
  if (bgmGain) bgmGain.gain.value = volume * 0.35;
}
