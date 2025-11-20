// ============================================
// 감린이 v4.0 - Gemini API 서비스
// ============================================

import { BASE_SYSTEM_PROMPT, LITE_STRICT_ADDENDUM } from '../config/config.js';
import { clamp, sanitizeModelText } from '../utils/helpers.js';

/**
 * AI 모델 매핑
 */
const MODEL_MAP = {
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.5-pro': 'gemini-2.5-pro'
};

/**
 * Gemini API를 사용하여 채점
 * @returns {Promise<{score: number, feedback: string}>}
 */
export async function callGeminiAPI(userAnswer, correctAnswer, apiKey, selectedAiModel = 'gemini-2.5-flash', retries = 2, delay = 800) {
  const model = MODEL_MAP[selectedAiModel] || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' }
      },
      required: ['score', 'feedback']
    }
  };

  // Lite 모델일 경우 엄격 모드 추가
  const systemText = (model === 'gemini-2.5-flash-lite')
    ? `${BASE_SYSTEM_PROMPT}\n\n${LITE_STRICT_ADDENDUM}`
    : BASE_SYSTEM_PROMPT;

  const systemInstruction = {
    parts: [{ text: systemText }]
  };

  const userQuery = `[모범 답안]\n${correctAnswer}\n\n[사용자 답안]\n${userAnswer}\n\n[채점 요청]\n{"score": number, "feedback": string}`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction,
    generationConfig
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || res.statusText;

      if ((res.status === 404 || res.status === 400) && /model/i.test(msg)) {
        throw new Error(`모델/버전 불일치: ${msg}`);
      }
      if (res.status === 401 || res.status === 403) {
        console.error(`❌ [Gemini API] 403/401 상세 오류:`, body);
        const detailedMsg = msg || 'API 키 권한 부족';
        throw new Error(`API 키 오류 (${res.status}): ${detailedMsg}\n\n가능한 원인:\n1. API 키에 Generative Language API 권한 미부여\n2. API 키 도메인 제한 설정 확인 필요\n3. API 키 만료 또는 비활성화\n4. 사용량 초과 (무료: 분당 15req, 일당 1500req)`);
      }
      if (res.status === 429) {
        throw new Error(`API 할당량 초과 (429)`);
      }
      if (res.status >= 500) {
        throw new Error(`서버 오류 (${res.status})`);
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = sanitizeModelText(raw);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('API 응답 파싱 실패');
    }

    return {
      score: clamp(+parsed.score, 0, 100),
      feedback: String(parsed.feedback || '피드백 없음').trim()
    };
  } catch (err) {
    // 429 또는 서버 오류 시 재시도 (503 포함)
    const is503 = String(err.message).includes('503');
    const shouldRetry = retries > 0 && (
      String(err.message).includes('429') ||
      /^서버 오류/.test(String(err.message))
    );

    if (shouldRetry) {
      const retryDelay = is503 ? delay * 2.5 : delay;
      await new Promise((r) => setTimeout(r, retryDelay));
      return callGeminiAPI(userAnswer, correctAnswer, apiKey, selectedAiModel, retries - 1, delay * 1.8);
    }
    throw err;
  }
}

/**
 * Gemini API를 사용하여 힌트 생성
 * @returns {Promise<string>} 힌트 문자열
 */
export async function callGeminiHintAPI(userAnswer, correctAnswer, questionText, apiKey, selectedAiModel = 'gemini-2.5-flash', retries = 2, delay = 800) {
  const model = MODEL_MAP[selectedAiModel] || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        hint: { type: 'STRING' }
      },
      required: ['hint']
    }
  };

  const systemInstruction = {
    parts: [{
      text: `역할: 회계감사 학습 튜터.\n목표: 정답을 노출하지 않고 핵심 개념을 떠올리게 만드는 2~4줄 힌트 제공.\n출력: JSON만.`
    }]
  };

  const userQuery = `[문제]\n${questionText}\n\n[모범 답안]\n${correctAnswer}\n\n[사용자 답안]\n${userAnswer || '(미입력)'}\n\n[요청]\n{"hint": string }`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction,
    generationConfig
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || res.statusText;

      if ((res.status === 404 || res.status === 400) && /model/i.test(msg)) {
        throw new Error(`모델/버전 불일치: ${msg}`);
      }
      if (res.status === 401 || res.status === 403) {
        console.error(`❌ [Gemini API] 403/401 상세 오류:`, body);
        const detailedMsg = msg || 'API 키 권한 부족';
        throw new Error(`API 키 오류 (${res.status}): ${detailedMsg}\n\n가능한 원인:\n1. API 키에 Generative Language API 권한 미부여\n2. API 키 도메인 제한 설정 확인 필요\n3. API 키 만료 또는 비활성화\n4. 사용량 초과 (무료: 분당 15req, 일당 1500req)`);
      }
      if (res.status === 429) {
        throw new Error(`API 할당량 초과 (429)`);
      }
      if (res.status >= 500) {
        throw new Error(`서버 오류 (${res.status})`);
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = sanitizeModelText(raw);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('API 응답 파싱 실패');
    }

    return String(parsed.hint || '').trim();
  } catch (err) {
    const is503 = String(err.message).includes('503');
    const shouldRetry = retries > 0 && (
      String(err.message).includes('429') ||
      /^서버 오류/.test(String(err.message))
    );

    if (shouldRetry) {
      const retryDelay = is503 ? delay * 2.5 : delay;
      await new Promise((r) => setTimeout(r, retryDelay));
      return callGeminiHintAPI(userAnswer, correctAnswer, questionText, apiKey, selectedAiModel, retries - 1, delay * 1.8);
    }
    throw err;
  }
}

/**
 * Gemini API를 사용하여 범용 텍스트 생성 (리포트 AI 분석 등)
 * @param {string} prompt - 생성할 텍스트에 대한 프롬프트
 * @param {string} apiKey - Gemini API 키
 * @param {string} selectedAiModel - 사용할 모델 ('gemini-2.5-flash' 또는 'gemini-2.5-flash-lite')
 * @param {number} retries - 재시도 횟수
 * @param {number} delay - 재시도 대기 시간 (ms)
 * @param {object} generationConfigOverride - generationConfig 오버라이드 옵션
 * @returns {Promise<string>} 생성된 텍스트
 */
export async function callGeminiTextAPI(prompt, apiKey, selectedAiModel = 'gemini-2.5-flash', retries = 3, delay = 1500, generationConfigOverride = null) {
  const model = MODEL_MAP[selectedAiModel] || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // 기본 generationConfig: 출력 길이 제한으로 API 타임아웃 방지
  const defaultGenerationConfig = {
    maxOutputTokens: 1200,  // 과도한 결과 방지 (≈900단어)
    temperature: 0.7,
    topP: 0.85
  };

  const generationConfig = generationConfigOverride || defaultGenerationConfig;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || res.statusText;

      if ((res.status === 404 || res.status === 400) && /model/i.test(msg)) {
        throw new Error(`모델/버전 불일치: ${msg}`);
      }
      if (res.status === 401 || res.status === 403) {
        console.error(`❌ [Gemini API] 403/401 상세 오류:`, body);
        const detailedMsg = msg || 'API 키 권한 부족';
        throw new Error(`API 키 오류 (${res.status}): ${detailedMsg}\n\n가능한 원인:\n1. API 키에 Generative Language API 권한 미부여\n2. API 키 도메인 제한 설정 확인 필요\n3. API 키 만료 또는 비활성화\n4. 사용량 초과 (무료: 분당 15req, 일당 1500req)`);
      }
      if (res.status === 429) {
        throw new Error(`API 할당량 초과 (429)`);
      }
      if (res.status >= 500) {
        throw new Error(`서버 오류 (${res.status})`);
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return raw.trim();
  } catch (err) {
    // 재시도 조건: 429(할당량) 또는 서버 오류(503 포함)
    // 503 Service Unavailable은 일시적 서비스 과부하 또는 프롬프트가 너무 큼
    const is503 = String(err.message).includes('503');
    const shouldRetry = retries > 0 && (
      String(err.message).includes('429') ||
      /^서버 오류/.test(String(err.message))
    );

    if (shouldRetry) {
      // 503의 경우 더 긴 delay 사용 (서버 부하 감소 대기)
      const retryDelay = is503 ? delay * 2.5 : delay;
      const retryDelaySeconds = (retryDelay / 1000).toFixed(1);

      console.warn(`⚠️ [Gemini API] ${err.message} - ${retryDelaySeconds}초 후 재시도 (남은 횟수: ${retries})`);

      await new Promise((r) => setTimeout(r, retryDelay));
      return callGeminiTextAPI(prompt, apiKey, selectedAiModel, retries - 1, delay * 1.8, generationConfigOverride);
    }

    // 503 재시도 모두 실패 시, flash 모델이었다면 lite로 다운그레이드 시도
    if (is503 && selectedAiModel === 'gemini-2.5-flash') {
      console.warn(`⚠️ [Gemini API] 503 에러 지속 → gemini-2.5-flash-lite로 자동 전환 시도`);
      try {
        return await callGeminiTextAPI(prompt, apiKey, 'gemini-2.5-flash-lite', 2, 1500, generationConfigOverride);
      } catch (liteErr) {
        console.error(`❌ [Gemini API] lite 모델도 실패: ${liteErr.message}`);
        throw new Error(`프롬프트가 너무 크거나 복잡합니다. 데이터 범위를 줄여주세요. (원본 에러: ${err.message})`);
      }
    }

    console.error(`❌ [Gemini API] 최종 실패: ${err.message}`);
    throw err;
  }
}

/**
 * Gemini API를 사용하여 구조화된 JSON 생성 (리포트 AI 분석 등)
 * @param {string} prompt - 생성할 내용에 대한 프롬프트
 * @param {object} responseSchema - JSON 스키마 (OBJECT 타입)
 * @param {string} apiKey - Gemini API 키
 * @param {string} selectedAiModel - 사용할 모델
 * @param {number} retries - 재시도 횟수
 * @param {number} delay - 재시도 대기 시간 (ms)
 * @returns {Promise<object>} 생성된 JSON 객체
 */
export async function callGeminiJsonAPI(prompt, responseSchema, apiKey, selectedAiModel = 'gemini-2.5-flash-lite', retries = 3, delay = 1500) {
  const model = MODEL_MAP[selectedAiModel] || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: responseSchema,
    maxOutputTokens: 2000,
    temperature: 0.7,
    topP: 0.85
  };

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || res.statusText;

      if ((res.status === 404 || res.status === 400) && /model/i.test(msg)) {
        throw new Error(`모델/버전 불일치: ${msg}`);
      }
      if (res.status === 401 || res.status === 403) {
        console.error(`❌ [Gemini JSON API] 403/401 상세 오류:`, body);
        const detailedMsg = msg || 'API 키 권한 부족';
        throw new Error(`API 키 오류 (${res.status}): ${detailedMsg}\n\n가능한 원인:\n1. API 키에 Generative Language API 권한 미부여\n2. API 키 도메인 제한 설정 확인 필요\n3. API 키 만료 또는 비활성화\n4. 사용량 초과 (무료: 분당 15req, 일당 1500req)`);
      }
      if (res.status === 429) {
        throw new Error(`API 할당량 초과 (429)`);
      }
      if (res.status >= 500) {
        throw new Error(`서버 오류 (${res.status})`);
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      console.error('❌ [Gemini JSON API] JSON 파싱 실패:', raw);
      throw new Error('API 응답 JSON 파싱 실패');
    }
  } catch (err) {
    // 재시도 조건: 429(할당량) 또는 서버 오류(503 포함)
    const is503 = String(err.message).includes('503');
    const shouldRetry = retries > 0 && (
      String(err.message).includes('429') ||
      /^서버 오류/.test(String(err.message))
    );

    if (shouldRetry) {
      const retryDelay = is503 ? delay * 2.5 : delay;
      const retryDelaySeconds = (retryDelay / 1000).toFixed(1);

      console.warn(`⚠️ [Gemini JSON API] ${err.message} - ${retryDelaySeconds}초 후 재시도 (남은 횟수: ${retries})`);

      await new Promise((r) => setTimeout(r, retryDelay));
      return callGeminiJsonAPI(prompt, responseSchema, apiKey, selectedAiModel, retries - 1, delay * 1.8);
    }

    // 503 재시도 모두 실패 시, flash 모델이었다면 lite로 다운그레이드 시도
    if (is503 && selectedAiModel === 'gemini-2.5-flash') {
      console.warn(`⚠️ [Gemini JSON API] 503 에러 지속 → gemini-2.5-flash-lite로 자동 전환 시도`);
      try {
        return await callGeminiJsonAPI(prompt, responseSchema, apiKey, 'gemini-2.5-flash-lite', 2, 1500);
      } catch (liteErr) {
        console.error(`❌ [Gemini JSON API] lite 모델도 실패: ${liteErr.message}`);
        throw new Error(`프롬프트가 너무 크거나 복잡합니다. 데이터 범위를 줄여주세요. (원본 에러: ${err.message})`);
      }
    }

    console.error(`❌ [Gemini JSON API] 최종 실패: ${err.message}`);
    throw err;
  }
}

/**
 * Gemini API를 사용하여 암기팁 생성 (Text 모드)
 * - Flash 모델의 503 오류 방지를 위해 JSON 스키마를 제거하고 순수 텍스트로 요청
 * @param {string} prompt - 암기팁 생성 프롬프트
 * @param {string} apiKey - Gemini API 키
 * @param {string} selectedAiModel - 사용할 모델
 * @param {number} retries - 재시도 횟수
 * @param {number} delay - 재시도 대기 시간 (ms)
 * @returns {Promise<string>} 생성된 암기팁 문자열
 */
export async function callGeminiTipAPI(prompt, apiKey, selectedAiModel = 'gemini-2.5-flash', retries = 2, delay = 800) {
  const model = MODEL_MAP[selectedAiModel] || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // 핵심 변경: JSON 스키마를 제거하고 Plain Text로 요청
  const generationConfig = {
    responseMimeType: 'text/plain', // JSON 아님!
    maxOutputTokens: 800,           // 길이 제한으로 타임아웃 방지
    temperature: 0.8                // 창의성을 위해 약간 높게 설정
  };

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || res.statusText;

      // 재시도 로직 (503 포함)
      if ((res.status === 429 || res.status >= 500) && retries > 0) {
        console.warn(`⚠️ [Tip API] ${res.status} 오류 - 재시도...`);
        await new Promise(r => setTimeout(r, delay));
        // 재시도 시에도 원래 선택한 모델 유지
        return callGeminiTipAPI(prompt, apiKey, selectedAiModel, retries - 1, delay * 1.5);
      }

      if ((res.status === 404 || res.status === 400) && /model/i.test(msg)) {
        throw new Error(`모델/버전 불일치: ${msg}`);
      }
      if (res.status === 401 || res.status === 403) {
        console.error(`❌ [Gemini Tip API] 403/401 상세 오류:`, body);
        const detailedMsg = msg || 'API 키 권한 부족';
        throw new Error(`API 키 오류 (${res.status}): ${detailedMsg}`);
      }
      if (res.status === 429) {
        throw new Error(`API 할당량 초과 (429)`);
      }
      if (res.status >= 500) {
        throw new Error(`서버 오류 (${res.status})`);
      }
      throw new Error(msg);
    }

    const data = await res.json();

    // [디버깅용] 전체 응답 로그 (안전성 필터 등 차단 사유 확인)
    console.log('📋 [Tip API] Gemini 응답:', JSON.stringify(data, null, 2));

    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    // 텍스트가 없으면 차단 사유 확인 후 에러 발생
    if (!text) {
      const finishReason = candidate?.finishReason || 'UNKNOWN';
      const safetyRatings = candidate?.safetyRatings || [];

      console.warn(`⚠️ [Tip API] AI 생성 실패 - finishReason: ${finishReason}`);
      console.warn(`⚠️ [Tip API] 안전성 등급:`, safetyRatings);

      // 차단 사유별 메시지
      let errorMessage = 'AI가 암기팁을 생성하지 못했습니다.';

      if (finishReason === 'SAFETY') {
        errorMessage = '안전성 필터에 의해 차단되었습니다. 문제 내용이나 암기팁 모드를 확인해주세요.';
      } else if (finishReason === 'RECITATION') {
        errorMessage = '저작권 보호 자료와 유사하여 생성이 차단되었습니다.';
      } else if (finishReason === 'MAX_TOKENS') {
        errorMessage = '생성 토큰 제한 초과. 문제가 너무 깁니다.';
      } else if (finishReason === 'OTHER') {
        errorMessage = '알 수 없는 이유로 생성이 차단되었습니다.';
      }

      throw new Error(`${errorMessage} (사유: ${finishReason})`);
    }

    return text.trim();

  } catch (err) {
    // 503 에러이고 flash 모델이었다면 lite로 다운그레이드 시도
    const is503 = String(err.message).includes('503') || String(err.message).includes('서버 오류');
    if (is503 && selectedAiModel === 'gemini-2.5-flash' && retries === 0) {
      console.warn(`⚠️ [Tip API] Flash 모델 503 에러 → lite 모델로 전환 시도`);
      try {
        return await callGeminiTipAPI(prompt, apiKey, 'gemini-2.5-flash-lite', 2, 800);
      } catch (liteErr) {
        console.error(`❌ [Tip API] lite 모델도 실패: ${liteErr.message}`);
      }
    }

    console.error('Tip API Error:', err);
    throw err;
  }
}
