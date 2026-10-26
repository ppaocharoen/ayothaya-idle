// มินิเกมราชกิจ: เล่นสั้นๆ ~30 วินาที ได้คะแนน 0–1 ส่งกลับไปให้ engine ให้รางวัล
// ตอนนี้มี: บริหาร = คัดหนังสือราชการ (ยศสูงขึ้น กฎเพิ่มขึ้น)
import { esc, th } from './format';
import { icon } from './icons';
import * as S from './sound';

export interface TaskGame { title: string; run: (box: HTMLElement, tier: number, done: (score: number) => void) => () => void; }

const MONTHS = ['อ้าย', 'ยี่', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ', 'สิบเอ็ด', 'สิบสอง'];
const DEPTS = [
  { name: 'กรมกลาโหม', seal: 'คชสีห์', color: '#8e2a1f' },
  { name: 'กรมมหาดไทย', seal: 'ราชสีห์', color: '#2f4a6b' },
  { name: 'กรมคลัง', seal: 'บัวแก้ว', color: '#2f6b4f' },
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** บริหาร: คัดหนังสือขอเบิก อนุมัติ/ตีกลับ ตามกฎ */
const bureau: TaskGame = {
  title: 'คัดหนังสือราชการ',
  run(box, tier, done) {
    const cur = Math.floor(Math.random() * 12), limit = 20 + 10 * Math.floor(Math.random() * 4);
    const rules = [
      'ต้องมีตราประทับ และลงชื่อผู้ส่ง',
      'ตราต้องตรงกับกรม — กลาโหม: คชสีห์ · มหาดไทย: ราชสีห์ · คลัง: บัวแก้ว',
      `ลงวันได้เฉพาะเดือน${MONTHS[cur]} หรือเดือน${MONTHS[(cur + 11) % 12]} (เดือนก่อน)`,
      `ขอเบิกได้ไม่เกิน ${th(limit)} ชั่ง`,
    ].slice(0, tier + 1);
    type Doc = { dept: typeof DEPTS[number]; seal: typeof DEPTS[number] | null; signed: boolean; month: number; amount: number };
    const valid = (d: Doc) => !!d.seal && d.signed && (tier < 1 || d.seal === d.dept) && (tier < 2 || d.month === cur || d.month === (cur + 11) % 12) && (tier < 3 || d.amount <= limit);
    const make = (): Doc => {
      // ประมาณครึ่งหนึ่งถูกต้อง ที่ผิดจะผิดแค่ข้อเดียว (ต้องดูให้ดี)
      const dept = pick(DEPTS);
      const d: Doc = { dept, seal: dept, signed: true, month: Math.random() < 0.5 ? cur : (cur + 11) % 12, amount: 5 + Math.floor(Math.random() * (limit - 4)) };
      if (Math.random() < 0.5) {
        const bad = Math.floor(Math.random() * (tier + 1)) ;
        if (bad === 0) { if (Math.random() < 0.5) d.seal = null; else d.signed = false; }
        else if (bad === 1) d.seal = pick(DEPTS.filter(x => x !== dept));
        else if (bad === 2) d.month = (cur + 2 + Math.floor(Math.random() * 9)) % 12;
        else d.amount = limit + 5 + Math.floor(Math.random() * 30);
      }
      return d;
    };
    const TIME = 30, TARGET = 9;
    let left = TIME, right = 0, wrong = 0, doc = make(), t0 = 0, raf = 0, over = false;
    const docHtml = (d: Doc) => `<div class="mg-doc">
      <div class="mg-dt">หนังสือขอเบิกพระราชทรัพย์</div>
      <p>จาก <b>${esc(d.dept.name)}</b></p>
      <p>ขอเบิก <b>${th(d.amount)}</b> ชั่ง เพื่อใช้ในราชการ</p>
      <p>ลงวัน <b>เดือน${MONTHS[d.month]}</b></p>
      <p class="mg-sign">ลงชื่อ ${d.signed ? '<b class="mg-ink">ออกญา…</b>' : '<span class="muted">……………………</span>'}</p>
      ${d.seal ? `<div class="mg-seal" style="--c:${d.seal.color}"><span>ตรา<br>${esc(d.seal.seal)}</span></div>` : ''}
    </div>`;
    const render = () => {
      box.innerHTML = `<div class="mg-top"><span>${icon('check', 16)}${th(right)}</span><span class="mg-bar"><i style="width:${(left / TIME * 100).toFixed(1)}%"></i></span><span>${icon('cross', 16)}${th(wrong)}</span></div>
        <div class="mg-rules">${rules.map(r => `<div>• ${esc(r)}</div>`).join('')}</div>
        <div class="mg-stage">${docHtml(doc)}</div>
        <div class="mg-btns"><button class="gbtn dark" data-mg="no">${icon('cross', 20)}ตีกลับ</button><button class="gbtn" data-mg="yes">${icon('check', 20)}อนุมัติ</button></div>
        <p class="muted mg-hint">ปัดหนังสือไปซ้าย = ตีกลับ · ขวา = อนุมัติ</p>`;
    };
    const answer = (yes: boolean) => {
      if (over) return;
      const ok = yes === valid(doc);
      if (ok) { right++; S.playTap(); } else { wrong++; left = Math.max(0, left - 2); S.playFail(); }
      const el = box.querySelector<HTMLElement>('.mg-doc');
      el?.classList.add(ok ? (yes ? 'go-r' : 'go-l') : 'shake');
      setTimeout(() => { doc = make(); render(); }, ok ? 160 : 260);
    };
    const finish = () => {
      over = true; cancelAnimationFrame(raf);
      done(Math.max(0, Math.min(1, (right - wrong) / TARGET)));
    };
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const dt = (now - t0) / 1000; t0 = now; left -= dt;
      const bar = box.querySelector<HTMLElement>('.mg-bar i'); if (bar) bar.style.width = `${Math.max(0, left / TIME * 100).toFixed(1)}%`;
      if (left <= 0) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    const onClick = (ev: Event) => { const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-mg]'); if (b) answer(b.dataset.mg === 'yes'); };
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

export const TASK_GAMES: Record<string, TaskGame> = { 'บริหาร': bureau };

const TIER_NAME = ['ชั้นผู้น้อย', 'ชั้นกลาง', 'ชั้นสูง', 'ชั้นยอด'];
const grade = (s: number) => s >= 0.9 ? 'ยอดเยี่ยม' : s >= 0.6 ? 'ดี' : s >= 0.3 ? 'พอใช้' : 'ต้องปรับปรุง';

/** เปิดหน้ามินิเกมเต็มจอ: แนะนำ → เล่น → สรุป · onDone(score) หรือ null ถ้ากดออกก่อนเล่น */
export function runTask(kind: string, tier: number, onDone: (score: number | null) => void) {
  const game = TASK_GAMES[kind];
  if (!game) { onDone(null); return; }
  const root = document.createElement('div');
  root.className = 'mg';
  root.innerHTML = `<div class="mg-panel"><div class="mg-head"><b>${icon('scroll', 18)}ราชกิจ · ${esc(game.title)}</b><small>${TIER_NAME[tier] ?? ''}</small></div><div class="mg-box"></div></div>`;
  document.body.appendChild(root);
  const box = root.querySelector<HTMLElement>('.mg-box')!;
  let stop: (() => void) | null = null;
  const close = (score: number | null) => { stop?.(); root.remove(); onDone(score); };
  box.innerHTML = `<p>ภายใน ๓๐ วินาที ตัดสินหนังสือให้ถูกมากที่สุด — ตอบผิดเสียเวลา ๒ วินาที</p>
    <div class="mg-rules">${tier >= 0 ? '<div>ยศสูงขึ้น กฎจะเพิ่มขึ้นทีละข้อ</div>' : ''}</div>
    <div class="mg-btns"><button class="gbtn dark" data-x="later">ไว้ทีหลัง</button><button class="gbtn" data-x="go">${icon('play', 20)}เริ่ม</button></div>`;
  box.addEventListener('click', function intro(ev) {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-x]'); if (!b) return;
    box.removeEventListener('click', intro);
    if (b.dataset.x === 'later') { close(null); return; }
    S.playSelect();
    stop = game.run(box, tier, score => {
      stop?.(); stop = null;
      box.innerHTML = `<h2>${grade(score)}</h2><p>ทำได้ ${th(Math.round(score * 100))}% ของงานเต็ม</p><button class="gbtn" data-x="ok">${icon('check', 20)}รับผลงาน</button>`;
      (score >= 0.6 ? S.playGood : S.playTap)();
      box.querySelector('[data-x=ok]')!.addEventListener('click', () => close(score));
    });
  });
}
