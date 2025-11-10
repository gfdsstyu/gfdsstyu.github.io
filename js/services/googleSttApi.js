/**
 * Google Cloud STT API 호출
 * @param {Blob} audioBlob - 오디오 데이터
 * @param {string} apiKey - Google STT API 키
 * @param {Array<string>} boostKeywords - 인식률 향상을 위한 힌트 단어
 * @returns {Promise<string>} 인식된 텍스트
 */
export async function transcribeGoogle(audioBlob, apiKey, boostKeywords) {
  const API_URL = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

  // Blob을 Base64 문자열로 변환
  const reader = new FileReader();
  const base64Audio = await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result.split(',')[1]); // Base64 데이터만 추출
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const body = {
    config: {
      encoding: 'WEBM_OPUS', // MediaRecorder 기본값 (브라우저 호환성 확인 필요)
      sampleRateHertz: 48000, // 브라우저 MediaRecorder 기본값일 수 있음
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

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Google STT Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  if (data.results && data.results[0] && data.results[0].alternatives[0]) {
    return data.results[0].alternatives[0].transcript;
  }
  return ''; // 인식 실패
}
