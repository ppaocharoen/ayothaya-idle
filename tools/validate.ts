// ตรวจความถูกต้องของ data/*.json — รันอัตโนมัติก่อน build ทุกครั้ง
// เช็ค: อ้างชื่อสเตตัส/อาชีพถูก, ปีอยู่ในช่วงชาติ, อายุตรงกับปี, รัชสมัยต่อเนื่องไม่มีช่องว่าง, id ไม่ซ้ำ
import { content, lifeRange, NUM_LIVES, START_AGE } from '../src/content/index';
import type { Choice, Effects } from '../src/content/types';

const errors: string[] = [];
const warn: string[] = [];
const statKeys = new Set(content.stats.map(s => s.key));
const careerKeys = new Set(content.careers.careers.map(c => c.key));

function checkEffects(where: string, e: Effects | undefined) {
  for (const k of Object.keys(e ?? {})) {
    if (!statKeys.has(k as never) && !['ความชอบ', 'เงิน', 'สุขภาพ', 'สำราญ'].includes(k)) errors.push(`${where}: ไม่รู้จักสเตตัส "${k}"`);
  }
}
function checkChoices(where: string, cs: Choice[] | undefined) {
  if (!cs?.length) { errors.push(`${where}: ไม่มีตัวเลือก`); return; }
  cs.forEach((c, i) => { if (!c.label) errors.push(`${where} ตัวเลือก ${i + 1}: ไม่มีข้อความ`); checkEffects(`${where} ตัวเลือก ${i + 1}`, c.effects); });
}
function unique(name: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) { if (seen.has(id)) errors.push(`${name}: id ซ้ำ ${id}`); seen.add(id); }
}

// อาชีพ
for (const c of content.careers.careers) {
  if (!statKeys.has(c.gateStat)) errors.push(`อาชีพ ${c.key}: gateStat ผิด`);
  if (!statKeys.has(c.secondaryStat)) errors.push(`อาชีพ ${c.key}: secondaryStat ผิด`);
  for (const side of ['light', 'dark'] as const) {
    for (let lv = 2; lv <= 19; lv++) if (!c.titles[side][String(lv)]) errors.push(`อาชีพ ${c.key}: ไม่มีชื่อยศ ${side} Lv.${lv}`);
  }
}
for (const j of content.childJobs) {
  j.suggests.forEach(s => { if (!careerKeys.has(s)) errors.push(`งานเด็ก ${j.key}: อาชีพ "${s}" ไม่มี`); });
  j.stats.forEach(s => { if (!statKeys.has(s)) errors.push(`งานเด็ก ${j.key}: สเตตัส "${s}" ไม่มี`); });
}
for (const k of Object.keys(content.shop.careerItems)) if (!careerKeys.has(k)) errors.push(`ร้านค้า: อาชีพ "${k}" ไม่มี`);
content.shop.commonItems.forEach(i => { if (!statKeys.has(i.stat)) errors.push(`ของสามัญ ${i.name}: สเตตัสผิด`); });

// รัชสมัย: ต่อเนื่อง ไม่ซ้อน
const rs = [...content.reigns].sort((a, b) => a.from - b.from);
for (let i = 1; i < rs.length; i++) {
  if (rs[i].from !== rs[i - 1].to + 1) warn.push(`รัชสมัย: ช่วง ${rs[i - 1].to}→${rs[i].from} ไม่ต่อกันพอดี (${rs[i - 1].king} → ${rs[i].king})`);
}

// กงกรรม/เหตุการณ์: ปีอยู่ในชาติ และอายุ = ปี − ปีเริ่มชาติ + 9
unique('กงกรรมต่อชาติ', content.karmaFixed.map(k => k.id));
unique('กงกรรมทั่วไป', content.karmaGeneric.map(k => k.id));
unique('เหตุการณ์ประวัติศาสตร์', content.historical.map(k => k.id));
for (const k of content.karmaFixed) {
  const r = lifeRange(k.life);
  if (k.year < r.from || k.year > r.to) errors.push(`${k.id}: ปี ${k.year} อยู่นอกชาติ ${k.life}`);
  if (k.age !== k.year - r.from + START_AGE) warn.push(`${k.id}: อายุ ${k.age} ไม่ตรงกับปี ${k.year}`);
  checkChoices(k.id, k.choices);
}
for (const k of content.karmaGeneric) {
  checkChoices(k.id, k.choices);
  if (k.risky) { checkEffects(`${k.id} เสี่ยงดวง(สำเร็จ)`, k.risky.success.stats); checkEffects(`${k.id} เสี่ยงดวง(ล้มเหลว)`, k.risky.fail.stats); }
}
for (const h of content.historical) {
  const r = lifeRange(h.life);
  if (h.yearFrom < r.from || h.yearTo > r.to) errors.push(`${h.id}: ปี ${h.yearFrom}–${h.yearTo} อยู่นอกชาติ ${h.life}`);
  if (h.ageFrom !== h.yearFrom - r.from + START_AGE) warn.push(`${h.id}: อายุ ${h.ageFrom} ไม่ตรงกับปี ${h.yearFrom}`);
  if (h.kind === 'check' && !h.checkStat) errors.push(`${h.id}: แบบเช็คแต่ไม่มี checkStat`);
  if (h.checkStat && !statKeys.has(h.checkStat)) errors.push(`${h.id}: checkStat ผิด`);
  if (h.kind === 'choice') checkChoices(h.id, h.choices);
}
for (let life = 1; life <= NUM_LIVES; life++) {
  if (!content.karmaFixed.some(k => k.life === life)) warn.push(`ชาติ ${life}: ไม่มีกงกรรมต่อชาติ`);
}

const counts = {
  สเตตัส: content.stats.length, อาชีพ: content.careers.careers.length, งานเด็ก: content.childJobs.length,
  รัชสมัย: content.reigns.length, กงกรรมต่อชาติ: content.karmaFixed.length, กงกรรมทั่วไป: content.karmaGeneric.length,
  เหตุการณ์ประวัติศาสตร์: content.historical.length, ฉากล้อมกรุง: content.siege.length, เอนดิ้ง: content.endings.length,
  ของสามัญ: content.shop.commonItems.length,
};
console.log('จำนวนเนื้อหา:', counts);
warn.forEach(w => console.log('  คำเตือน:', w));
if (errors.length) { errors.forEach(e => console.error('  ผิด:', e)); console.error(`\nพบข้อผิดพลาด ${errors.length} จุด`); process.exit(1); }
console.log(`ข้อมูลผ่านการตรวจ (คำเตือน ${warn.length} จุด)`);
