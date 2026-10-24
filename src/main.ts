// หน้าคลังเนื้อหา (ขั้น 2) — ดูข้อมูลทั้งหมดบนมือถือได้ ก่อนเริ่มทำตัวเกมจริงในขั้น 3–4
import './style.css';
import { content, lifeRange, NUM_LIVES } from './content';
import type { Choice, Effects } from './content/types';

const TH = '๐๑๒๓๔๕๖๗๘๙';
const th = (n: number | string) => String(n).replace(/\d/g, d => TH[+d]);
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const statName = (k: string) => content.stats.find(s => s.key === k)?.display ?? k;
const fx = (e: Effects) => Object.entries(e).map(([k, v]) => `<span class="fx ${(v as number) < 0 ? 'neg' : ''}">${esc(statName(k))} ${(v as number) >= 0 ? '+' : ''}${th(v as number)}</span>`).join(' ');
const choices = (cs: Choice[]) => `<ol class="choices">${cs.map(c => `<li>${esc(c.label)} ${fx(c.effects)}</li>`).join('')}</ol>`;

type Tab = { id: string; label: string; render: () => string };

function timeline(): string {
  let html = '';
  for (let life = 1; life <= NUM_LIVES; life++) {
    const r = lifeRange(life);
    const reigns = content.reigns.filter(x => x.life === life);
    const items = [
      ...content.karmaFixed.filter(k => k.life === life).map(k => ({ y: k.year, html: `<div class="ev karma"><div class="meta">พ.ศ. ${th(k.year)} · อายุ ${th(k.age)} · กงกรรม</div><div class="title">${esc(k.title)}</div>${choices(k.choices)}</div>` })),
      ...content.historical.filter(h => h.life === life).map(h => {
        const yr = h.yearFrom === h.yearTo ? th(h.yearFrom) : `${th(h.yearFrom)}–${th(h.yearTo)}`;
        const kind = h.kind === 'check' ? `เช็ค ${esc(statName(h.checkStat!))}` : h.kind === 'choice' ? 'มีตัวเลือก' : 'บรรยาย';
        return { y: h.yearFrom, html: `<div class="ev hist ${h.kind}"><div class="meta">พ.ศ. ${yr} · ${kind}</div><div class="title">${esc(h.title)}</div>${h.desc ? `<p>${esc(h.desc)}</p>` : ''}${h.choices ? choices(h.choices) : ''}</div>` };
      }),
    ].sort((a, b) => a.y - b.y);
    html += `<details class="life" ${life === 1 ? 'open' : ''}><summary><b>ชาติที่ ${th(life)}</b> พ.ศ. ${th(r.from)}–${th(r.to)} <span class="count">${th(items.length)} เหตุการณ์</span></summary>
      <div class="reigns">${reigns.map(x => `<div class="reign"><div class="meta">${th(x.from)}–${th(x.to)}</div><b>${esc(x.king)}</b><p>${esc(x.context)}</p></div>`).join('')}</div>
      ${items.map(i => i.html).join('')}</details>`;
  }
  return html;
}

function careers(): string {
  const cs = content.careers;
  return cs.careers.map(c => {
    const t = c.titles;
    const rows = Array.from({ length: 18 }, (_, i) => i + 2).map(lv => `<tr><td>${th(lv)}</td><td>${esc(t.light[String(lv)] ?? '')}</td><td>${esc(t.dark[String(lv)] ?? '')}</td></tr>`).join('');
    return `<details class="card"><summary><b>${esc(c.key)}</b> · ${esc(c.fullname)}<div class="meta">หลัก ${esc(statName(c.gateStat))} · รอง ${esc(statName(c.secondaryStat))}</div></summary>
      <p class="meta">เลเวล ๐: ${esc(t['0'])}<br>เลเวล ๑: ${esc(t['1'])}</p>
      <table><thead><tr><th>เลเวล</th><th>สายสว่าง</th><th>สายมืด</th></tr></thead><tbody>${rows}</tbody></table></details>`;
  }).join('') + `<details class="card"><summary><b>${esc(cs.monastic.key)}</b> · ${esc(cs.monastic.fullname)}</summary><ol start="0">${Object.values(cs.monastic.titles).map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>`
    + `<h3>งานเด็ก (อายุ ๙–๑๑)</h3>` + content.childJobs.map(j => `<div class="card"><b>${esc(j.name)}</b><p>${esc(j.desc)}</p><div class="meta">ฝึก ${j.stats.map(statName).join(', ')} · เหมาะกับ ${j.suggests.join(', ')}</div></div>`).join('')
    + `<h3>สเตตัส ๘ ด้าน</h3>` + content.stats.map(s => `<div class="card"><b>${esc(s.display)}</b> <span class="meta">(${esc(s.key)})</span><p>${esc(s.role)}</p></div>`).join('');
}

function shop(): string {
  const s = content.shop;
  const item = (name: string, desc: string, lv?: number) => `<div class="item">${lv ? `<span class="lv">${th(lv)}</span>` : ''}<div><b>${esc(name)}</b><p>${esc(desc)}</p></div></div>`;
  return `<h3>ของประจำสายอาชีพ</h3>` + Object.entries(s.careerItems).map(([k, items]) => `<details class="card"><summary><b>${esc(k)}</b></summary>${items.map(i => item(i.name, i.desc, i.level)).join('')}</details>`).join('')
    + `<h3>ที่พำนัก</h3><div class="card">${s.accommodations.map(i => item(i.name, i.desc, i.level)).join('')}</div>`
    + `<h3>ไพร่บริวาร</h3><div class="card">${s.retainers.map(i => item(i.name, i.desc, i.level)).join('')}</div>`
    + `<h3>ของทำบุญ</h3><div class="card">${s.meritItems.map(i => item(i.name, i.effect, i.level)).join('')}</div>`
    + `<h3>ของสามัญ</h3><div class="card">${s.commonItems.map(i => item(i.name, `${statName(i.stat)} · ${i.desc}`)).join('')}</div>`;
}

function karma(): string {
  return `<p class="note">หมุนเวียนตลอดชีวิตหลังอายุ ๑๗ · รอบใหม่จะเพิ่มเป็นราว ๘๐–๑๒๐ แบบ</p>` + content.karmaGeneric.map(k => `<div class="ev karma"><div class="title">${esc(k.title)}</div>${choices(k.choices)}${k.risky ? `<div class="risky">เสี่ยงดวง: ${esc(k.risky.label)} (โอกาส ${th(Math.round(k.risky.chance * 100))}%)</div>` : ''}</div>`).join('');
}

function endings(): string {
  return content.endings.map(e => `<div class="card"><b>${esc(e.name)}</b><p>${esc(e.summary)}</p><div class="meta">เงื่อนไขเดิม: ${esc(e.legacyCondition)}</div></div>`).join('')
    + `<h3>ฉากล้อมกรุง ${th(content.siege.length)} ฉาก</h3>` + content.siege.map(s => `<div class="ev"><div class="meta">${th(s.n)} · ${esc(s.label)}</div><p>✓ ${esc(s.ok)}</p><p class="fail">✗ ${esc(s.fail)}</p></div>`).join('');
}

const tabs: Tab[] = [
  { id: 'timeline', label: 'ไทม์ไลน์', render: timeline },
  { id: 'careers', label: 'อาชีพ', render: careers },
  { id: 'shop', label: 'ร้านค้า', render: shop },
  { id: 'karma', label: 'กงกรรม', render: karma },
  { id: 'endings', label: 'เอนดิ้ง', render: endings },
];

const nav = document.getElementById('tabs')!;
const app = document.getElementById('app')!;
function show(id: string) {
  const t = tabs.find(x => x.id === id) ?? tabs[0];
  app.innerHTML = t.render();
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === t.id));
  try { localStorage.setItem('tab', t.id); } catch { /* ไม่มี storage ก็ไม่เป็นไร */ }
  window.scrollTo(0, 0);
}
nav.innerHTML = tabs.map(t => `<button data-id="${t.id}">${t.label}</button>`).join('');
nav.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b) show(b.dataset.id!); });
let start = 'timeline';
try { start = localStorage.getItem('tab') ?? start; } catch { /* ignore */ }
show(start);
