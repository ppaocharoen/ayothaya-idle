"""One-off: แปลงเนื้อหาจาก prototype v0.19 (ไฟล์เดียว) เป็นไฟล์ข้อมูลใน data/
ใช้: python3 tools/legacy/extract_v019.py <v0.19.html> <legacy_consts.json> <summary_v0_13.xlsx>
legacy_consts.json = ค่าคงที่ที่ดึงจาก game_engine.js ด้วย jsdom (ดู dump.js ในประวัติ)
ตัวเลขราคา/ค่าที่ได้เก็บไว้ในฟิลด์ legacy* เพื่ออ้างอิงเท่านั้น สมดุลใหม่จะอยู่ใน config แยก"""
import json, re, sys
import openpyxl

html_path, consts_path, xlsx_path = sys.argv[1:4]
h = open(html_path, encoding='utf-8').read()
def block(i):
    return json.loads(re.search(r'<script id="%s" type="application/json">(.*?)</script>' % i, h, re.S).group(1))
career_data, shop, events, reigns = (block(x) for x in ['career-data','shop-data','events-data','reign-data'])
C = json.load(open(consts_path, encoding='utf-8'))
out = {}

def effects(d): return {k: v for k, v in d.items()}
def choices(lst): return [{"label": c[0], "effects": effects(c[1])} for c in lst]

out['stats'] = [{"key": k, "display": C['STAT_DISPLAY'][k], "role": C['STAT_ROLE_DESC'].get(k, "")} for k in C['STATS']]

careers = []
for key, gate in C['CAREERS'].items():
    t = career_data['titles'][key]
    careers.append({"key": key, "fullname": career_data['fullnames'][key], "gateStat": gate,
                    "secondaryStat": C['CAREER_SECONDARY_STAT'][key],
                    "titles": {"0": t['lv0'], "1": t['lv1'], "light": t['light'], "dark": t['dark']}})
out['careers'] = {"careers": careers,
                  "monastic": {"key": "บรรพชิต", "fullname": C['BONCHIT_FULLNAME'], "gateStat": "บารมี", "titles": C['BONCHIT_TITLES']}}

out['childJobs'] = [{"key": k, "name": v['name'], "desc": v['desc'], "stats": v['stats'], "suggests": v['suggests'], "note": v.get('suggestNote', '')}
                    for k, v in C['CHILD_JOBS'].items()]

def split_item(s):
    m = re.match(r'ระดับ\s*(\d+)\s*:\s*(.*?)\s*[–-]\s*(.*)$', s)
    return int(m.group(1)), m.group(2).strip(), m.group(3).strip().rstrip(',').strip()
shop_out = {"careerItems": {}, "accommodations": [], "retainers": [], "meritItems": [], "commonItems": []}
for car, items in shop['career_items'].items():
    shop_out['careerItems'][car] = [dict(zip(("level", "name", "desc"), split_item(s)), legacyPrice=C['CAREER_ITEM_PRICES'][i]) for i, s in enumerate(items)]
for kind in ('accommodations', 'retainers'):
    shop_out[kind] = [dict(zip(("level", "name", "desc"), split_item(s)), legacyPrice=C['ACCOM_RETAINER_PRICES'][i]) for i, s in enumerate(shop[kind])]
for i, m in enumerate(shop['merit_items']):
    nm = m['name'].rstrip(':').strip()
    shop_out['meritItems'].append({"level": i + 1, "name": nm, "effect": m['effect'].replace('ผลลัพธ์:', '').strip(),
                                   "legacyPrice": C['MERIT_ITEM_PRICES'][i], "legacyMerit": C['MERIT_ITEM_VALUES'][i]})
for stat, items in C['COMMON_ITEMS'].items():
    for it in items:
        shop_out['commonItems'].append({"stat": stat, "name": it['name'], "desc": it['desc'], "legacyPrice": it['price'],
                                        "legacyDelta": it['delta'], "legacyAffection": it.get('affection', 0)})
out['shop'] = shop_out

out['reigns'] = [{"life": int(life), "from": r[0], "to": r[1], "king": r[2], "context": r[3]} for life, lst in reigns.items() for r in lst]

kf = []
for life, lst in events['karma'].items():
    for i, ev in enumerate(lst):
        kf.append({"id": f"L{life}-K{i+1}", "life": int(life), "age": ev['age'], "year": ev['year'], "title": ev['title'], "choices": choices(ev['choices'])})
out['karmaFixed'] = kf

kg = []
for i, t in enumerate(C['GENERIC_KARMA_TEMPLATES']):
    r = t.get('risky')
    kg.append({"id": f"G{i+1:02d}", "title": t['title'], "choices": choices(t['choices']),
               "risky": None if not r else {"label": r['label'], "chance": r['chance'], "cost": r.get('cost', {}),
                                             "success": r['success'], "fail": r['fail']}})
out['karmaGeneric'] = kg

hist = []
for life, lst in events['historical'].items():
    for i, ev in enumerate(lst):
        y, a = ev['year'], ev['age']
        rec = {"id": f"L{life}-H{i+1:02d}", "life": int(life), "kind": ev['kind'], "title": ev['title'], "desc": ev.get('desc', '')}
        if isinstance(y, list): rec.update(yearFrom=y[0], yearTo=y[1], ageFrom=a[0], ageTo=a[1])
        else: rec.update(yearFrom=y, yearTo=y, ageFrom=a, ageTo=a)
        if ev.get('check_stat'): rec['checkStat'] = ev['check_stat']
        if ev.get('choices'): rec['choices'] = choices(ev['choices'])
        hist.append(rec)
out['historical'] = hist
out['siege'] = events['siege']

wb = openpyxl.load_workbook(xlsx_path, data_only=True)
ws = wb['17.เอนดิ้ง']
ends = []
for row in ws.iter_rows(min_row=3, values_only=True):
    if row[0] and row[0] != 'เอนดิ้ง': ends.append({"id": ["fight","flee","reincarnate","nirvana","defend"][len(ends)], "name": row[0], "legacyCondition": row[1] or "", "summary": row[2] or "", "note": row[3] or ""})
out['endings'] = ends

for name, data in out.items():
    with open(f'data/{name}.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2); f.write('\n')
    print(name, len(data) if isinstance(data, list) else 'ok')
