// ตัวเกมอโยธยา Idle — logic ล้วน ไม่แตะหน้าจอ ใช้ได้ทั้งในเบราว์เซอร์และในบอททดสอบ
// เวลาเดินทีละ "วัน" · ปิดแอปแล้วกลับมา เรียก advance(จำนวนวันที่หายไป) ได้เลย
import { content, lifeRange, NUM_LIVES } from '../content';
import type { Choice, Effects, StatKey } from '../content/types';
import { BALANCE as B, type PathKey } from './balance';
import { nextRandom, randInt } from './rng';

export const STAT_KEYS = content.stats.map(s => s.key) as StatKey[];
const D = B.daysPerYear;

// ---------- ชนิดข้อมูลสถานะ ----------
export type PendingEvent =
  | { kind: 'karma'; id: string; generic: boolean }
  | { kind: 'hist'; id: string }
  | { kind: 'lifeEnd'; summary: LifeSummary }
  | { kind: 'finale'; options: EndingId[] };

export type EndingId = 'fight' | 'flee' | 'reincarnate' | 'defend';

export interface Collection {
  titles: string[];                    // "อาชีพ|สาย|เลเวล" ที่เคยได้
  endings: string[];
  choices: Record<string, number[]>;   // id เหตุการณ์ → ตัวเลือกที่เคยเลือก (-1 = เสี่ยงดวง)
  family: (LifeSummary & { loop: number })[];
}

export interface LifeSummary {
  life: number; career: string | null; level: number; merit: number; money: number;
  affection: number; statsFrac: Record<string, number>;
}

interface Scheduled { id: string; day: number; }
interface HistSchedule { id: string; next: number; until: number; repeat: boolean; }

export interface LifeState {
  idx: number; cap: number; startYear: number; endYear: number;
  day: number;          // นับจากวันแรกของชาติ
  stats: Record<StatKey, number>;
  money: number; assets: number; affection: number;
  path: PathKey; train: StatKey[];
  childJob: string | null; career: string | null; level: number; track: 'light' | 'dark' | null;
  careerItem: Record<string, number>; accommodation: number; retainer: number;
  donations: number[]; common: number[]; mega: Record<string, number>;
  lastPromoteDay: number;
  peakFrac: Record<StatKey, number>;
  sched: { karma: Scheduled[]; hist: HistSchedule[]; nextGeneric: number; bag: number[]; bagPtr: number };
}

export interface GameState {
  version: 1;
  rng: number;
  loop: number;                         // รอบเล่น (ทวิภพแล้ว +1)
  merit: number;                        // บุญสะสม พกข้ามชาติ
  careerMaxLevel: Record<string, number>;
  careerLives: Record<string, number>;  // จำนวนชาติที่เคยทำอาชีพนี้
  peakFleeFrac: number;                 // หลบหลีกสูงสุดเทียบเพดาน ตลอดรอบเล่นนี้
  life: LifeState;
  queue: PendingEvent[];
  log: string[];
  ending: EndingId | 'defended' | null;
  savedAt: number;                      // เวลาจริงตอนเซฟ (ms) สำหรับคำนวณช่วงที่ปิดแอป
  stats: { promotions: number; eventsSeen: number };
  /** สมุดสะสม — เก็บข้ามรอบเล่น (ทวิภพไม่ล้าง) */
  collection: Collection;
}

// ---------- ตัวช่วย ----------
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const capFor = (life: number) => B.capBase + B.capPerLife * (life - 1);
export const yearOf = (L: LifeState) => L.startYear + Math.floor(L.day / D);
export const ageOf = (L: LifeState) => B.startAge + Math.floor(L.day / D);
export const frac = (L: LifeState, s: StatKey) => L.stats[s] / L.cap;
const career = (key: string) => content.careers.careers.find(c => c.key === key)!;
function log(g: GameState, msg: string) { g.log.push(`ชาติ ${g.life.idx} พ.ศ.${yearOf(g.life)} · ${msg}`); if (g.log.length > 300) g.log.shift(); }

function addMerit(g: GameState, raw: number) { g.merit += raw / (1 + g.merit / B.meritSoftcap); }

function shuffle(g: GameState, n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(nextRandom(g) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- เริ่มเกม / เริ่มชาติ ----------
export function newGame(seed = Date.now()): GameState {
  const g = {
    version: 1, rng: seed >>> 0, loop: 1, merit: 0, careerMaxLevel: {}, careerLives: {}, peakFleeFrac: 0,
    queue: [], log: [], ending: null, savedAt: Date.now(), stats: { promotions: 0, eventsSeen: 0 },
    collection: { titles: [], endings: [], choices: {}, family: [] },
  } as unknown as GameState;
  g.life = makeLife(g, 1, null);
  log(g, 'เกิดเป็นไพร่น้อย ณ หนองโสน');
  return g;
}

function makeLife(g: GameState, idx: number, prev: LifeState | null): LifeState {
  const r = lifeRange(idx), cap = capFor(idx);
  const stats = {} as Record<StatKey, number>, peak = {} as Record<StatKey, number>;
  for (const s of STAT_KEYS) {
    const carried = prev ? (prev.stats[s] / prev.cap) * B.carryStatFraction * cap : 0;
    stats[s] = carried; peak[s] = carried / cap;
  }
  const L: LifeState = {
    idx, cap, startYear: r.from, endYear: r.to, day: 0, stats, money: 0, assets: 0, affection: 0,
    path: prev?.path ?? 'balance', train: prev?.train ?? ['ความรู้'], childJob: null, career: null, level: 0, track: null,
    careerItem: {}, accommodation: 0, retainer: 0,
    donations: content.shop.meritItems.map(() => 0), common: content.shop.commonItems.map(() => 0), mega: {},
    lastPromoteDay: -9999, peakFrac: peak,
    sched: { karma: [], hist: [], nextGeneric: 0, bag: [], bagPtr: 0 },
  };
  for (const k of content.karmaFixed.filter(k => k.life === idx))
    L.sched.karma.push({ id: k.id, day: (k.year - r.from) * D + randInt(g, 0, D - 1) });
  for (const h of content.historical.filter(h => h.life === idx)) {
    // ฉากบรรยายในปีแรกของชาติ (เช่น เปิดเกม) เกิดวันแรกเลย
    const start = h.yearFrom === r.from && h.kind === 'narrative' ? 1 : (h.yearFrom - r.from) * D + randInt(g, 0, D - 1);
    L.sched.hist.push({ id: h.id, next: start, until: (h.yearTo - r.from + 1) * D - 1, repeat: h.kind === 'check' && h.yearTo > h.yearFrom });
  }
  L.sched.nextGeneric = (B.genericStartAge - B.startAge) * D + randInt(g, B.genericMinDays, B.genericMaxDays);
  L.sched.bag = shuffle(g, content.karmaGeneric.length);
  return L;
}

// ---------- 1 วัน ----------
export function workEff(g: GameState): number {
  const L = g.life;
  if (!L.career) return 1;
  return (1 + B.lineagePerLevel * (g.careerMaxLevel[L.career] ?? 0) + B.lineagePerLife * (g.careerLives[L.career] ?? 0)) * (1 + B.careerItemEffPerLevel * (L.careerItem[L.career] ?? 0));
}
export function talent(g: GameState): number {
  const L = g.life;
  return L.career ? 1 + B.lineagePerLevel * (g.careerMaxLevel[L.career] ?? 0) + B.lineagePerLife * (g.careerLives[L.career] ?? 0) : 1;
}
export function trainEff(L: LifeState): number {
  return (1 + B.accommodationTrainPerLevel * L.accommodation) * (1 + 0.3 * frac(L, 'ความรู้'));
}
function grow(L: LifeState, s: StatKey, k: number) { L.stats[s] += k * (L.cap - L.stats[s]); }

export function dailyIncome(g: GameState): number {
  const L = g.life, p = B.paths[L.path];
  if (ageOf(L) < B.careerMinAge) return L.childJob ? B.childWage * p.work : 0;
  if (!L.career) return 0;
  return B.wageBase * Math.pow(B.wageGrowth, L.level) * p.work * workEff(g)
    * (1 + B.retainerIncomePerLevel * L.retainer) * (1 + B.poksapIncome * frac(L, 'โภคทรัพย์'));
}

function stepDay(g: GameState) {
  const L = g.life, p = B.paths[L.path], age = ageOf(L);
  // ฝึกฝน
  const te = trainEff(L) * talent(g);
  for (const s of L.train) grow(L, s, B.trainRate * (p.train / L.train.length) * te);
  // ทำงาน
  if (age < B.careerMinAge) {
    const job = content.childJobs.find(j => j.key === L.childJob);
    if (job) for (const s of job.stats) grow(L, s, B.childJobRate * p.work / job.stats.length);
  } else if (L.career) {
    const c = career(L.career), we = workEff(g);
    grow(L, c.gateStat, B.workPrimaryRate * p.work * we);
    grow(L, c.secondaryStat, B.workSecondaryRate * p.work * we);
    L.affection += B.affectionWork * p.work * (1 + B.affectionPerLevel * L.level);
  }
  L.money += dailyIncome(g);
  addMerit(g, (B.meritDaily * p.merit + B.meritPassive) * (1 + B.meritBaramiBonus * frac(L, 'บารมี')));
  for (const s of STAT_KEYS) if (L.stats[s] / L.cap > L.peakFrac[s]) L.peakFrac[s] = L.stats[s] / L.cap;
  if (L.peakFrac['หลบหลีก'] > g.peakFleeFrac) g.peakFleeFrac = L.peakFrac['หลบหลีก'];
  L.day++;
}

// ---------- เหตุการณ์ที่ถึงกำหนดวันนี้ ----------
function collectDue(g: GameState): PendingEvent[] {
  const L = g.life, out: PendingEvent[] = [];
  for (const k of L.sched.karma) if (k.day === L.day) out.push({ kind: 'karma', id: k.id, generic: false });
  for (const h of L.sched.hist) {
    if (h.next === L.day) {
      out.push({ kind: 'hist', id: h.id });
      h.next = h.repeat ? h.next + randInt(g, B.waveMinDays, B.waveMaxDays) : -1;
      if (h.next > h.until) h.next = -1;
    }
  }
  const fixedPending = L.sched.karma.some(k => k.day >= L.day);
  if (L.day >= L.sched.nextGeneric && !fixedPending) {
    const idx = L.sched.bag[L.sched.bagPtr++];
    if (L.sched.bagPtr >= L.sched.bag.length) { L.sched.bag = shuffle(g, content.karmaGeneric.length); L.sched.bagPtr = 0; }
    out.push({ kind: 'karma', id: content.karmaGeneric[idx].id, generic: true });
    L.sched.nextGeneric = L.day + randInt(g, B.genericMinDays, B.genericMaxDays);
  }
  return out;
}

export const isMain = (e: PendingEvent) => e.kind !== 'karma';

// ---------- ให้เวลาเดิน ----------
export interface AdvanceResult { days: number; stopped: 'done' | 'event' | 'ended'; autoResolved: number; }

/**
 * เดินเวลาไม่เกิน `days` วัน หยุดเมื่อมีเหตุการณ์หลัก (เสมอ) หรือเหตุการณ์ย่อย (เฉพาะตอนเปิดแอปอยู่)
 * ตอนปิดแอป เหตุการณ์ย่อยเก็บไว้ไม่เกิน offlineQueueMax ที่เกินจะเลือกให้ตามแนวทางชีวิต
 */
export function advance(g: GameState, days: number, opts: { online: boolean }): AdvanceResult {
  let n = 0, auto = 0;
  while (n < days) {
    if (g.ending) return { days: n, stopped: 'ended', autoResolved: auto };
    if (g.queue.some(isMain) || (opts.online && g.queue.length)) return { days: n, stopped: 'event', autoResolved: auto };
    stepDay(g); n++;
    if (yearOf(g.life) > g.life.endYear) { endLife(g); continue; }
    for (const e of collectDue(g)) {
      g.stats.eventsSeen++;
      if (isMain(e) || opts.online || g.queue.length < B.offlineQueueMax) g.queue.push(e);
      else { applyKarma(g, e as Extract<PendingEvent, { kind: 'karma' }>, autoChoice(g, e)); auto++; }
    }
  }
  return { days: n, stopped: g.queue.length ? 'event' : 'done', autoResolved: auto };
}

// ---------- แก้เหตุการณ์ ----------
function applyEffects(g: GameState, e: Effects, mult = 1) {
  const L = g.life;
  for (const [k, v] of Object.entries(e) as [string, number][]) {
    if (k === 'ความชอบ') { L.affection = Math.max(0, L.affection + v); continue; }
    const s = k as StatKey;
    // ผลจากเหตุการณ์คิดจากระยะที่เหลือถึงเพดาน (บวก) หรือค่าที่มี (ลบ) จึงไม่ดันทะลุเพดานแม้เกิดบ่อย
    const x = L.stats[s];
    L.stats[s] = clamp(x + v * B.eventK * mult * (v > 0 ? L.cap - x : x), 0, L.cap);
    if (s === 'บารมี' && v > 0) L.affection += v * B.affectionPerBarami;
  }
}

export function karmaDef(e: { id: string; generic: boolean }) {
  return e.generic ? content.karmaGeneric.find(k => k.id === e.id)! : content.karmaFixed.find(k => k.id === e.id)!;
}

/** เลือกตัวเลือกให้อัตโนมัติ: เน้นสเตตัสที่กำลังฝึก + สเตตัสอาชีพ */
export function autoChoice(g: GameState, e: PendingEvent): number {
  const choices: Choice[] = e.kind === 'karma' ? karmaDef(e).choices : e.kind === 'hist' ? content.historical.find(h => h.id === e.id)!.choices ?? [] : [];
  const L = g.life, want = new Set<string>(L.train);
  if (L.career) { want.add(career(L.career).gateStat); want.add(career(L.career).secondaryStat); }
  let best = 0, bestScore = -Infinity;
  choices.forEach((c, i) => {
    const sc = Object.entries(c.effects).reduce((a, [k, v]) => a + (want.has(k) ? 2 : 0.5) * (v as number), 0);
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  return best;
}

function remember(g: GameState, id: string, choice: number) {
  const c = (g.collection.choices[id] ??= []);
  if (!c.includes(choice)) c.push(choice);
}

function applyKarma(g: GameState, e: { id: string; generic: boolean }, choice: number | 'risky'): ResolveResult {
  remember(g, e.id, choice === 'risky' ? -1 : (choice as number));
  const def = karmaDef(e);
  if (choice === 'risky' && 'risky' in def && def.risky) {
    const ok = nextRandom(g) < def.risky.chance, o = ok ? def.risky.success : def.risky.fail;
    if (o.stats) applyEffects(g, o.stats, B.riskyMult);
    if (o.merit) addMerit(g, o.merit * 20);
    if (o.affection) g.life.affection += o.affection * 10;
    log(g, `${def.title} → ${def.risky.label} (${ok ? 'สำเร็จ' : 'ล้มเหลว'})`);
    return { success: ok };
  }
  const c = def.choices[choice as number] ?? def.choices[0];
  applyEffects(g, c.effects);
  log(g, `${def.title} → ${c.label}`);
  return {};
}

export interface ResolveResult { text?: string; success?: boolean; }

/** แก้เหตุการณ์ตัวแรกในคิว · choice = ลำดับตัวเลือก, 'risky' = เสี่ยงดวง, หรือ EndingId สำหรับฉากจบ */
export function resolveEvent(g: GameState, choice?: number | 'risky' | EndingId): ResolveResult {
  const e = g.queue.shift();
  if (!e) return {};
  if (e.kind === 'karma') return applyKarma(g, e, (choice as number | 'risky') ?? autoChoice(g, e));
  if (e.kind === 'hist') {
    const h = content.historical.find(x => x.id === e.id)!, L = g.life;
    if (h.kind === 'check') {
      const p = clamp(B.checkBase + B.checkSlope * frac(L, h.checkStat!), 0, B.checkMax);
      const ok = nextRandom(g) < p;
      if (ok) L.affection += B.affectionHistSuccess;
      else { L.money *= 1 - B.checkFailLoss; L.assets *= 1 - B.checkFailLoss; }
      log(g, `${h.title}: ${ok ? 'ผ่าน' : 'ไม่ผ่าน'}`);
      return { success: ok };
    }
    if (h.kind === 'choice') { const i = (choice as number) ?? autoChoice(g, e); remember(g, h.id, i); applyEffects(g, h.choices![i].effects); log(g, `${h.title} → ${h.choices![i].label}`); return {}; }
    log(g, h.title);
    return {};
  }
  if (e.kind === 'lifeEnd') { startNextLife(g); return {}; }
  if (e.kind === 'finale') return chooseEnding(g, (choice as EndingId) ?? 'fight');
  return {};
}

// ---------- จบชาติ / ฉากจบ ----------
function endLife(g: GameState) {
  const L = g.life;
  // ย้อนวันสุดท้ายกลับให้ปีไม่เกินช่วงชาติ
  L.day = (L.endYear - L.startYear + 1) * D - 1;
  if (L.career) { g.careerMaxLevel[L.career] = Math.max(g.careerMaxLevel[L.career] ?? 0, L.level); g.careerLives[L.career] = (g.careerLives[L.career] ?? 0) + 1; }
  const statsFrac: Record<string, number> = {};
  for (const s of STAT_KEYS) statsFrac[s] = +(L.stats[s] / L.cap).toFixed(3);
  const summary: LifeSummary = { life: L.idx, career: L.career, level: L.level, merit: Math.round(g.merit), money: L.money, affection: L.affection, statsFrac };
  g.collection.family.push({ ...summary, loop: g.loop });
  log(g, `สิ้นชีวิต — ${L.career ?? 'ไม่มีอาชีพ'} Lv.${L.level}`);
  g.queue = g.queue.filter(isMain);
  if (L.idx < NUM_LIVES) g.queue.push({ kind: 'lifeEnd', summary });
  else g.queue.push({ kind: 'finale', options: endingOptions(g) });
}

function startNextLife(g: GameState) {
  g.life = makeLife(g, g.life.idx + 1, g.life);
  log(g, `เกิดใหม่เป็นชาติที่ ${g.life.idx}`);
}

export function endingOptions(g: GameState): EndingId[] {
  const L = g.life, o: EndingId[] = ['fight'];
  if (g.peakFleeFrac >= B.fleeFrac) o.push('flee');
  if (g.merit >= B.reincarnateMerit) o.push('reincarnate');
  if (g.loop >= 2 && frac(L, 'ต่อสู้') >= B.defendTosuFrac && frac(L, 'โภคทรัพย์') >= B.defendPoksapFrac) o.push('defend');
  return o;
}

function chooseEnding(g: GameState, id: EndingId): ResolveResult {
  if (!endingOptions(g).includes(id)) id = 'fight';
  if (id === 'reincarnate') {
    g.loop++; g.peakFleeFrac = 0;
    g.life = makeLife(g, 1, g.life);
    if (!g.collection.endings.includes('reincarnate')) g.collection.endings.push('reincarnate');
    log(g, `ทวิภพ — ย้อนกลับมาเกิดใหม่ (รอบที่ ${g.loop})`);
    return { text: 'reincarnate' };
  }
  if (id === 'defend') {
    const p = clamp(B.siegeBase + B.siegeSlope * frac(g.life, 'ต่อสู้'), 0, 0.97);
    let fails = 0;
    for (let i = 0; i < content.siege.length; i++) if (nextRandom(g) >= p) fails++;
    const ok = fails <= B.siegeMaxFails;
    g.ending = ok ? 'defended' : 'fight';
    if (!g.collection.endings.includes(g.ending)) g.collection.endings.push(g.ending);
    return { success: ok, text: `พลาด ${fails} ครั้ง` };
  }
  g.ending = id;
  if (!g.collection.endings.includes(id)) g.collection.endings.push(id);
  return { text: id };
}

// ---------- การกระทำของผู้เล่น ----------
export function setPath(g: GameState, path: PathKey) { g.life.path = path; }
export function setTrain(g: GameState, stats: StatKey[]) { g.life.train = stats.slice(0, 2); }
export function chooseChildJob(g: GameState, key: string) { if (ageOf(g.life) < B.careerMinAge) g.life.childJob = key; }
export function chooseCareer(g: GameState, key: string): boolean {
  const L = g.life;
  if (ageOf(L) < B.careerMinAge || L.career) return false;
  L.career = key; L.level = 0; L.track = null;
  log(g, `เลือกอาชีพ ${key}`);
  return true;
}
export function chooseTrack(g: GameState, side: 'light' | 'dark') { if (!g.life.track) g.life.track = side; }

export const gateFrac = (lv: number) => B.gateA + B.gateB * Math.pow(lv / B.maxLevel, B.gateP);
export const affectionReq = (lv: number) => B.affectionReqA * Math.pow(lv, B.affectionReqP);
export const promoteCost = (lv: number) => B.promoteCostBase * Math.pow(B.promoteCostGrowth, lv);
export function gateValue(g: GameState, lv: number): number {
  const L = g.life, c = career(L.career!), w = B.secondaryWeightMax * (lv / B.maxLevel);
  return frac(L, c.gateStat) * (1 - w) + frac(L, c.secondaryStat) * w;
}

export type PromoteBlock = 'noCareer' | 'max' | 'cooldown' | 'stat' | 'affection' | 'money' | 'needTrack';
export function promoteBlock(g: GameState): PromoteBlock | null {
  const L = g.life;
  if (!L.career) return 'noCareer';
  if (L.level >= B.maxLevel) return 'max';
  const t = L.level + 1;
  if (t >= B.lightDarkLevel && !L.track) return 'needTrack';
  if (L.day - L.lastPromoteDay < B.promoteCooldownDays) return 'cooldown';
  if (gateValue(g, t) < gateFrac(t)) return 'stat';
  if (L.affection < affectionReq(t)) return 'affection';
  if (L.money < promoteCost(L.level)) return 'money';
  return null;
}
export function promoteChance(g: GameState): number {
  const t = g.life.level + 1;
  return clamp(B.promoteBaseChance + B.promoteSlope * (gateValue(g, t) - gateFrac(t)), 0, B.promoteMaxChance);
}
export function tryPromote(g: GameState): { ok: boolean; block?: PromoteBlock } {
  const block = promoteBlock(g);
  if (block) return { ok: false, block };
  const L = g.life;
  L.money -= promoteCost(L.level); L.lastPromoteDay = L.day;
  const ok = nextRandom(g) < promoteChance(g);
  if (ok) {
    L.level++; g.stats.promotions++;
    const key = `${L.career}|${L.level < B.lightDarkLevel ? 'ร่วม' : L.track}|${L.level}`;
    if (!g.collection.titles.includes(key)) g.collection.titles.push(key);
    log(g, `เลื่อนยศเป็น ${careerTitle(L.career!, L.level, L.track)}`);
  }
  return { ok };
}

const discount = (L: LifeState) => 1 - B.witDiscount * frac(L, 'ไหวพริบ');
function pay(g: GameState, price: number, assetValue = price): boolean {
  const L = g.life, cost = price * discount(L);
  if (L.money < cost) return false;
  L.money -= cost; L.assets += assetValue; return true;
}
export function careerItemPrice(g: GameState): number | null {
  const L = g.life; if (!L.career) return null;
  const items = content.shop.careerItems[L.career], lv = L.careerItem[L.career] ?? 0;
  return lv < items.length ? items[lv].legacyPrice : null;
}
export function buyCareerItem(g: GameState): boolean {
  const L = g.life, p = careerItemPrice(g);
  if (p == null || !pay(g, p)) return false;
  L.careerItem[L.career!] = (L.careerItem[L.career!] ?? 0) + 1; return true;
}
export const accommodationPrice = (L: LifeState) => content.shop.accommodations[L.accommodation]?.legacyPrice ?? null;
export const retainerPrice = (L: LifeState) => content.shop.retainers[L.retainer]?.legacyPrice ?? null;
export function buyAccommodation(g: GameState) { const p = accommodationPrice(g.life); if (p == null || !pay(g, p)) return false; g.life.accommodation++; return true; }
export function buyRetainer(g: GameState) { const p = retainerPrice(g.life); if (p == null || !pay(g, p)) return false; g.life.retainer++; return true; }
export const donationPrice = (L: LifeState, i: number) => content.shop.meritItems[i].legacyPrice * Math.pow(B.donationPriceGrowth, L.donations[i]);
export function donate(g: GameState, i: number): boolean {
  const L = g.life;
  if (!pay(g, donationPrice(L, i), 0)) return false;
  L.donations[i]++; addMerit(g, content.shop.meritItems[i].legacyMerit); return true;
}
export const commonPrice = (L: LifeState, i: number) => content.shop.commonItems[i].legacyPrice * 4 * Math.pow(1.10, L.common[i]);
export function buyCommon(g: GameState, i: number): boolean {
  const L = g.life, it = content.shop.commonItems[i];
  if (!pay(g, commonPrice(L, i), 0)) return false;
  L.common[i]++;
  L.stats[it.stat] = clamp(L.stats[it.stat] + 0.004 * L.cap, 0, L.cap);
  if (it.legacyAffection) L.affection += 0.3;
  return true;
}
export function buyMega(g: GameState, id: string): boolean {
  const m = B.megaProjects.find(x => x.id === id)!, L = g.life;
  if (!pay(g, m.price * Math.pow(1.5, L.mega[id] ?? 0), 0)) return false;
  L.mega[id] = (L.mega[id] ?? 0) + 1; addMerit(g, m.merit); L.affection += m.affection; return true;
}

// ---------- ของให้แตะเก็บ (เฉพาะตอนเปิดแอป) ----------
export type PickupKind = 'coin' | 'flower' | 'leaf';
export function grantPickup(g: GameState, kind: PickupKind): string {
  const L = g.life;
  if (kind === 'coin') { const v = Math.max(0.01, dailyIncome(g) * 7); L.money += v; return `money:${v}`; }
  if (kind === 'flower') { L.affection += 0.15; return 'aff:0.15'; }
  const s = L.train[0] ?? 'ความรู้';
  const before = L.stats[s]; L.stats[s] = Math.min(L.cap, L.stats[s] + 0.003 * L.cap);
  return `stat:${s}:${(L.stats[s] - before) / L.cap}`;
}

// ---------- ข้อความสำหรับหน้าจอ ----------
export function careerTitle(key: string, level: number, track: 'light' | 'dark' | null): string {
  const t = career(key).titles;
  if (level < B.lightDarkLevel) return t[String(level) as '0' | '1'];
  return t[track ?? 'light'][String(level)] ?? '';
}
export function reignAt(g: GameState) {
  const y = yearOf(g.life);
  return content.reigns.find(r => r.life === g.life.idx && y >= r.from && y <= r.to) ?? content.reigns.find(r => r.life === g.life.idx)!;
}

// ---------- เซฟ ----------
export function serialize(g: GameState): string { g.savedAt = Date.now(); return JSON.stringify(g); }
export function deserialize(s: string): GameState { return JSON.parse(s) as GameState; }
/** จำนวนวันในเกมที่ควรเดินจากช่วงที่ปิดแอป */
export function offlineDays(g: GameState, now = Date.now()): number {
  return Math.max(0, Math.floor((now - g.savedAt) / 1000 / B.secondsPerGameDay));
}
