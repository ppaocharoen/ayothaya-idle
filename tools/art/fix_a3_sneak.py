# ลบกระสอบที่ Gemini เผลอวาดติดมาในท่าย่อง (A3 แถวกลาง) — ให้ไม่ดูซ้อนกับท่าแบกกระสอบ
import sys
from PIL import Image
p = sys.argv[1]
im = Image.open(p).convert('RGBA'); px = im.load()
fw, fh = im.width // 2, im.height // 3
y0 = fh  # แถวท่าย่อง
def clear(x0, x1, ya, yb, col):
    for y in range(y0 + ya, y0 + yb):
        for x in range(col * fw + x0, col * fw + x1):
            px[x, y] = (0, 0, 0, 0)
# เฟรม 1: กระสอบทางซ้ายหัว, เชือกโค้งเหนือหัว, กำปั้นข้างหู
clear(0, 41, 0, 29, 0); clear(0, 44, 0, 4, 0); clear(61, fw, 0, 27, 0)
# เฟรม 2: กระสอบทางซ้ายหัว
clear(0, 41, 0, 33, 1)
# เติมเส้นขอบตรงรอยตัด (ไหล่/หลังที่เคยถูกกระสอบบัง)
OUT = (30, 19, 12, 255)
for col, (x1, yb) in ((0, (41, 29)), (1, (41, 33))):
    for x in range(col * fw, col * fw + x1 + 1):
        for y in range(y0 + yb - 1, y0 + yb + 3):
            if px[x, y][3] and (px[x, y - 1][3] == 0 or (x > col * fw and px[x - 1, y][3] == 0)):
                px[x, y] = OUT
im.save(p)
