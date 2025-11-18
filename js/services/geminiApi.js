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
  'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite'
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
 * @returns {Promise<string>} 생성된 텍스트
 */
export async function callGeminiTextAPI(prompt, apiKey, selectedAiModel = 'gemini-2.5-flash', retries = 3, delay = 1500) {
  const model = MODEL_MAP[selectedAiModel] || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
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
        throw new Error(`API 키 오류 (${res.status}): API 키를 확인하세요`);
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
    // 503 Service Unavailable은 일시적 서비스 과부하이므로 재시도 권장
    const is503 = String(err.message).includes('503');
    const shouldRetry = retries > 0 && (
      String(err.message).includes('429') ||
      /^서버 오류/.test(String(err.message))
    );

    if (shouldRetry) {
      // 503의 경우 더 긴 delay 사용 (서버 부하 감소 대기)
      const retryDelay = is503 ? delay * 2.5 : delay;
      await new Promise((r) => setTimeout(r, retryDelay));
      return callGeminiTextAPI(prompt, apiKey, selectedAiModel, retries - 1, delay * 1.8);
    }
    throw err;
  }
}
