# 순환 의존성 상세 분석

**작성일**: 2025-11-08
**브랜치**: `claude/refactor-global-bridge-phase-5-011CUteDeiBPahXqdwr6aGce`

---

## 🎯 핵심 발견: 실제 순환 의존성은 1개

**좋은 소식**: 분석 결과, **진짜 순환 의존성은 단 1개**입니다.

```
quizCore.js ⇄ filterCore.js
```

나머지는 단방향 의존성이므로 순환이 아닙니다.

---

## 📊 의존성 그래프

### 1. **진짜 순환 의존성** 🔴

```
┌─────────────┐
│ quizCore.js │
└──────┬──────┘
       │
       │ window.getFilteredByUI() 호출 (2회)
       ↓
┌──────────────┐
│filterCore.js │
└──────┬───────┘
       │
       │ window.reloadAndRefresh() 호출 (4회)
       ↓
┌─────────────┐
│ quizCore.js │ ← 순환!
└─────────────┘
```

**영향도**:
- `quizCore.js` → `filterCore.js`: 2회 호출
- `filterCore.js` → `quizCore.js`: 4회 호출
- **총 6개의 순환 호출 지점**

**해결 필수**: ✅ 반드시 해결해야 함

---

### 2. **단방향 의존성** 🟢 (순환 아님)

#### A. `summaryCore.js → quizCore.js`

```
┌───────────────┐
│summaryCore.js │
└───────┬───────┘
        │
        │ window.jumpToFlashcard() - 1회
        │ window.displayQuestion() - 1회
        │ window.getCurrentFlashcardInfo() - 1회
        ↓
┌─────────────┐
│ quizCore.js │
└─────────────┘
```

**순환 여부**: ❌ 역방향 없음 (quizCore → summaryCore 호출 없음)
**해결 우선순위**: 낮음 (Phase 6.1~6.2에서 처리)

---

#### B. `grading.js → 다른 모듈들`

```
┌────────────┐
│ grading.js │
└─────┬──────┘
      │
      ├─ window.openApiModal() → geminiApi.js
      ├─ window.enforceExclusiveFlagsOnAll() → storageManager.js
      ├─ window.registerUniqueRead() → storageManager.js
      ├─ window.updateSummary() → summaryCore.js
      └─ window.refreshPanels() → calendarCore.js
```

**순환 여부**: ❌ 모두 단방향
**해결 우선순위**: 낮음 (Phase 6.1~6.2에서 처리)

---

#### C. `quizCore.js → 다른 모듈들` (filterCore 제외)

```
┌─────────────┐
│ quizCore.js │
└─────┬───────┘
      │
      ├─ window.updateSummaryHighlight() → summaryCore.js
      ├─ window.updateSummary() → summaryCore.js
      └─ window.refreshPanels() → calendarCore.js
```

**순환 여부**: ❌ 모두 단방향
**해결 우선순위**: 낮음 (Phase 6.1~6.2에서 처리)

---

## 🔧 순환 의존성 해결 전략

### ⭐ 해결 방법: Event-Driven 패턴 도입

**핵심 아이디어**: `quizCore`와 `filterCore`가 직접 호출하지 않고, **이벤트를 통해 간접 통신**

#### 현재 구조 (순환):
```javascript
// quizCore.js
const filteredData = window.getFilteredByUI(); // → filterCore.js

// filterCore.js
window.reloadAndRefresh(); // → quizCore.js (순환!)
```

#### 개선 구조 (이벤트 기반):
```javascript
// quizCore.js
import { EventBus } from './core/eventBus.js';

// 필터 데이터가 필요할 때
EventBus.emit('filter:request');
EventBus.once('filter:response', (filteredData) => {
  // 필터링된 데이터 사용
});

// filterCore.js
import { EventBus } from './core/eventBus.js';

// 필터 요청 수신
EventBus.on('filter:request', () => {
  const filtered = getFilteredByUI();
  EventBus.emit('filter:response', filtered);
});

// 퀴즈 리로드가 필요할 때
EventBus.emit('quiz:reload'); // 직접 호출 대신 이벤트
```

---

## 📋 구체적 작업 계획

### Step 1: EventBus 모듈 생성 (30분)

**파일**: `js/core/eventBus.js`

```javascript
/**
 * 간단한 이벤트 버스 (Pub/Sub 패턴)
 */
class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(...args));
  }
}

export const EventBus = new EventBus();
```

---

### Step 2: quizCore.js 수정 (45분)

**변경점**: 6개 순환 호출 지점 수정

#### 변경 1: `getFilteredByUI` 호출 제거

**Before** (js/features/quiz/quizCore.js:196-198):
```javascript
const filteredData = typeof window.getFilteredByUI === 'function'
  ? window.getFilteredByUI()
  : window.allData;
```

**After**:
```javascript
import { EventBus } from '../../core/eventBus.js';

// 동기적 대안: StateManager에서 직접 가져오기
import { getFilteredData } from '../filter/filterCore.js';
const filteredData = getFilteredData();
```

**또는** (비동기가 필요한 경우):
```javascript
EventBus.emit('filter:request');
let filteredData;
EventBus.once('filter:response', (data) => {
  filteredData = data;
});
```

---

### Step 3: filterCore.js 수정 (45분)

**변경점**: 4개 `reloadAndRefresh()` 호출 제거

#### 변경 전 (js/features/filter/filterCore.js:51-52):
```javascript
if (typeof window.reloadAndRefresh === 'function') {
  window.reloadAndRefresh();
}
```

#### 변경 후:
```javascript
import { EventBus } from '../../core/eventBus.js';

EventBus.emit('quiz:reload');
```

**퀴즈 모듈에서 이벤트 수신**:
```javascript
// quizCore.js
EventBus.on('quiz:reload', () => {
  reloadAndRefresh();
});
```

---

## ⏱️ 소요 시간 예상

| 작업 | 예상 시간 | 난이도 | 리스크 |
|------|-----------|--------|--------|
| EventBus 모듈 생성 | 30분 | 🟢 낮음 | 🟢 낮음 |
| quizCore.js 수정 | 45분 | 🟡 중간 | 🟡 중간 |
| filterCore.js 수정 | 45분 | 🟡 중간 | 🟡 중간 |
| 테스트 및 검증 | 30분 | 🟡 중간 | 🟡 중간 |
| **총 소요 시간** | **2.5시간** | - | - |

---

## 🎯 Phase 6.1과 함께 진행하는 전략

### 옵션 A: 순차 진행 (안전) ⭐ 권장

```
1단계 (1-2시간): Phase 6.1 먼저 완료
   → window.showToast 등 저위험 항목 40개 제거
   → 테스트 및 검증

2단계 (2.5시간): 순환 의존성 해결
   → EventBus 생성 및 적용
   → quizCore ⇄ filterCore 순환 제거

총 소요: 3.5-4.5시간
```

**장점**:
- ✅ 단계별 검증 가능
- ✅ 문제 발생 시 롤백 포인트 명확
- ✅ Phase 6.1 성공하면 순환 해결 스킵 가능

---

### 옵션 B: 병렬 진행 (빠름)

```
동시 작업:
- Phase 6.1: window.showToast 등 40개 제거
- 순환 의존성: EventBus 적용

총 소요: 2-3시간
```

**단점**:
- ⚠️ 두 작업이 같은 파일 수정 시 충돌 가능
- ⚠️ 문제 발생 시 원인 파악 어려움

---

## 💡 추천 전략

### ⭐ **옵션 A-1: Phase 6.1 먼저, 순환 의존성은 나중에**

**이유**:
1. Phase 6.1은 **저위험, 고효율** (40개 window.* 제거, 1-2시간)
2. 순환 의존성 해결은 **중위험, 중효율** (6개 지점만 수정, 2.5시간)
3. Phase 6.1만 해도 전체 200+ window.* 중 20% 제거됨
4. 순환 의존성은 현재 window.* 덕분에 잘 작동 중 (급하지 않음)

**제안**:
```
이번 세션: Phase 6.1 완료 (1-2시간)
다음 세션: 순환 의존성 해결 (2.5시간)

→ 각 작업을 독립적으로 검증하여 안정성 확보
```

---

## 🚀 즉시 시작 가능한 작업

만약 **지금 바로 순환 의존성 해결**을 원하신다면:

```bash
# 1. EventBus 생성
touch js/core/eventBus.js

# 2. 수정할 파일 확인
ls -l js/features/quiz/quizCore.js
ls -l js/features/filter/filterCore.js

# 3. 변경 사항 적용
# (위의 Step 1-3 코드 참고)
```

**커밋 전략**:
```
Commit 1: feat: EventBus 모듈 추가
Commit 2: refactor: quizCore에 EventBus 적용 (filterCore 의존성 제거)
Commit 3: refactor: filterCore에 EventBus 적용 (quizCore 의존성 제거)
Commit 4: test: 순환 의존성 해결 검증
```

---

## 📊 최종 요약

| 항목 | 내용 |
|------|------|
| **진짜 순환 의존성** | 1개 (quizCore ⇄ filterCore) |
| **영향받는 호출 지점** | 6개 (quizCore 2회, filterCore 4회) |
| **해결 방법** | EventBus (Pub/Sub 패턴) |
| **예상 소요 시간** | 2.5시간 |
| **리스크 수준** | 🟡 중간 |
| **권장 순서** | Phase 6.1 먼저 → 순환 의존성 나중 |

---

**결론**: 사용자의 아이디어("페이즈 6.1 수행하고 순환의존성을 해결")는 **실행 가능**하지만, **순차 진행이 더 안전**합니다.
