import type { Content } from './types';
import stats from '../../data/stats.json';
import careers from '../../data/careers.json';
import childJobs from '../../data/childJobs.json';
import shop from '../../data/shop.json';
import reigns from '../../data/reigns.json';
import karmaFixed from '../../data/karmaFixed.json';
import karmaGeneric from '../../data/karmaGeneric.json';
import historical from '../../data/historical.json';
import siege from '../../data/siege.json';
import endings from '../../data/endings.json';

export const content = {
  stats, careers, childJobs, shop, reigns, karmaFixed, karmaGeneric, historical, siege, endings,
} as unknown as Content;

export const START_AGE = 9;

/** ช่วงปีของแต่ละชาติ คิดจากตารางรัชสมัย */
export function lifeRange(life: number): { from: number; to: number } {
  const rs = content.reigns.filter(r => r.life === life);
  return { from: Math.min(...rs.map(r => r.from)), to: Math.max(...rs.map(r => r.to)) };
}

export const NUM_LIVES = Math.max(...content.reigns.map(r => r.life));
