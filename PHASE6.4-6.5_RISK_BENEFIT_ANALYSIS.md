# Phase 6.4-6.5 리스크 vs 효익 분석

**작성일**: 2025-11-08
**작성 목적**: Phase 6.4-6.5 진행 여부 결정을 위한 상세 분석
**현재 상태**: Phase 6.1-6.3 완료 (46개 window.* 제거)

---

## 📊 현재까지 성과 (Phase 6.1-6.3)

| Phase | window.* 제거 | 소요 시간 | 리스크 | 상태 |
|-------|--------------|-----------|--------|------|
| Phase 6.1 | **26개** (UI 함수) | 1시간 | 🟢 낮음 | ✅ 완료 |
| Phase 6.2 | **13개** (날짜 변수) | 1시간 | 🟡 중간 | ✅ 완료 |
| Phase 6.3 | **7개** (순환 의존성) | 2시간 | 🟡 중간 | ✅ 완료 |
| **총계** | **46개** | **4시간** | - | **23% 완료** |

**남은 window.***: ~154개 / ~200개

---

## 🎯 Phase 6.4: UI 함수 리팩토링 분석

### 대상 함수 (48개)

| 함수 | 사용 횟수 | 현재 제공 모듈 | 리스크 |
|------|-----------|---------------|--------|
| `window.refreshPanels` | 18회 | - (미구현) | 🔴 높음 |
| `window.reloadAndRefresh` | 18회 | quizCore.js | 🔴 높음 |
| `window.updateSummary` | 12회 | summaryCore.js | 🟡 중간 |
| 기타 UI 함수 | - | 다양 | 🟡 중간 |

---

### 🔴 Phase 6.4.1: refreshPanels (18회) - 가장 높은 리스크

#### 현황 분석
```bash
# 사용처 분석 (18개 파일)
js/features/quiz/grading.js:           6회
js/features/quiz/quizCore.js:          4회
js/features/settings/settingsCore.js:  2회
js/features/summary/summaryCore.js:    2회
js/core/storageManager.js:             2회
... (기타)
```

#### 문제점
1. **refreshPanels가 현재 존재하지 않음**
   - app.js에 정의 없음
   - 어떤 모듈에서도 export하지 않음
   - **즉, 현재 호출해도 아무 동작 안 함!**

2. **의존성 복잡도**
   - refreshPanels는 여러 패널을 업데이트하는 통합 함수
   - calendarCore, summaryCore, explorerCore 등 다양한 모듈 호출
   - 새로 구현 필요 시 circular dependency 위험 높음

#### 예상 작업
```javascript
// 필요한 작업 (예상)
// 1. refreshPanels 함수 찾기 또는 재구현
// 2. 각 패널 업데이트 함수 분리
// 3. EventBus 또는 직접 import로 변경
// 4. 18개 호출 지점 수정
```

#### 리스크 평가
- **난이도**: 매우 높음 🔴🔴
- **소요 시간**: 3-5시간
- **회귀 버그 가능성**: 높음 (함수가 존재하지 않아 기능 확인 어려움)
- **롤백 가능성**: 중간

---

### 🔴 Phase 6.4.2: reloadAndRefresh (18회 남음)

#### 현황 분석
```bash
# filterCore에서는 Phase 6.3에서 제거 완료 (5회 → 0회)
# 여전히 남은 사용처:
js/features/settings/settingsCore.js:  2회
js/features/quiz/grading.js:          ?회
js/features/summary/summaryCore.js:    ?회
... (기타)
```

#### 해결 방안
1. **EventBus 패턴 확장** (권장)
   - filterCore와 동일한 방식
   - `eventBus.emit('quiz:reload')` 사용
   - 리스크: 🟡 중간

2. **직접 import**
   - `import { reloadAndRefresh } from '../quiz/quizCore.js'`
   - 순환 의존성 가능성 확인 필요
   - 리스크: 🔴 높음

#### 예상 작업
- 18개 호출 지점 파악
- 순환 의존성 분석
- EventBus 또는 직접 import로 변경
- 테스트 및 검증

#### 리스크 평가
- **난이도**: 높음 🔴
- **소요 시간**: 2-3시간
- **회귀 버그 가능성**: 중간
- **롤백 가능성**: 높음 (EventBus 패턴 이미 검증됨)

---

### 🟡 Phase 6.4.3: updateSummary (12회)

#### 현황 분석
```javascript
// 사용처
js/features/quiz/grading.js
js/features/quiz/quizCore.js
js/features/settings/settingsCore.js
... (기타)
```

#### 해결 방안
1. **EventBus 패턴** (권장)
   - `eventBus.emit('summary:update')`
   - summaryCore에서 `eventBus.on('summary:update')` 수신
   - 리스크: 🟡 중간

2. **직접 import**
   - `import { updateSummary } from '../summary/summaryCore.js'`
   - 순환 의존성 낮을 것으로 예상
   - 리스크: 🟢 낮음~중간

#### 예상 작업
- 12개 호출 지점 수정
- EventBus 또는 직접 import로 변경
- summaryCore에 이벤트 리스너 추가 (EventBus 사용 시)

#### 리스크 평가
- **난이도**: 중간 🟡
- **소요 시간**: 1-2시간
- **회귀 버그 가능성**: 낮음~중간
- **롤백 가능성**: 높음

---

## 🔴🔴 Phase 6.5: 상태 변수 마이그레이션 분석

### 대상 변수 (59개)

| 변수 | 사용 횟수 | 현재 관리 | 리스크 |
|------|-----------|-----------|--------|
| `window.questionScores` | 26회 | StateManager (Object.defineProperty) | 🔴🔴 매우 높음 |
| `window.currentQuizData` | 13회 | StateManager | 🔴 높음 |
| `window.currentQuestionIndex` | 11회 | StateManager | 🔴 높음 |
| `window.allData` | 9회 | StateManager | 🔴 높음 |

---

### 🔴🔴 Phase 6.5.1: questionScores (26회) - 가장 위험

#### 현황
```javascript
// 현재 패턴 (안정적으로 작동 중)
Object.defineProperty(window, 'questionScores', {
  get: () => getQuestionScores(),
  set: (value) => setQuestionScores(value)
});
```

#### 문제점
1. **광범위한 사용**
   - 18개 모듈 파일에서 사용
   - 읽기/쓰기 모두 발생
   - 복잡한 객체 구조 (중첩된 배열/객체)

2. **동기화 이슈**
   - StateManager와 window.questionScores 간 양방향 동기화
   - Object.defineProperty로 이미 해결됨
   - **변경 시 동기화 깨질 위험 매우 높음**

3. **Phase 1-2 실패 이력**
   - 7번의 revert 중 대부분이 questionScores 관련
   - "questionScores undefined 에러"
   - "동기화 실패"

#### 제거 시 필요한 작업
```javascript
// 모든 사용처 변경 필요 (26회)
// Before
window.questionScores[key] = { score: 100, ... };

// After (Option 1: getter/setter)
const scores = getQuestionScores();
scores[key] = { score: 100, ... };
setQuestionScores(scores);

// After (Option 2: 전용 함수)
updateQuestionScore(key, { score: 100, ... });
```

#### 리스크 평가
- **난이도**: 매우 높음 🔴🔴
- **소요 시간**: 4-6시간
- **회귀 버그 가능성**: 매우 높음 (Phase 1-2 실패 이력)
- **롤백 가능성**: 낮음 (변경 범위 너무 큼)
- **권장 사항**: **진행 비권장** ❌

---

## 💰 ROI (Return on Investment) 분석

### Phase 6.4 ROI

| 항목 | 비용 (시간) | 효익 | ROI |
|------|------------|------|-----|
| refreshPanels | 3-5시간 | 18개 제거, 기능 구현? | 🔴 낮음 |
| reloadAndRefresh | 2-3시간 | 18개 제거, 순환 제거 | 🟡 중간 |
| updateSummary | 1-2시간 | 12개 제거 | 🟢 중간~높음 |
| **총계** | **6-10시간** | **48개** | **🟡 중간** |

**결론**:
- ✅ `updateSummary`만 진행하면 ROI 높음 (1-2시간, 12개 제거)
- ⚠️ `reloadAndRefresh`는 선택적 (2-3시간, EventBus 패턴 재사용)
- ❌ `refreshPanels`는 비권장 (함수 미존재, 높은 복잡도)

---

### Phase 6.5 ROI

| 항목 | 비용 (시간) | 효익 | ROI |
|------|------------|------|-----|
| questionScores | 4-6시간 | 26개 제거 | 🔴 매우 낮음 |
| currentQuizData | 2-3시간 | 13개 제거 | 🔴 낮음 |
| currentQuestionIndex | 1-2시간 | 11개 제거 | 🟡 낮음~중간 |
| allData | 1-2시간 | 9개 제거 | 🟡 낮음~중간 |
| **총계** | **8-13시간** | **59개** | **🔴 매우 낮음** |

**결론**:
- ❌ **Phase 6.5 전체 비권장**
- 이유: 현재 Object.defineProperty로 안정적 작동 중
- 높은 리스크 대비 효익 거의 없음
- Phase 1-2 실패 이력

---

## 📋 권장 사항

### ⭐ 권장: Phase 6.4 부분 진행

**진행 대상**:
1. ✅ **updateSummary** (12회, 1-2시간, 리스크 🟡)
   - EventBus 또는 직접 import
   - 높은 ROI

2. ⚠️ **reloadAndRefresh** (18회, 2-3시간, 리스크 🔴)
   - EventBus 패턴 확장
   - Phase 6.3과 동일한 방식
   - 선택적 진행

**비권장 대상**:
1. ❌ **refreshPanels** (18회, 3-5시간, 리스크 🔴🔴)
   - 함수가 현재 존재하지 않음
   - 구현 범위 불명확
   - ROI 매우 낮음

2. ❌ **Phase 6.5 전체** (59회, 8-13시간, 리스크 🔴🔴)
   - 현재 안정적 작동 중
   - Object.defineProperty로 충분
   - 높은 리스크 대비 효익 없음

---

### 💡 최소 작업 제안 (추천)

**Option A: 현재 상태 유지** (0시간)
- Phase 6.1-6.3 완료 상태에서 PR 제출
- 46개 window.* 제거 (23% 완료)
- 순환 의존성 해결 완료
- 안정적이고 검증된 상태

**Option B: updateSummary만 추가** (1-2시간)
- Phase 6.4.3만 진행
- 총 58개 window.* 제거 (29% 완료)
- 낮은 리스크, 높은 ROI

**Option C: updateSummary + reloadAndRefresh** (3-5시간)
- Phase 6.4.2-6.4.3 진행
- 총 76개 window.* 제거 (38% 완료)
- 중간 리스크, 중간 ROI

---

## 📊 최종 비교표

| 옵션 | 소요 시간 | window.* 제거 | 완료율 | 리스크 | ROI | 권장도 |
|------|-----------|--------------|--------|--------|-----|-------|
| **A: 현재 유지** | 0h | 46개 | 23% | 🟢 없음 | - | ⭐⭐⭐ |
| **B: +updateSummary** | 1-2h | 58개 | 29% | 🟡 낮음 | 🟢 높음 | ⭐⭐⭐ |
| **C: +updateSummary +reloadAndRefresh** | 3-5h | 76개 | 38% | 🟡 중간 | 🟡 중간 | ⭐⭐ |
| D: Phase 6.4 전체 | 6-10h | 94개 | 47% | 🔴 높음 | 🔴 낮음 | ⭐ |
| E: Phase 6.4-6.5 전체 | 14-23h | 153개 | 77% | 🔴🔴 매우 높음 | 🔴 매우 낮음 | ❌ |

---

## 🎯 결론 및 제안

### 추천: **Option A** (현재 상태 유지)

**이유**:
1. ✅ 안정적이고 검증된 상태
2. ✅ 순환 의존성 완전 해결
3. ✅ 46개 window.* 제거 (의미 있는 성과)
4. ✅ EventBus 패턴 도입 (향후 확장 가능)
5. ✅ 리스크 없음

**다음 단계**:
1. Phase 6.1-6.3 수동 테스트 완료
2. PR 생성 및 제출
3. 메인 브랜치 머지
4. 향후 필요 시 Phase 6.4 재검토

---

### 차선책: **Option B** (updateSummary 추가)

**조건**:
- 1-2시간의 추가 작업 시간 확보
- updateSummary 함수의 의존성 확인 완료
- 순환 의존성 발생하지 않음 확인

**예상 성과**:
- 총 58개 window.* 제거 (29% 완료)
- summaryCore 모듈 독립성 증가
- 낮은 리스크로 추가 성과 확보

---

## 📝 결정 체크리스트

- [ ] Phase 6.1-6.3 수동 테스트 완료
- [ ] 테스트 결과 검토
- [ ] Phase 6.4-6.5 진행 여부 결정
- [ ] 결정 사유 문서화
- [ ] PR 생성 준비

**결정자**: _____________________
**결정일**: _____________________
**선택 옵션**: Option _____
**승인**: _____________________
