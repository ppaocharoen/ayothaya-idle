// ชิ้นทดลอง: ชาติ 1 อายุ 9–20 เล่นบนมือถือได้จริง
import './game.css';
import { content } from '../content';
import type { StatKey } from '../content/types';
import { BALANCE as B, type PathKey } from '../engine/balance';
import * as E from '../engine/core';
import { Scene, type SceneMood } from './scene';
import * as S from './sound';
import { sound, setMusic } from './sound';
import { percentile, simulatePeers } from './compare';
import { speechFor } from './speech';
import { baht, dateOf, esc, pct, pctAuto, pctFine, th, thInt } from './format';
import { runAfterlife } from './afterlife';
import { CHANGELOG, VERSION } from './changelog';
import { TASK_GAMES, runTask } from './minigames';
import { BREEDS, breedOf, feedPrice, petAge, petPrice, petStage } from '../engine/pets';
import { CAREER_ICON, CHILD_ICON, PATH_ICON, STAT_ICON, icon } from './icons';

/** เหตุการณ์ประวัติศาสตร์ที่มีภาพประกอบ (public/art/H-<id>.jpg) */
const HIST_ART = new Set(['L1-H02', 'L2-H04', 'L4-H09']);
const SAVE_KEY = 'ayothaya.save.v1';
const SPEEDS = location.search.includes('dev') ? [1, 10, 100, 3000] : [1, 10, 100];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const statDef = (k: string) => content.stats.find(s => s.key === k);
const statName = (k: string) => statDef(k)?.display ?? k;
const careerOf = (k: string) => content.careers.careers.find(c => c.key === k)!;
/** ชื่อยศในข้อมูลมีคำอธิบายต่อท้าย → แยกเป็น [ชื่อสั้น, คำอธิบาย] */
const splitTitle = (t: string): [string, string] => {
  const m = t.match(/^(.+?)\s*\((.+)\)\s*$/); if (m) return [m[1], m[2]];
  const i = t.indexOf(' '); return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, ''];
};
const clean = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); // ตัดวงเล็บภาษาอังกฤษในชื่อของ

// ---------- โหลด/เซฟ ----------
function store(): Storage | null { try { return window.localStorage; } catch { return null; } }
/** รหัสเซฟสำหรับย้ายข้ามเบราว์เซอร์/แอปหน้าจอโฮม
 *  AY2z:<base64 ของ JSON ที่บีบอัด>:<ความยาว> (ใส่ความยาวไว้ตรวจว่าคัดลอกมาครบ) · อ่านรหัสรุ่น AY1 เดิมได้ */
const b64 = (u: Uint8Array) => { let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(bin); };
const unb64 = (t: string) => { const bin = atob(t); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
async function pipe(u: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>) {
  return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(stream)).arrayBuffer());
}
async function saveCode(): Promise<string> {
  const raw = new TextEncoder().encode(E.serialize(g));
  let tag = 'AY2', body = raw;
  if (typeof CompressionStream !== 'undefined') { try { body = await pipe(raw, new CompressionStream('deflate-raw')); tag = 'AY2z'; } catch { body = raw; } }
  const t = b64(body);
  return `${tag}:${t}:${t.length}`;
}
async function loadCode(text: string): Promise<{ g: E.GameState } | { err: string }> {
  const m = text.replace(/\s+/g, '').match(/(AY1|AY2z?):([A-Za-z0-9+/=_-]+)(?::(\d+))?/);
  if (!m) return { err: 'ไม่พบรหัสเซฟในข้อความที่วาง (ต้องขึ้นต้นด้วย AY)' };
  let t = m[2].replace(/-/g, '+').replace(/_/g, '/');
  if (m[1] !== 'AY1' && !m[3]) return { err: `รหัสไม่ครบ (ท้ายรหัสหายไป) — ได้ ${t.length.toLocaleString()} ตัวอักษร ลองคัดลอกใหม่ให้ครบ หรือใช้ “บันทึกเป็นไฟล์” แทน` };
  if (m[3] && t.length !== +m[3]) return { err: `รหัสไม่ครบ — ได้ ${t.length.toLocaleString()} จาก ${(+m[3]).toLocaleString()} ตัวอักษร ลองคัดลอกใหม่ หรือใช้ “บันทึกเป็นไฟล์” แทน` };
  while (t.length % 4) t += '=';
  try {
    let u = unb64(t);
    if (m[1] === 'AY2z') {
      if (typeof DecompressionStream === 'undefined') return { err: 'เครื่องนี้เปิดรหัสแบบบีบอัดไม่ได้ (iOS ต้องเป็น 16.4 ขึ้นไป)' };
      u = await pipe(u, new DecompressionStream('deflate-raw'));
    }
    const ng = E.deserialize(new TextDecoder().decode(u));
    return ng && ng.life ? { g: ng } : { err: 'รหัสอ่านได้แต่ข้อมูลเซฟไม่สมบูรณ์' };
  } catch (e) { return { err: `อ่านรหัสไม่ได้ (${(e as Error).name}) ลองคัดลอกใหม่ หรือใช้ไฟล์แทน` }; }
}
let readyCode = '';
async function prepareCode() { save(); readyCode = await saveCode(); }
function applyLoaded(ng: E.GameState) {
  g = ng; save(); sliceDone = false; healthWarned = false; lifebarFor = ''; running = true;
  closeMenu(); renderHud(); renderTab(); S.playSelect();
  toast('โหลดเซฟแล้ว เล่นต่อได้เลย', 'check');
}
async function tryLoad(text: string) {
  const r = await loadCode(text);
  if ('err' in r) { const el = document.getElementById('save-msg'); if (el) el.textContent = r.err; S.playTap(); return; }
  applyLoaded(r.g);
}
function save() { try { store()?.setItem(SAVE_KEY, E.serialize(g)); } catch { /* ไม่มีที่เก็บก็เล่นต่อได้ */ } }
function load(): E.GameState | null {
  try { const s = store()?.getItem(SAVE_KEY); return s ? E.deserialize(s) : null; } catch { return null; }
}

let g: E.GameState = load() ?? E.newGame();
let running = true, speedIdx = 0, acc = 0, tab: 'life' | 'shop' | 'char' | 'log' = 'life';
let sliceDone = !!g.ending; // จบเกมแล้ว (ฉากจบ)
let openWare: string | null = null;
let inAfterlife = false; // ของที่เปิดดูรายละเอียดอยู่
const scene = new Scene($<HTMLCanvasElement>('scene'));
if (location.search.includes('dev')) (window as unknown as Record<string, unknown>).__dev = { scene, get g() { return g; }, celebrate: (t: string) => celebrate(t), afterlife: () => yama(true), advance: (d: number) => { E.advance(g, d, { online: false }); renderHud(); renderTab(); } };

// เวลาที่ผ่านไปตอนปิดแอป
const away = E.offlineDays(g);
let awayInfo: { days: number; auto: number; eff: number } | null = null;
if (away > 0 && !sliceDone) {
  const eff = E.awayEff(g.life);
  const r = E.advance(g, away, { online: false, away: true });
  awayInfo = { days: r.days, auto: r.autoResolved, eff };
}
const capToSlice = (days: number) => days;

// ---------- วนเวลา ----------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (running && !g.queue.length && !sliceDone && g.life.named) {
    acc += dt * SPEEDS[speedIdx];
    const days = Math.floor(acc / B.secondsPerGameDay);
    if (days > 0) {
      acc -= days * B.secondsPerGameDay;
      const before = snap();
      E.advance(g, capToSlice(days), { online: true });
      if (g.life.idx === before.life) gainFloat(before);
      if (g.ending) { sliceDone = true; showSliceEnd(); }
      healthWarn();
      renderHud(); renderTabSoft();
    }
  }
  $('daybar').style.width = `${running && !g.queue.length && !sliceDone ? Math.min(100, acc / B.secondsPerGameDay * 100) : 0}%`;
  scene.alert = g.queue.length > 0;
  scene.paused = !running && !sliceDone;
  if (!g.life.named && !inAfterlife && !$('modal').classList.contains('show')) nameSheet();
  else if (g.queue.length && !inAfterlife && !$('modal').classList.contains('show')) showEvent();
  const mood = currentMood();
  // ของให้แตะเก็บ: สุ่มหล่นทุก 35–70 วินาทีจริง เฉพาะตอนเวลาเดินและไม่มีป๊อปอัพ
  if (running && !sliceDone && !g.queue.length && !$('modal').classList.contains('show')) {
    pickupTimer -= dt;
    if (pickupTimer <= 0 && !scene.pickup) { scene.spawnPickup((['coin', 'coin', 'flower', 'leaf'] as const)[Math.floor(Math.random() * 4)]); pickupTimer = 35 + Math.random() * 35; }
  }
  scene.draw(g, dt, mood);
  requestAnimationFrame(frame);
}

// ---------- บรรยากาศฉาก ----------
let pickupTimer = 20;
function currentMood(): SceneMood {
  const L = g.life, doy = L.day % B.daysPerYear, month = Math.min(11, Math.floor(doy / (365 / 12))), y = E.yearOf(L);
  const rainDay = (((L.day * 2654435761) >>> 0) % 5) < 2;
  const war = content.historical.some(h => h.life === L.idx && h.checkStat === 'ต่อสู้' && y >= h.yearFrom && y <= Math.max(h.yearTo, h.yearFrom));
  return { dayFrac: running && !g.queue.length ? acc / B.secondsPerGameDay : 0.4, month, rain: devRain || (month >= 5 && month <= 10 && rainDay), war };
}

// ---------- ตัวเลขลอยขึ้นจากตัวละคร ----------
interface Snap { life: number; money: number; merit: number; aff: number; hp: number; joy: number; sin?: number; stats: Record<string, number>; }
interface Delta { key: string; label: string; v: number; text: string; kind: string; }
function snap(): Snap {
  const L = g.life, stats: Record<string, number> = {};
  for (const k of E.STAT_KEYS) stats[k] = L.stats[k] / L.cap;
  return { life: L.idx, money: L.money, merit: g.merit, aff: L.affection, hp: L.health, joy: L.joy, sin: L.sin, stats };
}
const iconOf = (key: string) => key === 'money' ? 'coin' : key === 'merit' ? 'lotus' : key === 'aff' ? 'medal' : key === 'health' ? 'heart' : key === 'joy' ? 'smile' : key === 'sin' ? 'hood' : STAT_ICON[key] ?? 'star';
/** ผลต่างก่อน/หลัง (ใช้ทั้งตัวเลขลอยและป๊อปอัพผลลัพธ์) */
function diff(a: Snap): Delta[] {
  const b = snap(), out: Delta[] = [];
  if (a.life !== b.life) return out;
  for (const k of E.STAT_KEYS) { const d = b.stats[k] - a.stats[k]; if (Math.abs(d) > 1e-7) out.push({ key: k, label: statName(k), v: d, text: `${d > 0 ? '+' : '−'}${pctAuto(Math.abs(d))}`, kind: 'stat' }); }
  const dm = b.money - a.money; if (Math.abs(dm) > 1e-7) out.push({ key: 'money', label: 'เงิน', v: dm, text: `${dm > 0 ? '+' : '−'}${baht(Math.abs(dm), 1)}`, kind: 'money' });
  const db = b.merit - a.merit; if (db > 1e-6) out.push({ key: 'merit', label: 'บุญ', v: db, text: `+${th(db < 1 ? db.toFixed(2) : db.toFixed(1))}`, kind: 'merit' });
  const da = b.aff - a.aff; if (Math.abs(da) > 1e-6) out.push({ key: 'aff', label: 'ความชอบ', v: da, text: `${da > 0 ? '+' : '−'}${th(Math.abs(da).toFixed(2))}`, kind: 'aff' });
  const dh = b.hp - a.hp; if (Math.abs(dh) > 0.004) out.push({ key: 'health', label: 'สุขภาพ', v: dh, text: `${dh > 0 ? '+' : '−'}${pctAuto(Math.abs(dh))}`, kind: 'aff' });
  const dsn = (b.sin ?? 0) - (a.sin ?? 0); if (dsn > 1e-6) out.push({ key: 'sin', label: 'บาป', v: -dsn, text: `+${th(dsn.toFixed(1))}`, kind: 'aff' });
  const dj = b.joy - a.joy; if (Math.abs(dj) > 0.004) out.push({ key: 'joy', label: 'ความสำราญ', v: dj, text: `${dj > 0 ? '+' : '−'}${pctAuto(Math.abs(dj))}`, kind: 'merit' });
  return out;
}
function floatText(ic: string, text: string, kind: string, leftPct = 50) {
  const el = document.createElement('span');
  el.className = `float ${kind}`; el.innerHTML = `${icon(ic, 16)}${esc(text)}`; el.style.left = `${leftPct}%`;
  $('floats').appendChild(el); setTimeout(() => el.remove(), 2200);
}
let floatTurn = 0, lastFloat = 0;
function gainFloat(before: Snap) {
  // ไม่เกิน 1 ตัวต่อ 0.8 วินาที (ตอนเร่งเวลาจะได้ไม่ซ้อนกันจนอ่านไม่ออก)
  const now = performance.now();
  if (now - lastFloat < 800) return;
  lastFloat = now;
  const d = diff(before);
  const stats = d.filter(x => x.kind === 'stat' && x.v >= 5e-5).sort((x, y) => y.v - x.v);
  const pick = [d.find(x => x.kind === 'money'), stats[0], d.find(x => x.kind === 'merit'), stats[1] ?? stats[0]][floatTurn++ % 4];
  if (pick) floatText(iconOf(pick.key), pick.text, pick.kind, 38 + Math.random() * 16);
}

// ---------- เส้นชีวิต ----------
let lifebarFor = '';
function renderLifebar() {
  const L = g.life, span = (L.endYear - L.startYear + 1) * B.daysPerYear, key = `${g.loop}-${L.idx}`;
  const pos = L.day / span * 100;
  if (lifebarFor !== key) {
    lifebarFor = key;
    $('lifemarks').innerHTML = content.historical.filter(h => h.yearFrom >= L.startYear && h.yearFrom <= L.endYear).map(h => {
      const p = ((h.yearFrom - L.startYear) * B.daysPerYear) / span * 100;
      return `<i class="mk k-${h.kind}" data-p="${p.toFixed(2)}" style="left:${p.toFixed(2)}%"></i>`;
    }).join('');
    $('lifeme').innerHTML = icon('person', 18);
    $('lifeend').textContent = th(B.startAge + L.endYear - L.startYear);
  }
  document.querySelectorAll<HTMLElement>('#lifemarks .mk').forEach(m => m.classList.toggle('past', +m.dataset.p! < pos));
  $('lifefill').style.width = `${pos.toFixed(2)}%`;
  $('lifeme').style.left = `${pos.toFixed(2)}%`;
  $('lifeage').textContent = th(E.ageOf(L));
  const hp = Math.max(0, L.health);
  $('hpfill').style.width = `${(hp * 100).toFixed(1)}%`;
  $('hpbox').classList.toggle('low', hp < 0.3);
  $('joyfill').style.width = `${(L.joy * 100).toFixed(1)}%`;
  $('joybox').classList.toggle('low', L.joy < B.joyLow);
}

// ---------- HUD ----------
let hudKey = '';
function renderHud() {
  const L = g.life, r = E.reignAt(g), age = E.ageOf(L);
  $('hud-life').textContent = `${L.name} · ชาติ ${th(L.idx)} · อายุ ${th(age)}`;
  $('hud-year').textContent = `พ.ศ. ${th(E.yearOf(L))}`;
  $('hud-date').textContent = dateOf(L.day % B.daysPerYear);
  $('reign').textContent = `รัชสมัย${r.king}`;
  renderLifebar();
  $('res-money').textContent = baht(L.money);
  $('res-merit').textContent = thInt(g.merit);
  $('res-aff').textContent = th(L.affection.toFixed(1));
  const [ic, doing] = age < B.careerMinAge
    ? (L.childJob ? [CHILD_ICON[L.childJob] ?? 'leaf', content.childJobs.find(j => j.key === L.childJob)!.name] : ['person', 'ยังไม่ได้ช่วยงาน'])
    : (L.career ? [CAREER_ICON[L.career] ?? 'star', splitTitle(E.careerTitle(L.career, L.level, L.track))[0]] : ['person', 'ยังไม่มีอาชีพ']);
  const key = `${running}|${speedIdx}|${ic}|${doing}|${sound.sfx}|${sound.music}|${lifeAlert()}`;
  if (key === hudKey) return;
  hudKey = key;
  $('plaque').innerHTML = `${icon(ic, 18)}<span>${esc(doing)}</span>`;
  if (L.career) { $('plaque').dataset.act = 'careerinfo'; $('plaque').dataset.v = L.career; } else delete $('plaque').dataset.act;
  // ป้ายสถานะมุมขวา: หยุดอยู่ / ความเร็ว (แตะเพื่อเล่นต่อ/หยุด)
  $('btn-status').innerHTML = running ? `${icon('play', 16)}<span>×${th(SPEEDS[speedIdx])}</span>` : `${icon('pause', 16)}<span>หยุด</span>`;
  $('btn-status').classList.toggle('paused', !running);
  if ($('menu').classList.contains('show')) renderMenu();
  const lifeBtn = document.querySelector('#tabs [data-tab=life]')!;
  lifeBtn.querySelector('.dot')?.remove();
  if (lifeAlert()) lifeBtn.insertAdjacentHTML('beforeend', '<i class="dot"></i>');
}
/** มีเรื่องให้ทำในแท็บชีวิต (เลือกอาชีพ/งานเด็ก/เลื่อนยศได้) */
function lifeAlert(): boolean {
  const L = g.life, age = E.ageOf(L);
  if (age < B.careerMinAge) return !L.childJob;
  if (!L.career) return true;
  if (L.level + 1 >= B.lightDarkLevel && !L.track && L.level < B.maxLevel) return true;
  return !E.promoteBlock(g);
}

// ---------- แท็บ ----------
let panelHtml = '', lastPointer = 0, lastSoft = 0;
document.addEventListener('pointerdown', () => { lastPointer = performance.now(); S.unlockAudio(); }, true);
document.addEventListener('keydown', () => S.unlockAudio(), true);
function tabHtml() { return tab === 'life' ? lifeTab() : tab === 'shop' ? shopTab() : tab === 'char' ? charTab() : logTab(); }
function renderTab() {
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  panelHtml = tabHtml(); $('panel').innerHTML = panelHtml;
}
/** ตอนเวลาเดิน: วาดแผงใหม่เฉพาะเมื่อเนื้อหาเปลี่ยน ไม่เกิน 2 ครั้ง/วินาที และไม่วาดทับตอนกำลังแตะ (กันกดพลาด) */
function renderTabSoft() {
  const now = performance.now();
  if (now - lastSoft < 500 || now - lastPointer < 900) return;
  lastSoft = now;
  const html = tabHtml();
  if (html !== panelHtml) { panelHtml = html; $('panel').innerHTML = html; }
}

const openHelp = new Set<string>();
const help = (id: string) => `<button class="help ${openHelp.has(id) ? 'on' : ''}" data-act="help" data-v="${id}" aria-label="คำอธิบาย">?</button>`;
const helpBox = (id: string, html: string) => openHelp.has(id) ? `<div class="helpbox">${html}</div>` : '';
const sec = (title: string, extra = '', helpId = '') => `<div class="sec"><h3>${title}</h3>${extra ? `<small>${extra}</small>` : ''}${helpId ? help(helpId) : ''}</div>`;

function lifeTab(): string {
  const L = g.life, age = E.ageOf(L), c = L.career ? careerOf(L.career) : null;
  const paths = (Object.keys(B.paths) as PathKey[]).map(k => {
    const p = B.paths[k];
    return `<button class="tile ${L.path === k ? 'on' : ''}" data-act="path" data-v="${k}">${icon(PATH_ICON[k], 34)}<b>${p.label}</b>
      <span class="ratio"><i style="width:${p.work * 100}%"></i><i style="width:${p.train * 100}%"></i><i style="width:${p.merit * 100}%"></i></span></button>`;
  }).join('');
  const train = E.STAT_KEYS.map(s => {
    const f = L.stats[s] / L.cap, on = L.train.includes(s);
    const badge = c?.gateStat === s ? '<i class="badge g">หลัก</i>' : c?.secondaryStat === s ? '<i class="badge g">รอง</i>' : '';
    return `<button class="tile train ${on ? 'on' : ''}" data-act="train" data-v="${s}">${badge}${icon(STAT_ICON[s], 30)}<b>${esc(statName(s))}</b><small>${pctAuto(f)}</small><span class="mini"><i style="width:${(f * 100).toFixed(1)}%"></i></span></button>`;
  }).join('');
  let work = '';
  if (age < B.careerMinAge) {
    work = sec('งานเด็ก', 'เลือกอาชีพได้ตอนอายุ ๑๒', 'child') +
      helpBox('child', content.childJobs.map(j => `<p><b>${esc(j.name)}</b> — ${esc(j.desc)}<br><small class="muted">ฝึก ${j.stats.map(statName).join(', ')} · เหมาะกับ${j.suggests.join(', ')}</small></p>`).join('')) +
      `<div class="tiles c3">${content.childJobs.map(j => `<button class="tile ${L.childJob === j.key ? 'on' : ''}" data-act="child" data-v="${j.key}">${icon(CHILD_ICON[j.key] ?? 'leaf', 34)}<b>${esc(j.key)}</b></button>`).join('')}</div>`;
  } else if (!L.career) {
    work = sec('เลือกอาชีพ', 'แตะเพื่อดูรายละเอียด') +
      `<div class="tiles c3">${content.careers.careers.map(k => `<button class="tile" data-act="careerinfo" data-v="${k.key}">${icon(CAREER_ICON[k.key] ?? 'star', 34)}<b>${esc(k.key)}</b><small>${icon(STAT_ICON[k.gateStat], 14)}${icon(STAT_ICON[k.secondaryStat], 14)}</small></button>`).join('')}</div>`;
  } else work = promoteCard();
  return `${taskCard()}${work}
    ${sec('แนวทางชีวิต', '', 'path')}${helpBox('path', `แต่ละวันแบ่งเวลาให้ <b>งาน</b> <b>ฝึก</b> <b>บุญ</b> ตามสัดส่วนของแถบสี<br><b>งาน</b> ได้เงิน ความชอบ และสเตตัสของอาชีพ · <b>ฝึก</b> ได้สเตตัสที่เลือกด้านล่าง · <b>บุญ</b> ได้บุญญาธิการซึ่งติดตัวข้ามชาติ`)}
    <div class="tiles c4">${paths}</div>
    <div class="legend"><span><i style="background:var(--gold)"></i>งาน</span><span><i style="background:var(--blue)"></i>ฝึก</span><span><i style="background:#e48aa8"></i>บุญ</span></div>
    ${sec('ฝึกฝน', 'เลือกได้ ๒ ด้าน', 'train')}${helpBox('train', trainInfo())}<div class="tiles c4">${train}</div>`;
}

function trainInfo(): string {
  const L = g.life;
  return `<p>แตะเพื่อเลือก/เลิกฝึก · ตัวเลขคือ % ของเพดานชาตินี้ · <b>หลัก/รอง</b> = สเตตัสที่อาชีพใช้เลื่อนยศ</p>` + L.train.map(s => {
    const st = statDef(s)!;
    const prim = content.careers.careers.filter(c => c.gateStat === s).map(c => c.key);
    const sec2 = content.careers.careers.filter(c => c.secondaryStat === s).map(c => c.key);
    const checks = content.historical.filter(h => h.life === L.idx && h.checkStat === s).length;
    const uses = [prim.length ? `หลักของ${prim.join(', ')}` : '', sec2.length ? `รองของ${sec2.join(', ')}` : ''].filter(Boolean).join(' · ');
    return `<div class="info"><b>${esc(st.display)}</b> ${pctFine(L.stats[s] / L.cap)}<p>${esc(st.role)}</p><small>${uses ? `อาชีพ: ${esc(uses)} · ` : ''}เหตุการณ์ที่ต้องใช้ในชาตินี้ ${th(checks)} ครั้ง</small></div>`;
  }).join('');
}

/** ราชกิจค้าง: งานงอกเรื่อยๆ เข้าไปเล่นมินิเกมเพื่อเคลียร์ */
function taskCard(): string {
  const L = g.life, kind = E.taskKind(L), t = L.tasks ?? { n: 0, next: L.day + B.taskMinDays, fullSince: null };
  if (!kind) return '';
  const wait = Math.max(0, t.next - L.day);
  const angry = E.taskAngry(L), full = t.n >= B.taskCap, child = E.ageOf(L) < B.careerMinAge;
  const dots = Array.from({ length: B.taskCap }, (_, i) => `<i class="${i < t.n ? 'on' : ''}"></i>`).join('');
  const help = child
    ? `งานใหม่เข้ามาเรื่อยๆ ราว ๑๐–๑๕ วันต่อชิ้น เก็บค้างได้ ${th(B.taskCap)} ชิ้น<br>เข้าไปทำด้วยมินิเกม ได้ค่าขนมและฝึก${esc(content.childJobs.find(j => j.key === L.childJob)?.stats.map(statName).join(' ') ?? '')} ตามฝีมือ`
    : `งานใหม่เข้ามาเรื่อยๆ ราว ๑๐–๑๕ วันต่อชิ้น เก็บค้างได้ ${th(B.taskCap)} ชิ้น<br>เข้าไปเคลียร์ด้วยมินิเกม ได้เงิน ความชอบ และ${esc(statName(careerOf(L.career!).gateStat))} ตามฝีมือ<br>บริวารช่วยเคลียร์ให้บ้าง แต่ได้ผลไม่เต็ม (บริวารมากยิ่งช่วยมาก)<br>ถ้าปล่อยให้กองเต็มนาน นายจะไม่พอใจ ความชอบจากการทำงานลดลง`;
  return `${sec(child ? 'งานเด็กค้าง' : 'ราชกิจค้าง', `${th(t.n)}/${th(B.taskCap)}`, 'task')}${helpBox('task', help)}
    <div class="frame task ${angry ? 'angry' : ''}"><div class="taskdots">${dots}</div>
      ${angry ? `<p class="warn">${icon('cross', 16)}งานกองเต็มมานาน นายเริ่มไม่พอใจ — ความชอบจากการทำงานลดลง</p>` : full ? `<p class="muted">กองเต็มแล้ว ไม่มีงานใหม่เข้ามาจนกว่าจะเคลียร์</p>` : ''}
      <button class="gbtn" data-act="task" ${t.n ? '' : 'disabled'}>${icon('scroll', 20)}${t.n ? `${child ? 'ทำงาน' : 'ทำราชกิจ'} · ${esc(TASK_GAMES[kind].title)}` : `ยังไม่มีงานค้าง · งานถัดไปอีก ${th(wait)} วัน`}</button></div>`;
}
function promoteCard(): string {
  const L = g.life, c = careerOf(L.career!), cic = CAREER_ICON[L.career!] ?? 'star';
  if (L.level >= B.maxLevel) return `${sec('ยศ')}<div class="frame"><div class="rank">${icon('crown', 44)}<div><small>ถึงยศสูงสุดแล้ว</small><b>${esc(E.careerTitle(L.career!, L.level, L.track))}</b></div></div></div>`;
  const t = L.level + 1;
  if (t >= B.lightDarkLevel && !L.track) {
    return `${sec('ทางแยกของชีวิต')}<div class="frame"><p class="muted">ยศถัดไปต้องเลือกว่าจะเดินทางไหน — เลือกแล้วเปลี่ยนไม่ได้</p><div class="forks">
      <button class="gbtn" data-act="track" data-v="light">${icon('star', 20)}<span>ด้านสว่าง<br><small>${esc(c.titles.light['2'])}</small></span></button>
      <button class="gbtn dark" data-act="track" data-v="dark">${icon('hood', 20)}<span>ด้านมืด<br><small>${esc(c.titles.dark['2'])}</small></span></button></div></div>`;
  }
  const gv = E.gateValue(g, t), gn = E.gateFrac(t), aff = E.affectionReq(t), cost = E.promoteCost(L.level);
  const blk = E.promoteBlock(g);
  const req = (ic: string, ok: boolean, frac: number, val: string) =>
    `<div class="req ${ok ? 'ok' : ''}">${icon(ic, 20)}<div class="meter"><i style="width:${Math.min(100, frac * 100).toFixed(1)}%"></i></div><span>${val}</span>${icon(ok ? 'check' : 'cross', 18)}</div>`;
  const cooldown = Math.max(0, B.promoteCooldownDays - (L.day - L.lastPromoteDay));
  return `${sec('ยศถัดไป', '', 'rank')}${helpBox('rank', `ต้องครบทั้ง ๓ อย่าง:<br>${icon(STAT_ICON[c.gateStat], 16)} ${statName(c.gateStat)} ผสม ${statName(c.secondaryStat)} (หลักมีน้ำหนักมากกว่า)<br>${icon('medal', 16)} ความชอบสะสม — ได้จากการทำงาน เหตุการณ์ และงานบุญใหญ่<br>${icon('coin', 16)} ค่ายื่นเรื่อง<br>${icon('house', 16)} ยศขั้น ๗, ๑๑, ๑๕ ต้องมีบ้านสมฐานะ (เรือนไทย ตึก จวน)<br>ยื่นแล้วยังมีโอกาสไม่ผ่าน ถ้าไม่ผ่านต้องรอสักพัก`)}
    <div class="frame"><div class="rank" data-act="careerinfo" data-v="${L.career}">${icon(cic, 44)}<div><small>ขั้นที่ ${th(t)}</small><b>${esc(splitTitle(E.careerTitle(L.career!, t, L.track))[0])}</b><small>${esc(splitTitle(E.careerTitle(L.career!, t, L.track))[1])}</small></div></div>
      ${req(STAT_ICON[c.gateStat], gv >= gn, gv / gn, `${pct(gv)}/${pct(gn)}`)}
      ${req('medal', L.affection >= aff, L.affection / aff, `${th(L.affection.toFixed(1))}/${th(aff.toFixed(1))}`)}
      ${req('coin', L.money >= cost, L.money / cost, baht(cost, 1))}
      ${E.houseReq(t) ? req('house', L.accommodation >= E.houseReq(t), L.accommodation / E.houseReq(t), clean(content.shop.accommodations[E.houseReq(t) - 1].name)) : ''}
      <button class="gbtn red" data-act="promote" ${blk ? 'disabled' : ''}>${icon('up', 20)}${blk === 'cooldown' ? `รออีก ${th(cooldown)} วัน` : `ยื่นขอเลื่อนยศ${blk ? '' : ` · ${pct(E.promoteChance(g))}`}`}</button>
    </div>`;
}

// ---------- ตลาด ----------
interface Ware { id: string; ic: string; name: string; story: string; effs: [string, string][]; price: number | null; act: string; v: string; lv?: string; req?: number | null; }
function wares(): { title: string; sub: string; list: Ware[] }[] {
  const L = g.life, sh = content.shop, out: { title: string; sub: string; list: Ware[] }[] = [];
  if (L.career) {
    const items = sh.careerItems[L.career], lv = L.careerItem[L.career] ?? 0, it = items[lv] ?? items[items.length - 1];
    out.push({ title: 'ของประจำอาชีพ', sub: 'ทำงานได้ผลขึ้น', list: [{ id: 'citem', ic: CAREER_ICON[L.career] ?? 'star', name: clean(it.name), story: it.story ?? it.desc, effs: [['up', `ทำงาน +${pctAuto(B.careerItemEffPerLevel)}`]], price: items[lv] ? E.careerItemPrice(g) : null, act: 'citem', v: '', lv: `${th(Math.min(lv + 1, items.length))}/${th(items.length)}`, req: items[lv] ? E.careerItemReq(g) : null }] });
  }
  const acc2 = sh.accommodations[L.accommodation] ?? sh.accommodations[sh.accommodations.length - 1];
  const ret = sh.retainers[L.retainer] ?? sh.retainers[sh.retainers.length - 1];
  out.push({ title: 'บ้านและบริวาร', sub: L.career ? 'ตามยศศักดิ์' : 'ยังอยู่เรือนพ่อแม่', list: [
    { id: 'acc', ic: 'house', name: clean(acc2.name), story: acc2.story ?? acc2.desc, effs: [['book', `ฝึกฝน +${pctAuto(B.accommodationTrainPerLevel)}`], ['clock', `ตอนปิดแอป +${pctAuto(B.awayPerHouse)}`], ['heart', `แก่ช้าลง ${pctAuto(B.healthHouse)}`]], price: sh.accommodations[L.accommodation] ? E.accommodationPrice(L) : null, act: 'acc', v: '', lv: `${th(Math.min(L.accommodation + 1, sh.accommodations.length))}/${th(sh.accommodations.length)}`, req: sh.accommodations[L.accommodation] ? E.accommodationReq(g) : null },
    { id: 'ret', ic: 'people', name: clean(ret.name), story: ret.story ?? ret.desc, effs: [['coin', `รายได้ +${pctAuto(B.retainerIncomePerLevel)}`]], price: sh.retainers[L.retainer] ? E.retainerPrice(L) : null, act: 'ret', v: '', lv: `${th(Math.min(L.retainer + 1, sh.retainers.length))}/${th(sh.retainers.length)}`, req: sh.retainers[L.retainer] ? E.retainerReq(g) : null },
  ] });
  out.push({ title: 'ทำบุญ', sub: 'ทำซ้ำได้', list: sh.meritItems.map((m, i) => ({ id: `donate:${i}`, ic: 'lotus', name: clean(m.name), story: m.story ?? m.effect, effs: [['lotus', `บุญ +${thInt(m.legacyMerit / (1 + g.merit / B.meritSoftcap))}`]] as [string, string][], price: E.donationPrice(L, i), act: 'donate', v: String(i), lv: L.donations[i] ? `×${th(L.donations[i])}` : '' })) });
  out.push({ title: 'ของใช้', sub: 'ซื้อซ้ำได้', list: sh.commonItems.map((m, i) => ({ id: `common:${i}`, ic: STAT_ICON[m.stat] ?? 'pouch', name: clean(m.name), story: m.story ?? m.desc, effs: [[STAT_ICON[m.stat], `${statName(m.stat)} +${pctAuto(0.004)}`], ...(m.legacyAffection ? [['medal', 'ความชอบ +๐.๓'] as [string, string]] : [])], price: E.commonPrice(L, i), act: 'common', v: String(i), lv: L.common[i] ? `×${th(L.common[i])}` : '' })) });
  out.push({ title: 'สัตว์เลี้ยง', sub: g.pet ? `มี${breedOf(g.pet.breed).name}แล้ว` : 'เลี้ยงได้ทีละตัว', list: BREEDS.map(b => ({ id: `pet:${b.key}`, ic: 'paw', name: b.name, story: b.desc + (b.art ? '' : ' (ภาพยังไม่พร้อม — เร็วๆ นี้)'), effs: [...b.stats.map(st => [STAT_ICON[st], `${statName(st)} โตเองทีละน้อย`] as [string, string]), ['smile', 'เพิ่มความสำราญ']], price: g.pet || !b.art ? null : petPrice(E.dailyIncome(g)), act: 'buypet', v: b.key, lv: b.art ? '' : 'เร็วๆ นี้' })) });
  out.push({ title: 'งานบุญใหญ่', sub: '', list: B.megaProjects.map(m => ({ id: `mega:${m.id}`, ic: 'temple', name: m.name, story: 'สร้างถาวรวัตถุถวายวัด ชื่อจารึกไว้ให้คนรุ่นหลังรู้', effs: [['lotus', `บุญ +${thInt(m.merit)}`], ['medal', `ความชอบ +${th(m.affection)}`]] as [string, string][], price: m.price * Math.pow(1.5, L.mega[m.id] ?? 0), act: 'mega', v: m.id, lv: L.mega[m.id] ? `×${th(L.mega[m.id])}` : '' })) });
  return out;
}
function shopTab(): string {
  const L = g.life;
  return `<div class="purse">${icon('coin', 20)}${baht(L.money, 3)}</div>` + wares().map(s => sec(s.title, s.sub) + `<div class="shopgrid">${s.list.map(w => {
    const locked = w.req != null, can = !locked && w.price != null && L.money >= w.price;
    const price = w.price == null ? (w.act === 'buypet' ? (g.pet ? 'เลี้ยงอยู่ ๑ ตัว' : 'เร็วๆ นี้') : 'ครบแล้ว') : locked ? `${icon('lock', 13)}${w.req! < 0 ? 'ยังเด็ก' : `ยศขั้น ${th(w.req!)}`}` : `${icon('coin', 13)}${baht(w.price, 1)}`;
    return `<button class="ware ${w.price == null ? 'done' : locked ? 'locked' : can ? 'can' : 'poor'}" data-act="ware" data-v="${w.id}">${w.lv ? `<span class="lv">${w.lv}</span>` : ''}${icon(w.ic, 36)}<b>${esc(w.name)}</b><span class="price">${price}</span></button>`;
  }).join('')}</div>`).join('');
}
function wareSheet(id: string): string {
  const w = wares().flatMap(s => s.list).find(x => x.id === id);
  if (!w) return '';
  const L = g.life, locked = w.req != null, can = !locked && w.price != null && L.money >= w.price;
  const lockMsg = !locked ? '' : w.req! < 0 ? 'ยังเป็นเด็กอยู่เรือนพ่อแม่ — ซื้อได้เมื่อเริ่มรับราชการ' : `ต้องเป็น <b>${esc(splitTitle(E.careerTitle(L.career!, w.req!, L.track ?? 'light'))[0])}</b> (ยศขั้น ${th(w.req!)}) ก่อนจึงจะครอบครองได้`;
  return `<button class="close" data-act="close" aria-label="ปิด">${icon('cross', 16)}</button>
    <div class="head">${icon(w.ic, 48)}<div>${w.lv ? `<div class="eyebrow">${w.lv.startsWith('×') ? `ซื้อแล้ว ${w.lv.slice(1)} ครั้ง` : `ระดับ ${w.lv}`}</div>` : ''}<h2>${esc(w.name)}</h2></div></div>
    <p class="story">${esc(w.story)}</p>
    <div class="effs">${w.effs.map(([ic, t]) => `<span>${icon(ic, 18)}${esc(t)}</span>`).join('')}</div>
    ${lockMsg ? `<div class="odds">${icon('lock', 30)}<div>${lockMsg}</div></div>` : ''}
    ${w.price == null ? `<p class="muted">${w.act === 'buypet' ? (g.pet ? 'เลี้ยงได้ทีละตัว — ดูแลตัวที่มีอยู่ในแท็บค่าพลัง' : 'ภาพสายพันธุ์นี้ยังไม่พร้อม เร็วๆ นี้') : 'ซื้อครบทุกระดับแล้ว'}</p>` : `<button class="gbtn" data-act="${w.act}" data-v="${w.v}" ${can ? '' : 'disabled'}>${icon('coin', 20)}${baht(w.price)}${can || locked ? '' : ' <small>(เงินไม่พอ)</small>'}</button>
    <p class="muted" style="text-align:center;margin-top:8px">มีอยู่ ${baht(L.money, 3)}</p>`}`;
}

// ---------- ค่าพลัง ----------
function charTab(): string {
  const L = g.life, c = L.career ? careerOf(L.career) : null;
  const bars = content.stats.map(s => {
    const f = L.stats[s.key] / L.cap;
    const tags = [L.train.includes(s.key) ? '<i class="tg">ฝึก</i>' : '', c?.gateStat === s.key ? '<i class="tg g">หลัก</i>' : c?.secondaryStat === s.key ? '<i class="tg g">รอง</i>' : ''].join('');
    return `<button class="stat ${L.train.includes(s.key) ? 'train' : ''}" data-tip="stat:${s.key}">${icon(STAT_ICON[s.key], 28)}<div><div class="sl"><b>${esc(s.display)} <span class="tags">${tags}</span></b><span>${pctFine(f)}</span></div>
      <div class="bar"><i style="width:${(f * 100).toFixed(1)}%"></i></div></div></button>`;
  }).join('');
  const coll = g.collection;
  const hp = Math.max(0, L.health);
  const health = `<button class="stat health" data-tip="health">${icon('heart', 28)}<div><div class="sl"><b>สุขภาพ</b><span>${th(Math.round(hp * 100))}%</span></div><div class="bar"><i style="width:${(hp * 100).toFixed(1)}%"></i></div></div></button>`;
  const jy = `<button class="stat joyrow" data-tip="joy">${icon('smile', 28)}<div><div class="sl"><b>ความสำราญ</b><span>${th(Math.round(L.joy * 100))}%</span></div><div class="bar"><i style="width:${(L.joy * 100).toFixed(1)}%"></i></div></div></button>`;
  const who = `<div class="frame who"><div class="rank">${icon('person', 40)}<div><small>ชาติที่ ${th(L.idx)}${g.loop > 1 ? ` · รอบที่ ${th(g.loop)}` : ''}</small><b>${esc(L.name)}</b></div></div><button class="gbtn dark" data-act="rename">เปลี่ยนชื่อ</button></div>`;
  return `${who}${sec('ร่างกายและจิตใจ')}${health}${jy}${petPanel()}${sec('ค่าพลัง', `เพดาน ${th(L.cap)}`, 'stats')}${helpBox('stats', 'แตะแต่ละแถวเพื่อดูว่าค่านั้นใช้ทำอะไร · ค่าแสดงเป็น % ของเพดานชาตินี้ (ชาติต่อไปเพดานสูงขึ้น)')}${bars}
    ${sec('สมุดสะสม', 'แตะเพื่อเปิดดู')}<div class="coll"><div data-act="coll" data-v="titles"><b>${th(coll.titles.length)}</b><small>ยศที่เคยได้</small></div><div data-act="coll" data-v="choices"><b>${th(Object.keys(coll.choices).length)}</b><small>เหตุการณ์ที่เลือก</small></div><div data-act="coll" data-v="family"><b>${th(coll.family.length)}</b><small>ชาติที่บันทึก</small></div></div>
    <div class="foot"><a href="./content.html">คลังเนื้อหา</a></div>`;
}

function logTab(): string {
  return `${sec('บันทึก')}<div class="log">${g.log.slice().reverse().slice(0, 120).map(l => `<p>${esc(th(l))}</p>`).join('') || '<p class="muted">ยังไม่มีบันทึก</p>'}</div>`;
}

// ---------- เหตุการณ์ ----------
function openModal(html: string) { $('modal-body').innerHTML = html; $('modal').classList.add('show'); $('modal-body').scrollTop = 0; }
function closeModal() { $('modal').classList.remove('show'); openWare = null; }
const choiceBtn = (i: number, label: string, v: string, extra = '', cls = '') =>
  `<button class="choice ${cls}" data-act="resolve" data-v="${v}" data-label="${esc(label)}"><span class="n">${th(i)}</span><span>${esc(label)}${extra}</span></button>`;

function showEvent() {
  const e = g.queue[0];
  if (!e) return;
  S.playEvent();
  const L = g.life, head = `<div class="eyebrow">พ.ศ. ${th(E.yearOf(L))} · อายุ ${th(E.ageOf(L))} ปี</div>`;
  if (e.kind === 'karma') {
    const d = E.karmaDef(e);
    const n = d.choices.length;
    const work = E.isWork(e.id) && g.life.career ? g.life.career : null;
    const gate = work ? content.careers.careers.find(c => c.key === work)!.gateStat : null;
    const chance = E.riskChance(g, e);
    const risky = 'risky' in d && d.risky ? choiceBtn(n + 1, d.risky.label, 'risky', `<small>เสี่ยงดวง · โอกาส ${pct(chance)}${gate ? ` (ขึ้นกับ${esc(statName(gate))})` : ''}</small>`, 'risky') : '';
    const kind = work ? `${icon(CAREER_ICON[work] ?? 'star', 16)}ราชการ · ${WORK_TIER[E.workTier(g.life.level)]}` : `${icon('bell', 16)}กงกรรม`;
    openModal(`${head}<span class="kind${work ? ' work' : ''}">${kind}</span><h2>${esc(d.title)}</h2>
      ${d.choices.map((c, i) => choiceBtn(i + 1, c.label, String(i))).join('')}${risky}`);
    return;
  }
  if (e.kind === 'hist') {
    const h = content.historical.find(x => x.id === e.id)!;
    const art = HIST_ART.has(h.id) ? `<img class="hart" src="./art/H-${h.id}.jpg" alt="">` : '';
    let body = `${head}<span class="kind hist">${icon('scroll', 16)}พงศาวดาร</span>${art}<h2>${esc(h.title)}</h2>${h.desc ? `<p>${esc(h.desc)}</p>` : ''}`;
    if (h.kind === 'choice') body += h.choices!.map((c, i) => choiceBtn(i + 1, c.label, String(i))).join('');
    else if (h.kind === 'check') {
      const p = Math.min(B.checkMax, B.checkBase + B.checkSlope * E.frac(L, h.checkStat!));
      body += `<div class="odds">${icon(STAT_ICON[h.checkStat!], 30)}<div>ใช้${esc(statName(h.checkStat!))}<br><small class="muted">ผ่าน: ความชอบเพิ่ม · พลาด: เสียทรัพย์ ${pct(B.checkFailLoss)}</small></div><b>${pct(p)}</b></div>
        <button class="choice go" data-act="resolve-check">${icon('sword', 20)}รับมือ</button>`;
    } else body += `<button class="choice go" data-act="resolve" data-label="">รับทราบ</button>`;
    openModal(body);
    return;
  }
  if (e.kind === 'petGone') {
    const b = breedOf(e.grave.breed);
    openModal(`<span class="kind">${icon('lotus', 16)}ลาก่อน</span><h2>${esc(e.grave.name)} จากไปแล้ว</h2><p>${esc(b.name)}ที่อยู่ด้วยกันมา ${th(e.grave.age)} ปี หลับไปอย่างสงบ ไปรออยู่ที่สวนสวรรค์สัตว์เลี้ยง</p><button class="choice go" data-act="resolve" data-label="">ขอให้ไปสู่สุคติ</button>`);
    scene.showAnim('sad', 5);
    return;
  }
  if (e.kind === 'lifeEnd') {
    const sm = e.summary, age = sm.age ?? E.ageOf(L), full = B.startAge + L.endYear - L.startYear;
    openModal(`<span class="kind hist">${icon('candle', 16)}สิ้นชีวิต</span><h2>ชาติที่ ${th(sm.life)} · อายุ ${th(age)} ปี</h2>
      <p>${age < full ? `สุขภาพทรุดลงจนสิ้นลมก่อนอายุขัย (เต็มที่ได้ ${th(full)} ปี)` : 'อยู่จนสุดอายุขัย สิ้นลมอย่างสงบ'}</p>
      <p>${sm.career ? `ได้เป็น<b>${esc(splitTitle(E.careerTitle(sm.career, sm.level, L.track))[0])}</b> (ยศขั้น ${th(sm.level)})` : 'ไม่ได้รับราชการ'}</p>
      <div class="effs"><span>${icon('coin', 18)}${baht(sm.money)}</span><span>${icon('lotus', 18)}${thInt(sm.merit)}</span></div>
      ${sm.life === 1 && g.loop === 1 ? compareHtml(age) : ''}
      <button class="choice go" data-act="afterlife">วิญญาณออกจากร่าง…</button>`);
    return;
  }
  if (e.kind === 'finale') {
    openModal(`<h2>พ.ศ. ๒๓๑๐</h2><p>กรุงศรีอยุธยากำลังจะแตก</p>${e.options.map((o, i) => choiceBtn(i + 1, o, o)).join('')}`);
  }
}

function showResult(label: string, d: Delta[], risky: E.ResolveResult | null) {
  const items = d.map(x => `<li class="${x.v < 0 ? 'bad' : 'good'}">${icon(iconOf(x.key), 22)}${esc(x.label)}<b>${x.text}</b></li>`).join('');
  const verdict = risky ? `<div class="verdict ${risky.success ? 'good' : 'bad'}">${icon(risky.success ? 'star' : 'cross', 28)}${risky.success ? 'เสี่ยงแล้วได้ผล!' : 'เสี่ยงแล้วพลาด'}</div>` : '';
  openModal(`<span class="kind">${icon('check', 16)}ผลของการเลือก</span><h2>${esc(label)}</h2>${verdict}
    ${items ? `<ul class="result">${items}</ul>` : '<p class="muted">ไม่มีผลที่เห็นได้ในตอนนี้</p>'}
    <button class="choice go" data-act="close">ไปต่อ</button>`);
}

function compareHtml(toAge: number): string {
  const peers = simulatePeers(50, toAge), L = g.life;
  const row = (ic: string, p: number) => `<li>${icon(ic, 22)}<div class="pbar"><i style="width:${(p * 100).toFixed(0)}%"></i></div><b>${th(Math.round(p * 100))}%</b></li>`;
  return `<p class="muted">ทำได้ดีกว่าไพร่จำลองที่เกิดปีเดียวกันกี่ % (จำลอง ๕๐ ชีวิต)</p><ul class="peers">
    ${row('crown', percentile(peers.map(p => p.level), L.level))}${row('lotus', percentile(peers.map(p => p.merit), g.merit))}${row('coin', percentile(peers.map(p => p.money), L.money))}</ul>`;
}

/** ฉากจบเกม */
function showSliceEnd() {
  running = false;
  const id = g.ending === 'defended' ? 'defend' : g.ending;
  const e = content.endings.find(x => x.id === id);
  openModal(`<span class="kind">${icon('star', 16)}ฉากจบ</span><h2>${esc(e?.name ?? 'จบ')}</h2>
    <p>${esc(e?.summary ?? '')}</p>
    <div class="effs"><span>${icon('lotus', 18)}บุญ ${thInt(g.merit)}</span><span>${icon('scroll', 18)}${th(g.collection.family.length)} ชาติ</span><span>${icon('crown', 18)}${th(g.collection.titles.length)} ยศ</span></div>
    <button class="choice go" data-act="restart">เริ่มใหม่ตั้งแต่ชาติแรก</button><button class="choice" data-act="close"><span>ดูสถานะ</span></button>`);
}
function showAway() {
  if (!awayInfo) return;
  const y = Math.floor(awayInfo.days / B.daysPerYear), d = awayInfo.days % B.daysPerYear;
  openModal(`<span class="kind">${icon('clock', 16)}ระหว่างที่ท่านไม่อยู่</span><h2>เวลาผ่านไป ${y ? `${th(y)} ปี ` : ''}${th(d)} วัน</h2>
    <p class="muted">ตอนปิดเกม เวลาเดินช้ากว่าตอนเปิด ๑๐ เท่า และไม่เกิน ${th(Math.round(B.offlineMaxDays / B.daysPerYear))} ปีต่อครั้ง${awayInfo.days >= B.offlineMaxDays ? ' (ครั้งนี้ถึงเพดานแล้ว)' : ''}</p>
    <p>${awayInfo.eff < 1 ? `ตอนไม่อยู่ได้ผล ${th(Math.round(awayInfo.eff * 100))}% ของตอนเล่นเอง — บ้านดีขึ้นได้ผลมากขึ้น · ` : ''}${awayInfo.auto ? `กงกรรม ${th(awayInfo.auto)} เรื่องตัดสินใจไปตามแนวทางชีวิตแล้ว` : 'ไม่มีกงกรรมที่ต้องตัดสินใจแทน'}${g.queue.length ? ` · มี ${th(g.queue.length)} เรื่องรอท่านอยู่` : ''}</p>
    <button class="choice go" data-act="close">ไปต่อ</button>`);
  awayInfo = null;
}

/** แผ่นอาชีพ: คำอธิบายสาย + ยศที่เป็นอยู่ (และยศถัดไป) — ตอนเลือกอาชีพแสดงยศแรก */
function careerSheet(k: string, choose = true): string {
  const c = careerOf(k), L = g.life, mine = L.career === k;
  const rank = (lv: number, label: string, on = false) => {
    const [name, desc] = splitTitle(E.careerTitle(k, lv, L.track));
    return `<li class="${on ? 'on' : ''}"><small>${label}</small><b>${esc(name)}</b>${desc ? `<p>${esc(desc)}</p>` : ''}</li>`;
  };
  const ranks = mine
    ? rank(L.level, `ยศที่เป็นอยู่ · ขั้น ${th(L.level)}`, true) + (L.level < B.maxLevel && (L.level + 1 < B.lightDarkLevel || L.track) ? rank(L.level + 1, `ยศถัดไป · ขั้น ${th(L.level + 1)}`) : '')
    : rank(0, 'ยศแรกเมื่อเข้ารับราชการ', true);
  return `<button class="close" data-act="close" aria-label="ปิด">${icon('cross', 16)}</button>
    <div class="head">${icon(CAREER_ICON[k] ?? 'star', 48)}<div><div class="eyebrow">${esc(c.fullname)}</div><h2>${esc(k)}</h2></div></div>
    ${c.desc ? `<p>${esc(c.desc)}</p>` : ''}
    <div class="effs"><span>${icon(STAT_ICON[c.gateStat], 18)}หลัก ${esc(statName(c.gateStat))}</span><span>${icon(STAT_ICON[c.secondaryStat], 18)}รอง ${esc(statName(c.secondaryStat))}</span></div>
    <ul class="ladder ranks">${ranks}</ul>
    ${choose ? `<p class="muted">เลือกแล้วเปลี่ยนไม่ได้ในชาตินี้ · ชาติต่อไปอาชีพเดิมจะเก่งเร็วขึ้น</p>
    <button class="gbtn red" data-act="career" data-v="${k}">${icon('seal', 20)}เข้ารับราชการเป็น${esc(k)}</button>` : ''}`;
}

function reignSheet(): string {
  const L = g.life, r = E.reignAt(g), y = E.yearOf(L);
  const past = content.historical.filter(h => h.life === L.idx && h.yearFrom >= r.from && h.yearFrom <= Math.min(r.to, y));
  return `<button class="close" data-act="close" aria-label="ปิด">${icon('cross', 16)}</button>
    <div class="head">${icon('crown', 48)}<div><div class="eyebrow">พ.ศ. ${th(r.from)}–${th(r.to)}</div><h2>${esc(r.king)}</h2></div></div>
    <p>${esc(r.context)}</p>
    ${past.length ? `<h3 class="sh">เหตุการณ์ที่ผ่านมาในรัชกาลนี้</h3><ul class="ladder">${past.map(h => `<li><small>พ.ศ. ${th(h.yearFrom)}</small>${esc(h.title)}</li>`).join('')}</ul>` : '<p class="muted">ยังไม่มีเหตุการณ์สำคัญในรัชกาลนี้ที่ท่านได้พบ</p>'}`;
}

/** หาเหตุการณ์จาก id เพื่อแสดงในสมุดสะสม */
function eventById(id: string): { title: string; choices: { label: string }[]; risky?: { label: string } } | null {
  const k = content.karmaFixed.find(x => x.id === id) ?? content.karmaGeneric.find(x => x.id === id);
  if (k) return k as never;
  const h = content.historical.find(x => x.id === id);
  return h ? { title: h.title, choices: h.choices ?? [] } : null;
}
function collSheet(tabName: string): string {
  const coll = g.collection;
  const tabs = [['titles', 'ยศ'], ['choices', 'เหตุการณ์'], ['family', 'ชาติ'], ['pets', 'สัตว์'], ['endings', 'ฉากจบ']]
    .map(([k, l]) => `<button class="ctab ${tabName === k ? 'on' : ''}" data-act="coll" data-v="${k}">${l}</button>`).join('');
  let body = '';
  if (tabName === 'titles') {
    body = content.careers.careers.map(c => {
      const got = coll.titles.filter(t => t.startsWith(`${c.key}|`)).map(t => { const [, tr, lv] = t.split('|'); return { lv: +lv, title: splitTitle(E.careerTitle(c.key, +lv, tr === 'ร่วม' ? null : tr as 'light' | 'dark'))[0], dark: tr === 'dark' }; }).sort((a, b) => a.lv - b.lv);
      const total = B.lightDarkLevel + (B.maxLevel - B.lightDarkLevel + 1) * 2 - 1;
      return `<div class="cgroup"><div class="cg-h">${icon(CAREER_ICON[c.key] ?? 'star', 24)}<b>${esc(c.key)}</b><small>${th(got.length)}/${th(total)}</small></div>
        <div class="chips">${got.map(x => `<span class="${x.dark ? 'dark' : ''}">${esc(x.title)}</span>`).join('')}${got.length < total ? `<span class="unk">??? ×${th(total - got.length)}</span>` : ''}</div></div>`;
    }).join('');
  } else if (tabName === 'choices') {
    const ids = Object.keys(coll.choices);
    body = ids.length ? `<ul class="ladder">${ids.map(id => {
      const e = eventById(id); if (!e) return '';
      const picks = coll.choices[id].map(i => i < 0 ? e.risky?.label ?? 'เสี่ยงดวง' : e.choices[i]?.label ?? '').filter(Boolean);
      return `<li><small>${esc(e.title)}</small>${picks.map(esc).join(' · ')}</li>`;
    }).join('')}</ul>` : '<p class="muted">ยังไม่เคยเลือกอะไรในเหตุการณ์</p>';
  } else if (tabName === 'family') {
    body = coll.family.length ? `<ul class="ladder">${coll.family.map(f => `<li><small>รอบที่ ${th(f.loop)} · ชาติที่ ${th(f.life)}${f.name ? ` · ${esc(f.name)}` : ''}${f.age ? ` · อายุ ${th(f.age)}` : ''}</small>${f.career ? esc(splitTitle(E.careerTitle(f.career, f.level, null))[0]) : 'ไม่มีอาชีพ'} · บุญ ${thInt(f.merit)}</li>`).join('')}</ul>` : '<p class="muted">ยังไม่มีชาติที่จบไปแล้ว — ชาติแรกยังดำเนินอยู่</p>';
  } else if (tabName === 'pets') {
    body = `<h3 class="sh">สวนสวรรค์สัตว์เลี้ยง</h3><p class="muted">สัตว์ที่เคยอยู่เคียงข้าง แม้จากไปแล้วก็ยังจำกันได้</p>${graveList()}`;
  } else {
    body = `<ul class="ladder">${content.endings.map(e => coll.endings.includes(e.id) ? `<li class="on"><small>ปลดล็อกแล้ว</small>${esc(e.name)}</li>` : `<li><small>ยังไม่พบ</small>???</li>`).join('')}</ul>`;
  }
  return `<button class="close" data-act="close" aria-label="ปิด">${icon('cross', 16)}</button>
    <div class="head">${icon('book', 48)}<div><div class="eyebrow">สิ่งที่สะสมข้ามชาติ</div><h2>สมุดสะสม</h2></div></div>
    <div class="ctabs">${tabs}</div>${body}`;
}

// ---------- คำอธิบายเมื่อแตะไอคอน ----------
const TIPS: Record<string, [string, string]> = {
  money: ['coin', 'เงิน — ได้จากงานทุกวัน ใช้ซื้อของ ทำบุญ และยื่นขอเลื่อนยศ'],
  merit: ['lotus', 'บุญญาธิการ — ติดตัวข้ามชาติ ไม่หายเมื่อตาย ใช้ปลดล็อกทวิภพ'],
  aff: ['medal', 'ความชอบ — ผลงานที่นายเห็น ใช้เลื่อนยศ หายเมื่อสิ้นชาติ'],
  joy: ['smile', 'ความสำราญ — ลดลงทุกวันเมื่อทำงานหนัก เพิ่มจากสันทนาการ เทศกาล บ้านดี · สูง: ทำงาน/ฝึกได้ผลมากขึ้น แก่ช้าลง · ต่ำ: ได้ผลน้อยลง ป่วยง่าย'],
  health: ['heart', 'สุขภาพ — ลดลงตามวัยและเมื่อล้มป่วย หมดเมื่อไรสิ้นชีวิต · บ้านดีและพละกำลังสูงช่วยให้แก่ช้าลง'],
};

// ---------- ปุ่มต่างๆ ----------
document.addEventListener('click', ev => {
  const tipEl = (ev.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (tipEl) {
    const t = tipEl.dataset.tip!;
    if (t.startsWith('stat:')) { const s = statDef(t.slice(5))!; toast(`${s.display} — ${s.role}`, STAT_ICON[s.key]); }
    else if (TIPS[t]) toast(TIPS[t][1], TIPS[t][0]);
    S.playTap(); return;
  }
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-tab]');
  if (!b) return;
  if (b.dataset.tab) { if (tab !== b.dataset.tab) S.playTab(); tab = b.dataset.tab as typeof tab; renderTab(); $('panel').scrollIntoView({ block: 'nearest' }); return; }
  const v = b.dataset.v ?? '';
  const money0 = g.life.money;
  const buy = (fn: () => unknown) => { fn(); if (g.life.money < money0) { S.playBuy(); floatText('coin', `−${baht(money0 - g.life.money, 1)}`, 'money', 50); } else S.playFail(); };
  switch (b.dataset.act) {
    case 'path': if (g.life.path !== v) S.playSelect(); E.setPath(g, v as PathKey); break;
    case 'train': {
      const cur = g.life.train.slice(); const i = cur.indexOf(v as StatKey);
      if (i >= 0) { if (cur.length > 1) cur.splice(i, 1); } else { cur.push(v as StatKey); if (cur.length > 2) cur.shift(); }
      S.playToggle(i < 0); E.setTrain(g, cur); break;
    }
    case 'child': if (g.life.childJob !== v) S.playSelect(); E.chooseChildJob(g, v); break;
    case 'careerinfo': S.playOpen(); openModal(careerSheet(v, !g.life.career)); return;
    case 'reign': S.playOpen(); openModal(reignSheet()); return;
    case 'coll': S.playOpen(); openModal(collSheet(v)); return;
    case 'task': {
      const kind = E.taskKind(g.life);
      if (!kind || !g.life.tasks?.n) break;
      const was = running; running = false; renderHud(); S.playTap();
      runTask(kind, E.workTier(g.life.level), (g.life.track ?? null) as 'light' | 'dark' | null, (score, bribes) => {
        running = was;
        if (score != null) {
          const before = snap();
          const r = E.completeTask(g, score, bribes); save();
          showResult(`${E.ageOf(g.life) < B.careerMinAge ? 'งานเด็ก' : 'ราชกิจ'} · ${TASK_GAMES[kind].title}`, diff(before), null);
          if (r?.caught) toast('ถูกจับได้ว่ารับสินบน — นายเสียความเชื่อใจ ความชอบลดลง', 'cross');
          scene.showAnim(scene.workAnimId(g.life) ?? 'happy', 5);
        }
        renderHud(); renderTab();
      });
      break;
    }
    case 'career': E.chooseCareer(g, v); S.playGong(); closeModal(); toast(`เข้ารับราชการเป็น${splitTitle(E.careerTitle(v, 0, null))[0]}`, CAREER_ICON[v]); break;
    case 'track': E.chooseTrack(g, v as 'light' | 'dark'); S.playGong(); break;
    case 'promote': {
      const before = g.life.level, r = E.tryPromote(g);
      if (r.ok && g.life.level > before) celebrate(E.careerTitle(g.life.career!, g.life.level, g.life.track));
      else { S.playFail(); scene.showAnim('sad', 4); toast('ยื่นเรื่องไม่ผ่านคราวนี้ ลองใหม่ภายหลัง', 'cross'); }
      break;
    }
    case 'ware': S.playOpen(); openWare = v; openModal(wareSheet(v)); return;
    case 'citem': buy(() => E.buyCareerItem(g)); break;
    case 'acc': buy(() => { E.buyAccommodation(g); }); break;
    case 'ret': buy(() => E.buyRetainer(g)); break;
    case 'donate': buy(() => E.donate(g, +v)); break;
    case 'common': buy(() => E.buyCommon(g, +v)); break;
    case 'mega': buy(() => E.buyMega(g, v)); break;
    case 'resolve': {
      const e = g.queue[0], before = snap();
      const label = b.dataset.label ?? '';
      const r = E.resolveEvent(g, v === '' ? undefined : v === 'risky' ? 'risky' : isNaN(+v) ? v as E.EndingId : +v);
      const choseSomething = e && (e.kind === 'karma' || (e.kind === 'hist' && v !== ''));
      if (v === 'risky') (r.success ? S.playGood : S.playFail)(); else S.playTap();
      if (choseSomething) {
        const d = diff(before);
        showResult(label, d, v === 'risky' ? r : null);
        // ให้ตัวละครทำท่าที่เข้ากับตัวเลือก (ดูจากคำในตัวเลือกก่อน ถ้าไม่เข้าคำไหนใช้สเตตัสที่เพิ่มมากที่สุด)
        const bad = d.length && d.every(x => x.v < 0);
        // กงการ: ทำท่าทำงานของอาชีพ (ถ้าผลไม่แย่) · อื่นๆ ดูจากคำในตัวเลือก
        const workKw = e.kind === 'karma' && E.isWork(e.id) && !bad && !(v === 'risky' && !r.success) ? scene.workAnimId(g.life) : null;
        const kw = workKw ?? (v === 'risky' ? (r.success ? 'happy' : 'sad') : bad ? 'sad' : animForLabel(label));
        if (!(kw && scene.showAnim(kw, 6)))
          for (const x of d.filter(x => x.kind === 'stat' && x.v > 0).sort((p, q) => q.v - p.v)) if (scene.showStat(x.key, 6)) break;
      }
      else closeModal();
      break;
    }
    case 'resolve-check': {
      const h = content.historical.find(x => x.id === (g.queue[0] as { id: string }).id)!;
      const r = E.resolveEvent(g);
      (r.success ? S.playGood : S.playFail)(); scene.showAnim(r.success ? 'happy' : 'sad', 5);
      openModal(`<span class="kind hist">${icon('scroll', 16)}ผลลัพธ์</span><h2>${esc(h.title)}</h2><div class="verdict ${r.success ? 'good' : 'bad'}">${icon(r.success ? 'star' : 'cross', 28)}${r.success ? `ผ่าน — ความชอบ +${th(B.affectionHistSuccess)}` : `พลาด — เสียทรัพย์ ${pct(B.checkFailLoss)}`}</div><button class="choice go" data-act="close">ไปต่อ</button>`);
      break;
    }
    case 'close': S.playTap(); closeModal(); break;
    case 'buypet': if (E.buyPet(g, v)) { S.playBuy(); closeModal(); petNameSheet(); return; } S.playFail(); break;
    case 'petfeed': if (E.feedPet(g)) { S.playBuy(); scene.petHappy(); floatText('paw', 'อิ่มแล้ว!', 'merit', 40); } else S.playFail(); break;
    case 'petname': petNameSheet(); return;
    case 'petname-ok': E.setPetName(g, ($('pn') as HTMLInputElement).value); S.playSelect(); closeModal(); break;
    case 'pettrain': petTrainSheet(); return;
    case 'pettap': {
      if (!petTrain) return;
      const mk = document.querySelector<HTMLElement>('.modal .ymark'), m = +(mk?.dataset.m ?? 0);
      petTrain.tries++;
      if (Math.abs(m - petTrain.zone) <= 0.12) { petTrain.hits++; S.playSelect(); petTrain.zone = 0.2 + Math.random() * 0.6; } else S.playFail();
      if (petTrain.tries >= 5) {
        const h = petTrain.hits; cancelAnimationFrame(petTrain.raf); petTrain = null;
        E.trainPet(g, h, 5); scene.petHappy(3); (h >= 3 ? S.playGood : S.playFail)();
        openModal(`<span class="kind">${icon('star', 16)}ผลการฝึก</span><h2>ทำตามได้ ${th(h)} จาก ๕ ครั้ง</h2><p>${h >= 4 ? 'เก่งมาก! ฉลาดขึ้นเยอะ' : h >= 2 ? 'พอใช้ได้ ค่อยๆ ฝึกไป' : 'ยังซนอยู่ ไว้ฝึกใหม่สัปดาห์หน้า'}</p><button class="choice go" data-act="close">ไปต่อ</button>`);
        save(); renderTab();
      }
      return;
    }
    case 'name-rand': { const inp = $('nm') as HTMLInputElement; let n = inp.value; while (n === inp.value) n = E.NAMES[Math.floor(Math.random() * E.NAMES.length)]; inp.value = n; S.playTap(); return; }
    case 'name-ok': E.setName(g, ($('nm') as HTMLInputElement).value || g.life.name); S.playSelect(); closeModal(); break;
    case 'rename': g.life.named = false; closeModal(); nameSheet(); return;
    case 'afterlife': closeModal(); yama(false); return;
    case 'help': S.playTap(); if (openHelp.has(v)) openHelp.delete(v); else openHelp.add(v); break;
    case 'restart': store()?.removeItem(SAVE_KEY); g = E.newGame(); sliceDone = false; healthWarned = false; running = true; lifebarFor = ''; closeModal(); break;
  }
  if (openWare && $('modal').classList.contains('show')) openModal(wareSheet(openWare));
  save(); renderHud(); renderTab();
});
// แตะพื้นหลังมืดนอกแผ่น = ปิด (เฉพาะแผ่นรายละเอียด ไม่ใช่เหตุการณ์)
$('modal').addEventListener('click', ev => { if (ev.target === $('modal') && $('modal-body').querySelector('.close')) closeModal(); });
$('btn-status').addEventListener('click', () => { running = !running; S.playTap(); renderHud(); renderTab(); });
// แตะในฉาก: เก็บของ หรือคุยกับตัวละคร
$('scene').addEventListener('click', ev => {
  const p = scene.toCanvas(ev);
  if (scene.pickup && scene.hitPickup(p.x, p.y)) {
    const r = E.grantPickup(g, scene.pickup.kind), [kind, a, b2] = r.split(':');
    scene.collectBurst(scene.pickup.x, scene.pickup.y); scene.pickup = null; S.playCoin();
    if (kind === 'money') floatText('coin', `+${baht(+a, 1)}`, 'money', p.x / 2.4);
    else if (kind === 'aff') floatText('medal', `+${th(a)}`, 'aff', p.x / 2.4);
    else floatText(STAT_ICON[a] ?? 'star', `+${pctAuto(+b2)}`, 'stat', p.x / 2.4);
    save(); renderHud(); return;
  }
  if (g.pet && scene.hitPet(p.x, p.y)) {
    const ok = E.playPet(g); scene.petHappy(); S.playTap();
    floatText('heart', ok ? 'ผูกพัน +' : 'ชอบที่ได้เล่น', 'aff', p.x / 2.4);
    save(); renderTab(); return;
  }
  if (scene.hitChar(p.x, p.y)) {
    S.playTap();
    const m = currentMood(), el = $('speech');
    const sp = speechFor(g, { rain: m.rain, war: m.war, month: m.month });
    el.textContent = sp.text;
    if (sp.anim) scene.showAnim(sp.anim, 3.5);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
});
// คีย์บอร์ด: 1–9 เลือกตัวเลือก · Enter ไปต่อ · Space หยุด/เล่น
document.addEventListener('keydown', ev => {
  if ($('modal').classList.contains('show')) {
    const cs = [...document.querySelectorAll<HTMLButtonElement>('.modal.show .choice')];
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= cs.length) cs[n - 1].click();
    else if (ev.key === 'Enter' && $('nm')) (document.querySelector('[data-act=name-ok]') as HTMLButtonElement)?.click();
    else if (ev.key === 'Enter' && cs.length === 1) cs[0].click();
    else if (ev.key === 'Escape' && $('modal-body').querySelector('.close')) closeModal();
    return;
  }
  if (ev.key === ' ') { ev.preventDefault(); running = !running; renderHud(); }
});
// เสียง: ตั้งค่าที่จำไว้ (เพลงจะเริ่มจริงหลังผู้เล่นแตะจอครั้งแรก)
try { const sp = JSON.parse(store()?.getItem('ayothaya.sound') ?? '{}'); sound.sfx = sp.sfx ?? true; if (sp.music) setMusic(true); } catch { /* ใช้ค่าเริ่มต้น */ }
// ---------- เมนูสามขีด ----------
const SPEED_LABEL: Record<number, string> = { 1: 'ปกติ', 10: 'เร็ว', 100: 'เร็วมาก', 3000: 'ทดสอบ' };
let installEvt: (Event & { prompt: () => void }) | null = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e as typeof installEvt; });
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let menuPage: 'main' | 'log' | 'install' | 'dev' = 'main';
const IS_DEV = location.search.includes('dev');
function renderMenu() {
  const body = $('menu-body');
  if (menuPage === 'dev') { body.innerHTML = devPage(); return; }
  if (menuPage === 'log') {
    body.innerHTML = `<div class="mhead"><button class="mback" data-m="main">${icon('cross', 16)}</button><b>มีอะไรใหม่</b></div>
      ${CHANGELOG.map(c => `<div class="mlog"><div><b>เวอร์ชัน ${c.v}</b><small>${c.date}</small></div><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}`;
    return;
  }
  if (menuPage === 'install') {
    body.innerHTML = `<div class="mhead"><button class="mback" data-m="main">${icon('cross', 16)}</button><b>เพิ่มไปหน้าจอโฮม</b></div>
      ${standalone() ? '<p>เปิดจากหน้าจอโฮมอยู่แล้ว เล่นเต็มจอได้เลย</p>' : isIOS() ? `<ol class="msteps">
        <li>เปิดหน้านี้ใน <b>Safari</b></li>
        <li>แตะปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างจอ</li>
        <li>เลื่อนลงแล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b></li>
        <li>แตะ <b>เพิ่ม</b> — ไอคอนปรางค์ทองจะอยู่บนหน้าจอ เปิดแล้วเต็มจอเหมือนแอป</li></ol>` : installEvt
        ? `<p>ติดตั้งเกมไว้บนหน้าจอ เปิดได้ทันทีโดยไม่ต้องเข้าเว็บ</p><button class="gbtn" data-m="do-install">${icon('check', 20)}ติดตั้ง</button>`
        : '<p>เปิดเมนูของเบราว์เซอร์ (⋮) แล้วเลือก <b>เพิ่มลงในหน้าจอหลัก</b> หรือ <b>ติดตั้งแอป</b></p>'}
      <div class="mnote">${icon('scroll', 18)}<span><b>หมายเหตุ:</b> เกมที่เปิดจากไอคอนหน้าจอโฮมจะ<b>เก็บเซฟแยก</b>จากที่เล่นใน Safari จึงเริ่มเล่นเป็นเซฟใหม่ ไม่ใช่เซฟเดิม — ถ้าอยากเล่นเซฟเดิมต่อ ให้ใช้ “ย้ายเซฟ” ข้างล่าง</span></div>
      <div class="mlabel">ย้ายเซฟ</div>
      <ol class="msteps"><li>ในที่ที่มีเซฟเดิม กด <b>คัดลอกรหัสเซฟ</b> (หรือ <b>บันทึกเป็นไฟล์</b>)</li><li>เปิดเกมอีกที่ (เช่นจากหน้าจอโฮม) มาหน้านี้ กด <b>วางรหัส</b> แล้ว <b>โหลดเซฟนี้</b> (หรือ <b>เปิดไฟล์เซฟ</b>)</li></ol>
      <div class="mchips"><button class="gbtn" data-m="save-copy">${icon('scroll', 20)}คัดลอกรหัสเซฟ</button><button class="gbtn dark" data-m="save-file">${icon('pouch', 20)}บันทึกเป็นไฟล์</button></div>
      <textarea id="save-in" class="msave" rows="3" placeholder="วางรหัสเซฟที่นี่" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      <div class="mchips"><button class="gbtn dark" data-m="save-paste">${icon('scroll', 20)}วางรหัส</button><button class="gbtn" data-m="save-load">${icon('check', 20)}โหลดเซฟนี้</button></div>
      <label class="gbtn dark mfile">${icon('house', 20)}เปิดไฟล์เซฟ<input id="save-filein" type="file" accept=".txt,text/plain" hidden></label>
      <p id="save-msg" class="muted"></p>`;
    void prepareCode();
    ($('save-filein') as HTMLInputElement).addEventListener('change', async ev => {
      const f = (ev.target as HTMLInputElement).files?.[0]; if (f) await tryLoad(await f.text());
    });
    return;
  }
  const sp = SPEEDS.map((v, i) => `<button class="mchip ${i === speedIdx ? 'on' : ''}" data-m="speed" data-v="${i}"><b>×${th(v)}</b><small>${SPEED_LABEL[v] ?? ''}</small></button>`).join('');
  body.innerHTML = `<div class="mhead"><b>อโยธยา Idle</b><button class="mback" data-m="close">${icon('cross', 16)}</button></div>
    <button class="mrow" data-m="play">${icon(running ? 'pause' : 'play', 24)}<span>${running ? 'หยุดเวลา' : 'เล่นต่อ'}</span></button>
    <div class="mlabel">ความเร็ว</div><div class="mchips">${sp}</div>
    <div class="mlabel">เสียง</div><div class="mchips">
      <button class="mchip ${sound.sfx ? 'on' : ''}" data-m="sfx">${icon(sound.sfx ? 'speaker' : 'mute', 20)}<small>เสียงประกอบ</small></button>
      <button class="mchip ${sound.music ? 'on' : ''}" data-m="music">${icon('note', 20)}<small>เพลง</small></button></div>
    <button class="mrow" data-m="install">${icon('house', 24)}<span>เพิ่มไปหน้าจอโฮม</span></button>
    <button class="mrow" data-m="log">${icon('scroll', 24)}<span>มีอะไรใหม่</span><small>v${VERSION}</small></button>
    ${IS_DEV ? `<button class="mrow" data-m="dev">${icon('star', 24)}<span>แผงนักพัฒนา</span><small>dev</small></button>` : ''}
    <button class="mrow danger" data-m="quit">${icon('cross', 24)}<span>บันทึกและปิดเกม</span></button>`;
}
// ---------- แผงนักพัฒนา (เฉพาะ ?dev) ----------
function devPage(): string {
  const L = g.life, age = E.ageOf(L);
  const chip = (a: string, v: string | number, label: string, on = false) => `<button class="mchip dv ${on ? 'on' : ''}" data-m="dev" data-a="${a}" data-v="${v}"><small>${esc(label)}</small></button>`;
  const row = (title: string, chips: string) => `<div class="mlabel">${esc(title)}</div><div class="mchips">${chips}</div>`;
  const careers = content.careers.careers.map(c => chip('career', c.key, c.key, L.career === c.key)).join('');
  const kids = content.childJobs.map(j => chip('child', j.key, j.key, L.childJob === j.key)).join('');
  const levels = [0, 1, 2, 5, 8, 11, 14, 17, 19].map(n => chip('level', n, `Lv.${n}`, L.level === n)).join('');
  const anims = Object.keys(Scene.ANIMS).map(a => chip('anim', a, a)).join('');
  const hist = ['L1-H02', 'L2-H04', 'L4-H09'].map(id => chip('hist', id, id)).join('');
  const games = Object.keys(TASK_GAMES).map(k => chip('game', k, TASK_GAMES[k].title)).join('');
  const pets = BREEDS.map(b => chip('pet', b.key, b.name, g.pet?.breed === b.key)).join('') + chip('pet', '', 'ไม่มี');
  return `<div class="mhead"><button class="mback" data-m="main">${icon('cross', 16)}</button><b>แผงนักพัฒนา</b></div>
    <p class="muted">อายุ ${th(age)} · ${esc(L.career ?? L.childJob ?? '-')} Lv.${th(L.level)} ${esc(L.track ?? '')} · บ้าน ${th(L.accommodation)} · บริวาร ${th(L.retainer)} · บาป ${th(L.sin.toFixed(1))}</p>
    ${row('ข้ามเวลา (เดินเวลาจริง เหตุการณ์ค้างไว้ให้เลือก)', chip('adv', 30, '+๑ เดือน') + chip('adv', 365, '+๑ ปี') + chip('adv', 3650, '+๑๐ ปี'))}
    ${row('กระโดดไปอายุ (ข้ามทันที ไม่เกิดเหตุการณ์ระหว่างทาง)', [9, 12, 18, 30, 45, 55, 65].map(a => chip('age', a, String(a), age === a)).join(''))}
    ${row('อาชีพ', careers)}${row('งานเด็ก', kids)}
    ${row('ยศ', levels)}${row('ทาง', chip('track', 'light', 'สว่าง', L.track === 'light') + chip('track', 'dark', 'มืด', L.track === 'dark'))}
    ${row('ที่พำนัก', [0, 1, 2, 3, 4, 5].map(n => chip('acc', n, String(n), L.accommodation === n)).join(''))}
    ${row('บริวาร', [0, 1, 2, 3, 4, 5, 6].map(n => chip('ret', n, String(n), L.retainer === n)).join(''))}
    ${row('ค่าต่างๆ', chip('res', 'money', 'เงินเยอะ') + chip('res', 'merit', 'บุญ +๕๐๐๐') + chip('res', 'aff', 'ความชอบพอเลื่อนยศ') + chip('res', 'stats', 'สเตตัส ๙๐%') + chip('res', 'hp1', 'สุขภาพเต็ม') + chip('res', 'hp0', 'สุขภาพต่ำ') + chip('res', 'joy1', 'สำราญเต็ม') + chip('res', 'joy0', 'สำราญต่ำ') + chip('res', 'sin0', 'บาป ๐') + chip('res', 'sin99', 'บาป ๙๙'))}
    ${row('เรียกเหตุการณ์', chip('ev', 'work', 'กงการ') + chip('ev', 'karma', 'กงกรรม') + chip('ev', 'fun', 'สันทนาการ') + chip('ev', 'health', 'สุขภาพ') + hist)}
    ${row('ยมโลก (ดูอย่างเดียว ไม่ตาย)', chip('yama', 'heaven', 'สวรรค์') + chip('yama', 'human', 'แดนรอเกิด') + chip('yama', 'preta', 'เปรต') + chip('yama', 'hell', 'นรก'))}
    ${row('ราชกิจ', chip('tasks', 'fill', 'เติมงานค้างเต็ม') + chip('tasks', 'angry', 'กองเต็ม+นายไม่พอใจ') + chip('tasks', 'zero', 'ล้างงาน'))}
    ${row('ลองมินิเกม (ไม่ได้รางวัล ไม่หักงาน) · ใช้ยศ/ทางปัจจุบัน', games)}
    ${row('ฉาก', chip('place', 'in', 'เข้าบ้าน') + chip('place', 'work', 'ที่ทำงาน') + chip('place', 'out', 'นอกบ้าน') + chip('place', 'rain', 'ฝนตก/หยุด'))}
    ${row('ท่าทาง', anims)}
    ${row('สัตว์เลี้ยง', pets)}${row('วัยสัตว์', chip('petage', 0.5, 'เด็ก') + chip('petage', 8, 'โต') + chip('petage', 25, 'แก่'))}
    ${row('อื่นๆ', chip('reset', '', 'รีเซ็ตเซฟ'))}`;
}
let devRain = false;
function devAct(a: string, v: string) {
  const L = g.life;
  const affStep = () => Math.max(0.5, E.affectionReq(L.level + 1) - E.affectionReq(L.level));
  switch (a) {
    case 'adv': E.advance(g, +v, { online: false }); break;
    case 'age': L.day = Math.max(0, (+v - B.startAge) * B.daysPerYear); L.tasks = undefined; if (+v < B.careerMinAge) { L.career = null; L.level = 0; L.track = null; L.childJob ??= content.childJobs[0].key; } break;
    case 'career': if (E.ageOf(L) < B.careerMinAge) L.day = (B.careerMinAge - B.startAge) * B.daysPerYear; L.career = v; L.level = 0; L.track = null; L.tasks = undefined; break;
    case 'child': L.day = Math.min(L.day, (B.careerMinAge - B.startAge) * B.daysPerYear - 1); L.childJob = v; L.career = null; L.level = 0; L.track = null; L.tasks = undefined; break;
    case 'level': if (!L.career) break; L.level = +v; if (L.level >= B.lightDarkLevel && !L.track) L.track = 'light'; if (L.level < B.lightDarkLevel) L.track = null; break;
    case 'track': if (L.career && L.level >= B.lightDarkLevel) L.track = v as 'light' | 'dark'; break;
    case 'acc': L.accommodation = +v; break;
    case 'ret': L.retainer = +v; break;
    case 'res':
      if (v === 'money') L.money += E.promoteCost(L.level) * 20 + 100;
      if (v === 'merit') g.merit += 5000;
      if (v === 'aff') L.affection = Math.max(L.affection, E.affectionReq(L.level + 1) + affStep());
      if (v === 'stats') for (const k of E.STAT_KEYS) L.stats[k] = Math.max(L.stats[k], L.cap * 0.9);
      if (v === 'hp1') L.health = 1; if (v === 'hp0') L.health = 0.15;
      if (v === 'joy1') L.joy = 1; if (v === 'joy0') L.joy = 0.1;
      if (v === 'sin0') L.sin = 0; if (v === 'sin99') L.sin = 99;
      break;
    case 'ev': {
      if (v === 'work') {
        const pool = content.work.filter(w => w.career === L.career && w.tier === E.workTier(L.level));
        if (pool.length) g.queue.push({ kind: 'karma', id: pool[Math.floor(Math.random() * pool.length)].id, generic: true }); else toast('ต้องมีอาชีพก่อน', 'cross');
      } else {
        const pool = content.karmaGeneric.filter(k => v === 'karma' ? !k.tag : k.tag === v);
        g.queue.push({ kind: 'karma', id: pool[Math.floor(Math.random() * pool.length)].id, generic: true });
      }
      closeMenu(); break;
    }
    case 'hist': g.queue.push({ kind: 'hist', id: v }); closeMenu(); break;
    case 'yama': {
      const keep = { sin: L.sin, ms: L.meritStart };
      if (v === 'heaven') { L.sin = 0; L.meritStart = g.merit - 1000; }
      if (v === 'human') { L.sin = 10; }
      if (v === 'preta') { L.sin = 40; }
      if (v === 'hell') { L.sin = 99; }
      closeMenu(); yama(true); L.sin = keep.sin; L.meritStart = keep.ms; return;
    }
    case 'tasks':
      if (!E.taskKind(L)) { toast('งานนี้ยังไม่มีมินิเกม', 'cross'); break; }
      L.tasks ??= { n: 0, next: L.day + 12, fullSince: null };
      if (v === 'fill') { L.tasks.n = B.taskCap; L.tasks.fullSince = L.day; }
      if (v === 'angry') { L.tasks.n = B.taskCap; L.tasks.fullSince = L.day - B.taskAngryAfter - 1; }
      if (v === 'zero') { L.tasks.n = 0; L.tasks.fullSince = null; }
      break;
    case 'game': closeMenu(); runTask(v, E.workTier(L.level), (L.track ?? null) as 'light' | 'dark' | null, sc => { if (sc != null) toast(`คะแนน ${th(Math.round(sc * 100))}% (โหมดลอง ไม่ได้รางวัล)`, 'check'); }); return;
    case 'place': closeMenu();
      if (v === 'in') scene.showAnim('read', 8);
      else if (v === 'work') { const w = scene.workAnimId(L); if (!w || !scene.showAnim(w, 8)) toast('ฉากที่ทำงานใช้ตอนเป็นผู้ใหญ่มีอาชีพ', 'cross'); }
      else if (v === 'rain') { devRain = !devRain; toast(devRain ? 'บังคับฝนตก' : 'เลิกบังคับฝน', 'check'); }
      else scene.showAnim('happy', 1);
      return;
    case 'anim': closeMenu(); if (!scene.showAnim(v, 8)) toast(`ท่า ${v} ยังไม่มีภาพ`, 'cross'); return;
    case 'pet': g.pet = v ? { breed: v, name: g.pet?.name ?? 'ทดสอบ', born: g.clock - 8 * B.daysPerYear, lifespan: 40, full: 1, bond: 0.6, trained: 0.3, lastFed: g.clock, lastTrained: 0, playsToday: 0, playDay: 0 } : null; break;
    case 'petage': if (g.pet) g.pet.born = g.clock - +v * B.daysPerYear; break;
    case 'reset': store()?.removeItem(SAVE_KEY); location.reload(); return;
  }
  lifebarFor = ''; save(); renderHud(); renderTab(); renderMenu();
}
function openMenu() { menuPage = 'main'; renderMenu(); $('menu').classList.add('show'); S.playTap(); }
function closeMenu() { $('menu').classList.remove('show'); }
$('btn-menu').addEventListener('click', openMenu);
$('menu').addEventListener('click', ev => {
  if (ev.target === $('menu')) { closeMenu(); return; }
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-m]'); if (!b) return;
  const m = b.dataset.m!;
  if (m === 'close') { closeMenu(); return; }
  if (m === 'main' || m === 'log' || m === 'install' || (m === 'dev' && !b.dataset.a)) { menuPage = m as typeof menuPage; S.playTap(); renderMenu(); return; }
  if (m === 'dev' && IS_DEV) { S.playTap(); devAct(b.dataset.a!, b.dataset.v ?? ''); return; }
  if (m === 'play') { running = !running; S.playTap(); renderHud(); renderTab(); renderMenu(); return; }
  if (m === 'speed') { speedIdx = +b.dataset.v!; if (!running) running = true; S.playSelect(); renderHud(); renderMenu(); return; }
  if (m === 'sfx' || m === 'music') {
    S.unlockAudio();
    if (m === 'sfx') sound.sfx = !sound.sfx; else setMusic(!sound.music);
    try { store()?.setItem('ayothaya.sound', JSON.stringify({ sfx: sound.sfx, music: sound.music })); } catch { /* ignore */ }
    S.playTap(); renderMenu(); return;
  }
  if (m === 'save-copy' || m === 'save-file') {
    const msg = $('save-msg');
    if (!readyCode) { msg.textContent = 'กำลังเตรียมรหัส ลองกดอีกครั้ง'; void prepareCode(); return; }
    const code = readyCode;
    if (m === 'save-file') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      a.download = `ayothaya-save-${new Date().toISOString().slice(0, 10)}.txt`; document.body.appendChild(a); a.click(); a.remove();
      msg.textContent = 'บันทึกไฟล์แล้ว (บน iPhone อยู่ในแอปไฟล์ › ดาวน์โหลด) — เปิดเกมอีกที่แล้วกด “เปิดไฟล์เซฟ”';
      S.playTap(); return;
    }
    const ta = $('save-in') as HTMLTextAreaElement;
    const manual = () => { ta.value = code; ta.focus(); ta.setSelectionRange(0, code.length); msg.textContent = 'คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ช่องแล้วเลือก “คัดลอก” (ต้องเลือกทั้งหมด) หรือใช้ “บันทึกเป็นไฟล์”'; };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => { msg.textContent = `คัดลอกแล้ว (${code.length.toLocaleString()} ตัวอักษร) — ไปวางในเกมอีกที่ได้เลย`; }, manual);
    else manual();
    S.playTap(); void prepareCode(); return;
  }
  if (m === 'save-paste') {
    const ta = $('save-in') as HTMLTextAreaElement;
    if (navigator.clipboard?.readText) navigator.clipboard.readText().then(t => { ta.value = t; void tryLoad(t); }, () => { $('save-msg').textContent = 'อ่านคลิปบอร์ดไม่ได้ — กดค้างที่ช่องแล้วเลือก “วาง” แทน'; ta.focus(); });
    else ta.focus();
    return;
  }
  if (m === 'save-load') {
    const txt = ($('save-in') as HTMLTextAreaElement).value;
    if (!txt.trim()) { $('save-msg').textContent = 'ยังไม่ได้วางรหัส'; return; }
    void tryLoad(txt); return;
  }
  if (m === 'do-install' && installEvt) { installEvt.prompt(); installEvt = null; renderMenu(); return; }
  if (m === 'quit') {
    save(); running = false; closeMenu(); renderHud();
    window.close(); // ปิดได้เฉพาะบางกรณี (เช่นหน้าต่างที่สคริปต์เปิด) — ถ้าปิดไม่ได้ แสดงหน้าพักเกมแทน
    openModal(`<span class="kind">${icon('check', 16)}บันทึกแล้ว</span><h2>พักเกมไว้ก่อน</h2><p>บันทึกเรียบร้อย ปัดแอปหรือปิดแท็บนี้ได้เลย · กลับมาเมื่อไร เวลาที่ผ่านไประหว่างนั้นก็นับต่อให้</p><button class="choice go" data-act="close">เล่นต่อ</button>`);
  }
});

/** แผงสัตว์เลี้ยงในแท็บค่าพลัง */
const PET_STAGE = ['วัยเด็ก', 'วัยโต', 'วัยชรา'];
function petPanel(): string {
  const p = g.pet;
  if (!p) return `${sec('สัตว์เลี้ยง')}<div class="frame"><p class="muted">ยังไม่มีสัตว์เลี้ยง — รับมาเลี้ยงได้ที่ตลาด หมวดสัตว์เลี้ยง</p>${g.petGraves.length ? `<button class="gbtn dark" data-act="coll" data-v="pets">${icon('lotus', 18)}สวนสวรรค์สัตว์เลี้ยง</button>` : ''}</div>`;
  const b = breedOf(p.breed), age = petAge(p, g.clock), st = petStage(p, g.clock);
  const bar = (ic: string, label: string, v: number) => `<div class="req ${v > 0.5 ? 'ok' : ''}">${icon(ic, 20)}<div class="meter"><i style="width:${(v * 100).toFixed(0)}%"></i></div><span>${label}</span><span></span></div>`;
  const ready = E.trainReady(g), wait = Math.max(0, B.petTrainCooldown - (g.clock - p.lastTrained));
  return `${sec('สัตว์เลี้ยง', '', 'pet')}${helpBox('pet', `ให้อาหารทุกไม่กี่วันไม่ให้หิว · แตะสัตว์ในฉากเพื่อเล่นด้วย (ได้ผลวันละ ๓ ครั้ง) · ฝึกได้ทุก ๗ วัน<br>ยิ่งผูกพันและฝึกมาก บัฟยิ่งแรง · ถ้าหิวนาน ความผูกพันจะลดลง<br>สัตว์ตามเจ้าของไปเกิดชาติหน้าด้วย จนกว่าจะสิ้นอายุขัย`)}
    <div class="frame"><div class="rank">${icon('paw', 40)}<div><small>${esc(b.name)} · ${PET_STAGE[st]} · อายุ ${th(Math.floor(age))} ปี</small><b>${esc(p.name)}</b></div></div>
      ${bar('pouch', 'อิ่ม', p.full)}${bar('heart', 'ผูกพัน', p.bond)}${bar('star', 'ฝึก', p.trained)}
      <div class="forks"><button class="gbtn" data-act="petfeed" ${p.full > 0.95 ? 'disabled' : ''}>${icon('coin', 18)}ให้อาหาร <small>${baht(feedPrice(E.dailyIncome(g)), 1)}</small></button>
      <button class="gbtn dark" data-act="pettrain" ${ready ? '' : 'disabled'}>${icon('star', 18)}${ready ? 'ฝึก' : `ฝึกได้อีก ${th(wait)} วัน`}</button></div>
      <div class="forks"><button class="gbtn dark" data-act="petname">ตั้งชื่อ</button><button class="gbtn dark" data-act="coll" data-v="pets">สวนสวรรค์</button></div>
    </div>`;
}
function petNameSheet() {
  const p = g.pet!; const b = breedOf(p.breed);
  openModal(`<span class="kind">${icon('paw', 16)}${esc(b.name)}</span><h2>ตั้งชื่อสัตว์เลี้ยง</h2>
    <div class="namebox"><input id="pn" maxlength="20" value="${esc(p.name)}" aria-label="ชื่อสัตว์"></div>
    <button class="gbtn" data-act="petname-ok">${icon('check', 20)}ตกลง</button>`);
  setTimeout(() => ($('pn') as HTMLInputElement)?.select(), 50);
}
/** มินิเกมฝึกสัตว์: แตะตอนเครื่องหมายอยู่ในช่องทอง 5 ครั้ง */
let petTrain: { hits: number; tries: number; zone: number; t0: number; raf: number } | null = null;
function petTrainSheet() {
  const p = g.pet!;
  petTrain = { hits: 0, tries: 0, zone: 0.2 + Math.random() * 0.6, t0: performance.now(), raf: 0 };
  openModal(`<span class="kind">${icon('star', 16)}ฝึก${esc(p.name)}</span><h2>เรียกให้ทำตาม!</h2>
    <p class="muted">แตะตอนเครื่องหมายอยู่ในช่องทอง · ${th(5)} ครั้ง</p>
    <div class="ybar"><i class="yzone"></i><i class="ymark"></i></div><div class="ycount"></div>
    <button class="gbtn red ytap" data-act="pettap">${icon('paw', 20)}เรียก!</button>`);
  const tick = () => {
    if (!petTrain) return;
    const m = (Math.sin((performance.now() - petTrain.t0) / 1000 * 2.4) + 1) / 2;
    const mk = document.querySelector<HTMLElement>('.modal .ymark'), z = document.querySelector<HTMLElement>('.modal .yzone'), cnt = document.querySelector<HTMLElement>('.modal .ycount');
    if (!mk) { petTrain = null; return; }
    mk.style.left = `${(m * 100).toFixed(1)}%`; mk.dataset.m = String(m);
    if (z) { z.style.left = `${((petTrain.zone - 0.12) * 100).toFixed(1)}%`; z.style.width = '24%'; }
    if (cnt) cnt.innerHTML = `${icon('check', 16)} ${th(petTrain.hits)} &nbsp; ${icon('cross', 16)} ${th(petTrain.tries - petTrain.hits)}`;
    petTrain.raf = requestAnimationFrame(tick);
  };
  tick();
}
function graveList(): string {
  return g.petGraves.length ? `<ul class="ladder">${g.petGraves.map(x => `<li><small>${esc(breedOf(x.breed).name)} · จากไปเมื่อ พ.ศ. ${th(x.year)} อายุ ${th(x.age)} ปี</small><b>${icon('lotus', 14)} ${esc(x.name)}</b></li>`).join('')}</ul>` : '<p class="muted">ยังไม่มีสัตว์เลี้ยงที่จากไป</p>';
}

/** ตั้งชื่อตัวละคร (เริ่มเกม/เกิดใหม่/เปลี่ยนชื่อ) */
function nameSheet() {
  const L = g.life, sug = L.name;
  openModal(`<span class="kind">${icon('person', 16)}${L.idx === 1 && g.loop === 1 && !L.named ? 'เด็กน้อยแห่งหนองโสน' : `ชาติที่ ${th(L.idx)}`}</span>
    <h2>ตั้งชื่อตัวละคร</h2>
    <p class="muted">ชื่อนี้ใช้ตลอดชาตินี้ · ชาติหน้าตั้งใหม่ได้</p>
    <div class="namebox"><input id="nm" maxlength="20" value="${esc(sug)}" aria-label="ชื่อ"><button class="choice" data-act="name-rand"><span class="n">${icon('star', 16)}</span><span>สุ่ม</span></button></div>
    <button class="gbtn" data-act="name-ok">${icon('check', 20)}ตกลง</button>`);
  setTimeout(() => ($('nm') as HTMLInputElement)?.select(), 50);
}

/** คำในตัวเลือก → ท่าของตัวละคร (เรียงจากเจาะจงไปกว้าง) */
const ANIM_WORDS: [RegExp, string][] = [
  [/กวาด|ทำความสะอาด/, 'sweep'],
  [/ของป่า|เห็ด|สมุนไพร|เก็บผัก|หาปลา|หาอาหาร|หมอยา|รักษา/, 'forage'],
  [/หาบ|ขนสินค้า|คาราวาน|ค้าขาย|ขายของ|ตั้งแผง|ขายเสบียง|ซื้อ|สินค้า|สำเภา/, 'pole'],
  [/คาถา|เวท|อาคม|ยันต์|เครื่องราง|ของขลัง|พิธี|เทียน|ปัดรังควาน|บูชา/, 'candle'],
  [/สมาธิ|สวดมนต์|ภาวนา|ไหว้|ทำบุญ|ถวาย|บวช|ธรรม|ธุดงค์|สรงน้ำ|รดน้ำ|สาบาน|ใส่บาตร/, 'meditate'],
  [/หนี|หลบ|ซ่อน|แอบ|ย่อง|สะกดรอย|สอดแนม|สืบ|เลี่ยง|ปลีกตัว/, 'sneak'],
  [/สู้|ดวล|ตอบโต้|ไล่|ต่อย|ฟัน|รบ|ปราบ|ป้องกัน|อาวุธ|ฝึกท่า|กลศึก|ตามล่า/, 'staff'],
  [/อ่าน|เรียน|ศึกษา|ตำรา|จด|คัดลอก|สอบถาม|ขอดู|หลักฐาน|ภาษา|ตรวจ|สอน|วิชา/, 'read'],
  [/แบก|ขน|แรงงาน|ช่วยแรง|ทำงาน|รับงาน|ยก|ลาก|พาย|ช่วยเพื่อนบ้าน|ขุด|สร้าง|ร่างกาย|แข็งแรง|ที่นา|ทำกิน|เสบียง/, 'carry'],
];
const WORK_TIER = ['ชั้นผู้น้อย', 'ชั้นกลาง', 'ชั้นสูง', 'ชั้นยอด'];
function animForLabel(label: string): string | null {
  for (const [re, id] of ANIM_WORDS) if (re.test(label)) return id;
  return null;
}

/** ฉากหลังความตาย · preview = ลองดูเฉยๆ ไม่จบชาติจริง */
function yama(preview: boolean) {
  inAfterlife = true;
  runAfterlife(g, { preview, onDone: years => {
    inAfterlife = false;
    if (preview) return;
    const y = E.rebirthYear(g, years);
    E.resolveEvent(g, years); lifebarFor = ''; save(); renderHud(); renderTab();
    toast(`เกิดใหม่ พ.ศ. ${th(y)} เป็นชาติที่ ${th(g.life.idx)}`, 'lotus');
  } });
}

let healthWarned = false;
function healthWarn() {
  const h = g.life.health;
  if (h < 0.3 && !healthWarned) { healthWarned = true; toast('สุขภาพเริ่มทรุด — บ้านดีและร่างกายแข็งแรงช่วยให้อยู่ได้นานขึ้น', 'heart'); }
  if (h > 0.5) healthWarned = false;
}

function celebrate(title: string) {
  scene.celebrate(); S.playFanfare();
  const el = $('banner');
  el.innerHTML = `<small>เลื่อนยศเป็น</small><b>${esc(splitTitle(title)[0])}</b>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

let toastTimer = 0;
function toast(msg: string, ic = '') {
  const t = $('toast'); t.innerHTML = `${ic ? icon(ic, 22) : ''}<span>${esc(msg)}</span>`; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('show'), 2800);
}

setInterval(save, 10000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ไอคอนคงที่ในหน้า
$('ic-money').innerHTML = icon('coin', 22); $('ic-merit').innerHTML = icon('lotus', 22); $('ic-aff').innerHTML = icon('medal', 22); $('ic-hp').innerHTML = icon('heart', 18); $('ic-joy').innerHTML = icon('smile', 18);
document.querySelectorAll<HTMLElement>('[data-ic]').forEach(el => { el.outerHTML = icon(el.dataset.ic!, 28); });

renderHud(); renderTab();
if (sliceDone) showSliceEnd(); else showAway();
requestAnimationFrame(frame);
