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

// ============================================
// Drawer (Mobile Menu) Functions
// ============================================

/**
 * Open mobile drawer menu
 */
export function openDrawer() {
  const el = window.el;
  if (!el) return;

  el.drawerBackdrop?.classList.remove('hidden');
  el.leftDashboard?.classList.remove('hidden');
  el.leftDashboard?.classList.add('fixed', 'inset-0', 'z-[1100]', 'p-4', 'overflow-y-auto', 'bg-white', 'dark:bg-gray-900', 'relative');
  el.drawerClose?.classList.remove('hidden');
}

/**
 * Close mobile drawer menu
 */
export function closeDrawer() {
  const el = window.el;
  if (!el) return;

  el.drawerBackdrop?.classList.add('hidden');

  // 모바일에서만 hidden 추가 (데스크톱에서는 항상 보임)
  if (window.innerWidth < 1024) {
    el.leftDashboard?.classList.add('hidden');
  }

  el.leftDashboard?.classList.remove('fixed', 'inset-0', 'z-[1100]', 'p-4', 'overflow-y-auto', 'bg-white', 'dark:bg-gray-900', 'relative');
  el.drawerClose?.classList.add('hidden');
}

// ============================================
// Collapsible Sections (학습 범위 필터, 단원 네비게이터 접기/펼치기)
// ============================================

/**
 * 섹션 접기/펼치기 토글
 * @param {string} contentId - 컨텐츠 영역 ID
 * @param {string} iconId - 아이콘 ID
 * @param {string} storageKey - localStorage 키
 */
function toggleSection(contentId, iconId, storageKey) {
  const content = document.getElementById(contentId);
  const icon = document.getElementById(iconId);

  if (!content || !icon) return;

  const isCollapsed = content.classList.contains('hidden');

  if (isCollapsed) {
    // 펼치기
    content.classList.remove('hidden');
    icon.style.transform = 'rotate(0deg)';
    localStorage.setItem(storageKey, 'false');
  } else {
    // 접기
    content.classList.add('hidden');
    icon.style.transform = 'rotate(-90deg)';
    localStorage.setItem(storageKey, 'true');
  }
}

/**
 * 접을 수 있는 섹션 초기화
 */
export function initCollapsibleSections() {
  // 학습 범위 필터
  const sourceFilterToggle = document.getElementById('source-filter-toggle');
  const sourceFilterContent = document.getElementById('source-filter-side');
  const sourceFilterIcon = document.getElementById('source-filter-icon');

  // 단원 네비게이터
  const chapterNavToggle = document.getElementById('chapter-nav-toggle');
  const chapterNavContent = document.getElementById('explorer-chapters');
  const chapterNavIcon = document.getElementById('chapter-nav-icon');

  // 오늘의 통계
  const statsOverviewToggle = document.getElementById('stats-overview-toggle');
  const statsOverviewContent = document.getElementById('stats-overview');
  const statsOverviewIcon = document.getElementById('stats-overview-icon');

  // 오늘의 복습
  const reviewToggle = document.getElementById('review-toggle');
  const reviewContent = document.getElementById('review-content');
  const reviewIcon = document.getElementById('review-icon');

  // 문제 목록
  const problemListToggle = document.getElementById('problem-list-toggle');
  const problemListContent = document.getElementById('problem-list-content');
  const problemListIcon = document.getElementById('problem-list-icon');

  // 초기 상태 복원 (localStorage에서)
  const sourceFilterCollapsed = localStorage.getItem('sourceFilterCollapsed') === 'true';
  const chapterNavCollapsed = localStorage.getItem('chapterNavCollapsed') === 'true';
  const statsOverviewCollapsed = localStorage.getItem('statsOverviewCollapsed') === 'true';
  const reviewCollapsed = localStorage.getItem('reviewCollapsed') === 'true';
  const problemListCollapsed = localStorage.getItem('problemListCollapsed') === 'true';

  if (sourceFilterCollapsed && sourceFilterContent && sourceFilterIcon) {
    sourceFilterContent.classList.add('hidden');
    sourceFilterIcon.style.transform = 'rotate(-90deg)';
  }

  if (chapterNavCollapsed && chapterNavContent && chapterNavIcon) {
    chapterNavContent.classList.add('hidden');
    chapterNavIcon.style.transform = 'rotate(-90deg)';
  }

  if (statsOverviewCollapsed && statsOverviewContent && statsOverviewIcon) {
    statsOverviewContent.classList.add('hidden');
    statsOverviewIcon.style.transform = 'rotate(-90deg)';
  }

  if (reviewCollapsed && reviewContent && reviewIcon) {
    reviewContent.classList.add('hidden');
    reviewIcon.style.transform = 'rotate(-90deg)';
  }

  if (problemListCollapsed && problemListContent && problemListIcon) {
    problemListContent.classList.add('hidden');
    problemListIcon.style.transform = 'rotate(-90deg)';
  }

  // 이벤트 리스너 등록
  sourceFilterToggle?.addEventListener('click', () => {
    toggleSection('source-filter-side', 'source-filter-icon', 'sourceFilterCollapsed');
  });

  chapterNavToggle?.addEventListener('click', () => {
    toggleSection('explorer-chapters', 'chapter-nav-icon', 'chapterNavCollapsed');
  });

  statsOverviewToggle?.addEventListener('click', () => {
    toggleSection('stats-overview', 'stats-overview-icon', 'statsOverviewCollapsed');
  });

  reviewToggle?.addEventListener('click', () => {
    toggleSection('review-content', 'review-icon', 'reviewCollapsed');
  });

  problemListToggle?.addEventListener('click', () => {
    toggleSection('problem-list-content', 'problem-list-icon', 'problemListCollapsed');
  });
}

// ============================================
// 이벤트 리스너 초기화 (Phase 5.1)
// ============================================

/**
 * UI 관련 이벤트 리스너 초기화 (drawer, responsive)
 */
export function initUIListeners() {
  const el = window.el;
  if (!el) return;

  // Hamburger menu - open drawer
  el.hamburger?.addEventListener('click', openDrawer);

  // Drawer backdrop - close drawer
  el.drawerBackdrop?.addEventListener('click', closeDrawer);

  // Drawer close button - close drawer
  el.drawerClose?.addEventListener('click', closeDrawer);

  // Window resize - responsive drawer behavior
  window.addEventListener('resize', () => {
    const el = window.el;
    if (!el) return;

    if (window.innerWidth >= 1024) {
      // Desktop: show sidebar, hide drawer
      el.leftDashboard?.classList.remove('hidden');
      el.drawerBackdrop?.classList.add('hidden');
      document.body?.classList.remove('drawer-open');
      el.leftDashboard?.classList.remove('fixed', 'inset-0', 'z-[1100]', 'p-4', 'overflow-y-auto', 'bg-white', 'dark:bg-gray-900', 'relative');
      el.drawerClose?.classList.add('hidden');
    } else {
      // Mobile: hide sidebar
      el.leftDashboard?.classList.add('hidden');
    }
  });

  // 접을 수 있는 섹션 초기화
  initCollapsibleSections();
}
