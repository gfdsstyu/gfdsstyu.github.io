/**
 * Web Speech API (브라우저 내장)
 * - 완전 무료, API 키 불필요
 * - 실시간 스트리밍 인식
 * - Chrome/Edge에서 작동
 */

let recognition = null;
let isRecognizing = false;

/**
 * Web Speech API 지원 확인
 * @returns {boolean}
 */
export function isWebSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * 실시간 음성 인식 시작
 * @param {Function} onResult - 인식 결과 콜백 (interim, final 텍스트)
 * @param {Function} onError - 에러 콜백
 * @param {Array<string>} keywords - 힌트 키워드 (Web Speech API에서는 미지원)
 */
export function startRecognition(onResult, onError, keywords = []) {
  if (!isWebSpeechSupported()) {
    onError(new Error('Web Speech API를 지원하지 않는 브라우저입니다.'));
    return;
  }

  // SpeechRecognition 인스턴스 생성
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();

  // 설정
  recognition.lang = 'ko-KR'; // 한국어
  recognition.continuous = true; // 연속 인식
  recognition.interimResults = true; // 중간 결과 표시
  recognition.maxAlternatives = 1;

  console.log('[Web Speech] 인식 시작');

  // 결과 이벤트
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    // 모든 결과 처리
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
        console.log('[Web Speech] Final:', transcript);
      } else {
        interimTranscript += transcript;
        console.log('[Web Speech] Interim:', transcript);
      }
    }

    // 콜백 호출
    onResult({
      interim: interimTranscript,
      final: finalTranscript.trim(),
      isFinal: finalTranscript.length > 0
    });
  };

  // 에러 이벤트
  recognition.onerror = (event) => {
    console.error('[Web Speech] Error:', event.error);
    let errorMessage = '음성 인식 오류';

    switch (event.error) {
      case 'no-speech':
        errorMessage = '음성이 감지되지 않았습니다.';
        break;
      case 'audio-capture':
        errorMessage = '마이크를 사용할 수 없습니다.';
        break;
      case 'not-allowed':
        errorMessage = '마이크 권한이 거부되었습니다.';
        break;
      case 'network':
        errorMessage = '네트워크 오류가 발생했습니다.';
        break;
      case 'aborted':
        // 사용자가 중지한 경우 - 에러 아님
        return;
    }

    onError(new Error(errorMessage));
  };

  // 종료 이벤트 (자동 재시작 방지)
  recognition.onend = () => {
    console.log('[Web Speech] 인식 종료');
    isRecognizing = false;
  };

  // 시작
  try {
    recognition.start();
    isRecognizing = true;
  } catch (err) {
    console.error('[Web Speech] Start error:', err);
    onError(err);
  }
}

/**
 * 음성 인식 중지
 */
export function stopRecognition() {
  if (recognition && isRecognizing) {
    console.log('[Web Speech] 인식 중지 요청');
    recognition.stop();
    isRecognizing = false;
  }
}

/**
 * 인식 상태 확인
 * @returns {boolean}
 */
export function isRecognitionActive() {
  return isRecognizing;
}
