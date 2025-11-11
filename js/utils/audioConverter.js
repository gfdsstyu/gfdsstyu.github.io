/**
 * 오디오 포맷 변환 유틸리티
 * iOS MP4/AAC를 WAV (LINEAR16)로 변환하여 Google STT API 호환성 확보
 */

/**
 * AudioBlob을 WAV 포맷으로 변환
 * @param {Blob} audioBlob - 원본 오디오 (MP4, WebM 등)
 * @returns {Promise<{blob: Blob, sampleRate: number}>} WAV blob과 샘플레이트
 */
export async function convertToWav(audioBlob) {
  console.log('[Audio Converter] 변환 시작:', audioBlob.type, audioBlob.size, 'bytes');

  // AudioContext 생성
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    // Blob을 ArrayBuffer로 변환
    const arrayBuffer = await audioBlob.arrayBuffer();
    console.log('[Audio Converter] ArrayBuffer 생성 완료');

    // 오디오 디코딩 (MP4, WebM 등 → PCM)
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('[Audio Converter] 디코딩 완료 - 채널:', audioBuffer.numberOfChannels, '샘플레이트:', audioBuffer.sampleRate, 'Hz');

    // 모노 채널로 변환 (Google STT는 모노 권장)
    const channelData = audioBuffer.numberOfChannels > 1
      ? mergeChannels(audioBuffer)
      : audioBuffer.getChannelData(0);

    // WAV 인코딩
    const wavBlob = encodeWav(channelData, audioBuffer.sampleRate);
    console.log('[Audio Converter] WAV 변환 완료:', wavBlob.size, 'bytes');

    return {
      blob: wavBlob,
      sampleRate: audioBuffer.sampleRate
    };
  } finally {
    // AudioContext 정리
    await audioContext.close();
  }
}

/**
 * 스테레오를 모노로 변환 (채널 평균)
 */
function mergeChannels(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const merged = new Float32Array(length);

  // 모든 채널의 평균 계산
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let channel = 0; channel < numberOfChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i];
    }
    merged[i] = sum / numberOfChannels;
  }

  return merged;
}

/**
 * Float32Array PCM 데이터를 WAV Blob로 인코딩
 * @param {Float32Array} samples - PCM 샘플 (-1.0 ~ 1.0)
 * @param {number} sampleRate - 샘플레이트 (Hz)
 * @returns {Blob} WAV 파일 Blob
 */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV 헤더 작성
  const numChannels = 1; // 모노
  const bitsPerSample = 16; // 16-bit PCM

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true); // 파일 크기 - 8
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // byte rate
  view.setUint16(32, numChannels * bitsPerSample / 8, true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true); // data size

  // PCM 샘플 데이터 (Float32 → Int16 변환)
  floatTo16BitPCM(view, 44, samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * DataView에 문자열 쓰기
 */
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Float32 샘플을 16-bit PCM으로 변환
 */
function floatTo16BitPCM(view, offset, samples) {
  for (let i = 0; i < samples.length; i++, offset += 2) {
    // Float (-1.0 ~ 1.0) → Int16 (-32768 ~ 32767)
    const s = Math.max(-1, Math.min(1, samples[i])); // clamp
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}
