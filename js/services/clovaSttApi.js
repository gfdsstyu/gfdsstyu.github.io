/**
 * Naver Clova Speech API 호출
 *
 * ⚠️ 중요: Clova Speech API는 CORS를 지원하지 않으므로 브라우저에서 직접 호출 불가
 * 해결 방법:
 * 1. API Gateway에서 CORS 설정 (https://gfdsstyu.github.io 허용)
 * 2. 서버 프록시를 통한 호출 (Cloudflare Workers, Vercel Functions 등)
 * 3. Google Cloud STT 사용 (브라우저 직접 호출 가능)
 *
 * @param {Blob} audioBlob - 오디오 데이터
 * @param {string} clientSecret - Clova Secret Key
 * @param {string} invokeUrl - Clova API Gateway Invoke URL
 * @param {Array<string>} boostKeywords - 인식률 향상을 위한 힌트 단어
 * @returns {Promise<string>} 인식된 텍스트
 */
export async function transcribeClova(audioBlob, clientSecret, invokeUrl, boostKeywords) {

  console.log('[Clova STT] API 호출 시작');
  console.log('[Clova STT] Invoke URL:', invokeUrl);

  // Clova는 boostings 객체를 JSON 문자열로 요구
  const boostings = JSON.stringify({
    words: boostKeywords.reduce((acc, word) => {
      acc[word] = 10; // 가중치 (예: 10)
      return acc;
    }, {})
  });

  // HTTP 헤더는 ISO-8859-1만 지원하므로 한글이 포함된 JSON을 Base64로 인코딩
  const boostingsBase64 = btoa(unescape(encodeURIComponent(boostings)));

  const headers = {
    'Content-Type': 'application/octet-stream', // 오디오 Blob을 직접 전송
    'X-CLOVA-API-KEY': clientSecret,
    'X-CLOVA-DOMAIN': 'TALK', // 일반 대화
    'X-CLOVA-BOOSTING': boostingsBase64 // Base64로 인코딩하여 전송
  };

  try {
    const response = await fetch(invokeUrl, {
      method: 'POST',
      headers: headers,
      body: audioBlob // Blob 객체를 body에 직접 전달
    });

    console.log('[Clova STT] Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Clova STT Error (${response.status}): ${error.message}`);
    }

    const data = await response.json();
    console.log('[Clova STT] 응답 데이터:', data);

    if (data.text) {
      return data.text;
    }
    return ''; // 인식 실패
  } catch (error) {
    console.error('[Clova STT] Fetch 실패:', error);

    // CORS 오류 특별 처리
    if (error.message.includes('fetch') || error.name === 'TypeError') {
      throw new Error('CORS 오류: Clova API는 브라우저에서 직접 호출할 수 없습니다. API Gateway에서 CORS 설정이 필요하거나 Google STT를 사용해주세요.');
    }

    throw error;
  }
}
