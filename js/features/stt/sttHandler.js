import { getElements, getSttProvider, getGoogleSttKey, getClovaSttKey, getClovaSttInvokeUrl } from '../../core/stateManager.js';
import { showToast } from '../../ui/domUtils.js';
import { getBoostKeywords } from './sttVocabulary.js';
// [수정] transcribeGoogleLong 제거
import { transcribeGoogle } from '../../services/googleSttApi.js';
import { transcribeClova } from '../../services/clovaSttApi.js';

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = 0;
let recordTimerInterval = null; 
let forceStopTimer = null;      
let currentMimeType = ''; // [신규] 현재 사용 중인 MIME 타입 저장

// ... (SVG 아이콘 정의는 그대로) ...

/**
 * 버튼 UI 상태 업데이트
 * @param {'idle' | 'recording' | 'processing'} state 
 * @param {number} time - 녹음 시간(초)
 */
function setButtonState(state, time = 0) {
  const el = getElements();
  if (!el || !el.recordBtn) return;
  el.recordBtn.disabled = (state === 'processing');
  
  switch (state) {
    case 'recording':
      el.recordBtn.classList.add('bg-red-600', 'hover:bg-red-700');
      el.recordBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      const timeStr = `0:${String(time).padStart(2, '0')}`;
      el.recordBtn.innerHTML = `${stopIcon} <span id="record-btn-text">녹음 중지 (${timeStr})</span>`;
      break;
    case 'processing':
      // ... (processing 상태 UI)
      el.recordBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'bg-blue-600', 'hover:bg-blue-700');
      el.recordBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
      el.recordBtn.innerHTML = `${micIcon} <span id="record-btn-text">처리 중...</span>`;
      break;
    default: // 'idle'
      // ... (idle 상태 UI)
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
  const durationInSeconds = (Date.now() - recordingStartTime) / 1000;

  // [핵심] 55초 제한 (API의 60초 제한보다 5초 여유)
  if (durationInSeconds > 55) { 
    showToast(`녹음 시간이 55초를 초과했습니다. (${durationInSeconds.toFixed(0)}초) 55초 이내로 다시 시도해주세요.`, 'error');
    setButtonState('idle');
    audioChunks = []; // 데이터 비우기
    return; // API 호출 중단
  }
  
  setButtonState('processing');
  const provider = getSttProvider();
  const keywords = getBoostKeywords(); 
  
  // 현재 MIME 타입으로 Blob 생성
  const audioBlob = new Blob(audioChunks, { type: currentMimeType }); 
  
  console.log('=== STT Transcription Start ===');
  console.log(`Provider: ${provider}`);
  console.log(`Audio blob size: ${audioBlob.size} bytes`);
  console.log(`Audio blob type: ${audioBlob.type}`); // 실제 생성된 타입 로깅
  console.log(`Keywords count: ${keywords.length}`);
  console.log(`Actual audio duration: ${durationInSeconds.toFixed(2)} seconds`);

  try {
    let transcribedText = '';
    
    if (provider === 'google') {
      const apiKey = getGoogleSttKey();
      console.log(`Google API key length: ${apiKey.length}`);
      console.log('Calling Google STT API...');
      
      // [수정] MIME 타입 파라미터 제거 (API가 자동 감지하도록)
      transcribedText = await transcribeGoogle(audioBlob, apiKey, keywords); 

    } else if (provider === 'clova') {
      // ... (Clova 로직) ...
    }
    
    const el = getElements();
    if (el.userAnswer) {
      el.userAnswer.value = transcribedText;
    }
    showToast('음성 인식 완료');
    console.log('=== STT Transcription Success ===');
    console.log(`Result: ${transcribedText.substring(0, 50)}...`);

  } catch (error) {
    console.error('=== STT Transcription Error ===');
    console.error(`Error name: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    console.error(`Full error:`, error);
    
    let userMessage = `음성 인식 실패: ${error.message}`;
    if (error.message.includes('400')) {
        userMessage = 'Google STT Error (400): 잘못된 요청 (오디오 형식 또는 API 키 제한 확인)';
    } else if (error.message.includes('401') || error.message.includes('403')) {
        userMessage = 'Google STT Error: API 키 인증 실패 (키를 확인하세요)';
    }
    showToast(userMessage, 'error');
  } finally {
    setButtonState('idle');
  }
}

/**
 * 모든 타이머 정리
 */
function clearAllTimers() {
  if (recordTimerInterval) {
    clearInterval(recordTimerInterval);
    recordTimerInterval = null;
  }
  if (forceStopTimer) {
    clearTimeout(forceStopTimer);
    forceStopTimer = null;
  }
}

/**
 * MediaRecorder 중지 시 호출되는 공통 핸들러
 */
function onRecordStop() {
  const durationInSeconds = (Date.now() - recordingStartTime) / 1000;
  console.log(`[STT] Recording stopped, total duration: ${durationInSeconds.toFixed(1)}s`);

  clearAllTimers();
  isRecording = false;

  // [수정] 55초 제한으로 변경
  if (durationInSeconds > 55.5) { // 0.5초 버퍼
    showToast(`녹음이 55초에 도달하여 자동 중지되었습니다. 55초 이내로 다시 시도해주세요.`, 'warn');
    setButtonState('idle');
    audioChunks = []; // 데이터 비우기
    return;
  }
  
  transcribeAudio();
}

/**
 * 마이크 버튼 클릭 핸들러
 */
async function handleRecordClick() {
  // ... (API 키 확인 로직은 동일) ...

  if (isRecording) {
    // [수동 중지]
    console.log('[STT] Manual stop.');
    mediaRecorder.stop(); // onRecordStop()이 자동으로 호출됨
  } else {
    // [녹음 시작]
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // [핵심 수정 1] audio/mp4를 최우선으로 시도
      const mimeTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      const bestMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!bestMimeType) {
          showToast('브라우저가 지원하는 녹음 형식을 찾을 수 없습니다.', 'error');
          return;
      }
      
      currentMimeType = bestMimeType; // MIME 타입 저장
      console.log(`[STT] Recording started. Using MIME type: ${currentMimeType}`);
      
      mediaRecorder = new MediaRecorder(stream, { mimeType: currentMimeType });
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
          // [핵심 수정 2] timeslice를 제거했으므로 이 이벤트는 onstop 직전에 한 번만 호출됨
          console.log(`[STT] Data available: ${e.data.size} bytes. (Fires once on stop)`);
          audioChunks.push(e.data);
      };
      mediaRecorder.onstop = onRecordStop; 

      // [핵심 수정 3] start()에서 timeslice 파라미터(1000)를 제거
      mediaRecorder.start(); 
      
      recordingStartTime = Date.now();
      isRecording = true;

      // 55초 강제 중지 타이머 (그대로 유지)
      forceStopTimer = setTimeout(() => {
        if (isRecording) {
          console.log('[STT] 55s timer triggered. Forcing stop.');
          mediaRecorder.stop();
        }
      }, 55000); // 55초

      // 1초 UI 업데이트 타이머 (그대로 유지)
      let seconds = 0;
      setButtonState('recording', seconds);
      recordTimerInterval = setInterval(() => {
        seconds++;
        if (isRecording) {
          if (seconds < 56) { // 55초까지 표시
            setButtonState('recording', seconds);
          }
        } else {
          clearInterval(recordTimerInterval);
        }
      }, 1000);

    } catch (err) {
      // ... (기존 에러 처리 로직) ...
      console.error('마이크 접근 실패:', err);
      // ... (더 상세한 에러 메시지)
      showToast(`마이크 접근 실패: ${err.message}`, 'error');
      setButtonState('idle');
      clearAllTimers();
    }
  }
}

/**
 * STT 이벤트 리스너 초기화
 */
export function initSttListeners() {
  const el = getElements();
  el.recordBtn?.addEventListener('click', handleRecordClick);
  console.log('✅ STT 이벤트 리스너 초기화 완료 (55초 제한, MP4 우선, Timeslice 제거)');
}
