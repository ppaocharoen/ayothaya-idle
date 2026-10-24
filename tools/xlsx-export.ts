// data/*.json → content.xlsx  (npm run xlsx:export)
import ExcelJS from 'exceljs';
import { SHEETS } from './xlsx-schema';
import { readContent, XLSX_PATH } from './xlsx-io';

const out = process.argv[2] ?? XLSX_PATH;
const c = readContent();
const wb = new ExcelJS.Workbook();
const readme = wb.addWorksheet('อ่านก่อน');
[
  ['เนื้อหาเกมอโยธยา Idle — แก้ในไฟล์นี้แล้วรัน npm run xlsx:import เพื่อเขียนกลับเป็น data/*.json'],
  ['แต่ละชีต: แถว 1 = คำอธิบาย, แถว 2 = หัวคอลัมน์, ข้อมูลเริ่มแถว 3 · เพิ่ม/ลบแถวได้ อย่าเปลี่ยนชื่อชีตหรือลำดับคอลัมน์'],
  ['ผลของตัวเลือกเขียนแบบ "บารมี+2, โภคทรัพย์-1" ใช้ชื่อสเตตัสตามคอลัมน์ key ในชีตสเตตัส'],
  ['หลัง import จะตรวจข้อมูลอัตโนมัติ (npm run validate) ถ้ามีจุดผิดจะบอกตำแหน่ง'],
].forEach(r => readme.addRow(r));
readme.getColumn(1).width = 110;
for (const s of SHEETS) {
  const ws = wb.addWorksheet(s.name);
  ws.addRow([s.note]).font = { italic: true, color: { argb: 'FF666666' } };
  const hr = ws.addRow(s.headers); hr.font = { bold: true }; hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E7C9' } };
  for (const r of s.toRows(c)) ws.addRow(r);
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  s.headers.forEach((h, i) => { ws.getColumn(i + 1).width = Math.min(60, Math.max(10, h.length + 4)); });
  ws.columns.forEach(col => { col.alignment = { wrapText: true, vertical: 'top' }; });
}
await wb.xlsx.writeFile(out);
console.log('เขียน', out);
