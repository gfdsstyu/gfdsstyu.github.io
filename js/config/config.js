// ============================================
// 감린이 v4.0 - 설정 및 상수
// ============================================

// ========================================
// AI 채점 프롬프트
// ========================================
export const BASE_SYSTEM_PROMPT =
`당신은 매우 엄격한 회계감사 과목 채점 교수님입니다.
- 사용자 답안을 모범답안과 비교해 0~100의 "score"(NUMBER)와 "feedback"(STRING, 한국어)을 JSON으로만 반환하세요.
- 채점 기준을 매우 엄격하게(strictly) 적용합니다.
- 대신 띄어쓰기나 맞춤법 실수 같은 단순한 타이핑실수는 봐줍니다. 또한 중요왜곡표시위험을 RMM으로, 성격·시기·범위를 성시범으로, 공인회계사를 CPA로 줄여쓰는 정도의 수험상 합의된 언어는 봐줍니다.

[채점 기준]
1. 모범 답안의 핵심 키워드 포함 여부
2. 핵심 키워드 대부분 누락: 50점 미만
3. 일부 포함이나 설명 부정확: 50~80점
4. 모든 핵심 키워드 + 의도 일치: 80점 이상
5. 조사까지 동일할 때만 100점
6. 키워드는 모범답안에서 스스로 추출하되, 한국 회계감사 기준·규정(ISA, KSA, 외부감사법, 윤리기준)에 맞는 동의어·표현 변형을 허용
7. 물음에서의 물음 부분이 굳이 답변에 포함되지 않아도 됨(물음의 내용이 모범답안에 재진술되어있다고해서 굳이 사용자 답안에 해당 내용이 포함되지 않아도됨)

- 불필요한 말/코드블록 금지. JSON 객체만 반환.`;

export const LITE_STRICT_ADDENDUM =
`[엄격 모드 지침(라이트 전용)]
- 모호/추정/확장 서술은 감점.
- 점수 짜게준다.
- 필수 키워드가 문장 내 명시적으로 없으면 큰 감점.
- 레퍼런스 밖 주장은 근거 없으면 감점.
- 도출한 점수보다 7점 깎아서 제시할 것`;

// ========================================
// localStorage 키
// ========================================
export const STATS_DATE_KEY = 'statsDisplayDate_v1';
export const EXAM_DATE_KEY = 'examDate_v1';
export const ACHIEVEMENTS_LS_KEY = 'achievements_v1';

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
  9: "제1-2장 데이터분석",
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

// 단원 관련 헬퍼 함수들
export const chapterLabelText = (chStr) => {
  const n = Number(chStr);
  const t = CHAPTER_LABELS[n];
  return Number.isFinite(n) ? (t ? `${n}. ${t}` : `단원 ${n}`) : String(chStr);
};

export const PART_VALUE = (s, e) => `PART:${s}-${e}`;
export const isPartValue = (v) => /^PART:\d+-\d+$/.test(v || '');
export const parsePartValue = (v) => {
  const m = String(v || '').match(/^PART:(\d+)-(\d+)$/);
  return m ? { start: +m[1], end: +m[2] } : null;
};

// ========================================
// 업적 시스템
// ========================================
export const ACHIEVEMENTS = {
  // Bronze - Basic achievements
  first_problem: { id: 'first_problem', name: '첫걸음', desc: '첫 번째 문제 풀이 및 채점 완료', icon: '🎯', tier: 'bronze', points: 10 },
  first_80: { id: 'first_80', name: '첫 80점', desc: '최초로 AI 채점 80점 이상 달성', icon: '📈', tier: 'bronze', points: 10 },
  problems_100: { id: 'problems_100', name: '성실의 증표', desc: '총 풀이 문제 100개 돌파', icon: '📚', tier: 'bronze', points: 20 },
  streak_3: { id: 'streak_3', name: '불타는 3일', desc: '3일 연속 학습', icon: '🔥', tier: 'bronze', points: 10 },
  streak_7: { id: 'streak_7', name: '일주일의 습관', desc: '7일 연속 학습', icon: '📅', tier: 'bronze', points: 20 },
  daily_20: { id: 'daily_20', name: '일일 퀘스트', desc: '하루에 20문제 이상 풀이 완료', icon: '📝', tier: 'bronze', points: 10 },
  basic_source: { id: 'basic_source', name: '기본의 왕도', desc: '기본반 출처(H, S, HS)의 모든 문제를 1회 이상 학습', icon: '📖', tier: 'bronze', points: 30 },
  advanced_source: { id: 'advanced_source', name: '심화반', desc: 'SS 또는 P 출처 문제 10개 이상 풀이', icon: '🎓', tier: 'bronze', points: 20 },
  review_master: { id: 'review_master', name: '복습의 달인', desc: '오늘의 복습 기능 10회 이상 사용', icon: '🔄', tier: 'bronze', points: 15 },
  flagged_20: { id: 'flagged_20', name: '오답노트', desc: '복습 추가(★) 플래그 20개 이상 설정', icon: '⭐', tier: 'bronze', points: 10 },

  // Silver - Intermediate achievements
  first_90: { id: 'first_90', name: '고수의 반열', desc: '최초로 90점 이상 달성', icon: '🎖️', tier: 'silver', points: 20 },
  first_100: { id: 'first_100', name: '완벽한 이해', desc: '최초로 100점 달성', icon: '💯', tier: 'silver', points: 30 },
  problems_1000: { id: 'problems_1000', name: '천리길', desc: '총 풀이 문제 1,000개 돌파', icon: '🌟', tier: 'silver', points: 100 },
  streak_30: { id: 'streak_30', name: '한 달의 끈기', desc: '30일 연속 학습', icon: '💪', tier: 'silver', points: 50 },
  streak_60: { id: 'streak_60', name: '두 달의 집념', desc: '60일 연속 학습', icon: '🏃', tier: 'silver', points: 80 },
  weekly_100: { id: 'weekly_100', name: '주간 정복자', desc: '일주일 동안 100문제 이상 풀이 완료', icon: '📊', tier: 'silver', points: 30 },
  overcome_weakness: { id: 'overcome_weakness', name: '약점 극복', desc: '60점 미만이었던 문제를 복습하여 85점 이상으로 갱신', icon: '💪', tier: 'silver', points: 25 },
  perfect_day: { id: 'perfect_day', name: '퍼펙트 데이', desc: '하루에 푼 10개 이상의 문제 모두 80점 이상 달성', icon: '✨', tier: 'silver', points: 30 },
  avg_80: { id: 'avg_80', name: '안정권 진입', desc: '전체 문제 누적 평균 점수 80점 돌파', icon: '🎯', tier: 'silver', points: 30 },
  chapter_master: { id: 'chapter_master', name: '챕터 마스터', desc: '특정 단원의 모든 문제 평균 80점 달성', icon: '👑', tier: 'silver', points: 40 },
  first_completion: { id: 'first_completion', name: '1회독 완료', desc: 'questions.json의 모든 단원을 1문제 이상 학습', icon: '📚', tier: 'silver', points: 50 },

  // Gold - Advanced achievements
  avg_90: { id: 'avg_90', name: '칭호: 예비 회계사', desc: '전체 문제 누적 평균 점수 90점 돌파', icon: '🏆', tier: 'gold', points: 100 },
  avg_95: { id: 'avg_95', name: '칭호: 기준서 프린터', desc: '전체 문제 누적 평균 점수 95점 돌파', icon: '🌟', tier: 'gold', points: 150 },
  streak_90: { id: 'streak_90', name: '세 달의 경지', desc: '90일 연속 학습', icon: '🔥', tier: 'gold', points: 120 },
  streak_120: { id: 'streak_120', name: '120일의 전문가', desc: '120일 연속 학습', icon: '👨‍🎓', tier: 'gold', points: 200 },
  monthly_300: { id: 'monthly_300', name: '월간 정복자', desc: '한 달 동안 300문제 이상 풀이 완료', icon: '📈', tier: 'gold', points: 80 },

  // Hidden - Special achievements
  comeback: { id: 'comeback', name: '칠전팔기', desc: '60점 미만으로 3회 이상 기록한 문제를 마침내 85점 이상으로 통과', icon: '🦅', tier: 'hidden', points: 50 },
  flagged_50: { id: 'flagged_50', name: '반성의 기록', desc: '복습 추가(★) 플래그가 50개 이상 활성화됨', icon: '📝', tier: 'hidden', points: 30 },
  dawn_learner: { id: 'dawn_learner', name: '새벽의 감린이', desc: '오전 5:00 ~ 7:00 사이에 10문제 이상 풀이', icon: '🌅', tier: 'hidden', points: 25 },
  night_owl: { id: 'night_owl', name: '올빼미', desc: '다크 모드 상태로 오전 1:00 ~ 4:00 사이에 10문제 이상 풀이', icon: '🦉', tier: 'hidden', points: 25 },

  // Chapter 1st Completion (Bronze - 10 points each)
  ch1_1st: { id: 'ch1_1st', name: '감사의 첫걸음', desc: '제1장(기본) 1회독 완료', icon: '📖', tier: 'bronze', points: 10 },
  ch2_1st: { id: 'ch2_1st', name: '무거운 왕관', desc: '제2장(기본) 1회독 완료 (감사인의 책임과 의무)', icon: '📖', tier: 'bronze', points: 10 },
  ch3_1st: { id: 'ch3_1st', name: '성공보수?', desc: '제3장(기본) 1회독 완료 (독립성)', icon: '📖', tier: 'bronze', points: 10 },
  ch4_1st: { id: 'ch4_1st', name: '누가 할 것인가', desc: '제4장(기본) 1회독 완료 (감사인 선임)', icon: '📖', tier: 'bronze', points: 10 },
  ch5_1st: { id: 'ch5_1st', name: '계약서에 서명', desc: '제5장(기본) 1회독 완료 (감사계약)', icon: '📖', tier: 'bronze', points: 10 },
  ch6_1st: { id: 'ch6_1st', name: '중요한 게 뭔데?', desc: '제6장(기본) 1회독 완료 (중요성, 감사위험)', icon: '📖', tier: 'bronze', points: 10 },
  ch7_1st: { id: 'ch7_1st', name: '전략 수립', desc: '제7장(기본) 1회독 완료 (감사계획, RMM)', icon: '📖', tier: 'bronze', points: 10 },
  ch8_1st: { id: 'ch8_1st', name: '통제, 너 믿어도 돼?', desc: '제8장(기본) 1회독 완료 (통제테스트)', icon: '📖', tier: 'bronze', points: 10 },
  ch10_1st: { id: 'ch10_1st', name: '실증의 첫발', desc: '제10장(기본) 1회독 완료', icon: '📖', tier: 'bronze', points: 10 },
  ch11_1st: { id: 'ch11_1st', name: '재고 세는 날', desc: '제11장(기본) 1회독 완료 (재고자산 실사)', icon: '📖', tier: 'bronze', points: 10 },
  ch12_1st: { id: 'ch12_1st', name: '까다로운 녀석들', desc: '제12장(기본) 1회독 완료 (부정, 추정치, 특수관계자)', icon: '📖', tier: 'bronze', points: 10 },
  ch13_1st: { id: 'ch13_1st', name: '몇 개만 뽑아볼까', desc: '제13장(기본) 1회독 완료 (표본감사)', icon: '📖', tier: 'bronze', points: 10 },
  ch14_1st: { id: 'ch14_1st', name: '집에 가기 전에', desc: '제14장(기본) 1회독 완료 (계속기업, 후속사건)', icon: '📖', tier: 'bronze', points: 10 },
  ch15_1st: { id: 'ch15_1st', name: '의견을 정할 시간', desc: '제15장(기본) 1회독 완료', icon: '📖', tier: 'bronze', points: 10 },
  ch16_1st: { id: 'ch16_1st', name: '보고서 쓰기', desc: '제16장(기본) 1회독 완료 (KAM, 강조사항)', icon: '📖', tier: 'bronze', points: 10 },
  ch17_1st: { id: 'ch17_1st', name: '그룹 전체 보기', desc: '제17장(기본) 1회독 완료 (그룹감사)', icon: '📖', tier: 'bronze', points: 10 },
  ch18_1st: { id: 'ch18_1st', name: '안살림 엿보기', desc: '제18장(기본) 1회독 완료 (내부회계)', icon: '📖', tier: 'bronze', points: 10 },
  ch20_1st: { id: 'ch20_1st', name: '작지만 소중해', desc: '제20장(기본) 1회독 완료 (소규모기업)', icon: '📖', tier: 'bronze', points: 10 },

  // Chapter Mastery (Silver - 20 points each)
  ch1_master: { id: 'ch1_master', name: '이 정도는 이제..', desc: '제1장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch2_master: { id: 'ch2_master', name: '성공비전전', desc: '제2장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch3_master: { id: 'ch3_master', name: '철벽의 품질관리자', desc: '제3장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch4_master: { id: 'ch4_master', name: '선임 절차 전문가', desc: '제4장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch5_master: { id: 'ch5_master', name: '감사계약 협상가', desc: '제5장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch6_master: { id: 'ch6_master', name: '감사증거의 이해자', desc: '제6장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch7_master: { id: 'ch7_master', name: 'RMM 평가자', desc: '제7장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch8_master: { id: 'ch8_master', name: 'TOC 설계자', desc: '제8장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch10_master: { id: 'ch10_master', name: '잔여기간 전문가', desc: '제10장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch11_master: { id: 'ch11_master', name: '초도감사 전문가', desc: '제11장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch12_master: { id: 'ch12_master', name: '부정감사 스페셜리스트', desc: '제12장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch13_master: { id: 'ch13_master', name: '표본설계 마스터', desc: '제13장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch14_master: { id: 'ch14_master', name: '계속기업 평가자', desc: '제14장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch15_master: { id: 'ch15_master', name: '왜곡표시 평가자', desc: '제15장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch16_master: { id: 'ch16_master', name: 'KAM 선정 전문가', desc: '제16장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch17_master: { id: 'ch17_master', name: '그룹감사 지휘자', desc: '제17장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch18_master: { id: 'ch18_master', name: '내부통제 평가자', desc: '제18장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch20_master: { id: 'ch20_master', name: '소규모 전문가', desc: '제20장 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 }
};
