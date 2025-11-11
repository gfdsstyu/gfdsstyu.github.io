import { convertToWav } from '../utils/audioConverter.js';

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

  // MP4/AAC는 Google STT API에서 지원하지 않으므로 WAV로 변환
  const mimeType = audioBlob.type.toLowerCase();
  let processedBlob = audioBlob;
  let sampleRate = null;

  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) {
    console.log('[Google STT] MP4/AAC detected - converting to WAV for compatibility');
    const converted = await convertToWav(audioBlob);
    processedBlob = converted.blob;
    sampleRate = converted.sampleRate;
    console.log('[Google STT] Conversion complete - WAV size:', processedBlob.size, 'bytes, sample rate:', sampleRate, 'Hz');
  }

  // Blob을 Base64 문자열로 변환
  const reader = new FileReader();
  const base64Audio = await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result.split(',')[1]); // Base64 데이터만 추출
    reader.onerror = reject;
    reader.readAsDataURL(processedBlob);
  });

  console.log('[Google STT] Base64 인코딩 완료, length:', base64Audio.length);

  // encoding 타입 결정
  const config = {
    languageCode: 'ko-KR',
    speechContexts: [{
      phrases: boostKeywords,
      boost: 15 // 중요도 (1-20)
    }]
  };

  // 오디오 포맷에 따라 encoding 결정
  const finalMimeType = processedBlob.type.toLowerCase();
  console.log('[Google STT] Final MIME type:', finalMimeType);

  if (finalMimeType.includes('wav')) {
    // WAV 포맷 (iOS에서 변환된 경우)
    config.encoding = 'LINEAR16';
    if (sampleRate) {
      config.sampleRateHertz = sampleRate;
    }
    console.log('[Google STT] Using LINEAR16 encoding for WAV, sample rate:', sampleRate);
  } else if (mimeType.includes('opus')) {
    // WebM/MP4 + Opus 코덱
    config.encoding = 'OGG_OPUS';
    console.log('[Google STT] Using OGG_OPUS encoding for Opus codec');
  } else if (mimeType.includes('webm')) {
    // WebM (Opus 아닌 경우)
    console.log('[Google STT] WebM format, using auto-detection');
  } else {
    console.log('[Google STT] Unknown format:', finalMimeType, '- using auto-detection');
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
