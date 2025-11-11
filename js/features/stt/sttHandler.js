import { getElements, getSttProvider, getGoogleSttKey } from '../../core/stateManager.js';
import { showToast } from '../../ui/domUtils.js';
import { getBoostKeywords } from './sttVocabulary.js';
import { transcribeGoogle } from '../../services/googleSttApi.js';
import * as WebSpeechApi from '../../services/webSpeechApi.js';

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null; // 1초마다 UI 업데이트용 interval
let recordingTimeout = null; // 60초 자동 중지용 timeout
let recordingSeconds = 0; // 현재 녹음 시간 (초)

// 마이크 아이콘 (SVG Path)
const micIcon = '<svg id="record-icon-mic" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 10-2 0 7.001 7.001 0 006 6.93V17H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07z" clip-rule="evenodd" /></svg>';
// 정지 아이콘 (SVG Path)
const stopIcon = '<svg id="record-icon-stop" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 4a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>';

/**
 * 시간을 MM:SS 형식으로 포맷
 * @param {number} seconds - 초
 * @returns {string} "0:05", "1:23" 형식
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 녹음 UI 타이머 업데이트 (1초마다 호출됨)
 */
function updateRecordingTimer() {
  recordingSeconds++;
  const el = getElements();
  if (el && el.recordBtn) {
    const timeText = formatTime(recordingSeconds);
    el.recordBtn.innerHTML = `${stopIcon} <span id="record-btn-text">녹음 중지 (${timeText})</span>`;
  }
}

/**
 * 타이머 정리 (녹음 중지 시 호출)
 */
function clearRecordingTimers() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }
  recordingSeconds = 0;
}

/**
 * 녹음 중지 처리 (사용자가 직접 중지하거나 60초 자동 중지)
 */
function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    clearRecordingTimers();
    // onstop 이벤트 핸들러가 transcribeAudio()를 자동 호출
  }
}

/**
 * Web Speech API 녹음 처리 (실시간 스트리밍)
 */
function handleWebSpeechRecording() {
  if (!WebSpeechApi.isWebSpeechSupported()) {
    showToast('Web Speech API를 지원하지 않는 브라우저입니다. Chrome 또는 Edge를 사용해주세요.', 'error');
    return;
  }

  if (isRecording) {
    // 중지
    console.log('[Web Speech] 사용자가 중지 요청');
    WebSpeechApi.stopRecognition();
    isRecording = false;
    clearRecordingTimers();
    setButtonState('idle');
    showToast('음성 인식 완료');
  } else {
    // 시작
    console.log('[Web Speech] 음성 인식 시작');
    isRecording = true;
    recordingSeconds = 0;
    setButtonState('recording');

    // 타이머 시작
    recordingTimer = setInterval(updateRecordingTimer, 1000);

    // 55초 자동 중지
    recordingTimeout = setTimeout(() => {
      console.log('⏱️ 55초 자동 중지');
      showToast('최대 녹음 시간에 도달하여 자동으로 중지되었습니다.', 'warn');
      WebSpeechApi.stopRecognition();
      isRecording = false;
      clearRecordingTimers();
      setButtonState('idle');
    }, 55000);

    const el = getElements();
    const keywords = getBoostKeywords();

    // 실시간 인식 시작
    WebSpeechApi.startRecognition(
      // onResult 콜백
      (result) => {
        if (el.userAnswer) {
          // interim은 회색으로 표시, final은 검정으로 확정
          if (result.isFinal && result.final) {
            // final 결과가 왔을 때 텍스트 업데이트
            const currentText = el.userAnswer.value.trim();
            const newText = currentText ? `${currentText} ${result.final}` : result.final;
            el.userAnswer.value = newText;
            console.log('[Web Speech] Final added:', result.final);
          } else if (result.interim) {
            // interim 결과를 placeholder로 표시 (선택사항)
            console.log('[Web Speech] Interim:', result.interim);
          }
        }
      },
      // onError 콜백
      (error) => {
        console.error('[Web Speech] Error:', error);
        showToast(error.message, 'error');
        isRecording = false;
        clearRecordingTimers();
        setButtonState('idle');
      },
      keywords
    );
  }
}

/**
 * 버튼 UI 상태 업데이트
 * @param {'idle' | 'recording' | 'processing'} state
 */
function setButtonState(state) {
  const el = getElements();
  if (!el || !el.recordBtn) return;

  el.recordBtn.disabled = (state === 'processing');

  switch (state) {
    case 'recording':
      el.recordBtn.classList.add('bg-red-600', 'hover:bg-red-700');
      el.recordBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      el.recordBtn.innerHTML = `${stopIcon} <span id="record-btn-text">녹음 중지 (${formatTime(recordingSeconds)})</span>`;
      break;
    case 'processing':
      el.recordBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'bg-blue-600', 'hover:bg-blue-700');
      el.recordBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
      el.recordBtn.innerHTML = `${micIcon} <span id="record-btn-text">처리 중...</span>`;
      break;
    case 'idle':
    default:
      el.recordBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'bg-gray-400', 'cursor-not-allowed');
      el.recordBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      el.recordBtn.innerHTML = `${micIcon} <span id="record-btn-text">음성 입력</span>`;
      break;
  }
}

/**
 * 녹음 완료 후 오디오 변환
 */
async function transcribeAudio() {
  setButtonState('processing');
  const provider = getSttProvider();
  const keywords = getBoostKeywords(); // Task 3에서 생성된 키워드 가져오기

  // MediaRecorder의 실제 MIME 타입 사용
  const actualMimeType = mediaRecorder?.mimeType || 'audio/webm;codecs=opus';
  const audioBlob = new Blob(audioChunks, { type: actualMimeType });

  console.log('=== STT Transcription Start ===');
  console.log('Provider:', provider);
  console.log('Audio blob size:', audioBlob.size, 'bytes');
  console.log('Audio blob type:', audioBlob.type);
  console.log('Keywords count:', keywords.length);

  try {
    let transcribedText = '';

    if (provider === 'google') {
      const apiKey = getGoogleSttKey();
      console.log('Google API key length:', apiKey.length);
      console.log('Calling Google STT API...');
      transcribedText = await transcribeGoogle(audioBlob, apiKey, keywords);
      console.log('Google STT result:', transcribedText);
    }

    // 텍스트박스에 결과 삽입
    const el = getElements();
    if (el.userAnswer) {
      el.userAnswer.value = transcribedText;
    }

    console.log('=== STT Transcription Success ===');
    showToast('음성 인식 완료');

  } catch (error) {
    console.error('=== STT Transcription Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);

    // 더 자세한 에러 메시지
    let userMessage = '음성 인식 실패';

    if (error.message.includes('fetch')) {
      userMessage = 'API 호출 실패: 네트워크 또는 CORS 문제일 수 있습니다.';
    } else if (error.message.includes('API Key') || error.message.includes('401') || error.message.includes('403')) {
      userMessage = 'API 키 인증 실패: API 키를 확인해주세요.';
    } else if (error.message.includes('400')) {
      userMessage = '잘못된 요청: 오디오 형식이나 API 파라미터를 확인해주세요.';
    } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      userMessage = 'API 서버 오류: 잠시 후 다시 시도해주세요.';
    }

    const debugInfo = `\n\n[디버그]\nProvider: ${provider}\nError: ${error.name}\nMessage: ${error.message}`;
    showToast(userMessage + debugInfo, 'error');
  } finally {
    setButtonState('idle');
  }
}

/**
 * 마이크 버튼 클릭 핸들러
 */
async function handleRecordClick() {
  const provider = getSttProvider();
  if (provider === 'none') {
    showToast('음성 입력 기능을 사용하려면 설정에서 STT 공급자를 선택하세요.', 'warn');
    return;
  }

  // Web Speech API 모드
  if (provider === 'webspeech') {
    handleWebSpeechRecording();
    return;
  }

  // Google STT 모드 - API 키 확인
  const googleKey = getGoogleSttKey();
  if (provider === 'google' && !googleKey) {
    showToast('STT API 키를 설정에서 입력해주세요.', 'warn');
    if (typeof window.openSettingsModal === 'function') {
      window.openSettingsModal(); // 설정 모달 열기
    }
    return;
  }

  if (isRecording) {
    // 녹음 중지 (사용자가 직접 중지)
    stopRecording();
  } else {
    // 녹음 시작 (Google STT)
    try {
      // HTTPS 체크 (localhost는 예외)
      const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isSecure) {
        showToast('음성 입력은 HTTPS 환경에서만 사용 가능합니다.', 'error');
        console.error('getUserMedia requires HTTPS');
        return;
      }

      // MediaDevices API 지원 체크
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('이 브라우저는 음성 입력을 지원하지 않습니다.', 'error');
        console.error('MediaDevices API not supported');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // MediaRecorder 지원 체크
      if (!window.MediaRecorder) {
        showToast('이 브라우저는 음성 녹음을 지원하지 않습니다.', 'error');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // 지원되는 MIME 타입 확인 (Google STT 호환성 고려)
      // MP4 + Opus 조합은 Google STT가 지원 안 함 - WebM + Opus 사용
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // 기본값 사용
        }
      }

      console.log('🎙️ Using MIME type:', mimeType);

      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
          console.log('📦 Data available:', e.data.size, 'bytes (fires once on stop)');
        }
      };

      mediaRecorder.onstop = () => {
        // 스트림 정리
        stream.getTracks().forEach(track => track.stop());
        clearRecordingTimers(); // 타이머 정리
        console.log('🛑 Recording stopped, total chunks:', audioChunks.length);
        console.log('🛑 Final MIME type:', mediaRecorder.mimeType);
        transcribeAudio();
      };

      // timeslice 제거 - MP4는 단일 파일로 생성해도 duration 메타데이터 정확함
      // 조각 재결합(re-muxing) 오버헤드 제거로 처리 속도 대폭 개선
      mediaRecorder.start();
      isRecording = true;
      recordingSeconds = 0; // 타이머 초기화
      setButtonState('recording');

      // 1초마다 UI 업데이트 (타이머 표시)
      recordingTimer = setInterval(updateRecordingTimer, 1000);

      // 55초 후 자동 중지 (API 제약으로 인한 필수 기능 - 60초 초과 시 오류)
      recordingTimeout = setTimeout(() => {
        console.log('⏱️ 55초 자동 중지 (API 제한 대비)');
        showToast('최대 녹음 시간에 도달하여 자동으로 중지되었습니다.', 'warn');
        stopRecording();
      }, 55000); // 55초 = 55000ms (MP4 포맷으로 duration 메타데이터 정확성 개선)

    } catch (err) {
      console.error('마이크 접근 실패:', err);
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('User agent:', navigator.userAgent);

      let errorMessage = '마이크 접근에 실패했습니다.';

      // iOS Chrome 특별 처리
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = /CriOS/.test(navigator.userAgent);

      if (isIOS && isChrome) {
        errorMessage = 'iOS Chrome에서는 음성 입력이 제한될 수 있습니다. Safari 브라우저를 사용해주세요.';
        console.warn('iOS Chrome detected - getUserMedia may be limited');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = '마이크가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage = '마이크 설정이 지원되지 않습니다.';
      } else if (err.name === 'TypeError') {
        errorMessage = 'HTTPS 환경이 필요합니다. (http://에서는 사용 불가)';
      } else if (err.name === 'SecurityError') {
        errorMessage = '보안 정책으로 인해 마이크 접근이 차단되었습니다.';
      }

      // 상세 에러 정보를 토스트에 포함 (디버깅용)
      const debugInfo = `\n(디버그: ${err.name} - ${err.message})`;
      showToast(errorMessage + debugInfo, 'error');
      clearRecordingTimers(); // 에러 발생 시 타이머 정리
      setButtonState('idle');
    }
  }
}

/**
 * STT 이벤트 리스너 초기화
 */
export function initSttListeners() {
  const el = getElements();
  el.recordBtn?.addEventListener('click', handleRecordClick);
  console.log('✅ STT 이벤트 리스너 초기화 완료');
}
