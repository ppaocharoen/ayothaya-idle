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
import { CAREER_ICON, CHILD_ICON, PATH_ICON, STAT_ICON, icon } from './icons';

const SAVE_KEY = 'ayothaya.save.v1';
const SPEEDS = location.search.includes('dev') ? [1, 10, 100, 3000] : [1, 10, 100];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const statDef = (k: string) => content.stats.find(s => s.key === k);
const statName = (k: string) => statDef(k)?.display ?? k;
const careerOf = (k: string) => content.careers.careers.find(c => c.key === k)!;
/** ชื่อยศในข้อมูลมีคำอธิบายต่อท้าย → แยกเป็น [ชื่อสั้น, คำอธิบาย] */
const splitTitle = (t: string): [string, string] => { const i = t.indexOf(' '); return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, '']; };
const clean = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); // ตัดวงเล็บภาษาอังกฤษในชื่อของ

// ---------- โหลด/เซฟ ----------
function store(): Storage | null { try { return window.localStorage; } catch { return null; } }
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
  if (running && !g.queue.length && !sliceDone) {
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
  if (g.queue.length && !inAfterlife && !$('modal').classList.contains('show')) showEvent();
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
  return { dayFrac: running && !g.queue.length ? acc / B.secondsPerGameDay : 0.4, month, rain: month >= 5 && month <= 10 && rainDay, war };
}

// ---------- ตัวเลขลอยขึ้นจากตัวละคร ----------
interface Snap { life: number; money: number; merit: number; aff: number; stats: Record<string, number>; }
interface Delta { key: string; label: string; v: number; text: string; kind: string; }
function snap(): Snap {
  const L = g.life, stats: Record<string, number> = {};
  for (const k of E.STAT_KEYS) stats[k] = L.stats[k] / L.cap;
  return { life: L.idx, money: L.money, merit: g.merit, aff: L.affection, stats };
}
const iconOf = (key: string) => key === 'money' ? 'coin' : key === 'merit' ? 'lotus' : key === 'aff' ? 'heart' : STAT_ICON[key] ?? 'star';
/** ผลต่างก่อน/หลัง (ใช้ทั้งตัวเลขลอยและป๊อปอัพผลลัพธ์) */
function diff(a: Snap): Delta[] {
  const b = snap(), out: Delta[] = [];
  if (a.life !== b.life) return out;
  for (const k of E.STAT_KEYS) { const d = b.stats[k] - a.stats[k]; if (Math.abs(d) > 1e-7) out.push({ key: k, label: statName(k), v: d, text: `${d > 0 ? '+' : '−'}${pctAuto(Math.abs(d))}`, kind: 'stat' }); }
  const dm = b.money - a.money; if (Math.abs(dm) > 1e-7) out.push({ key: 'money', label: 'เงิน', v: dm, text: `${dm > 0 ? '+' : '−'}${baht(Math.abs(dm), 1)}`, kind: 'money' });
  const db = b.merit - a.merit; if (db > 1e-6) out.push({ key: 'merit', label: 'บุญ', v: db, text: `+${th(db < 1 ? db.toFixed(2) : db.toFixed(1))}`, kind: 'merit' });
  const da = b.aff - a.aff; if (Math.abs(da) > 1e-6) out.push({ key: 'aff', label: 'ความชอบ', v: da, text: `${da > 0 ? '+' : '−'}${th(Math.abs(da).toFixed(2))}`, kind: 'aff' });
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
}

// ---------- HUD ----------
let hudKey = '';
function renderHud() {
  const L = g.life, r = E.reignAt(g), age = E.ageOf(L);
  $('hud-life').textContent = `ชาติที่ ${th(L.idx)} · อายุ ${th(age)}`;
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
  $('btn-play').innerHTML = icon(running ? 'pause' : 'play', 24);
  $('btn-speed').textContent = `×${th(SPEEDS[speedIdx])}`;
  $('btn-sound').innerHTML = icon(sound.music ? 'note' : sound.sfx ? 'speaker' : 'mute', 24);
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
  return `${work}
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
  return `${sec('ยศถัดไป', '', 'rank')}${helpBox('rank', `ต้องครบทั้ง ๓ อย่าง:<br>${icon(STAT_ICON[c.gateStat], 16)} ${statName(c.gateStat)} ผสม ${statName(c.secondaryStat)} (หลักมีน้ำหนักมากกว่า)<br>${icon('heart', 16)} ความชอบสะสม — ได้จากการทำงาน เหตุการณ์ และงานบุญใหญ่<br>${icon('coin', 16)} ค่ายื่นเรื่อง<br>${icon('house', 16)} ยศขั้น ๗, ๑๑, ๑๕ ต้องมีบ้านสมฐานะ (เรือนไทย ตึก จวน)<br>ยื่นแล้วยังมีโอกาสไม่ผ่าน ถ้าไม่ผ่านต้องรอสักพัก`)}
    <div class="frame"><div class="rank" data-act="careerinfo" data-v="${L.career}">${icon(cic, 44)}<div><small>ขั้นที่ ${th(t)}</small><b>${esc(splitTitle(E.careerTitle(L.career!, t, L.track))[0])}</b><small>${esc(splitTitle(E.careerTitle(L.career!, t, L.track))[1])}</small></div></div>
      ${req(STAT_ICON[c.gateStat], gv >= gn, gv / gn, `${pct(gv)}/${pct(gn)}`)}
      ${req('heart', L.affection >= aff, L.affection / aff, `${th(L.affection.toFixed(1))}/${th(aff.toFixed(1))}`)}
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
  out.push({ title: 'ของใช้', sub: 'ซื้อซ้ำได้', list: sh.commonItems.map((m, i) => ({ id: `common:${i}`, ic: STAT_ICON[m.stat] ?? 'pouch', name: clean(m.name), story: m.story ?? m.desc, effs: [[STAT_ICON[m.stat], `${statName(m.stat)} +${pctAuto(0.004)}`], ...(m.legacyAffection ? [['heart', 'ความชอบ +๐.๓'] as [string, string]] : [])], price: E.commonPrice(L, i), act: 'common', v: String(i), lv: L.common[i] ? `×${th(L.common[i])}` : '' })) });
  out.push({ title: 'งานบุญใหญ่', sub: '', list: B.megaProjects.map(m => ({ id: `mega:${m.id}`, ic: 'temple', name: m.name, story: 'สร้างถาวรวัตถุถวายวัด ชื่อจารึกไว้ให้คนรุ่นหลังรู้', effs: [['lotus', `บุญ +${thInt(m.merit)}`], ['heart', `ความชอบ +${th(m.affection)}`]] as [string, string][], price: m.price * Math.pow(1.5, L.mega[m.id] ?? 0), act: 'mega', v: m.id, lv: L.mega[m.id] ? `×${th(L.mega[m.id])}` : '' })) });
  return out;
}
function shopTab(): string {
  const L = g.life;
  return `<div class="purse">${icon('coin', 20)}${baht(L.money, 3)}</div>` + wares().map(s => sec(s.title, s.sub) + `<div class="shopgrid">${s.list.map(w => {
    const locked = w.req != null, can = !locked && w.price != null && L.money >= w.price;
    const price = w.price == null ? 'ครบแล้ว' : locked ? `${icon('lock', 13)}${w.req! < 0 ? 'ยังเด็ก' : `ยศขั้น ${th(w.req!)}`}` : `${icon('coin', 13)}${baht(w.price, 1)}`;
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
    ${w.price == null ? '<p class="muted">ซื้อครบทุกระดับแล้ว</p>' : `<button class="gbtn" data-act="${w.act}" data-v="${w.v}" ${can ? '' : 'disabled'}>${icon('coin', 20)}${baht(w.price)}${can || locked ? '' : ' <small>(เงินไม่พอ)</small>'}</button>
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
  return `${sec('ร่างกาย')}${health}${sec('ค่าพลัง', `เพดาน ${th(L.cap)}`, 'stats')}${helpBox('stats', 'แตะแต่ละแถวเพื่อดูว่าค่านั้นใช้ทำอะไร · ค่าแสดงเป็น % ของเพดานชาตินี้ (ชาติต่อไปเพดานสูงขึ้น)')}${bars}
    ${sec('สมุดสะสม', 'แตะเพื่อเปิดดู')}<div class="coll"><div data-act="coll" data-v="titles"><b>${th(coll.titles.length)}</b><small>ยศที่เคยได้</small></div><div data-act="coll" data-v="choices"><b>${th(Object.keys(coll.choices).length)}</b><small>เหตุการณ์ที่เลือก</small></div><div data-act="coll" data-v="family"><b>${th(coll.family.length)}</b><small>ชาติที่บันทึก</small></div></div>
    <div class="foot"><a href="./content.html">คลังเนื้อหา</a> · ชิ้นทดลอง ชาติ ๑ อายุ ๙–๒๐</div>`;
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
    const risky = 'risky' in d && d.risky ? choiceBtn(n + 1, d.risky.label, 'risky', `<small>เสี่ยงดวง · โอกาส ${pct(d.risky.chance)}</small>`, 'risky') : '';
    openModal(`${head}<span class="kind">${icon('bell', 16)}กงกรรม</span><h2>${esc(d.title)}</h2>
      ${d.choices.map((c, i) => choiceBtn(i + 1, c.label, String(i))).join('')}${risky}`);
    return;
  }
  if (e.kind === 'hist') {
    const h = content.historical.find(x => x.id === e.id)!;
    let body = `${head}<span class="kind hist">${icon('scroll', 16)}พงศาวดาร</span><h2>${esc(h.title)}</h2>${h.desc ? `<p>${esc(h.desc)}</p>` : ''}`;
    if (h.kind === 'choice') body += h.choices!.map((c, i) => choiceBtn(i + 1, c.label, String(i))).join('');
    else if (h.kind === 'check') {
      const p = Math.min(B.checkMax, B.checkBase + B.checkSlope * E.frac(L, h.checkStat!));
      body += `<div class="odds">${icon(STAT_ICON[h.checkStat!], 30)}<div>ใช้${esc(statName(h.checkStat!))}<br><small class="muted">ผ่าน: ความชอบเพิ่ม · พลาด: เสียทรัพย์ ${pct(B.checkFailLoss)}</small></div><b>${pct(p)}</b></div>
        <button class="choice go" data-act="resolve-check">${icon('sword', 20)}รับมือ</button>`;
    } else body += `<button class="choice go" data-act="resolve" data-label="">รับทราบ</button>`;
    openModal(body);
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
    <p>${awayInfo.eff < 1 ? `ตอนไม่อยู่ได้ผล ${th(Math.round(awayInfo.eff * 100))}% ของตอนเล่นเอง — บ้านดีขึ้นได้ผลมากขึ้น · ` : ''}${awayInfo.auto ? `กงกรรม ${th(awayInfo.auto)} เรื่องตัดสินใจไปตามแนวทางชีวิตแล้ว` : 'ไม่มีกงกรรมที่ต้องตัดสินใจแทน'}${g.queue.length ? ` · มี ${th(g.queue.length)} เรื่องรอท่านอยู่` : ''}</p>
    <button class="choice go" data-act="close">ไปต่อ</button>`);
  awayInfo = null;
}

function careerSheet(k: string, choose = true): string {
  const c = careerOf(k), L = g.life, mine = L.career === k;
  const t = (lv: number, tr: 'light' | 'dark') => splitTitle(E.careerTitle(k, lv, tr))[0];
  const step = (label: string, title: string, on = false) => `<li class="${on ? 'on' : ''}"><small>${label}</small>${esc(title)}</li>`;
  return `<button class="close" data-act="close" aria-label="ปิด">${icon('cross', 16)}</button>
    <div class="head">${icon(CAREER_ICON[k] ?? 'star', 48)}<div><div class="eyebrow">${esc(c.fullname)}</div><h2>${esc(k)}</h2></div></div>
    ${c.desc ? `<p>${esc(c.desc)}</p>` : ''}
    <div class="effs"><span>${icon(STAT_ICON[c.gateStat], 18)}หลัก ${esc(statName(c.gateStat))}</span><span>${icon(STAT_ICON[c.secondaryStat], 18)}รอง ${esc(statName(c.secondaryStat))}</span></div>
    <h3 class="sh">เส้นทางยศ</h3>
    <ul class="ladder">
      ${step('เริ่ม', t(0, 'light'), mine && L.level === 0)}${step('ขั้น ๑', t(1, 'light'), mine && L.level === 1)}
      ${mine && L.level >= B.lightDarkLevel ? step(`ตอนนี้ · ขั้น ${th(L.level)}`, t(L.level, L.track ?? 'light'), true) : ''}
    </ul>
    <div class="forkline"><div><small>${icon('star', 14)}ทางสว่าง สูงสุด</small>${esc(t(B.maxLevel, 'light'))}</div><div><small>${icon('hood', 14)}ทางมืด สูงสุด</small>${esc(t(B.maxLevel, 'dark'))}</div></div>
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
  const tabs = [['titles', 'ยศ'], ['choices', 'เหตุการณ์'], ['family', 'ชาติ'], ['endings', 'ฉากจบ']]
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
    body = coll.family.length ? `<ul class="ladder">${coll.family.map(f => `<li><small>รอบที่ ${th(f.loop)} · ชาติที่ ${th(f.life)}</small>${f.career ? esc(splitTitle(E.careerTitle(f.career, f.level, null))[0]) : 'ไม่มีอาชีพ'} · บุญ ${thInt(f.merit)}</li>`).join('')}</ul>` : '<p class="muted">ยังไม่มีชาติที่จบไปแล้ว — ชาติแรกยังดำเนินอยู่</p>';
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
  aff: ['heart', 'ความชอบ — ผลงานที่นายเห็น ใช้เลื่อนยศ หายเมื่อสิ้นชาติ'],
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
    case 'career': E.chooseCareer(g, v); S.playGong(); closeModal(); toast(`เข้ารับราชการเป็น${splitTitle(E.careerTitle(v, 0, null))[0]}`, CAREER_ICON[v]); break;
    case 'track': E.chooseTrack(g, v as 'light' | 'dark'); S.playGong(); break;
    case 'promote': {
      const before = g.life.level, r = E.tryPromote(g);
      if (r.ok && g.life.level > before) celebrate(E.careerTitle(g.life.career!, g.life.level, g.life.track));
      else { S.playFail(); toast('ยื่นเรื่องไม่ผ่านคราวนี้ ลองใหม่ภายหลัง', 'cross'); }
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
        // ให้ตัวละครทำท่าของสเตตัสที่เพิ่มมากที่สุด
        for (const x of d.filter(x => x.kind === 'stat' && x.v > 0).sort((p, q) => q.v - p.v)) if (scene.showStat(x.key, 6)) break;
      }
      else closeModal();
      break;
    }
    case 'resolve-check': {
      const h = content.historical.find(x => x.id === (g.queue[0] as { id: string }).id)!;
      const r = E.resolveEvent(g);
      (r.success ? S.playGood : S.playFail)();
      openModal(`<span class="kind hist">${icon('scroll', 16)}ผลลัพธ์</span><h2>${esc(h.title)}</h2><div class="verdict ${r.success ? 'good' : 'bad'}">${icon(r.success ? 'star' : 'cross', 28)}${r.success ? `ผ่าน — ความชอบ +${th(B.affectionHistSuccess)}` : `พลาด — เสียทรัพย์ ${pct(B.checkFailLoss)}`}</div><button class="choice go" data-act="close">ไปต่อ</button>`);
      break;
    }
    case 'close': S.playTap(); closeModal(); break;
    case 'afterlife': closeModal(); yama(false); return;
    case 'help': S.playTap(); if (openHelp.has(v)) openHelp.delete(v); else openHelp.add(v); break;
    case 'restart': store()?.removeItem(SAVE_KEY); g = E.newGame(); sliceDone = false; healthWarned = false; running = true; lifebarFor = ''; closeModal(); break;
  }
  if (openWare && $('modal').classList.contains('show')) openModal(wareSheet(openWare));
  save(); renderHud(); renderTab();
});
// แตะพื้นหลังมืดนอกแผ่น = ปิด (เฉพาะแผ่นรายละเอียด ไม่ใช่เหตุการณ์)
$('modal').addEventListener('click', ev => { if (ev.target === $('modal') && $('modal-body').querySelector('.close')) closeModal(); });
$('btn-play').addEventListener('click', () => { running = !running; S.playTap(); renderHud(); renderTab(); });
// แตะในฉาก: เก็บของ หรือคุยกับตัวละคร
$('scene').addEventListener('click', ev => {
  const p = scene.toCanvas(ev);
  if (scene.pickup && scene.hitPickup(p.x, p.y)) {
    const r = E.grantPickup(g, scene.pickup.kind), [kind, a, b2] = r.split(':');
    scene.collectBurst(scene.pickup.x, scene.pickup.y); scene.pickup = null; S.playCoin();
    if (kind === 'money') floatText('coin', `+${baht(+a, 1)}`, 'money', p.x / 2.4);
    else if (kind === 'aff') floatText('heart', `+${th(a)}`, 'aff', p.x / 2.4);
    else floatText(STAT_ICON[a] ?? 'star', `+${pctAuto(+b2)}`, 'stat', p.x / 2.4);
    save(); renderHud(); return;
  }
  if (scene.hitChar(p.x, p.y)) {
    S.playTap();
    const m = currentMood(), el = $('speech');
    el.textContent = speechFor(g, { rain: m.rain, war: m.war });
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
});
// คีย์บอร์ด: 1–9 เลือกตัวเลือก · Enter ไปต่อ · Space หยุด/เล่น
document.addEventListener('keydown', ev => {
  if ($('modal').classList.contains('show')) {
    const cs = [...document.querySelectorAll<HTMLButtonElement>('.modal.show .choice')];
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= cs.length) cs[n - 1].click();
    else if (ev.key === 'Enter' && cs.length === 1) cs[0].click();
    else if (ev.key === 'Escape' && $('modal-body').querySelector('.close')) closeModal();
    return;
  }
  if (ev.key === ' ') { ev.preventDefault(); running = !running; renderHud(); }
});
// เสียง: ตั้งค่าที่จำไว้ (เพลงจะเริ่มจริงหลังผู้เล่นแตะจอครั้งแรก)
try { const sp = JSON.parse(store()?.getItem('ayothaya.sound') ?? '{}'); sound.sfx = sp.sfx ?? true; if (sp.music) setMusic(true); } catch { /* ใช้ค่าเริ่มต้น */ }
$('btn-sound').addEventListener('click', () => {
  // วน: เสียงเอฟเฟกต์อย่างเดียว → + เพลง → ปิดหมด
  S.unlockAudio();
  if (sound.sfx && !sound.music) { setMusic(true); toast('เปิดเพลงและเสียง', 'note'); }
  else if (sound.music) { setMusic(false); sound.sfx = false; toast('ปิดเสียงทั้งหมด', 'mute'); }
  else { sound.sfx = true; toast('เปิดเฉพาะเสียงเอฟเฟกต์', 'speaker'); }
  try { store()?.setItem('ayothaya.sound', JSON.stringify({ sfx: sound.sfx, music: sound.music })); } catch { /* ignore */ }
  renderHud(); S.playTap();
});
// ความเร็ว: แตะแล้วเลือกจากเมนู (เพิ่มหรือลดก็ได้)
const SPEED_LABEL: Record<number, string> = { 1: 'ปกติ', 10: 'เร็ว', 100: 'เร็วมาก', 3000: 'ทดสอบ' };
$('btn-speed').addEventListener('click', ev => {
  ev.stopPropagation(); S.playTap();
  const pop = $('speedpop');
  if (pop.classList.toggle('show')) pop.innerHTML = SPEEDS.map((v, i) => `<button class="${i === speedIdx ? 'on' : ''}" data-speed="${i}"><b>×${th(v)}</b><small>${SPEED_LABEL[v] ?? ''}</small></button>`).join('');
});
$('speedpop').addEventListener('click', ev => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-speed]'); if (!b) return;
  ev.stopPropagation(); speedIdx = +b.dataset.speed!; S.playSelect(); $('speedpop').classList.remove('show'); renderHud();
});
document.addEventListener('click', () => $('speedpop').classList.remove('show'));

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
$('ic-money').innerHTML = icon('coin', 22); $('ic-merit').innerHTML = icon('lotus', 22); $('ic-aff').innerHTML = icon('heart', 22);
document.querySelectorAll<HTMLElement>('[data-ic]').forEach(el => { el.outerHTML = icon(el.dataset.ic!, 28); });

renderHud(); renderTab();
if (sliceDone) showSliceEnd(); else showAway();
requestAnimationFrame(frame);
