/**
 * Google Cloud STT API 호출
 * @param {Blob} audioBlob - 오디오 데이터
 * @param {string} apiKey - Google STT API 키
 * @param {Array<string>} boostKeywords - 인식률 향상을 위한 힌트 단어
 * @returns {Promise<string>} 인식된 텍스트
 */
export async function transcribeGoogle(audioBlob, apiKey, boostKeywords) {
  const API_URL = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

  console.log('[Google STT] API 호출 시작');
  console.log('[Google STT] Audio size:', audioBlob.size, 'bytes');
  console.log('[Google STT] Audio type:', audioBlob.type);

  // Blob을 Base64 문자열로 변환
  const reader = new FileReader();
  const base64Audio = await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result.split(',')[1]); // Base64 데이터만 추출
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  console.log('[Google STT] Base64 인코딩 완료, length:', base64Audio.length);

  const body = {
    config: {
      // encoding, sampleRateHertz 모두 제거 - Google이 완전히 자동 감지
      // 명시적으로 지정하면 Google이 duration을 잘못 계산하는 버그 있음
      languageCode: 'ko-KR',
      speechContexts: [{
        phrases: boostKeywords,
        boost: 15 // 중요도 (1-20)
      }]
    },
    audio: {
      content: base64Audio
    }
  };

  console.log('[Google STT] Fetch 시작...');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  console.log('[Google STT] Response status:', response.status);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[Google STT] API 오류:', error);
    throw new Error(`Google STT Error (${response.status}): ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  console.log('[Google STT] 응답 데이터:', data);

  if (data.results && data.results[0] && data.results[0].alternatives[0]) {
    return data.results[0].alternatives[0].transcript;
  }
  return ''; // 인식 실패
}
