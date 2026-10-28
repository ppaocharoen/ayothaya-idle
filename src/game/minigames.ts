// มินิเกมราชกิจ: เล่นสั้นๆ ~30 วินาที ได้คะแนน 0–1 ส่งกลับไปให้ engine ให้รางวัล
// ตอนนี้มี: บริหาร = คัดหนังสือราชการ (ยศสูงขึ้น กฎเพิ่มขึ้น)
import { esc, th } from './format';
import { icon } from './icons';
import * as S from './sound';

export type Track = 'light' | 'dark' | null;
/** done(score, สินบนที่รับ) · ทางมืดมีของเถื่อน/สินบนให้รับระหว่างเล่น */
export interface TaskGame { title: string; intro: string; tiers?: boolean; darkHint: string; run: (box: HTMLElement, tier: number, track: Track, done: (score: number, bribes: number) => void) => () => void; }

const MONTHS = ['อ้าย', 'ยี่', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ', 'สิบเอ็ด', 'สิบสอง'];
const DEPTS = [
  { name: 'กรมกลาโหม', seal: 'คชสีห์', color: '#8e2a1f' },
  { name: 'กรมมหาดไทย', seal: 'ราชสีห์', color: '#2f4a6b' },
  { name: 'กรมคลัง', seal: 'บัวแก้ว', color: '#2f6b4f' },
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** บริหาร: คัดหนังสือขอเบิก อนุมัติ/ตีกลับ ตามกฎ */
const bureau: TaskGame = {
  title: 'คัดหนังสือราชการ', tiers: true,
  intro: 'ตัดสินหนังสือให้ครบตามจำนวน ทำเสร็จก่อนก็จบก่อน — ตอบผิดเสียเวลา ๒ วินาที เวลาหมดฉบับที่เหลือนับว่าพลาด',
  darkHint: 'บางฉบับมีถุงเงินแนบมา กด "รับไว้" จะได้เงินและอนุมัติให้ทันที แม้หนังสือผิดกฎ — แต่ได้บาป และรับบ่อยเสี่ยงถูกจับ',
  run(box, tier, track, done) {
    const cur = Math.floor(Math.random() * 12), limit = 20 + 10 * Math.floor(Math.random() * 4);
    const rules = [
      'ต้องมีตราประทับ และลงชื่อผู้ส่ง',
      'ตราต้องตรงกับกรม — กลาโหม: คชสีห์ · มหาดไทย: ราชสีห์ · คลัง: บัวแก้ว',
      `ลงวันได้เฉพาะเดือน${MONTHS[cur]} หรือเดือน${MONTHS[(cur + 11) % 12]} (เดือนก่อน)`,
      `ขอเบิกได้ไม่เกิน ${th(limit)} ชั่ง`,
    ].slice(0, tier + 1);
    type Doc = { dept: typeof DEPTS[number]; seal: typeof DEPTS[number] | null; signed: boolean; month: number; amount: number; bribe: boolean };
    const valid = (d: Doc) => !!d.seal && d.signed && (tier < 1 || d.seal === d.dept) && (tier < 2 || d.month === cur || d.month === (cur + 11) % 12) && (tier < 3 || d.amount <= limit);
    const make = (): Doc => {
      // ประมาณครึ่งหนึ่งถูกต้อง ที่ผิดจะผิดแค่ข้อเดียว (ต้องดูให้ดี)
      const dept = pick(DEPTS);
      const d: Doc = { dept, seal: dept, signed: true, month: Math.random() < 0.5 ? cur : (cur + 11) % 12, amount: 5 + Math.floor(Math.random() * (limit - 4)), bribe: false };
      if (Math.random() < 0.5) {
        const bad = Math.floor(Math.random() * (tier + 1)) ;
        if (bad === 0) { if (Math.random() < 0.5) d.seal = null; else d.signed = false; }
        else if (bad === 1) d.seal = pick(DEPTS.filter(x => x !== dept));
        else if (bad === 2) d.month = (cur + 2 + Math.floor(Math.random() * 9)) % 12;
        else d.amount = limit + 5 + Math.floor(Math.random() * 30);
        // ทางมืด: หนังสือผิดกฎบางฉบับแนบถุงเงินมาขอให้ผ่าน
        if (track === 'dark' && Math.random() < 0.45) d.bribe = true;
      }
      return d;
    };
    const TIME = 45, COUNT = 8 + tier; // จำนวนหนังสือต่อรอบ (ยศสูงมากขึ้น) · เวลาเผื่อไว้
    let left = TIME, right = 0, wrong = 0, bribes = 0, doc = make(), t0 = 0, raf = 0, over = false;
    const handled = () => right + wrong + bribes;
    const docHtml = (d: Doc) => `<div class="mg-doc">
      <div class="mg-dt">หนังสือขอเบิกพระราชทรัพย์</div>
      <p>จาก <b>${esc(d.dept.name)}</b></p>
      <p>ขอเบิก <b>${th(d.amount)}</b> ชั่ง เพื่อใช้ในราชการ</p>
      <p>ลงวัน <b>เดือน${MONTHS[d.month]}</b></p>
      <p class="mg-sign">ลงชื่อ ${d.signed ? '<b class="mg-ink">ออกญา…</b>' : '<span class="muted">……………………</span>'}</p>
      ${d.bribe ? `<div class="mg-bribe">${icon('pouch', 26)}<small>ถุงเงินแนบ</small></div>` : ''}
      ${d.seal ? `<div class="mg-seal" style="--c:${d.seal.color}"><span>ตรา<br>${esc(d.seal.seal)}</span></div>` : ''}
    </div>`;
    const render = () => {
      box.innerHTML = `<div class="mg-top"><span class="mg-count">ฉบับ ${th(handled() + 1)}/${th(COUNT)}</span><span>${icon('check', 16)}${th(right)}</span><span class="mg-bar"><i style="width:${(left / TIME * 100).toFixed(1)}%"></i></span><span>${icon('cross', 16)}${th(wrong)}</span>${track === 'dark' ? `<span>${icon('pouch', 16)}${th(bribes)}</span>` : ''}</div>
        <div class="mg-rules">${rules.map(r => `<div>• ${esc(r)}</div>`).join('')}</div>
        <div class="mg-stage">${docHtml(doc)}</div>
        <div class="mg-btns"><button class="gbtn dark" data-mg="no">${icon('cross', 20)}ตีกลับ</button><button class="gbtn" data-mg="yes">${icon('check', 20)}อนุมัติ</button></div>
        ${doc.bribe ? `<div class="mg-btns"><button class="gbtn red" data-mg="bribe">${icon('pouch', 20)}รับไว้ แล้วอนุมัติ</button></div>` : ''}
        <p class="muted mg-hint">ปัดหนังสือไปซ้าย = ตีกลับ · ขวา = อนุมัติ</p>`;
    };
    const takeBribe = () => {
      if (over || !doc.bribe) return;
      bribes++; S.playTap();
      box.querySelector<HTMLElement>('.mg-doc')?.classList.add('go-r');
      next(160);
    };
    const answer = (yes: boolean) => {
      if (over) return;
      const ok = yes === valid(doc);
      if (ok) { right++; S.playTap(); } else { wrong++; left = Math.max(0, left - 2); S.playFail(); }
      const el = box.querySelector<HTMLElement>('.mg-doc');
      el?.classList.add(ok ? (yes ? 'go-r' : 'go-l') : 'shake');
      next(ok ? 160 : 260);
    };
    /** ฉบับถัดไป หรือจบเมื่อครบจำนวน (กันไม่ให้วาดทับหน้าสรุปถ้าเวลาหมดระหว่างรอ) */
    const next = (ms: number) => {
      if (handled() >= COUNT) { over = true; cancelAnimationFrame(raf); setTimeout(finish, ms); return; }
      setTimeout(() => { if (!over) { doc = make(); render(); } }, ms);
    };
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      over = true; cancelAnimationFrame(raf);
      // คะแนน = ถูก − ผิดครึ่งหนึ่ง เทียบกับฉบับที่ต้องตัดสินเอง (ฉบับที่รับสินบนไม่นับ) · ฉบับที่ไม่ทันนับเป็นพลาด
      const base = Math.max(1, COUNT - bribes);
      done(Math.max(0, Math.min(1, (right - 0.5 * wrong) / base)), bribes);
    };
    const tick = (now: number) => {
      if (over) return;
      if (!t0) t0 = now;
      const dt = (now - t0) / 1000; t0 = now; left -= dt;
      const bar = box.querySelector<HTMLElement>('.mg-bar i'); if (bar) bar.style.width = `${Math.max(0, left / TIME * 100).toFixed(1)}%`;
      if (left <= 0) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    const onClick = (ev: Event) => { const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-mg]'); if (!b) return; if (b.dataset.mg === 'bribe') takeBribe(); else answer(b.dataset.mg === 'yes'); };
    // ปัดซ้าย/ขวา
    let sx: number | null = null;
    const down = (ev: PointerEvent) => { if ((ev.target as HTMLElement).closest('.mg-doc')) sx = ev.clientX; };
    const up = (ev: PointerEvent) => { if (sx == null) return; const d = ev.clientX - sx; sx = null; if (Math.abs(d) > 40) answer(d > 0); };
    const key = (ev: KeyboardEvent) => { if (ev.key === 'ArrowRight') answer(true); else if (ev.key === 'ArrowLeft') answer(false); };
    box.addEventListener('click', onClick); box.addEventListener('pointerdown', down); box.addEventListener('pointerup', up); window.addEventListener('keydown', key);
    render(); raf = requestAnimationFrame(tick);
    return () => { over = true; cancelAnimationFrame(raf); box.removeEventListener('click', onClick); box.removeEventListener('pointerdown', down); box.removeEventListener('pointerup', up); window.removeEventListener('keydown', key); };
  },
};

// ---------- ส่วนร่วมของเกมจับเวลา ----------
/** แถบบน (เวลา + คะแนน) และวนเฟรม · คืนฟังก์ชันหยุด */
function timed(box: HTMLElement, TIME: number, onTick: (dt: number, left: number) => void, onEnd: () => void) {
  let left = TIME, t0 = 0, raf = 0, over = false;
  const tick = (now: number) => {
    if (over) return;
    const dt = t0 ? Math.min(0.1, (now - t0) / 1000) : 0; t0 = now; left -= dt;
    const bar = box.querySelector<HTMLElement>('.mg-bar i'); if (bar) bar.style.width = `${Math.max(0, left / TIME * 100).toFixed(1)}%`;
    onTick(dt, left);
    if (left <= 0) { over = true; onEnd(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => { over = true; cancelAnimationFrame(raf); }, penalty: (s: number) => { left -= s; } };
}
const topBar = (good: number, bad: number) => `<div class="mg-top"><span>${icon('check', 16)}<b class="mg-good">${th(good)}</b></span><span class="mg-bar"><i></i></span><span>${icon('cross', 16)}<b class="mg-badn">${th(bad)}</b></span></div>`;
/** ภาพพิกเซลเล็กๆ จากตัวอักษร (แต่ละตัว = สีหนึ่ง) */
function pix(rows: string[], pal: Record<string, string>, size = 9) {
  const w = rows[0].length, h = rows.length;
  let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" width="${w * size}" height="${h * size}" shape-rendering="crispEdges">${r}</svg>`;
}

// ---------- งานเด็ก: หาของป่า ----------
const MUSH = pix(['..ooo..', '.ooOoo.', 'ooooooo', '..www..', '..www..', '..www..'], { o: '#c8925a', O: '#e9c48a', w: '#f1e6cc' });
const POISON = pix(['..rrr..', '.rwrrw.', 'rrrrrwr', '..www..', '..www..', '..www..'], { r: '#c0392b', w: '#f6efe0' });
const MANGO = pix(['...g...', '..gy...', '.yyyy..', 'yyyyyy.', 'yyyyyy.', '.yyyy..'], { g: '#4f7a3a', y: '#f2b234' });
const SNAKE = pix(['.......', '.gggg..', 'g.e.gg.', '....gg.', '..ggg..', '.gg....'], { g: '#3f8a3a', e: '#111' });
const forage: TaskGame = {
  title: 'หาของป่า', darkHint: '', intro: 'ภายใน ๓๐ วินาที เก็บของป่าที่กินได้ให้มากที่สุด — แตะของมีพิษเสียเวลา ๒ วินาที',
  run(box, _tier, _track, done) {
    const N = 9, TIME = 30, TARGET = 14;
    let good = 0, bad = 0;
    const slots: { kind: 'g' | 'b' | null; until: number; el?: HTMLElement }[] = Array.from({ length: N }, () => ({ kind: null, until: 0 }));
    box.innerHTML = `${topBar(0, 0)}<div class="mg-rules"><div>แตะ <b>เห็ดฟาง</b> กับ <b>มะม่วงสุก</b> · อย่าแตะ <b>เห็ดพิษ</b> หรือ <b>งู</b> (เสียเวลา)</div></div>
      <div class="mg-grid">${slots.map((_, i) => `<button class="mg-bush" data-i="${i}"><span></span></button>`).join('')}</div>`;
    const cells = [...box.querySelectorAll<HTMLElement>('.mg-bush span')];
    let clock = 0, spawnT = 0;
    const upd = () => { box.querySelector('.mg-good')!.textContent = th(good); box.querySelector('.mg-badn')!.textContent = th(bad); };
    const t = timed(box, TIME, dt => {
      clock += dt; spawnT -= dt;
      slots.forEach((sl, i) => { if (sl.kind && clock > sl.until) { sl.kind = null; cells[i].innerHTML = ''; } });
      if (spawnT <= 0) {
        spawnT = 0.45 + Math.random() * 0.35;
        const free = slots.map((sl, i) => sl.kind ? -1 : i).filter(i => i >= 0);
        if (free.length) {
          const i = free[Math.floor(Math.random() * free.length)], isGood = Math.random() < 0.65;
          slots[i] = { kind: isGood ? 'g' : 'b', until: clock + 0.9 + Math.random() * 0.6 };
          cells[i].innerHTML = isGood ? (Math.random() < 0.5 ? MUSH : MANGO) : (Math.random() < 0.5 ? POISON : SNAKE);
        }
      }
    }, () => done(Math.max(0, Math.min(1, (good - bad) / TARGET)), 0));
    const onClick = (ev: Event) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('.mg-bush'); if (!b) return;
      const i = +b.dataset.i!, sl = slots[i]; if (!sl.kind) return;
      if (sl.kind === 'g') { good++; S.playTap(); b.classList.add('pop'); } else { bad++; t.penalty(2); S.playFail(); b.classList.add('shake'); }
      setTimeout(() => b.classList.remove('pop', 'shake'), 250);
      sl.kind = null; cells[i].innerHTML = ''; upd();
    };
    box.addEventListener('click', onClick);
    return () => { t.stop(); box.removeEventListener('click', onClick); };
  },
};

// ---------- งานเด็ก: กวาดลานวัด ----------
const sweep: TaskGame = {
  title: 'กวาดลานวัด', darkHint: '', intro: 'ภายใน ๓๐ วินาที กวาดใบไม้ออกจากลานวัดให้ได้มากที่สุด',
  run(box, _tier, _track, done) {
    const TIME = 30, TARGET = 70, W = 300, H = 200;
    let swept = 0;
    box.innerHTML = `${topBar(0, 0)}<div class="mg-rules"><div>ลากนิ้วกวาดใบไม้ออกจากลานวัด · ลมจะพัดใบไม้มาเพิ่มเรื่อยๆ</div></div>
      <canvas class="mg-cv" width="${W * 2}" height="${H * 2}"></canvas>`;
    const cv = box.querySelector('canvas')!, c = cv.getContext('2d')!; c.scale(2, 2);
    type Leaf = { x: number; y: number; vx: number; vy: number; r: number; col: string; gone: boolean };
    const leaves: Leaf[] = [];
    const add = (n: number) => { for (let i = 0; i < n; i++) leaves.push({ x: 10 + Math.random() * (W - 20), y: 20 + Math.random() * (H - 30), vx: 0, vy: 0, r: Math.random() * 6, col: pick(['#b8862b', '#8a5a2a', '#c96a2a', '#6f8a3a']), gone: false }); };
    add(25);
    let windT = 2.5, broom: { x: number; y: number } | null = null, last: { x: number; y: number } | null = null;
    const pos = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H }; };
    const down = (ev: PointerEvent) => { broom = last = pos(ev); cv.setPointerCapture(ev.pointerId); };
    const move = (ev: PointerEvent) => {
      if (!broom) return; const p = pos(ev), dx = p.x - last!.x, dy = p.y - last!.y; last = p; broom = p;
      for (const l of leaves) if (!l.gone && Math.hypot(l.x - p.x, l.y - p.y) < 22) { l.vx += dx * 0.9; l.vy += dy * 0.9; }
    };
    const up = () => { broom = null; };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const draw = () => {
      c.fillStyle = '#d9c8a4'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#cbb890'; for (let x = 0; x < W; x += 30) for (let y = (x / 30) % 2 * 15; y < H; y += 30) c.fillRect(x, y, 29, 14); // แผ่นอิฐลาน
      c.fillStyle = '#8a6a3a'; c.fillRect(0, 0, W, 6); c.fillRect(0, H - 6, W, 6); c.fillRect(0, 0, 6, H); c.fillRect(W - 6, 0, 6, H); // ขอบลาน
      for (const l of leaves) if (!l.gone) { c.fillStyle = l.col; c.fillRect(Math.round(l.x) - 5, Math.round(l.y) - 3, 10, 6); c.fillRect(Math.round(l.x) - 2, Math.round(l.y) - 5, 4, 10); }
      if (broom) { c.strokeStyle = 'rgba(120,80,30,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(broom.x, broom.y, 20, 0, Math.PI * 2); c.stroke(); }
    };
    const t = timed(box, TIME, dt => {
      windT -= dt; if (windT <= 0) { windT = 2 + Math.random() * 1.5; add(4 + Math.floor(Math.random() * 4)); }
      for (const l of leaves) {
        if (l.gone) continue;
        l.x += l.vx * dt * 10; l.y += l.vy * dt * 10; l.vx *= 0.88; l.vy *= 0.88;
        if (l.x < 4 || l.x > W - 4 || l.y < 4 || l.y > H - 4) { l.gone = true; swept++; box.querySelector('.mg-good')!.textContent = th(swept); }
      }
      draw();
    }, () => done(Math.max(0, Math.min(1, swept / TARGET)), 0));
    draw();
    return () => { t.stop(); cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); };
  },
};

// ---------- งานเด็ก: หาบของคาราวาน ----------
const caravan: TaskGame = {
  title: 'หาบของเดินทาง', darkHint: '', intro: 'ภายใน ๓๐ วินาที หาบของเดินให้ได้ไกลที่สุดโดยไม่ให้ของหล่น',
  run(box, _tier, _track, done) {
    const TIME = 30, TARGET = 100, W = 300, H = 170, MAX = 0.9;
    let ang = 0, vel = 0, dist = 0, drops = 0, pushL = false, pushR = false, stun = 0;
    box.innerHTML = `${topBar(0, 0)}<div class="mg-rules"><div>รักษาสมดุลคานหาบ — กดค้างฝั่งซ้าย/ขวาเพื่อเอียงกลับ · ตรงยิ่งเดินเร็ว · ของหล่นเสียเวลา</div></div>
      <canvas class="mg-cv" width="${W * 2}" height="${H * 2}"></canvas>
      <div class="mg-btns"><button class="gbtn dark" data-side="l">‹ ซ้าย</button><button class="gbtn dark" data-side="r">ขวา ›</button></div>`;
    const cv = box.querySelector('canvas')!, c = cv.getContext('2d')!; c.scale(2, 2);
    const set = (side: string | undefined, v: boolean) => { if (side === 'l') pushL = v; if (side === 'r') pushR = v; };
    const down = (ev: PointerEvent) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-side]');
      if (b) { set(b.dataset.side, true); return; }
      if (ev.target === cv) { const r = cv.getBoundingClientRect(); set(ev.clientX - r.left < r.width / 2 ? 'l' : 'r', true); }
    };
    const up = () => { pushL = pushR = false; };
    const key = (ev: KeyboardEvent) => { const v = ev.type === 'keydown'; if (ev.key === 'ArrowLeft') pushL = v; if (ev.key === 'ArrowRight') pushR = v; };
    box.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); window.addEventListener('keydown', key); window.addEventListener('keyup', key);
    let scroll = 0;
    const draw = () => {
      c.fillStyle = '#e9d6ae'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#b8a37a'; c.fillRect(0, H - 30, W, 30);
      c.fillStyle = '#9c8a62'; for (let x = -((scroll * 2) % 24); x < W; x += 24) c.fillRect(x, H - 22, 12, 2); // ทาง
      c.fillStyle = '#7a9a5a'; for (let x = -((scroll) % 60); x < W; x += 60) { c.fillRect(x + 10, H - 60, 4, 30); c.fillRect(x + 2, H - 70, 20, 12); } // ต้นไม้ไกล
      const cx = W / 2, cy = H - 70;
      // คน
      c.fillStyle = '#7a4a2a'; c.fillRect(cx - 5, cy, 10, 26); c.fillStyle = '#2f3a6a'; c.fillRect(cx - 6, cy + 16, 12, 14);
      c.fillStyle = '#5a3a20'; c.fillRect(cx - 5, cy - 10, 10, 10);
      // คานหาบ
      c.save(); c.translate(cx, cy + 2); c.rotate(ang);
      c.fillStyle = '#8a5a2a'; c.fillRect(-70, -2, 140, 4);
      for (const sx of [-62, 62]) { c.strokeStyle = '#5a3a20'; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx - 8, 18); c.moveTo(sx, 0); c.lineTo(sx + 8, 18); c.stroke(); c.fillStyle = '#c9a26a'; c.fillRect(sx - 12, 18, 24, 14); c.fillStyle = '#a07a40'; c.fillRect(sx - 12, 18, 24, 3); }
      c.restore();
      // เกจ
      const g = ang / MAX; c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(W / 2 - 60, 8, 120, 6);
      c.fillStyle = Math.abs(g) < 0.35 ? '#5a9a4a' : Math.abs(g) < 0.7 ? '#d9a23a' : '#c0432c'; c.fillRect(W / 2 - 1 + g * 60, 5, 3, 12);
      if (stun > 0) { c.fillStyle = 'rgba(192,67,44,.25)'; c.fillRect(0, 0, W, H); }
    };
    const t = timed(box, TIME, dt => {
      if (stun > 0) { stun -= dt; draw(); return; }
      const drift = (Math.random() - 0.5) * 3.2 + ang * 1.6; // ยิ่งเอียงยิ่งเอียงเร็ว
      vel += (drift + (pushL ? -3 : 0) + (pushR ? 3 : 0)) * dt;
      vel *= 0.96; ang += vel * dt;
      if (Math.abs(ang) > MAX) { drops++; S.playFail(); t.penalty(2); stun = 0.8; ang = 0; vel = 0; box.querySelector('.mg-badn')!.textContent = th(drops); }
      const speed = Math.max(0, 1 - Math.abs(ang) / MAX * 1.4);
      dist += speed * dt * 5; scroll += speed * dt * 40;
      box.querySelector('.mg-good')!.textContent = th(Math.floor(dist));
      draw();
    }, () => done(Math.max(0, Math.min(1, dist / TARGET)), 0));
    draw();
    return () => { t.stop(); box.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); };
  },
};

export const TASK_GAMES: Record<string, TaskGame> = { 'บริหาร': bureau, 'หาของป่า': forage, 'งานวัด': sweep, 'คาราวาน': caravan };

const TIER_NAME = ['ชั้นผู้น้อย', 'ชั้นกลาง', 'ชั้นสูง', 'ชั้นยอด'];
const grade = (s: number) => s >= 0.9 ? 'ยอดเยี่ยม' : s >= 0.6 ? 'ดี' : s >= 0.3 ? 'พอใช้' : 'ต้องปรับปรุง';

/** เปิดหน้ามินิเกมเต็มจอ: แนะนำ → เล่น → สรุป · onDone(score) หรือ null ถ้ากดออกก่อนเล่น */
export function runTask(kind: string, tier: number, track: Track, onDone: (score: number | null, bribes: number) => void) {
  const game = TASK_GAMES[kind];
  if (!game) { onDone(null, 0); return; }
  const root = document.createElement('div');
  root.className = 'mg';
  root.innerHTML = `<div class="mg-panel"><div class="mg-head"><b>${icon('scroll', 18)}${game.tiers ? 'ราชกิจ' : 'งานเด็ก'} · ${esc(game.title)}</b><small>${game.tiers ? TIER_NAME[tier] ?? '' : ''}</small></div><div class="mg-box"></div></div>`;
  document.body.appendChild(root);
  const box = root.querySelector<HTMLElement>('.mg-box')!;
  let stop: (() => void) | null = null;
  const close = (score: number | null, bribes = 0) => { stop?.(); root.remove(); onDone(score, bribes); };
  box.innerHTML = `<p>${esc(game.intro)}</p>
    <div class="mg-rules">${tier >= 0 && game.tiers ? '<div>ยศสูงขึ้น กฎจะเพิ่มขึ้นทีละข้อ</div>' : ''}${track === 'light' ? '<div>ทางสว่าง: ทำได้ยอดเยี่ยมได้ความชอบเพิ่มและได้บุญ</div>' : track === 'dark' ? `<div>ทางมืด: ${esc(game.darkHint)}</div>` : ''}</div>
    <div class="mg-btns"><button class="gbtn dark" data-x="later">ไว้ทีหลัง</button><button class="gbtn" data-x="go">${icon('play', 20)}เริ่ม</button></div>`;
  box.addEventListener('click', function intro(ev) {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-x]'); if (!b) return;
    box.removeEventListener('click', intro);
    if (b.dataset.x === 'later') { close(null); return; }
    S.playSelect();
    stop = game.run(box, tier, track, (score, bribes) => {
      stop?.(); stop = null;
      box.innerHTML = `<h2>${grade(score)}</h2><p>ทำได้ ${th(Math.round(score * 100))}% ของงานเต็ม${bribes ? ` · รับสินบน ${th(bribes)} ครั้ง` : ''}</p><button class="gbtn" data-x="ok">${icon('check', 20)}รับผลงาน</button>`;
      (score >= 0.6 ? S.playGood : S.playTap)();
      box.querySelector('[data-x=ok]')!.addEventListener('click', () => close(score, bribes));
    });
  });
}
