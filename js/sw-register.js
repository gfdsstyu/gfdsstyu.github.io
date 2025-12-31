/**
 * Service Worker 등록 스크립트
 *
 * 사용법:
 * <script src="/js/sw-register.js"></script>
 */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] 등록 성공:', registration.scope);

        // 업데이트 확인
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('[SW] 새 버전 발견');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] 새 버전 설치 완료 - 페이지 새로고침 권장');

              // 사용자에게 알림 (선택 사항)
              if (confirm('새로운 버전이 있습니다. 페이지를 새로고침하시겠습니까?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('[SW] 등록 실패:', error);
      });

    // Service Worker 제어권 변경 감지
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] 제어권 변경 - 페이지 새로고침');
      window.location.reload();
    });
  });

  /**
   * 캐시 초기화 유틸리티 함수
   */
  window.clearRAGCache = async function() {
    if (!navigator.serviceWorker.controller) {
      console.warn('[SW] Service Worker가 활성화되지 않았습니다.');
      return false;
    }

    const messageChannel = new MessageChannel();

    return new Promise((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          console.log('[SW] 캐시 삭제 완료');
          resolve(true);
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  };
} else {
  console.warn('[SW] Service Worker를 지원하지 않는 브라우저입니다.');
}
