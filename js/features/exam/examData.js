/**
 * Past Exam Data (2025년 기출문제 - KAM 사례 기반)
 *
 * 실제 감사보고서의 핵심감사사항(KAM)을 기반으로 한 실전 문제
 *
 * 새로운 계층형 데이터 구조 (Schema v2.0):
 * - examId: 파일 단위 식별자
 * - cases: 대문제 배열
 *   - caseId: 대문제 ID (예: 2025_Q1)
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
 */
function extractQuestionNumbers(questionId) {
  // "Q" 제거 후 "-"로 분리하여 숫자 추출
  const parts = questionId.replace(/^Q/i, '').split('-');
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

// Hierarchical 데이터를 동적으로 import
let hierarchicalExamData = null;

// 데이터 로딩 함수
async function loadHierarchicalData() {
  if (!hierarchicalExamData) {
    try {
      const response = await fetch('./js/features/exam/data/2025_hierarchical.json');
      const data = await response.json();
      hierarchicalExamData = data;
    } catch (error) {
      console.error('Hierarchical 데이터 로딩 실패:', error);
      hierarchicalExamData = [];
    }
  }
  return hierarchicalExamData;
}

/**
 * EXAM_2025 데이터 반환 (비동기)
 *
 * 새로운 계층형 구조를 기존 flat 구조로 변환하여 반환
 * 이를 통해 기존 코드와의 호환성 유지
 */
export async function getExam2025() {
  const hierarchicalData = await loadHierarchicalData();

  // Hierarchical 구조를 Flat 구조로 변환
  const flatExams = [];

  hierarchicalData.forEach(exam => {
    exam.cases.forEach(caseItem => {
      flatExams.push({
        id: caseItem.caseId,
        year: 2025,
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
 * 메타데이터 반환 (비동기)
 */
export async function getExamMetadata() {
  const hierarchicalData = await loadHierarchicalData();

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

  return {
    2025: {
      totalScore: totalScore,
      timeLimit: 90, // 분
      passingScore: 60,
      availableYears: [2025],
      title: "공인회계사 2차 기출문제 (KAM 사례 기반)",
      description: "실제 감사보고서의 핵심감사사항(KAM)을 기반으로 한 실전 문제",
      totalQuestions: totalQuestions
    }
  };
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
