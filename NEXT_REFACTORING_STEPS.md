# 🔧 다음 리팩토링 단계 계획

## 📋 현재 상황

### 완료된 작업 ✅
- Phase 1: 기본 모듈 구조 (config, utils, ui, services)
- Phase 2.1-2.2: core 모듈 (dataManager, storageManager, stateManager)
- Phase 2.3-2.5: quiz 모듈 (grading, quizCore, navigation)
- 버그 수정 11건 (변수 shadowing, 모듈 로딩, 모범답안, 업적 팝업, 모바일 차트 등)

### 현재 문제점 ⚠️
1. **중복 함수 정의**: 모듈로 이동했지만 index.html에 여전히 남아있음
2. **주석 처리된 코드**: `/* [이전 코드 - ...] */` 블록들이 실제로는 실행 가능한 코드
3. **코드베이스 혼란**: 어떤 함수가 사용되는지 불명확

---

## 🎯 Phase 2.6: 중복 코드 제거 및 정리 (최우선)

### 목표
- index.html에서 중복 함수 완전 제거
- 주석 처리된 이전 코드 블록 정리
- 각 단계마다 동작 확인으로 안정성 보장

### 단계별 작업 계획

#### Step 1: 중복 함수 검증 및 제거 🔴 HIGH
**작업 내용**:
1. 모듈에서 import되는지 확인 (app.js 체크)
2. index.html에서 중복 함수 완전 삭제
3. 기능 동작 테스트

**제거 대상**:
```javascript
// 📍 core/dataManager.js 중복 (line 928-973)
- async function loadData() { ... }
- function selfTest() { ... }
- function populateChapterSelect() { ... }

// 📍 core/storageManager.js 중복 (line 987-999)
- function migrateData() { ... }

// 📍 features/quiz/quizCore.js 중복 (line 1272-1341)
- function reloadAndRefresh() { ... }
- function updateFlagButtonsUI() { ... }
- function displayQuestion() { ... }

// 📍 features/quiz/grading.js 중복 (line 1415-1434)
- async function handleGrade() { ... }
```

**검증 방법**:
```bash
# 1. app.js에서 전역 노출 확인
grep "window\\.loadData\|window\\.reloadAndRefresh" js/app.js

# 2. 중복 함수 제거 후 테스트
# - 페이지 로드 시 questions.json 로드 확인
# - 문제 풀이 및 채점 확인
# - 학습 기록 저장 확인
```

**예상 소요 시간**: 1-2시간

---

#### Step 2: 주석 블록 정리 🟡 MEDIUM
**작업 내용**:
1. 주석 마커 패턴 식별
2. 삭제해도 되는 블록 확인
3. 단계적 제거 및 테스트

**주석 패턴**:
```javascript
/* [이전 코드 - 삭제됨] */
/* [이전 코드 - XX.js로 이동됨] */
// [리팩토링] XX 함수는 XX.js로 이동됨
```

**제거 기준**:
- ✅ 모듈로 완전히 이동된 함수 → 주석 블록 완전 삭제
- ✅ 삭제 마커가 있는 블록 → 완전 삭제
- ⚠️ 아직 이동 안 된 함수 → 주석만 제거하고 함수는 유지

**예상 소요 시간**: 1시간

---

#### Step 3: 동작 검증 체크리스트 🟢 CRITICAL
각 단계마다 다음 항목들을 반드시 테스트:

**기본 기능**:
- [ ] 페이지 로드 성공
- [ ] questions.json 로드 및 selfTest 통과
- [ ] localStorage 데이터 로드 확인

**퀴즈 기능**:
- [ ] 문제 표시 (displayQuestion)
- [ ] 채점 기능 (handleGrade)
- [ ] 이전/다음 버튼
- [ ] 랜덤 문제 시작
- [ ] 모범답안 즉시 표시

**데이터 저장**:
- [ ] 점수 저장 및 불러오기
- [ ] 복습 플래그(★) 설정/해제
- [ ] 제외 표시(➖) 설정/해제

**UI 기능**:
- [ ] 필터링 (단원, 출처, 상태)
- [ ] 통계 표시 (캘린더, 히트맵)
- [ ] 업적 시스템
- [ ] 다크모드

**예상 소요 시간**: 1시간

---

## 📈 Phase 3: 기능 모듈 분리 (다음 단계)

### Phase 3.1: features/filter/ (필터링 시스템)
**Priority: HIGH** ⭐⭐⭐

**이동 대상 함수**:
```javascript
// features/filter/sourceFilter.js
- buildSourceFilterUI()
- getSelectedSourceGroups()
- detectSourceGroup()
- applySourceFilter()

// features/filter/chapterFilter.js
- filterByChapterSelection()
- getFilteredByUI() // ⚠️ 이미 quizCore.js에 있음 - 이동 고려
```

**작업 순서**:
1. 소스 필터 관련 함수 모듈화
2. 챕터 필터 통합
3. app.js에 전역 노출
4. index.html에서 중복 제거
5. 동작 테스트

**예상 소요 시간**: 2-3시간

---

### Phase 3.2: features/summary/ (요약 통계)
**Priority: HIGH** ⭐⭐⭐

**이동 대상 함수**:
```javascript
// features/summary/summaryCore.js
- updateSummary()
- updateSummaryHighlight()
- refreshPanels()
- ensureResultBoxReady()
```

**예상 소요 시간**: 1-2시간

---

### Phase 3.3: features/calendar/ (캘린더/통계)
**Priority: MEDIUM** ⭐⭐

**이동 대상 함수**:
```javascript
// features/calendar/calendar.js
- renderCalendarMonth()
- bindCalendarDateClick()
- renderStatsDateNav()

// features/calendar/stats.js
- renderStats()
- initStatsDate() // ⚠️ storageManager에 있을 수도
- saveStatsDate()
```

**예상 소요 시간**: 2-3시간

---

### Phase 3.4: features/settings/ (설정 관리)
**Priority: MEDIUM** ⭐⭐

**이동 대상 함수**:
```javascript
// features/settings/settings.js
- openApiModal()
- closeApiModal()
- ensureApiKeyGate()
- openSettingsModal()
- closeSettingsModal()
- 다크모드 변경 핸들러
- AI 모델 변경 핸들러
```

**예상 소요 시간**: 1-2시간

---

### Phase 3.5: services/dataImportExport.js (데이터 가져오기/내보내기)
**Priority: MEDIUM** ⭐⭐

**이동 대상 함수**:
```javascript
// services/dataImportExport.js
- mergeQuizScores()
- exportDataBtn 이벤트 핸들러
- importDataBtn 이벤트 핸들러
- mergeDataBtn 이벤트 핸들러
```

**예상 소요 시간**: 1-2시간

---

## 📊 Phase 4: 추가 기능 모듈 (낮은 우선순위)

### Phase 4.1: features/report/ (리포트)
- reportCore.js
- charts.js
- analysis.js

**예상 소요 시간**: 4-5시간

---

### Phase 4.2: features/flashcard/ (플래시카드)
- flashcardCore.js

**예상 소요 시간**: 2-3시간

---

### Phase 4.3: features/achievements/ (업적 시스템)
- achievementsCore.js
- achievementChecks.js

**예상 소요 시간**: 3-4시간

---

### Phase 4.4: features/explorer/ (탐색기)
- explorerCore.js

**예상 소요 시간**: 1-2시간

---

### Phase 4.5: features/review/ (복습 추천)
- reviewCore.js
- hlrDataset.js

**예상 소요 시간**: 2-3시간

---

## 🚀 Phase 5: 최종 정리 (마지막 단계)

### Phase 5.1: 이벤트 리스너 정리
**작업 내용**:
- index.html의 모든 addEventListener를 모듈로 이동
- app.js에서 초기화 함수로 통합

**예상 소요 시간**: 2-3시간

---

### Phase 5.2: 전역 브릿지 제거
**작업 내용**:
- window.* 노출 최소화
- 모듈 간 직접 import 사용
- 하위 호환성 검토

**예상 소요 시간**: 3-4시간

---

### Phase 5.3: index.html 정리
**작업 내용**:
- `<script type="module">` 내용 최소화
- 모든 로직을 모듈로 이동
- 최종 검증

**예상 소요 시간**: 2-3시간

---

## 📅 전체 일정 추정

| Phase | 작업 | 소요 시간 | 누적 시간 |
|-------|------|-----------|-----------|
| 2.6 | 중복 코드 제거 | 3-4h | 3-4h |
| 3.1 | filter 모듈 | 2-3h | 5-7h |
| 3.2 | summary 모듈 | 1-2h | 6-9h |
| 3.3 | calendar 모듈 | 2-3h | 8-12h |
| 3.4 | settings 모듈 | 1-2h | 9-14h |
| 3.5 | import/export 모듈 | 1-2h | 10-16h |
| 4.x | 추가 기능 모듈 | 12-17h | 22-33h |
| 5.x | 최종 정리 | 7-10h | 29-43h |

**총 예상 시간**: 29-43시간 (3-5일 집중 작업)

---

## ⚠️ 주의사항

### 각 단계마다 반드시:
1. ✅ **모듈 생성 전**: 해당 함수가 사용되는 모든 위치 파악
2. ✅ **모듈 생성 후**: app.js에 전역 노출
3. ✅ **index.html 수정 후**: 중복 함수 완전 제거
4. ✅ **각 단계 후**: 동작 검증 체크리스트 실행
5. ✅ **커밋 전**: git status 확인 및 명확한 커밋 메시지

### 테스트 우선:
- 기능 추가보다 **기존 기능 유지**가 우선
- 에러 발생 시 즉시 롤백
- localStorage 데이터 백업 권장

### 문서화:
- 각 모듈에 JSDoc 주석 추가
- README 업데이트
- 체크리스트 실시간 업데이트

---

## 🎯 즉시 시작할 작업

### **지금 바로: Phase 2.6 Step 1 - 중복 함수 제거**

1. **core/dataManager.js 중복 제거** (line 928-973)
   ```bash
   # 1. app.js 확인
   grep "window.loadData" js/app.js

   # 2. index.html에서 삭제 (주석 블록 통째로)
   # line 927-973 삭제

   # 3. 테스트: 페이지 로드 및 데이터 로드
   ```

2. **features/quiz/quizCore.js 중복 제거** (line 1271-1341)
   ```bash
   # 1. app.js 확인
   grep "window.reloadAndRefresh\|window.displayQuestion" js/app.js

   # 2. index.html에서 삭제
   # line 1271-1341 삭제

   # 3. 테스트: 문제 로드 및 표시
   ```

3. **features/quiz/grading.js 중복 제거** (line 1414-1436)
   ```bash
   # 1. app.js 확인
   grep "window.handleGrade" js/app.js

   # 2. index.html에서 삭제
   # line 1414-1436 삭제

   # 3. 테스트: 채점 기능
   ```

4. **커밋 및 푸시**
   ```bash
   git add index.html
   git commit -m "refactor: Phase 2.6 Step 1 - index.html 중복 함수 제거

   모듈로 이동한 함수들의 중복 정의 제거:
   - core/dataManager.js 중복 (loadData, selfTest, populateChapterSelect)
   - features/quiz/quizCore.js 중복 (reloadAndRefresh, displayQuestion, updateFlagButtonsUI)
   - features/quiz/grading.js 중복 (handleGrade)

   모든 함수는 app.js를 통해 전역으로 노출되어 있어 기능 정상 작동 확인"

   git push -u origin claude/refactor-quiz-features-review-011CUsfTCNQCMBNVW8FGBmAP
   ```

---

**작성일**: 2025-01-07
**브랜치**: claude/refactor-quiz-features-review-011CUsfTCNQCMBNVW8FGBmAP
**현재 진행률**: Phase 2.6 (48% 완료)
