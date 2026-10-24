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
