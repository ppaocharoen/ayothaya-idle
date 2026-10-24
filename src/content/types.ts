// ชนิดข้อมูลของเนื้อหาเกม — ไฟล์จริงอยู่ใน data/*.json
// ฟิลด์ที่ขึ้นต้นด้วย legacy คือค่าจาก prototype v0.19 เก็บไว้อ้างอิงเท่านั้น สมดุลใหม่จะอยู่ใน config แยก

export type StatKey =
  | 'ความรู้' | 'พละกำลัง' | 'ไหวพริบ' | 'ต่อสู้'
  | 'ไสยเวทย์' | 'หลบหลีก' | 'บารมี' | 'โภคทรัพย์';

/** ผลของตัวเลือก: สเตตัส +/− (อนาคตเพิ่ม "ความชอบ", "บุญ", "เงิน" ได้) */
export type Effects = Partial<Record<StatKey | 'ความชอบ', number>>;

export interface Choice { label: string; effects: Effects; }

export interface Stat { key: StatKey; display: string; role: string; }

export interface CareerTitles {
  '0': string; '1': string;
  light: Record<string, string>; // เลเวล 2–19
  dark: Record<string, string>;
}
export interface Career {
  key: string; fullname: string;
  gateStat: StatKey; secondaryStat: StatKey;
  desc?: string;
  titles: CareerTitles;
}
export interface Monastic { key: string; fullname: string; gateStat: StatKey; titles: Record<string, string>; }
export interface CareersFile { careers: Career[]; monastic: Monastic; }

export interface ChildJob { key: string; name: string; desc: string; stats: StatKey[]; suggests: string[]; note: string; }

export interface LeveledItem { level: number; name: string; desc: string; legacyPrice: number; story?: string; }
export interface MeritItem { level: number; name: string; effect: string; legacyPrice: number; legacyMerit: number; story?: string; }
export interface CommonItem { stat: StatKey; name: string; desc: string; legacyPrice: number; legacyDelta: number; legacyAffection: number; story?: string; }
export interface ShopFile {
  careerItems: Record<string, LeveledItem[]>;
  accommodations: LeveledItem[];
  retainers: LeveledItem[];
  meritItems: MeritItem[];
  commonItems: CommonItem[];
}

export interface Reign { life: number; from: number; to: number; king: string; context: string; }

export interface KarmaFixed { id: string; life: number; age: number; year: number; title: string; choices: Choice[]; }

export interface RiskyOutcome { stats?: Effects; merit?: number; affection?: number; }
export interface KarmaGeneric {
  id: string; title: string; choices: Choice[];
  risky: null | { label: string; chance: number; cost: { energy?: number }; success: RiskyOutcome; fail: RiskyOutcome };
}

export type HistoricalKind = 'narrative' | 'check' | 'choice';
export interface Historical {
  id: string; life: number; kind: HistoricalKind; title: string; desc: string;
  yearFrom: number; yearTo: number; ageFrom: number; ageTo: number;
  checkStat?: StatKey; choices?: Choice[];
}

export interface SiegeStep { n: number; label: string; ok: string; fail: string; }

export interface Ending { id: string; name: string; legacyCondition: string; summary: string; note: string; }

export interface Content {
  stats: Stat[];
  careers: CareersFile;
  childJobs: ChildJob[];
  shop: ShopFile;
  reigns: Reign[];
  karmaFixed: KarmaFixed[];
  karmaGeneric: KarmaGeneric[];
  historical: Historical[];
  siege: SiegeStep[];
  endings: Ending[];
}
