// เสียงสังเคราะห์ด้วย WebAudio (ไม่มีไฟล์เสียง)
// เบราว์เซอร์ไม่ยอมให้เล่นเสียงจนกว่าผู้เล่นจะแตะหน้าจอครั้งแรก → ต้อง "ปลดล็อก" ตอนแตะครั้งแรก
// แล้วค่อยเริ่มเพลง (ก่อนนี้เพลงถูกสั่งเล่นตอนโหลดหน้า เลยเงียบบ้างดังบ้าง)
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
export const sound = { sfx: true, music: false };

function ac(): AudioContext | null {
  if (!unlocked) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
  } catch { return null; }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** เรียกตอนผู้เล่นแตะ/กดปุ่มครั้งแรก */
export function unlockAudio() {
  if (unlocked) { if (ctx?.state === 'suspended') void ctx.resume(); return; }
  unlocked = true;
  const a = ac(); if (!a) return;
  // เล่นเสียงเงียบสั้นๆ ให้ iOS ยอมเปิดช่องเสียง
  const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0);
  if (sound.music) startMusic();
}
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend(); else void ctx.resume();
});

function tone(freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'triangle', slideTo?: number) {
  const a = ac(); if (!a || !master) return;
  const t = a.currentTime + at, o = a.createOscillator(), gn = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function toneAt(t: number, freq: number, dur: number, vol: number, type: OscillatorType = 'triangle') {
  const a = ac(); if (!a || !master) return;
  tone(freq, Math.max(0, t - a.currentTime), dur, vol, type);
}

// บันไดเสียงเพนทาโทนิกแบบไทย (ประมาณ): ซอล ลา ที โด เร มี ซอล ...
const SCALE = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319];

// ---------- เสียงเอฟเฟกต์ ----------
const sfx = (fn: () => void) => () => { if (sound.sfx) fn(); };
/** เก็บเหรียญ */
export const playCoin = sfx(() => { tone(988, 0, 0.12, 0.08, 'square'); tone(1319, 0.07, 0.18, 0.06, 'square'); });
/** แตะทั่วไป */
export const playTap = sfx(() => tone(659, 0, 0.07, 0.05));
/** สลับแท็บ */
export const playTab = sfx(() => tone(1175, 0, 0.05, 0.035, 'sine'));
/** เปิดแผ่นรายละเอียด */
export const playOpen = sfx(() => { tone(523, 0, 0.08, 0.04, 'sine'); tone(784, 0.05, 0.1, 0.035, 'sine'); });
/** ซื้อของ: เหรียญกระทบกัน */
export const playBuy = sfx(() => { [1568, 1319, 2093].forEach((f, i) => tone(f, i * 0.055, 0.14, 0.055, 'square')); tone(523, 0.15, 0.25, 0.05); });
/** เลือก/สลับตัวเลือก */
export const playSelect = sfx(() => { tone(587, 0, 0.08, 0.06); tone(880, 0.06, 0.14, 0.06); });
/** เปิด/ปิดการฝึก */
export const playToggle = (on: boolean) => { if (!sound.sfx) return; on ? (tone(659, 0, 0.07, 0.05), tone(988, 0.05, 0.12, 0.05)) : (tone(784, 0, 0.07, 0.05), tone(523, 0.05, 0.12, 0.045)); };
/** ฆ้อง: เลือกอาชีพ / ตัดสินใจสำคัญ */
export const playGong = sfx(() => { tone(110, 0, 2.2, 0.16, 'sine', 104); tone(220.5, 0, 1.6, 0.06, 'sine'); tone(331, 0, 1.1, 0.03, 'sine'); tone(55, 0, 0.5, 0.08, 'sine'); });
/** ล้มเหลว */
export const playFail = sfx(() => { tone(440, 0, 0.16, 0.06, 'triangle', 392); tone(330, 0.14, 0.3, 0.06, 'triangle', 262); });
/** สำเร็จเล็กๆ */
export const playGood = sfx(() => [0, 2, 4].forEach((n, i) => tone(SCALE[n + 2], i * 0.08, 0.2, 0.06)));
/** เลื่อนยศ */
export const playFanfare = sfx(() => { [0, 2, 4, 5, 7].forEach((n, i) => tone(SCALE[n], i * 0.11, 0.35, 0.09)); tone(SCALE[7], 0.6, 0.7, 0.08); tone(110, 0.6, 1.6, 0.1, 'sine'); });
/** เหตุการณ์มาถึง */
export const playEvent = sfx(() => { tone(587, 0, 0.18, 0.06); tone(784, 0.12, 0.25, 0.05); });

// ---------- เพลงประกอบ ----------
// ตอนนี้เป็นทำนองชั่วคราวที่แต่งเองในบันไดเสียงไทย + ฉิ่งฉับ (ยังไม่ใช่สายสมร)
// รูปแบบ: [ดัชนีโน้ตใน SCALE หรือ -1 = พัก, จำนวนจังหวะ]
const MELODY: [number, number][] = [
  [4, 1], [5, 1], [6, 2], [5, 1], [4, 1], [3, 2],
  [2, 1], [3, 1], [4, 1], [2, 1], [1, 2], [-1, 2],
  [3, 1], [4, 1], [5, 1], [7, 1], [6, 2], [5, 2],
  [4, 1], [3, 1], [2, 1], [1, 1], [0, 2], [-1, 2],
  [5, 1], [6, 1], [7, 2], [8, 1], [7, 1], [6, 2],
  [5, 1], [4, 1], [5, 1], [6, 1], [4, 2], [-1, 2],
  [3, 1], [2, 1], [3, 1], [4, 1], [5, 1], [4, 1], [3, 1], [2, 1],
  [1, 1], [2, 1], [0, 2], [-1, 4],
];
const BEAT = 0.42; // วินาทีต่อจังหวะ
let schedTimer = 0, nextT = 0, mi = 0, beatCount = 0;

function ching(t: number, open: boolean) {
  if (open) { toneAt(t, 2637, 0.7, 0.018, 'sine'); toneAt(t, 3951, 0.45, 0.01, 'sine'); }
  else { toneAt(t, 2793, 0.06, 0.02, 'square'); }
}
function startMusic() {
  const a = ac(); if (!a || schedTimer) return;
  nextT = a.currentTime + 0.1; mi = 0; beatCount = 0;
  // ตั้งเวลาโน้ตล่วงหน้าเป็นช่วงๆ (แม่นกว่า setInterval ตรงๆ)
  schedTimer = window.setInterval(() => {
    const c = ac(); if (!c) return;
    while (nextT < c.currentTime + 0.5) {
      const [n, beats] = MELODY[mi];
      if (n >= 0) { toneAt(nextT, SCALE[n], beats * BEAT * 0.95, 0.045); toneAt(nextT, SCALE[n] / 2, beats * BEAT * 0.8, 0.02, 'sine'); }
      for (let b = 0; b < beats; b++) {
        const t = nextT + b * BEAT, pos = (beatCount + b) % 4;
        if (pos === 1) ching(t, true); else if (pos === 3) ching(t, false);
        if (pos === 0) toneAt(t, 98, 0.25, 0.05, 'sine'); // โทน
      }
      beatCount += beats; nextT += beats * BEAT; mi = (mi + 1) % MELODY.length;
    }
  }, 120);
}
function stopMusic() { clearInterval(schedTimer); schedTimer = 0; }

export function setMusic(on: boolean) {
  sound.music = on;
  if (on) startMusic(); else stopMusic();
}
