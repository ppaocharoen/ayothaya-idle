// การแปลงระหว่าง data/*.json ⇄ ชีตใน content.xlsx (ใช้ร่วมกันทั้ง export และ import)
// ผลของตัวเลือกเขียนในเซลล์แบบ "บารมี+2, โภคทรัพย์-1"
import type { Choice, Content, Effects, RiskyOutcome } from '../src/content/types';

export type Cell = string | number | null;
export interface SheetDef { name: string; note: string; headers: string[]; toRows(c: Content): Cell[][]; fromRows(rows: Cell[][], c: Content): void; }

const MAX_CHOICES = 4;

export function effectsToText(e: Effects | undefined): string {
  return Object.entries(e ?? {}).map(([k, v]) => `${k}${(v as number) >= 0 ? '+' : ''}${v}`).join(', ');
}
export function textToEffects(t: Cell): Effects {
  const out: Record<string, number> = {};
  const s = String(t ?? '').trim();
  if (!s) return out;
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(.+?)\s*([+-]\s*[\d.]+)$/);
    if (!m) throw new Error(`อ่านผลของตัวเลือกไม่ออก: "${part.trim()}" (ต้องเป็นแบบ บารมี+2)`);
    out[m[1].trim()] = Number(m[2].replace(/\s/g, ''));
  }
  return out as Effects;
}
function riskyToText(o: RiskyOutcome): string {
  const parts = [effectsToText(o.stats)];
  if (o.merit) parts.push(`บุญ${o.merit >= 0 ? '+' : ''}${o.merit}`);
  if (o.affection) parts.push(`ความชอบ${o.affection >= 0 ? '+' : ''}${o.affection}`);
  return parts.filter(Boolean).join(', ');
}
function riskySin(t: Cell): { sin?: number } { const v = (textToEffects(t) as Record<string, number>)['บาป']; return v ? { sin: v } : {}; }
function textToRisky(t: Cell): RiskyOutcome {
  const e = textToEffects(t) as Record<string, number>;
  delete e['บาป'];
  const o: RiskyOutcome = {};
  if ('บุญ' in e) { o.merit = e['บุญ']; delete e['บุญ']; }
  if ('ความชอบ' in e) { o.affection = e['ความชอบ']; delete e['ความชอบ']; }
  if (Object.keys(e).length) o.stats = e as Effects;
  return o;
}
const choiceHeaders = Array.from({ length: MAX_CHOICES }, (_, i) => [`ตัวเลือก ${'ABCD'[i]}`, `ผล ${'ABCD'[i]}`]).flat();
function choicesToCells(cs: Choice[] | undefined): Cell[] {
  // บาปของตัวเลือกเขียนรวมในช่องผล เช่น "โภคทรัพย์+2, บาป+2"
  return Array.from({ length: MAX_CHOICES }, (_, i) => cs?.[i] ? [cs[i].label, [effectsToText(cs[i].effects), cs[i].sin ? `บาป+${cs[i].sin}` : ''].filter(Boolean).join(', ')] : ['', '']).flat();
}
function cellsToChoices(cells: Cell[]): Choice[] {
  const out: Choice[] = [];
  for (let i = 0; i < MAX_CHOICES; i++) {
    const label = String(cells[i * 2] ?? '').trim();
    if (!label) continue;
    const e = textToEffects(cells[i * 2 + 1]) as Record<string, number>, sin = e['บาป'];
    delete e['บาป'];
    out.push({ label, effects: e as Effects, ...(sin ? { sin } : {}) });
  }
  return out;
}
const str = (v: Cell) => String(v ?? '').trim();
const num = (v: Cell) => Number(v);
const list = (v: Cell) => str(v).split(',').map(s => s.trim()).filter(Boolean);

export const SHEETS: SheetDef[] = [
  {
    name: 'สเตตัส', note: 'key = ชื่อที่ใช้ในข้อมูลทุกที่ (ห้ามเปลี่ยน) · display = ชื่อที่โชว์ในเกม',
    headers: ['key', 'ชื่อโชว์', 'บทบาท'],
    toRows: c => c.stats.map(s => [s.key, s.display, s.role]),
    fromRows: (r, c) => { c.stats = r.map(x => ({ key: str(x[0]) as never, display: str(x[1]), role: str(x[2]) })); },
  },
  {
    name: 'อาชีพ', note: 'แถวสุดท้าย "บรรพชิต" คือสายพิเศษ',
    headers: ['key', 'ชื่อเต็ม', 'สเตตัสหลัก', 'สเตตัสรอง', 'คำอธิบาย'],
    toRows: c => [...c.careers.careers.map(x => [x.key, x.fullname, x.gateStat, x.secondaryStat, x.desc ?? '']), [c.careers.monastic.key, c.careers.monastic.fullname, c.careers.monastic.gateStat, '', '']],
    fromRows: (r, c) => {
      const old = new Map(c.careers.careers.map(x => [x.key, x]));
      const mon = r.find(x => str(x[0]) === 'บรรพชิต');
      c.careers.careers = r.filter(x => str(x[0]) !== 'บรรพชิต').map(x => ({
        key: str(x[0]), fullname: str(x[1]), gateStat: str(x[2]) as never, secondaryStat: str(x[3]) as never,
        ...(str(x[4]) ? { desc: str(x[4]) } : {}),
        titles: old.get(str(x[0]))?.titles ?? { '0': '', '1': '', light: {}, dark: {} },
      }));
      if (mon) Object.assign(c.careers.monastic, { fullname: str(mon[1]), gateStat: str(mon[2]) });
    },
  },
  {
    name: 'ยศ', note: 'สาย: ร่วม = เลเวล 0–1 ก่อนแยกสาย · สว่าง/มืด = เลเวล 2–19 · บรรพชิต ใช้สาย "บรรพชิต"',
    headers: ['อาชีพ', 'สาย', 'เลเวล', 'ชื่อยศ'],
    toRows: c => {
      const rows: Cell[][] = [];
      for (const x of c.careers.careers) {
        rows.push([x.key, 'ร่วม', 0, x.titles['0']], [x.key, 'ร่วม', 1, x.titles['1']]);
        for (const [side, th] of [['light', 'สว่าง'], ['dark', 'มืด']] as const)
          for (const [lv, t] of Object.entries(x.titles[side])) rows.push([x.key, th, Number(lv), t]);
      }
      for (const [lv, t] of Object.entries(c.careers.monastic.titles)) rows.push(['บรรพชิต', 'บรรพชิต', Number(lv), t]);
      return rows;
    },
    fromRows: (r, c) => {
      for (const x of c.careers.careers) x.titles = { '0': '', '1': '', light: {}, dark: {} };
      c.careers.monastic.titles = {};
      for (const x of r) {
        const key = str(x[0]), side = str(x[1]), lv = String(num(x[2])), t = str(x[3]);
        if (side === 'บรรพชิต') { c.careers.monastic.titles[lv] = t; continue; }
        const car = c.careers.careers.find(y => y.key === key);
        if (!car) throw new Error(`ชีตยศ: ไม่มีอาชีพ "${key}"`);
        if (side === 'ร่วม') (car.titles as unknown as Record<string, string>)[lv] = t;
        else car.titles[side === 'สว่าง' ? 'light' : 'dark'][lv] = t;
      }
    },
  },
  {
    name: 'งานเด็ก', note: 'สเตตัส/อาชีพที่แนะนำ คั่นด้วยจุลภาค',
    headers: ['key', 'ชื่อ', 'คำอธิบาย', 'สเตตัสที่ฝึก', 'อาชีพที่แนะนำ', 'หมายเหตุ'],
    toRows: c => c.childJobs.map(j => [j.key, j.name, j.desc, j.stats.join(', '), j.suggests.join(', '), j.note]),
    fromRows: (r, c) => { c.childJobs = r.map(x => ({ key: str(x[0]), name: str(x[1]), desc: str(x[2]), stats: list(x[3]) as never, suggests: list(x[4]), note: str(x[5]) })); },
  },
  {
    name: 'ร้าน-ของสายอาชีพ', note: 'ราคาเดิม = ราคาใน v0.19 (บาท) ไว้อ้างอิง',
    headers: ['อาชีพ', 'ระดับ', 'ชื่อ', 'คำอธิบาย', 'ราคาเดิม', 'เรื่องราว'],
    toRows: c => Object.entries(c.shop.careerItems).flatMap(([k, items]) => items.map(i => [k, i.level, i.name, i.desc, i.legacyPrice, i.story ?? ''])),
    fromRows: (r, c) => {
      c.shop.careerItems = {};
      for (const x of r) (c.shop.careerItems[str(x[0])] ??= []).push({ level: num(x[1]), name: str(x[2]), desc: str(x[3]), legacyPrice: num(x[4]), ...(str(x[5]) ? { story: str(x[5]) } : {}) });
    },
  },
  ...(['accommodations', 'retainers'] as const).map((kind): SheetDef => ({
    name: kind === 'accommodations' ? 'ร้าน-ที่พัก' : 'ร้าน-บริวาร', note: 'ราคาเดิม = ราคาใน v0.19 (บาท)',
    headers: ['ระดับ', 'ชื่อ', 'คำอธิบาย', 'ราคาเดิม', 'เรื่องราว'],
    toRows: c => c.shop[kind].map(i => [i.level, i.name, i.desc, i.legacyPrice, i.story ?? '']),
    fromRows: (r, c) => { c.shop[kind] = r.map(x => ({ level: num(x[0]), name: str(x[1]), desc: str(x[2]), legacyPrice: num(x[3]), ...(str(x[4]) ? { story: str(x[4]) } : {}) })); },
  })),
  {
    name: 'ร้าน-ทำบุญ', note: '',
    headers: ['ระดับ', 'ชื่อ', 'ผล', 'ราคาเดิม', 'บุญเดิม', 'เรื่องราว'],
    toRows: c => c.shop.meritItems.map(i => [i.level, i.name, i.effect, i.legacyPrice, i.legacyMerit, i.story ?? '']),
    fromRows: (r, c) => { c.shop.meritItems = r.map(x => ({ level: num(x[0]), name: str(x[1]), effect: str(x[2]), legacyPrice: num(x[3]), legacyMerit: num(x[4]), ...(str(x[5]) ? { story: str(x[5]) } : {}) })); },
  },
  {
    name: 'ร้าน-ของสามัญ', note: 'ค่าเดิม = ค่าใน v0.19',
    headers: ['สเตตัส', 'ชื่อ', 'คำอธิบาย', 'ราคาเดิม', 'สเตตัสเดิม', 'ความชอบเดิม', 'เรื่องราว'],
    toRows: c => c.shop.commonItems.map(i => [i.stat, i.name, i.desc, i.legacyPrice, i.legacyDelta, i.legacyAffection, i.story ?? '']),
    fromRows: (r, c) => { c.shop.commonItems = r.map(x => ({ stat: str(x[0]) as never, name: str(x[1]), desc: str(x[2]), legacyPrice: num(x[3]), legacyDelta: num(x[4]), legacyAffection: num(x[5] ?? 0), ...(str(x[6]) ? { story: str(x[6]) } : {}) })); },
  },
  {
    name: 'รัชสมัย', note: 'ช่วงปีของแต่ละชาติคิดจากตารางนี้',
    headers: ['ชาติ', 'ปีเริ่ม', 'ปีสิ้นสุด', 'พระนาม/รัชกาล', 'บริบท'],
    toRows: c => c.reigns.map(x => [x.life, x.from, x.to, x.king, x.context]),
    fromRows: (r, c) => { c.reigns = r.map(x => ({ life: num(x[0]), from: num(x[1]), to: num(x[2]), king: str(x[3]), context: str(x[4]) })); },
  },
  {
    name: 'กงกรรมต่อชาติ', note: 'อายุ = ปี − ปีเริ่มชาติ + 9 · ผล เช่น "บารมี+2, โภคทรัพย์-1"',
    headers: ['id', 'ชาติ', 'อายุ', 'ปี', 'ชื่อ', ...choiceHeaders],
    toRows: c => c.karmaFixed.map(k => [k.id, k.life, k.age, k.year, k.title, ...choicesToCells(k.choices)]),
    fromRows: (r, c) => { c.karmaFixed = r.map(x => ({ id: str(x[0]), life: num(x[1]), age: num(x[2]), year: num(x[3]), title: str(x[4]), choices: cellsToChoices(x.slice(5)) })); },
  },
  {
    name: 'กงกรรมทั่วไป', note: 'เสี่ยงดวง: โอกาส 0–1, ผลใส่ "บุญ+2" หรือ "ความชอบ+0.05" ได้ · หมวด: fun สันทนาการ / health สุขภาพ / vice อบายมุข / ว่าง = ทั่วไป (fun/health ขึ้นได้ตั้งแต่วัยรุ่น และขึ้นบ่อยขึ้นเมื่อความสำราญ/สุขภาพต่ำ)',
    headers: ['id', 'ชื่อ', ...choiceHeaders, 'เสี่ยงดวง', 'โอกาส', 'พลังงานที่เสีย', 'ผลสำเร็จ', 'ผลล้มเหลว', 'หมวด'],
    toRows: c => c.karmaGeneric.map(k => [k.id, k.title, ...choicesToCells(k.choices),
      k.risky?.label ?? '', k.risky?.chance ?? '', k.risky?.cost.energy ?? '', k.risky ? [riskyToText(k.risky.success), k.risky.sin ? `บาป+${k.risky.sin}` : ''].filter(Boolean).join(', ') : '', k.risky ? riskyToText(k.risky.fail) : '', k.tag ?? '']),
    fromRows: (r, c) => {
      const o = 2 + MAX_CHOICES * 2;
      c.karmaGeneric = r.map(x => ({
        id: str(x[0]), title: str(x[1]), choices: cellsToChoices(x.slice(2, o)),
        risky: str(x[o]) ? { label: str(x[o]), chance: num(x[o + 1]), cost: str(x[o + 2]) ? { energy: num(x[o + 2]) } : {}, success: textToRisky(x[o + 3]), fail: textToRisky(x[o + 4]), ...riskySin(x[o + 3]) } : null,
        ...(str(x[o + 5]) ? { tag: str(x[o + 5]) as 'fun' } : {}),
      }));
    },
  },
  {
    name: 'กงการ', note: 'อีเวนต์งานตามอาชีพ · ชั้น 0 ผู้น้อย (Lv0–5) / 1 ชั้นกลาง (6–11) / 2 ชั้นสูง (12–16) / 3 ชั้นยอด (17–19) · ผลใส่ "เงิน+2, ความชอบ+1, บาป+2" (ความชอบ 1 = 5% ของที่ต้องใช้เลื่อนขั้นถัดไป) · โอกาสเสี่ยงดวงขยับตามสเตตัสหลักของอาชีพ · ตัวเลือกที่มีบาป ถ้าอยู่ทางมืดได้ผลดีขึ้น',
    headers: ['id', 'อาชีพ', 'ชั้น', 'ชื่อ', ...choiceHeaders, 'เสี่ยงดวง', 'โอกาส', 'ผลสำเร็จ', 'ผลล้มเหลว'],
    toRows: c => c.work.map(k => [k.id, k.career, k.tier, k.title, ...choicesToCells(k.choices),
      k.risky?.label ?? '', k.risky?.chance ?? '', k.risky ? [riskyToText(k.risky.success), k.risky.sin ? `บาป+${k.risky.sin}` : ''].filter(Boolean).join(', ') : '', k.risky ? riskyToText(k.risky.fail) : '']),
    fromRows: (r, c) => {
      const o = 4 + MAX_CHOICES * 2;
      c.work = r.map(x => ({
        id: str(x[0]), career: str(x[1]), tier: num(x[2]), title: str(x[3]), choices: cellsToChoices(x.slice(4, o)),
        risky: str(x[o]) ? { label: str(x[o]), chance: num(x[o + 1]), cost: {}, success: textToRisky(x[o + 2]), fail: textToRisky(x[o + 3]), ...riskySin(x[o + 2]) } : null,
      }));
    },
  },
  {
    name: 'เหตุการณ์ประวัติศาสตร์', note: 'ประเภท: narrative = บรรยาย · check = เช็คสเตตัส · choice = มีตัวเลือก · เหตุการณ์หลายปีใส่ปีเริ่ม–ปีสิ้นสุดต่างกัน',
    headers: ['id', 'ชาติ', 'ประเภท', 'ชื่อ', 'คำอธิบาย', 'ปีเริ่ม', 'ปีสิ้นสุด', 'อายุเริ่ม', 'อายุสิ้นสุด', 'เช็คสเตตัส', ...choiceHeaders],
    toRows: c => c.historical.map(h => [h.id, h.life, h.kind, h.title, h.desc, h.yearFrom, h.yearTo, h.ageFrom, h.ageTo, h.checkStat ?? '', ...choicesToCells(h.choices)]),
    fromRows: (r, c) => {
      c.historical = r.map(x => {
        const h = { id: str(x[0]), life: num(x[1]), kind: str(x[2]) as never, title: str(x[3]), desc: str(x[4]), yearFrom: num(x[5]), yearTo: num(x[6]), ageFrom: num(x[7]), ageTo: num(x[8]) } as Content['historical'][number];
        if (str(x[9])) h.checkStat = str(x[9]) as never;
        const ch = cellsToChoices(x.slice(10));
        if (ch.length) h.choices = ch;
        return h;
      });
    },
  },
  {
    name: 'ล้อมกรุง', note: '18 ฉากของเอนดิ้งปกป้องกรุงศรี',
    headers: ['ลำดับ', 'ช่วงเวลา/หัวข้อ', 'ผลสำเร็จ', 'ผลล้มเหลว'],
    toRows: c => c.siege.map(s => [s.n, s.label, s.ok, s.fail]),
    fromRows: (r, c) => { c.siege = r.map(x => ({ n: num(x[0]), label: str(x[1]), ok: str(x[2]), fail: str(x[3]) })); },
  },
  {
    name: 'เอนดิ้ง', note: 'เงื่อนไขเดิม = จาก v0.13 ยังไม่ใช่เงื่อนไขใหม่',
    headers: ['id', 'ชื่อ', 'เงื่อนไขเดิม', 'สรุปเนื้อเรื่อง', 'หมายเหตุ'],
    toRows: c => c.endings.map(e => [e.id, e.name, e.legacyCondition, e.summary, e.note]),
    fromRows: (r, c) => { c.endings = r.map(x => ({ id: str(x[0]), name: str(x[1]), legacyCondition: str(x[2]), summary: str(x[3]), note: str(x[4]) })); },
  },
];
