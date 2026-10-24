// ทดสอบกติกาพื้นฐานของตัวเกม (npm test)
import * as E from '../src/engine/core';
import { BALANCE as B } from '../src/engine/balance';

let fail = 0;
const t = (name: string, ok: boolean, info = '') => { console.log(`${ok ? 'ผ่าน ' : 'ไม่ผ่าน'}  ${name}${info ? ' — ' + info : ''}`); if (!ok) fail++; };

// 1) ตอนเปิดแอป: หยุดทุกครั้งที่มีเหตุการณ์
{
  const g = E.newGame(42);
  const r = E.advance(g, 400, { online: true });
  t('เปิดแอป: เหตุการณ์แรกหยุดเวลา', r.stopped === 'event' && g.queue.length === 1, `หยุดวันที่ ${r.days}`);
}
// 2) ตอนปิดแอป: เหตุการณ์ย่อยค้างไม่เกิน 3 ที่เหลือเลือกให้ · เหตุการณ์หลักหยุดเสมอ
{
  const g = E.newGame(7); E.chooseChildJob(g, 'หาของป่า');
  let auto = 0, maxQueue = 0, stoppedOnMain = 0;
  for (let i = 0; i < 40; i++) {
    const r = E.advance(g, 3650, { online: false });
    auto += r.autoResolved; maxQueue = Math.max(maxQueue, g.queue.filter(e => !E.isMain(e)).length);
    if (g.queue.some(E.isMain)) stoppedOnMain++;
    while (g.queue.length) E.resolveEvent(g);
    if (E.ageOf(g.life) >= 12 && !g.life.career) E.chooseCareer(g, 'พ่อค้า');
  }
  t('ปิดแอป: เหตุการณ์ย่อยค้างในคิวไม่เกิน 3', maxQueue <= B.offlineQueueMax, `สูงสุด ${maxQueue}`);
  t('ปิดแอป: เกินคิวแล้วเลือกให้อัตโนมัติ', auto > 0, `${auto} ครั้ง`);
  t('ปิดแอป: เหตุการณ์หลักหยุดเวลา', stoppedOnMain > 0, `${stoppedOnMain} ครั้ง`);
}
// 3) สเตตัสไม่เกินเพดาน ไม่ติดลบ, บุญไม่ลด
{
  const g = E.newGame(3); E.chooseChildJob(g, 'คาราวาน'); E.setTrain(g, ['ต่อสู้', 'ไหวพริบ']);
  let ok = true, meritOk = true, last = 0;
  for (let i = 0; i < 6000 && !g.ending; i++) {
    E.advance(g, 30, { online: false });
    while (g.queue.length) { const e = g.queue[0]; E.resolveEvent(g, e.kind === 'finale' ? 'fight' : undefined); }
    if (E.ageOf(g.life) >= 12 && !g.life.career) E.chooseCareer(g, 'ทหาร');
    if (g.life.career && !g.life.track) E.chooseTrack(g, 'dark');
    E.tryPromote(g);
    for (const s of E.STAT_KEYS) if (g.life.stats[s] < 0 || g.life.stats[s] > g.life.cap + 1e-9) ok = false;
    if (g.merit < last - 1e-9) meritOk = false; last = g.merit;
  }
  t('สเตตัสอยู่ในช่วง 0–เพดาน ตลอดเกม', ok);
  t('บุญไม่ลดลง', meritOk);
  t('เล่นจนจบเกมได้ (ชาติ 7 → ฉากจบ)', g.ending === 'fight', `จบที่ ${g.ending}`);
}
// 4) เซฟ/โหลด แล้วเล่นต่อได้ผลเหมือนไม่ได้เซฟ
{
  const a = E.newGame(99); E.chooseChildJob(a, 'งานวัด');
  E.advance(a, 2000, { online: false }); while (a.queue.length) E.resolveEvent(a);
  const b = E.deserialize(E.serialize(a));
  for (const g of [a, b]) { E.advance(g, 3000, { online: false }); while (g.queue.length) E.resolveEvent(g); }
  t('เซฟ/โหลด แล้วผลตรงกัน', JSON.stringify({ ...a, savedAt: 0 }) === JSON.stringify({ ...b, savedAt: 0 }));
}
// 5) คำนวณวันที่ปิดแอป
{
  const g = E.newGame(1); g.savedAt = Date.now() - 3600_000;
  const d = E.offlineDays(g);
  t('ปิดแอป 1 ชม. = ประมาณ 214 วันในเกม', Math.abs(d - 3600 / B.secondsPerGameDay) <= 1, `${d} วัน`);
}
console.log(fail ? `\nไม่ผ่าน ${fail} ข้อ` : '\nผ่านทุกข้อ');
process.exit(fail ? 1 : 0);
