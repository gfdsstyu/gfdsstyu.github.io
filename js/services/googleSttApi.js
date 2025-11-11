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
  console.log(`[Google STT] Audio size: ${audioBlob.size} bytes`);
  console.log(`[Google STT] Audio type: ${audioBlob.type}`);

  // Blob을 Base64 문자열로 변환
  const reader = new FileReader();
  const base64Audio = await new Promise((resolve, reject) => {
    reader.onloadend = () => {
      const result = reader.result;
      console.log(`[Google STT] Base64 인코딩 완료, length: ${result.length}`);
      resolve(result.split(',')[1]); 
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const body = {
    config: {
      // [핵심 수정] encoding과 sampleRateHertz를 제거하고 자동 감지 사용
      // encoding: 'WEBM_OPUS',  // <-- 삭제
      // sampleRateHertz: 48000, // <-- 삭제
      
      // Google API가 오디오 헤더를 읽고 'MP4' 또는 'WEBM_OPUS'를 자동으로 감지하도록 함
      auto_decoding_config: {}, 

      languageCode: 'ko-KR', 
      speechContexts: [{
        phrases: boostKeywords,
        boost: 15 
      }],
      model: 'short', 
      maxAlternatives: 1, 
      profanityFilter: true, 
      enableAutomaticPunctuation: true, 
      enableSpokenPunctuation: true
    },
    audio: {
      content: base64Audio
    }
  };

  try {
    console.log('[Google STT] Fetch 시작...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log(`[Google STT] Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[Google STT] API 오류:', error); 
      
      if (response.status === 400 && error.error?.message.includes('Sync input too long')) {
         throw new Error('Google STT Error (400): API가 60초 이상으로 오인 (메타데이터 오류 가능성)');
      }
      if (response.status === 400) {
        throw new Error(`Google STT Error (400): 잘못된 요청 (오디오/파라미터 확인) - ${error.error?.message}`);
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Google STT Error (${response.status}): API 키 인증 실패`);
      }
      throw new Error(`Google STT Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('[Google STT] API 성공 응답:', data); 
    
    if (data.results && data.results[0] && data.results[0].alternatives[0]) {
      return data.results[0].alternatives[0].transcript;
    }
    return ''; // 인식 실패
  } catch (err) {
    console.error('[Google STT] Fetch 실패:', err);
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Google STT 네트워크 오류 (네트워크/방화벽 확인)');
    }
    throw err; 
  }
}
