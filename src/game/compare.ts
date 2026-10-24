// เทียบผลกับไพร่จำลอง: รันตัวเกมจริงหลายชีวิตด้วยการเล่นแบบสุ่ม ถึงอายุเดียวกับผู้เล่น
import { content } from '../content';
import { BALANCE as B, type PathKey } from '../engine/balance';
import * as E from '../engine/core';

export interface Peer { level: number; merit: number; money: number; }

export function simulatePeers(n: number, toAge: number): Peer[] {
  const out: Peer[] = [];
  const paths = Object.keys(B.paths) as PathKey[];
  for (let i = 0; i < n; i++) {
    const g = E.newGame(1000 + i * 7919);
    const pick = <T>(a: T[]) => a[Math.floor(((i * 2654435761) >>> 0) / 4294967296 * a.length + i) % a.length];
    const career = pick(content.careers.careers);
    E.setPath(g, paths[i % paths.length]);
    E.setTrain(g, i % 3 === 0 ? [career.gateStat] : i % 3 === 1 ? [career.gateStat, career.secondaryStat] : [content.stats[i % 8].key]);
    E.chooseChildJob(g, content.childJobs[i % content.childJobs.length].key);
    const diligence = 0.3 + (i % 10) / 14; // บางคนขยันกดเลื่อนยศ บางคนไม่ค่อยสนใจ
    while (E.ageOf(g.life) < toAge && g.life.idx === 1) {
      E.advance(g, 20, { online: false });
      while (g.queue.length) E.resolveEvent(g);
      if (E.ageOf(g.life) >= B.careerMinAge && !g.life.career) E.chooseCareer(g, career.key);
      if (g.life.career && !g.life.track) E.chooseTrack(g, i % 2 ? 'light' : 'dark');
      if (Math.random() < diligence) E.tryPromote(g);
      if (Math.random() < diligence * 0.5) { E.buyCareerItem(g); E.buyAccommodation(g); }
    }
    out.push({ level: g.life.level, merit: g.merit, money: g.life.money });
  }
  return out;
}

/** ผู้เล่นดีกว่ากี่ % ของไพร่จำลอง */
export function percentile(vals: number[], mine: number): number {
  if (!vals.length) return 0;
  const below = vals.filter(v => v < mine).length, equal = vals.filter(v => v === mine).length;
  return (below + equal / 2) / vals.length;
}
