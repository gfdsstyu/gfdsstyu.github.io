// ============================================
// 감린이 v4.0 - 설정 및 상수
// ============================================

// ========================================
// AI 채점 프롬프트
// ========================================
export const BASE_SYSTEM_PROMPT =
'당신은 엄격한 회계감사 과목 채점 교수님입니다.\n' +
'- 사용자 답안을 모범답안과 비교해 0~100의 "score"(NUMBER)와 "feedback"(STRING, 한국어)을 JSON으로만 반환하세요.\n' +
'- 채점 기준을 매우 엄격하게(strictly) 적용합니다.\n' +
'- 띄어쓰기/맞춤법 실수, 수험상 합의된 약어(RMM, 성시범(성격 시기 범위), 충적감증(충분하고 적합한 감사증거), CPA 등)는 봐줍니다.\n' +
'- (주), (참고), ()괄호안 설명은 채점 제외\n' +
'- 빈칸 채우기 문제: 모범답안의 빈칸(--, ㅡㅡ) 부분만 일치여부로 채점\n' +
'[채점 기준]\n' +
'1. 핵심 키워드 포함 여부\n' +
'2. 대부분 누락: 50점 미만\n' +
'3. 일부 포함/부정확: 50~80점\n' +
'4. 모든 키워드+의도 일치: 80점 이상\n' +
'5. 조사까지 동일: 100점\n' +
'6. 키워드는 모범답안에서 추출, ISA/KSA/외부감사법/윤리기준 기준 동의어·표현 변형 허용\n' +
'7. 물음 부분은 답변에 포함 불필요(모범답안이 물음+답변 구조일 때)\n\n' +
'- JSON 객체만 반환.';

export const LITE_STRICT_ADDENDUM =
'[엄격 모드 지침(라이트 전용)]\n' +
'- 모호/추정/확장 서술 감점\n' +
'- 중요한 필수 키워드 먼저 판단 후 채점\n\n';

// ========================================
// Gemma Few-Shot Examples (회계 채점 학습)
// ========================================
export const GEMMA_FEW_SHOT_EXAMPLES = `[채점 예시 1]
질문: "감사인은 경영진의 서면진술을 반드시 받아야 하는가?"
모범답안: "감사인은 경영진으로부터 서면진술을 입수하여야 한다."
사용자답안: "경영진이 바쁘면 생략할 수 있다."

분석:
1. 핵심 키워드: "서면진술", "입수하여야 한다"
2. 사용자 답안: "생략할 수 있다" (반대 의미)
3. 판단: 기준서상 '하여야 한다'는 필수 의무사항. 예외 조항 없음.

결과: {"score": 0, "feedback": "회계감사기준서상 서면진술은 필수 절차입니다. 상황에 따른 생략은 불가능합니다."}

[채점 예시 2]
질문: "실증절차의 성격, 시기, 범위를 설명하시오."
모범답안: "실증절차의 성격은 입증할 거래유형이나 계정잔액의 특성에 따라 결정되며, 시기는 감사위험과 통제위험을 고려하여 결정하고, 범위는 중요성과 위험평가에 따라 조정한다."
사용자답안: "성격, 시기, 범위는 감사위험에 따라 결정된다."

분석:
1. 핵심 키워드: "성격(거래유형/계정잔액 특성)", "시기(감사위험/통제위험)", "범위(중요성/위험평가)"
2. 사용자 답안: "감사위험에 따라" (일부만 포함, 세부사항 누락)
3. 판단: 키워드 일부 포함했으나 각 요소별 설명 부족

결과: {"score": 60, "feedback": "실증절차의 세 가지 요소는 언급했으나, 성격은 '거래유형과 계정잔액 특성', 시기는 '감사위험과 통제위험', 범위는 '중요성과 위험평가'를 각각 고려해야 합니다. 세부 내용이 누락되었습니다."}

[실제 채점 시작]`;

// ========================================
// localStorage 키
// ========================================
export const STATS_DATE_KEY = 'statsDisplayDate_v1';
export const EXAM_DATE_KEY = 'examDate_v1';
export const ACHIEVEMENTS_LS_KEY = 'achievements_v1';

// ========================================
// AI 모델 목록 (AI Tutor, 채점 등에서 사용)
// ========================================
export const AI_MODELS = [
  { value: 'gemini-2.5-flash', label: '⚡ Gemini 2.5 Flash', category: 'recommended' },
  { value: 'gemini-2.5-flash-lite', label: '💨 Gemini 2.5 Flash Lite', category: 'recommended' },
  { value: 'gemini-2.5-pro', label: '💎 Gemini 2.5 Pro', category: 'recommended' },
  { value: 'gemini-2.0-flash', label: '⚡ Gemini 2.0 Flash', category: 'stable' },
  { value: 'gemini-3-pro-preview', label: '🧪 Gemini 3 Pro Preview', category: 'experimental' },
  { value: 'gemini-3-flash-preview', label: '🧪 Gemini 3 Flash Preview', category: 'experimental' },
  { value: 'gemini-flash-latest', label: '🆕 Gemini Flash Latest', category: 'stable' },
  { value: 'gemma-3-27b-it', label: '🤖 Gemma 3 27B', category: 'experimental' },
  { value: 'gemma-3-12b-it', label: '🤖 Gemma 3 12B', category: 'experimental' },
  { value: 'gemma-3-4b-it', label: '🤖 Gemma 3 4B', category: 'experimental' },
  { value: 'gemma-3-1b-it', label: '🤖 Gemma 3 1B', category: 'experimental' }
];

// ========================================
// 단원 및 파트 정의
// ========================================
export const CHAPTER_LABELS = {
  1: "제1장 감사와 회계감사의 기본개념",
  2: "제2장 감사인의 의무, 책임 및 자격요건",
  3: "제3장 감사인의 독립성과 품질관리",
  4: "제1장 감사인의 선임",
  5: "제2장 감사계약",
  6: "제1장 회계감사수행을 위한 기초지식",
  7: "제2장 위험평가절차와 계획수립",
  8: "제1장 통제테스트와 위험평가의 확정",
  9: "제1-2장 정보시스템환경 및 외부서비스조직 이용 회사에 대한 TOC",
  10: "제2장 실증절차의 기초",
  11: "제3장 기초잔액과 거래유형별 실증절차",
  12: "제4장 특정항목별 감사절차",
  13: "제5장 테스트항목의 범위와 표본감사 데이터분석",
  14: "제6장 실증절차의 마무리절차",
  15: "제1장 미수정왜곡표시의 평가와 감사의견의 형성",
  16: "제2장 감사보고서의 작성과 보고",
  17: "제1장 인증업무개념체계와 특정목적재무보고체계, 제2장 그룹재무제표에 대한 감사",
  18: "제3장 내부회계관리제도에 대한 감사와 검토",
  19: "제4장 중간재무제표에 대한 검토",
  20: "제5장 소규모기업 재무제표에 대한 감사"
};

export const PART_INSERTIONS = [
  { before: 1, label: "Part 1. 회계감사의 기초" },
  { before: 4, label: "Part 2. 감사인의 선임과 감사계약" },
  { before: 6, label: "Part 3. 회계감사의 시작과 위험평가절차" },
  { before: 8, label: "Part 4. 위험평가절차에 대한 추가감사절차" },
  { before: 15, label: "Part 5. 감사의견의 형성과 감사보고서" },
  { before: 17, label: "Part 6. 그룹재무제표에 대한 감사와 기타인증업무" }
];

// ========================================
// Audit Flow 기반 학습 시스템 (v5.0)
// "숲을 보는 감사, 흐름을 타는 암기"
// ========================================

/**
 * AUDIT_FLOW_MAP: 20개 단원을 6단계의 감사 논리 흐름으로 재편
 * 각 FLOW는 감사 프로세스의 순차적 단계를 나타내며,
 * 학습자가 "왜 이걸 외우는지" 이해할 수 있도록 인과관계 제공
 */
export const AUDIT_FLOW_MAP = {
  1: {
    id: 1,
    name: "감사 준비",
    nameEn: "Ready",
    meaning: "[자격&계약] 누가, 무엇을, 어떻게 계약하나?",
    chapters: [1, 2, 3, 4, 5],
    strategy: "기본기",
    strategyDetail: "실무상 오류가 잦은 독립성/계약 파트. 100% 암기 목표.",
    color: "#3B82F6", // blue
    icon: "📋",
    role: "Foundation",
    connectedFlows: [2], // FLOW 2로 이어짐
    studyMode: "ox" // OX 퀴즈 모드 추천
  },
  2: {
    id: 2,
    name: "기초지식",
    nameEn: "Understand",
    meaning: "[기업 이해] 감사 대상(기업)을 알아야 시작한다",
    chapters: [6],
    strategy: "연결고리",
    strategyDetail: "KSA 315(위험평가)로 들어가는 관문.",
    color: "#10B981", // green
    icon: "🏢",
    role: "Bridge",
    connectedFlows: [3], // FLOW 3의 전제조건
    studyMode: "concept"
  },
  3: {
    id: 3,
    name: "위험평가",
    nameEn: "Assess",
    meaning: "[설계도 그리기] 어디가 얼마나 위험한가? (가장 중요)",
    chapters: [7],
    strategy: "논리적 기반",
    strategyDetail: "이곳의 결과가 FLOW 4, 5의 '원인'이 됨. 개념 완벽 이해 필수.",
    color: "#F59E0B", // amber
    icon: "⚠️",
    role: "Core Logic",
    connectedFlows: [4, 5], // FLOW 4(통제), 5(실증) 모두에 영향
    studyMode: "case" // 사례 분석 모드 추천
  },
  4: {
    id: 4,
    name: "위험대응",
    nameEn: "Strategy",
    meaning: "[관문] 회사 통제를 믿을 것인가? (전략적 분기점)",
    chapters: [8, 9],
    strategy: "대응 전략 수립",
    strategyDetail: "내부통제 신뢰도에 따라 실증절차 범위가 결정됨. 전략적 관문.",
    color: "#8B5CF6", // purple
    icon: "🛡️",
    role: "Gateway",
    connectedFlows: [5], // 통제 결과가 실증절차 범위 결정
    studyMode: "case" // 판단 훈련 모드
  },
  5: {
    id: 5,
    name: "실증절차",
    nameEn: "Execute",
    meaning: "[증거 수집] 위험과 통제에 맞춰 증거 수집!",
    chapters: [10, 11, 12, 13, 14],
    strategy: "암기량 폭발",
    strategyDetail: "Flow 3(위험)과 Flow 4(통제) 결과에 따라 성·시·범 결정. 논리 이해 필수.",
    color: "#EF4444", // red
    icon: "🔍",
    role: "Execution",
    connectedFlows: [6], // 수집한 증거로 FLOW 6에서 보고
    studyMode: "flashcard" // 빈칸 채우기 모드 추천
  },
  6: {
    id: 6,
    name: "감사완결",
    nameEn: "Report",
    meaning: "[성적표 작성] 결과를 모아 최종 의견을 낸다",
    chapters: [15, 16],
    strategy: "사례형 대비",
    strategyDetail: "의견 변형 사유(한정/부적정/거절) 칼같이 구분.",
    color: "#10B981", // green
    icon: "📊",
    role: "Conclusion",
    connectedFlows: [7], // 일반 감사 완료 후 확장으로
    studyMode: "case" // 사례 분석 모드 추천
  },
  7: {
    id: 7,
    name: "확장",
    nameEn: "Extend",
    meaning: "[특수 상황] 일반 감사 외의 변수들",
    chapters: [17, 18, 19, 20],
    strategy: "방어",
    strategyDetail: "휘발성이 강함. 비교 대조 위주로 시험 직전 집중 암기.",
    color: "#6B7280", // gray
    icon: "🌐",
    role: "Extension",
    connectedFlows: [], // 마지막 단계
    studyMode: "ox" // OX 퀴즈 모드 추천
  }
};

/**
 * FLOW_DEPENDENCIES: Flow 간 인과관계 정의 (v2.0)
 * AI가 병목 진단 시 참고하는 논리적 연결 규칙
 */
export const FLOW_DEPENDENCIES = [
  {
    source: 3,
    target: 5,
    type: "Direct",
    logic: "위험평가(Flow 3)에서 RMM이 높게 평가되면 실증절차(Flow 5)의 범위를 늘려야 합니다.",
    impactDescription: "위험을 제대로 식별하지 못하면 실증절차가 방향을 잃습니다."
  },
  {
    source: 4,
    target: 5,
    type: "Inverse",
    logic: "내부통제(Flow 4)가 효과적이면 실증절차(Flow 5)를 줄일 수 있습니다. 반대라면 늘려야 합니다.",
    impactDescription: "통제를 신뢰하지 못하면 실증절차로 2배 이상 검증해야 합니다."
  },
  {
    source: 3,
    target: 4,
    type: "Direct",
    logic: "위험평가(Flow 3) 결과에 따라 내부통제 테스트(Flow 4) 범위가 결정됩니다.",
    impactDescription: "위험이 높은 영역의 통제를 집중 테스트해야 합니다."
  },
  {
    source: 5,
    target: 6,
    type: "Direct",
    logic: "실증절차(Flow 5)에서 발견한 미수정왜곡표시와 계속기업 의문이 감사의견(Flow 6)을 결정합니다.",
    impactDescription: "Ch 14(계속기업), Ch 15(미수정왜곡)를 모르면 감사보고서를 쓸 수 없습니다."
  }
];

/**
 * 단원 번호로 FLOW 정보 조회
 * @param {number} chapterNum - 단원 번호 (1~20)
 * @returns {object|null} FLOW 정보
 */
export function getFlowByChapter(chapterNum) {
  for (const flow of Object.values(AUDIT_FLOW_MAP)) {
    if (flow.chapters.includes(chapterNum)) {
      return flow;
    }
  }
  return null;
}

/**
 * 단원별 연결된 후속 단원 조회 (논리적 흐름)
 * @param {number} chapterNum - 현재 단원 번호
 * @returns {number[]} 연결된 단원 번호 배열
 */
export function getConnectedChapters(chapterNum) {
  const currentFlow = getFlowByChapter(chapterNum);
  if (!currentFlow) return [];

  // 현재 FLOW와 연결된 다음 FLOW의 모든 단원 반환
  const connectedChapters = [];
  for (const nextFlowId of currentFlow.connectedFlows) {
    const nextFlow = AUDIT_FLOW_MAP[nextFlowId];
    if (nextFlow) {
      connectedChapters.push(...nextFlow.chapters);
    }
  }
  return connectedChapters;
}

// 단원 관련 헬퍼 함수들
export const chapterLabelText = (chStr) => {
  const n = Number(chStr);
  if (!Number.isFinite(n)) return String(chStr);
  const t = CHAPTER_LABELS[n];
  if (t) {
    return n + '. ' + t;
  }
  return '단원 ' + n;
};

export const PART_VALUE = (s, e) => 'PART:' + s + '-' + e;
export const isPartValue = (v) => /^PART:\d+-\d+$/.test(v || '');
export const parsePartValue = (v) => {
  const m = String(v || '').match(/^PART:(\d+)-(\d+)$/);
  return m ? { start: +m[1], end: +m[2] } : null;
};

// ========================================
// 업적 시스템 (Rebalanced v2.0 - Achievement & Ranking System 2.0)
// - 티어: Bronze, Silver, Gold, Platinum, Diamond, Master
// - 초점: 누적 풀이 횟수(Cumulative Solves), N회독(Rotation), 활동 점수(AP)
// ========================================
export const ACHIEVEMENTS = {
  // ============================================================
  // [BRONZE] 입문자 (10~30 AP)
  // ============================================================
  first_problem: { id: 'first_problem', name: '첫걸음', desc: '첫 번째 문제 풀이 및 채점 완료', icon: '🎯', tier: 'bronze', points: 10 },
  first_80: { id: 'first_80', name: '첫 80점', desc: '최초로 AI 채점 80점 이상 달성', icon: '📈', tier: 'bronze', points: 20 },
  streak_3: { id: 'streak_3', name: '작심삼일 돌파', desc: '3일 연속 학습 성공', icon: '🔥', tier: 'bronze', points: 30 },
  daily_20: { id: 'daily_20', name: '가벼운 몸풀기', desc: '하루 20문제 이상 풀이', icon: '🏃', tier: 'bronze', points: 20 },
  daily_50: { id: 'daily_50', name: '본격 시동', desc: '하루 50문제 이상 풀이', icon: '🚀', tier: 'bronze', points: 30 },
  problems_100: { id: 'problems_100', name: '맛보기 완료', desc: '누적 풀이 100문제 돌파', icon: '🍪', tier: 'bronze', points: 30 },
  explorer: { id: 'explorer', name: '탐험가', desc: '5개 이상의 서로 다른 단원 찍먹해보기', icon: '🗺️', tier: 'bronze', points: 20 },
  retry_same_day: { id: 'retry_same_day', name: '오늘도 힘내요', desc: '60점 미만 문제 당일 재도전', icon: '💪', tier: 'bronze', points: 20 },

  // Chapter 1st (Bronze) - first_completion 삭제로 포인트 15로 상향
  ch1_1st: { id: 'ch1_1st', name: '감사의 첫걸음', desc: '제1장(기본) 1회독 완료', icon: '📖', tier: 'bronze', points: 15 },
  ch2_1st: { id: 'ch2_1st', name: '무거운 왕관', desc: '제2장(기본) 1회독 완료 (감사인의 책임과 의무)', icon: '📖', tier: 'bronze', points: 15 },
  ch3_1st: { id: 'ch3_1st', name: '성공보수?', desc: '제3장(기본) 1회독 완료 (독립성)', icon: '📖', tier: 'bronze', points: 15 },
  ch4_1st: { id: 'ch4_1st', name: '누가 할 것인가', desc: '제4장(기본) 1회독 완료 (감사인 선임)', icon: '📖', tier: 'bronze', points: 15 },
  ch5_1st: { id: 'ch5_1st', name: '계약서에 서명', desc: '제5장(기본) 1회독 완료 (감사계약)', icon: '📖', tier: 'bronze', points: 15 },
  ch6_1st: { id: 'ch6_1st', name: '중요한 게 뭔데?', desc: '제6장(기본) 1회독 완료 (중요성, 감사위험)', icon: '📖', tier: 'bronze', points: 15 },
  ch7_1st: { id: 'ch7_1st', name: '전략 수립', desc: '제7장(기본) 1회독 완료 (감사계획, RMM)', icon: '📖', tier: 'bronze', points: 15 },
  ch8_1st: { id: 'ch8_1st', name: '통제, 너 믿어도 돼?', desc: '제8장(기본) 1회독 완료 (통제테스트)', icon: '📖', tier: 'bronze', points: 15 },
  ch10_1st: { id: 'ch10_1st', name: '실증절차의 시작', desc: '제10장(기본) 1회독 완료', icon: '📖', tier: 'bronze', points: 15 },
  ch11_1st: { id: 'ch11_1st', name: '재고 세는 날', desc: '제11장(기본) 1회독 완료 (재고자산 실사)', icon: '📖', tier: 'bronze', points: 15 },
  ch12_1st: { id: 'ch12_1st', name: '까다로운 녀석들', desc: '제12장(기본) 1회독 완료 (부정, 추정치, 특수관계자)', icon: '📖', tier: 'bronze', points: 15 },
  ch13_1st: { id: 'ch13_1st', name: '몇 개만 뽑아볼까', desc: '제13장(기본) 1회독 완료 (표본감사)', icon: '📖', tier: 'bronze', points: 15 },
  ch14_1st: { id: 'ch14_1st', name: '집에 가기 전에', desc: '제14장(기본) 1회독 완료 (계속기업, 후속사건)', icon: '📖', tier: 'bronze', points: 15 },
  ch15_1st: { id: 'ch15_1st', name: '의견을 정할 시간', desc: '제15장(기본) 1회독 완료', icon: '📖', tier: 'bronze', points: 15 },
  ch16_1st: { id: 'ch16_1st', name: '보고서 쓰기', desc: '제16장(기본) 1회독 완료 (KAM, 강조사항)', icon: '📖', tier: 'bronze', points: 15 },
  ch17_1st: { id: 'ch17_1st', name: '그룹 전체 보기', desc: '제17장(기본) 1회독 완료 (그룹감사)', icon: '📖', tier: 'bronze', points: 15 },
  ch18_1st: { id: 'ch18_1st', name: '안살림 엿보기', desc: '제18장(기본) 1회독 완료 (내부회계)', icon: '📖', tier: 'bronze', points: 15 },
  ch20_1st: { id: 'ch20_1st', name: '작지만 소중해', desc: '제20장(기본) 1회독 완료 (소규모기업)', icon: '📖', tier: 'bronze', points: 15 },

  // ============================================================
  // [SILVER] 숙련자 (50~150 AP)
  // ============================================================
  streak_7: { id: 'streak_7', name: '일주일의 기적', desc: '7일 연속 학습', icon: '📅', tier: 'silver', points: 50 },
  streak_14: { id: 'streak_14', name: '2주 완성', desc: '14일 연속 학습', icon: '🚀', tier: 'silver', points: 80 },
  daily_40: { id: 'daily_40', name: '성실한 수험생', desc: '하루 40문제 이상 풀이', icon: '📝', tier: 'silver', points: 50 },
  problems_300: { id: 'problems_300', name: '기초 다지기', desc: '누적 풀이 300문제 돌파', icon: '🧱', tier: 'silver', points: 100 },
  monthly_300: { id: 'monthly_300', name: '월간 기본', desc: '월간 300문제 돌파', icon: '📆', tier: 'silver', points: 100 },
  basic_source: { id: 'basic_source', name: '기본의 왕도', desc: '기본반 출처(H, S, HS) 모든 문제 1회 이상 학습', icon: '📚', tier: 'silver', points: 120 },
  first_90: { id: 'first_90', name: '우등생', desc: '최초로 90점 이상 달성', icon: '🎖️', tier: 'silver', points: 60 },
  weekly_100: { id: 'weekly_100', name: '주간 정복자', desc: '주간 100문제 돌파', icon: '📊', tier: 'silver', points: 70 },
  advanced_source: { id: 'advanced_source', name: '심화반 입반', desc: 'SS 또는 P 출처 문제 50개 이상 풀이', icon: '🎓', tier: 'silver', points: 60 },
  advanced_graduate: { id: 'advanced_graduate', name: '심화반 수료', desc: 'SS 또는 P 출처 문제 150개 이상 풀이 + 평균 80점 이상', icon: '🎖️', tier: 'silver', points: 120 },
  perfectionist: { id: 'perfectionist', name: '완벽주의자', desc: '한 문제를 3회 이상 풀어서 모두 90점 이상 달성', icon: '💎', tier: 'silver', points: 80 },
  weekend_warrior: { id: 'weekend_warrior', name: '주말 학습러', desc: '토요일, 일요일 모두 10문제 이상씩 푼 주말이 4회 이상', icon: '📅', tier: 'silver', points: 90 },
  rapid_growth: { id: 'rapid_growth', name: '급성장', desc: '어떤 문제를 첫 시도 70점 이하 → 두 번째 시도 95점 이상 달성', icon: '📈', tier: 'silver', points: 70 },
  flow_learner: { id: 'flow_learner', name: '흐름의 이해자', desc: '한 플로우(Flow) 내 모든 단원에서 각각 10문제 이상 풀이', icon: '🌊', tier: 'silver', points: 80 },
  review_king: { id: 'review_king', name: '복습왕', desc: '별표(★) 플래그 문제 10개 이상을 모두 85점 이상으로 재달성', icon: '👑', tier: 'silver', points: 100 },
  memory_test: { id: 'memory_test', name: '기억력 테스트', desc: '일주일 전 푼 문제를 다시 풀어 점수 향상 (30문제)', icon: '🧠', tier: 'silver', points: 80 },
  weakness_analyzer: { id: 'weakness_analyzer', name: '약점 분석가', desc: '60점 미만 문제들만 모아서 30개 재도전', icon: '🔍', tier: 'silver', points: 80 },
  consistency_basic: { id: 'consistency_basic', name: '꾸준함의 정석', desc: '한 달 동안 하루도 빠짐없이 최소 20문제씩 풀이', icon: '📆', tier: 'silver', points: 120 },
  speed_hands: { id: 'speed_hands', name: '빠른 손', desc: '30분 내 15문제 풀고 평균 80점 이상', icon: '✋', tier: 'silver', points: 90 },
  perfect_day: { id: 'perfect_day', name: '퍼펙트 데이', desc: '하루에 푼 10개 이상의 문제 모두 80점 이상 달성', icon: '✨', tier: 'silver', points: 80 },
  avg_80: { id: 'avg_80', name: '안정권 진입', desc: '전체 문제 누적 평균 점수 80점 돌파', icon: '🎯', tier: 'silver', points: 100 },
  chapter_master: { id: 'chapter_master', name: '챕터 마스터', desc: '특정 단원의 모든 문제 평균 80점 달성', icon: '👑', tier: 'silver', points: 90 },

  // Chapter Mastery (Silver - 20 points each)
  ch1_master: { id: 'ch1_master', name: '이 정도는 이제..', desc: '제1장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch2_master: { id: 'ch2_master', name: '성공비전전', desc: '제2장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch3_master: { id: 'ch3_master', name: '철벽의 품질관리자', desc: '제3장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch4_master: { id: 'ch4_master', name: '선임 절차 전문가', desc: '제4장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch5_master: { id: 'ch5_master', name: '감사계약 협상가', desc: '제5장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch6_master: { id: 'ch6_master', name: '감사증거의 이해자', desc: '제6장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch7_master: { id: 'ch7_master', name: 'RMM 평가자', desc: '제7장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch8_master: { id: 'ch8_master', name: 'TOC 설계자', desc: '제8장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch10_master: { id: 'ch10_master', name: '초도감사 전문가', desc: '제10장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch11_master: { id: 'ch11_master', name: '실증절차 마스터', desc: '제11장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch12_master: { id: 'ch12_master', name: '부정감사 스페셜리스트', desc: '제12장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch13_master: { id: 'ch13_master', name: '표본설계 마스터', desc: '제13장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch14_master: { id: 'ch14_master', name: '계속기업 평가자', desc: '제14장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch15_master: { id: 'ch15_master', name: '왜곡표시 평가자', desc: '제15장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch16_master: { id: 'ch16_master', name: 'KAM 선정 전문가', desc: '제16장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch17_master: { id: 'ch17_master', name: '그룹감사 지휘자', desc: '제17장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch18_master: { id: 'ch18_master', name: '내부통제 평가자', desc: '제18장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch20_master: { id: 'ch20_master', name: '소규모 전문가', desc: '제20장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },

  // ============================================================
  // [GOLD] 실력자 & 1회독 (200~500 AP)
  // ============================================================
  rotation_1: { id: 'rotation_1', name: '1회독 마스터', desc: '전체 문제의 95% 이상을 1회 이상 풀이함', icon: '🏁', tier: 'gold', points: 500 },
  streak_30: { id: 'streak_30', name: '한 달의 끈기', desc: '30일 연속 학습', icon: '🗓️', tier: 'gold', points: 200 },
  daily_70: { id: 'daily_70', name: '몰입의 시간', desc: '하루 70문제 이상 풀이', icon: '🔥', tier: 'gold', points: 150 },
  daily_100: { id: 'daily_100', name: '벼락치기 모드', desc: '하루에 100문제 이상 풀이 완료', icon: '⚡', tier: 'gold', points: 200 },
  problems_1000: { id: 'problems_1000', name: '천리길 정복', desc: '누적 풀이 1,000문제 돌파', icon: '🌟', tier: 'gold', points: 300 },
  avg_90: { id: 'avg_90', name: '예비 회계사', desc: '기본문제(H, S, HS) 전부 풀이 완료 + 전체 문제 누적 평균 점수 90점 돌파', icon: '🏆', tier: 'gold', points: 250 },
  first_100: { id: 'first_100', name: '완벽주의', desc: '최초 100점 달성', icon: '💯', tier: 'gold', points: 200 },
  monthly_600: { id: 'monthly_600', name: '월간 우수생', desc: '월간 600문제 돌파', icon: '📆', tier: 'gold', points: 250 },
  streak_90: { id: 'streak_90', name: '세 달의 경지', desc: '90일 연속 학습', icon: '🔥', tier: 'gold', points: 300 },
  streak_120: { id: 'streak_120', name: '120일의 전문가', desc: '120일 연속 학습', icon: '👨‍🎓', tier: 'gold', points: 400 },
  weekly_200: { id: 'weekly_200', name: '주간 고강도', desc: '일주일 동안 200문제 이상 풀이 완료', icon: '💪', tier: 'gold', points: 180 },
  weekly_300: { id: 'weekly_300', name: '주간 마라톤', desc: '일주일 동안 300문제 이상 풀이 완료', icon: '🏃‍♂️', tier: 'gold', points: 250 },
  monthly_1000: { id: 'monthly_1000', name: '천일문', desc: '한 달 동안 1,000문제 이상 풀이 완료', icon: '📚', tier: 'gold', points: 400 },
  legendary_start: { id: 'legendary_start', name: '전설의 시작', desc: '연속 10문제를 모두 첫 시도에 95점 이상 달성', icon: '🌠', tier: 'gold', points: 250 },
  consistency_master: { id: 'consistency_master', name: '일관성의 화신', desc: '10일 연속 매일 30~50문제씩 풀이', icon: '⚖️', tier: 'gold', points: 200 },
  comeback_master: { id: 'comeback_master', name: '역전의 명수', desc: '60점 미만이었던 문제 50개를 모두 85점 이상으로 갱신', icon: '🔄', tier: 'gold', points: 300 },
  memory_god: { id: 'memory_god', name: '암기의 신', desc: '3일 이상 간격으로 푼 문제 100개 모두 점수 유지 또는 향상', icon: '🧙', tier: 'gold', points: 250 },
  monthly_master: { id: 'monthly_master', name: '월간 마스터', desc: '한 달 동안 매일 평균 점수 85점 이상 유지', icon: '📊', tier: 'gold', points: 300 },
  flash_learning: { id: 'flash_learning', name: '플래시 학습', desc: '하루 100문제 풀고 평균 85점 이상 달성', icon: '⚡', tier: 'gold', points: 200 },
  all_chapter_mastery: { id: 'all_chapter_mastery', name: '올라운더', desc: '모든 단원 1회독 이상 달성 및 전 단원 평균 85점 달성', icon: '🏅', tier: 'gold', points: 400 },
  advanced_mastery: { id: 'advanced_mastery', name: '심화반 수석', desc: '모든 심화(SS, P) 출처 문제를 1회 이상 풀고 평균 85점 달성', icon: '💎', tier: 'gold', points: 350 },

  // ============================================================
  // [PLATINUM] N회독 러너 (600~1000 AP)
  // ============================================================
  rotation_3: { id: 'rotation_3', name: '3회독 달성', desc: '전체 문제 3회독 완료', icon: '🥉', tier: 'platinum', points: 800 },
  streak_60: { id: 'streak_60', name: '두 달의 집념', desc: '60일 연속 학습', icon: '🧘', tier: 'platinum', points: 600 },
  daily_120: { id: 'daily_120', name: '집중력 폭발', desc: '하루 120문제 돌파', icon: '💥', tier: 'platinum', points: 500 },
  daily_150: { id: 'daily_150', name: '감사DAY', desc: '하루 150문제 돌파', icon: '📚', tier: 'diamond', points: 1000 },
  problems_3000: { id: 'problems_3000', name: '태산이 높다하되', desc: '누적 풀이 3,000문제 돌파', icon: '🏔️', tier: 'platinum', points: 700 },
  avg_92: { id: 'avg_92', name: '예비 회계사', desc: '누적 평균 92점 돌파', icon: '🎓', tier: 'platinum', points: 600 },
  platinum_mastery: { id: 'platinum_mastery', name: '플래티넘 정복', desc: '전 단원 평균 88점 달성', icon: '💠', tier: 'platinum', points: 700 },

  // ============================================================
  // [DIAMOND] 고인물 (1500~2500 AP)
  // ============================================================
  rotation_5: { id: 'rotation_5', name: '5회독 달성', desc: '전체 문제 5회독 완료', icon: '🥈', tier: 'diamond', points: 1500 },
  streak_100: { id: 'streak_100', name: '백일의 전사', desc: '100일 연속 학습', icon: '⚔️', tier: 'diamond', points: 1500 },
  problems_5000: { id: 'problems_5000', name: '감사 기계', desc: '누적 풀이 5,000문제 돌파', icon: '🏭', tier: 'diamond', points: 1200 },
  avg_95: { id: 'avg_95', name: '칭호: 기준서 프린터', desc: '모든 문제 전부 풀이 완료 + 전체 문제 누적 평균 점수 95점 돌파', icon: '🖨️', tier: 'diamond', points: 2000 },
  diamond_perfect: { id: 'diamond_perfect', name: '다이아몬드 완성', desc: '전 단원 평균 92점 이상', icon: '💎', tier: 'diamond', points: 1800 },

  // ============================================================
  // [MASTER] 신의 경지 (3000+ AP)
  // ============================================================
  rotation_7: { id: 'rotation_7', name: '해탈의 경지', desc: '전체 문제 7회독 완료', icon: '🥇', tier: 'master', points: 3000 },
  streak_180: { id: 'streak_180', name: '구도자', desc: '180일 연속 학습', icon: '🛐', tier: 'master', points: 4000 },
  problems_10000: { id: 'problems_10000', name: '전설', desc: '누적 풀이 10,000문제 돌파', icon: '👑', tier: 'master', points: 5000 },
  perfect_collector: { id: 'perfect_collector', name: '백점 수집가', desc: '100점 100회 달성', icon: '💯', tier: 'master', points: 800 },

  // ============================================================
  // [HIDDEN] 특수 & 이벤트 (50~500 AP)
  // ============================================================
  d_day_minus_1: { id: 'd_day_minus_1', name: '정상 직전', desc: '시험 D-1일입니다. 당신의 합격을 기원합니다.', icon: '🏔️', tier: 'hidden', points: 500 },

  // Time-slot achievements (5개로 정리)
  dawn_learner: { id: 'dawn_learner', name: '새벽의 감린이', desc: '새벽 5~7시 사이 10문제 풀이', icon: '🌅', tier: 'hidden', points: 100 },
  morning_learner: { id: 'morning_learner', name: '아침 학습러', desc: '아침 7~9시 사이 20문제 풀이', icon: '☀️', tier: 'hidden', points: 60 },
  lunch_learner: { id: 'lunch_learner', name: '점심시간 활용', desc: '점심 12~13시 사이 10문제 풀이', icon: '🍱', tier: 'hidden', points: 60 },
  after_work_warrior: { id: 'after_work_warrior', name: '퇴근 후 전사', desc: '저녁 18~20시 사이 20문제 풀이', icon: '🌆', tier: 'hidden', points: 80 },
  midnight_learner: { id: 'midnight_learner', name: '심야 학습러', desc: '새벽 2~4시 사이에 연속 3일 동안 학습 기록', icon: '🌙', tier: 'hidden', points: 120 },

  lucky_777: { id: 'lucky_777', name: '잭팟', desc: '누적 풀이 문제 수 777개 달성', icon: '🎰', tier: 'hidden', points: 777 },
  weekend_warrior_hidden: { id: 'weekend_warrior_hidden', name: '주말 반납', desc: '주말 이틀 모두 30문제 이상 풀이', icon: '📅', tier: 'hidden', points: 150 },
  comeback: { id: 'comeback', name: '칠전팔기', desc: '과거 60점 미만 문제를 85점 이상으로 극복 (78회 달성)', icon: '🦅', tier: 'hidden', points: 200 },
  flagged_20: { id: 'flagged_20', name: '오답노트', desc: '복습 추가(★) 플래그 20개 이상 설정', icon: '⭐', tier: 'hidden', points: 50 },
  flagged_50: { id: 'flagged_50', name: '반성의 기록', desc: '복습 추가(★) 플래그가 50개 이상 활성화됨', icon: '📝', tier: 'hidden', points: 100 },
  perfect_straight_10: { id: 'perfect_straight_10', name: '퍼펙트 스트레이트', desc: '10개의 새로운 문제를 연속으로 100점 달성', icon: '💯', tier: 'hidden', points: 200 },
  extreme_perfectionist: { id: 'extreme_perfectionist', name: '완벽주의의 극치', desc: '하루에 20문제 이상 풀고 모두 95점 이상', icon: '💠', tier: 'hidden', points: 200 },
  full_course: { id: 'full_course', name: '풀코스', desc: '하루에 모든 단원(1~20장)을 최소 1문제씩 풀이', icon: '🎯', tier: 'hidden', points: 200 },
  persistence_master: { id: 'persistence_master', name: '끈기의 달인', desc: '한 문제를 10회 이상 재시도하여 마침내 90점 이상 달성', icon: '🔨', tier: 'hidden', points: 150 },
  score_stairs: { id: 'score_stairs', name: '점수 계단', desc: '60→70→80→90→100점을 순서대로 달성', icon: '🪜', tier: 'hidden', points: 100 },
  memory_garden: { id: 'memory_garden', name: '기억의 정원', desc: '각 단원별 최고 득점 문제가 모두 95점 이상', icon: '🌸', tier: 'hidden', points: 250 },

  // Legacy achievements (유지)
  retry_next_day: { id: 'retry_next_day', name: '재도전의 미학', desc: '하루 전 틀린 문제를 다음날 바로 복습 (누적 20회)', icon: '🔁', tier: 'hidden', points: 80 },
  flashcard_100: { id: 'flashcard_100', name: '전광석화', desc: '플래시카드 모드로 100개의 카드를 학습 (난이도 선택 100회)', icon: '⚡️', tier: 'hidden', points: 50 },
  flashcard_500: { id: 'flashcard_500', name: '삐깨삐갯피캐쮸', desc: '플래시카드 모드로 500개의 카드를 학습 (난이도 선택 500회)', icon: '⚡️', tier: 'hidden', points: 120 },
  flashcard_1000: { id: 'flashcard_1000', name: '무아지경', desc: '플래시카드 모드로 1,000개의 카드를 학습 (난이도 선택 1,000회)', icon: '✨', tier: 'hidden', points: 200 },
  new_year_dedication: { id: 'new_year_dedication', name: '새해의 각오', desc: '1월 1일 신정에 30문제 이상 풀이', icon: '🎆', tier: 'hidden', points: 150 },
  christmas_studier: { id: 'christmas_studier', name: '메리 크리스마스', desc: '12월 25일 크리스마스에 30문제 이상 풀이', icon: '🎄', tier: 'hidden', points: 150 },
  lunar_new_year: { id: 'lunar_new_year', name: '설날의 다짐', desc: '음력 설날 당일에 30문제 이상 풀이', icon: '🧧', tier: 'hidden', points: 150 },

  // ============================================================
  // [KAM] 핵심감사사항 사례 학습 (10~300 AP)
  // 총 획득 가능: 약 600점 (26개 전수 완료 시)
  // ============================================================

  // 🏁 회독 및 완주 (Rotation) - 100 AP
  kam_starter: { id: 'kam_starter', name: 'KAM 입문', desc: 'KAM 사례 1개 작성 완료 (Step 1 또는 Step 2)', icon: '📝', tier: 'bronze', points: 10 },
  kam_rotation_1: { id: 'kam_rotation_1', name: '수습 완료', desc: 'KAM 사례 26개 전수 작성 완료 (1회독)', icon: '🎓', tier: 'gold', points: 100 },

  // 💎 품질 인증 (Quality) - 450 AP
  kam_rank_incharge: { id: 'kam_rank_incharge', name: '인차지', desc: 'KAM 전수 풀이 + 2회독 + 평균 80점', icon: '📊', tier: 'silver', points: 50 },
  kam_rank_manager: { id: 'kam_rank_manager', name: '시니어', desc: 'KAM 전수 풀이 + 3회독 + 평균 90점', icon: '👔', tier: 'platinum', points: 100 },
  kam_rank_partner: { id: 'kam_rank_partner', name: '매니저', desc: 'KAM 전수 풀이 + 5회독 + 평균 95점', icon: '💼', tier: 'diamond', points: 300 },

  // 🏭 산업별 마스터 (Industry) - 100 AP (20 × 5)
  kam_expert_mfg: { id: 'kam_expert_mfg', name: '제조업 전문가', desc: '제조업 관련 KAM 전체 90점 이상', icon: '🏭', tier: 'silver', points: 20 },
  kam_expert_cons: { id: 'kam_expert_cons', name: '건설업 전문가', desc: '건설업 관련 KAM 전체 90점 이상', icon: '🏗️', tier: 'silver', points: 20 },
  kam_expert_bio: { id: 'kam_expert_bio', name: '바이오 전문가', desc: '바이오 관련 KAM 전체 90점 이상', icon: '🧬', tier: 'silver', points: 20 },
  kam_expert_fin: { id: 'kam_expert_fin', name: '금융업 전문가', desc: '금융업 관련 KAM 전체 90점 이상', icon: '🏦', tier: 'silver', points: 20 },
  kam_expert_it: { id: 'kam_expert_it', name: 'IT/플랫폼 전문가', desc: 'IT 관련 KAM 전체 90점 이상', icon: '💻', tier: 'silver', points: 20 },

  // 🦅 성장 (Feedback) - 50 AP
  kam_feedback_pro: { id: 'kam_feedback_pro', name: '환골탈태', desc: 'KAM 70점 미만 → 90점 달성 (5건)', icon: '🦅', tier: 'gold', points: 50 }
};

// ========================================
// 암기 팁 프롬프트 템플릿
// ========================================
/**
 * 암기 팁 생성을 위한 Gemini 프롬프트 생성
 * @param {string} question - 문제 텍스트
 * @param {string} answer - 정답 텍스트
 * @param {string} mode - 암기팁 스타일 ('mild' | 'stimulating')
 * @param {string} userMemo - 사용자가 작성한 메모 (선택)
 * @returns {string} - Gemini API에 전달할 프롬프트
 */
export function createMemoryTipPrompt(question, answer, mode = 'mild', userMemo = '') {
  // Mild 모드일 때 자극적 문구 제거
  const s1 = mode === 'stimulating' ? ' 선정적이거나 자극적이어도 좋음.' : '';
  const s2 = mode === 'stimulating' ? ' 경선식 스타일처럼 익살스럽고 선정적이거나 자극적이어도 좋음.' : ' 익살스럽고 재미있으면 좋음.';

  // API 타임아웃 방지: 문제/정답을 각 500자로 제한 (토큰 절약)
  const questionTruncated = (question || '').slice(0, 500) + ((question || '').length > 500 ? ' …' : '');
  const answerTruncated = (answer || '').slice(0, 500) + ((answer || '').length > 500 ? ' …' : '');

  // 사용자 메모가 있을 경우 추가 컨텍스트 생성
  let memoContext = '';
  if (userMemo && userMemo.trim().length > 0) {
    memoContext = '\n\n[학습자의 메모 키워드]\n"' + userMemo + '"\n\n[추가 지침]\n- 학습자가 이미 위 키워드를 암기 단서로 사용 중입니다.\n- 이 키워드를 **중심으로** 암기팁을 구성해주세요.\n- 키워드가 정답과 잘 맞으면 이를 활용하여 더 완벽한 암기팁을 만들어주세요.\n- 키워드가 정답과 맞지 않거나 부족하면, 올바른 연결고리를 **추가**로 제안해주세요.\n';
  }

  return '[역할]\n' +
    '당신은 회계감사 2차 시험을 준비하는 학생의 암기 코치입니다.\n' +
    '아래 문제와 정답을 보고, 학생이 쉽게 기억할 수 있도록 **유연한 암기 팁**을 제공하세요.\n\n' +
    '[암기 기법 옵션 - 자유롭게 선택]\n' +
    '1. **두문자 암기법**: 핵심 단어(모범답안 단어 자체(동의어 등으로)를 바꿔서는 안됩니다)의 첫 글자를 조합. 익살스러워서 기억에 남으면 좋음.' + s1 + ' (예: "감사증거의 충분성과 적합성" → "충·적")\n' +
    '2. **시각적 연상**: 개념을 이미지나 장면으로 비유.. (예: "내부통제는 회사의 면역 체계")\n' +
    '3. **실무 예시**: 실제 업무 상황으로 설명 (예: "재고조사는 창고에서 직접 세는 것")\n' +
    '4. **비교 대조**: 유사 개념과 차이점 강조 (예: "직접확인 vs 간접확인")\n' +
    '5. **어원/유래**: 용어의 어원이나 영어 원문 활용 (예: "materiality = 중요성")\n' +
    '6. **스토리텔링**: 개념을 짧은 이야기로 연결.' + s2 + '\n' +
    '7. **기타 창의적 방법**: 위 기법에 국한되지 않고, 해당 내용에 가장 잘 맞는 방법 자유 선택\n\n' +
    '[중요 원칙]\n' +
    '- **유연성**: 위 기법 중 1-2개만 선택하거나, 여러 개를 혼합해도 좋습니다. 하지만 1. 두문자를 제시하는 것이 다수의 학생들이 사용하는 방식이니 먼저 고려해주세요.\n' +
    '- **간결성**: 2-5줄 이내로 핵심만 전달\n' +
    '- **실용성**: 실제 시험장에서 떠올리기 쉬운 팁 제공\n' +
    '- **완전성**: 개념의 핵심을 왜곡하지 말고 모든 항목을 포함할것. 예를들어 번호 1~4까지 있다면 4항목을 모두 포함하시오.\n\n' +
    '[문제]\n' +
    questionTruncated + '\n\n' +
    '[정답]\n' +
    answerTruncated + memoContext + '\n\n' +
    '[요청]\n' +
    '위 정답을 외우기 쉽게 만드는 암기 팁을 2-4줄로 제공하세요.\n' +
    '가장 효과적인 기법을 자유롭게 선택하고, 간결하게 작성하세요.';
}
