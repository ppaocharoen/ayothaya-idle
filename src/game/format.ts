// รูปแบบตัวเลขและเงินโบราณสำหรับหน้าจอ
const TH = '๐๑๒๓๔๕๖๗๘๙';
export const th = (n: number | string) => String(n).replace(/\d/g, d => TH[+d]);
export const thInt = (n: number) => th(Math.floor(n).toLocaleString('en-US'));
export const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

// 1 ชั่ง = 20 ตำลึง = 80 บาท · 1 บาท = 4 สลึง = 8 เฟื้อง = 32 ไพ · 1 ไพ = 100 เบี้ย
const UNITS: [string, number][] = [['ชั่ง', 80], ['ตำลึง', 4], ['บาท', 1], ['สลึง', 0.25], ['เฟื้อง', 0.125], ['ไพ', 1 / 32], ['เบี้ย', 1 / 3200]];

/** เงินแบบย่อ: แสดง 2 หน่วยใหญ่สุดที่ไม่เป็นศูนย์ เช่น "๒ ตำลึง ๓ บาท" */
export function baht(v: number, parts = 2): string {
  let rest = Math.max(0, v);
  const out: string[] = [];
  for (const [name, size] of UNITS) {
    const n = Math.floor(rest / size + 1e-9);
    if (n > 0 || (out.length && out.length < parts)) { if (n > 0) out.push(`${thInt(n)} ${name}`); rest -= n * size; }
    if (out.length >= parts) break;
  }
  return out.length ? out.join(' ') : '๐ เบี้ย';
}

export const pct = (f: number) => `${th(Math.round(f * 100))}%`;

/** % ที่ปรับทศนิยมตามขนาด: ≥10% ไม่มีทศนิยม, ≥1% หนึ่งตำแหน่ง, น้อยกว่านั้นสองตำแหน่ง */
export function pctAuto(f: number): string {
  const v = f * 100, d = v >= 10 ? 0 : v >= 1 ? 1 : 2;
  return `${th(String(+v.toFixed(d)))}%`;
}
/** % พร้อมทศนิยม 2 ตำแหน่งตัวเล็กจาง (HTML) สำหรับแถบสเตตัส */
export function pctFine(f: number): string {
  const [a, b] = (f * 100).toFixed(2).split('.');
  return `${th(a)}<small class="dec">.${th(b)}</small>%`;
}

// เดือนแบบจันทรคติไทย (ประมาณ 30.4 วัน/เดือน)
const MONTHS = ['เดือนอ้าย', 'เดือนยี่', 'เดือนสาม', 'เดือนสี่', 'เดือนห้า', 'เดือนหก', 'เดือนเจ็ด', 'เดือนแปด', 'เดือนเก้า', 'เดือนสิบ', 'เดือนสิบเอ็ด', 'เดือนสิบสอง'];
export function dateOf(dayOfYear: number): string {
  const len = 365 / 12, m = Math.min(11, Math.floor(dayOfYear / len)), d = Math.floor(dayOfYear - m * len) + 1;
  return `วันที่ ${th(d)} ${MONTHS[m]}`;
}
