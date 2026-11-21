// ศักดินา: บรรดาศักดิ์ + ราชทินนาม (ทางสว่าง) · ตัวเลขศักดินา · ชนชั้นตอนเกิด
// ศักดินาเป็นผลของยศและตำแหน่ง ไม่ใช่เกณฑ์เลื่อนยศ · ไม่สืบตระกูล (เกิดใหม่เริ่มจากชนชั้นตอนเกิด)
import { content } from '../content';
import { BALANCE as B } from './balance';
import type { LifeState } from './core';

export type BirthDef = (typeof B.births)[number];
export const birthDef = (key?: string): BirthDef => B.births.find(b => b.key === key) ?? B.births.find(b => b.key === B.birthDefault)!;

/** ชนชั้นตอนเกิดจากชาติก่อน: บาปมากตกชั้น · บุญมาก (ปรับ softcap แล้ว เทียบข้ามชาติได้) เกิดสูง */
export function birthFrom(prev: LifeState, meritNow: number): string {
  const gained = Math.max(0, meritNow - prev.meritStart) * (1 + prev.meritStart / B.meritSoftcap);
  for (let i = B.births.length - 1; i >= 0; i--) {
    const b = B.births[i];
    if (prev.sin <= b.maxSin && gained >= b.minMerit) return b.key;
  }
  return B.births[0].key;
}

const round = (v: number) => v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v / 50) * 50;
/** ศักดินาของยศขั้นนี้ในอาชีพนี้ */
export const sakdinaAt = (career: string, level: number) =>
  round(B.sakdinaOfLevel[Math.min(level, B.sakdinaOfLevel.length - 1)] * (B.sakdinaCareerMul[career] ?? 1));
/** ศักดินาตอนนี้: มีอาชีพแล้วตามยศ · ยังไม่มีตามชนชั้นตอนเกิด */
export const sakdinaOf = (L: LifeState) => L.career ? sakdinaAt(L.career, L.level) : birthDef(L.birth).sakdina;

export interface Rank { rank: string; name: string; full: string; panThong: boolean; }
/** บรรดาศักดิ์ + ราชทินนาม · ทางมืดไม่มีบรรดาศักดิ์ (คืน null — ใช้ชื่อยศเป็นฉายาแทน) */
export function rankOf(career: string, level: number, track: 'light' | 'dark' | null): Rank | null {
  if (track === 'dark' && level >= B.lightDarkLevel) return null;
  const i = B.rankOfLevel[Math.min(level, B.rankOfLevel.length - 1)];
  const rank = B.ranks[i], name = content.careers.careers.find(c => c.key === career)?.rachathinnam?.[i] ?? '';
  return { rank, name, full: rank + name, panThong: rank === 'พระยา' && sakdinaAt(career, level) > B.panThongFrom };
}

/** ค่าปรับไหมเมื่อถูกจับสินบน (จำนวนวันของรายได้) */
export const fineDays = (sakdina: number) => B.sakdinaFineK * Math.sqrt(sakdina / 100);
