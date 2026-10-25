# ไอคอนเกม: ปรางค์ทองหน้าพระอาทิตย์แดงบนพื้นรักดำ (พิกเซล 32×32) → favicon / apple-touch-icon / PWA
import sys, math
from PIL import Image
K, GOLD, GOLD_D, GOLD_L, RED, BG, DOOR = (43, 29, 20), (224, 176, 74), (168, 121, 42), (246, 220, 138), (178, 58, 38), (31, 20, 14), (30, 19, 12)
im = Image.new('RGBA', (32, 32), BG + (255,))
px = im.load()
def put(x, y, c):
    if 0 <= x < 32 and 0 <= y < 32: px[x, y] = c + (255,)
# พระอาทิตย์
for y in range(32):
    for x in range(32):
        if (x - 15.5) ** 2 + (y - 13) ** 2 <= 9.5 ** 2: put(x, y, RED)
def prang(cx, top, base, wmax):
    # ยอดนภศูล → ฝักข้าวโพดค่อยๆ ผายออก → ฐานย่อมุม
    h = base - top
    for y in range(top, base + 1):
        t = (y - top) / h
        if t < 0.18: w = 0.5
        else: w = 0.6 + (wmax - 0.6) * math.sin(min(1, (t - 0.18) / 0.62) * math.pi / 2)
        if t > 0.8: w = wmax + (t - 0.8) / 0.2 * 2
        x0, x1 = int(round(cx - w)), int(round(cx + w))
        for x in range(x0, x1 + 1):
            c = GOLD_L if x == x0 + 1 and x1 - x0 > 3 else GOLD_D if x == x1 else GOLD
            if t > 0.18 and (y - top) % 3 == 0 and t < 0.8: c = GOLD_D   # ชั้นซ้อน
            put(x, y, c)
        put(x0 - 1, y, K); put(x1 + 1, y, K)
    put(int(cx), top - 1, K)
prang(15.5, 4, 24, 4.5)
prang(5, 17, 25, 1.6)
prang(26, 17, 25, 1.6)
# ฐานไพที
for x in range(1, 31):
    put(x, 25, K); put(x, 26, GOLD_D); put(x, 27, GOLD); put(x, 28, K)
# ขอบทอง
for i in range(32):
    for (x, y) in ((i, 0), (i, 31), (0, i), (31, i)): put(x, y, GOLD_D)
out = sys.argv[1]
for name, s in (('favicon.png', 32), ('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
    im.resize((s, s), Image.NEAREST).save(f'{out}/{name}')
print('ok')
