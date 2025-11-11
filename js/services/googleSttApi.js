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

  // encoding 타입 결정 (MP4는 명시 필요, WebM은 자동 감지)
  const config = {
    languageCode: 'ko-KR',
    speechContexts: [{
      phrases: boostKeywords,
      boost: 15 // 중요도 (1-20)
    }]
  };

  // MP4는 encoding 명시, WebM은 자동 감지가 더 정확
  if (audioBlob.type.includes('mp4')) {
    config.encoding = 'MP3'; // MP4 컨테이너의 오디오는 보통 MP3 또는 AAC
    console.log('[Google STT] MP4 format detected, using MP3 encoding');
  } else {
    console.log('[Google STT] WebM format, using auto-detection');
  }

  const body = {
    config: config,
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
