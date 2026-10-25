// สัตว์เลี้ยง: ติดตัววิญญาณข้ามชาติได้จนกว่าจะสิ้นอายุ · อิ่ม/ผูกพัน/ฝึก · บัฟตามสายพันธุ์
import { BALANCE as B } from './balance';
import type { StatKey } from '../content/types';

export interface PetBreed {
  key: string; species: 'dog' | 'cat' | 'bird'; name: string; desc: string;
  /** สเตตัสที่ได้รับบัฟ (โตขึ้นเองทีละน้อยตามความผูกพัน) */
  stats: StatKey[];
  /** ความสำราญที่ได้ต่อปี เมื่อผูกพันเต็ม */
  joy: number;
  /** อายุขัยในเกม (ปี) = อายุจริง × 2–3 */
  life: [number, number];
  /** ช่วงวัย (ปีในเกม): เด็กถึง · โตถึง (เกินนั้น = แก่) */
  stages: [number, number];
  art: string | null;
  /** ขนาดภาพในฉาก (พิกเซลเกมต่อพิกเซลภาพ) */
  scale: number;
}

export const BREEDS: PetBreed[] = [
  { key: 'bangkaew', species: 'dog', name: 'หมาบางแก้ว', desc: 'หมาพื้นเมืองขนฟูจากลุ่มน้ำน่าน หวงเจ้าของ เฝ้าบ้านเก่ง ใครแปลกหน้าเข้าใกล้เป็นต้องเห่า', stats: ['หลบหลีก', 'พละกำลัง'], joy: 0.10, life: [30, 38], stages: [2.5, 20], art: 'pet_bangkaew', scale: 0.45 },
  { key: 'wichienmaat', species: 'cat', name: 'แมววิเชียรมาศ', desc: 'แมวมงคลในตำราแมวสมัยอยุธยา ขนสีงาแต้มน้ำตาลเข้ม ตาสีฟ้า เชื่อกันว่าเลี้ยงแล้วจะได้ยศถาบรรดาศักดิ์', stats: ['บารมี'], joy: 0.10, life: [30, 40], stages: [2.5, 22], art: 'pet_wichienmaat', scale: 0.3 },
  { key: 'nokkhao', species: 'bird', name: 'นกเขาชวา', desc: 'นกเสียงขันไพเราะ คนโบราณถือว่าเสียงขันเป็นมงคล ฟังแล้วใจสงบ', stats: ['ไหวพริบ'], joy: 0.16, life: [20, 28], stages: [1.5, 14], art: null, scale: 0.22 },
];
export const breedOf = (k: string) => BREEDS.find(b => b.key === k)!;

export interface Pet {
  breed: string; name: string; born: number; lifespan: number;
  full: number;     // อิ่ม 0–1
  bond: number;     // ผูกพัน 0–1
  trained: number;  // ฝึก 0–1
  lastFed: number; lastTrained: number; playsToday: number; playDay: number;
}
export interface PetGrave { breed: string; name: string; age: number; year: number; }

export const petAge = (p: Pet, clock: number) => (clock - p.born) / B.daysPerYear;
export function petStage(p: Pet, clock: number): 0 | 1 | 2 {
  const a = petAge(p, clock), b = breedOf(p.breed);
  return a < b.stages[0] ? 0 : a < b.stages[1] ? 1 : 2;
}
/** ความแรงของบัฟ 0–1 (ผูกพันเป็นหลัก ฝึกเสริม) */
export const petPower = (p: Pet) => Math.min(1, p.bond * (0.7 + 0.3 * p.trained) * (p.full > 0.15 ? 1 : 0.4));
export const petPrice = (dailyIncome: number) => Math.max(0.05, dailyIncome * B.petPriceDays);
export const feedPrice = (dailyIncome: number) => Math.max(0.002, dailyIncome * B.petFeedDays);
