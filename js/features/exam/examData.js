/**
 * Past Exam Data (2014-2025년 기출문제)
 *
 * 기출 문제
 *
 * 새로운 계층형 데이터 구조 (Schema v2.0):
 * - examId: 파일 단위 식별자
 * - cases: 대문제 배열
 *   - caseId: 대문제 ID (예: 2025_Q1, 2024_Q1)
 *   - topic: 주제
 *   - chapter: 단원
 *   - subQuestions: 소문항 배열
 *     - id: 고유 ID (예: Q1-1-1)
 *     - type: 문제 유형 (Rule, Case)
 *     - score: 배점
 *     - scenario: 지문 (핵심: SubQuestion 레벨에 위치!)
 *     - question: 문제
 *     - answer: 모범 답안
 *     - keywords: 키워드 배열
 *     - explanation: 해설
 */

/**
 * Question ID에서 숫자 배열 추출 (정렬용)
 * 예: "Q10-1-2" -> [10, 1, 2]
 *     "Q1-2-3" -> [1, 2, 3]
 *     "2025_Q1" -> [1]
 *     "2025_Q10" -> [10]
 */
function extractQuestionNumbers(questionId) {
  // "Q" 또는 "_Q" 이후 부분만 추출
  let qPart = questionId;
  const qMatch = questionId.match(/[_-]?Q(.+)$/i);
  if (qMatch) {
    qPart = qMatch[1]; // "Q" 이후 부분만
  } else if (questionId.startsWith('Q') || questionId.startsWith('q')) {
    qPart = questionId.replace(/^Q/i, '');
  }
  
  // "-"로 분리하여 숫자 추출
  const parts = qPart.split('-');
  return parts.map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Question ID 비교 함수 (정렬용)
 * 숫자 순서로 정렬: Q1, Q2, Q3, ..., Q9, Q10, Q11, ...
 */
function compareQuestionIds(a, b) {
  const numsA = extractQuestionNumbers(a.id);
  const numsB = extractQuestionNumbers(b.id);
  
  // 각 숫자 부분을 순차적으로 비교
  const maxLen = Math.max(numsA.length, numsB.length);
  for (let i = 0; i < maxLen; i++) {
    const numA = numsA[i] || 0;
    const numB = numsB[i] || 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

// Hierarchical 데이터를 연도별로 캐싱
const hierarchicalExamDataCache = {};

/**
 * 연도별 계층형 데이터 로딩 함수
 * @param {number} year - 연도 (2014-2025)
 * @returns {Promise<Array>} 계층형 데이터 배열
 */
async function loadHierarchicalData(year) {
  // 캐시 확인
  if (hierarchicalExamDataCache[year]) {
    return hierarchicalExamDataCache[year];
  }

  try {
    const response = await fetch(`./js/features/exam/data/${year}_hierarchical.json`);
    if (!response.ok) {
      // 파일이 없으면 빈 배열 반환 (해당 연도 데이터 없음)
      console.warn(`⚠️ ${year}년 데이터 파일 없음: ${year}_hierarchical.json`);
      hierarchicalExamDataCache[year] = [];
      return [];
    }
    const data = await response.json();
    hierarchicalExamDataCache[year] = data;
    return data;
  } catch (error) {
    console.error(`${year}년 Hierarchical 데이터 로딩 실패:`, error);
    hierarchicalExamDataCache[year] = [];
    return [];
  }
}

/**
 * 연도별 시험 데이터 반환 (비동기)
 * 
 * @param {number} year - 연도 (2014-2025)
 * @returns {Promise<Array>} Flat 구조의 시험 데이터 배열
 * 
 * 새로운 계층형 구조를 기존 flat 구조로 변환하여 반환
 * 이를 통해 기존 코드와의 호환성 유지
 */
export async function getExamByYear(year) {
  const hierarchicalData = await loadHierarchicalData(year);

  // Hierarchical 구조를 Flat 구조로 변환
  const flatExams = [];

  hierarchicalData.forEach(exam => {
    exam.cases.forEach(caseItem => {
      flatExams.push({
        id: caseItem.caseId,
        year: year,
        topic: caseItem.topic,
        chapter: caseItem.chapter,
        // scenario는 첫 번째 subQuestion의 scenario 사용 (호환성 유지)
        scenario: caseItem.subQuestions[0]?.scenario || '',
        type: caseItem.subQuestions[0]?.type || null,
        questions: caseItem.subQuestions
          .map(sq => ({
            id: sq.id,
            question: sq.question,
            score: sq.score,
            model_answer: sq.answer,
            evaluation_criteria: sq.keywords ? `[Check Point]\n${sq.keywords.map(k => `• ${k}`).join('\n')}` : '',
            related_q: sq.relatedQ || '',
            // 새로운 필드 추가
            scenario: sq.scenario, // SubQuestion 레벨의 scenario 보존
            explanation: sq.explanation,
            keywords: sq.keywords,
            type: sq.type
          }))
          .sort(compareQuestionIds) // ID 숫자 순서로 정렬
      });
    });
  });

  return flatExams;
}

/**
 * EXAM_2025 데이터 반환 (비동기) - 레거시 호환성
 * @deprecated getExamByYear(2025) 사용 권장
 */
export async function getExam2025() {
  return getExamByYear(2025);
}

/**
 * 메타데이터 반환 (비동기)
 * 2014-2025년 범위의 모든 연도 데이터를 로드하여 메타데이터 생성
 */
export async function getExamMetadata() {
  const metadata = {};
  const availableYears = [];
  const MIN_YEAR = 2014;
  const MAX_YEAR = 2025;

  // 2014-2025년 범위의 모든 연도 데이터 로드 시도
  for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
    const hierarchicalData = await loadHierarchicalData(year);
    
    // 데이터가 없으면 건너뛰기
    if (!hierarchicalData || hierarchicalData.length === 0) {
      continue;
    }

    // 총 문제 수와 점수 계산
    let totalQuestions = 0;
    let totalScore = 0;

    hierarchicalData.forEach(exam => {
      exam.cases.forEach(caseItem => {
        caseItem.subQuestions.forEach(sq => {
          totalQuestions++;
          totalScore += sq.score || 0;
        });
      });
    });

    // 메타데이터가 있으면 추가
    if (totalQuestions > 0) {
      availableYears.push(year);
      metadata[year] = {
        totalScore: totalScore,
        timeLimit: 90, // 분
        passingScore: 60,
        title: `${year}년 공인회계사 2차 기출문제`,
        description: "실제 감사보고서의 핵심감사사항(KAM)을 기반으로 한 실전 문제",
        totalQuestions: totalQuestions
      };
    }
  }

  // 모든 연도에 availableYears 추가
  Object.keys(metadata).forEach(year => {
    metadata[year].availableYears = availableYears.sort((a, b) => b - a); // 최신순 정렬
  });

  return metadata;
}

// 레거시 호환성을 위한 동기식 내보내기 (빈 배열로 초기화)
export const EXAM_2025 = [];
export const EXAM_METADATA = {
  2025: {
    totalScore: 520,
    timeLimit: 90,
    passingScore: 60,
    availableYears: [2025]
  }
};
