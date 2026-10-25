// นับกงกรรมทั่วไปต่อชาติ แยกหมวดและช่วงวัย (เล่นออนไลน์ตลอด เลือกข้อแรก) — npx tsx tools/karma-freq.ts
import * as E from '../src/engine/core';
import { content } from '../src/content';
const tagOf = (id: string) => content.karmaGeneric.find(k => k.id === id)?.tag ?? 'ทั่วไป';
const cnt: Record<string, Record<string, number>> = {};
let years = 0;
for (const seed of [1, 2, 3, 4, 5]) {
  const g = E.newGame(seed) as E.GameState;
  for (let guard = 0; guard < 200000 && !g.ending; guard++) {
    if (!g.queue.length) { E.advance(g, 30, { online: true }); continue; }
    const e = g.queue[0];
    if (e.kind === 'karma' && e.generic) {
      const a = E.ageOf(g.life), band = a < 18 ? '12–17' : a < 40 ? '18–39' : '40+';
      (cnt[band] ??= {})[tagOf(e.id)] = (cnt[band][tagOf(e.id)] ?? 0) + 1;
    }
    try { E.resolveEvent(g, 0 as never); } catch { g.queue.shift(); }
    if (e.kind === 'lifeEnd') years += 0;
  }
}
console.log(JSON.stringify(cnt, null, 1));
