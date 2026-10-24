// คำพูดของตัวละครเมื่อแตะ — เลือกตามสถานการณ์
import { BALANCE as B } from '../engine/balance';
import * as E from '../engine/core';

export function speechFor(g: E.GameState, ctx: { rain: boolean; war: boolean }): string {
  const L = g.life, age = E.ageOf(L), lines: string[] = [];
  if (ctx.war) lines.push('ได้ยินว่าทัพหลวงยกออกไปอีกแล้ว…', 'ขออย่าให้ถูกเกณฑ์ไปแนวหน้าเลย');
  if (ctx.rain) lines.push('ฝนตกอีกแล้ว นาคงได้น้ำเต็มทุ่ง', 'หน้าฝนทีไร ทางเดินเป็นโคลนทุกที');
  if (age < B.careerMinAge) lines.push(L.childJob ? 'ช่วยงานผู้ใหญ่ไปก่อน โตขึ้นจะได้เลือกทางเดินเอง' : 'วันนี้จะไปช่วยงานอะไรดีนะ', 'โตขึ้นอยากเป็นอะไรดี…');
  else if (!L.career) lines.push('ถึงเวลาต้องเลือกทางชีวิตแล้ว', 'จะเป็นทหาร พ่อค้า หรือขุนนางดี?');
  else {
    const blk = E.promoteBlock(g);
    if (blk === null) lines.push('พร้อมแล้ว! ไปยื่นเรื่องขอเลื่อนยศดีกว่า');
    if (blk === 'affection') lines.push('ฝีมือพอแล้ว แต่คนรอบตัวยังไม่ยอมรับ…');
    if (blk === 'money') lines.push('อยากยื่นเรื่องเลื่อนยศ แต่เงินยังไม่พอ');
    if (blk === 'stat') lines.push('ต้องฝึกให้หนักกว่านี้อีกหน่อย', 'งานวันนี้เหนื่อย แต่ก็ได้เรียนรู้');
  }
  if (g.merit > 50) lines.push('ทำบุญไว้มาก ใจก็สงบ');
  if (L.money > 5) lines.push('เก็บเงินได้ไม่น้อย จะเอาไปทำอะไรดีนะ');
  lines.push('อยุธยาวันนี้คึกคักดีจริง', 'ขอให้บ้านเมืองสงบสุขเถิด');
  return lines[Math.floor(Math.random() * lines.length)];
}
