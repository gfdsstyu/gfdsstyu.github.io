/**
 * @fileoverview 설정 관리 - API 키, 설정 모달, 다크모드, AI 모델 등
 */

import {
  getElements,
  getGeminiApiKey,
  setGeminiApiKey,
  getSelectedAiModel,
  setSelectedAiModel,
  getDarkMode,
  setDarkMode,
  getSttProvider,
  setSttProvider,
  getGoogleSttKey,
  setGoogleSttKey,
  saveSttSettings
} from '../../core/stateManager.js';
import { showToast, applyDarkMode } from '../../ui/domUtils.js';
import { loadExamDate, saveExamDate, updateDDayDisplay } from '../../core/storageManager.js';
import { closeReportModal } from '../report/reportCore.js';
import { updateSummary } from '../summary/summaryCore.js';

/**
 * API 모달 열기
 * @param {boolean} initial - 초기 설정 모드 (취소 버튼 숨김)
 */
export function openApiModal(initial = false) {
  const el = getElements();

  if (initial) {
    el.apiModalCancelBtn.classList.add('hidden');
  } else {
    el.apiModalCancelBtn.classList.remove('hidden');
  }

  el.apiModal.classList.remove('hidden');
  el.apiModal.classList.add('flex');
  el.apiModalInput.value = getGeminiApiKey() || '';
  el.apiModalRemember.checked = !!localStorage.getItem('geminiApiKey');

  setTimeout(() => el.apiModalInput.focus(), 0);
}

/**
 * API 모달 닫기
 */
export function closeApiModal() {
  const el = getElements();
  el.apiModal.classList.add('hidden');
  el.apiModal.classList.remove('flex');
}

/**
 * API 키 게이트 체크 (키가 없으면 모달 띄우기)
 */
export function ensureApiKeyGate() {
  if (!window.geminiApiKey && !getGeminiApiKey?.()) {
    openApiModal(true);
  }
}

/**
 * 설정 모달 열기
 */
export function openSettingsModal() {
  const el = getElements();

  el.settingsModal.classList.remove('hidden');
  el.settingsModal.classList.add('flex');

  if (el.aiModelSelect) {
    el.aiModelSelect.value = getSelectedAiModel();
  }
  if (el.darkModeSelect) {
    el.darkModeSelect.value = getDarkMode();
  }
  if (el.examDateInput) {
    el.examDateInput.value = loadExamDate();
  }

  // Task 3: 복습 기준 모드 초기값 로드
  const reviewModeSelect = document.getElementById('review-mode-select');
  if (reviewModeSelect) {
    reviewModeSelect.value = localStorage.getItem('reviewMode') || 'hlr';
  }

  // STT 설정 초기값 로드
  if (el.sttProviderSelect) {
    const currentProvider = getSttProvider();
    el.sttProviderSelect.value = currentProvider;
    el.googleSttKey.value = getGoogleSttKey();
    updateSttKeyVisibility(currentProvider);
  }
}

/**
 * 설정 모달 닫기
 */
export function closeSettingsModal() {
  const el = getElements();
  el.settingsModal.classList.add('hidden');
  el.settingsModal.classList.remove('flex');
}

/**
 * API 모달 이벤트 리스너 초기화
 */
export function initApiModalListeners() {
  const el = getElements();

  // API 키 저장 버튼
  el.apiModalSaveBtn.addEventListener('click', () => {
    const key = (el.apiModalInput.value || '').trim();

    if (!key) {
      showToast('API 키를 입력하세요.', 'error');
      el.apiModalInput.focus();
      return;
    }

    setGeminiApiKey(key);
    sessionStorage.setItem('geminiApiKey', key);

    if (el.apiModalRemember.checked) {
      localStorage.setItem('geminiApiKey', key);
    } else {
      localStorage.removeItem('geminiApiKey');
    }

    closeApiModal();
    showToast('API 키 저장 완료');
  });

  // API 모달 취소 버튼
  el.apiModalCancelBtn.addEventListener('click', closeApiModal);
}

/**
 * 설정 모달 이벤트 리스너 초기화
 */
export function initSettingsModalListeners() {
  const el = getElements();

  // 설정 모달 열기/닫기 버튼들
  el.settingsBtn.addEventListener('click', openSettingsModal);
  el.settingsCloseBtn.addEventListener('click', closeSettingsModal);
  el.settingsCloseBtnBottom.addEventListener('click', closeSettingsModal);

  // API 키 모달 열기 (설정에서)
  el.openApiKeyModalBtn?.addEventListener('click', () => {
    closeSettingsModal();
    openApiModal(false);
  });

  // AI 모델 변경
  el.aiModelSelect?.addEventListener('change', (e) => {
    const model = e.target.value;
    setSelectedAiModel(model);
    localStorage.setItem('aiModel', model);
    showToast(`AI 모델 변경: ${model}`);
  });

  // 다크모드 변경
  el.darkModeSelect?.addEventListener('change', (e) => {
    localStorage.setItem('darkMode', e.target.value);
    applyDarkMode();
    showToast('다크 모드 설정 변경됨');
  });

  // Task 3: 복습 기준 변경
  const reviewModeSelect = document.getElementById('review-mode-select');
  reviewModeSelect?.addEventListener('change', (e) => {
    const mode = e.target.value;
    localStorage.setItem('reviewMode', mode);
    showToast(`복습 기준 변경: ${mode === 'hlr' ? 'HLR 기반' : '시간 기반'}`);
  });

  // STT 공급자 변경
  el.sttProviderSelect?.addEventListener('change', (e) => {
    const provider = e.target.value;
    setSttProvider(provider);
    saveSttSettings();
    updateSttKeyVisibility(provider);
    showToast(`음성 엔진 변경: ${provider}`);
  });

  // Google STT 키 저장
  el.googleSttKey?.addEventListener('change', (e) => {
    setGoogleSttKey(e.target.value);
    saveSttSettings();
  });
}

/**
 * STT 키 입력 필드 가시성 관리 함수
 * @param {string} provider - 'none', 'google'
 */
function updateSttKeyVisibility(provider) {
  const el = getElements();
  if (el.sttGoogleSettings) {
    el.sttGoogleSettings.classList.toggle('hidden', provider !== 'google');
  }
}

/**
 * D-DAY 이벤트 리스너 초기화
 */
export function initDDayListeners() {
  const el = getElements();

  // 시험 날짜 저장 버튼
  el.saveExamDateBtn?.addEventListener('click', () => {
    const dateStr = el.examDateInput?.value;

    if (!dateStr) {
      showToast('날짜를 선택해주세요', 'warn');
      return;
    }

    saveExamDate(dateStr);
    updateDDayDisplay();
    showToast('시험 날짜가 저장되었습니다');
  });

  // D-DAY 표시 클릭 시 설정 모달 열기
  el.ddayDisplay?.addEventListener('click', () => {
    openSettingsModal();
  });
}

/**
 * 전역 Escape 키 핸들러 초기화
 */
export function initGlobalEscapeHandler() {
  const el = getElements();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Priority 1: Flashcard mode (handled separately in flashcard section)
      if (!el.flashcardArea?.classList.contains('hidden')) return;

      // Priority 2: Report modal
      if (!el.reportModal?.classList.contains('hidden')) {
        closeReportModal();
        return;
      }

      // Priority 3: Settings modal
      if (!el.settingsModal?.classList.contains('hidden')) {
        closeSettingsModal();
        return;
      }

      // Priority 4: API modal
      if (!el.apiModalCancelBtn?.classList.contains('hidden') &&
          !el.apiModal?.classList.contains('hidden')) {
        closeApiModal();
        return;
      }
    }
  });
}

/**
 * 설정 시스템 초기화 (모든 이벤트 리스너 등록)
 */
export function initSettings() {
  initApiModalListeners();
  initSettingsModalListeners();
  initDDayListeners();
  initGlobalEscapeHandler();

  console.log('✅ Settings 모듈 초기화 완료');
}

// ============================================
// 이벤트 리스너 초기화 (Phase 5.1)
// ============================================

/**
 * 설정 관련 이벤트 리스너 초기화 (필터 초기화, 학습 기록 초기화)
 */
export function initSettingsListeners() {
  // Access global state via window (NEVER import from stateManager)
  const el = window.el;
  if (!el) return;

  // Clear filter button
  el.clearFilterBtn?.addEventListener('click', () => {
    el.filterSelect.value = 'all';
    el.chapterSelect.value = '';

    // Reset source filter checkboxes
    el.sourceGroupFilter?.querySelectorAll('input.source-filter')?.forEach(cb => {
      cb.checked = true;
    });

    // Reset SOURCE_LS in localStorage
    const SOURCE_LS = window.SOURCE_LS || 'selectedSourceGroups';
    localStorage.setItem(SOURCE_LS, JSON.stringify(['basic', 'advanced', 'other']));

    // Reload quiz
    if (typeof window.reloadAndRefresh === 'function') {
      window.reloadAndRefresh();
    }

    // Show toast
    showToast('필터 해제: 모든 문제 표시');
  });

  // Reset scores button
  el.resetScoresBtn?.addEventListener('click', () => {
    if (!confirm('정말로 모든 학습 기록을 초기화하시겠습니까?')) {
      return;
    }

    // Reset questionScores
    window.questionScores = {};

    // Remove localStorage items
    localStorage.removeItem('auditQuizScores');
    localStorage.removeItem('schemaVersion');
    localStorage.removeItem('readSessions_v2');
    localStorage.removeItem('readStoreBackfilled_v2');

    // Update UI
    updateSummary();

    // Reload quiz if there's data
    const currentQuizData = window.currentQuizData || [];
    if (currentQuizData.length) {
      window.currentQuestionIndex = 0;
      if (typeof window.reloadAndRefresh === 'function') {
        window.reloadAndRefresh();
      }
    }

    // Refresh panels
    if (typeof window.refreshPanels === 'function') {
      window.refreshPanels();
    }

    // Show toast
    showToast('학습 기록 초기화 완료');
  });
}
