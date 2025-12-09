/**
 * Past Exam Data (2025년 기출문제 - KAM 사례 기반)
 *
 * 실제 감사보고서의 핵심감사사항(KAM)을 기반으로 한 실전 문제
 *
 * 데이터 구조:
 * - id: Case ID (예: 2025_KAM1)
 * - year: 연도
 * - topic: 주제
 * - scenario: 지문 (공통)
 * - type: null (일반 채점 전략 사용)
 * - chapter: 단원
 * - questions: 하위 물음 배열
 */

// KAM 데이터를 동적으로 import
let kamExamData = null;

// 데이터 로딩 함수
async function loadKAMData() {
  if (!kamExamData) {
    try {
      const response = await fetch('./js/features/exam/data/2025_kam.json');
      const data = await response.json();
      kamExamData = data;
    } catch (error) {
      console.error('KAM 데이터 로딩 실패:', error);
      kamExamData = { exams: [], metadata: {} };
    }
  }
  return kamExamData;
}

/**
 * EXAM_2025 데이터 반환 (비동기)
 */
export async function getExam2025() {
  const data = await loadKAMData();
  return data.exams || [];
}

/**
 * 메타데이터 반환 (비동기)
 */
export async function getExamMetadata() {
  const data = await loadKAMData();
  return {
    2025: {
      totalScore: data.metadata?.totalScore || 520,
      timeLimit: 90, // 분
      passingScore: data.metadata?.passingScore || 60,
      availableYears: [2025],
      title: data.metadata?.title || "공인회계사 2차 기출문제",
      description: data.metadata?.description || "실제 감사보고서의 핵심감사사항(KAM)을 기반으로 한 실전 문제"
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
