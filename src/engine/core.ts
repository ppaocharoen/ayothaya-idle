// ตัวเกมอโยธยา Idle — logic ล้วน ไม่แตะหน้าจอ ใช้ได้ทั้งในเบราว์เซอร์และในบอททดสอบ
// เวลาเดินทีละ "วัน" · ปิดแอปแล้วกลับมา เรียก advance(จำนวนวันที่หายไป) ได้เลย
import { content, lifeRange, NUM_LIVES } from '../content';
import { breedOf, petAge, petPower, petPrice, feedPrice, type Pet, type PetGrave } from './pets';
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
  | { kind: 'petGone'; grave: PetGrave }
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
  age?: number | null; year?: number; name?: string;
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
  sin: number;                          // บาปที่ซ่อนไว้ เปิดเผยตอนตาย
  health: number;                       // สุขภาพ 0–1 · หมดเมื่อไรสิ้นชีวิต
  joy: number;                          // ความสำราญ 0–1 · สูงได้บัฟ ต่ำโดนโทษ
  name: string; named: boolean;         // ชื่อตัวละครชาตินี้ (named = ผู้เล่นตั้งเองแล้ว)
  deathAge: number | null;              // อายุตอนตาย (null = ยังมีชีวิต)
  meritStart: number;                   // บุญตอนเกิด (ใช้คิดบุญที่ทำในชาตินี้)
  deeds: { id: string; c: number }[];   // ตัวเลือกที่เลือกในชาตินี้ (พญายมหยิบมาไต่สวน)
  sched: { karma: Scheduled[]; hist: HistSchedule[]; nextGeneric: number; bag: number[]; bagPtr: number; recent?: string[] };
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
  /** สัตว์เลี้ยง (ติดตามข้ามชาติจนสิ้นอายุ) · สัตว์ที่จากไป · นาฬิกาเกมรวม (วัน) */
  pet: Pet | null; petGraves: PetGrave[]; clock: number;
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
/** ชื่อไทยสมัยอยุธยาสำหรับสุ่มให้ตัวละคร (ผู้เล่นเปลี่ยนเองได้) */
export const NAMES = ['มั่น', 'คง', 'ทอง', 'ดี', 'จัน', 'บุญ', 'แก้ว', 'เพชร', 'เรือง', 'ศรี', 'อิน', 'ปาน', 'เกิด', 'สิน', 'มี', 'พุ่ม', 'ทับ', 'อ่อน', 'อยู่', 'ยิ้ม', 'ช่วย', 'นาค', 'เมือง', 'เหลือ', 'สุก', 'ขำ', 'เชย', 'จ้อย', 'ทิม', 'บัว'];
export function setName(g: GameState, name: string) { const n = name.trim().slice(0, 20); if (n) { g.life.name = n; g.life.named = true; } }

export function newGame(seed = Date.now()): GameState {
  const g = {
    version: 1, rng: seed >>> 0, loop: 1, merit: 0, careerMaxLevel: {}, careerLives: {}, peakFleeFrac: 0,
    queue: [], log: [], ending: null, pet: null, petGraves: [], clock: 0, savedAt: Date.now(), stats: { promotions: 0, eventsSeen: 0 },
    collection: { titles: [], endings: [], choices: {}, family: [] },
  } as unknown as GameState;
  g.life = makeLife(g, 1, null);
  log(g, 'เกิดเป็นไพร่น้อย ณ หนองโสน');
  return g;
}

function makeLife(g: GameState, idx: number, prev: LifeState | null, startYear?: number): LifeState {
  const r0 = lifeRange(idx), cap = capFor(idx);
  // เกิดเร็วกว่ากำหนดได้ (ผ่านยมโลกเร็ว) แต่ปีจบของชาติยังเท่าเดิม
  const r = { from: Math.min(r0.from, startYear ?? r0.from), to: r0.to };
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
    lastPromoteDay: -9999, peakFrac: peak, sin: 0, meritStart: g.merit, deeds: [], health: 1, deathAge: null, joy: B.joyStart, name: NAMES[randInt(g, 0, NAMES.length - 1)], named: false,
    sched: { karma: [], hist: [], nextGeneric: 0, bag: [], bagPtr: 0 },
  };
  for (const k of content.karmaFixed.filter(k => k.life === idx))
    L.sched.karma.push({ id: k.id, day: (k.year - r.from) * D + randInt(g, 0, D - 1) });
  // เหตุการณ์ประวัติศาสตร์ผูกกับปี (ไม่ใช่เลขชาติ) — เกิดเร็วก็ได้เห็นเหตุการณ์ช่วงท้ายของชาติก่อน
  for (const h of content.historical.filter(h => Math.max(h.yearTo, h.yearFrom) >= r.from && h.yearFrom <= r.to)) {
    // ฉากบรรยายในปีแรกของชาติ (เช่น เปิดเกม) เกิดวันแรกเลย
    const y0 = Math.max(h.yearFrom, r.from);
    const start = h.yearFrom === r.from && h.kind === 'narrative' ? 1 : (y0 - r.from) * D + randInt(g, 0, D - 1);
    L.sched.hist.push({ id: h.id, next: start, until: (h.yearTo - r.from + 1) * D - 1, repeat: h.kind === 'check' && h.yearTo > h.yearFrom });
  }
  L.sched.nextGeneric = (B.teenGenericFromAge - B.startAge) * D + randInt(g, B.teenGenericMinDays, B.teenGenericMaxDays);
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

/** สุขภาพลดต่อวัน: เริ่มเสื่อมหลังอายุ 35 · บ้านดีและร่างกายแข็งแรงช่วยชะลอ */
export function healthDecay(g: GameState): number {
  const L = g.life, age = ageOf(L);
  const perYear = B.healthBase + Math.max(0, age - B.healthAgeFrom) * B.healthPerYear;
  return perYear / D * (1 - B.healthHouse * L.accommodation) * (1 - B.healthStrength * frac(L, 'พละกำลัง'));
}

/** บัฟจากความสำราญ: สูงทำงาน/ฝึกได้ผลมากขึ้น ต่ำได้ผลน้อยลง (ไล่ระดับ) */
export function joyEff(L: LifeState): number {
  if (L.joy >= B.joyHigh) return 1 + B.joyBuff * (L.joy - B.joyHigh) / (1 - B.joyHigh);
  if (L.joy <= B.joyLow) return 1 - B.joyPenalty * (B.joyLow - L.joy) / B.joyLow;
  return 1;
}

function stepDay(g: GameState, eff = 1) {
  const L = g.life, p = B.paths[L.path], age = ageOf(L);
  eff *= joyEff(L);
  // ฝึกฝน
  const te = trainEff(L) * talent(g) * eff;
  for (const s of L.train) grow(L, s, B.trainRate * (p.train / L.train.length) * te);
  // ทำงาน
  if (age < B.careerMinAge) {
    const job = content.childJobs.find(j => j.key === L.childJob);
    if (job) for (const s of job.stats) grow(L, s, B.childJobRate * p.work / job.stats.length * eff);
  } else if (L.career) {
    const c = career(L.career), we = workEff(g) * eff;
    grow(L, c.gateStat, B.workPrimaryRate * (B.careerWorkMul[c.key] ?? 1) * p.work * we);
    grow(L, c.secondaryStat, B.workSecondaryRate * p.work * we);
    L.affection += B.affectionWork * p.work * (1 + B.affectionPerLevel * L.level);
  }
  L.money += dailyIncome(g) * eff;
  if (L.track === 'dark') L.sin += B.sinDarkDaily;
  L.health -= healthDecay(g) * (L.joy > B.joyHigh ? B.joyHealthGood : L.joy < B.joyLow ? B.joyHealthBad : 1);
  // ความสำราญ: ลดทุกวัน (ทำงานหนักลดเร็ว) · บ้านดีช่วยพยุง
  L.joy = clamp(L.joy - B.joyDecay * (0.4 + p.work) * (age < 18 ? B.joyChildDecay : 1) / D + B.joyHouse * L.accommodation / D, 0, 1);
  if (L.day % D === D - 1 && age >= B.illnessFromAge && nextRandom(g) < B.illnessChance * (L.joy < B.joyLow ? 1.5 : 1)) {
    L.health -= (B.illnessMin + nextRandom(g) * (B.illnessMax - B.illnessMin));
    log(g, 'ล้มป่วยหนัก สุขภาพทรุดลง');
  }
  addMerit(g, (B.meritDaily * p.merit + B.meritPassive) * (1 + B.meritBaramiBonus * frac(L, 'บารมี')) * eff);
  for (const s of STAT_KEYS) if (L.stats[s] / L.cap > L.peakFrac[s]) L.peakFrac[s] = L.stats[s] / L.cap;
  if (L.peakFrac['หลบหลีก'] > g.peakFleeFrac) g.peakFleeFrac = L.peakFrac['หลบหลีก'];
  L.day++; g.clock++;
  petDay(g, eff);
}

// ---------- สัตว์เลี้ยง ----------
function petDay(g: GameState, eff: number) {
  const p = g.pet; if (!p) return;
  const L = g.life, b = breedOf(p.breed);
  p.full = Math.max(0, p.full - B.petHunger);
  if (p.full <= 0) p.bond = Math.max(0, p.bond - B.petBondStarve);
  else if (p.full > 0.5) p.bond = Math.min(1, p.bond + B.petBondDaily);
  const pw = petPower(p);
  L.joy = clamp(L.joy + b.joy * pw / D, 0, 1);
  for (const s of b.stats) grow(L, s, B.petStatRate * pw * eff);
  if (petAge(p, g.clock) >= p.lifespan) {
    const grave: PetGrave = { breed: p.breed, name: p.name, age: Math.floor(petAge(p, g.clock)), year: yearOf(L) };
    g.petGraves.push(grave); g.pet = null;
    g.queue.push({ kind: 'petGone', grave });
    log(g, `${grave.name} ${b.name} จากไปอย่างสงบเมื่ออายุ ${grave.age} ปี`);
  }
}
export function buyPet(g: GameState, breed: string): boolean {
  if (g.pet) return false;
  const price = petPrice(dailyIncome(g)); if (!pay(g, price, 0)) return false;
  const b = breedOf(breed);
  g.pet = { breed, name: b.name.replace(/^(หมา|แมว|นก)/, ''), born: g.clock, lifespan: b.life[0] + nextRandom(g) * (b.life[1] - b.life[0]), full: 0.8, bond: 0.15, trained: 0, lastFed: -99, lastTrained: -99, playsToday: 0, playDay: -1 };
  log(g, `รับ${b.name}มาเลี้ยง`);
  return true;
}
export function feedPet(g: GameState): boolean {
  const p = g.pet; if (!p || p.full > 0.95) return false;
  if (!pay(g, feedPrice(dailyIncome(g)), 0)) return false;
  p.full = 1; if (g.clock - p.lastFed >= 1) p.bond = Math.min(1, p.bond + B.petBondFeed); p.lastFed = g.clock;
  return true;
}
/** เล่นกับสัตว์ (ได้ผลสูงสุดวันละ 3 ครั้งในเกม) · คืนค่าว่าได้ผลไหม */
export function playPet(g: GameState): boolean {
  const p = g.pet; if (!p) return false;
  if (p.playDay !== g.clock) { p.playDay = g.clock; p.playsToday = 0; }
  if (p.playsToday >= 3) return false;
  p.playsToday++; p.bond = Math.min(1, p.bond + B.petBondPlay); g.life.joy = clamp(g.life.joy + 0.01, 0, 1);
  return true;
}
/** ฝึกสัตว์ (มินิเกม) · hits จาก total · พักฝึกได้ทุก 7 วันในเกม */
export const trainReady = (g: GameState) => !!g.pet && g.clock - g.pet.lastTrained >= B.petTrainCooldown;
export function trainPet(g: GameState, hits: number, total: number) {
  const p = g.pet; if (!p || !trainReady(g)) return;
  p.lastTrained = g.clock; p.trained = Math.min(1, p.trained + B.petTrainGain * hits / total); p.bond = Math.min(1, p.bond + 0.01);
}
export function setPetName(g: GameState, name: string) { const n = name.trim().slice(0, 20); if (g.pet && n) g.pet.name = n; }

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
  const fixedNear = L.sched.karma.some(k => k.day >= L.day && k.day - L.day <= B.genericGapToFixed);
  if (L.day >= L.sched.nextGeneric && !fixedNear) {
    const k = pickGeneric(g);
    if (k) out.push({ kind: 'karma', id: k.id, generic: true });
    const teen = ageOf(L) < B.genericStartAge;
    L.sched.nextGeneric = L.day + (teen ? randInt(g, B.teenGenericMinDays, B.teenGenericMaxDays) : randInt(g, B.genericMinDays, B.genericMaxDays));
  }
  return out;
}

export const isMain = (e: PendingEvent) => e.kind !== 'karma';

/** เลือกกงกรรมทั่วไปถัดไป: วัยรุ่นได้เฉพาะสันทนาการ/สุขภาพ · ความสำราญ/สุขภาพต่ำ มีโอกาสได้หมวดนั้นก่อน · ไม่ซ้ำเรื่องที่เพิ่งเห็น */
function pickGeneric(g: GameState) {
  const L = g.life, all = content.karmaGeneric, sc = L.sched;
  sc.recent ??= [];
  if (sc.bag.length !== all.length || sc.bagPtr >= sc.bag.length) { sc.bag = shuffle(g, all.length); sc.bagPtr = 0; } // เซฟเก่าที่ถุงยังไม่มีเรื่องใหม่
  const teen = ageOf(L) < B.genericStartAge;
  const allowed = (k: typeof all[number]) => !teen || k.tag === 'fun' || k.tag === 'health';
  const fresh = (k: typeof all[number]) => !sc.recent!.includes(k.id);
  let want: 'fun' | 'health' | null = null;
  if (L.health < B.needHealthBelow && nextRandom(g) < B.needHealthChance) want = 'health';
  else if (L.joy < B.needJoyBelow && nextRandom(g) < B.needChance) want = 'fun';
  let pick: typeof all[number] | undefined;
  if (want) {
    const pool = all.filter(k => (k.tag === want || (want === 'fun' && k.tag === 'vice' && !teen)) && fresh(k));
    if (pool.length) pick = pool[randInt(g, 0, pool.length - 1)];
  }
  // ไม่งั้นหยิบจากถุงสุ่ม (ข้ามเรื่องที่วัยนี้ไม่ควรเจอ)
  for (let tries = 0; !pick && tries < all.length; tries++) {
    if (sc.bagPtr >= sc.bag.length) { sc.bag = shuffle(g, all.length); sc.bagPtr = 0; }
    const k = all[sc.bag[sc.bagPtr++]];
    if (allowed(k) && fresh(k)) pick = k;
  }
  if (pick) { sc.recent.push(pick.id); if (sc.recent.length > 12) sc.recent.shift(); }
  return pick;
}
/** ตอนปิดแอปได้ผลน้อยกว่าเปิดเล่น — บ้านดี (พักผ่อนดี) ได้ผลใกล้เต็ม */
export const awayEff = (L: LifeState) => Math.min(1, B.awayBase + B.awayPerHouse * L.accommodation);

// ---------- ให้เวลาเดิน ----------
export interface AdvanceResult { days: number; stopped: 'done' | 'event' | 'ended'; autoResolved: number; }

/**
 * เดินเวลาไม่เกิน `days` วัน หยุดเมื่อมีเหตุการณ์หลัก (เสมอ) หรือเหตุการณ์ย่อย (เฉพาะตอนเปิดแอปอยู่)
 * ตอนปิดแอป เหตุการณ์ย่อยเก็บไว้ไม่เกิน offlineQueueMax ที่เกินจะเลือกให้ตามแนวทางชีวิต
 */
export function advance(g: GameState, days: number, opts: { online: boolean; away?: boolean }): AdvanceResult {
  let n = 0, auto = 0;
  const eff = opts.away ? awayEff(g.life) : 1;
  while (n < days) {
    if (g.ending) return { days: n, stopped: 'ended', autoResolved: auto };
    if (g.queue.some(isMain) || (opts.online && g.queue.length)) return { days: n, stopped: 'event', autoResolved: auto };
    stepDay(g, eff); n++;
    if (yearOf(g.life) > g.life.endYear || g.life.health <= 0) { endLife(g); continue; }
    for (const e of collectDue(g)) {
      g.stats.eventsSeen++;
      if (isMain(e) || opts.online || g.queue.length < B.offlineQueueMax) { g.queue.push(e); continue; }
      // ช่องเก็บตอนปิดแอปเต็ม: เก็บเรื่องสันทนาการ/สุขภาพไว้ให้ผู้เล่นเลือกเอง แทนเรื่องทั่วไปที่ค้างอยู่
      let ke = e as Extract<PendingEvent, { kind: 'karma' }>;
      const tagged = (x: PendingEvent) => x.kind === 'karma' && x.generic && !!content.karmaGeneric.find(k => k.id === x.id)?.tag;
      if (tagged(e)) {
        const i = g.queue.findIndex(x => x.kind === 'karma' && !tagged(x));
        if (i >= 0) { const old = g.queue[i] as typeof ke; g.queue[i] = e; ke = old; }
      }
      applyKarma(g, ke, autoChoice(g, ke)); auto++;
    }
  }
  return { days: n, stopped: g.queue.length ? 'event' : 'done', autoResolved: auto };
}

// ---------- แก้เหตุการณ์ ----------
function applyEffects(g: GameState, e: Effects, mult = 1) {
  const L = g.life;
  for (const [k, v] of Object.entries(e) as [string, number][]) {
    if (k === 'ความชอบ') { L.affection = Math.max(0, L.affection + v); continue; }
    // ค่าชีวิต: เงินคิดเป็นจำนวนวันของรายได้ (ใช้ได้ทุกช่วงยศ) · สุขภาพ/สำราญ เป็นสัดส่วน
    const lm = Math.min(mult, 1.5); // ค่าชีวิตจากการเสี่ยงดวงไม่คูณแรงเท่าสเตตัส
    if (k === 'เงิน') { L.money = Math.max(0, L.money + v * lm * B.effMoneyDays * Math.max(dailyIncome(g), B.childWage * 0.5)); continue; }
    if (k === 'สุขภาพ') { L.health = Math.min(1, L.health + v * lm * B.effHealth * (v > 0 ? B.effHealthHeal : 1)); continue; }
    if (k === 'สำราญ') { L.joy = clamp(L.joy + v * lm * B.effJoy, 0, 1); continue; }
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
  g.life.deeds.push({ id, c: choice }); if (g.life.deeds.length > 60) g.life.deeds.shift();
  // บาปจากตัวเลือก (ถ้าเนื้อหาระบุไว้)
  const d = content.karmaFixed.find(x => x.id === id) ?? content.karmaGeneric.find(x => x.id === id) ?? content.historical.find(x => x.id === id);
  const picked = d && (choice < 0 ? (d as { risky?: { sin?: number } }).risky : d.choices?.[choice]);
  if (picked && (picked as { sin?: number }).sin) g.life.sin += (picked as { sin?: number }).sin!;
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
  if (e.kind === 'petGone') return {};
  if (e.kind === 'lifeEnd') { startNextLife(g, typeof choice === 'number' ? choice : undefined); return {}; }
  if (e.kind === 'finale') return chooseEnding(g, (choice as EndingId) ?? 'fight');
  return {};
}

// ---------- จบชาติ / ฉากจบ ----------
function endLife(g: GameState) {
  const L = g.life;
  // ตายตามอายุขัย: ย้อนวันสุดท้ายกลับให้ปีไม่เกินช่วงชาติ · ตายก่อนวัย: วันนั้นคือวันตาย
  if (yearOf(L) > L.endYear) L.day = (L.endYear - L.startYear + 1) * D - 1;
  L.health = Math.max(0, L.health); L.deathAge = ageOf(L);
  if (L.career) { g.careerMaxLevel[L.career] = Math.max(g.careerMaxLevel[L.career] ?? 0, L.level); g.careerLives[L.career] = (g.careerLives[L.career] ?? 0) + 1; }
  const statsFrac: Record<string, number> = {};
  for (const s of STAT_KEYS) statsFrac[s] = +(L.stats[s] / L.cap).toFixed(3);
  const summary: LifeSummary = { life: L.idx, career: L.career, level: L.level, merit: Math.round(g.merit), money: L.money, affection: L.affection, statsFrac, age: L.deathAge, year: yearOf(L), name: L.name };
  g.collection.family.push({ ...summary, loop: g.loop });
  log(g, `สิ้นชีวิตเมื่ออายุ ${L.deathAge} — ${L.career ?? 'ไม่มีอาชีพ'} Lv.${L.level}`);
  g.queue = g.queue.filter(isMain);
  if (L.idx < NUM_LIVES) g.queue.push({ kind: 'lifeEnd', summary });
  else g.queue.push({ kind: 'finale', options: endingOptions(g) });
}

/** waitYears = ปีที่รอในยมโลก · ไม่ระบุ = เกิดตามกำหนดเดิม */
export function rebirthYear(g: GameState, waitYears?: number): number {
  const next = lifeRange(g.life.idx + 1).from;
  if (waitYears == null) return next;
  return Math.min(next, yearOf(g.life) + 1 + Math.round(waitYears));
}
function startNextLife(g: GameState, waitYears?: number) {
  const y = rebirthYear(g, waitYears);
  g.life = makeLife(g, g.life.idx + 1, g.life, y);
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

export type PromoteBlock = 'noCareer' | 'max' | 'cooldown' | 'stat' | 'affection' | 'money' | 'needTrack' | 'house';
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
  if (L.accommodation < houseReq(t)) return 'house';
  return null;
}
/** จำนวนขั้นที่พำนักที่ต้องมีก่อนขึ้นยศ t (ยศสูงต้องมีบ้านสมฐานะ) */
export function houseReq(t: number): number {
  let need = 0;
  for (const [lv, n] of B.promoteHouseReq) if (t >= lv) need = n;
  return need;
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
/** ยศขั้นต่ำที่ต้องมีก่อนซื้อชิ้นถัดไป (null = ซื้อได้) · -1 = ยังไม่มีอาชีพ (เด็กยังอยู่บ้านพ่อแม่) */
export function careerItemReq(g: GameState): number | null {
  const L = g.life; if (!L.career) return -1;
  const need = B.careerItemMinLevel[L.careerItem[L.career] ?? 0] ?? 0;
  return L.level >= need ? null : need;
}
export function accommodationReq(g: GameState): number | null {
  const L = g.life; if (!L.career) return -1;
  const need = B.accommodationMinLevel[L.accommodation] ?? 0;
  return L.level >= need ? null : need;
}
export function retainerReq(g: GameState): number | null {
  const L = g.life; if (!L.career) return -1;
  const need = B.retainerMinLevel[L.retainer] ?? 0;
  return L.level >= need ? null : need;
}
export function buyCareerItem(g: GameState): boolean {
  const L = g.life, p = careerItemPrice(g);
  if (p == null || careerItemReq(g) != null || !pay(g, p)) return false;
  L.careerItem[L.career!] = (L.careerItem[L.career!] ?? 0) + 1; return true;
}
// ราคาบ้าน/บริวารผูกกับค่ายื่นเลื่อนยศของยศขั้นต่ำที่ต้องมี (ให้ซื้อได้ทันเวลาที่ยศถึง)
export const accommodationPrice = (L: LifeState) => content.shop.accommodations[L.accommodation] ? B.housePriceK * promoteCost(B.accommodationMinLevel[L.accommodation] ?? 0) : null;
export const retainerPrice = (L: LifeState) => content.shop.retainers[L.retainer] ? B.retainerPriceK * promoteCost(B.retainerMinLevel[L.retainer] ?? 0) : null;
export function buyAccommodation(g: GameState) { const p = accommodationPrice(g.life); if (p == null || accommodationReq(g) != null || !pay(g, p)) return false; g.life.accommodation++; return true; }
export function buyRetainer(g: GameState) { const p = retainerPrice(g.life); if (p == null || retainerReq(g) != null || !pay(g, p)) return false; g.life.retainer++; return true; }
export const donationPrice = (L: LifeState, i: number) => content.shop.meritItems[i].legacyPrice * Math.pow(B.donationPriceGrowth, L.donations[i]);
export function donate(g: GameState, i: number): boolean {
  const L = g.life;
  if (!pay(g, donationPrice(L, i), 0)) return false;
  L.donations[i]++; addMerit(g, content.shop.meritItems[i].legacyMerit); return true;
}
export const commonPrice = (L: LifeState, i: number) => content.shop.commonItems[i].legacyPrice * 4 * Math.pow(B.commonPriceGrowth, L.common[i]);
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
  return content.reigns.find(r => r.life === g.life.idx && y >= r.from && y <= r.to) ?? content.reigns.find(r => y >= r.from && y <= r.to) ?? content.reigns.find(r => r.life === g.life.idx)!;
}

// ---------- เซฟ ----------
export function serialize(g: GameState): string { g.savedAt = Date.now(); return JSON.stringify(g); }
export function deserialize(s: string): GameState {
  const g = JSON.parse(s) as GameState;
  // เซฟรุ่นเก่ายังไม่มีช่องบาป/การกระทำ
  g.life.sin ??= 0; g.life.meritStart ??= g.merit; g.life.deeds ??= []; g.life.health ??= 1; g.life.deathAge ??= null; g.life.joy ??= B.joyStart; g.life.name ??= NAMES[0]; g.life.named ??= true; g.pet ??= null; g.petGraves ??= []; g.clock ??= 0;
  return g;
}
/** จำนวนวันในเกมที่ควรเดินจากช่วงที่ปิดแอป */
export function offlineDays(g: GameState, now = Date.now()): number {
  return Math.max(0, Math.floor((now - g.savedAt) / 1000 / B.secondsPerGameDay));
}
