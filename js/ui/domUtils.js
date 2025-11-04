// ============================================
// 감린이 v4.0 - DOM 유틸리티 함수
// ============================================

import { el } from './elements.js';

/**
 * Toast 메시지 표시
 */
export function showToast(msg, type = 'info') {
  if (!el || !el.toast) return;

  const base = 'px-4 py-2 rounded shadow text-sm mb-2';
  const color = type === 'error'
    ? 'bg-red-600 text-white'
    : type === 'warn'
      ? 'bg-yellow-500 text-white'
      : 'bg-gray-900 text-white';

  el.toast.classList.remove('hidden');
  const item = document.createElement('div');
  item.className = `${base} ${color}`;
  item.textContent = msg;
  el.toast.appendChild(item);

  setTimeout(() => {
    item.remove();
    if (!el.toast.hasChildNodes()) {
      el.toast.classList.add('hidden');
    }
  }, 2500);
}

/**
 * 고정 헤더의 높이 반환
 */
export function getHeaderOffset() {
  return el?.fixedHeader?.getBoundingClientRect().height || 0;
}

/**
 * 부드러운 스크롤
 */
export function smoothScrollTo(y) {
  window.scrollTo({ top: y, behavior: 'smooth' });
}

/**
 * 엘리먼트의 절대 Y 위치 계산
 */
export function elmTop(e) {
  return e.getBoundingClientRect().top + window.pageYOffset;
}

/**
 * 다크 모드 적용
 */
export function applyDarkMode() {
  const mode = localStorage.getItem('darkMode') || 'system';

  if (el?.darkModeSelect) {
    el.darkModeSelect.value = mode;
  }

  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (mode === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // system
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return mode;
}

/**
 * 다크 모드 시스템 설정 변경 감지
 */
export function watchSystemDarkMode(currentMode) {
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentMode === 'system') {
        applyDarkMode();
      }
    });
  }
}

/**
 * 로딩 상태 설정 (버튼 등)
 */
export function setLoading(button, isLoading, loadingText = '처리중...') {
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}
