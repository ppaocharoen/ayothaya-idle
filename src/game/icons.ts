// ไอคอน pixel ขนาด 12×12 วาดเอง (ไม่ใช้อีโมจิ) — แสดงเป็น SVG ขอบคม
// ตัวอักษรแต่ละตัว = สีหนึ่งจุด · '.' = โปร่งใส
const PAL: Record<string, string> = {
  k: '#2b1d14', g: '#e0b04a', G: '#a8792a', y: '#f6dc8a', r: '#c0432c', R: '#7e2418', w: '#fbf3e2',
  b: '#8a5a34', B: '#5b3a20', e: '#5e9a4e', E: '#3d6b35', u: '#4a6fa8', U: '#2f4a78', s: '#c68a5a',
  P: '#e48aa8', o: '#e08a3a', p: '#8a5aa8', a: '#9aa3a8',
};

const ICONS: Record<string, string[]> = {
  coin: ['............', '...kkkkkk...', '..kggggggk..', '.kgyyggggGk.', '.kgyGGGGgGk.', '.kggGkkGgGk.', '.kggGkkGgGk.', '.kggGGGGgGk.', '.kgggggggGk.', '..kGGGGGGk..', '...kkkkkk...', '............'],
  lotus: ['............', '.....kk.....', '....kPPk....', '..k.kPwPk.k.', '.kPkkPwPkkPk', '.kPPkPPPkPPk', '..kPPPPPPPk.', '...kkPPPkk..', '..kEEEkkEEk.', '.kEEEEEEEEk.', '..kkkkkkkk..', '............'],
  heart: ['............', '..kkk..kkk..', '.krrrkkrrrk.', 'krwrrrrrrrRk', 'krrrrrrrrrRk', 'krrrrrrrrrRk', '.krrrrrrrRk.', '..krrrrrRk..', '...krrrRk...', '....krRk....', '.....kk.....', '............'],
  // สเตตัส
  book: ['............', '............', '.kkkk..kkkk.', 'kwwwwkkwwwwk', 'kwbbwkkwbbwk', 'kwwwwkkwwwwk', 'kwbbwkkwbbwk', 'kwwwwkkwwwwk', 'kkkkwkkwkkkk', '.uUUkkkkUUu.', '..kkk..kkk..', '............'],
  arm: ['............', '....kkk.....', '...kssskk...', '...ksssssk..', '....kkssssk.', '..kkk.kssssk', '.kssskkssssk', 'kssssssssssk', 'kssssssssssk', '.kssssssssk.', '..kkkkkkkk..', '............'],
  eye: ['............', '............', '...kkkkkk...', '..kwwwwwwk..', '.kwwkkkkwwk.', 'kwwkuuuukwwk', 'kwwkuwuukwwk', '.kwwkkkkwwk.', '..kwwwwwwk..', '...kkkkkk...', '............', '............'],
  sword: ['..........kk', '.........kwk', '........kwk.', '.......kwk..', '......kwk...', '..k..kwk....', '..kkkwk.....', '...kgk......', '..kgkkk.....', '.kgk..k.....', 'kgk.........', 'kk..........'],
  candle: ['.....kk.....', '....kook....', '....koyk....', '.....kk.....', '....kwwk....', '....kwwk....', '....kwwk....', '....kwwk....', '...kkwwkk...', '..kggggggk..', '..kGGGGGGk..', '...kkkkkk...'],
  hood: ['....kkkk....', '...kBBBBk...', '..kBBBBBBk..', '..kBkkkkBk..', '.kBkwkkwkBk.', '.kBkkkkkkBk.', '.kBBkkkkBBk.', '..kBBBBBBk..', '..kBBBBBBk..', '.kBBBBBBBBk.', '.kBBBBBBBBk.', '..kkkkkkkk..'],
  crown: ['.....kk.....', '.....gk.....', '....kgGk....', '....kggk....', '...kgyGGk...', '...kggggk...', '..kgrgggrk..', '..kggggggk..', '.kgGgGgGgGk.', '.kggggggggk.', '..kkkkkkkk..', '............'],
  chest: ['............', '..kkkkkkkk..', '.kbbbbbbbbk.', '.kbBBBBBBbk.', 'kkkkkkkkkkkk', 'kbbbbggbbbbk', 'kbbbgkkgbbbk', 'kbbbbggbbbbk', 'kbbbbbbbbbbk', 'kBBBBBBBBBBk', 'kkkkkkkkkkkk', '............'],
  // แนวทางชีวิต
  hoe: ['kkkkk.......', 'kwwwwk......', 'kkkkwkk.....', '....kbbk....', '.....kbbk...', '......kbbk..', '.......kbbk.', '........kbbk', '.........kbk', '..........kk', '............', '............'],
  scales: ['.....kk.....', 'kkkkkggkkkkk', 'k....gg....k', 'k....gg....k', 'kk...gg...kk', 'ggk..gg..kgg', 'kkk..gg..kkk', '.....gg.....', '....kggk....', '...kggggk...', '..kkkkkkkk..', '............'],
  // แท็บ
  person: ['....kk......', '....kBk.....', '...kkkkk....', '..ksssssk...', '..ksksksk...', '..ksssssk...', '...kssk.....', '..kuuuuuk...', '.kuuuuuuuk..', '.kskuuuksk..', '..kUUkUUk...', '..kkk.kkk...'],
  stall: ['............', 'kkkkkkkkkkkk', 'krwrwrwrwrwk', 'kkkkkkkkkkkk', '.kbk....kbk.', '.kbk....kbk.', '.kbkkkkkkbk.', '.kbgggoggbk.', '.kbkkkkkkbk.', '.kbk....kbk.', '.kkk....kkk.', '............'],
  bars: ['............', '........kkk.', '........kgk.', '....kkk.kgk.', '....kek.kgk.', 'kkk.kek.kgk.', 'kuk.kek.kgk.', 'kuk.kek.kgk.', 'kuk.kek.kgk.', 'kkkkkkkkkkkk', '............', '............'],
  scroll: ['............', '.kkkkkkkkk..', 'kwkwwwwwwwk.', 'kkkwkkkkkwk.', '..kwwwwwwwk.', '..kwkkkkkwk.', '..kwwwwwwwk.', '..kwkkkkwwk.', '..kwwwwwwkkk', '..kwwwwwwkwk', '..kkkkkkkkk.', '............'],
  // ปุ่มควบคุม
  play: ['............', '..kk........', '..kgk.......', '..kggk......', '..kgggk.....', '..kggggk....', '..kggggk....', '..kgggk.....', '..kggk......', '..kgk.......', '..kk........', '............'],
  pause: ['............', '..kkk..kkk..', '..kgk..kgk..', '..kgk..kgk..', '..kgk..kgk..', '..kgk..kgk..', '..kgk..kgk..', '..kgk..kgk..', '..kgk..kgk..', '..kgk..kgk..', '..kkk..kkk..', '............'],
  note: ['......kkkk..', '......kggk..', '......kgkkk.', '......kg....', '......kg....', '......kg....', '...kkkkg....', '..kgggggk...', '..kggggk....', '...kkkk.....', '............', '............'],
  speaker: ['............', '.....k......', '....kk..k...', 'kkkkgk...k..', 'kgggggk.k.k.', 'kgggggk.k.k.', 'kgggggk.k.k.', 'kkkkgk...k..', '....kk..k...', '.....k......', '............', '............'],
  mute: ['............', '.....k......', '....kk......', 'kkkkgk.r...r', 'kgggggk.r.r.', 'kgggggk..r..', 'kgggggk.r.r.', 'kkkkgk.r...r', '....kk......', '.....k......', '............', '............'],
  // สถานะ
  check: ['............', '..........kk', '.........kek', '........kek.', 'kk.....kek..', 'kek...kek...', '.kek.kek....', '..kekek.....', '...kek......', '....k.......', '............', '............'],
  cross: ['............', '.kk......kk.', '.krk....krk.', '..krk..krk..', '...krkkrk...', '....krrk....', '....krrk....', '...krkkrk...', '..krk..krk..', '.krk....krk.', '.kk......kk.', '............'],
  star: ['.....kk.....', '....kgyk....', '....kggk....', 'kkkkkggkkkkk', 'kgggggggggGk', '.kgggggggGk.', '..kgggggGk..', '..kggkkgGk..', '.kggk..kgGk.', '.kgk....kGk.', '.kk......kk.', '............'],
  up: ['.....kk.....', '....kggk....', '...kggggk...', '..kggggggk..', '.kkkggggkkk.', '...kggggk...', '...kggggk...', '...kggggk...', '...kggggk...', '...kkkkkk...', '............', '............'],
  // ร้านค้า
  house: ['.....kk.....', '....kRRk....', '...kRrrRk...', '..kRrrrrRk..', '.kRrrrrrrRk.', 'kkkkkkkkkkkk', '.kbbbbbbbbk.', '.kbwbkkbwbk.', '.kbbbkkbbbk.', '.kbbbkkbbbk.', '.kkkkkkkkkk.', '............'],
  people: ['............', '..kk....kk..', '.kssk..kssk.', '.kssk..kssk.', '..kk....kk..', '.kuuk..keek.', 'kuuuukkeeeek', 'kuuuukkeeeek', '.kuuk..keek.', '.kkkk..kkkk.', '............', '............'],
  temple: ['.....kk.....', '.....kgk....', '....kggk....', '....kggk....', '...kggggk...', '..kkkkkkkk..', '..kRRRRRRk..', '.kkkkkkkkkk.', '.kwkwkkwkwk.', '.kwkwkkwkwk.', 'kkkkkkkkkkkk', '............'],
  pouch: ['............', '....kkkk....', '.....kk.....', '....kbbk....', '...kbbbbk...', '..kbbggbbk..', '..kbgbbgbk..', '..kbbggbbk..', '..kbbbbbbk..', '...kkkkkk...', '............', '............'],
  // อาชีพ/งานเด็ก
  rice: ['....k.k.k...', '...kekekek..', '...keeeeek..', '....keeek...', '....kgggk...', '....kgggk...', '....kgggk...', '...kgggggk..', '..kgggggggk.', '..kkkkkkkkk.', '............', '............'],
  seal: ['....kkkk....', '....kbbk....', '....kbbk....', '....kbbk....', '...kkkkkk...', '..kbbbbbbk..', '..kkkkkkkk..', '.kRRRRRRRRk.', '.kRrrrrrrRk.', '.kkkkkkkkkk.', '............', '............'],
  conch: ['............', '....kkkk....', '...kwwwwk...', '..kwwkkwwk..', '.kwwkwwkwwk.', '.kwkwwwkwwk.', '.kwkwkkwwwk.', '.kwwkwwwwk..', '..kwwkkwwk..', '...kwwwwwk..', '....kkkkkkk.', '............'],
  wheel: ['...kkkkkk...', '..kssssssk..', '.ksk.kk.ksk.', 'ksk..kgk.ksk', 'ksk..kgk.ksk', 'kskkkggkkksk', 'ksgggggggksk', 'ksk.kgk..ksk', 'ksk.kgk..ksk', '.ksk.kk.ksk.', '..kssssssk..', '...kkkkkk...'],
  leaf: ['............', '.........kk.', '......kkkek.', '....kkeeeek.', '...keeeeeek.', '..keeeeeeek.', '..keeEeeek..', '..keEeeek...', '..kEeekk....', '.kEkkk......', 'kk..........', '............'],
  bell: ['.....kk.....', '....kggk....', '...kggggk...', '...kgyggk...', '..kggggggk..', '..kggggggk..', '..kggggggk..', '.kggggggggk.', 'kkkkkkkkkkkk', '.....kk.....', '.....kk.....', '............'],
  lock: ['............', '....kkkk....', '...kaaaak...', '..ka....ak..', '..ka....ak..', '.kkkkkkkkkk.', '.kggggggggk.', '.kggGkkGggk.', '.kgggkkgggk.', '.kgggkkgggk.', '.kGGGGGGGGk.', '.kkkkkkkkkk.'],
  clock: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwkwwwwk.', 'kwwwwkwwwwwk', 'kwwwwkwwwwwk', 'kwwwwkkkkwwk', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', '.kwwwwwwwwk.', '..kwwwwwwk..', '...kkkkkk...', '............'],
};

/** SVG ของไอคอน · size = ขนาดที่แสดง (px) */
export function icon(name: string, size = 20, cls = ''): string {
  const rows = ICONS[name] ?? ICONS.coin;
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      let w = 1; while (x + w < row.length && row[x + w] === ch) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PAL[ch] ?? '#000'}"/>`;
      x += w - 1;
    }
  });
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export const STAT_ICON: Record<string, string> = {
  'ความรู้': 'book', 'พละกำลัง': 'arm', 'ไหวพริบ': 'eye', 'ต่อสู้': 'sword',
  'ไสยเวทย์': 'candle', 'หลบหลีก': 'hood', 'บารมี': 'crown', 'โภคทรัพย์': 'chest', 'ความชอบ': 'heart',
};
export const PATH_ICON: Record<string, string> = { work: 'hoe', study: 'book', merit: 'lotus', balance: 'scales' };
export const CAREER_ICON: Record<string, string> = { 'สายลับ': 'hood', 'พ่อค้า': 'pouch', 'เกษตรกร': 'rice', 'บริหาร': 'seal', 'ปุโรหิต': 'conch', 'ทหาร': 'sword' };
export const CHILD_ICON: Record<string, string> = { 'หาของป่า': 'leaf', 'งานวัด': 'lotus', 'คาราวาน': 'wheel' };
