// ฉากหลังความตาย: บัญชีบุญบาป → พญายมไต่สวน 3 ข้อ → ชดใช้กรรม (มินิเกมแตะจังหวะ) → เกิดใหม่
// ใช้ภาพจริงเมื่อมี (bg_court/hell/river/heaven, yama, pret) ไม่งั้นวาดด้วยโค้ด
import type { GameState } from '../engine/core';
import { REALM, answerEffect, judge, rebirthYears, type Answer, type Verdict } from '../engine/afterlife';
import { esc, th, thInt } from './format';
import { icon } from './icons';
import * as S from './sound';

const W = 240, H = 168;
type Phase = 'ledger' | 'ask' | 'stage' | 'heaven' | 'done';

export function runAfterlife(g: GameState, opts: { preview?: boolean; onDone: (years: number) => void }) {
  const v: Verdict = judge(g);
  const root = document.createElement('div');
  root.className = 'yama';
  root.innerHTML = `<canvas width="${W * 2}" height="${H * 2}"></canvas><div class="ybox"></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas')!, c = cv.getContext('2d')!, box = root.querySelector<HTMLElement>('.ybox')!;
  c.imageSmoothingEnabled = false;
  c.setTransform(2, 0, 0, 2, 0, 0); // ผืนจริง 2 เท่า ภาพฉากจะคมขึ้น โค้ดวาดยังใช้พิกัด 240×168
  const img = (f: string) => { const im = new Image(); im.src = new URL(`./art/${f}`, document.baseURI).href; return im; };
  const sprite = img('boy.png');
  const art = { court: img('bg_court.png'), hell: img('bg_hell.png'), river: img('bg_river.png'), heaven: img('bg_heaven.png'), yama: img('yama.png'), pret: img('pret.png') };
  const ok = (im: HTMLImageElement) => im.complete && im.naturalWidth > 0;
  /** ภาพฉากเต็มจอ (ขยายให้เต็ม ชิดล่าง) */
  function backdrop(im: HTMLImageElement) {
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
    c.drawImage(im, (W - w) / 2, H - h, w, h);
  }
  /** วาด 1 ช่องจากภาพชุด (cols×rows) ให้สูง h ฐานอยู่ที่ (x, base) */
  function cell(im: HTMLImageElement, cols: number, rows: number, i: number, x: number, base: number, h: number) {
    const fw = im.naturalWidth / cols, fh = im.naturalHeight / rows, w = h * fw / fh;
    c.drawImage(im, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, Math.round(x - w / 2), Math.round(base - h), Math.round(w), Math.round(h));
  }

  let phase: Phase = 'ledger', q = 0, judgeYears = 0, hits = 0, misses = 0, t = 0, raf = 0;
  let zone = 0.5, zoneW = 0.24, slip = 0, last = performance.now();
  const realm = REALM[v.realm], climb = v.realm === 'hell';
  const speed = v.realm === 'hell' ? 1.6 : v.realm === 'preta' ? 1.3 : 1.0;
  const marker = () => (Math.sin(t * speed * 2.2) + 1) / 2;

  // ---------- วาดฉาก ----------
  // วิญญาณ = สไปรต์ตัวละครย้อมสีฟ้าซีด (ทำบนผืนแยก ไม่ให้สีเลอะฉาก)
  let ghost: HTMLCanvasElement | null = null;
  function makeGhost() {
    const o = document.createElement('canvas'); o.width = sprite.naturalWidth; o.height = sprite.naturalHeight;
    const x = o.getContext('2d')!; x.drawImage(sprite, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(170,220,255,.5)'; x.fillRect(0, 0, o.width, o.height);
    ghost = o;
  }
  function soul(x: number, y: number, h = 60) {
    if (!ghost) { if (sprite.complete && sprite.naturalWidth) makeGhost(); else return; }
    const w = Math.round(h * ghost!.width / ghost!.height);
    c.save(); c.globalAlpha = 0.6 + 0.12 * Math.sin(t * 3);
    c.drawImage(ghost!, Math.round(x - w / 2), Math.round(y - h + Math.sin(t * 2) * 2), w, h);
    c.restore();
  }
  function court() {
    if (ok(art.court) && ok(art.yama)) {
      backdrop(art.court);
      // พญายม: อ่านบัญชีตอนเปิดบัญชี · ชี้นิ้วตอนถาม · ฟาดไม้ตอนตัดสิน
      const f = phase === 'ledger' ? 2 : phase === 'ask' ? (Math.floor(t / 1.6) % 2 ? 1 : 0) : 3;
      cell(art.yama, 2, 2, f, 176, 140, 104);
      soul(62, 160, 46);
      return;
    }
    for (let i = 0; i < 6; i++) { c.fillStyle = ['#1a0606', '#240909', '#2e0c0b', '#3a100d', '#47140f', '#521811'][i]; c.fillRect(0, i * 22, W, 22); }
    c.fillStyle = '#2a0d08'; c.fillRect(0, 132, W, 36); c.fillStyle = '#5c1d12'; c.fillRect(0, 132, W, 2);
    for (const x of [18, 58, 182, 222]) { c.fillStyle = '#3b1209'; c.fillRect(x - 5, 20, 10, 112); c.fillStyle = '#a8792a'; c.fillRect(x - 6, 20, 12, 3); c.fillRect(x - 6, 128, 12, 4); }
    // บัลลังก์ + พญายม (ภาพชั่วคราว)
    c.fillStyle = '#a8792a'; c.fillRect(92, 56, 56, 76); c.fillStyle = '#e0b04a'; c.fillRect(96, 60, 48, 4); c.fillRect(88, 120, 64, 12);
    c.fillStyle = '#2f5a3a'; c.fillRect(106, 70, 28, 40);          // กาย
    c.fillStyle = '#3d7a4a'; c.fillRect(110, 52, 20, 20);          // หน้า
    c.fillStyle = '#e0b04a'; c.fillRect(110, 40, 20, 12); c.fillRect(116, 30, 8, 10); c.fillRect(118, 24, 4, 6); // ชฎา
    c.fillStyle = '#f6dc8a'; c.fillRect(114, 58, 4, 2); c.fillRect(122, 58, 4, 2);  // ตา
    c.fillStyle = '#c0432c'; c.fillRect(116, 66, 8, 2);
    c.fillStyle = '#fbf3e2'; c.fillRect(134, 82, 14, 18); c.fillStyle = '#7e2418'; c.fillRect(134, 82, 14, 2); // คัมภีร์บัญชี
    c.fillStyle = '#a8792a'; c.fillRect(100, 110, 8, 22); c.fillRect(132, 110, 8, 22);
    // ไฟคบ
    for (const x of [38, 202]) { c.fillStyle = '#5c3d22'; c.fillRect(x - 1, 96, 3, 36); c.fillStyle = ['#e08a3a', '#f6dc8a'][Math.floor(t * 8) % 2]; c.fillRect(x - 3, 88 + Math.round(Math.sin(t * 10)), 7, 8); }
    soul(62, 160, 46);
  }
  function hell() {
    if (ok(art.hell)) {
      backdrop(art.hell);
      const goal = realm.rounds, y = 150 - (hits / Math.max(1, goal)) * 115 + slip;
      soul(70, y, 40); // ต้นงิ้วในภาพอยู่ค่อนซ้าย
      return;
    }
    for (let i = 0; i < 6; i++) { c.fillStyle = ['#2a0505', '#3a0707', '#4d0a08', '#62100a', '#7a180c', '#93220e'][i]; c.fillRect(0, i * 25, W, 25); }
    c.fillStyle = '#c0432c'; c.fillRect(0, 150, W, 18); c.fillStyle = '#e08a3a';
    for (let x = 0; x < W; x += 9) c.fillRect(x + Math.round(Math.sin(t * 4 + x) * 2), 150 + (x % 3), 4, 2);
    // ต้นงิ้ว
    c.fillStyle = '#3b2618'; c.fillRect(110, 8, 20, 142); c.fillStyle = '#5c3d22'; c.fillRect(112, 8, 4, 142);
    c.fillStyle = '#d8d0c0';
    for (let y = 14; y < 148; y += 10) { const l = (y / 10) % 2 < 1; c.fillRect(l ? 104 : 130, y, 6, 2); c.fillRect(l ? 101 : 136, y, 3, 1); }
    const goal = realm.rounds, y = 150 - (hits / Math.max(1, goal)) * 120 + slip;
    soul(120, y, 40);
  }
  function bridge() {
    const grey = v.realm === 'preta';
    if (ok(art.river)) {
      backdrop(art.river);
      if (grey) { c.save(); c.fillStyle = 'rgba(40,52,44,.35)'; c.fillRect(0, 0, W, H); c.restore(); }
      // เปรตยืนโยกอยู่ริมฝั่ง (เฉพาะเปรตวิสัย)
      if (grey && ok(art.pret)) { c.save(); c.globalAlpha = 0.85; cell(art.pret, 2, 1, Math.floor(t / 0.9) % 2, 16, 166, 112); c.restore(); }
      const goal = realm.rounds, u = hits / Math.max(1, goal);
      const x = W * (0.17 + 0.67 * u), y = H * (0.56 + 0.1 * Math.sin(Math.PI * u) + 0.02 * u);
      soul(x, y + 4 + slip, 34);
      return;
    }
    for (let i = 0; i < 6; i++) { c.fillStyle = grey ? ['#1d2320', '#242b27', '#2c342f', '#353e38', '#3e4841', '#47524a'][i] : ['#1a2433', '#20304a', '#283c5a', '#33496a', '#3f577a', '#4b6588'][i]; c.fillRect(0, i * 22, W, 22); }
    c.fillStyle = grey ? '#2f3a33' : '#24384f'; c.fillRect(0, 118, W, 50);              // แม่น้ำเวตรณี
    c.fillStyle = grey ? '#5a6b5f' : '#5a7aa0'; for (let x = 0; x < W; x += 12) c.fillRect((x + t * 20) % W, 128 + (x % 4) * 6, 6, 1);
    c.fillStyle = '#3b2618'; c.fillRect(0, 108, 30, 60); c.fillRect(210, 108, 30, 60); // ฝั่ง
    c.fillStyle = '#8a5a34'; c.fillRect(30, 110, 180, 3); c.fillStyle = '#5c3d22';     // สะพานเชือก
    for (let x = 32; x < 210; x += 8) c.fillRect(x, 108, 4, 6);
    c.fillStyle = '#a8792a'; c.fillRect(214, 70, 18, 38); c.fillStyle = '#e0b04a'; c.fillRect(212, 66, 22, 4); // ประตูเกิด
    const goal = realm.rounds, x = 20 + (hits / Math.max(1, goal)) * 200;
    soul(x, 110 + slip, 36);
  }
  function heaven() {
    if (ok(art.heaven)) { backdrop(art.heaven); soul(120, 152, 44); return; }
    for (let i = 0; i < 6; i++) { c.fillStyle = ['#f6dc8a', '#f3d27a', '#efc66a', '#e8b85c', '#e0aa50', '#d89c46'][i]; c.fillRect(0, i * 28, W, 28); }
    c.fillStyle = '#fbf3e2';
    for (const [x, y] of [[20, 120], [70, 130], [150, 124], [200, 134]]) { c.fillRect((x + t * 6) % (W + 40) - 20, y, 40, 8); c.fillRect((x + t * 6) % (W + 40) - 12, y - 5, 24, 6); }
    c.fillStyle = '#a8792a'; c.fillRect(84, 60, 72, 50); c.fillStyle = '#7e2418'; c.fillRect(78, 48, 84, 14); c.fillRect(96, 36, 48, 14); c.fillStyle = '#e0b04a'; c.fillRect(116, 22, 8, 14);
    c.fillStyle = '#e0b04a'; for (let x = 90; x < 156; x += 12) c.fillRect(x, 62, 4, 48);
    soul(120, 150, 44);
  }
  function draw() {
    c.clearRect(0, 0, W, H); c.imageSmoothingEnabled = false;
    if (phase === 'ledger' || phase === 'ask') court();
    else if (phase === 'heaven') heaven();
    else if (phase === 'stage') climb ? hell() : bridge();
    else court();
    slip *= 0.85;
  }
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    draw();
    if (phase === 'stage') {
      const m = box.querySelector<HTMLElement>('.ymark');
      if (m) m.style.left = `${(marker() * 100).toFixed(1)}%`;
    }
    raf = requestAnimationFrame(frame);
  }

  // ---------- กล่องข้อความ ----------
  const ICON_ANS: Record<Answer, string> = { confess: 'heart', defend: 'eye', merit: 'lotus' };
  function ledger() {
    phase = 'ledger';
    box.innerHTML = `<div class="ykind">${icon('scroll', 16)}บัญชีบุญบาป</div>
      <h2>สิ้นลมหายใจ — วิญญาณมาถึงยมโลก</h2>
      <div class="yledger"><div>${icon('lotus', 28)}<small>บุญที่ทำในชาตินี้</small><b>${thInt(v.meritGained)}</b></div>
      <div>${icon('cross', 28)}<small>บาปที่ซ่อนไว้</small><b>${th(v.sin.toFixed(1))}</b></div></div>
      <p>ยมบาลอ่านบัญชีจบ พญายมชี้ไปทาง <b>${realm.name}</b> — ${esc(realm.desc)}</p>
      <button class="gbtn red" data-y="next">${icon('crown', 20)}เข้าเฝ้าพญายม</button>`;
  }
  function ask() {
    phase = 'ask';
    const qu = v.questions[q];
    box.innerHTML = `<div class="ykind">${icon('crown', 16)}ไต่สวน ข้อ ${th(q + 1)}/๓</div>
      <p class="yq">"ครั้ง<b>${esc(qu.title)}</b> เจ้าเลือก<b>${esc(qu.label)}</b> — เหตุใดจึงทำเช่นนั้น?"</p>
      <button class="choice" data-y="confess"><span class="n">${icon(ICON_ANS.confess, 18)}</span><span>สารภาพตามจริง<small>ลดโทษเล็กน้อยเสมอ</small></span></button>
      <button class="choice" data-y="defend"><span class="n">${icon(ICON_ANS.defend, 18)}</span><span>แก้ต่าง<small>ใช้ไหวพริบ ฟังขึ้นลดมาก ฟังไม่ขึ้นโทษเพิ่ม</small></span></button>
      <button class="choice" data-y="merit"><span class="n">${icon(ICON_ANS.merit, 18)}</span><span>อ้างบุญที่ทำไว้<small>ได้ผลถ้าชาตินี้ทำบุญมากพอ</small></span></button>`;
  }
  function answered(a: Answer) {
    const r = answerEffect(g, v, a); judgeYears += r.years;
    (r.ok ? S.playGood : S.playFail)();
    box.innerHTML = `<div class="ykind">${icon('crown', 16)}ไต่สวน ข้อ ${th(q + 1)}/๓</div>
      <div class="verdict ${r.ok ? 'good' : 'bad'}">${icon(r.ok ? 'check' : 'cross', 28)}${esc(r.text)}</div>
      <button class="gbtn" data-y="next">ต่อไป</button>`;
  }
  function stageIntro() {
    if (realm.rounds === 0) { phase = 'heaven'; S.playFanfare(); box.innerHTML = `<div class="ykind">${icon('star', 16)}${realm.name}</div><h2>เสวยสุขบนวิมาน</h2><p>บุญที่ทำไว้พาขึ้นสวรรค์ ไม่ต้องชดใช้กรรม</p><button class="gbtn" data-y="finish">จุติลงไปเกิด</button>`; return; }
    phase = 'stage'; newZone();
    box.innerHTML = `<div class="ykind">${icon(climb ? 'cross' : 'clock', 16)}${realm.name} · ชดใช้กรรม</div>
      <p>${climb ? 'ปีนต้นงิ้วให้ถึงยอด' : 'ข้ามสะพานเวตรณีไปประตูเกิด'} — แตะตอนเครื่องหมายอยู่ในช่องทอง</p>
      <div class="ybar"><i class="yzone"></i><i class="ymark"></i></div>
      <div class="ycount"></div>
      <button class="gbtn red ytap" data-y="tap">${climb ? 'ปีน!' : 'ก้าว!'}</button>`;
    renderZone(); renderCount();
  }
  function newZone() { zone = 0.15 + Math.random() * 0.7; zoneW = Math.max(0.12, 0.26 - hits * 0.015); }
  function renderZone() { const z = box.querySelector<HTMLElement>('.yzone'); if (z) { z.style.left = `${((zone - zoneW / 2) * 100).toFixed(1)}%`; z.style.width = `${(zoneW * 100).toFixed(1)}%`; } }
  function renderCount() { const e = box.querySelector<HTMLElement>('.ycount'); if (e) e.innerHTML = `${icon('check', 16)} ${th(hits)}/${th(realm.rounds)} &nbsp; ${icon('cross', 16)} ${th(misses)}`; }
  function tap() {
    const m = marker();
    if (Math.abs(m - zone) <= zoneW / 2) { hits++; S.playSelect(); newZone(); renderZone(); }
    else { misses++; slip = climb ? 14 : 6; S.playFail(); }
    renderCount();
    if (hits >= realm.rounds || misses >= realm.rounds + 4) setTimeout(finish, 400);
  }
  function finish() {
    phase = 'done';
    const years = rebirthYears(v, judgeYears, hits, misses);
    S.playGong();
    box.innerHTML = `<div class="ykind">${icon('lotus', 16)}เกิดใหม่</div>
      <h2>รอเกิด ${th(+years.toFixed(1))} ปี</h2>
      <p>${years <= 1 ? 'ผ่านเร็วนัก วิญญาณได้กลับไปเกิดในไม่ช้า' : years <= 4 ? 'ชดใช้กรรมพอสมควร แล้วจึงได้เกิดใหม่' : 'กรรมหนักนัก กว่าจะได้เกิดก็นานโข'}</p>
      ${opts.preview ? '<p class="muted">นี่คือตัวอย่าง — ในเกมเต็ม ยิ่งรอน้อย ชาติถัดไปยิ่งเริ่มเร็วและได้เวลาเล่นนานขึ้น</p>' : ''}
      <button class="gbtn" data-y="close">${opts.preview ? 'กลับ' : 'ลืมตาดูโลกอีกครั้ง'}</button>`;
    box.dataset.years = String(years);
  }

  root.addEventListener('click', ev => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-y]'); if (!b) return;
    const a = b.dataset.y!;
    if (a === 'tap') { tap(); return; }
    if (a === 'confess' || a === 'defend' || a === 'merit') { answered(a); return; }
    if (a === 'finish') { finish(); return; }
    if (a === 'close') { cancelAnimationFrame(raf); root.remove(); opts.onDone(+(box.dataset.years ?? 0)); return; }
    if (a === 'next') { S.playTap(); if (phase === 'ledger') { q = 0; ask(); } else if (++q < 3) ask(); else stageIntro(); }
  });
  // แตะที่ฉากก็ปีน/ก้าวได้ (มือถือถนัดกว่า)
  cv.addEventListener('pointerdown', () => { if (phase === 'stage') tap(); });

  S.playEvent();
  ledger();
  raf = requestAnimationFrame(frame);
}
