// ชิ้นทดลอง (ขั้น 4): ชาติ 1 อายุ 9–20 เล่นบนมือถือได้จริง
import './game.css';
import { content } from '../content';
import type { StatKey } from '../content/types';
import { BALANCE as B, type PathKey } from '../engine/balance';
import * as E from '../engine/core';
import { Scene, type SceneMood } from './scene';
import { playCoin, playEvent, playFanfare, playTap, setMusic, sound } from './sound';
import { percentile, simulatePeers } from './compare';
import { speechFor } from './speech';
import { baht, dateOf, esc, pct, pctAuto, pctFine, th, thInt } from './format';

const SAVE_KEY = 'ayothaya.save.v1';
const SLICE_END_AGE = 21; // ชิ้นทดลองจบเมื่ออายุครบ 21
const SPEEDS = location.search.includes('dev') ? [1, 10, 100, 3000] : [1, 10, 100];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const statName = (k: string) => content.stats.find(s => s.key === k)?.display ?? k;
const careerOf = (k: string) => content.careers.careers.find(c => c.key === k)!;

// ---------- โหลด/เซฟ ----------
function store(): Storage | null { try { return window.localStorage; } catch { return null; } }
function save() { try { store()?.setItem(SAVE_KEY, E.serialize(g)); } catch { /* ไม่มีที่เก็บก็เล่นต่อได้ */ } }
function load(): E.GameState | null {
  try { const s = store()?.getItem(SAVE_KEY); return s ? E.deserialize(s) : null; } catch { return null; }
}

let g: E.GameState = load() ?? E.newGame();
let running = true, speedIdx = 0, acc = 0, tab: 'life' | 'shop' | 'char' | 'log' = 'life';
let sliceDone = E.ageOf(g.life) >= SLICE_END_AGE;
const scene = new Scene($<HTMLCanvasElement>('scene'));
if (location.search.includes('dev')) (window as unknown as Record<string, unknown>).__dev = { scene, get g() { return g; }, celebrate: (t: string) => celebrate(t) };

// เวลาที่ผ่านไปตอนปิดแอป
const away = E.offlineDays(g);
let awayInfo: { days: number; auto: number } | null = null;
if (away > 0 && !sliceDone) {
  const before = E.ageOf(g.life);
  const r = E.advance(g, capToSlice(away), { online: false });
  awayInfo = { days: r.days, auto: r.autoResolved };
  void before;
}

function capToSlice(days: number) {
  const left = (SLICE_END_AGE - B.startAge) * B.daysPerYear - g.life.day;
  return g.life.idx === 1 && g.loop === 1 ? Math.max(0, Math.min(days, left)) : days;
}

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
      if (E.ageOf(g.life) >= SLICE_END_AGE && g.life.idx === 1 && g.loop === 1) { sliceDone = true; showSliceEnd(); }
      renderHud(); renderTabSoft();
    }
  }
  $('daybar').style.width = `${running && !g.queue.length && !sliceDone ? Math.min(100, acc / B.secondsPerGameDay * 100) : 0}%`;
  scene.alert = g.queue.length > 0;
  if (g.queue.length && !$('modal').classList.contains('show')) showEvent();
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

// ---------- ตัวเลขลอยขึ้นจากตัวละคร (ให้รู้ว่าเวลาเดินและได้อะไร) ----------
interface Snap { life: number; money: number; merit: number; aff: number; stats: Record<string, number>; }
function snap(): Snap {
  const L = g.life, stats: Record<string, number> = {};
  for (const k of E.STAT_KEYS) stats[k] = L.stats[k] / L.cap;
  return { life: L.idx, money: L.money, merit: g.merit, aff: L.affection, stats };
}
/** ผลต่างก่อน/หลัง เป็นรายการข้อความ (ใช้ทั้งตัวเลขลอยและป๊อปอัพผลลัพธ์) */
function diff(a: Snap): { label: string; v: number; text: string; kind: string }[] {
  const b = snap(), out: { label: string; v: number; text: string; kind: string }[] = [];
  if (a.life !== b.life) return out;
  for (const k of E.STAT_KEYS) { const d = b.stats[k] - a.stats[k]; if (Math.abs(d) > 1e-7) out.push({ label: statName(k), v: d, text: `${d > 0 ? '+' : '−'}${pctAuto(Math.abs(d))}`, kind: 'stat' }); }
  const dm = b.money - a.money; if (Math.abs(dm) > 1e-7) out.push({ label: 'เงิน', v: dm, text: `${dm > 0 ? '+' : '−'}${baht(Math.abs(dm), 1)}`, kind: 'money' });
  const db = b.merit - a.merit; if (db > 1e-6) out.push({ label: 'บุญ', v: db, text: `+${th(db < 1 ? db.toFixed(2) : db.toFixed(1))}`, kind: 'merit' });
  const da = b.aff - a.aff; if (Math.abs(da) > 1e-6) out.push({ label: 'ความชอบ', v: da, text: `${da > 0 ? '+' : '−'}${th(Math.abs(da).toFixed(2))}`, kind: 'aff' });
  return out;
}
function floatText(text: string, kind: string, leftPct = 50) {
  const el = document.createElement('span');
  el.className = `float ${kind}`; el.textContent = text; el.style.left = `${leftPct}%`;
  $('floats').appendChild(el); setTimeout(() => el.remove(), 2200);
}
let floatTurn = 0, lastFloat = 0;
function gainFloat(before: Snap) {
  // ไม่เกิน 1 ตัวต่อ 0.8 วินาที (ตอนเร่งเวลาจะได้ไม่ซ้อนกันจนอ่านไม่ออก)
  const now = performance.now();
  if (now - lastFloat < 800) return;
  lastFloat = now;
  const d = diff(before);
  const stats = d.filter(x => x.kind === 'stat' && x.v > 0).sort((x, y) => y.v - x.v);
  const pick = [d.find(x => x.kind === 'money'), stats[0], d.find(x => x.kind === 'merit'), stats[1] ?? stats[0]][floatTurn++ % 4];
  if (!pick) return;
  const el = document.createElement('span');
  el.className = `float ${pick.kind}`;
  el.textContent = pick.kind === 'money' ? pick.text : `${pick.label} ${pick.text}`;
  el.style.left = `${40 + Math.random() * 16}%`;
  $('floats').appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ---------- เส้นชีวิต: อายุ 9 → สิ้นชาติ พร้อมจุดเหตุการณ์ประวัติศาสตร์ ----------
let lifebarFor = '';
function renderLifebar() {
  const L = g.life, span = (L.endYear - L.startYear + 1) * B.daysPerYear, key = `${g.loop}-${L.idx}`;
  if (lifebarFor !== key) {
    lifebarFor = key;
    $('lifemarks').innerHTML = content.historical.filter(h => h.life === L.idx).map(h => {
      const pos = ((h.yearFrom - L.startYear) * B.daysPerYear) / span * 100;
      return `<i class="mk ${h.kind}" style="left:${pos.toFixed(2)}%" title="${esc(h.title)}"></i>`;
    }).join('');
  }
  $('lifefill').style.width = `${(L.day / span * 100).toFixed(2)}%`;
  $('lifeage').textContent = `อายุ ${th(E.ageOf(L))} / ${th(B.startAge + L.endYear - L.startYear)}`;
}

// ---------- HUD ----------
function renderHud() {
  const L = g.life, r = E.reignAt(g);
  $('hud-when').textContent = `ชาติที่ ${th(L.idx)} · พ.ศ. ${th(E.yearOf(L))} · อายุ ${th(E.ageOf(L))} ปี`;
  $('hud-date').textContent = `${dateOf(L.day % B.daysPerYear)}`;
  $('hud-reign').textContent = `รัชสมัย${r.king}`;
  renderLifebar();
  $('res-money').textContent = baht(L.money);
  $('res-merit').textContent = thInt(g.merit);
  $('res-aff').textContent = th(L.affection.toFixed(1));
  const doing = E.ageOf(L) < B.careerMinAge
    ? (L.childJob ? content.childJobs.find(j => j.key === L.childJob)!.name : 'ยังไม่ได้ช่วยงานอะไร')
    : (L.career ? E.careerTitle(L.career, L.level, L.track) : 'ยังไม่ได้เลือกอาชีพ');
  $('status').innerHTML = `<b>${esc(doing)}</b> · แนวทาง${B.paths[L.path].label}`;
  $('btn-play').textContent = running ? '❚❚' : '▶';
  $('btn-speed').textContent = `×${th(SPEEDS[speedIdx])}`;
}

// ---------- แท็บ ----------
let panelHtml = '', lastPointer = 0, lastSoft = 0;
document.addEventListener('pointerdown', () => { lastPointer = performance.now(); }, true);
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

function lifeTab(): string {
  const L = g.life, age = E.ageOf(L);
  const paths = (Object.keys(B.paths) as PathKey[]).map(k => {
    const p = B.paths[k];
    return `<button class="chip ${L.path === k ? 'on' : ''}" data-act="path" data-v="${k}"><b>${p.label}</b><small>งาน ${pct(p.work)} · ฝึก ${pct(p.train)} · บุญ ${pct(p.merit)}</small></button>`;
  }).join('');
  const train = E.STAT_KEYS.map(s => `<button class="tag ${L.train.includes(s) ? 'on' : ''}" data-act="train" data-v="${s}">${esc(statName(s))}</button>`).join('');
  let work = '';
  if (age < B.careerMinAge) {
    work = `<h3>งานเด็ก <small>ก่อนเลือกอาชีพตอนอายุ ๑๒</small></h3>` + content.childJobs.map(j => `
      <button class="card pick ${L.childJob === j.key ? 'on' : ''}" data-act="child" data-v="${j.key}">
        <b>${esc(j.name)}</b><p>${esc(j.desc)}</p><small>ฝึก ${j.stats.map(statName).join(', ')} · เหมาะกับ${j.suggests.join(', ')}</small></button>`).join('');
  } else if (!L.career) {
    work = `<h3>เลือกอาชีพ</h3>` + content.careers.careers.map(c => `
      <button class="card pick" data-act="career" data-v="${c.key}"><b>${esc(c.key)}</b> <small>${esc(c.fullname)}</small>
      <p>เริ่มเป็น ${esc(c.titles['0'])}</p><small>สเตตัสหลัก ${statName(c.gateStat)} · รอง ${statName(c.secondaryStat)}</small></button>`).join('');
  } else work = promoteCard();
  return `<h3>แนวทางชีวิต ${help('path')}</h3>${helpBox('path', `<b>งาน</b> — เงินตามยศ สเตตัสหลัก/รองของอาชีพ และความชอบ (ก่อนอายุ ๑๒ คืองานเด็ก)<br><b>ฝึก</b> — สเตตัส ๑–๒ ด้านที่เลือกไว้ด้านล่าง<br><b>บุญ</b> — บุญญาธิการเพิ่มขึ้นทุกวัน ใช้ปลดล็อกทวิภพ<br>สัดส่วนบอกว่าแต่ละวันแบ่งเวลาให้แต่ละอย่างเท่าไร`)}<div class="chips">${paths}</div>
    <h3>ฝึกฝน <small>เลือกได้ ๒ ด้าน</small> ${help('train')}</h3><div class="tags">${train}</div>${helpBox('train', trainInfo())}${work}`;
}

const openHelp = new Set<string>();
const help = (id: string) => `<button class="help ${openHelp.has(id) ? 'on' : ''}" data-act="help" data-v="${id}" aria-label="คำอธิบาย">?</button>`;
const helpBox = (id: string, html: string) => openHelp.has(id) ? `<div class="helpbox">${html}</div>` : '';

function trainInfo(): string {
  const L = g.life;
  return L.train.map(s => {
    const st = content.stats.find(x => x.key === s)!;
    const prim = content.careers.careers.filter(c => c.gateStat === s).map(c => c.key);
    const sec = content.careers.careers.filter(c => c.secondaryStat === s).map(c => c.key);
    const checks = content.historical.filter(h => h.life === L.idx && h.checkStat === s).length;
    const uses = [prim.length ? `หลักของ${prim.join(', ')}` : '', sec.length ? `รองของ${sec.join(', ')}` : ''].filter(Boolean).join(' · ');
    return `<div class="info"><div class="sl"><b>${esc(st.display)}</b><span>${pctFine(L.stats[s] / L.cap)}</span></div>
      <p>${esc(st.role)}</p><small>${uses ? `อาชีพ: ${esc(uses)} · ` : ''}เหตุการณ์ที่ต้องใช้ในชาตินี้ ${th(checks)} ครั้ง</small></div>`;
  }).join('');
}

function promoteCard(): string {
  const L = g.life, c = careerOf(L.career!);
  if (L.level >= B.maxLevel) return `<div class="card"><b>ถึงยศสูงสุดแล้ว</b></div>`;
  const t = L.level + 1;
  if (t >= B.lightDarkLevel && !L.track) {
    return `<h3>ถึงทางแยกของชีวิต</h3><div class="card"><p>ยศถัดไปต้องเลือกว่าจะเดินทางไหน</p>
      <div class="row"><button class="btn" data-act="track" data-v="light">ด้านสว่าง<br><small>${esc(c.titles.light['2'])}</small></button>
      <button class="btn dark" data-act="track" data-v="dark">ด้านมืด<br><small>${esc(c.titles.dark['2'])}</small></button></div></div>`;
  }
  const gv = E.gateValue(g, t), gn = E.gateFrac(t), aff = E.affectionReq(t), cost = E.promoteCost(L.level);
  const blk = E.promoteBlock(g);
  const req = (ok: boolean, label: string, val: string) => `<li class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${label} <span>${val}</span></li>`;
  const cooldown = Math.max(0, B.promoteCooldownDays - (L.day - L.lastPromoteDay));
  return `<h3>ยศถัดไป</h3><div class="card">
    <div class="next">${esc(E.careerTitle(L.career!, t, L.track))}</div>
    <ul class="reqs">
      ${req(gv >= gn, `${statName(c.gateStat)} ผสม ${statName(c.secondaryStat)}`, `${pct(gv)} / ${pct(gn)}`)}
      ${req(L.affection >= aff, 'ความชอบ', `${th(L.affection.toFixed(1))} / ${th(aff.toFixed(1))}`)}
      ${req(L.money >= cost, 'ค่ายื่นเรื่อง', baht(cost))}
    </ul>
    <button class="btn wide" data-act="promote" ${blk ? 'disabled' : ''}>${blk === 'cooldown' ? `รออีก ${th(cooldown)} วัน` : `ยื่นขอเลื่อนยศ${blk ? '' : ` (โอกาส ${pct(E.promoteChance(g))})`}`}</button>
  </div>`;
}

function shopTab(): string {
  const L = g.life, sh = content.shop;
  const row = (name: string, desc: string, price: number | null, act: string, v = '', story = '') =>
    `<div class="item"><div><b>${esc(name)}</b>${story ? `<p class="story">${esc(story)}</p>` : ''}<p class="eff">${esc(desc)}</p></div>${price == null ? '<span class="done">ครบแล้ว</span>' :
      `<button class="buy" data-act="${act}" data-v="${v}" ${L.money < price ? 'disabled' : ''}>${baht(price)}</button>`}</div>`;
  let html = `<div class="money-bar">เงิน ${baht(L.money, 3)}</div>`;
  if (L.career) {
    const items = sh.careerItems[L.career], lv = L.careerItem[L.career] ?? 0, it = items[lv];
    html += `<h3>ของประจำ${L.career.startsWith('สาย') ? '' : 'สาย'}${esc(L.career)} <small>ชิ้นที่ ${th(lv + 1)} จาก ${th(items.length)}</small></h3>` +
      (it ? row(it.name, `${it.desc} · ทำงานได้ผล +${pctAuto(B.careerItemEffPerLevel)}`, E.careerItemPrice(g), 'citem', '', it.story) : '<p class="muted">ครบทุกชิ้นแล้ว</p>');
  }
  const acc = sh.accommodations[L.accommodation], ret = sh.retainers[L.retainer];
  html += `<h3>ที่พำนัก <small>ระดับ ${th(L.accommodation)} จาก ${th(sh.accommodations.length)}</small></h3>` + (acc ? row(acc.name, `ฝึกฝนได้ผล +${pctAuto(B.accommodationTrainPerLevel)}`, E.accommodationPrice(L), 'acc', '', acc.story ?? acc.desc) : '<p class="muted">ครบแล้ว</p>');
  html += `<h3>ไพร่บริวาร <small>ระดับ ${th(L.retainer)} จาก ${th(sh.retainers.length)}</small></h3>` + (ret ? row(ret.name, `รายได้ +${pctAuto(B.retainerIncomePerLevel)}`, E.retainerPrice(L), 'ret', '', ret.story ?? ret.desc) : '<p class="muted">ครบแล้ว</p>');
  html += `<h3>ทำบุญ <small>ทำซ้ำได้ ราคาขึ้นทุกครั้ง · ยิ่งมีบุญมาก ได้เพิ่มยิ่งน้อย</small></h3>` + sh.meritItems.map((m, i) => row(m.name, `บุญ +${thInt(m.legacyMerit / (1 + g.merit / B.meritSoftcap))} (ทำไปแล้ว ${th(L.donations[i])} ครั้ง)`, E.donationPrice(L, i), 'donate', String(i), m.story)).join('');
  html += `<h3>ของสามัญ <small>ซื้อซ้ำได้ ราคาขึ้นทีละ ๑๐%</small></h3>` + sh.commonItems.map((m, i) => row(m.name, `${statName(m.stat)} +${pctAuto(0.004)} ของเพดาน${m.legacyAffection ? ' · ความชอบ +๐.๓' : ''}${L.common[i] ? ` · มีแล้ว ${th(L.common[i])}` : ''}`, E.commonPrice(L, i), 'common', String(i), m.story)).join('');
  html += `<h3>งานบุญใหญ่</h3>` + B.megaProjects.map(m => row(m.name, `บุญ +${thInt(m.merit)} · ความชอบ +${th(m.affection)}`, m.price * Math.pow(1.5, L.mega[m.id] ?? 0), 'mega', m.id)).join('');
  return html;
}

function charTab(): string {
  const L = g.life;
  const bars = content.stats.map(s => {
    const f = L.stats[s.key] / L.cap, gate = L.career && (careerOf(L.career).gateStat === s.key || careerOf(L.career).secondaryStat === s.key);
    return `<div class="stat ${L.train.includes(s.key) ? 'train' : ''} ${gate ? 'gate' : ''}"><div class="sl"><b>${esc(s.display)}</b><span>${pctFine(f)}</span></div>
      <div class="bar"><i style="width:${(f * 100).toFixed(1)}%"></i></div></div>`;
  }).join('');
  const coll = g.collection;
  return `<p class="muted">เพดานสเตตัสชาตินี้ ${th(L.cap)} · ค่าแสดงเป็น % ของเพดาน ${help('stats')}</p>${helpBox('stats', content.stats.map(s => `<p><b>${esc(s.display)}</b> — ${esc(s.role)}</p>`).join('') + '<p>★ = สเตตัสที่อาชีพปัจจุบันใช้เลื่อนยศ · แถบสีเขียว = กำลังฝึก</p>')}${bars}
    <h3>สมุดสะสม</h3><div class="card"><p>ยศที่เคยได้ ${th(coll.titles.length)} · ตัวเลือกที่เคยเลือก ${th(Object.keys(coll.choices).length)} เหตุการณ์ · ชาติที่บันทึก ${th(coll.family.length)}</p></div>`;
}

function logTab(): string {
  return `<div class="log">${g.log.slice().reverse().slice(0, 120).map(l => `<p>${esc(th(l))}</p>`).join('') || '<p class="muted">ยังไม่มีบันทึก</p>'}</div>`;
}

// ---------- เหตุการณ์ ----------
function fx(e: Record<string, number>) {
  return Object.entries(e).map(([k, v]) => `<span class="fx ${v < 0 ? 'neg' : ''}">${esc(statName(k))} ${v >= 0 ? '+' : ''}${th(v)}</span>`).join(' ');
}
function openModal(html: string) { $('modal-body').innerHTML = html; $('modal').classList.add('show'); }
function closeModal() { $('modal').classList.remove('show'); }

function showEvent() {
  const e = g.queue[0];
  if (!e) return;
  playEvent();
  const L = g.life, head = `<div class="eyebrow">พ.ศ. ${th(E.yearOf(L))} · อายุ ${th(E.ageOf(L))} ปี</div>`;
  if (e.kind === 'karma') {
    const d = E.karmaDef(e);
    const risky = 'risky' in d && d.risky ? `<button class="choice risky" data-act="resolve" data-v="risky">${esc(d.risky.label)}<small>เสี่ยงดวง · โอกาส ${pct(d.risky.chance)}</small></button>` : '';
    openModal(`${head}<div class="kind">กงกรรม</div><h2>${esc(d.title)}</h2>
      ${d.choices.map((c, i) => `<button class="choice" data-act="resolve" data-v="${i}">${esc(c.label)}</button>`).join('')}${risky}`);
    return;
  }
  if (e.kind === 'hist') {
    const h = content.historical.find(x => x.id === e.id)!;
    let body = `${head}<div class="kind hist">เหตุการณ์ประวัติศาสตร์</div><h2>${esc(h.title)}</h2>${h.desc ? `<p>${esc(h.desc)}</p>` : ''}`;
    if (h.kind === 'choice') body += h.choices!.map((c, i) => `<button class="choice" data-act="resolve" data-v="${i}">${esc(c.label)}</button>`).join('');
    else if (h.kind === 'check') {
      const p = Math.min(B.checkMax, B.checkBase + B.checkSlope * E.frac(L, h.checkStat!));
      body += `<p class="muted">ต้องใช้${esc(statName(h.checkStat!))} · โอกาสผ่าน ${pct(p)}<br>ผ่าน: ความชอบ +${th(B.affectionHistSuccess)} · ไม่ผ่าน: เสียเงินและทรัพย์สิน ${pct(B.checkFailLoss)}</p>
        <button class="choice" data-act="resolve-check">รับมือ</button>`;
    } else body += `<button class="choice" data-act="resolve">รับทราบ</button>`;
    openModal(body);
    return;
  }
  if (e.kind === 'lifeEnd') {
    openModal(`<h2>สิ้นชีวิต ชาติที่ ${th(e.summary.life)}</h2><p>${e.summary.career ? esc(E.careerTitle(e.summary.career, e.summary.level, g.life.track)) : 'ไม่มีอาชีพ'}</p><button class="choice" data-act="resolve">เกิดใหม่</button>`);
    return;
  }
  if (e.kind === 'finale') {
    openModal(`<h2>พ.ศ. ๒๓๑๐</h2><p>กรุงศรีอยุธยากำลังจะแตก</p>${e.options.map(o => `<button class="choice" data-act="resolve" data-v="${o}">${o}</button>`).join('')}`);
  }
}

function showResult(label: string, d: ReturnType<typeof diff>, risky: E.ResolveResult | null) {
  const items = d.map(x => `<li class="${x.v < 0 ? 'bad' : 'good'}">${esc(x.label)} <b>${x.text}</b></li>`).join('');
  const verdict = risky ? `<p class="${risky.success ? 'good' : 'bad'}">${risky.success ? 'เสี่ยงแล้วได้ผล!' : 'เสี่ยงแล้วพลาด'}</p>` : '';
  openModal(`<div class="kind">ผลของการเลือก</div><h2>${esc(label)}</h2>${verdict}
    ${items ? `<ul class="result">${items}</ul>` : '<p class="muted">ไม่มีผลที่เห็นได้ในตอนนี้ (ค่าที่จะลดเหลือศูนย์อยู่แล้ว หรือถึงเพดานแล้ว)</p>'}
    <button class="choice" data-act="close">ไปต่อ</button>`);
}

function compareHtml(): string {
  const peers = simulatePeers(100, SLICE_END_AGE), L = g.life;
  const row = (label: string, p: number) => `<li><span>${label}</span><div class="pbar"><i style="width:${(p * 100).toFixed(0)}%"></i></div><b>${th(Math.round(p * 100))}%</b></li>`;
  return `<h3>เทียบกับไพร่จำลอง ๑๐๐ คน</h3><p class="muted">ไพร่ที่เกิดปีเดียวกันและเล่นแบบสุ่ม — ท่านทำได้ดีกว่ากี่คน</p><ul class="peers">
    ${row('ยศ', percentile(peers.map(p => p.level), L.level))}${row('บุญ', percentile(peers.map(p => p.merit), g.merit))}${row('เงิน', percentile(peers.map(p => p.money), L.money))}</ul>`;
}

function showSliceEnd() {
  running = false;
  const L = g.life;
  openModal(`<div class="kind">จบชิ้นทดลอง</div><h2>อายุ ${th(E.ageOf(L))} ปี</h2>
    <p>${L.career ? `เป็น<b>${esc(E.careerTitle(L.career, L.level, L.track))}</b> (ยศขั้นที่ ${th(L.level)})` : 'ยังไม่มีอาชีพ'}</p>
    <p>เงิน ${baht(L.money)} · บุญ ${thInt(g.merit)} · ความชอบ ${th(L.affection.toFixed(1))}</p>
    ${compareHtml()}
    <p class="muted">ชิ้นทดลองนี้ครอบคลุมชาติ ๑ อายุ ๙–๒๐ — ลองเล่นแล้วเล่าให้ฟังว่าตรงไหนสนุก ตรงไหนน่าเบื่อหรือไม่เข้าใจ</p>
    <button class="choice" data-act="restart">เริ่มใหม่</button><button class="choice" data-act="close">ดูสถานะต่อ</button>`);
}

function showAway() {
  if (!awayInfo) return;
  const y = Math.floor(awayInfo.days / B.daysPerYear), d = awayInfo.days % B.daysPerYear;
  openModal(`<div class="kind">ระหว่างที่ท่านไม่อยู่</div><h2>เวลาผ่านไป ${y ? `${th(y)} ปี ` : ''}${th(d)} วัน</h2>
    <p>${awayInfo.auto ? `กงกรรม ${th(awayInfo.auto)} เรื่องตัดสินใจไปตามแนวทางชีวิตแล้ว` : 'ไม่มีกงกรรมที่ต้องตัดสินใจแทน'}${g.queue.length ? ` · มี ${th(g.queue.length)} เรื่องรอท่านอยู่` : ''}</p>
    <button class="choice" data-act="close">ไปต่อ</button>`);
  awayInfo = null;
}

// ---------- ปุ่มต่างๆ ----------
document.addEventListener('click', ev => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-tab]');
  if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab as typeof tab; renderTab(); return; }
  const v = b.dataset.v ?? '';
  switch (b.dataset.act) {
    case 'path': E.setPath(g, v as PathKey); break;
    case 'train': {
      const cur = g.life.train.slice(); const i = cur.indexOf(v as StatKey);
      if (i >= 0) { if (cur.length > 1) cur.splice(i, 1); } else { cur.push(v as StatKey); if (cur.length > 2) cur.shift(); }
      E.setTrain(g, cur); break;
    }
    case 'child': E.chooseChildJob(g, v); break;
    case 'career': E.chooseCareer(g, v); break;
    case 'track': E.chooseTrack(g, v as 'light' | 'dark'); break;
    case 'promote': {
      const before = g.life.level, r = E.tryPromote(g);
      if (r.ok && g.life.level > before) celebrate(E.careerTitle(g.life.career!, g.life.level, g.life.track));
      else toast('ยื่นเรื่องไม่ผ่านคราวนี้ ลองใหม่ภายหลัง');
      break;
    }
    case 'citem': E.buyCareerItem(g); break;
    case 'acc': E.buyAccommodation(g); break;
    case 'ret': E.buyRetainer(g); break;
    case 'donate': E.donate(g, +v); break;
    case 'common': E.buyCommon(g, +v); break;
    case 'mega': E.buyMega(g, v); break;
    case 'resolve': {
      const e = g.queue[0], before = snap();
      const label = (b.firstChild?.textContent ?? '').trim();
      const r = E.resolveEvent(g, v === '' ? undefined : v === 'risky' ? 'risky' : isNaN(+v) ? v as E.EndingId : +v);
      const choseSomething = e && (e.kind === 'karma' || (e.kind === 'hist' && v !== ''));
      if (choseSomething) showResult(label, diff(before), v === 'risky' ? r : null);
      else closeModal();
      break;
    }
    case 'resolve-check': {
      const h = content.historical.find(x => x.id === (g.queue[0] as { id: string }).id)!;
      const r = E.resolveEvent(g);
      openModal(`<div class="kind hist">ผลลัพธ์</div><h2>${esc(h.title)}</h2><p class="${r.success ? 'good' : 'bad'}">${r.success ? `ผ่าน — ความชอบ +${th(B.affectionHistSuccess)}` : `ไม่ผ่าน — เสียเงินและทรัพย์สิน ${pct(B.checkFailLoss)}`}</p><button class="choice" data-act="close">ไปต่อ</button>`);
      break;
    }
    case 'close': closeModal(); break;
    case 'help': if (openHelp.has(v)) openHelp.delete(v); else openHelp.add(v); break;
    case 'restart': store()?.removeItem(SAVE_KEY); g = E.newGame(); sliceDone = false; running = true; closeModal(); break;
  }
  save(); renderHud(); renderTab();
});
$('btn-play').addEventListener('click', () => { running = !running; renderHud(); });
// แตะในฉาก: เก็บของ หรือคุยกับตัวละคร
$('scene').addEventListener('click', ev => {
  const p = scene.toCanvas(ev);
  if (scene.pickup && scene.hitPickup(p.x, p.y)) {
    const r = E.grantPickup(g, scene.pickup.kind), [kind, a, b2] = r.split(':');
    scene.collectBurst(scene.pickup.x, scene.pickup.y); scene.pickup = null; playCoin();
    floatText(kind === 'money' ? `+${baht(+a, 1)}` : kind === 'aff' ? `ความชอบ +${th(a)}` : `${statName(a)} +${pctAuto(+b2)}`, kind === 'money' ? 'money' : kind === 'aff' ? 'aff' : 'stat', p.x / 2.4);
    save(); renderHud(); return;
  }
  if (scene.hitChar(p.x, p.y)) {
    playTap();
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
    return;
  }
  if (ev.key === ' ') { ev.preventDefault(); running = !running; renderHud(); }
});
// เสียง
try { const sp = JSON.parse(store()?.getItem('ayothaya.sound') ?? '{}'); sound.sfx = sp.sfx ?? true; if (sp.music) setMusic(true); } catch { /* ใช้ค่าเริ่มต้น */ }
function renderSound() { $('btn-sound').textContent = sound.music ? '♪ เปิด' : sound.sfx ? '♪ ปิดเพลง' : '🔇'; }
$('btn-sound').addEventListener('click', () => {
  // วน: เสียงเอฟเฟกต์อย่างเดียว → + เพลง → ปิดหมด
  if (sound.sfx && !sound.music) setMusic(true); else if (sound.music) { setMusic(false); sound.sfx = false; } else sound.sfx = true;
  try { store()?.setItem('ayothaya.sound', JSON.stringify({ sfx: sound.sfx, music: sound.music })); } catch { /* ignore */ }
  renderSound(); playTap();
});
renderSound();
$('btn-speed').addEventListener('click', () => { speedIdx = (speedIdx + 1) % SPEEDS.length; renderHud(); });

function celebrate(title: string) {
  scene.celebrate(); playFanfare();
  const el = $('banner');
  el.innerHTML = `<small>เลื่อนยศเป็น</small><b>${esc(title)}</b>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

let toastTimer = 0;
function toast(msg: string) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('show'), 2600);
}

setInterval(save, 10000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

renderHud(); renderTab();
if (sliceDone) showSliceEnd(); else showAway();
requestAnimationFrame(frame);
