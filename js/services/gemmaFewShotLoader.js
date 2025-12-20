/**
 * Gemma 3 Few-Shot Example Loader with RAG Integration
 * gemma_few_shots.json에서 실제 Gemini 채점 데이터를 로드하여
 * Gemma 모델의 few-shot 학습에 활용
 *
 * RAG 통합: 문제 내용 기반으로 관련성 높은 few-shot 예시 선택
 */

import ragSearchService from './ragSearch.js';

/**
 * Few-shot 데이터 캐시
 */
let cachedFewShots = null;
let cachedExamples = null;

/**
 * gemma_few_shots.json 로드
 */
async function loadFewShotData() {
  if (cachedFewShots) {
    return cachedFewShots;
  }

  try {
    const response = await fetch('/js/config/gemma_few_shots.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    cachedFewShots = data.auditQuizScores;
    console.log('✅ [FewShot] gemma_few_shots.json 로드 완료:', Object.keys(cachedFewShots).length, '개 문항');
    return cachedFewShots;
  } catch (error) {
    console.error('❌ [FewShot] gemma_few_shots.json 로드 실패:', error);
    return null;
  }
}

/**
 * 점수대별로 few-shot 예시 선택 (RAG 통합)
 * @param {number} targetScore - 예상 점수대 (0-100)
 * @param {number} count - 선택할 예시 개수 (기본 5개)
 * @param {string} correctAnswer - 모범 답안 (RAG 검색용, 옵션)
 * @returns {Array} Few-shot 예시 배열
 */
export async function selectFewShotExamples(targetScore = 70, count = 5, correctAnswer = null) {
  const fewShots = await loadFewShotData();
  if (!fewShots) {
    console.warn('⚠️ [FewShot] 데이터 로드 실패, 빈 배열 반환');
    return [];
  }

  // 점수 정보가 있는 항목만 필터링
  const validExamples = Object.entries(fewShots)
    .filter(([_, data]) => data.score != null && data.feedback && data.user_answer)
    .map(([id, data]) => ({
      id,
      score: data.score,
      feedback: data.feedback,
      userAnswer: data.user_answer,
      // solveHistory에서 가장 최근 점수 사용
      latestScore: data.solveHistory?.length > 0
        ? data.solveHistory[data.solveHistory.length - 1].score
        : data.score
    }));

  console.log('📊 [FewShot] 유효한 예시:', validExamples.length, '개');

  // 점수대별로 그룹화
  const scoreGroups = {
    high: validExamples.filter(ex => ex.latestScore >= 80),      // 80-100점
    medium: validExamples.filter(ex => ex.latestScore >= 60 && ex.latestScore < 80), // 60-79점
    low: validExamples.filter(ex => ex.latestScore < 60)         // 0-59점
  };

  console.log('📊 [FewShot] 점수대별 분포:', {
    high: scoreGroups.high.length,
    medium: scoreGroups.medium.length,
    low: scoreGroups.low.length
  });

  // RAG 기반 관련 문제 필터링 (correctAnswer가 제공된 경우)
  let relevantExamples = validExamples;
  if (correctAnswer && correctAnswer.length > 10) {
    try {
      // RAG 초기화
      await ragSearchService.initializeRAG();

      // 유사 문제 검색 (상위 20개)
      const similarQuestions = ragSearchService.retrieveDocuments(correctAnswer, 20);
      const similarQuestionIds = similarQuestions.map(q => q.id);

      console.log('🔍 [RAG-FewShot] 유사 문제 검색:', similarQuestionIds.length, '개');

      if (similarQuestionIds.length > 0) {
        // 유사 문제의 few-shot 예시만 필터링
        relevantExamples = validExamples.filter(ex =>
          similarQuestionIds.includes(ex.id)
        );

        console.log('✅ [RAG-FewShot] 필터링된 예시:', relevantExamples.length, '개');

        // 필터링 결과가 너무 적으면 원본 사용
        if (relevantExamples.length < count) {
          console.log('⚠️ [RAG-FewShot] 필터링 결과 부족, 전체 예시 사용');
          relevantExamples = validExamples;
        } else {
          // 필터링된 예시로 점수 그룹 재구성
          scoreGroups.high = relevantExamples.filter(ex => ex.latestScore >= 80);
          scoreGroups.medium = relevantExamples.filter(ex => ex.latestScore >= 60 && ex.latestScore < 80);
          scoreGroups.low = relevantExamples.filter(ex => ex.latestScore < 60);

          console.log('📊 [RAG-FewShot] 필터링 후 점수 분포:', {
            high: scoreGroups.high.length,
            medium: scoreGroups.medium.length,
            low: scoreGroups.low.length
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ [RAG-FewShot] RAG 검색 실패, 기본 방식 사용:', error.message);
    }
  }

  // 목표 점수대에 따라 예시 선택 전략
  let selectedExamples = [];

  if (targetScore >= 80) {
    // 고득점 예상: 고득점 예시 위주
    selectedExamples = [
      ...shuffleArray(scoreGroups.high).slice(0, 3),
      ...shuffleArray(scoreGroups.medium).slice(0, 2)
    ];
  } else if (targetScore >= 60) {
    // 중간 점수 예상: 중간 예시 위주
    selectedExamples = [
      ...shuffleArray(scoreGroups.medium).slice(0, 3),
      ...shuffleArray(scoreGroups.high).slice(0, 1),
      ...shuffleArray(scoreGroups.low).slice(0, 1)
    ];
  } else {
    // 저득점 예상: 저득점 예시 위주
    selectedExamples = [
      ...shuffleArray(scoreGroups.low).slice(0, 3),
      ...shuffleArray(scoreGroups.medium).slice(0, 2)
    ];
  }

  // 최대 count개로 제한
  selectedExamples = selectedExamples.slice(0, count);

  console.log('✅ [FewShot] 선택된 예시:', selectedExamples.length, '개',
    '(점수:', selectedExamples.map(ex => ex.latestScore).join(', ') + ')');

  return selectedExamples;
}

/**
 * Few-shot 예시를 프롬프트 텍스트로 변환
 * @param {Array} examples - selectFewShotExamples()의 반환값
 * @returns {string} 프롬프트에 삽입할 텍스트
 */
export function formatFewShotPrompt(examples) {
  if (!examples || examples.length === 0) {
    return '<Examples>\n(예시 데이터 없음)\n</Examples>';
  }

  const exampleTexts = examples.map((ex, idx) => `
[예시 ${idx + 1}]
사용자 답안: ${ex.userAnswer}
점수: ${ex.score}점
피드백: ${ex.feedback}
`).join('\n');

  return `<Examples>
다음은 실제 채점 예시입니다. 이 예시들의 채점 기준과 피드백 스타일을 참고하세요:
${exampleTexts}
</Examples>`;
}

/**
 * Gemma API 호출용 few-shot 프롬프트 생성 (RAG 통합)
 * @param {string} userAnswer - 사용자 답안
 * @param {string} correctAnswer - 모범 답안
 * @param {number} estimatedScore - 예상 점수 (옵션, 기본 70점)
 * @returns {Promise<string>} Few-shot 포함 프롬프트
 */
export async function buildGemmaFewShotPrompt(userAnswer, correctAnswer, estimatedScore = 70) {
  // RAG 기반 관련 예시 선택
  const examples = await selectFewShotExamples(estimatedScore, 5, correctAnswer);
  const fewShotText = formatFewShotPrompt(examples);

  return fewShotText;
}

/**
 * 배열 셔플 (Fisher-Yates 알고리즘)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 캐시 초기화 (디버깅용)
 */
export function clearFewShotCache() {
  cachedFewShots = null;
  cachedExamples = null;
  console.log('🔄 [FewShot] 캐시 초기화 완료');
}

/**
 * Few-shot 데이터 통계
 */
export async function getFewShotStats() {
  const fewShots = await loadFewShotData();
  if (!fewShots) {
    return null;
  }

  const scores = Object.values(fewShots)
    .filter(data => data.score != null)
    .map(data => data.score);

  return {
    total: scores.length,
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
    distribution: {
      high: scores.filter(s => s >= 80).length,
      medium: scores.filter(s => s >= 60 && s < 80).length,
      low: scores.filter(s => s < 60).length
    }
  };
}
