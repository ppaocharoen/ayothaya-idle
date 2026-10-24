// content.xlsx → data/*.json  (npm run xlsx:import [ไฟล์])  แล้วรัน validate
import ExcelJS from 'exceljs';
import { execSync } from 'node:child_process';
import { SHEETS, type Cell } from './xlsx-schema';
import { readContent, writeContent, XLSX_PATH } from './xlsx-io';

const src = process.argv[2] ?? XLSX_PATH;
const outDir = process.argv[3];
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(src);
const c = readContent();
for (const s of SHEETS) {
  const ws = wb.getWorksheet(s.name);
  if (!ws) { console.log(`ข้ามชีต "${s.name}" (ไม่พบในไฟล์)`); continue; }
  const rows: Cell[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= 2) return;
    const vals: Cell[] = [];
    for (let i = 1; i <= s.headers.length; i++) {
      const v = row.getCell(i).value as unknown;
      vals.push(v == null ? null : typeof v === 'object' && v && 'richText' in v ? (v as { richText: { text: string }[] }).richText.map(t => t.text).join('') : typeof v === 'object' && v && 'result' in v ? (v as { result: Cell }).result : v as Cell);
    }
    if (vals.some(v => v !== null && String(v).trim() !== '')) rows.push(vals);
  });
  try { s.fromRows(rows, c); } catch (e) { console.error(`ชีต "${s.name}": ${(e as Error).message}`); process.exit(1); }
}
writeContent(c, outDir);
console.log('เขียน data/*.json แล้ว');
if (!outDir) execSync('npx tsx tools/validate.ts', { stdio: 'inherit' });
