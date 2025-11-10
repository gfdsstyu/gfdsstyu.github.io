/**
 * Naver Clova Speech API 호출
 * @param {Blob} audioBlob - 오디오 데이터
 * @param {string} clientSecret - Clova Secret Key
 * @param {string} invokeUrl - Clova API Gateway Invoke URL
 * @param {Array<string>} boostKeywords - 인식률 향상을 위한 힌트 단어
 * @returns {Promise<string>} 인식된 텍스트
 */
export async function transcribeClova(audioBlob, clientSecret, invokeUrl, boostKeywords) {

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

  const response = await fetch(invokeUrl, {
    method: 'POST',
    headers: headers,
    body: audioBlob // Blob 객체를 body에 직접 전달
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Clova STT Error: ${error.message}`);
  }

  const data = await response.json();
  if (data.text) {
    return data.text;
  }
  return ''; // 인식 실패
}
