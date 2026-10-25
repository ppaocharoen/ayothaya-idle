import fs from 'node:fs';
import path from 'node:path';
import type { Content } from '../src/content/types';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const XLSX_PATH = path.join(ROOT, 'content.xlsx');
export const FILES = ['stats', 'careers', 'childJobs', 'shop', 'reigns', 'karmaFixed', 'karmaGeneric', 'work', 'historical', 'siege', 'endings'] as const;

export function readContent(dir = DATA_DIR): Content {
  const c: Record<string, unknown> = {};
  for (const f of FILES) c[f] = JSON.parse(fs.readFileSync(path.join(dir, `${f}.json`), 'utf8'));
  return c as unknown as Content;
}
export function writeContent(c: Content, dir = DATA_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of FILES) fs.writeFileSync(path.join(dir, `${f}.json`), JSON.stringify((c as unknown as Record<string, unknown>)[f], null, 2) + '\n');
}
