# ตัดสไปรต์จากภาพ Gemini พื้นเขียว → เฟรมขนาด native แบบพิกเซลคม
# ใช้: python3 sheet.py in.jpg cols rows target_h out.png [ref_row]
import sys, numpy as np
from PIL import Image
src, cols, rows, target_h, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
ref_row = int(sys.argv[6]) if len(sys.argv) > 6 else rows - 1
im = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
bg = (g > 120) & (g > r + 40) & (g > b + 40)          # พื้นเขียว
cw, ch = W // cols, H // rows
cells = []
for j in range(rows):
    for i in range(cols):
        m = ~bg[j*ch:(j+1)*ch, i*cw:(i+1)*cw]
        # ตัดจุดรบกวนเล็กๆ: ใช้แถว/คอลัมน์ที่มีพิกเซลวัตถุพอสมควร
        ys = np.where(m.sum(1) > 3)[0]; xs = np.where(m.sum(0) > 3)[0]
        cells.append((j, i, ys.min(), ys.max(), xs.min(), xs.max()))
# สเกลเดียวกันทุกเฟรม: ให้ความสูงเฉลี่ยของแถวอ้างอิง (ท่ายืน) = target_h
ref_h = np.mean([c[3] - c[2] + 1 for c in cells if c[0] == ref_row])
s = target_h / ref_h
print('scale', round(1/s, 2), 'px per pixel')
frames = []
for (j, i, y0, y1, x0, x1) in cells:
    x_off, y_off = i*cw, j*ch
    crop = im[y_off + y0:y_off + y1 + 1, x_off + x0:x_off + x1 + 1]
    mask = ~bg[y_off + y0:y_off + y1 + 1, x_off + x0:x_off + x1 + 1]
    h2, w2 = max(1, round(crop.shape[0] * s)), max(1, round(crop.shape[1] * s))
    # ย่อแบบเฉลี่ยเฉพาะพิกเซลวัตถุ (สีไม่ปนเขียว)
    rgba = np.zeros((*crop.shape[:2], 4), np.float64)
    rgba[..., :3] = crop * mask[..., None]; rgba[..., 3] = mask
    def down(a): return np.asarray(Image.fromarray(a.astype(np.float32)).resize((w2, h2), Image.BOX))
    a = down(rgba[..., 3])
    col = np.stack([down(rgba[..., k]) for k in range(3)], -1) / np.maximum(a[..., None], 1e-6)
    alpha = (a > 0.5).astype(np.uint8) * 255
    # ลบสีเขียวที่ติดขอบ (green spill)
    gmax = np.maximum(col[..., 0], col[..., 2]); col[..., 1] = np.minimum(col[..., 1], gmax + 8)
    fr = np.dstack([np.clip(col, 0, 255).astype(np.uint8), alpha])
    # จุดยึดแนวนอน = กึ่งกลางหัว (แถวบนสุด 20%)
    top = max(1, h2 // 5); hx = np.where(alpha[:top].any(0))[0]
    frames.append((j, i, fr, (hx.min() + hx.max()) / 2))
# วางทุกเฟรมในช่องขนาดเท่ากัน เท้าแตะขอบล่าง หัวอยู่กลาง
FW = int(max(max(f.shape[1] - ax, ax) for _, _, f, ax in frames) * 2) + 2
FH = max(f.shape[0] for _, _, f, _ in frames)
sheet = Image.new('RGBA', (FW * cols, FH * rows), (0, 0, 0, 0))
for j, i, f, ax in frames:
    img = Image.fromarray(f, 'RGBA')
    sheet.paste(img, (i * FW + round(FW / 2 - ax), j * FH + FH - f.shape[0]), img)
sheet.save(out)
print('frame', FW, 'x', FH, 'sheet', sheet.size)
