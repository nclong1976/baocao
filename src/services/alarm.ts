import { DupMatch } from './dupcheck';

export interface AlarmAction {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

export interface AlarmRequest {
  title: string;
  message: string;
  matches: DupMatch[];
  actions?: AlarmAction[];
}

type Listener = (a: AlarmRequest | null) => void;

const SIREN_MAX_MS = 12000;

let current: AlarmRequest | null = null;
const listeners = new Set<Listener>();
let ctx: AudioContext | null = null;
let sirenStop: (() => void) | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/**
 * Trình duyệt chỉ cho phát âm thanh sau khi người dùng đã chạm hoặc gõ phím.
 * Mở khoá âm thanh ở lần tương tác đầu tiên để còi kêu được khi phát hiện trùng.
 */
export function installAudioUnlock() {
  const unlock = () => {
    const c = audio();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    if (c && c.state === 'running') {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function startSiren() {
  stopSiren();
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});

  const gain = c.createGain();
  gain.gain.value = 0.0001;
  gain.connect(c.destination);
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.connect(gain);

  // Còi hú lên xuống mỗi 0,9 giây.
  const t0 = c.currentTime;
  const end = t0 + SIREN_MAX_MS / 1000;
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.05);
  for (let t = t0; t < end; t += 0.9) {
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.linearRampToValueAtTime(1320, t + 0.45);
    osc.frequency.linearRampToValueAtTime(660, t + 0.9);
  }
  gain.gain.setValueAtTime(0.25, end - 0.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.start(t0);
  osc.stop(end);

  try {
    navigator.vibrate?.([400, 200, 400, 200, 400, 200, 800]);
  } catch (e) {}

  sirenStop = () => {
    try {
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setValueAtTime(0.0001, c.currentTime);
      osc.stop();
    } catch (e) {}
    try {
      navigator.vibrate?.(0);
    } catch (e) {}
  };
}

function stopSiren() {
  if (sirenStop) sirenStop();
  sirenStop = null;
}

export function raiseAlarm(req: AlarmRequest) {
  current = req;
  startSiren();
  listeners.forEach(fn => fn(current));
}

export function dismissAlarm() {
  current = null;
  stopSiren();
  listeners.forEach(fn => fn(null));
}

export function subscribeAlarm(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
