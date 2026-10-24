// หลังความตาย: พญายมไต่สวน → ชดใช้กรรม → เกิดใหม่
// ยิ่งผ่านเร็ว ยิ่งได้เกิดเร็ว (ช้าสุด = ปีเกิดเดิมของชาติถัดไป — ต่อระบบนี้ตอนขยายเป็น 7 ชาติ)
import { content } from '../content';
import type { GameState } from './core';

export type Realm = 'heaven' | 'human' | 'preta' | 'hell';
export const REALM: Record<Realm, { name: string; years: number; rounds: number; desc: string }> = {
  heaven: { name: 'สวรรค์', years: 1, rounds: 0, desc: 'บุญหนุนนำ ได้เสวยสุขบนวิมานชั่วครู่ แล้วจุติลงมาเกิดใหม่' },
  human: { name: 'แดนรอเกิด', years: 2, rounds: 2, desc: 'บุญบาปพอกัน รอคิวเกิดที่ริมแม่น้ำเวตรณี' },
  preta: { name: 'เปรตวิสัย', years: 5, rounds: 4, desc: 'บาปติดตัว ต้องหิวโหยเร่ร่อนชดใช้ก่อนได้เกิด' },
  hell: { name: 'นรก', years: 9, rounds: 6, desc: 'บาปหนัก ต้องปีนต้นงิ้วชดใช้กรรมจนกว่าจะหมด' },
};

export interface Question { title: string; label: string; }
export interface Verdict { realm: Realm; meritGained: number; sin: number; questions: Question[]; }

/** ตัดสินภพภูมิจากบุญที่ทำในชาตินี้เทียบกับบาปที่ซ่อนไว้ */
export function judge(g: GameState, rand: () => number = Math.random): Verdict {
  const L = g.life, meritGained = Math.max(0, g.merit - L.meritStart), sin = L.sin;
  const realm: Realm = sin <= 3 && meritGained >= 300 ? 'heaven' : sin <= 15 ? 'human' : sin <= 60 ? 'preta' : 'hell';
  // หยิบการกระทำในชาตินี้มาถาม 3 เรื่อง (ไม่ซ้ำ)
  const pool = [...L.deeds].sort(() => rand() - 0.5), questions: Question[] = [];
  for (const d of pool) {
    if (questions.length >= 3) break;
    const k = content.karmaFixed.find(x => x.id === d.id) ?? content.karmaGeneric.find(x => x.id === d.id);
    const h = k ? null : content.historical.find(x => x.id === d.id);
    const title = k?.title ?? h?.title, label = d.c < 0 ? (k as { risky?: { label: string } } | undefined)?.risky?.label : (k?.choices ?? h?.choices)?.[d.c]?.label;
    if (title && label && !questions.some(q => q.title === title)) questions.push({ title, label });
  }
  const generic = [
    { title: 'ชาติที่ผ่านมา', label: 'ใช้ชีวิตไปตามแรงกรรม' },
    { title: 'ทรัพย์ที่หามาได้', label: 'เก็บไว้เป็นของตน' },
    { title: 'คนรอบตัว', label: 'ดูแลบ้าง ละเลยบ้าง' },
  ];
  while (questions.length < 3) questions.push(generic[questions.length]);
  return { realm, meritGained, sin, questions };
}

export type Answer = 'confess' | 'defend' | 'merit';
/** ผลของคำตอบหนึ่งข้อ → ปีที่ลด (ลบ = ลดโทษ) */
export function answerEffect(g: GameState, v: Verdict, a: Answer, rand: () => number = Math.random): { years: number; ok: boolean; text: string } {
  if (a === 'confess') return { years: -0.5, ok: true, text: 'พญายมพยักหน้า — ความสัตย์ลดโทษลงบ้าง' };
  if (a === 'defend') {
    const wit = g.life.stats['ไหวพริบ'] / g.life.cap, ok = rand() < 0.3 + 0.6 * wit;
    return ok ? { years: -1.5, ok, text: 'ฟังขึ้น — พญายมยอมลดโทษให้' } : { years: 1, ok, text: 'ฟังไม่ขึ้น — ยมบาลจดโทษเพิ่ม' };
  }
  const ok = v.meritGained >= 150;
  return ok ? { years: -1, ok, text: 'บัญชีบุญเปิดออก บุญที่ทำไว้ช่วยค้ำ' } : { years: 0.5, ok, text: 'บุญยังน้อยนัก อ้างไปก็ไร้ผล' };
}

/** ปีที่ต้องรอเกิดหลังรวมผลไต่สวนและชดใช้กรรม */
export function rebirthYears(v: Verdict, judgeYears: number, hits: number, misses: number): number {
  const base = REALM[v.realm].years;
  return Math.max(0, Math.min(base + 4, base + judgeYears - 0.5 * hits + 0.5 * misses));
}
