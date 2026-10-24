// บอททดสอบสมดุล: เล่นครบ 7 ชาติ (และรอบทวิภพ) ทุกอาชีพ × หลายแนวทาง × หลาย seed แล้วเทียบกับเป้าหมาย
// ใช้: npm run sim            (สรุป + ผ่าน/ไม่ผ่าน)
//      npm run sim -- --detail (พิมพ์ผลรายชาติ)
import { content } from '../src/content';
import { BALANCE as B, type PathKey } from '../src/engine/balance';
import * as E from '../src/engine/core';

type Strategy = { career: string; path: PathKey; spend: 'growth' | 'merit'; seed: number };
interface LifeRec { loop: number; life: number; level: number; lv19Age: number | null; merit: number; meritHitAge: number | null;
  income: number; moneyLeft: number; affBlockDays: number; statBlockDays: number; checks: number; fleeFrac: number; minor: number; main: number; }
interface RunRec { s: Strategy; lives: LifeRec[]; ending: string; siegeOk: boolean | null; }

function play(s: Strategy, maxLoops = 2): RunRec {
  const g = E.newGame(s.seed);
  const c = content.careers.careers.find(x => x.key === s.career)!;
  const childJob = content.childJobs.find(j => j.suggests.includes(s.career))?.key ?? content.childJobs[0].key;
  E.setPath(g, s.path); E.setTrain(g, [c.gateStat, c.secondaryStat]); E.chooseChildJob(g, childJob);
  const lives: LifeRec[] = [];
  let cur = newRec(g), prevMoney = 0, siegeOk: boolean | null = null;
  function newRec(g: E.GameState): LifeRec { return { loop: g.loop, life: g.life.idx, level: 0, lv19Age: null, merit: 0, meritHitAge: null, income: 0, moneyLeft: 0, affBlockDays: 0, statBlockDays: 0, checks: 0, fleeFrac: 0, minor: 0, main: 0 }; }

  for (let guard = 0; guard < 100000; guard++) {
    if (g.ending) break;
    const before = g.life.money;
    const r = E.advance(g, 15, { online: false });
    cur.income += Math.max(0, g.life.money - before);
    // จัดการเหตุการณ์
    while (g.queue.length) {
      const e = g.queue[0];
      if (e.kind === 'karma') { cur.minor++; E.resolveEvent(g); continue; }
      if (e.kind === 'hist') { cur.main++; E.resolveEvent(g); continue; }
      if (e.kind === 'lifeEnd') {
        Object.assign(cur, { level: g.life.level, merit: Math.round(g.merit), moneyLeft: g.life.money, fleeFrac: g.life.peakFrac['หลบหลีก'], g19: g.life.career ? +E.gateValue(g, 19).toFixed(3) : 0 });
        lives.push(cur); E.resolveEvent(g); cur = newRec(g); E.chooseChildJob(g, childJob); prevMoney = 0; continue;
      }
      if (e.kind === 'finale') {
        Object.assign(cur, { level: g.life.level, merit: Math.round(g.merit), moneyLeft: g.life.money, fleeFrac: g.life.peakFrac['หลบหลีก'] });
        lives.push(cur);
        const opts = e.options;
        if (process.argv.includes('--finale')) console.log(s.career, s.path, 'รอบ', g.loop, opts.join(','), 'ต่อสู้', E.frac(g.life, 'ต่อสู้').toFixed(2), 'โภคทรัพย์', E.frac(g.life, 'โภคทรัพย์').toFixed(2));
        const pick: E.EndingId = opts.includes('defend') ? 'defend' : (opts.includes('reincarnate') && g.loop < maxLoops) ? 'reincarnate' : opts.includes('flee') ? 'flee' : 'fight';
        const res = E.resolveEvent(g, pick);
        if (pick === 'defend') siegeOk = !!res.success;
        if (!g.ending) { cur = newRec(g); E.chooseChildJob(g, childJob);
          // รอบทวิภพ: สายทหารที่ตั้งใจปกป้องกรุง จะฝึกต่อสู้ + โภคทรัพย์
          if (s.career === 'ทหาร') E.setTrain(g, ['ต่อสู้', 'โภคทรัพย์']); }
        continue;
      }
    }
    if (g.ending) break;
    void r; void prevMoney;
    const L = g.life, age = E.ageOf(L);
    if (age >= B.careerMinAge && !L.career) E.chooseCareer(g, s.career);
    if (L.career) {
      if (!L.track && L.level + 1 >= B.lightDarkLevel) E.chooseTrack(g, 'light');
      const blk = E.promoteBlock(g);
      cur.checks++;
      if (blk === 'affection') cur.affBlockDays++;
      if (blk === 'stat') cur.statBlockDays++;
      // ซื้อของ: ของสายอาชีพ → บริวาร → ที่พัก (เก็บเงินไว้ยื่นเลื่อนยศ)
      const reserve = E.promoteCost(L.level) * 2;
      const tryBuy = (price: number | null, fn: () => boolean) => { if (price != null && L.money - price > reserve) fn(); };
      tryBuy(E.careerItemPrice(g), () => E.buyCareerItem(g));
      tryBuy(E.retainerPrice(L), () => E.buyRetainer(g));
      tryBuy(E.accommodationPrice(L), () => E.buyAccommodation(g));
      if (blk === 'affection') {
        const i = content.shop.commonItems.findIndex(x => x.legacyAffection > 0);
        for (let k = 0; k < 5; k++) if (L.money - E.commonPrice(L, i) > reserve) E.buyCommon(g, i);
      }
      // เงินที่เหลือ: ทำบุญ (merit) หรือเก็บไว้ (growth จะทำบุญเฉพาะตอนแก่)
      const spendMerit = s.spend === 'merit' || age >= 55;
      if (spendMerit) {
        for (const m of [...B.megaProjects].reverse()) if (L.money - m.price * Math.pow(1.5, L.mega[m.id] ?? 0) > reserve) E.buyMega(g, m.id);
        for (let k = 0; k < 40; k++) {
          let best = -1, bestRatio = 0;
          content.shop.meritItems.forEach((it, i) => { const p = E.donationPrice(L, i); const r = it.legacyMerit / p; if (L.money - p > reserve && r > bestRatio) { bestRatio = r; best = i; } });
          if (best < 0) break; E.donate(g, best);
        }
      }
      const before2 = L.level;
      E.tryPromote(g);
      if (L.level === 19 && before2 === 18 && cur.lv19Age == null) cur.lv19Age = age;
    }
    if (g.merit >= B.reincarnateMerit && cur.meritHitAge == null) cur.meritHitAge = age;
  }
  return { s, lives, ending: g.ending ?? '?', siegeOk };
}

// ---------- รัน ----------
const detail = process.argv.includes('--detail');
const seeds = process.argv.includes('--quick') ? [1] : [1, 2, 3];
const runs: RunRec[] = [];
for (const c of content.careers.careers) for (const path of ['work', 'balance', 'merit'] as PathKey[]) for (const seed of seeds)
  runs.push(play({ career: c.key, path, spend: path === 'merit' ? 'merit' : 'growth', seed }));

const first = (r: RunRec, f: (l: LifeRec) => boolean) => { const l = r.lives.find(f); return l ? (l.loop - 1) * 7 + l.life : Infinity; };
const loop1 = (r: RunRec) => r.lives.filter(l => l.loop === 1);

if (detail) {
  for (const r of runs.filter(r => r.s.seed === 1 && (!process.argv.includes('--work') || r.s.path === 'work'))) {
    console.log(`\n${r.s.career} / ${r.s.path} → ${r.ending}${r.siegeOk != null ? ` (ล้อมกรุง ${r.siegeOk ? 'รอด' : 'แตก'})` : ''}`);
    for (const l of r.lives.filter(l => l.loop === 1)) console.log(`  รอบ${l.loop} ชาติ${l.life}: Lv${l.level}${l.lv19Age ? `(19@${l.lv19Age})` : ''} g19=${(l as any).g19} บุญ ${l.merit}${l.meritHitAge ? `(8000@${l.meritHitAge})` : ''} รายได้ ${l.income.toFixed(1)} เหลือ ${l.moneyLeft.toFixed(1)} ติดความชอบ ${l.affBlockDays}/${l.checks} หลบหลีก ${(l.fleeFrac * 100).toFixed(0)}% เหตุการณ์ย่อย ${l.minor} หลัก ${l.main}`);
  }
}

// ---------- เป้าหมาย ----------
type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const careers = content.careers.careers.map(c => c.key);
const lv19Life1 = runs.filter(r => (loop1(r)[0]?.level ?? 0) >= 19);
checks.push({ name: 'ชาติ 1 ไม่มีอาชีพไหนถึง Lv.19', ok: lv19Life1.length === 0, detail: `${lv19Life1.length} จาก ${runs.length} รอบ` });
const firstLv19 = careers.map(k => { const rs = runs.filter(r => r.s.career === k && r.s.path === 'work'); const v = rs.map(r => first(r, l => l.level >= 19)); return { k, v: Math.max(...v), min: Math.min(...v) }; });
checks.push({ name: 'ทุกอาชีพ (ขยันทำงาน) ถึง Lv.19 ครั้งแรกในชาติ 3–4', ok: firstLv19.every(x => x.min >= 3 && x.v <= 4), detail: firstLv19.map(x => `${x.k} ${x.min === x.v ? x.v : `${x.min}–${x.v}`}`).join(', ') });
const meritFirst = runs.map(r => ({ r, life: first(r, l => l.meritHitAge != null || l.merit >= B.reincarnateMerit) }));
const earliestMerit = Math.min(...meritFirst.map(x => x.life));
checks.push({ name: 'บุญถึงเกณฑ์ทวิภพ ไม่เร็วกว่าชาติ 3', ok: earliestMerit >= 3, detail: `เร็วสุดชาติ ${earliestMerit}` });
const meritPath = meritFirst.filter(x => x.r.s.path === 'merit').map(x => x.life);
checks.push({ name: 'สายทำบุญ ถึงเกณฑ์ทวิภพภายในชาติ 4', ok: Math.max(...meritPath) <= 4, detail: `ชาติ ${Math.min(...meritPath)}–${Math.max(...meritPath)}` });
const anyMeritLoop1 = runs.filter(r => r.s.path !== 'merit').map(r => first(r, l => l.merit >= B.reincarnateMerit));
checks.push({ name: 'แนวทางอื่นก็ถึงทวิภพได้ภายในรอบแรก', ok: anyMeritLoop1.every(v => v <= 7), detail: `ช้าสุดชาติ ${Math.max(...anyMeritLoop1)}` });
const flee = runs.filter(r => r.s.career === 'สายลับ').map(r => first(r, l => l.fleeFrac >= B.fleeFrac));
checks.push({ name: 'สายลับปลดล็อก "หนี" ภายในชาติ 2', ok: Math.max(...flee) <= 2, detail: `ชาติ ${Math.min(...flee)}–${Math.max(...flee)}` });
const affShare = runs.flatMap(r => loop1(r)).reduce((a, l) => [a[0] + l.affBlockDays, a[1] + l.checks], [0, 0]);
const affPct = affShare[0] / affShare[1];
checks.push({ name: 'ความชอบมีผล (ติด 3–25% ของวันที่เช็คเลื่อนยศ)', ok: affPct >= 0.03 && affPct <= 0.25, detail: `${(affPct * 100).toFixed(1)}%` });
const left = runs.filter(r => r.s.spend === 'merit').flatMap(r => loop1(r)).map(l => l.moneyLeft / Math.max(1e-9, l.income));
checks.push({ name: 'สายทำบุญ เงินเหลือค้างตอนตาย < 25% ของรายได้', ok: Math.max(...left) < 0.25, detail: `สูงสุด ${(Math.max(...left) * 100).toFixed(0)}%` });
const soldier = runs.filter(r => r.s.career === 'ทหาร' && r.siegeOk != null);
const siegeRate = soldier.filter(r => r.siegeOk).length / Math.max(1, soldier.length);
const soldierAll = runs.filter(r => r.s.career === 'ทหาร');
checks.push({ name: 'ทหาร รอบทวิภพ เข้าฉากล้อมกรุงได้ และรอด 10–60%', ok: soldier.length > 0 && siegeRate >= 0.1 && siegeRate <= 0.6, detail: `เข้า ${soldier.length}/${soldierAll.length} รอด ${(siegeRate * 100).toFixed(0)}%` });
const minorPerYear = runs.flatMap(r => loop1(r)).reduce((a, l) => a + l.minor, 0) / runs.reduce((a, r) => a + loop1(r).length, 0) / 62;
checks.push({ name: 'เหตุการณ์ย่อย 6–12 ครั้งต่อปีเกม', ok: minorPerYear >= 6 && minorPerYear <= 12, detail: `${minorPerYear.toFixed(1)} ครั้ง/ปี` });

console.log('\nเป้าหมาย (จาก ' + runs.length + ' รอบเล่น)');
for (const c of checks) console.log(`  ${c.ok ? 'ผ่าน ' : 'ไม่ผ่าน'}  ${c.name} — ${c.detail}`);
const failed = checks.filter(c => !c.ok).length;
console.log(failed ? `\nไม่ผ่าน ${failed} ข้อ` : '\nผ่านทุกข้อ');
if (process.argv.includes('--strict') && failed) process.exit(1);
