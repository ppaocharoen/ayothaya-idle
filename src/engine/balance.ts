// ค่าสมดุลทั้งหมดของเกมอยู่ที่นี่ที่เดียว — แก้ตัวเลขแล้วรัน `npm run sim` เพื่อดูว่ายังผ่านเป้าหมายไหม
// หลักการ: เกณฑ์ทุกอย่างคิดเป็นสัดส่วนของเพดานสเตตัส (cap) ของชาตินั้น ไม่ใช่เลขตายตัว

export const BALANCE = {
  // ---- เวลา ----
  /** วินาทีจริงต่อ 1 วันในเกม (7 ชาติ ≈ 30 วันจริงถ้าเวลาไม่หยุด) */
  secondsPerGameDay: 16.8,
  daysPerYear: 365,
  startAge: 9,
  careerMinAge: 12,

  // ---- เพดานสเตตัส ----
  capBase: 100,
  capPerLife: 15, // ชาติละ +15 สม่ำเสมอ (v0.19 กระโดด 90→190 ตอนชาติ 2)
  /** สัดส่วนสเตตัสที่ติดตัวไปชาติหน้า (คิดเทียบเพดาน) */
  carryStatFraction: 0.3,

  // ---- การเติบโตของสเตตัส (เข้าหาเพดานแบบชะลอตัว: dv = k·share·eff·(cap − v)) ----
  trainRate: 1.2e-4,      // ต่อวัน ต่อสัดส่วนเวลาที่ฝึก
  workPrimaryRate: 2.0e-5, // สเตตัสหลักของอาชีพโตจากการทำงาน
  workSecondaryRate: 1.3e-5, // สเตตัสรองโตจากการทำงาน (ทุกอาชีพเท่ากัน)
  /** ตัวคูณสเตตัสหลักจากการทำงานรายอาชีพ (ทหารเสียเวลากับศึกบ่อย ชดเชย · เกษตรกรเลื่อนยศเร็วเกิน ลดลงนิด) */
  careerWorkMul: { 'ทหาร': 1.18, 'เกษตรกร': 0.92 } as Record<string, number>,
  childJobRate: 8.0e-5,
  /** ตัวคูณพรสวรรค์จากอาชีพเดิมที่เคยทำ: 1 + x·เลเวลสูงสุดที่เคยถึง (สายเดียวกัน) */
  lineagePerLevel: 0.03,
  /** + x ต่อจำนวนชาติที่เคยทำอาชีพนี้ (ทำให้ชาติหลังๆ ยังเก่งขึ้นเรื่อยๆ ไม่ตัน) */
  lineagePerLife: 0.10,
  careerItemEffPerLevel: 0.08,
  accommodationTrainPerLevel: 0.06,
  retainerIncomePerLevel: 0.08, // (เลิกใช้แล้ว เก็บไว้ให้เซฟเก่า)
  /** ทีมบริวาร: ซื้อได้ไม่จำกัดต่อประเภท ราคาคนถัดไป ×retainerPriceGrowth · ผลต่อคนลดหลั่น n/(1+n/retainerSoft)
   *  income = รายได้ต่อคน · help = โอกาสช่วยเคลียร์ราชกิจต่อวันต่อคน · share = ได้ผลกี่ส่วน
   *  joy = ความสำราญลดช้าลง · lawyer = ลดโอกาสถูกจับสินบน · guard = เพิ่มโอกาสผ่านเหตุการณ์เช็คสเตตัส */
  retainerTypes: [
    { income: 0.03, help: 0, share: 0, joy: 0, lawyer: 0, guard: 0 },        // ไพร่ส่วย
    { income: 0.01, help: 0.004, share: 0.4, joy: 0.05, lawyer: 0, guard: 0 }, // ทาสในเรือนเบี้ย
    { income: 0.02, help: 0.01, share: 0.45, joy: 0, lawyer: 0, guard: 0 },   // ไพร่สม
    { income: 0.01, help: 0.006, share: 0.7, joy: 0, lawyer: 0.15, guard: 0 }, // ทนายหน้าหอ
    { income: 0.02, help: 0, share: 0, joy: 0, lawyer: 0, guard: 0.02 },      // ไพร่หลวงทแกล้วทหาร
    { income: 0.04, help: 0.006, share: 0.6, joy: 0, lawyer: 0, guard: 0.03 }, // กองอาสาต่างชาติ
  ],
  retainerSoft: 5, retainerPriceGrowth: 1.15, retainerHelpMax: 0.5, retainerJoyMax: 0.4, retainerLawyerMax: 0.6, retainerGuardMax: 0.15,

  // ---- แนวทางชีวิต: สัดส่วนเวลา ทำงาน/ฝึก/ทำบุญ ----
  paths: {
    work:    { label: 'ขยันทำงาน', work: 0.65, train: 0.25, merit: 0.10 },
    study:   { label: 'ใฝ่ศึกษา', work: 0.30, train: 0.60, merit: 0.10 },
    merit:   { label: 'ทำบุญ',    work: 0.30, train: 0.20, merit: 0.50 },
    balance: { label: 'สมดุล',    work: 0.45, train: 0.35, merit: 0.20 },
  },

  // ---- อาชีพ ----
  maxLevel: 19,
  /** เกณฑ์สเตตัส (ผสมหลัก/รอง) เป็นสัดส่วนของเพดาน: a + b·(lv/19)^p */
  gateA: 0.06, gateB: 0.795, gateP: 1.15,
  secondaryWeightMax: 0.35,
  /** โอกาสผ่านเมื่อถึงเกณฑ์: base + slope·(ส่วนเกิน/เพดาน) */
  promoteBaseChance: 0.55, promoteSlope: 3.0, promoteMaxChance: 0.95,
  promoteCooldownDays: 30,
  promoteCostBase: 0.08, promoteCostGrowth: 1.32,
  /** ความชอบที่ต้องมี: A·lv^P (เป็นเกณฑ์ ไม่ถูกหัก กลับเป็น 0 เมื่อตาย) */
  affectionReqA: 0.45, affectionReqP: 1.55,
  lightDarkLevel: 2,

  // ---- เงิน ----
  wageBase: 0.003,   // บาท/วัน ที่เลเวล 0 ทำงานเต็มเวลา
  wageGrowth: 1.20,  // ต่อเลเวล
  childWage: 0.0012,
  /** โภคทรัพย์เพิ่มรายได้: ×(1 + x·v/cap) */
  poksapIncome: 0.5,
  /** ไหวพริบลดราคา: สูงสุด x·v/cap */
  witDiscount: 0.25,

  // ---- บุญ (ทุกทางผ่าน softcap เดียวกัน: ได้จริง = ดิบ / (1 + บุญสะสม/Msoft)) ----
  meritDaily: 0.35,          // ดิบ/วัน ที่ทำบุญเต็มเวลา
  meritPassive: 0.04,        // ดิบ/วัน ไม่ว่าแนวทางไหน
  meritBaramiBonus: 1.0,     // ×(1 + x·บารมี/cap)
  meritSoftcap: 2500,
  donationPriceGrowth: 1.12, // ราคาของทำบุญขึ้นทุกครั้งที่ซื้อ (รีเซ็ตทุกชาติ)
  reincarnateMerit: 8500,

  // ---- ความชอบ ----
  affectionWork: 0.0018,     // ต่อวัน ต่อสัดส่วนทำงาน
  affectionPerLevel: 0.12,   // ×(1 + x·เลเวล)
  affectionHistSuccess: 0.6,
  affectionPerBarami: 0.15,  // choice ที่ให้บารมี +1 → ความชอบ +x

  // ---- เหตุการณ์ ----
  /** ผลของ choice (+1..+3): แต่ละแต้มขยับ x ของระยะที่เหลือถึงเพดาน */
  eventK: 0.0012,
  /** ตัวเลือกเสี่ยงดวงแรงกว่าตัวเลือกปกติกี่เท่า */
  riskyMult: 4,
  genericMinDays: 30, genericMaxDays: 60,
  genericStartAge: 18,
  /** วัยรุ่น 12–17 ได้กงกรรมสันทนาการ/สุขภาพ ห่างกว่าผู้ใหญ่ */
  teenGenericFromAge: 12, teenGenericMinDays: 70, teenGenericMaxDays: 130,
  /** ความสำราญ/สุขภาพต่ำกว่านี้ → โอกาสสุ่มได้กงกรรมหมวดนั้นก่อน */
  needJoyBelow: 0.45, needHealthBelow: 0.5, needChance: 0.4, needHealthChance: 0,
  /** ไม่สุ่มกงกรรมทั่วไปถ้ามีกงกรรมประจำชาติจะเกิดภายในกี่วัน */
  genericGapToFixed: 20,
  // ---- ราชกิจค้าง (มินิเกมงาน) ----
  /** อาชีพ/งานเด็กที่มีมินิเกมแล้ว (เปิดระบบงานค้างเฉพาะที่เล่นได้) */
  taskReady: ['บริหาร', 'หาของป่า', 'งานวัด', 'คาราวาน'] as string[],
  taskMinDays: 20, taskMaxDays: 30, taskCap: 6,
  /** กองเต็มนานเกินกี่วัน นายเริ่มไม่พอใจ → ความชอบจากการทำงานลดลง */
  taskAngryAfter: 20, taskAngryMult: 0.85,
  /** บริวารช่วยเคลียร์งาน: โอกาสต่อวันต่อระดับบริวาร · ได้ผลกี่ส่วน */
  taskRetainerDaily: 0.007, taskRetainerShareBase: 0.3, taskRetainerSharePer: 0.05,
  /** ผลเต็มเมื่อทำได้ดีเยี่ยม: เงิน = วันของรายได้ · ความชอบ = สัดส่วนของที่ต้องใช้เลื่อนขั้น · สเตตัสหลัก */
  taskMoneyDays: 3, taskAff: 0.08, taskStat: 0.3, taskChildStat: 0.5,
  /** ทางสว่าง: ทำได้ยอดเยี่ยม (≥0.9) ความชอบ ×x และได้บุญ · ทางมืด: ความชอบ ×y แต่รับสินบนได้ */
  taskLightAff: 1.25, taskLightMerit: 30, taskDarkAff: 0.8,
  /** สินบน 1 ครั้ง: เงิน (วันของรายได้) · บาป · รับเกินกี่ครั้งเริ่มเสี่ยงถูกจับ · โอกาสต่อครั้งที่เกิน · ถูกจับเสียความชอบ (สัดส่วนของขั้น) */
  taskBribeMoneyDays: 2, taskBribeSin: 0.5, taskBribeSafe: 2, taskBribeCatch: 0.15, taskCaughtAff: 0.3,
  // ---- กงการ (อีเวนต์งาน) ----
  /** ห่างกันกี่วัน: ผู้ใหญ่ ~6–8 ครั้ง/ปี · ลูกมือ (ต่ำกว่า 18) ห่างกว่า */
  workMinDays: 45, workMaxDays: 62, workTeenMinDays: 100, workTeenMaxDays: 160,
  /** ระดับยศเริ่มของแต่ละชั้น (ผู้น้อย · กลาง · สูง · ยอด) */
  workTierFrom: [0, 6, 12, 17],
  /** "ความชอบ+1" ในกงการ = สัดส่วนของความชอบที่ต้องใช้เลื่อนยศขั้นถัดไป */
  workAffUnit: 0.05,
  /** งานหนักเสียสุขภาพน้อยกว่ากงกรรมทั่วไป (เกิดบ่อยกว่า) */
  workHealthMult: 0.3,
  /** สเตตัสจากกงการได้น้อยกว่ากงกรรม (เกิดบ่อยกว่า) */
  workStatMult: 0.15,
  /** โอกาสเสี่ยงดวงในกงการ ขยับตามสเตตัสหลักของอาชีพ: ±x เมื่อสเตตัสห่างจากครึ่งเพดาน 0.5 */
  workRiskStat: 0.5, workRiskMin: 0.1, workRiskMax: 0.9,
  /** อยู่ทางมืด: ตัวเลือกที่มีบาปได้ผลดีขึ้น */
  workDarkMult: 1.3,
  waveMinDays: 365, waveMaxDays: 730,
  checkBase: 0.30, checkSlope: 0.65, checkMax: 0.95,
  checkFailLoss: 0.05,       // เสียเงิน/ทรัพย์สิน 5% เมื่อเช็คล้มเหลว
  offlineQueueMax: 12,
  /** ตอนปิดแอป เวลาเดินช้ากว่าตอนเปิด (สัดส่วนของความเร็วปกติ) และเดินได้ไม่เกินกี่วันต่อการปิด 1 ครั้ง */
  offlineSpeed: 0.1, offlineMaxDays: 730,

  // ---- เอนดิ้ง ----
  fleeFrac: 0.6,             // หลบหลีกสูงสุด ≥ 60% ของเพดานชาตินั้น
  defendTosuFrac: 0.75, defendPoksapFrac: 0.5,
  siegeBase: 0.19, siegeSlope: 0.55, siegeMaxFails: 4,

  // ---- งานบุญใหญ่ (ที่ใช้เงินช่วงท้าย) ----
  // ยศขั้นต่ำของที่ต้องได้รับพระราชทาน/ศักดินาถึงจะครอบครองได้ (ดัชนี = ชิ้นที่)
  sinDarkDaily: 0.01,                 // เดินทางมืด บาปสะสมวันละเท่านี้
  // บ้าน: ยศสูงต้องมีบ้านสมฐานะ [ยศที่จะขึ้น, จำนวนขั้นที่พำนักที่ต้องมี] (4 = เรือนไทย, 5 = ตึก, 6 = จวน)
  promoteHouseReq: [[7, 4], [11, 5], [15, 6]] as [number, number][],
  awayBase: 0.7, awayPerHouse: 0.05,  // ผลตอนปิดแอป: 70% + 5% ต่อขั้นบ้าน (ถึง 100%)
  commonPriceGrowth: 1.25,
  housePriceK: 2.5, retainerPriceK: 10,  // ราคา = K × ค่ายื่นเลื่อนยศของยศขั้นต่ำ
  // สุขภาพ (หมด = ตาย) · ลดต่อปี = base + (อายุ−35)×perYear · บ้าน/พละกำลังชะลอ
  healthBase: 0.004, healthAgeFrom: 35, healthPerYear: 0.0018,
  healthHouse: 0.06, healthStrength: 0.4,
  illnessFromAge: 40, illnessChance: 0.07, illnessMin: 0.06, illnessMax: 0.16,
  // ความสำราญ (0–1): ลดต่อปี = joyDecay × (0.4 + สัดส่วนงาน) · บ้านเพิ่ม joyHouse/ปี ต่อขั้น
  joyStart: 0.7, joyDecay: 0.1, joyHouse: 0.012, joyChildDecay: 0.35,  // เด็กลดช้า (ยังได้วิ่งเล่น)
  joyHigh: 0.7, joyLow: 0.3, joyBuff: 0.12, joyPenalty: 0.18,  // บัฟสูงสุด +12% · โทษสูงสุด −18%
  joyHealthGood: 0.9, joyHealthBad: 1.15,                   // สุขภาพเสื่อมช้า/เร็วขึ้น
  // ผลของตัวเลือก: เงิน ±1 = รายได้ 10 วัน · สุขภาพ ±1 = 2% · สำราญ ±1 = 6%
  effMoneyDays: 10, effHealth: 0.012, effHealthHeal: 0.4, effJoy: 0.05,  // รักษาได้น้อยกว่าเสียไป
  // สัตว์เลี้ยง
  petHunger: 0.04, petBondStarve: 0.004, petBondDaily: 0.0008, petBondFeed: 0.03, petBondPlay: 0.02,
  petStatRate: 1.5e-5, petPriceDays: 8, petFeedDays: 0.5, petTrainCooldown: 7, petTrainGain: 0.12,
  careerItemMinLevel: [0, 4, 8, 12, 16],
  accommodationMinLevel: [0, 1, 3, 5, 9, 13],
  retainerMinLevel: [1, 3, 6, 9, 12, 15],
  megaProjects: [
    { id: 'sala', name: 'สร้างศาลาการเปรียญ', price: 150, merit: 400, affection: 4 },
    { id: 'vihara', name: 'สร้างพระวิหาร', price: 900, merit: 1500, affection: 10 },
    { id: 'wat', name: 'สร้างวัดประจำตระกูล', price: 5000, merit: 5000, affection: 25 },
  ],
};

export type PathKey = keyof typeof BALANCE.paths;
