// ฉากเกมแบบ pixel วาดบน canvas ความละเอียดต่ำแล้วขยายด้วย CSS (image-rendering: pixelated)
// ภาพชั่วคราว: ท้องฟ้าเปลี่ยนตามเวลาของวัน ฝนหน้าฝน ทุ่งข้าวหน้าเก็บเกี่ยว ทัพเดินผ่านยามศึก
// บ้านตามระดับที่พัก ของให้แตะเก็บ และฉลองตอนเลื่อนยศ
import type { GameState } from '../engine/core';
import { ageOf } from '../engine/core';

export const SCENE_W = 240, SCENE_H = 168;
const GROUND = 140;
/** ความละเอียดจริงของ canvas = 4 เท่า เพื่อให้ย่อ/ขยายตัวละครทีละ 0.25 ได้โดยพิกเซลยังคม (ทุกพิกเซลภาพ = 3, 4, 5, 6 พิกเซลจอ) */
const Q = 4;
/** ปัดขนาดตัวละครเป็นขั้น 0.25 (พิกเซลคม ไม่มีเส้นหนาบางไม่เท่ากัน) */
const snap = (s: number) => Math.max(0.5, Math.round(s * Q) / Q);

export interface SceneMood { dayFrac: number; month: number; rain: boolean; war: boolean; }
export type PickupKind = 'coin' | 'flower' | 'leaf';
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
};

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private sprite = new Image();
  // ชุดท่า A1: แถวบน = เดิน 4 เฟรม · แถวล่าง = ยืน (หายใจเข้า, หายใจออก, กะพริบตา, มองผู้เล่น)
  private sheet = new Image();
  private readonly FW = 56; private readonly FH = 104;
  private posX = 112; private targetX = 112; private face = 1; private nextWalk = 6; private walkT = 0;
  private blinkAt = 3; private lookUntil = 0; private nextLook = 10;
  // ชุดท่าอื่น (2 คอลัมน์ × 3 แถว, ขนาดเฟรมอ่านจากรูป): A2 อ่าน/แบก/รำไม้ · A3 สมาธิ/ย่อง/จุดเทียน · A4 หาของป่า/กวาดวัด/หาบของ
  private actSheets: Record<string, HTMLImageElement> = {};
  private act: { id: string; until: number } | null = null;
  // frames = [คอลัมน์, แถว] · lift = ยกตัวขึ้นจากพื้นในเฟรมนั้น (ท่ากระโดด)
  static ANIMS: Record<string, { sheet: string; frames: [number, number][]; speed: number; lift?: number[] }> = {
    read: { sheet: 'a2', frames: [[0, 0], [1, 0]], speed: 0.8 }, carry: { sheet: 'a2', frames: [[0, 1], [1, 1]], speed: 0.8 }, staff: { sheet: 'a2', frames: [[0, 2], [1, 2]], speed: 0.45 },
    meditate: { sheet: 'a3', frames: [[0, 0], [1, 0]], speed: 1.4 }, sneak: { sheet: 'a3', frames: [[0, 1], [1, 1]], speed: 0.5 }, candle: { sheet: 'a3', frames: [[0, 2], [1, 2]], speed: 1.0 },
    forage: { sheet: 'a4', frames: [[0, 0], [1, 0]], speed: 0.9 }, sweep: { sheet: 'a4', frames: [[0, 1], [1, 1]], speed: 0.4 }, pole: { sheet: 'a4', frames: [[0, 2], [1, 2]], speed: 0.35 },
    happy: { sheet: 'a5', frames: [[0, 0], [1, 0]], speed: 0.35, lift: [0, 12] }, sad: { sheet: 'a5', frames: [[0, 1]], speed: 1 }, surprised: { sheet: 'a5', frames: [[1, 1]], speed: 1 },
    sleep: { sheet: 'a5', frames: [[0, 2]], speed: 1 }, rain: { sheet: 'a5', frames: [[1, 2]], speed: 1 },
  };
  /** เกมหยุดอยู่ (ตัวละครนอน) · ฝนตก (ถือใบตองบังฝน) — ตั้งจาก main */
  paused = false;
  /** สเตตัสที่ฝึก → ท่า */
  static STAT_ANIM: Record<string, string> = { 'ความรู้': 'read', 'พละกำลัง': 'carry', 'ต่อสู้': 'staff', 'บารมี': 'meditate', 'หลบหลีก': 'sneak', 'ไสยเวทย์': 'candle' };
  /** งานเด็ก → ท่า */
  static JOB_ANIM: Record<string, string> = { 'หาของป่า': 'forage', 'งานวัด': 'sweep', 'คาราวาน': 'pole' };
  hasAnim(id: string) { const a = Scene.ANIMS[id], im = a && this.actSheets[a.sheet]; return !!(im && im.complete && im.naturalWidth); }
  /** ให้ตัวละครทำท่านี้สักพัก (เช่น หลังเลือกตัวเลือกในกงกรรม) */
  showAnim(id: string, seconds = 5) {
    if (!this.hasAnim(id)) return false;
    this.act = { id, until: this.t + seconds }; this.targetX = this.posX;
    return true;
  }
  showStat(stat: string, seconds = 5) { return this.showAnim(Scene.STAT_ANIM[stat] ?? '', seconds); }
  /** ระยะ: 0 = ไกล (ยืนบนเส้นพื้น) · 1 = ใกล้จอ (ตัวใหญ่ เลื่อนลงมาข้างหน้า ส่วนที่ล้นจอตัดไป) */
  private z = 0;
  private raining = false;
  private pickDepth() { const r = Math.random(); this.z = r < 0.5 ? 0 : r < 0.8 ? 0.5 : 1; }
  private t = 0;
  private parts: Particle[] = [];
  private jump = 0;
  private flash = 0;
  pickup: { kind: PickupKind; x: number; y: number; vy: number; age: number } | null = null;
  alert = false;
  /** กรอบตัวละครล่าสุด (พิกัด canvas) สำหรับแตะคุยด้วย */
  charBox = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = SCENE_W * Q; canvas.height = SCENE_H * Q;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.sprite.src = new URL('./art/boy.png', document.baseURI).href;
    this.sheet.src = new URL('./art/boy_a1.png', document.baseURI).href;
    for (const k of ['a2', 'a3', 'a4', 'a5']) { const im = new Image(); im.src = new URL(`./art/boy_${k}.png`, document.baseURI).href; this.actSheets[k] = im; }
  }

  /** แปลงพิกัดคลิกบนหน้าจอเป็นพิกัด canvas */
  toCanvas(ev: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * SCENE_W, y: (ev.clientY - r.top) / r.height * SCENE_H };
  }
  hitPickup(x: number, y: number) { const p = this.pickup; return !!p && Math.abs(x - p.x) < 10 && Math.abs(y - p.y) < 10; }
  hitChar(x: number, y: number) { const b = this.charBox; return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y && y <= b.y + b.h; }

  celebrate() {
    this.flash = 1; if (!this.showAnim('happy', 3.2)) this.jump = 1;
    const cols = ['#f2c46d', '#8e2a1f', '#2f6b4f', '#fbf3e2', '#b8862b'];
    for (let i = 0; i < 60; i++) this.parts.push({ x: 128, y: 70, vx: (Math.random() - 0.5) * 140, vy: -40 - Math.random() * 90, life: 1.6 + Math.random(), color: cols[i % cols.length] });
  }
  spawnPickup(kind: PickupKind) { this.pickup = { kind, x: 30 + Math.random() * 180, y: -6, vy: 0, age: 0 }; }
  collectBurst(x: number, y: number) {
    for (let i = 0; i < 14; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -30 - Math.random() * 50, life: 0.8, color: '#f2c46d' });
  }

  draw(g: GameState, dt: number, mood: SceneMood) {
    this.t += dt;
    const c = this.ctx, L = g.life;
    c.setTransform(Q, 0, 0, Q, 0, 0); c.imageSmoothingEnabled = false;
    this.raining = mood.rain;
    c.clearRect(0, 0, SCENE_W, SCENE_H);
    // ---- ท้องฟ้าตามเวลาของวัน (เช้าชมพูอ่อน กลางวันครีม เย็นส้ม) และฝน ----
    const day = ['#f6e7c8', '#f3dfbb', '#efd5ad', '#e9c99c', '#e2bc8c'];
    const dawn = ['#f3d6cf', '#f1d2c0', '#efcdb0', '#ebc7a2', '#e5bd92'];
    const dusk = ['#e9b98f', '#e7ab7c', '#e19f6c', '#d7925f', '#cc8656'];
    const rain = ['#c9c7bd', '#c3c0b3', '#bcb8aa', '#b5b0a0', '#aea897'];
    const f = mood.dayFrac;
    const tDawn = f < 0.15 ? 1 - f / 0.15 : 0, tDusk = f > 0.8 ? (f - 0.8) / 0.2 : 0;
    const band = Math.ceil(GROUND / day.length);
    day.forEach((col, i) => {
      let fill = tDawn ? mix(col, dawn[i], tDawn) : tDusk ? mix(col, dusk[i], tDusk) : col;
      if (mood.rain) fill = mix(col, rain[i], 0.85);
      c.fillStyle = fill; c.fillRect(0, i * band, SCENE_W, band);
    });
    if (!mood.rain) { c.fillStyle = tDusk > 0.5 ? '#e8894a' : '#f2c46d'; this.disc(186, 30 + Math.round(tDusk * 30), 11); }
    // ---- เมฆ ----
    const cx = (this.t * 3) % (SCENE_W + 60) - 40;
    c.fillStyle = mood.rain ? '#9e9a8e' : '#fbf3e2';
    c.fillRect(cx, 22, 28, 5); c.fillRect(cx + 6, 18, 14, 4);
    c.fillRect((cx + 140) % (SCENE_W + 60) - 40, 44, 22, 4);
    if (mood.rain) { c.fillRect((cx + 70) % (SCENE_W + 60) - 40, 30, 40, 6); c.fillRect((cx + 200) % (SCENE_W + 60) - 40, 14, 34, 6); }
    // ---- เจดีย์/ปรางค์ไกลๆ ----
    c.fillStyle = mood.rain ? '#a9a08c' : '#cdb08a';
    this.prang(40, GROUND - 4, 46); this.prang(64, GROUND - 4, 62); this.prang(88, GROUND - 4, 40);
    this.chedi(205, GROUND - 4, 44);
    // ---- ทัพเดินผ่านยามศึก ----
    if (mood.war) this.army();
    this.palm(150, GROUND, 52); this.palm(226, GROUND, 40);
    this.house(L.career ? L.accommodation : 3); // เด็กยังอยู่เรือนพ่อแม่
    // ---- พื้นดิน + ทุ่งข้าวหน้าเก็บเกี่ยว (เดือนอ้าย–ยี่) ----
    c.fillStyle = '#b08d5a'; c.fillRect(0, GROUND, SCENE_W, SCENE_H - GROUND);
    c.fillStyle = '#9c7a4a'; c.fillRect(0, GROUND, SCENE_W, 2);
    c.fillStyle = '#c29e6a'; for (let x = 4; x < SCENE_W; x += 17) c.fillRect(x, GROUND + 8 + (x % 3) * 4, 3, 1);
    if (mood.month <= 1) {
      for (let x = 160; x < SCENE_W; x += 3) { const sway = Math.round(Math.sin(this.t * 2 + x) * 1); c.fillStyle = x % 2 ? '#d9b54a' : '#c9a23c'; c.fillRect(x + sway, GROUND - 7, 1, 7); c.fillRect(x + sway - 1, GROUND - 8, 2, 2); }
    }
    // ---- ตัวละคร ----
    if (this.sheet.complete && this.sheet.naturalWidth) this.drawCharacter(L, dt);
    else if (this.sprite.complete && this.sprite.naturalWidth) {
      const w = this.sprite.naturalWidth * 0.75, h = this.sprite.naturalHeight * 0.75;
      const x = 112, y = GROUND + 2 - h;
      this.charBox = { x, y, w, h };
      c.drawImage(this.sprite, x, y, w, h);
    }
    // ---- ของให้แตะเก็บ ----
    const p = this.pickup;
    if (p) {
      p.age += dt;
      if (p.y < GROUND - 4) { p.vy += 60 * dt; p.y = Math.min(GROUND - 4, p.y + p.vy * dt); p.x += Math.sin(this.t * 3) * 0.3; }
      if (p.age > 25) this.pickup = null;
      else this.drawPickup(p.kind, Math.round(p.x), Math.round(p.y), p.age);
    }
    // ---- ฝน ----
    if (mood.rain) {
      c.fillStyle = 'rgba(120,130,150,0.55)';
      for (let i = 0; i < 70; i++) { const rx = (i * 37 + this.t * 40) % SCENE_W, ry = (i * 53 + this.t * 160) % SCENE_H; c.fillRect(Math.round(rx), Math.round(ry), 1, 4); }
    }
    // ---- อนุภาค (ฉลอง/เก็บของ) ----
    this.parts = this.parts.filter(q => (q.life -= dt) > 0);
    for (const q of this.parts) { q.vy += 120 * dt; q.x += q.vx * dt; q.y += q.vy * dt; c.fillStyle = q.color; c.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }
    if (this.jump > 0) this.jump = Math.max(0, this.jump - dt / 1.2);
    if (this.flash > 0) { c.fillStyle = `rgba(242,196,109,${(this.flash * 0.45).toFixed(2)})`; c.fillRect(0, 0, SCENE_W, SCENE_H); this.flash = Math.max(0, this.flash - dt * 1.5); }
  }

  private drawPickup(kind: PickupKind, x: number, y: number, age: number) {
    const c = this.ctx, glow = Math.floor(age * 4) % 2;
    if (glow) { c.fillStyle = 'rgba(255,240,180,0.7)'; c.fillRect(x - 6, y - 6, 12, 12); }
    if (kind === 'coin') { c.fillStyle = '#b8862b'; this.disc(x, y, 4); c.fillStyle = '#f2c46d'; this.disc(x, y, 3); c.fillStyle = '#b8862b'; c.fillRect(x - 1, y - 1, 2, 2); }
    else if (kind === 'flower') { c.fillStyle = '#f7f1e0'; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) c.fillRect(x + dx - 1, y + dy - 1, 3, 3); c.fillStyle = '#e0a93a'; c.fillRect(x - 1, y - 1, 2, 2); }
    else { c.fillStyle = '#5f8a4a'; c.fillRect(x - 3, y - 1, 6, 3); c.fillRect(x - 1, y - 3, 3, 6); c.fillStyle = '#7fae5f'; c.fillRect(x - 1, y - 1, 2, 2); }
  }
  private army() {
    const c = this.ctx, base = GROUND - 3, off = (this.t * 10) % 300;
    for (let i = 0; i < 9; i++) {
      const x = Math.round(SCENE_W + 20 - off + i * 12) % 300 - 30, step = Math.floor(this.t * 4 + i) % 2;
      c.fillStyle = '#7a6448'; c.fillRect(x, base - 9, 3, 6); c.fillRect(x, base - 3 - step, 1, 3); c.fillRect(x + 2, base - 3 + step - 1, 1, 3);
      c.fillStyle = '#6b4d2c'; c.fillRect(x + 1, base - 12, 2, 3);
      c.fillStyle = '#8a7a60'; c.fillRect(x - 1, base - 16, 1, 13);
      if (i % 4 === 0) { c.fillStyle = '#8e2a1f'; c.fillRect(x - 1, base - 18, 5, 3); }
    }
  }
  private disc(x: number, y: number, r: number) {
    for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); this.ctx.fillRect(x - w, y + dy, w * 2, 1); }
  }
  private prang(x: number, base: number, h: number) {
    const c = this.ctx;
    for (let i = 0; i < h; i++) { const w = Math.max(1, Math.round((h - i) / h * 9 + (i % 7 === 0 ? 2 : 0))); c.fillRect(x - w, base - i, w * 2, 1); }
    c.fillRect(x - 1, base - h - 6, 2, 6);
  }
  private chedi(x: number, base: number, h: number) {
    const c = this.ctx;
    c.fillRect(x - 12, base - 6, 24, 6);
    for (let i = 0; i < h * 0.4; i++) { const w = Math.round(10 * Math.sqrt(1 - Math.pow(i / (h * 0.4), 2))) + 2; c.fillRect(x - w, base - 6 - i, w * 2, 1); }
    for (let i = 0; i < h * 0.5; i++) { const w = Math.max(1, Math.round(3 * (1 - i / (h * 0.5)))); c.fillRect(x - w, base - 6 - h * 0.4 - i, w * 2, 1); }
  }
  private palm(x: number, base: number, h: number) {
    const c = this.ctx;
    c.fillStyle = '#8a6a44'; c.fillRect(x, base - h, 2, h);
    c.fillStyle = '#6f8a52';
    for (const [dx, dy, w] of [[-10, 0, 10], [2, 0, 10], [-7, -3, 6], [3, -3, 6], [-3, -5, 6]]) c.fillRect(x + dx, base - h + dy, w, 2);
    c.fillRect(x - 12, base - h + 2, 3, 3); c.fillRect(x + 11, base - h + 2, 3, 3);
  }
  /** ขนาดตัวละคร: โตตามวัย × ระยะใกล้/ไกล แล้วปัดเป็นขั้น 0.25 */
  private charScale(L: GameState['life']) {
    const age = ageOf(L), base = age < 12 ? 0.75 : age < 18 ? 0.85 : 1;
    return snap(base * (1 + 0.5 * this.z));
  }
  /** ตำแหน่งเท้า: ไกล = เส้นพื้น · ใกล้ = เลื่อนลงมาหน้าจอ */
  private feetY() { return GROUND + 2 + Math.round(this.z * 22); }

  /** ตัวละครมีชีวิต: ยืนหายใจ กะพริบตา หันมามอง เดินไปมา และทำท่าตามสิ่งที่ทำอยู่ */
  private drawCharacter(L: GameState['life'], dt: number) {
    const c = this.ctx, t = this.t;
    const busy = this.alert || this.jump > 0 || this.paused;
    if (this.alert || (this.paused && this.act?.id !== 'happy')) this.act = null;
    if (this.act && t > this.act.until) this.act = null;
    if (!busy && !this.act && t > this.nextWalk && Math.abs(this.targetX - this.posX) < 1) {
      // ถึงเวลาขยับ: ทำงานเด็ก/ฝึกตามสเตตัสที่เลือก (ถ้ามีภาพ) หรือเดินไปจุดอื่น — สุ่มระยะใกล้/ไกลใหม่
      const ids = L.train.map(s => Scene.STAT_ANIM[s]).filter(id => id && this.hasAnim(id));
      if (L.path === 'merit' && this.hasAnim('meditate')) ids.push('meditate');
      const job = ageOf(L) < 12 && L.childJob ? Scene.JOB_ANIM[L.childJob] : null;
      if (job && this.hasAnim(job)) ids.push(job, job); // ช่วงเด็กทำงานเด็กบ่อยกว่า
      this.pickDepth();
      if (ids.length && Math.random() < 0.6) { this.posX = 50 + Math.random() * 140; this.showAnim(ids[Math.floor(Math.random() * ids.length)], 6 + Math.random() * 4); }
      else this.targetX = 50 + Math.random() * 140;
      this.nextWalk = t + 8 + Math.random() * 10;
    }
    const scale = this.charScale(L);
    if (this.act) { this.drawAct(this.act.id, scale); return; }
    // ท่าตามสถานการณ์ (ไม่ได้เดิน): มีเหตุการณ์ = ตกใจ · หยุดเกม = นอน · ฝนตก = ถือใบตอง
    const still = Math.abs(this.targetX - this.posX) < 1;
    const mood = this.alert ? 'surprised' : this.paused ? 'sleep' : this.raining && still ? 'rain' : null;
    if (mood === 'sleep') this.z = 0;
    if (mood && this.hasAnim(mood)) { this.drawAct(mood, mood === 'sleep' ? this.charScale(L) : scale); if (this.alert) this.drawAlert(); return; }
    const w = this.FW * scale, h = this.FH * scale;
    const dx = this.targetX - this.posX, walking = !busy && Math.abs(dx) >= 1;
    let col: number, row: number;
    if (walking) {
      this.face = dx > 0 ? 1 : -1;
      this.posX += Math.sign(dx) * Math.min(Math.abs(dx), 16 * scale * dt);
      this.walkT += dt; row = 0; col = Math.floor(this.walkT / 0.16) % 4;
    } else {
      row = 1;
      if (this.alert || t < this.lookUntil) { col = 3; this.face = 1; }
      else {
        if (t > this.nextLook) { this.lookUntil = t + 1.6; this.nextLook = t + 12 + Math.random() * 12; }
        if (t > this.blinkAt) { col = 2; if (t > this.blinkAt + 0.14) this.blinkAt = t + 2.5 + Math.random() * 3; }
        else col = Math.floor(t / 0.9) % 2;
      }
    }
    const hop = this.jump > 0 ? Math.round(Math.abs(Math.sin((1 - this.jump) * Math.PI * 3)) * 14 * this.jump) : 0;
    const x = Math.round(this.posX - w / 2), y = this.feetY() - h - hop;
    this.charBox = { x: x + w * 0.2, y, w: w * 0.6, h };
    c.fillStyle = 'rgba(80,55,30,0.25)'; c.fillRect(x + Math.round(w * 0.25), this.feetY() - 2, Math.round(w * 0.5), 2);
    c.save();
    if (this.face < 0) { c.translate(x * 2 + w, 0); c.scale(-1, 1); }
    c.drawImage(this.sheet, col * this.FW, row * this.FH, this.FW, this.FH, x, y, w, h);
    c.restore();
    this.drawAlert();
  }
  private drawAlert() {
    const c = this.ctx, b = this.charBox;
    if (!this.alert || Math.floor(this.t * 3) % 2) return;
    const ax = Math.round(b.x + b.w / 2), ay = Math.max(18, Math.round(b.y));
    c.fillStyle = '#8e2a1f'; c.fillRect(ax - 3, ay - 16, 6, 12);
    c.fillStyle = '#fff'; c.fillRect(ax - 1, ay - 14, 2, 6); c.fillRect(ax - 1, ay - 7, 2, 2);
  }

  /** ท่าอื่นๆ: วางให้หัวตรงกับตำแหน่งตัวละคร เท้าแตะพื้น */
  private drawAct(id: string, scale: number) {
    const a = Scene.ANIMS[id], im = this.actSheets[a.sheet], fw = im.naturalWidth / 2, fh = im.naturalHeight / 3;
    const c = this.ctx, w = fw * scale, h = fh * scale;
    const k = Math.floor(this.t / a.speed) % a.frames.length, [col, row] = a.frames[k];
    const x = Math.round(this.posX - w / 2), y = this.feetY() - h - Math.round((a.lift?.[k] ?? 0) * scale);
    const bw = Math.round(this.FW * scale * 0.6);
    this.charBox = { x: Math.round(this.posX - bw / 2), y, w: bw, h };
    this.face = 1;
    c.fillStyle = 'rgba(80,55,30,0.25)'; c.fillRect(Math.round(this.posX - bw / 2), this.feetY() - 2, bw, 2);
    c.drawImage(im, col * fw, row * fh, fw, fh, x, y, w, h);
  }

  private house(level: number) {
    const c = this.ctx, x = 24, b = GROUND;
    if (level <= 0) return;
    if (level === 1) { c.fillStyle = '#c8a46a'; c.fillRect(x + 10, b - 3, 30, 3); return; }
    if (level === 2) {
      c.fillStyle = '#7a5a36'; c.fillRect(x + 8, b - 26, 2, 26); c.fillRect(x + 40, b - 26, 2, 26);
      c.fillStyle = '#a8894f'; for (let i = 0; i < 8; i++) c.fillRect(x + 4 + i, b - 30 + i, 40 - i * 2, 1);
      return;
    }
    const w = level >= 4 ? 64 : 50, hh = level >= 4 ? 30 : 24, roof = level >= 4 ? '#8e2a1f' : '#a08048', wall = level >= 5 ? '#e9dcc4' : '#b88c58';
    c.fillStyle = '#6b4d2c'; for (let px = x; px <= x + w; px += 12) c.fillRect(px, b - 18, 2, 18);
    c.fillStyle = wall; c.fillRect(x, b - 18 - hh, w, hh);
    c.fillStyle = '#5d4126'; c.fillRect(x + w / 2 - 4, b - 18 - hh + 8, 8, hh - 8);
    c.fillStyle = roof; for (let i = 0; i < 18; i++) c.fillRect(x - 6 + i, b - 18 - hh - i, w + 12 - i * 2, 1);
    c.fillRect(x + w / 2 - 1, b - 18 - hh - 22, 2, 5);
  }
}
