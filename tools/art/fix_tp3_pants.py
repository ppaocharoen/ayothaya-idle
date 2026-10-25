# TP3 (พราหมณ์ชุดธรรมดา อารมณ์): Gemini ลืมเปลี่ยนโจงกระเบนสีครามเป็นสีขาวในแถวดีใจ → แทนสีครามด้วยโทนขาว
import sys, numpy as np
from PIL import Image
p = sys.argv[1]; im = np.asarray(Image.open(p).convert('RGBA')).copy()
H, W = im.shape[:2]; fh = H // 3
row = im[:fh]
r, g, b, a = (row[..., i].astype(int) for i in range(4))
indigo = (a > 0) & (b > r + 12) & (b >= g)
lum = (0.3 * r + 0.59 * g + 0.11 * b)
lo, hi = lum[indigo].min(), lum[indigo].max()
t = ((lum - lo) / max(1, hi - lo)).clip(0, 1)
dark, light = np.array([150, 140, 122]), np.array([242, 238, 226])
newc = (dark[None, None] + (light - dark)[None, None] * t[..., None]).astype(np.uint8)
row[indigo, :3] = newc[indigo]
im[:fh] = row
Image.fromarray(im).save(p); print('recolored', int(indigo.sum()), 'px')
