import { getElements, getSttProvider, getGoogleSttKey, getClovaSttKey, getClovaSttInvokeUrl } from '../../core/stateManager.js';
import { showToast } from '../../ui/domUtils.js';
import { getBoostKeywords } from './sttVocabulary.js';
import { transcribeGoogle } from '../../services/googleSttApi.js';
import { transcribeClova } from '../../services/clovaSttApi.js';

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// 마이크 아이콘 (SVG Path)
const micIcon = '<svg id="record-icon-mic" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 10-2 0 7.001 7.001 0 006 6.93V17H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07z" clip-rule="evenodd" /></svg>';
// 정지 아이콘 (SVG Path)
const stopIcon = '<svg id="record-icon-stop" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 4a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>';

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
      el.recordBtn.innerHTML = `${stopIcon} <span id="record-btn-text">녹음 중지</span>`;
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
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' }); // 오디오 형식 지정

  try {
    let transcribedText = '';

    if (provider === 'google') {
      const apiKey = getGoogleSttKey();
      transcribedText = await transcribeGoogle(audioBlob, apiKey, keywords);
    } else if (provider === 'clova') {
      const clientSecret = getClovaSttKey();
      const invokeUrl = getClovaSttInvokeUrl();
      transcribedText = await transcribeClova(audioBlob, clientSecret, invokeUrl, keywords);
    }

    // 텍스트박스에 결과 삽입
    const el = getElements();
    if (el.userAnswer) {
      el.userAnswer.value = transcribedText;
    }
    showToast('음성 인식 완료');

  } catch (error) {
    console.error('STT Error:', error);
    showToast(`음성 인식 실패: ${error.message}`, 'error');
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

  // API 키 확인
  const googleKey = getGoogleSttKey();
  const clovaKey = getClovaSttKey();
  const clovaUrl = getClovaSttInvokeUrl();

  if ((provider === 'google' && !googleKey) || (provider === 'clova' && (!clovaKey || !clovaUrl))) {
    showToast('STT API 키를 설정에서 입력해주세요.', 'warn');
    if (typeof window.openSettingsModal === 'function') {
      window.openSettingsModal(); // 설정 모달 열기
    }
    return;
  }

  if (isRecording) {
    // 녹음 중지
    mediaRecorder.stop();
    isRecording = false;
    // onstop 이벤트 핸들러가 transcribeAudio()를 자동 호출
  } else {
    // 녹음 시작
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = transcribeAudio; // 녹음 중지 시 transcribeAudio 자동 호출

      mediaRecorder.start();
      isRecording = true;
      setButtonState('recording');

    } catch (err) {
      console.error('마이크 접근 실패:', err);
      showToast('마이크 접근에 실패했습니다. (권한 확인 필요)', 'error');
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
