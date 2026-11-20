export type TabId = 'predict' | 'observe' | 'explain' | 'evaluate';

export type PredictionChoice = 'equal' | 'more' | 'less';

export interface PredictionOption {
  id: PredictionChoice;
  title: string;
  subtitle: string;
}

export const PREDICTION_OPTIONS: PredictionOption[] = [
  {
    id: 'equal',
    title: 'เท่ากับ 24.0 mL พอดี',
    subtitle: 'ปริมาตรของเหลวทั้งสองชนิดบวกกันได้ตรงตามคณิตศาสตร์ (12.0 + 12.0)',
  },
  {
    id: 'more',
    title: 'มากกว่า 24.0 mL',
    subtitle: 'อนุภาคเกิดแรงผลักกันหรือขยายตัวเมื่อผสมสารต่างชนิดกัน',
  },
  {
    id: 'less',
    title: 'น้อยกว่า 24.0 mL',
    subtitle: 'อนุภาคอาจจัดเรียงตัวใหม่หรือแทรกเข้าสู่ช่องว่างระหว่างกันได้',
  },
];

export type LabStep = 'empty' | 'water_added' | 'mixing' | 'settled';

export interface VolumeReadout {
  waterMl: number;
  secondLiquidMl: number;
  theoreticalMl: number;
  actualMl: number;
  contractionMl: number;
}

export function computeLabVolumes(
  step: LabStep,
  isControlMode: boolean,
): VolumeReadout {
  if (step === 'empty') {
    return {
      waterMl: 0,
      secondLiquidMl: 0,
      theoreticalMl: 0,
      actualMl: 0,
      contractionMl: 0,
    };
  }
  if (step === 'water_added') {
    return {
      waterMl: 12.0,
      secondLiquidMl: 0,
      theoreticalMl: 12.0,
      actualMl: 12.0,
      contractionMl: 0,
    };
  }
  if (isControlMode) {
    return {
      waterMl: 12.0,
      secondLiquidMl: 12.0,
      theoreticalMl: 24.0,
      actualMl: 24.0,
      contractionMl: 0.0,
    };
  }
  return {
    waterMl: 12.0,
    secondLiquidMl: 12.0,
    theoreticalMl: 24.0,
    actualMl: 23.1,
    contractionMl: -0.9,
  };
}

export interface QuizQuestion {
  id: string;
  number: number;
  prompt: string;
  choices: {
    id: string;
    label: string;
  }[];
  correctChoiceId: string;
  explanationCorrect: string;
  explanationIncorrect: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    number: 1,
    prompt:
      'เหตุใดเมื่อผสมน้ำ 12.0 mL กับเอทิลแอลกอฮอล์ 95% ปริมาตร 12.0 mL แล้ว ปริมาตรรวมจึงวัดได้ประมาณ 23.1 mL (หายไป 0.9 mL)?',
    choices: [
      {
        id: 'a',
        label: 'เอทิลแอลกอฮอล์ระเหยออกไปในอากาศทันที 0.9 mL ระหว่างเทลงกระบอกตวง',
      },
      {
        id: 'b',
        label:
          'โมเลกุลน้ำขนาดเล็กแทรกเข้าสู่ช่องว่างระหว่างโมเลกุลแอลกอฮอล์ และเกิดพันธะไฮโดรเจนดึงดูดให้ชิดกันมากขึ้น',
      },
      {
        id: 'c',
        label: 'น้ำทำปฏิกิริยาเคมีสลายตัวเป็นแก๊สออกซิเจนและไฮโดรเจนลอยหนีไป',
      },
      {
        id: 'd',
        label: 'มวลของสารละลายลดลงเมื่อนำของเหลวต่างชนิดมาผสมรวมกัน',
      },
    ],
    correctChoiceId: 'b',
    explanationCorrect:
      'ถูกต้อง! ปริมาตรที่หายไป 0.9 mL เกิดจากการที่โมเลกุลน้ำ (ขนาดเล็กกว่า) แทรกตัวเข้าไปในช่องว่างระหว่างโมเลกุลเอทิลแอลกอฮอล์ (ขนาดใหญ่กว่า) ร่วมกับแรงดึงดูดพันธะไฮโดรเจนระหว่างหมู่ -OH ทำให้จัดเรียงตัวชิดกันมากขึ้น โดยมวลรวมยังคงเท่าเดิม (กฎทรงมวล)',
    explanationIncorrect:
      'ยังไม่ถูกต้อง การเปลี่ยนแปลงนี้เป็นการผสมทางกายภาพ มวลรวมไม่ลดลงและไม่เกิดแก๊ส ส่วนการระเหยไม่ได้ทำให้หายไปมากถึง 0.9 mL ในทันที แต่เกิดจากโมเลกุลน้ำขนาดเล็กแทรกตัวเข้าสู่ช่องว่างระหว่างโมเลกุลแอลกอฮอล์และเกิดพันธะไฮโดรเจนดึงดูดให้ชิดกันมากขึ้น',
  },
  {
    id: 'q2',
    number: 2,
    prompt:
      'เหตุใดในการทดลองนี้จึงต้องใช้เอทิลแอลกอฮอล์ความเข้มข้น 95% และไม่ควรใช้แอลกอฮอล์ล้างแผล 70% หรือสุรา 40 ดีกรี?',
    choices: [
      {
        id: 'a',
        label: 'เพราะแอลกอฮอล์ 70% และ 40 ดีกรี มีสีเจือปน ทำให้อ่านระดับส่วนโค้งเว้าไม่ได้',
      },
      {
        id: 'b',
        label: 'เพราะแอลกอฮอล์ 70% ไม่สามารถเกิดพันธะไฮโดรเจนกับน้ำได้',
      },
      {
        id: 'c',
        label:
          'เพราะแอลกอฮอล์ 70% และ 40 ดีกรี มีน้ำผสมอยู่แล้วเป็นจำนวนมาก การแทรกตัวและหดตัวของปริมาตรได้เกิดขึ้นไปก่อนหน้านี้แล้ว',
      },
      {
        id: 'd',
        label: 'เพราะแอลกอฮอล์ที่มีความเข้มข้นต่ำกว่า 95% จะไม่ละลายในน้ำ',
      },
    ],
    correctChoiceId: 'c',
    explanationCorrect:
      'ยอดเยี่ยม! ในแอลกอฮอล์ 70% หรือสุรา 40 ดีกรี (40% v/v) มีโมเลกุลน้ำเข้าไปแทรกในช่องว่างและสร้างพันธะไฮโดรเจนกับโมเลกุลเอทิลแอลกอฮอล์ไว้แล้วล่วงหน้า เมื่อนำมาเติมน้ำเพิ่มจึงสังเกตการหดตัวของปริมาตรได้น้อยมากหรือไม่ชัดเจน',
    explanationIncorrect:
      'ลองคิดดูอีกทีนะ! แอลกอฮอล์ 70% และ 40 ดีกรี (40% v/v) ล้วนละลายน้ำได้ดีและมีน้ำผสมอยู่ก่อนแล้ว 30%–60% ดังนั้นช่องว่างระหว่างโมเลกุลแอลกอฮอล์ส่วนใหญ่จึงถูกน้ำแทรกตัวไปก่อนผสมจริงแล้ว ทำให้เห็นการหดตัวเพิ่มน้อยมาก',
  },
  {
    id: 'q3',
    number: 3,
    prompt:
      'คำถามท้าทาย: หากนำน้ำดื่ม 12.0 mL ผสมกับน้ำดื่มอีก 12.0 mL (กรณีควบคุม) ปริมาตรรวมที่อ่านได้จะเป็นเท่าใด และเพราะเหตุใด?',
    choices: [
      {
        id: 'a',
        label: 'เท่ากับ 24.0 mL พอดี เพราะโมเลกุลน้ำมีขนาดและรูปแบบการจัดเรียงตัวด้วยพันธะไฮโดรเจนเหมือนกันอยู่แล้ว',
      },
      {
        id: 'b',
        label: 'น้อยกว่า 24.0 mL เหลือ 23.1 mL เท่ากัน เพราะน้ำทุกชนิดเกิดพันธะไฮโดรเจนเพิ่มเมื่อเทรวมกัน',
      },
      {
        id: 'c',
        label: 'มากกว่า 24.0 mL เล็กน้อย เพราะจำนวนโมเลกุลน้ำเพิ่มขึ้นสองเท่าจึงผลักกันมากขึ้น',
      },
      {
        id: 'd',
        label: 'น้อยกว่า 24.0 mL เหลือประมาณ 23.5 mL เนื่องจากแรงโน้มถ่วงอัดน้ำให้แน่นขึ้น',
      },
    ],
    correctChoiceId: 'a',
    explanationCorrect:
      'ถูกต้องสมบูรณ์! เมื่อผสมน้ำกับน้ำที่เป็นสารชนิดเดียวกัน โมเลกุลทุกตัวมีขนาด รูปร่าง และโครงข่ายพันธะไฮโดรเจนเหมือนกันทุกประการ จึงไม่มีโมเลกุลขนาดต่างกันมาแทรกช่องว่างเพิ่มเติม ปริมาตรรวมจึงเท่ากับ 12.0 + 12.0 = 24.0 mL พอดี',
    explanationIncorrect:
      'ยังไม่ถูกต้อง เมื่อนำสารชนิดเดียวกัน (น้ำ + น้ำ) มาผสมกัน โมเลกุลทั้งหมดมีขนาดเท่ากันและมีเครือข่ายพันธะไฮโดรเจนแบบเดียวกันอยู่แล้ว จึงไม่เกิดการจัดเรียงตัวลดช่องว่างเพิ่มเติม ปริมาตรที่ได้จึงเท่ากับ 24.0 mL พอดี',
  },
];

export interface QuizGradeResult {
  answeredCount: number;
  totalCount: number;
  correctCount: number;
  isComplete: boolean;
}

export function gradeQuiz(
  answers: Record<string, string | undefined>,
): QuizGradeResult {
  let answeredCount = 0;
  let correctCount = 0;
  for (const q of QUIZ_QUESTIONS) {
    const selected = answers[q.id];
    if (selected !== undefined) {
      answeredCount += 1;
      if (selected === q.correctChoiceId) {
        correctCount += 1;
      }
    }
  }
  return {
    answeredCount,
    totalCount: QUIZ_QUESTIONS.length,
    correctCount,
    isComplete: answeredCount === QUIZ_QUESTIONS.length,
  };
}

export interface PoeLessonState {
  activeTab: TabId;
  tab2Unlocked: boolean;
  predictionChoice: PredictionChoice | null;
  predictionReason: string;
  labStep: LabStep;
  isControlMode: boolean;
  quizAnswers: Record<string, string>;
}

export function createInitialLessonState(): PoeLessonState {
  return {
    activeTab: 'predict',
    tab2Unlocked: false,
    predictionChoice: null,
    predictionReason: '',
    labStep: 'empty',
    isControlMode: false,
    quizAnswers: {},
  };
}

export function canAccessTab(state: PoeLessonState, tab: TabId): boolean {
  if (tab === 'predict') return true;
  return state.tab2Unlocked;
}

export function submitPrediction(
  state: PoeLessonState,
  choice: PredictionChoice | null,
  reason: string,
): { ok: boolean; error?: string; nextState: PoeLessonState } {
  if (!choice) {
    return {
      ok: false,
      error: 'กรุณาเลือกคำทำนาย 1 ข้อก่อนบันทึกและเริ่มการทดลอง',
      nextState: state,
    };
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) {
    return {
      ok: false,
      error: 'กรุณาเขียนเหตุผลประกอบสมมติฐานสั้นๆ ก่อนเริ่มการทดลอง',
      nextState: state,
    };
  }
  return {
    ok: true,
    nextState: {
      ...state,
      predictionChoice: choice,
      predictionReason: trimmedReason,
      tab2Unlocked: true,
      activeTab: 'observe',
    },
  };
}

export interface HistogramBin {
  id: 'water' | 'second' | 'theoretical' | 'actual';
  label: string;
  shortLabel: string;
  volumeMl: number;
  fill: string;
  stroke: string;
  isDashed?: boolean;
  note: string;
}

export function buildVolumeHistogramBins(
  step: LabStep,
  isControlMode: boolean,
  liveActualMl?: number,
): HistogramBin[] {
  const volumes = computeLabVolumes(step, isControlMode);
  const actualVal =
    step === 'mixing' && liveActualMl !== undefined
      ? Number(liveActualMl.toFixed(1))
      : volumes.actualMl;

  const secondTitle = isControlMode
    ? 'น้ำดื่มส่วนที่ 2'
    : 'เอทิลแอลกอฮอล์ 95%';

  const secondShort = isControlMode ? 'น้ำส่วนที่ 2' : 'แอลกอฮอล์ 95%';

  return [
    {
      id: 'water',
      label: 'น้ำดื่มก่อนผสม (ส่วนที่ 1)',
      shortLabel: 'น้ำ (ก่อนผสม)',
      volumeMl: volumes.waterMl,
      fill: '#38bdf8',
      stroke: '#7dd3fc',
      note: 'น้ำดื่มหยดสีฟ้าที่ตวงไว้ตั้งต้น 12.0 mL',
    },
    {
      id: 'second',
      label: `${secondTitle} (ก่อนผสม)`,
      shortLabel: secondShort,
      volumeMl: volumes.secondLiquidMl,
      fill: isControlMode ? '#0ea5e9' : '#fbbf24',
      stroke: isControlMode ? '#38bdf8' : '#fde68a',
      note: isControlMode
        ? 'น้ำดื่มอีก 12.0 mL สำหรับเปรียบเทียบกรณีควบคุม'
        : 'เอทิลแอลกอฮอล์ 95% ปริมาตร 12.0 mL ก่อนผสม',
    },
    {
      id: 'theoretical',
      label: 'ผลรวมตามทฤษฎี (12.0 + 12.0)',
      shortLabel: 'ทฤษฎี (รวม)',
      volumeMl: volumes.theoreticalMl,
      fill: 'rgba(148, 163, 184, 0.25)',
      stroke: '#94a3b8',
      isDashed: true,
      note: 'ปริมาตรที่คาดว่าจะได้หากไม่มีการแทรกตัวเข้าสู่ช่องว่าง',
    },
    {
      id: 'actual',
      label: 'ปริมาตรจริงที่วัดได้หลังผสม',
      shortLabel: 'ปริมาตรจริง',
      volumeMl: actualVal,
      fill:
        step === 'settled' && !isControlMode
          ? '#f59e0b'
          : '#22d3ee',
      stroke:
        step === 'settled' && !isControlMode
          ? '#fde68a'
          : '#a5f3fc',
      note:
        step === 'settled' && !isControlMode
          ? 'ปริมาตรจริงลดลงเหลือ 23.1 mL (หายไป 0.9 mL)'
          : isControlMode && step === 'settled'
            ? 'สารชนิดเดียวกันได้ 24.0 mL พอดี ไม่เกิดการหดตัว'
            : 'ปริมาตรที่อ่านได้จากระดับส่วนโค้งเว้าในกระบอกตวง',
    },
  ];
}

export function normalizeShareUrl(rawUrl: string, fallbackUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallbackUrl;
  try {
    const parsed = new URL(trimmed);
    // Strip transient ?autostart=1 param when sharing with students
    parsed.searchParams.delete('autostart');
    return parsed.toString();
  } catch {
    return fallbackUrl;
  }
}


