# 추가 성능 향상 및 최적화 방안

## 현재 상태 (✅ 완료)

- ✅ 벡터 양자화: 53.68 MB → 8.05 MB (85% 감소)
- ✅ 기준서 번호 정확 매칭
- ✅ 하이브리드 검색 (벡터 + 키워드 + 품질)
- ✅ taskType 설정 (RETRIEVAL_DOCUMENT/QUERY)

---

## 추가 최적화 방안

### 1. 검색 성능 향상 ⚡

#### 1-1. 벡터 검색 조기 종료 (Early Termination)

**현재:** 모든 3,141개 문서와 유사도 계산
**개선:** 상위 N개 찾으면 조기 종료

```javascript
// ragService.js - search() 함수 개선
async search(query, topK = 5, options = {}) {
  // ... 기존 코드 ...

  // 옵션: 빠른 검색 모드
  if (options.fastMode) {
    // 타입 필터 먼저 적용 (검색 대상 축소)
    let candidates = this.vectors;
    if (options.types && options.types.length > 0) {
      candidates = candidates.filter(v => options.types.includes(v.metadata?.type));
    }

    // 상위 topK * 3개만 계산 (정확도 vs 속도 트레이드오프)
    const sampleSize = Math.min(candidates.length, topK * 10);
    candidates = candidates.slice(0, sampleSize);
  }
}
```

**예상 효과:** 검색 속도 50-70% 향상

---

#### 1-2. Web Worker를 통한 백그라운드 벡터 계산

**문제:** 대량 벡터 계산 시 UI 블로킹
**해결:** Web Worker로 별도 스레드 처리

```javascript
// js/workers/vectorWorker.js (신규 파일)
self.onmessage = function(e) {
  const { queryVector, vectors, options } = e.data;

  // 코사인 유사도 계산 (별도 스레드)
  const results = vectors.map(doc => ({
    ...doc,
    similarity: cosineSimilarity(queryVector, doc.vector)
  }));

  self.postMessage(results);
};

// ragService.js에서 사용
const worker = new Worker('/js/workers/vectorWorker.js');
worker.postMessage({ queryVector, vectors, options });
worker.onmessage = (e) => {
  const results = e.data;
  // 결과 처리
};
```

**예상 효과:** UI 반응성 100% 유지

---

### 2. 캐싱 전략 💾

#### 2-1. 쿼리 결과 캐싱 (In-Memory)

```javascript
class RAGService {
  constructor() {
    // ... 기존 코드 ...
    this.queryCache = new Map(); // LRU 캐시
    this.cacheMaxSize = 50;
  }

  async search(query, topK, options) {
    // 캐시 키 생성
    const cacheKey = JSON.stringify({ query, topK, options });

    // 캐시 확인
    if (this.queryCache.has(cacheKey)) {
      console.log('💨 캐시에서 결과 반환');
      return this.queryCache.get(cacheKey);
    }

    // 실제 검색
    const results = await this.performSearch(query, topK, options);

    // 캐시 저장 (LRU)
    this.addToCache(cacheKey, results);

    return results;
  }

  addToCache(key, value) {
    if (this.queryCache.size >= this.cacheMaxSize) {
      // 가장 오래된 항목 제거
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    this.queryCache.set(key, value);
  }
}
```

**예상 효과:** 반복 쿼리 99% 속도 향상

---

#### 2-2. 벡터 인덱싱 (초기 로드 시)

```javascript
class RAGService {
  async loadVectors() {
    // ... 기존 로드 코드 ...

    // 타입별 인덱스 생성
    this.indexByType = {
      audit: [],
      law: [],
      ethics: [],
      study: [],
      kam: [],
      exam: []
    };

    this.vectors.forEach((doc, idx) => {
      const type = doc.metadata?.type;
      if (type && this.indexByType[type]) {
        this.indexByType[type].push(idx);
      }
    });

    console.log('📑 타입별 인덱스 생성 완료');
  }

  async search(query, topK, options) {
    // 타입 필터 사용 시 인덱스 활용
    let candidateIndices = null;
    if (options.types && options.types.length > 0) {
      candidateIndices = new Set();
      options.types.forEach(type => {
        this.indexByType[type]?.forEach(idx => candidateIndices.add(idx));
      });
    }

    // 인덱스 기반 필터링 (O(n) → O(k))
    const candidates = candidateIndices
      ? Array.from(candidateIndices).map(idx => this.vectors[idx])
      : this.vectors;
  }
}
```

**예상 효과:** 타입 필터 검색 80% 속도 향상

---

### 3. 네트워크 최적화 🌐

#### 3-1. Service Worker + HTTP/2 Server Push

```javascript
// sw.js (Service Worker)
const CACHE_NAME = 'gamlini-rag-v1';
const VECTOR_URL = '/public/data/vectors.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(VECTOR_URL);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('vectors.json')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // 캐시 우선, 백그라운드 업데이트
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        });

        return response || fetchPromise;
      })
    );
  }
});
```

**예상 효과:**
- 두 번째 방문부터 즉시 로드 (0초)
- 오프라인 지원

---

#### 3-2. Brotli 압축 (Vercel/Netlify 설정)

```json
// vercel.json
{
  "headers": [
    {
      "source": "/public/data/(.*)",
      "headers": [
        {
          "key": "Content-Encoding",
          "value": "br"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**예상 효과:**
- gzip: 8 MB → ~2.5 MB
- brotli: 8 MB → **~1.8 MB** (추가 30% 감소)

---

### 4. 검색 알고리즘 개선 🔍

#### 4-1. 재순위화 (Re-ranking) with Cross-Encoder

**1단계:** 벡터 검색으로 상위 20개 추출
**2단계:** Cross-Encoder로 정확한 순위 재조정

```javascript
async searchWithReranking(query, topK = 5) {
  // 1단계: 빠른 벡터 검색 (상위 20개)
  const candidates = await this.search(query, topK * 4, { minSimilarity: 0.2 });

  // 2단계: 재순위화 (선택적 - API 호출 필요)
  if (candidates.length > topK) {
    const reranked = await this.rerankWithLLM(query, candidates);
    return reranked.slice(0, topK);
  }

  return candidates.slice(0, topK);
}

async rerankWithLLM(query, candidates) {
  // Gemini API로 재순위화 (선택적)
  // 비용 발생하므로 필요시에만 사용
}
```

---

#### 4-2. 쿼리 확장 (Query Expansion)

**전문 용어 동의어 사전 추가:**

```javascript
const ACCOUNTING_SYNONYMS = {
  '감사위험': ['감사위험', '중요한 왜곡표시 위험', 'RMM', '통제위험', '고유위험', '발견위험'],
  '독립성': ['독립성', '객관성', '공정성', '이해상충'],
  '중요성': ['중요성', '양적 중요성', '질적 중요성', 'materiality'],
  // ... 추가
};

function expandQuery(query) {
  let expandedTokens = query.split(/\s+/);

  Object.entries(ACCOUNTING_SYNONYMS).forEach(([key, synonyms]) => {
    if (query.includes(key)) {
      expandedTokens.push(...synonyms);
    }
  });

  return expandedTokens.join(' ');
}
```

**예상 효과:** 재현율(Recall) 20-30% 향상

---

#### 4-3. 하이브리드 가중치 자동 조정

```javascript
// 쿼리 타입에 따라 가중치 동적 조정
function getOptimalWeights(query) {
  // 기준서 번호 패턴이 있으면 키워드 가중치 증가
  if (/\d{3,4}-[A-Za-z]?\d+/.test(query)) {
    return { vector: 0.4, keyword: 0.5, quality: 0.1 };
  }

  // 짧은 쿼리 (1-2단어)는 키워드 중시
  if (query.split(/\s+/).length <= 2) {
    return { vector: 0.5, keyword: 0.4, quality: 0.1 };
  }

  // 긴 질문은 벡터 중시
  return { vector: 0.6, keyword: 0.3, quality: 0.1 };
}
```

---

### 5. UI/UX 개선 ✨

#### 5-1. 프로그레시브 로딩

```javascript
async loadVectorsProgressively() {
  console.log('📥 벡터 데이터 로드 시작...');

  // 1단계: 공식 문서만 먼저 로드 (audit, law, ethics)
  const officialVectors = await this.loadPartialVectors(['audit', 'law', 'ethics']);
  this.vectors = officialVectors;
  this.isPartiallyReady = true;
  console.log('✅ 공식 문서 로드 완료 (검색 가능)');

  // 2단계: 백그라운드에서 참고 자료 로드
  setTimeout(async () => {
    const allVectors = await this.loadAllVectors();
    this.vectors = allVectors;
    this.isInitialized = true;
    console.log('✅ 전체 문서 로드 완료');
  }, 100);
}
```

**예상 효과:** 체감 로딩 시간 50% 감소

---

#### 5-2. 스트리밍 검색 결과

```javascript
async *searchStreaming(query, topK = 5) {
  const queryVector = await this.getQueryEmbedding(query);

  // 배치 단위로 결과 반환 (실시간 UI 업데이트)
  const batchSize = 500;
  let tempResults = [];

  for (let i = 0; i < this.vectors.length; i += batchSize) {
    const batch = this.vectors.slice(i, i + batchSize);

    batch.forEach(doc => {
      const similarity = this.cosineSimilarity(queryVector, doc.vector);
      tempResults.push({ ...doc, similarity });
    });

    // 중간 결과 반환
    tempResults.sort((a, b) => b.similarity - a.similarity);
    yield tempResults.slice(0, topK);
  }

  // 최종 결과
  return tempResults.slice(0, topK);
}

// 사용 예시
for await (const partialResults of ragService.searchStreaming(query)) {
  updateUI(partialResults); // 실시간 UI 업데이트
}
```

---

### 6. 메모리 최적화 💾

#### 6-1. 벡터 지연 로딩 (Lazy Vector Loading)

```javascript
class CompactRAGService {
  async loadVectors() {
    // 벡터는 로드하지 않고 메타데이터만 로드
    const response = await fetch(this.vectorDataPath);
    const data = await response.json();

    // 메타데이터만 메모리에 유지
    this.metadata = data.vectors.map(v => v.metadata);

    // 벡터는 IndexedDB에 저장
    await this.storeVectorsInDB(data.vectors);

    console.log('💾 메타데이터만 메모리 로드, 벡터는 IndexedDB 저장');
  }

  async search(query, topK) {
    // 필요한 벡터만 IndexedDB에서 로드
    const queryVector = await this.getQueryEmbedding(query);

    // 배치 단위로 IndexedDB에서 가져오며 계산
    // 메모리 사용량: 8 MB → ~500 KB
  }
}
```

**예상 효과:** 메모리 사용량 95% 감소 (8 MB → 400 KB)

---

## 우선순위 제안

### 즉시 적용 가능 (높은 효과, 낮은 난이도)

1. **쿼리 결과 캐싱** - 10분 작업, 반복 쿼리 99% 향상
2. **타입별 인덱싱** - 20분 작업, 필터 검색 80% 향상
3. **하이브리드 가중치 자동 조정** - 15분 작업, 정확도 5-10% 향상

### 중기 적용 (중간 효과, 중간 난이도)

4. **Service Worker 캐싱** - 1시간 작업, 재방문 즉시 로드
5. **프로그레시브 로딩** - 1시간 작업, 체감 로딩 50% 향상
6. **쿼리 확장** - 2시간 작업, 재현율 20% 향상

### 장기 검토 (높은 효과, 높은 난이도)

7. **Web Worker** - 3시간 작업, UI 블로킹 제거
8. **벡터 지연 로딩** - 4시간 작업, 메모리 95% 절감
9. **재순위화** - API 비용 발생, 정확도 추가 향상

---

## 성능 비교표 (모든 최적화 적용 시)

| 항목 | 현재 | 최적화 후 |
|------|------|----------|
| 파일 크기 | 53.68 MB | **8.05 MB** |
| gzip 전송 | ~15 MB | **~2 MB** |
| 첫 로드 (4G) | 43초 | **~2초** |
| 재방문 로드 | 43초 | **0초 (캐시)** |
| 검색 속도 | 300-500ms | **50-100ms** |
| 메모리 사용 | 53 MB | **8 MB** (또는 400 KB) |
| 반복 쿼리 | 300ms | **<10ms (캐시)** |

---

## 구현 스크립트 생성

다음 명령어로 각 최적화를 적용할 수 있는 스크립트를 제공합니다:

```bash
# 캐싱 + 인덱싱 적용
npm run enhance:basic

# Service Worker 설정
npm run enhance:sw

# 전체 고급 최적화
npm run enhance:all
```
