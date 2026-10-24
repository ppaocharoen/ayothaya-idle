// เสียงสังเคราะห์ด้วย WebAudio (ไม่มีไฟล์เสียง) — เสียงเอฟเฟกต์ + ทำนองระนาดเบาๆ วนเรื่อยๆ
let ctx: AudioContext | null = null;
let musicTimer = 0;
export const sound = { sfx: true, music: false };

function ac(): AudioContext | null {
  try { ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function tone(freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'triangle') {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), gn = a.createGain();
  o.type = type; o.frequency.value = freq;
  gn.gain.setValueAtTime(0.0001, a.currentTime + at);
  gn.gain.exponentialRampToValueAtTime(vol, a.currentTime + at + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(gn).connect(a.destination); o.start(a.currentTime + at); o.stop(a.currentTime + at + dur + 0.05);
}
// บันไดเสียงไทยแบบเพนทาโทนิก (ประมาณ)
const SCALE = [392, 440, 494, 587, 659, 784, 880, 988];

export function playCoin() { if (!sound.sfx) return; tone(988, 0, 0.12, 0.08, 'square'); tone(1319, 0.07, 0.18, 0.06, 'square'); }
export function playTap() { if (!sound.sfx) return; tone(659, 0, 0.08, 0.05); }
export function playFanfare() { if (!sound.sfx) return; [0, 2, 4, 5, 7].forEach((n, i) => tone(SCALE[n], i * 0.11, 0.35, 0.09)); tone(SCALE[7], 0.6, 0.7, 0.08); }
export function playEvent() { if (!sound.sfx) return; tone(587, 0, 0.18, 0.06); tone(784, 0.12, 0.25, 0.05); }

export function setMusic(on: boolean) {
  sound.music = on;
  clearInterval(musicTimer);
  if (!on) return;
  let i = 3;
  // ระนาด: โน้ตสั้นๆ เดินทีละขั้น มีพักเป็นระยะ ฟังไม่น่ารำคาญ
  musicTimer = window.setInterval(() => {
    if (Math.random() < 0.18) return;
    i = Math.max(0, Math.min(SCALE.length - 1, i + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    tone(SCALE[i] / 2, 0, 0.45, 0.035);
    if (Math.random() < 0.3) tone(SCALE[i], 0.16, 0.3, 0.02);
  }, 320);
}
