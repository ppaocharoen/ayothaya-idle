// ฉากเกมแบบ pixel วาดบน canvas ความละเอียดต่ำแล้วขยายด้วย CSS (image-rendering: pixelated)
// ภาพชั่วคราว: ท้องฟ้า เจดีย์ไกลๆ ต้นตาล พื้นดิน บ้านตามระดับที่พัก และตัวละคร
import type { GameState } from '../engine/core';
import { ageOf } from '../engine/core';

export const SCENE_W = 240, SCENE_H = 168;
const GROUND = 140;

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private sprite = new Image();
  private t = 0;
  alert = false;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = SCENE_W; canvas.height = SCENE_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.sprite.src = new URL('./art/boy.png', document.baseURI).href;
  }

  draw(g: GameState, dt: number) {
    this.t += dt;
    const c = this.ctx, L = g.life;
    // ท้องฟ้าแบ่งแถบแบบ pixel
    // วาดท้องฟ้าเต็มถึงพื้นทุกเฟรม (เดิมแถบฟ้าไม่ถึงพื้น ภาพตัวละครเฟรมก่อนเลยค้างเป็นเงาดำ)
    c.clearRect(0, 0, SCENE_W, SCENE_H);
    const sky = ['#f6e7c8', '#f3dfbb', '#efd5ad', '#e9c99c', '#e2bc8c'], band = Math.ceil(GROUND / sky.length);
    sky.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * band, SCENE_W, band); });
    c.fillStyle = '#f2c46d'; this.disc(186, 30, 11);
    // เมฆลอยช้าๆ
    const cx = (this.t * 3) % (SCENE_W + 60) - 40;
    c.fillStyle = '#fbf3e2'; c.fillRect(cx, 22, 28, 5); c.fillRect(cx + 6, 18, 14, 4);
    c.fillRect((cx + 140) % (SCENE_W + 60) - 40, 44, 22, 4);
    // เจดีย์/ปรางค์ไกลๆ
    c.fillStyle = '#cdb08a';
    this.prang(40, GROUND - 4, 46); this.prang(64, GROUND - 4, 62); this.prang(88, GROUND - 4, 40);
    this.chedi(205, GROUND - 4, 44);
    // ต้นตาล
    this.palm(150, GROUND, 52); this.palm(226, GROUND, 40);
    // บ้านตามระดับที่พัก
    this.house(L.accommodation);
    // พื้นดิน
    c.fillStyle = '#b08d5a'; c.fillRect(0, GROUND, SCENE_W, SCENE_H - GROUND);
    c.fillStyle = '#9c7a4a'; c.fillRect(0, GROUND, SCENE_W, 2);
    c.fillStyle = '#c29e6a'; for (let x = 4; x < SCENE_W; x += 17) c.fillRect(x, GROUND + 8 + (x % 3) * 4, 3, 1);
    // ตัวละคร (โตขึ้นเล็กน้อยตามอายุ) หายใจขึ้นลงเบาๆ
    if (this.sprite.complete && this.sprite.naturalWidth) {
      const age = ageOf(L), scale = Math.min(1.25, 0.85 + (age - 9) * 0.035);
      const w = Math.round(this.sprite.naturalWidth * scale), h = Math.round(this.sprite.naturalHeight * scale);
      const bob = Math.floor(this.t * 1.6) % 2;
      const x = 112, y = GROUND + 2 - h + bob;
      c.fillStyle = 'rgba(80,55,30,0.25)'; c.fillRect(x + 2, GROUND, w - 4, 2);
      c.drawImage(this.sprite, x, y, w, h);
      if (this.alert && Math.floor(this.t * 3) % 2 === 0) {
        c.fillStyle = '#8e2a1f'; c.fillRect(x + w / 2 - 3, y - 16, 6, 12);
        c.fillStyle = '#fff'; c.fillRect(x + w / 2 - 1, y - 14, 2, 6); c.fillRect(x + w / 2 - 1, y - 7, 2, 2);
      }
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
  private house(level: number) {
    const c = this.ctx, x = 24, b = GROUND;
    if (level <= 0) return;
    if (level === 1) { c.fillStyle = '#c8a46a'; c.fillRect(x + 10, b - 3, 30, 3); return; } // เสื่อ
    if (level === 2) { // เพิงพัก
      c.fillStyle = '#7a5a36'; c.fillRect(x + 8, b - 26, 2, 26); c.fillRect(x + 40, b - 26, 2, 26);
      c.fillStyle = '#a8894f'; for (let i = 0; i < 8; i++) c.fillRect(x + 4 + i, b - 30 + i, 40 - i * 2, 1);
      return;
    }
    // กระท่อม/เรือน (3+) ยกใต้ถุนสูง หลังคาจั่ว
    const w = level >= 4 ? 64 : 50, hh = level >= 4 ? 30 : 24, roof = level >= 4 ? '#8e2a1f' : '#a08048', wall = level >= 5 ? '#e9dcc4' : '#b88c58';
    c.fillStyle = '#6b4d2c'; for (let px = x; px <= x + w; px += 12) c.fillRect(px, b - 18, 2, 18);
    c.fillStyle = wall; c.fillRect(x, b - 18 - hh, w, hh);
    c.fillStyle = '#5d4126'; c.fillRect(x + w / 2 - 4, b - 18 - hh + 8, 8, hh - 8);
    c.fillStyle = roof; for (let i = 0; i < 18; i++) c.fillRect(x - 6 + i, b - 18 - hh - i, w + 12 - i * 2, 1);
    c.fillRect(x + w / 2 - 1, b - 18 - hh - 22, 2, 5);
  }
}
