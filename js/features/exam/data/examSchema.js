/**
 * Exam Data Schema Definition (Hierarchical Structure)
 *
 * 새로운 계층형 데이터 구조:
 * - Scenario는 SubQuestion 레벨에 저장됨 (Case 레벨 아님)
 * - 이를 통해 Q1-1은 Scenario A, Q1-2는 Scenario B 같은 유연한 구조 지원
 * - UI는 소문항(SubQuestion) 단위로 접근하되, 대문항(Case)으로 그룹화
 */

/**
 * @typedef {Object} ExamMetadata
 * @property {number} year - 시험 연도
 * @property {string} title - 시험 제목
 * @property {string} description - 시험 설명
 * @property {number} duration - 제한 시간 (초)
 * @property {number} totalQuestions - 총 문제 수
 * @property {number} totalScore - 총점
 * @property {number} passingScore - 합격 기준 점수
 */

/**
 * @typedef {Object} SubQuestion
 * @property {string} id - 고유 ID (예: Q1-1-1, Q1-1-2)
 * @property {string} type - 문제 유형 (Rule, Case, null)
 * @property {number} score - 배점
 * @property {string} scenario - 지문 (핵심: 소문항 레벨에 위치)
 * @property {string} question - 문제
 * @property {string} answer - 모범 답안
 * @property {string[]} keywords - 키워드 목록 (Check Point에서 추출)
 * @property {string} explanation - 해설
 */

/**
 * @typedef {Object} ExamCase
 * @property {string} caseId - 대문제 ID (예: 2025_Q1)
 * @property {string} topic - 주제
 * @property {string} chapter - 단원
 * @property {SubQuestion[]} subQuestions - 소문항 배열
 */

/**
 * @typedef {Object} ExamData
 * @property {string} examId - 파일 단위 식별자 (예: 2025_KAM)
 * @property {ExamCase[]} cases - 대문제 배열
 */

/**
 * @typedef {Object} HierarchicalExamFile
 * @property {ExamMetadata} metadata - 메타데이터
 * @property {ExamData[]} exams - 시험 데이터 (하나의 파일에 여러 시험이 있을 수 있음)
 */

/**
 * 데이터 변환 예시:
 *
 * 기존 구조 (Flat):
 * {
 *   "id": "2025_Q1",
 *   "scenario": "공통 지문...",  // Case 레벨
 *   "questions": [
 *     { "id": "Q1-1-1", "question": "...", "model_answer": "..." },
 *     { "id": "Q1-1-2", "question": "...", "model_answer": "..." }
 *   ]
 * }
 *
 * 새 구조 (Hierarchical):
 * {
 *   "examId": "2025_KAM",
 *   "cases": [
 *     {
 *       "caseId": "2025_Q1",
 *       "topic": "윤리기준과 독립성",
 *       "chapter": "2",
 *       "subQuestions": [
 *         {
 *           "id": "Q1-1-1",
 *           "type": "Rule",
 *           "score": 1,
 *           "scenario": "다음은 윤리기준과 품질관리에 대한 물음이다.\n(물음 1) ...\nA 정승회계법인은...",
 *           "question": "(물음 1) ... 수임 가능 여부 판단...",
 *           "answer": "[수임 가능합니다]...",
 *           "keywords": ["약관에 따른 거래", "정상적인 거래 조건"],
 *           "explanation": "해당 거래는 회사의 통상적인..."
 *         },
 *         {
 *           "id": "Q1-1-2",
 *           "type": "Rule",
 *           "score": 1,
 *           "scenario": "다음은 윤리기준과 품질관리에 대한 물음이다.\n(물음 1) ...\nB 한국회계법인은...",
 *           "question": "(물음 1) ... 수임 가능 여부 판단...",
 *           "answer": "[수임 불가능합니다]...",
 *           "keywords": ["지배·종속 관계 포함", "보험계리업무"],
 *           "explanation": "감사대상회사의 지배·종속관계에 있는 회사에 대하여..."
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

export const EXAM_SCHEMA_VERSION = '2.0.0';
