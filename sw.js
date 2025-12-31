/**
 * Service Worker - Gamlini RAG 시스템
 *
 * 기능:
 * 1. 벡터 파일 캐싱 (오프라인 지원)
 * 2. 재방문 시 즉시 로드 (0초)
 * 3. 백그라운드 업데이트
 */

const CACHE_NAME = 'gamlini-rag-v1';
const VECTOR_FILE = '/public/data/vectors.json';
const RAG_SERVICE = '/js/services/ragService.js';

// 캐시할 리소스 목록
const CACHE_URLS = [
  VECTOR_FILE,
  RAG_SERVICE
];

/**
 * Service Worker 설치 이벤트
 * 초기 캐싱 수행
 */
self.addEventListener('install', (event) => {
  console.log('[SW] 설치 중...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 캐시 생성 완료');
      // 벡터 파일은 용량이 크므로 설치 시 캐싱하지 않음
      // 첫 요청 시 캐싱
      return cache.addAll([RAG_SERVICE]);
    })
  );

  // 즉시 활성화
  self.skipWaiting();
});

/**
 * Service Worker 활성화 이벤트
 * 이전 캐시 정리
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화 중...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // 즉시 클라이언트 제어
  return self.clients.claim();
});

/**
 * Fetch 이벤트
 * 캐시 우선 전략 (Cache First, Network Fallback)
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 벡터 파일 또는 RAG 서비스만 처리
  if (!url.pathname.includes('/public/data/') &&
      !url.pathname.includes('/js/services/ragService.js')) {
    return;
  }

  // 같은 origin인지 확인
  const isSameOrigin = url.origin === self.location.origin;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 캐시 히트 - 즉시 반환
      if (cachedResponse) {
        console.log('[SW] 캐시에서 반환:', url.pathname);

        // 백그라운드에서 네트워크 확인 후 캐시 업데이트 (same-origin만)
        if (isSameOrigin) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone()).catch(() => {
                  // 캐시 실패는 조용히 무시
                });
              });
            }
          }).catch(() => {
            // 네트워크 실패는 무시 (오프라인 상황)
          });
        }

        return cachedResponse;
      }

      // 캐시 미스 - 네트워크에서 가져온 후 캐싱
      console.log('[SW] 네트워크에서 가져오는 중:', url.pathname);

      return fetch(event.request).then((networkResponse) => {
        // same-origin이고 유효한 응답만 캐싱
        if (!networkResponse || networkResponse.status !== 200 ||
            !isSameOrigin || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // 응답 복제 후 캐싱
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache).catch(() => {
            // 캐시 실패는 조용히 무시
          });
        });

        return networkResponse;
      });
    }).catch((error) => {
      console.error('[SW] Fetch 오류:', error);
      // 오류 발생 시 네트워크로 직접 요청
      return fetch(event.request);
    })
  );
});

/**
 * 메시지 이벤트
 * 클라이언트로부터 명령 수신
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] 캐시 삭제 완료');
      event.ports[0].postMessage({ success: true });
    });
  }
});
