/**
 * @fileoverview 헤더 스크롤 제어
 * - 스크롤 시 헤더 자동 숨김/표시
 */

let lastScrollY = 0;
let ticking = false;
const SCROLL_THRESHOLD = 10; // 스크롤 감지 임계값 (픽셀)

/**
 * 스크롤 방향에 따라 헤더를 숨기거나 표시
 */
function updateHeaderVisibility() {
  const currentScrollY = window.scrollY;
  const header = document.getElementById('fixed-header');

  if (!header) return;

  // 스크롤이 최상단 근처일 때는 항상 헤더 표시
  if (currentScrollY < SCROLL_THRESHOLD) {
    header.classList.remove('header-hidden');
    header.classList.add('header-visible');
  }
  // 아래로 스크롤할 때 - 헤더 숨김
  else if (currentScrollY > lastScrollY && currentScrollY > 100) {
    header.classList.add('header-hidden');
    header.classList.remove('header-visible');
  }
  // 위로 스크롤할 때 - 헤더 표시
  else if (currentScrollY < lastScrollY) {
    header.classList.remove('header-hidden');
    header.classList.add('header-visible');
  }

  lastScrollY = currentScrollY;
  ticking = false;
}

/**
 * requestAnimationFrame을 사용한 스크롤 이벤트 최적화
 */
function onScroll() {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      updateHeaderVisibility();
    });
    ticking = true;
  }
}

/**
 * 헤더 스크롤 제어 초기화
 */
export function initHeaderScroll() {
  const header = document.getElementById('fixed-header');

  if (!header) {
    console.warn('⚠️ #fixed-header not found');
    return;
  }

  // 초기 상태 설정
  header.classList.add('header-visible');

  // 스크롤 이벤트 리스너 등록
  window.addEventListener('scroll', onScroll, { passive: true });

  console.log('✅ 헤더 스크롤 제어 초기화 완료');
}
