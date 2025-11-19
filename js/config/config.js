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
- 대신 띄어쓰기나 맞춤법 실수 같은 단순한 타이핑실수는 봐줍니다. 또한 중요왜곡표시위험을 RMM으로, 성격·시기·범위를 성시범으로,충분하고 적합한 감사증거를 충적감증으로, 공인회계사를 CPA로 줄여쓰는 정도의 수험상 합의된 언어는 봐줍니다.
- (주) 나 (참고), ()괄호안 설명 등은 설명부분이니 채점에서는 제외
- 예외적으로, 물음에서 '다음 빈칸을 채우시오' 등 빈칸을 채우는 형식의 문제는 모범답안에 풀문장으로 제시되어 있다고 해줘 사용자 답안에 빈칸부분 (주로 물음에서는 -- 나 ㅡㅡ 로 표시) 만 찾아서 해당 빈칸 일치여부로만 채점한다.
[채점 기준]
1. 모범 답안의 핵심 키워드 포함 여부
2. 핵심 키워드 대부분 누락: 50점 미만
3. 일부 포함이나 설명 부정확: 50~80점
4. 모든 핵심 키워드 + 의도 일치: 80점 이상
5. 조사까지 동일할 때만 100점
6. 키워드는 모범답안에서 스스로 추출하되, 한국 회계감사 기준·규정(ISA, KSA, 외부감사법, 윤리기준)에 맞는 동의어·표현 변형을 허용
7. 물음에서의 물음 부분이 굳이 답변에 포함되지 않아도 됨(물음의 내용이 모범답안에서 물음의 내용을 밝히고 답변을 제시하는 구조로 되어있다고해서 굳이 사용자 답안에 해당 내용이 포함되지 않아도됨)

- 불필요한 말/코드블록 금지. JSON 객체만 반환.`;

export const LITE_STRICT_ADDENDUM =
`[엄격 모드 지침(라이트 전용)]
- 모호/추정/확장 서술은 감점.
- 점수 짜게준다.
- 중요한 필수 키워드가 문장 내 명시적으로 없으면 큰 감점.
- 도출한 점수보다 5점 깎아서 제시할 것(출력문구에 언급은 X)`;

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
  advanced_source: { id: 'advanced_source', name: '심화반 입반', desc: 'SS 또는 P 출처 문제 50개 이상 풀이', icon: '🎓', tier: 'bronze', points: 20 },
  retry_same_day: { id: 'retry_same_day', name: '오늘도 힘내요', desc: '60점 미만을 받은 문제를 같은 날 다시 재도전', icon: '💪', tier: 'bronze', points: 10 },
  explorer: { id: 'explorer', name: '탐험가', desc: '5개 이상의 서로 다른 단원에서 문제를 풀어본 경우', icon: '🗺️', tier: 'bronze', points: 10 },
  morning_routine: { id: 'morning_routine', name: '아침 루틴', desc: '7일 연속 오전 중 같은 시간대(±1시간)에 학습 시작', icon: '☀️', tier: 'bronze', points: 15 },
  retry_next_day: { id: 'retry_next_day', name: '재도전의 미학', desc: '하루 전 틀린 문제를 다음날 바로 복습 (누적 20회)', icon: '🔁', tier: 'bronze', points: 15 },
  review_master: { id: 'review_master', name: '복습의 달인', desc: '오늘의 복습 기능 10회 이상 사용', icon: '🔄', tier: 'bronze', points: 15 },
  flagged_20: { id: 'flagged_20', name: '오답노트', desc: '복습 추가(★) 플래그 20개 이상 설정', icon: '⭐', tier: 'bronze', points: 10 },
  flashcard_100: { id: 'flashcard_100', name: '전광석화', desc: '플래시카드 모드로 100개의 카드를 학습 (다음/이전 100회)', icon: '⚡️', tier: 'bronze', points: 15 },

  // Silver - Intermediate achievements
  first_90: { id: 'first_90', name: '고수의 반열', desc: '최초로 90점 이상 달성', icon: '🎖️', tier: 'silver', points: 20 },
  first_100: { id: 'first_100', name: '완벽한 이해', desc: '최초로 100점 달성', icon: '💯', tier: 'silver', points: 30 },
  problems_1000: { id: 'problems_1000', name: '천리길', desc: '총 풀이 문제 1,000개 돌파', icon: '🌟', tier: 'silver', points: 100 },
  streak_30: { id: 'streak_30', name: '한 달의 끈기', desc: '30일 연속 학습', icon: '💪', tier: 'silver', points: 50 },
  streak_60: { id: 'streak_60', name: '두 달의 집념', desc: '60일 연속 학습', icon: '🏃', tier: 'silver', points: 80 },
  daily_50: { id: 'daily_50', name: '하루 50제', desc: '하루에 50문제 이상 풀이 완료', icon: '🔥', tier: 'silver', points: 20 },
  weekly_100: { id: 'weekly_100', name: '주간 정복자', desc: '일주일 동안 100문제 이상 풀이 완료', icon: '📊', tier: 'silver', points: 30 },
  monthly_300: { id: 'monthly_300', name: '월간 기본반', desc: '한 달 동안 300문제 이상 풀이 완료', icon: '📘', tier: 'silver', points: 50 },
  advanced_graduate: { id: 'advanced_graduate', name: '심화반 수료', desc: 'SS 또는 P 출처 문제 150개 이상 풀이 + 평균 80점 이상', icon: '🎖️', tier: 'silver', points: 60 },
  perfectionist: { id: 'perfectionist', name: '완벽주의자', desc: '한 문제를 3회 이상 풀어서 모두 90점 이상 달성', icon: '💎', tier: 'silver', points: 30 },
  weekend_warrior: { id: 'weekend_warrior', name: '주말 학습러', desc: '토요일, 일요일 모두 10문제 이상씩 푼 주말이 4회 이상', icon: '📅', tier: 'silver', points: 40 },
  rapid_growth: { id: 'rapid_growth', name: '급성장', desc: '어떤 문제를 첫 시도 70점 이하 → 두 번째 시도 95점 이상 달성', icon: '📈', tier: 'silver', points: 25 },
  chapter_hopping: { id: 'chapter_hopping', name: '챕터 호핑', desc: '하루에 5개 이상의 서로 다른 단원 문제를 풀이', icon: '🦘', tier: 'silver', points: 20 },
  review_king: { id: 'review_king', name: '복습왕', desc: '별표(★) 플래그 문제 10개 이상을 모두 85점 이상으로 재달성', icon: '👑', tier: 'silver', points: 50 },
  memory_test: { id: 'memory_test', name: '기억력 테스트', desc: '일주일 전 푼 문제를 다시 풀어 점수 향상 (30문제)', icon: '🧠', tier: 'silver', points: 30 },
  nonstop_learning: { id: 'nonstop_learning', name: '논스톱 학습', desc: '30분 내 20문제 이상 풀이', icon: '⏱️', tier: 'silver', points: 25 },
  weakness_analyzer: { id: 'weakness_analyzer', name: '약점 분석가', desc: '60점 미만 문제들만 모아서 30개 재도전', icon: '🔍', tier: 'silver', points: 30 },
  consistency_basic: { id: 'consistency_basic', name: '꾸준함의 정석', desc: '한 달 동안 하루도 빠짐없이 최소 5문제씩 풀이', icon: '📆', tier: 'silver', points: 50 },
  speed_hands: { id: 'speed_hands', name: '빠른 손', desc: '30분 내 15문제 풀고 평균 80점 이상', icon: '✋', tier: 'silver', points: 35 },
  overcome_weakness: { id: 'overcome_weakness', name: '약점 극복', desc: '60점 미만이었던 문제를 복습하여 85점 이상으로 갱신', icon: '💪', tier: 'silver', points: 25 },
  perfect_day: { id: 'perfect_day', name: '퍼펙트 데이', desc: '하루에 푼 10개 이상의 문제 모두 80점 이상 달성', icon: '✨', tier: 'silver', points: 30 },
  avg_80: { id: 'avg_80', name: '안정권 진입', desc: '전체 문제 누적 평균 점수 80점 돌파', icon: '🎯', tier: 'silver', points: 30 },
  chapter_master: { id: 'chapter_master', name: '챕터 마스터', desc: '특정 단원의 모든 문제 평균 80점 달성', icon: '👑', tier: 'silver', points: 40 },
  first_completion: { id: 'first_completion', name: '1회독 완료', desc: 'questions.json의 모든 단원을 1문제 이상 학습', icon: '📚', tier: 'silver', points: 50 },
  flashcard_500: { id: 'flashcard_500', name: '삐깨삐갯피캐쮸', desc: '플래시카드 모드로 500개의 카드를 학습 (다음/이전 500회)', icon: '🚀', tier: 'silver', points: 30 },
  stt_50: { id: 'stt_50', name: '말터디 에이스', desc: '음성 입력(STT) 기능으로 50개의 답안을 성공적으로 제출', icon: '🗣️', tier: 'silver', points: 25 },

  // Gold - Advanced achievements
  avg_90: { id: 'avg_90', name: '칭호: 예비 회계사', desc: '기본문제(H, S, HS) 전부 풀이 완료 + 전체 문제 누적 평균 점수 90점 돌파', icon: '🏆', tier: 'gold', points: 100 },
  avg_95: { id: 'avg_95', name: '칭호: 기준서 프린터', desc: '모든 문제 전부 풀이 완료 + 전체 문제 누적 평균 점수 95점 돌파', icon: '🌟', tier: 'gold', points: 150 },
  streak_90: { id: 'streak_90', name: '세 달의 경지', desc: '90일 연속 학습', icon: '🔥', tier: 'gold', points: 120 },
  streak_120: { id: 'streak_120', name: '120일의 전문가', desc: '120일 연속 학습', icon: '👨‍🎓', tier: 'gold', points: 200 },
  streak_180: { id: 'streak_180', name: '구도자', desc: '학습 시작일부터 시험 D-1일까지 연속 학습 달성', icon: '🧘‍♂️', tier: 'gold', points: 300 },
  daily_100: { id: 'daily_100', name: '벼락치기 마스터', desc: '하루에 100문제 이상 풀이 완료', icon: '⚡', tier: 'gold', points: 50 },
  weekly_200: { id: 'weekly_200', name: '주간 고강도', desc: '일주일 동안 200문제 이상 풀이 완료', icon: '💪', tier: 'gold', points: 60 },
  weekly_300: { id: 'weekly_300', name: '주간 마라톤', desc: '일주일 동안 300문제 이상 풀이 완료', icon: '🏃‍♂️', tier: 'gold', points: 100 },
  monthly_600: { id: 'monthly_600', name: '월간 600제', desc: '한 달 동안 600문제 이상 풀이 완료', icon: '📈', tier: 'gold', points: 120 },
  monthly_1000: { id: 'monthly_1000', name: '천일문', desc: '한 달 동안 1,000문제 이상 풀이 완료', icon: '📚', tier: 'gold', points: 200 },
  legendary_start: { id: 'legendary_start', name: '전설의 시작', desc: '연속 10문제를 모두 첫 시도에 95점 이상 달성', icon: '🌠', tier: 'gold', points: 100 },
  consistency_master: { id: 'consistency_master', name: '일관성의 화신', desc: '10일 연속 매일 정확히 30~50문제씩 풀이', icon: '⚖️', tier: 'gold', points: 80 },
  comeback_master: { id: 'comeback_master', name: '역전의 명수', desc: '60점 미만이었던 문제 50개를 모두 85점 이상으로 갱신', icon: '🔄', tier: 'gold', points: 120 },
  memory_god: { id: 'memory_god', name: '암기의 신', desc: '3일 이상 간격으로 푼 문제 100개 모두 점수 유지 또는 향상', icon: '🧙', tier: 'gold', points: 100 },
  monthly_master: { id: 'monthly_master', name: '월간 마스터', desc: '한 달 동안 매일 평균 점수 85점 이상 유지', icon: '📊', tier: 'gold', points: 120 },
  retention_99: { id: 'retention_99', name: '기억 유지율 99%', desc: '2주 전 90점 이상 문제 50개 재풀이시 모두 85점 이상', icon: '💾', tier: 'gold', points: 100 },
  flash_learning: { id: 'flash_learning', name: '플래시 학습', desc: '하루 100문제 풀고 평균 85점 이상 달성', icon: '⚡', tier: 'gold', points: 80 },
  long_term_memory: { id: 'long_term_memory', name: '장기 기억', desc: '한 달 전 푼 문제 30개 모두 기억하여 85점 이상', icon: '🗓️', tier: 'gold', points: 90 },
  problems_5000: { id: 'problems_5000', name: '태산', desc: '총 풀이 문제 5,000개 돌파 (누적)', icon: '⛰️', tier: 'gold', points: 200 },
  all_chapter_mastery: { id: 'all_chapter_mastery', name: '올라운더', desc: '모든 단원 1회독 이상 달성 및 전 단원 평균 85점 달성', icon: '🏅', tier: 'gold', points: 200 },
  advanced_mastery: { id: 'advanced_mastery', name: '심화반 수석', desc: '모든 심화(SS, P) 출처 문제를 1회 이상 풀고 평균 85점 달성', icon: '💎', tier: 'gold', points: 150 },
  flashcard_1000: { id: 'flashcard_1000', name: '무아지경', desc: '플래시카드 모드로 1,000개의 카드를 학습 (다음/이전 1,000회)', icon: '✨', tier: 'gold', points: 50 },

  // Hidden - Special achievements
  comeback: { id: 'comeback', name: '칠전팔기', desc: '60점 미만으로 3회 이상 기록한 문제를 마침내 85점 이상으로 통과', icon: '🦅', tier: 'hidden', points: 50 },
  flagged_50: { id: 'flagged_50', name: '반성의 기록', desc: '복습 추가(★) 플래그가 50개 이상 활성화됨', icon: '📝', tier: 'hidden', points: 30 },
  dawn_learner: { id: 'dawn_learner', name: '새벽의 감린이', desc: '오전 5:00 ~ 7:00 사이에 10문제 이상 풀이', icon: '🌅', tier: 'hidden', points: 25 },
  night_owl: { id: 'night_owl', name: '올빼미', desc: '다크 모드 상태로 오전 1:00 ~ 4:00 사이에 10문제 이상 풀이', icon: '🦉', tier: 'hidden', points: 25 },
  d_day_minus_1: { id: 'd_day_minus_1', name: '정상 직전', desc: '시험 D-1입니다. 여기까지 온 당신의 여정을 감린이가 응원합니다. 마지막까지 힘내세요!', icon: '🏔️', tier: 'hidden', points: 50 },
  perfect_straight_10: { id: 'perfect_straight_10', name: '퍼펙트 스트레이트', desc: '10개의 새로운 문제를 연속으로 100점 달성', icon: '💯', tier: 'hidden', points: 100 },
  data_backup_1: { id: 'data_backup_1', name: '보험 가입', desc: "'데이터 내보내기' 기능으로 첫 학습 데이터 백업", icon: '🛡️', tier: 'hidden', points: 10 },
  lucky_777: { id: 'lucky_777', name: '행운의 숫자', desc: '누적 문제 풀이 개수가 정확히 777개 달성', icon: '🎰', tier: 'hidden', points: 77 },
  extreme_perfectionist: { id: 'extreme_perfectionist', name: '완벽주의의 극치', desc: '하루에 20문제 이상 풀고 모두 95점 이상', icon: '💠', tier: 'hidden', points: 100 },
  time_traveler: { id: 'time_traveler', name: '시간여행자', desc: '자정(00:00~00:59) 사이에 10문제 이상 풀이', icon: '🕐', tier: 'hidden', points: 30 },
  full_course: { id: 'full_course', name: '풀코스', desc: '하루에 모든 단원(1~20장)을 최소 1문제씩 풀이', icon: '🎯', tier: 'hidden', points: 80 },
  perfect_collector: { id: 'perfect_collector', name: '백점 컬렉터', desc: '100점을 50번 이상 달성', icon: '💯', tier: 'hidden', points: 100 },
  persistence_master: { id: 'persistence_master', name: '끈기의 달인', desc: '한 문제를 5회 이상 재시도하여 마침내 90점 이상 달성', icon: '🔨', tier: 'hidden', points: 60 },
  midnight_learner: { id: 'midnight_learner', name: '심야 학습러', desc: '새벽 2~4시 사이에 연속 3일 동안 학습 기록', icon: '🌙', tier: 'hidden', points: 50 },
  rush_hour_avoider: { id: 'rush_hour_avoider', name: '러시아워 회피', desc: '오전 9~11시, 오후 6~8시를 제외한 시간에만 100문제 이상 풀이', icon: '🚇', tier: 'hidden', points: 40 },
  photographic_memory: { id: 'photographic_memory', name: '포토그래픽 메모리', desc: '연속 50문제를 모두 첫 시도에 90점 이상 달성', icon: '📸', tier: 'hidden', points: 150 },
  score_stairs: { id: 'score_stairs', name: '점수 계단', desc: '60→70→80→90→100점을 순서대로 달성', icon: '🪜', tier: 'hidden', points: 50 },
  deja_vu: { id: 'deja_vu', name: '데자뷰', desc: '같은 문제를 정확히 7일 간격으로 3번 풀기', icon: '👁️', tier: 'hidden', points: 40 },
  mirroring: { id: 'mirroring', name: '미러링', desc: '어제와 정확히 같은 개수, 같은 평균 점수 달성', icon: '🪞', tier: 'hidden', points: 30 },
  memory_garden: { id: 'memory_garden', name: '기억의 정원', desc: '각 단원별 최고 득점 문제가 모두 95점 이상', icon: '🌸', tier: 'hidden', points: 120 },
  pattern_breaker: { id: 'pattern_breaker', name: '패턴 브레이커', desc: '매일 다른 시간대에 7일 연속 학습 (시간대: 0~6, 6~12, 12~18, 18~24)', icon: '🔀', tier: 'hidden', points: 50 },
  monday_conqueror: { id: 'monday_conqueror', name: '월요병 극복', desc: '월요일에 30문제 이상 풀이', icon: '📅', tier: 'hidden', points: 30 },
  friday_learner: { id: 'friday_learner', name: '불금 학습러', desc: '금요일 저녁(18~24시)에 30문제 이상 풀이', icon: '🍻', tier: 'hidden', points: 30 },
  sunday_miracle: { id: 'sunday_miracle', name: '일요일의 기적', desc: '일요일에 50문제 이상 풀이', icon: '⛪', tier: 'hidden', points: 40 },
  lunch_learner: { id: 'lunch_learner', name: '점심시간 학습', desc: '12~13시 사이에 누적 100문제 풀이', icon: '🍱', tier: 'hidden', points: 30 },
  after_work_warrior: { id: 'after_work_warrior', name: '퇴근후 전사', desc: '18~20시 사이에 누적 200문제 풀이', icon: '💼', tier: 'hidden', points: 50 },
  morning_warmup: { id: 'morning_warmup', name: '출근전 워밍업', desc: '7~9시 사이에 누적 100문제 풀이', icon: '🌄', tier: 'hidden', points: 30 },
  new_year_dedication: { id: 'new_year_dedication', name: '신정의 각오', desc: '1월 1일 신정에 30문제 이상 풀이', icon: '🎆', tier: 'hidden', points: 50 },
  christmas_studier: { id: 'christmas_studier', name: '메리 크리스마스', desc: '12월 25일 크리스마스에 30문제 이상 풀이', icon: '🎄', tier: 'hidden', points: 50 },
  lunar_new_year: { id: 'lunar_new_year', name: '설날의 다짐', desc: '음력 설날 당일에 30문제 이상 풀이', icon: '🧧', tier: 'hidden', points: 50 },

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
  ch1_master: { id: 'ch1_master', name: '이 정도는 이제..', desc: '제1장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch2_master: { id: 'ch2_master', name: '성공비전전', desc: '제2장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch3_master: { id: 'ch3_master', name: '철벽의 품질관리자', desc: '제3장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch4_master: { id: 'ch4_master', name: '선임 절차 전문가', desc: '제4장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch5_master: { id: 'ch5_master', name: '감사계약 협상가', desc: '제5장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch6_master: { id: 'ch6_master', name: '감사증거의 이해자', desc: '제6장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch7_master: { id: 'ch7_master', name: 'RMM 평가자', desc: '제7장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch8_master: { id: 'ch8_master', name: 'TOC 설계자', desc: '제8장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch10_master: { id: 'ch10_master', name: '잔여기간 전문가', desc: '제10장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch11_master: { id: 'ch11_master', name: '초도감사 전문가', desc: '제11장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch12_master: { id: 'ch12_master', name: '부정감사 스페셜리스트', desc: '제12장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch13_master: { id: 'ch13_master', name: '표본설계 마스터', desc: '제13장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch14_master: { id: 'ch14_master', name: '계속기업 평가자', desc: '제14장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch15_master: { id: 'ch15_master', name: '왜곡표시 평가자', desc: '제15장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch16_master: { id: 'ch16_master', name: 'KAM 선정 전문가', desc: '제16장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch17_master: { id: 'ch17_master', name: '그룹감사 지휘자', desc: '제17장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch18_master: { id: 'ch18_master', name: '내부통제 평가자', desc: '제18장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 },
  ch20_master: { id: 'ch20_master', name: '소규모 전문가', desc: '제20장 1회독 이상 + 평균 85점 달성', icon: '🎓', tier: 'silver', points: 20 }
};

// ========================================
// 암기 팁 프롬프트 템플릿
// ========================================
/**
 * 암기 팁 생성을 위한 Gemini 프롬프트 생성
 * @param {string} question - 문제 텍스트
 * @param {string} answer - 정답 텍스트
 * @param {string} mode - 암기팁 스타일 ('mild' | 'stimulating')
 * @returns {string} - Gemini API에 전달할 프롬프트
 */
export function createMemoryTipPrompt(question, answer, mode = 'mild') {
  // Mild 모드일 때 자극적 문구 제거
  const s1 = mode === 'stimulating' ? ' 선정적이거나 자극적이어도 좋음.' : '';
  const s2 = mode === 'stimulating' ? ' 경선식 스타일처럼 익살스럽고 선정적이거나 자극적이어도 좋음.' : ' 익살스럽고 재미있으면 좋음.';

  // API 타임아웃 방지: 문제/정답을 각 800자로 제한
  const questionTruncated = (question || '').slice(0, 800) + ((question || '').length > 800 ? ' …' : '');
  const answerTruncated = (answer || '').slice(0, 800) + ((answer || '').length > 800 ? ' …' : '');

  return `[역할]
당신은 회계감사 2차 시험을 준비하는 학생의 암기 코치입니다.
아래 문제와 정답을 보고, 학생이 쉽게 기억할 수 있도록 **유연한 암기 팁**을 제공하세요.

[암기 기법 옵션 - 자유롭게 선택]
1. **두문자 암기법**: 핵심 단어(모범답안 단어 자체(동의어 등으로)를 바꿔서는 안됩니다)의 첫 글자를 조합. 익살스러워서 기억에 남으면 좋음.${s1} (예: "감사증거의 충분성과 적합성" → "충·적")
2. **시각적 연상**: 개념을 이미지나 장면으로 비유.. (예: "내부통제는 회사의 면역 체계")
3. **실무 예시**: 실제 업무 상황으로 설명 (예: "재고조사는 창고에서 직접 세는 것")
4. **비교 대조**: 유사 개념과 차이점 강조 (예: "직접확인 vs 간접확인")
5. **어원/유래**: 용어의 어원이나 영어 원문 활용 (예: "materiality = 중요성")
6. **스토리텔링**: 개념을 짧은 이야기로 연결.${s2}
7. **기타 창의적 방법**: 위 기법에 국한되지 않고, 해당 내용에 가장 잘 맞는 방법 자유 선택

[중요 원칙]
- **유연성**: 위 기법 중 1-2개만 선택하거나, 여러 개를 혼합해도 좋습니다. 하지만 1. 두문자를 제시하는 것이 다수의 학생들이 사용하는 방식이니 먼저 고려해주세요.
- **간결성**: 2-5줄 이내로 핵심만 전달
- **실용성**: 실제 시험장에서 떠올리기 쉬운 팁 제공
- **완전성**: 개념의 핵심을 왜곡하지 말고 모든 항목을 포함할것. 예를들어 번호 1~4까지 있다면 4항목을 모두 포함하시오.

[문제]
${questionTruncated}

[정답]
${answerTruncated}

[요청]
위 정답을 외우기 쉽게 만드는 암기 팁을 2-4줄로 제공하세요.
가장 효과적인 기법을 자유롭게 선택하고, 간결하게 작성하세요.`;
}
