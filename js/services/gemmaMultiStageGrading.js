// ============================================
// Gemma 3 다단계 채점 파이프라인
// TPM 제한 우회 및 RAG 품질 향상을 위한 2B/4B/12B/27B 전략
// ============================================

import { callGeminiTextAPI } from './geminiApi.js';

/**
 * Gemma 3 다단계 채점 파이프라인
 *
 * Stage 0 (Gemma 2B): RAG 쿼리 최적화 - 핵심 검색어 추출
 * Stage 1 (Gemma 4B): RAG 결과 요약 - 방대한 기준서를 핵심 문장으로 압축
 * Stage 2 (Gemma 12B): 채점 기준 설계 - CoT 기반 문제별 채점 가이드 생성
 * Stage 3 (Gemma 27B): 최종 채점 - 사용자 답안 평가 및 JSON 출력
 *
 * TPM 관리:
 * - 2B: 15K TPM (전용)
 * - 4B: 15K TPM (전용)
 * - 12B: 15K TPM (전용)
 * - 27B: 15K TPM (전용)
 * → 총 60K TPM 가용 (모델별 독립 쿼타)
 */

/**
 * Stage 0: RAG 쿼리 최적화 (Gemma 2B)
 * 목적: 사용자의 방대한 지문과 문제에서 RAG 검색에 최적화된 핵심 키워드 3~5개 추출
 *
 * @param {string} scenario - 문제 지문
 * @param {string} question - 문제 내용
 * @param {string} apiKey - API 키
 * @returns {Promise<string[]>} 핵심 검색어 배열 (3~5개)
 */
export async function optimizeRAGQuery(scenario, question, apiKey) {
  const prompt = `
# 역할
회계감사 전문가로서, 아래 문제에서 회계기준서 검색에 가장 효과적인 핵심 키워드만 추출하십시오.

# 지문
${scenario}

# 문제
${question}

# 요구사항
- 회계 전문 용어(예: 실재성, 재고실사, 외부조회, 충분하고 적합한 감사증거) 우선
- 일반 조사(은, 는, 이, 가)나 불필요한 단어 제외
- 검색 품질을 높일 수 있는 **핵심 키워드 3~5개**만 추출
- 출력 형식: 쉼표로 구분된 키워드만 (예: 재고실사, 입회, 표본추출, 실사절차)

# 출력
`;

  try {
    const response = await callGeminiTextAPI(prompt, apiKey, 'gemma-3-1b-it', 2, 800);

    // 응답을 쉼표로 분리하여 키워드 배열 생성
    const keywords = response.split(',').map(k => k.trim()).filter(k => k.length > 0);

    console.log('✅ [Stage 0 - Gemma 1B] RAG 쿼리 최적화 완료:', keywords);
    return keywords.slice(0, 5); // 최대 5개까지만
  } catch (error) {
    console.error('❌ [Stage 0 - Gemma 1B] RAG 쿼리 최적화 실패:', error);
    // 실패 시 원본 쿼리 사용 (폴백)
    return [];
  }
}

/**
 * Stage 1: RAG 결과 요약 (Gemma 4B)
 * 목적: 검색된 기준서 전문(수천 자)에서 채점에 필요한 핵심 문장 3~5개로 압축
 *
 * @param {Array} ragResults - RAG 검색 결과 배열
 * @param {string} question - 문제 내용
 * @param {string} apiKey - API 키
 * @returns {Promise<string>} 요약된 RAG 결과 (핵심 문장 3~5개)
 */
export async function summarizeRAGResults(ragResults, question, apiKey) {
  if (!ragResults || ragResults.length === 0) {
    return ''; // RAG 결과 없음
  }

  // RAG 결과를 텍스트로 변환
  const ragText = ragResults.map((doc, index) => {
    const title = doc.item?.problemTitle || doc.problemTitle || '제목 없음';
    const answer = doc.item?.answer || doc.answer || '';
    return `[${index + 1}] ${title}\n${answer.substring(0, 500)}`;
  }).join('\n\n');

  const prompt = `
# 역할
회계감사 기준서 전문가로서, 아래 검색된 자료에서 현재 문제의 채점에 **직접 도움이 되는 핵심 문장만** 추출하십시오.

# 현재 문제
${question}

# 검색된 회계감사 기준서 (RAG 결과)
${ragText}

# 요구사항
1. 현재 문제와 **직접 관련된** 회계 원칙, 감사 절차, 기준서 조항만 추출
2. 불필요한 배경 설명이나 예시는 제외
3. 핵심 문장 3~5개로 압축 (각 문장 50자 이내 권장)
4. 출력: 간결한 문장 나열 (번호 표시 불필요)

# 출력
`;

  try {
    const response = await callGeminiTextAPI(prompt, apiKey, 'gemma-3-4b-it', 2, 800);

    console.log('✅ [Stage 1 - Gemma 4B] RAG 요약 완료:', response.length, '자');
    return response.trim();
  } catch (error) {
    console.error('❌ [Stage 1 - Gemma 4B] RAG 요약 실패:', error);
    // 실패 시 원본 RAG 결과의 첫 번째 항목만 반환 (폴백)
    return ragResults[0]?.item?.answer?.substring(0, 300) || '';
  }
}

/**
 * Stage 2: 채점 기준 설계 (Gemma 12B)
 * 목적: 문제 시나리오, 요약된 RAG, 모범 답안을 융합하여 해당 문제만을 위한 세부 채점 기준(CoT) 생성
 *
 * @param {string} scenario - 문제 지문
 * @param {string} question - 문제 내용
 * @param {string} modelAnswer - 모범 답안
 * @param {string} summarizedRAG - Stage 1에서 요약된 RAG 결과
 * @param {Object} questionMetadata - 문제 메타데이터 (score, type 등)
 * @param {string} apiKey - API 키
 * @returns {Promise<string>} 채점 가이드라인 (CoT)
 */
export async function generateGradingCriteria(scenario, question, modelAnswer, summarizedRAG, questionMetadata, apiKey) {
  const { score, type, keywords } = questionMetadata;
  const isRule = type === 'Rule';
  const isCase = type === 'Case';

  const prompt = `
# 역할
KICPA 2차 회계감사 채점 전문가로서, 이 문제만을 위한 **세부 채점 가이드라인(CoT)**을 설계하십시오.

# 문제 정보
- 배점: ${score}점
- 유형: ${isRule ? '기준서형 (Rule)' : isCase ? '사례/OX형 (Case)' : '일반'}
${keywords && keywords.length > 0 ? `- 핵심 키워드: ${keywords.join(', ')}` : ''}

## 지문
${scenario}

## 문제
${question}

## 모범 답안
${modelAnswer}

${summarizedRAG ? `## 📚 참고 기준서 (RAG 요약)
${summarizedRAG}` : ''}

# 채점 원칙 (config.js 기준)
1. **예/아니오 문제**: 정답 불일치 시 즉시 0점
2. **키워드 중심**: 의미 통하면 인정 (기계적 매칭 금지)
3. **수험 언어**: "충적감증", "성시범" 등 약어 인정
4. **기준서형(Rule)**: 키워드 중심, 의미 통하면 만점
5. **사례형(Case)**: 논리적 근거 필수, 결론만 맞으면 30%

# 요구사항
아래 항목을 순서대로 분석하여 **채점 가이드라인**을 작성하십시오:

1. **문제 유형 판단**
   - 예/아니오 문제인가? → "예"인지 "아니오"인지 명시
   - 근거 요구 문제인가?
   - 기준서형 vs 사례형 특징

2. **핵심 키워드 추출**
   - 모범 답안에서 반드시 포함되어야 할 핵심 키워드 3~5개
   - 각 키워드의 중요도 (필수 / 권장)

3. **채점 시나리오별 점수 배분**
   - 만점(${score}점): 어떤 조건을 만족해야 하는가?
   - 80% (${(score * 0.8).toFixed(1)}점): 일부 누락 시
   - 60% (${(score * 0.6).toFixed(1)}점): 핵심만 포함 시
   - 30% (${(score * 0.3).toFixed(1)}점): 결론만 맞는 경우
   - 0점: 어떤 경우에 0점인가?

4. **주의사항**
   - 모범 답안의 괄호 안 내용은 평가 대상 아님
   - 수험 언어 ("충적감증" 등) 인정 범위
   - 흔한 오답 패턴

# 출력 형식
간결하게 번호별로 나열 (예시):

1. 유형: 예/아니오 문제 (정답: "아니오"), 근거 필수
2. 핵심 키워드: "실재성"(필수), "재고실사"(필수), "입회"(권장)
3. 점수:
   - ${score}점: "아니오" + "실재성 확인 위해 재고실사 필요" 포함
   - ${(score * 0.8).toFixed(1)}점: "아니오" + "실재성" 또는 "재고실사" 중 하나만 언급
   - ${(score * 0.3).toFixed(1)}점: "아니오"만 정확, 이유 없음
   - 0점: "예" 또는 답변 없음
4. 주의: 괄호 안 "(assertion)" 등은 평가 제외, "충적감증" 인정

# 출력
`;

  try {
    const response = await callGeminiTextAPI(prompt, apiKey, 'gemma-3-12b-it', 2, 1000);

    console.log('✅ [Stage 2 - Gemma 12B] 채점 기준 생성 완료:', response.length, '자');
    return response.trim();
  } catch (error) {
    console.error('❌ [Stage 2 - Gemma 12B] 채점 기준 생성 실패:', error);
    // 실패 시 기본 가이드라인 반환 (폴백)
    return `기본 채점 기준:\n- 핵심 키워드 포함 여부 확인\n- 모범 답안과 의미 일치 여부 평가\n- 배점 ${score}점 기준 비례 배분`;
  }
}

/**
 * Stage 3: 최종 채점 (Gemma 27B)
 * 목적: Stage 2에서 만든 채점 가이드라인에 사용자 답안을 대입하여 최종 점수 및 JSON 생성
 *
 * @param {string} userAnswer - 사용자 답안
 * @param {string} gradingCriteria - Stage 2에서 생성된 채점 가이드라인
 * @param {Object} questionMetadata - 문제 메타데이터
 * @param {string} apiKey - API 키
 * @returns {Promise<Object>} 채점 결과 { score, feedback, strengths, improvements, keywordMatch, missingKeywords }
 */
export async function performFinalGrading(userAnswer, gradingCriteria, questionMetadata, apiKey) {
  const { score: maxScore, type } = questionMetadata;

  const prompt = `
# 역할
KICPA 2차 회계감사 채점관. 아래 **채점 가이드라인**에 따라 사용자 답안을 평가하십시오.

# 채점 가이드라인 (Stage 2에서 생성)
${gradingCriteria}

# 사용자 답안
${userAnswer}

# 요구사항
1. 채점 가이드라인의 점수 배분 기준을 **엄격히** 준수
2. 키워드 매칭은 의미 기반 (동의어, 수험 언어 인정)
3. 엄격하되 공정하게 평가 (KICPA 실전 채점 경향 반영)

# 출력 형식 (반드시 아래 형식의 JSON만 출력)
###JSON###
{
  "score": 0~${maxScore} (0.5 단위 소수점),
  "question_type": "${type || '일반'}",
  "feedback": "총평 2-3문장 (엄격한 교수 톤)",
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "keywordMatch": ["매칭된 키워드1", "키워드2"],
  "missingKeywords": ["누락 키워드1", "키워드2"]
}
###END###

⚠️ 설명 없이 JSON만 출력하십시오.

# 출력
`;

  try {
    const response = await callGeminiTextAPI(prompt, apiKey, 'gemma-3-27b-it', 2, 1000);

    // Delimiter 기반 JSON 추출
    const { extractJsonWithDelimiter } = await import('../utils/helpers.js');
    const jsonText = extractJsonWithDelimiter(response);

    if (!jsonText) {
      throw new Error('JSON 추출 실패 (Delimiter 없음)');
    }

    const result = JSON.parse(jsonText);

    // 점수 검증 및 보정
    result.score = Math.max(0, Math.min(result.score, maxScore));
    result.score = Math.round(result.score * 2) / 2; // 0.5 단위로 반올림

    console.log('✅ [Stage 3 - Gemma 27B] 최종 채점 완료:', result.score, '/', maxScore, '점');
    return result;
  } catch (error) {
    console.error('❌ [Stage 3 - Gemma 27B] 최종 채점 실패:', error);
    throw error;
  }
}

/**
 * 통합 파이프라인: Gemma 3 다단계 채점 (Main Entry Point)
 *
 * @param {Object} examCase - 시험 케이스 (scenario, topic, type 포함)
 * @param {Object} question - 문제 객체 (question, model_answer, score, type 포함)
 * @param {string} userAnswer - 사용자 답안
 * @param {string} apiKey - API 키
 * @param {Object} ragSearchService - RAG 검색 서비스 인스턴스 (옵셔널)
 * @returns {Promise<Object>} 채점 결과
 */
export async function gradeWithGemmaMultiStage(examCase, question, userAnswer, apiKey, ragSearchService = null) {
  console.log('🚀 [Gemma Multi-Stage] 다단계 채점 파이프라인 시작');

  const scenario = question.scenario || examCase.scenario || '';
  const questionText = question.question || '';
  const modelAnswer = question.model_answer || question.answer || '';
  const questionMetadata = {
    score: question.score || 0,
    type: question.type || examCase.type || 'general',
    keywords: question.keywords || []
  };

  try {
    // Stage 0: RAG 쿼리 최적화 (Gemma 2B)
    let optimizedKeywords = [];
    if (ragSearchService) {
      console.log('🔍 [Stage 0] RAG 쿼리 최적화 시작...');
      optimizedKeywords = await optimizeRAGQuery(scenario, questionText, apiKey);
      console.log('   → 최적화된 검색어:', optimizedKeywords.join(', '));
    }

    // RAG 검색 (최적화된 키워드 사용)
    let ragResults = [];
    if (ragSearchService && optimizedKeywords.length > 0) {
      try {
        await ragSearchService.initializeRAG();
        const searchQuery = optimizedKeywords.join(' ');
        ragResults = ragSearchService.retrieveDocuments(searchQuery, 3);
        console.log('📚 [RAG] 검색 결과:', ragResults.length, '개');
      } catch (error) {
        console.warn('⚠️ [RAG] 검색 실패:', error);
      }
    }

    // Stage 1: RAG 요약 (Gemma 4B)
    let summarizedRAG = '';
    if (ragResults.length > 0) {
      console.log('📝 [Stage 1] RAG 요약 시작...');
      summarizedRAG = await summarizeRAGResults(ragResults, questionText, apiKey);
      console.log('   → 요약 완료:', summarizedRAG.substring(0, 100), '...');
    }

    // Stage 2: 채점 기준 생성 (Gemma 12B)
    console.log('🎯 [Stage 2] 채점 기준 생성 시작...');
    const gradingCriteria = await generateGradingCriteria(
      scenario,
      questionText,
      modelAnswer,
      summarizedRAG,
      questionMetadata,
      apiKey
    );
    console.log('   → 채점 기준 생성 완료');

    // Stage 3: 최종 채점 (Gemma 27B)
    console.log('⚖️ [Stage 3] 최종 채점 시작...');
    const gradingResult = await performFinalGrading(
      userAnswer,
      gradingCriteria,
      questionMetadata,
      apiKey
    );
    console.log('   → 최종 점수:', gradingResult.score, '/', questionMetadata.score, '점');

    console.log('✅ [Gemma Multi-Stage] 다단계 채점 파이프라인 완료');
    return gradingResult;

  } catch (error) {
    console.error('❌ [Gemma Multi-Stage] 파이프라인 실패:', error);
    throw error;
  }
}
