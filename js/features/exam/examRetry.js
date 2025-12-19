/**
 * Exam Retry Service
 * 오답 풀이 모드 전용 로직
 * - 오답 문제 추출
 * - 동적 시간 계산
 * - Retry 세션 준비 및 시작
 */

/**
 * 오답 문제 ID 추출 (최근 응시 결과 기준)
 * @param {Object} examService - ExamService 인스턴스
 * @param {number} year - 연도
 * @param {number} threshold - 오답 기준 점수 (기본값: 80점 미만)
 * @returns {Array<string>} 오답 문제 ID 목록
 */
export function getWrongQuestionIds(examService, year, threshold = 80) {
  const latestScore = examService.getLatestScore(year);
  if (!latestScore || !latestScore.details) {
    return [];
  }

  const wrongQuestions = [];
  for (const [questionId, result] of Object.entries(latestScore.details)) {
    if (result.score < threshold) {
      wrongQuestions.push(questionId);
    }
  }

  console.log(`📋 [Retry] ${year}년 오답 문제: ${wrongQuestions.length}개 (기준: ${threshold}점 미만)`);
  return wrongQuestions;
}

/**
 * Retry 모드 시간 제한 계산
 * 공식: (90분 * 배점 비율) + 5분 여유, 최소 10분 보장
 *
 * @param {number} retryTotalScore - 오답 문제들의 총 배점
 * @param {number} fullTotalScore - 전체 시험 배점
 * @returns {number} 시간 제한 (분)
 */
export function calculateRetryTimeLimit(retryTotalScore, fullTotalScore) {
  const timeRatio = retryTotalScore / fullTotalScore;
  const calculatedTime = Math.ceil(90 * timeRatio) + 5;
  const timeLimit = Math.max(10, calculatedTime); // 최소 10분 보장

  console.log(`⏱️ [Retry] 시간 계산: ${retryTotalScore}점 / ${fullTotalScore}점 = ${(timeRatio * 100).toFixed(1)}%`);
  console.log(`   - 기본 시간: ${Math.ceil(90 * timeRatio)}분`);
  console.log(`   - 여유 시간: +5분`);
  console.log(`   - 최종 시간: ${timeLimit}분`);

  return timeLimit;
}

/**
 * Retry 세션 준비 및 정보 계산
 * @param {Object} examService - ExamService 인스턴스
 * @param {number} year - 연도
 * @param {Array<string>} questionIds - 풀이할 문제 ID 목록
 * @returns {Object} { totalScore, timeLimit, questionCount }
 */
export function prepareRetrySession(examService, year, questionIds) {
  if (!questionIds || questionIds.length === 0) {
    throw new Error('오답 문제가 없습니다.');
  }

  // 해당 문제들의 총 배점 계산
  const exams = examService.getExamByYear(year);
  let totalScore = 0;
  let questionCount = 0;

  for (const examCase of exams) {
    for (const question of examCase.questions) {
      if (questionIds.includes(question.id)) {
        totalScore += question.score || 0;
        questionCount++;
      }
    }
  }

  // 시간 제한 계산
  const fullTotalScore = examService.getTotalScore(year);
  const timeLimit = calculateRetryTimeLimit(totalScore, fullTotalScore);

  console.log(`🔄 [Retry Mode] ${year}년 오답 풀이 세션 준비 완료`);
  console.log(`   - 문제 수: ${questionCount}개`);
  console.log(`   - 총 배점: ${totalScore}점`);
  console.log(`   - 제한 시간: ${timeLimit}분`);

  return {
    totalScore,
    timeLimit,
    questionCount,
    questionIds
  };
}

/**
 * Retry 모드 시작 (메인 진입점)
 * @param {Object} examService - ExamService 인스턴스
 * @param {number} year - 연도
 * @param {number} threshold - 오답 기준 점수
 * @returns {Object} Retry 세션 정보 또는 null (오답이 없을 경우)
 */
export function startRetryMode(examService, year, threshold = 80) {
  console.log(`🎯 [Retry Mode] ${year}년 오답 풀이 시작 요청`);

  // 1. 오답 문제 ID 추출
  const wrongQuestionIds = getWrongQuestionIds(examService, year, threshold);

  if (wrongQuestionIds.length === 0) {
    console.log('✅ [Retry Mode] 오답이 없습니다!');
    return null;
  }

  // 2. Retry 세션 준비
  const sessionInfo = prepareRetrySession(examService, year, wrongQuestionIds);

  // 3. ExamService에 모드 설정
  examService.currentMode = 'retry';
  examService.retryQuestionIds = wrongQuestionIds;

  console.log('✅ [Retry Mode] 활성화 완료');

  return sessionInfo;
}

/**
 * Retry 모드 종료
 * @param {Object} examService - ExamService 인스턴스
 */
export function exitRetryMode(examService) {
  examService.currentMode = 'normal';
  examService.retryQuestionIds = [];
  console.log('✅ [Retry Mode] 종료 - 정상 모드로 복귀');
}

/**
 * 현재 Retry 모드 여부 확인
 * @param {Object} examService - ExamService 인스턴스
 * @returns {boolean}
 */
export function isRetryMode(examService) {
  return examService.currentMode === 'retry';
}

/**
 * Retry 대상 문제인지 확인
 * @param {Object} examService - ExamService 인스턴스
 * @param {string} questionId - 문제 ID
 * @returns {boolean}
 */
export function isRetryQuestion(examService, questionId) {
  return examService.retryQuestionIds && examService.retryQuestionIds.includes(questionId);
}
