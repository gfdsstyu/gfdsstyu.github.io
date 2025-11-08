# Phase 6: 모듈 간 window.* 의존성 제거 - 리스크 및 이점 분석

**작성일**: 2025-11-07
**분석 대상**: 18개 모듈 파일
**현재 window.* 사용**: 약 200+ 건

---

## 📊 현황 분석

### 1. window.* 사용 통계 (상위 30개)

| 순위 | 항목 | 사용 횟수 | 카테고리 | 리스크 |
|------|------|-----------|----------|--------|
| 1 | `window.questionScores` | 26회 | 상태변수 | 🔴 높음 |
| 2 | `window.showToast` | 22회 | UI함수 | 🟡 중간 |
| 3 | `window.reloadAndRefresh` | 18회 | UI함수 | 🔴 높음 |
| 4 | `window.refreshPanels` | 18회 | UI함수 | 🔴 높음 |
| 5 | `window.currentQuizData` | 13회 | 상태변수 | 🔴 높음 |
| 6 | `window.updateSummary` | 12회 | UI함수 | 🟡 중간 |
| 7 | `window.currentQuestionIndex` | 11회 | 상태변수 | 🔴 높음 |
| 8 | `window.statsRefDate` | 9회 | 날짜변수 | 🟡 중간 |
| 9 | `window.isFlashcardMode` | 9회 | 상태변수 | 🟡 중간 |
| 10 | `window.allData` | 9회 | 상태변수 | 🔴 높음 |
| 11 | `window.setFlagState` | 8회 | 함수 | 🟡 중간 |
| 12 | `window.calRefDate` | 8회 | 날짜변수 | 🟡 중간 |
| 13 | `window.scrollTo` | 7회 | 브라우저API | 🟢 낮음 |
| 14 | `window.openApiModal` | 6회 | 함수 | 🟡 중간 |
| 15 | `window.jumpToFlashcard` | 6회 | 함수 | 🟡 중간 |

---

## 🔴 리스크 분석

### 리스크 분류

#### 🔴 **높음 (Critical)** - 순환 의존성 및 상태 동기화 이슈

**1. 상태 변수 접근 (26+13+11+9 = 59회)**
```javascript
// 현재 패턴 (위험)
window.questionScores  // 26회
window.currentQuizData // 13회
window.currentQuestionIndex // 11회
window.allData // 9회
```

**문제점**:
- ❌ 여러 모듈이 동일 상태를 읽고 쓰면서 **동기화 문제** 발생 가능
- ❌ StateManager의 getter/setter를 우회하여 직접 접근
- ❌ Object.defineProperty로 관리되지만 일관성 보장 어려움
- ❌ 한 모듈에서 변경 시 다른 모듈이 인지하지 못할 수 있음

**Phase 1-2 실패 사례**:
```
❌ Revert 1: questionScores 동기화 실패
❌ Revert 2: currentQuizData undefined 에러
❌ Revert 3-7: 상태 변수 접근 순서 문제
```

**2. UI 함수 순환 호출 (18+18+12 = 48회)**
```javascript
// 현재 패턴 (위험)
window.reloadAndRefresh() // filter → quiz
window.refreshPanels()    // quiz → calendar/stats/explorer
window.updateSummary()    // quiz → summary
```

**문제점**:
- ❌ **순환 의존성**: A → B → C → A 패턴
- ❌ 모듈 간 강한 결합도 (tight coupling)
- ❌ import 순서에 따라 동작 변경 가능
- ❌ 테스트 및 디버깅 어려움

**의존성 그래프 예시**:
```
grading.js → window.refreshPanels() → calendarCore.js
quizCore.js → window.getFilteredByUI() → filterCore.js
filterCore.js → window.reloadAndRefresh() → quizCore.js
            ↑___________________________________|
            (순환 의존성!)
```

#### 🟡 **중간 (Moderate)** - 리팩토링 가능하지만 신중 필요

**1. 날짜 변수 (9+8 = 17회)**
```javascript
window.statsRefDate  // 9회 - 통계 기준일
window.calRefDate    // 8회 - 캘린더 기준일
```

**해결 방안**:
- ✅ StorageManager를 통해 getter/setter로 관리
- ✅ 이미 Object.defineProperty로 관리 중
- ⚠️ 직접 할당 시 동기화 문제 가능

**2. UI Helper 함수 (22회)**
```javascript
window.showToast()  // 22회 - 토스트 메시지
```

**해결 방안**:
- ✅ DomUtils에서 export하여 직접 import
- ✅ 리스크 낮음 (단순 UI 표시)

#### 🟢 **낮음 (Low)** - 안전하게 처리 가능

**1. 브라우저 네이티브 API (12회)**
```javascript
window.scrollTo()     // 7회
window.pageYOffset    // 5회
```

**해결 방안**:
- ✅ 그대로 유지 (브라우저 표준 API)
- ✅ 리팩토링 불필요

**2. 외부 라이브러리 (4회)**
```javascript
window.Chart  // 4회 - Chart.js
```

**해결 방안**:
- ✅ 그대로 유지 (외부 라이브러리)

---

## 🎯 이점 분석

### Phase 6 완료 시 얻을 수 있는 이점

#### ✅ **코드 품질 향상**

**1. 명시적 의존성**
```javascript
// Before (암묵적)
function updateQuestion() {
  window.questionScores[id] = score;  // 어디서 왔는지 불명확
  window.refreshPanels();             // 무엇을 호출하는지 불명확
}

// After (명시적)
import { getQuestionScores, updateQuestionScore } from './core/stateManager.js';
import { refreshPanels } from './ui/panelManager.js';

function updateQuestion() {
  updateQuestionScore(id, score);  // 명확한 출처
  refreshPanels();                 // 명확한 호출
}
```

**2. 순환 의존성 제거**
- ✅ 모듈 간 의존성이 명확해짐
- ✅ import cycle 감지 가능
- ✅ 테스트 및 디버깅 용이

**3. 타입 안정성 향상**
- ✅ JSDoc/TypeScript 적용 시 타입 추론 가능
- ✅ IDE 자동완성 개선
- ✅ 런타임 에러 사전 방지

#### ✅ **유지보수성 향상**

**1. 의존성 추적**
```bash
# Before: 전역 검색 필요
grep -r "window.questionScores" .

# After: import 문으로 추적
import { questionScores } from './core/stateManager.js'
```

**2. 리팩토링 안정성**
- ✅ 함수명 변경 시 IDE가 자동으로 업데이트
- ✅ 사용되지 않는 import 자동 감지
- ✅ 영향 범위 파악 용이

#### ✅ **성능 최적화 가능성**

**1. 번들 최적화**
- ✅ Tree-shaking 가능 (사용되지 않는 코드 제거)
- ✅ 모듈 코드 분할 (code splitting) 가능
- ✅ 초기 로딩 속도 개선 가능

**2. 메모리 관리**
- ✅ window 객체 오염 감소
- ✅ GC(Garbage Collection) 효율 향상

---

## ⚠️ 리스크 요약

### Phase 1-2의 7번 Revert 원인 분석

**주요 실패 원인**:
1. **한꺼번에 리팩토링** → 문제 발생 시 원인 파악 어려움
2. **상태 동기화 미비** → questionScores 등의 동기화 실패
3. **순환 의존성** → 모듈 로드 순서 문제
4. **테스트 부족** → 변경사항 검증 미흡

### 예상 리스크

| 리스크 | 발생 확률 | 영향도 | 대응 방안 |
|--------|-----------|--------|-----------|
| 상태 동기화 실패 | 🔴 높음 | 🔴 높음 | 단계적 마이그레이션, 철저한 테스트 |
| 순환 의존성 | 🔴 높음 | 🔴 높음 | 의존성 그래프 분석 후 재설계 |
| 함수 미발견 에러 | 🟡 중간 | 🟡 중간 | import 문 정확성 검증 |
| 성능 저하 | 🟢 낮음 | 🟢 낮음 | 번들 크기 모니터링 |

---

## 🛠️ Phase 6 실행 전략

### 권장 접근 방식: **단계적 마이그레이션**

#### **Phase 6.1: 저리스크 항목 (1-2시간)**
✅ 낮은 리스크, 빠른 성과

**대상**:
- `window.showToast` (22회) → `import { showToast } from './ui/domUtils.js'`
- UI Helper 함수들

**예상 성과**:
- 약 30-40건의 window.* 제거
- 리스크: 낮음 🟢
- 즉시 효과 가시화

#### **Phase 6.2: 날짜 변수 정리 (2-3시간)**
⚠️ 중간 리스크, 신중한 접근

**대상**:
- `window.statsRefDate` (9회)
- `window.calRefDate` (8회)

**전략**:
- StorageManager getter/setter 강제 사용
- 직접 할당 금지

**예상 성과**:
- 약 20건의 window.* 제거
- 리스크: 중간 🟡

#### **Phase 6.3: UI 함수 리팩토링 (5-7시간)**
🔴 높은 리스크, 순환 의존성 해결 필요

**대상**:
- `window.refreshPanels` (18회)
- `window.reloadAndRefresh` (18회)
- `window.updateSummary` (12회)

**전략**:
1. **의존성 그래프 작성**
2. **순환 고리 찾기**
3. **중재 모듈 생성** (예: `ui/coordinator.js`)
4. **단계적 마이그레이션**

**예상 성과**:
- 약 50건의 window.* 제거
- 리스크: 높음 🔴
- **7번 revert 재발 가능성 있음**

#### **Phase 6.4: 상태 변수 마이그레이션 (7-10시간)**
🔴🔴 매우 높은 리스크, 가장 어려움

**대상**:
- `window.questionScores` (26회)
- `window.currentQuizData` (13회)
- `window.currentQuestionIndex` (11회)
- `window.allData` (9회)

**전략**:
1. **StateManager 강화**
   - getter/setter만 사용하도록 강제
   - 직접 접근 금지
2. **한 번에 하나씩**
   - questionScores부터 시작
   - 각 변수별로 별도 커밋
3. **철저한 테스트**
   - 각 기능별 수동 테스트
   - 통합 테스트

**예상 성과**:
- 약 60건의 window.* 제거
- 리스크: 매우 높음 🔴🔴
- **Phase 1-2의 실패 패턴 재발 가능**

---

## 📋 Phase 6 실행 여부 판단 기준

### ✅ 진행 권장 상황

1. **충분한 시간 확보** (최소 2주)
2. **철저한 테스트 환경 구축**
3. **점진적 배포 가능** (별도 브랜치 운영)
4. **롤백 계획 수립**

### ❌ 진행 비권장 상황

1. **빠른 배포 일정**
2. **현재 기능 안정성 최우선**
3. **리소스 부족** (개발자 1명, 시간 제약)
4. **테스트 자동화 미비**

---

## 💡 추천 사항

### 현재 상황 평가

**현재 상태**:
- ✅ index.html: 801줄 (-83.3%)
- ✅ 24개 모듈 생성 완료
- ✅ Phase 5 완료 (95%)
- ⚠️ 모듈 간 window.* 의존성: 약 200+ 건

**추천**:

#### **옵션 1: 단계적 진행 (권장)** ⭐
```
1. Phase 6.1 먼저 시도 (저리스크)
2. 성공 시 Phase 6.2 진행
3. Phase 6.3-6.4는 별도 프로젝트로 계획
```

**장점**:
- ✅ 즉각적인 개선 효과
- ✅ 리스크 최소화
- ✅ 점진적 학습

**예상 소요**: 2-3시간 (Phase 6.1만)

#### **옵션 2: 보류 (안전)** 🛡️
```
1. 현재 상태 유지
2. 기능 개발 및 버그 수정 우선
3. 필요 시 나중에 진행
```

**장점**:
- ✅ 안정성 최우선
- ✅ 리스크 제로
- ✅ 현재 성과 확정

**단점**:
- ❌ window.* 의존성 지속
- ❌ 코드 품질 개선 지연

#### **옵션 3: 전면 진행 (비권장)** ⚠️
```
1. Phase 6.1-6.4 전체 진행
2. 예상 소요: 15-20시간
3. 리스크: 매우 높음
```

**위험 요소**:
- 🔴 Phase 1-2의 7번 revert 재발 가능
- 🔴 상태 동기화 문제
- 🔴 순환 의존성 해결 어려움
- 🔴 광범위한 테스트 필요

---

## 📊 비용-이익 분석

| 항목 | Phase 6.1 | Phase 6.2 | Phase 6.3 | Phase 6.4 |
|------|-----------|-----------|-----------|-----------|
| **소요 시간** | 1-2h | 2-3h | 5-7h | 7-10h |
| **리스크** | 🟢 낮음 | 🟡 중간 | 🔴 높음 | 🔴🔴 매우높음 |
| **이점** | 🟢 즉시 | 🟡 중간 | 🟢 높음 | 🟢🟢 매우높음 |
| **ROI** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ | ⭐⭐⭐☆☆ | ⭐⭐☆☆☆ |
| **권장도** | ✅ 강력권장 | ✅ 권장 | ⚠️ 신중검토 | ❌ 비권장 |

**결론**: **Phase 6.1만 진행 권장**

---

## 🎯 최종 권장사항

### 즉시 실행 가능: Phase 6.1 (저리스크, 고효과)

**작업 내용**:
```javascript
// 1. showToast (22회)
- import { showToast } from './ui/domUtils.js';
- 모든 window.showToast() → showToast() 변경

// 2. UI Helper 함수들 (~10-15개)
- 각 모듈에 필요한 함수만 import
- 명시적 의존성 확립
```

**예상 성과**:
- ✅ 약 40건의 window.* 제거
- ✅ 코드 가독성 즉시 향상
- ✅ 리스크 거의 없음
- ⏱️ 1-2시간 소요

### 장기 계획: Phase 6.2-6.4 (별도 프로젝트)

**진행 조건**:
1. ✅ Phase 6.1 성공적 완료
2. ✅ 자동화 테스트 구축
3. ✅ 충분한 개발 시간 확보 (2주 이상)
4. ✅ 단계별 배포 전략 수립

---

**작성자**: Claude
**검토 필요**: Phase 6 진행 여부 결정
**다음 단계**: 사용자 의사결정 대기
