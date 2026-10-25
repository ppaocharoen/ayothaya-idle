# พรอมต์ภาพ (อโยธยา Idle)

วิธีใช้: เปิด Gemini (Nano Banana) → แนบรูปตามที่บอกในแต่ละชุด → วางพรอมต์ทั้งก้อน → เซฟเป็น `.jpg` ตามชื่อที่บอก ใส่ `art/raw/` แล้วบอก Claude ว่า "ใส่แล้ว"
ถ้ามีช่องไหนตัวโดนตัด พิมพ์ต่อในแชทเดิม: `Same sheet, but zoom out: make the character 25% smaller in every frame so the whole body including feet fits with margin.`

## สรุปสถานะ

**ใส่ในเกมแล้ว ✅**
- เด็ก ๙–๑๑: A1–A5
- วัยรุ่น ๑๒–๑๗: ลูกมือ B1–B6 · ชุดธรรมดา T1–T3 · พราหมณ์ TP1–TP3
- ผู้ใหญ่ ๑๘–๕๔: อาชีพ C1–C6 · ชุดธรรมดา U1–U3 · พราหมณ์ UP1–UP3
- ชรา ๕๕+: อาชีพ D1–D6 · ชุดธรรมดา V1–V2 · พราหมณ์ VP1–VP3
- ฉาก: ทิวเมือง E4 · บ้าน ๖ ระดับ E2
- สัตว์: บางแก้ว · วิเชียรมาศ · นกเขาชวา · หลังอาน · สีสวาด

**เหลือ (เรียงตามลำดับแนะนำ)**
| ลำดับ | ชุด | วิธี | ไฟล์ |
|---|---|---|---|
| 1 | V3 ชราชุดธรรมดา: อารมณ์ (ตอนนี้ใช้ภาพผู้ใหญ่ U3 แทน) | แนบ U3 แล้วใช้พรอมต์ชรา | V3.jpg |
| 2 | F1 พญายม · F5 วิญญาณ (มินิเกมหลังตาย ตอนนี้วาดด้วยโค้ด) | เจนใหม่ (พรอมต์ด้านล่าง) | F1.jpg F5.jpg |
| 3 | สัตว์เพิ่ม: ขาวมณี · นกกรงหัวจุก · นกเอี้ยง ฯลฯ | เจนใหม่ (แม่แบบด้านล่าง) | P_ชื่อ.jpg |
| 4 | C8/C9 ยศสูงทางสว่าง/มืด ๖ อาชีพ | แก้จาก C1–C6 | ทีหลัง |
| 5 | E3 ฉากทำงาน ๖ ฉาก · F7 เปรต · F8 เทวดา · H ภาพเหตุการณ์ใหญ่ | เจนใหม่ | ทีหลัง |

แก้เล็กน้อย (ไม่ด่วน): ช่องนอนหลับของ TP3 ยังเป็นทรงมหาดไทย · ช่องดีใจของ TP3/UP3/VP3 โจงกระเบนยังเป็นสีคราม (ผมแก้สีด้วยโค้ดแล้ว)

---

## ผู้ใหญ่ ๑๘–๕๔ — ทำไมใช้วิธี "แก้ภาพ"
แก้จากชุดวัยรุ่นที่มีอยู่ ดีกว่าเจนใหม่ ๓ ข้อ: หน้าตัวละครเหมือนเดิมแน่นอน · ท่าและการจัดช่องตรงกัน เกมใช้ท่าเดิมได้ทันที · ใช้โควต้าน้อย
เกมเตรียมรองรับไว้แล้ว: ใส่ไฟล์ชุดไหนมา ตัวละครอายุ ๑๘ ขึ้นไปจะเปลี่ยนไปใช้ชุดนั้นเอง ชุดที่ยังไม่มีจะใช้ภาพวัยรุ่นขยายตัวแทนไปก่อน
ทรงผม: ผู้ชายทุกอาชีพยังเป็นมหาดไทย · พราหมณ์เกล้ามวย

## U1–U3 — ผู้ใหญ่ชุดธรรมดา → `U1.jpg` `U2.jpg` `U3.jpg`
ทำ ๓ รอบ: แนบ T1 → เซฟ U1 · แนบ T2 → U2 · แนบ T3 → U3
แนบ `T1.jpg` แล้วใช้:
```
Edit this sprite sheet. Make the boy a young adult man about 25 years old in every frame: about 15% taller, broader shoulders and chest, longer limbs, a more defined jaw and a thin moustache. Keep the mahatthai haircut, the same indigo chong kraben with the brown-gold sash, shirtless, barefoot.
Keep the same poses, the same layout and the same number of frames, and keep each frame in the same cell position.
Keep the exact same 8× nearest-neighbor square pixel grid, no blur, no anti-aliasing. Every figure stays fully inside its own cell with empty margin on all sides — if the taller body would not fit, draw everyone slightly smaller, the same size in all frames. Background stays solid pure green #00FF00. No text, no labels, no grid lines.
```

## UP1–UP3 — พราหมณ์ผู้ใหญ่ชุดธรรมดา → `UP1.jpg` `UP2.jpg` `UP3.jpg`
แนบ TP1 → UP1 · TP2 → UP2 · TP3 → UP3
แนบ `TP1.jpg` แล้วใช้:
```
Edit this sprite sheet. Make the boy a young adult man about 25 years old in every frame: about 15% taller, broader shoulders and chest, longer limbs, a more defined jaw and a thin moustache. Keep the Brahmin hair bun with the white tie, the white chong kraben and white sash, shirtless, barefoot. In the sleeping frame also give him the Brahmin bun and white chong kraben.
Keep the same poses, the same layout and the same number of frames, and keep each frame in the same cell position.
Keep the exact same 8× nearest-neighbor square pixel grid, no blur, no anti-aliasing. Every figure stays fully inside its own cell with empty margin on all sides — if the taller body would not fit, draw everyone slightly smaller, the same size in all frames. Background stays solid pure green #00FF00. No text, no labels, no grid lines.
```

## C1–C6 — ผู้ใหญ่ตามอาชีพ → `C1.jpg` … `C6.jpg`
แนบ B ของอาชีพนั้น (B1 → C1 …) ใช้พรอมต์หลักด้านล่าง แล้ว **เปลี่ยนประโยค "New outfit" ตามอาชีพ**
แนบ `B1.jpg` แล้วใช้:
```
Edit this sprite sheet. Make the boy a young adult man about 25 years old in every frame: about 15% taller, broader shoulders and chest, longer limbs, a more defined jaw and a thin moustache. New outfit: [ใส่ประโยคชุดของอาชีพจากตารางข้างล่าง]. Keep the tools he holds in each pose.
Keep the same poses, the same layout and the same number of frames, and keep each frame in the same cell position.
Keep the exact same 8× nearest-neighbor square pixel grid, no blur, no anti-aliasing. Every figure stays fully inside its own cell with empty margin on all sides — if the taller body would not fit, draw everyone slightly smaller, the same size in all frames. Background stays solid pure green #00FF00. No text, no labels, no grid lines.
```

| ไฟล์ | แนบ | ประโยค New outfit (ก๊อปไปแทนในวงเล็บ) |
|---|---|---|
| C1 ทหาร | B1.jpg | a red short-sleeved soldier tunic, dark indigo chong kraben, a wide red waist sash, a short Thai sword (daab) in a wooden scabbard at the waist, a red cloth headband; mahatthai haircut |
| C2 พ่อค้า | B2.jpg | a white long-sleeved Thai shirt (sua khaen krabok) with a cloth pouch of coins at the waist, dark patterned chong kraben, a brass weighing scale; mahatthai haircut |
| C3 เกษตรกร | B3.jpg | the woven bamboo hat (ngob), a checked pha khao ma cloth around the waist and over one shoulder, dark indigo chong kraben, strong sun-tanned arms; mahatthai haircut |
| C4 บริหาร | B4.jpg | a white high-collared court jacket with small gold buttons, a dark red silk chong kraben, a gold-embroidered sash, still holding the folded palm-leaf book; mahatthai haircut |
| C5 ปุโรหิต | B5.jpg | an all-white Brahmin robe wrapped over one shoulder, white chong kraben, the sacred white cord across the chest, a short neat beard; Brahmin hair bun with a white tie |
| C6 สายลับ | B6.jpg | a dark grey-brown long-sleeved shirt, dark chong kraben, a dull cloth sash with a hidden knife, a dark cloth scarf around the neck that can cover the lower face, the brown head wrap; mahatthai haircut |

ยศสูง (C8 ทางสว่าง · C9 ทางมืด) ไว้ทำหลัง C1–C6 — ใช้วิธีเดียวกัน แนบ C แล้วสั่ง "richer, more ornate noble outfit with gold" หรือ "darker, more sinister outfit in black and deep red"

---

## ชรา ๕๕+ (ทำหลังผู้ใหญ่เสร็จ)
วิธีเดียวกัน แนบชุดผู้ใหญ่แล้วสั่งแก้:
```
Edit this sprite sheet. Make the man an elderly man about 65 years old in every frame: white hair (same hairstyle), a few wrinkles, a thin white moustache, slightly stooped shoulders, thinner arms. Keep the same clothes, poses, layout and cell positions.
Keep the exact same 8× nearest-neighbor square pixel grid, no blur, no anti-aliasing. Every figure stays fully inside its own cell with empty margin on all sides — if the taller body would not fit, draw everyone slightly smaller, the same size in all frames. Background stays solid pure green #00FF00. No text, no labels, no grid lines.
```
U1–U3 → V1–V3 · UP1–UP3 → VP1–VP3 · C1–C6 → D1–D6

---

## F1 — พญายม (ยมโลก) → `F1.jpg`
```
Pixel-art sprite sheet of Phaya Yom, the Thai king of the underworld, for a side-view game. Stern but not gory. Dark green skin, fierce eyes, curled fangs, a tall pointed golden Thai crown (chada), golden armlets and a red-and-gold Thai royal costume. Seated on a dark stone throne with flame motifs.

Layout: 2 columns × 2 rows grid, 4 equal-sized cells, facing LEFT (toward the player character), 3/4 view.
Frame 1: seated on the throne, hands on knees, staring.
Frame 2: seated, pointing forward with one finger (giving judgment).
Frame 3: seated, holding open a long folded palm-leaf book of merits and sins, reading.
Frame 4: seated, slamming a small golden staff down (verdict).
Throne and figure the same size in every frame; the figure is about 2.5 times taller than a teenage boy.

FRAMING: everything fully inside each cell with empty margin; nothing cut.

Pixel grid: low-resolution pixel art enlarged by exactly 8× with nearest-neighbor — every pixel is a perfect SQUARE block of identical size, aligned to one grid across the whole sheet. No anti-aliasing, gradients, blur or dithering noise. Flat colors, dark 1-pixel outline.

Background: solid pure green #00FF00 everywhere. No shadows, no ground, no text, no grid lines.
```

## F5 — วิญญาณตัวละคร → `F5.jpg`
```
Pixel-art sprite sheet of the SAME boy from the attached reference image as a wandering spirit in the Thai underworld: same face and proportions, now pale translucent blue-white skin, simple white cloth wrap, faint glow outline, feet fading into wisps. Mahatthai haircut.

Layout: 3 columns × 2 rows grid, 6 equal-sized cells.
Row 1: frame 1 standing, hands joined respectfully (facing left toward the judge); frames 2–3 walking carefully across a narrow rope bridge (draw only the boy, not the bridge), facing right, arms out for balance.
Row 2: frames 4–5 climbing upward (back view, reaching up with alternating arms, as if climbing a thorny tree — draw only the boy); frame 6 kneeling, head bowed.

FRAMING — VERY IMPORTANT: the entire figure is fully visible in every cell with empty margin on all sides; same size in all frames.

Pixel grid: low-resolution pixel art enlarged by exactly 8× with nearest-neighbor — every pixel is a perfect SQUARE block of identical size, aligned to one grid across the whole sheet. No anti-aliasing, gradients, blur or dithering noise. Flat colors, dark 1-pixel outline.

Background: solid pure green #00FF00 everywhere. No shadows, no ground, no text, no grid lines.
```

---

## P — สัตว์เลี้ยงเพิ่ม (แม่แบบ) · ทำแล้ว: บางแก้ว วิเชียรมาศ นกเขาชวา หลังอาน สีสวาด
แนบภาพ `P_Wichienmaat.jpg` เป็นต้นแบบท่าและขนาด
```
Pixel-art sprite sheet of a Thai Korat cat (Si Sawat): solid silver-blue grey coat with a silvery sheen, heart-shaped face, large round bright green eyes, slim muscular body. Use the attached cat sheet as the exact reference for layout, poses, size and pixel style — only change the breed.

Layout: 4 columns × 3 rows grid, 12 equal-sized cells, side view facing right.
Columns: 1 sitting · 2 walking (step A) · 3 walking (step B) · 4 happy hop with tail up (rows 1–2) / curled up asleep (row 3).
Rows: 1 kitten (small, big head) · 2 adult · 3 old (slightly thinner, greyer muzzle, sleepier eyes).

FRAMING: every cat is fully inside its cell with empty margin; paws on the same baseline in each row.

Pixel grid: low-resolution pixel art enlarged by exactly 8× with nearest-neighbor — every pixel is a perfect SQUARE block of identical size, aligned to one grid across the whole sheet. No anti-aliasing, gradients, blur or dithering noise. Flat colors, dark 1-pixel outline.

Background: solid pure green #00FF00 everywhere. No shadows, no ground, no text, no grid lines.
```
พรอมต์ข้างบนคือแมวสีสวาด (ทำแล้ว) — ตัวถัดไปใช้พรอมต์เดียวกัน เปลี่ยนบรรทัดแรก · **ขอให้เพิ่มบรรทัด `No text, no labels, no grid lines.` ด้วย** (รอบก่อน Gemini เขียนคำว่า Kitten/Step A และตีเส้นตารางมา ผมลบออกได้แต่เสี่ยงเลอะ):
- **ขาวมณี** — Khao Manee cat: pure white coat, one blue eye and one gold eye (แนบ P_Wichienmaat)
- **นกกรงหัวจุก** — red-whiskered bulbul: brown back, white belly, tall black crest, red cheek patch (แนบ P_Dove)
- **นกเอี้ยง** — common myna: dark brown body, yellow beak and eye patch, white wing patch (แนบ P_Dove)
