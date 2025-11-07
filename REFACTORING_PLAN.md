# 🎯 리팩토링 실행 계획

**최종 업데이트**: 2025-11-07
**현재 진행률**: Phase 4.5 완료 (약 85% 완료)
**브랜치**: `claude/phase-4-feature-modules-011CUtW5znGTCVwrt9nAZ93E`

---

## 📍 현재 상황

### ✅ 완료된 작업
- ✅ Phase 2.1-2.5: core 및 quiz 모듈 11개 생성 완료
- ✅ Phase 2.6: 중복 함수 완전 제거 (200줄 감소)
- ✅ Phase 3.1: features/filter/ 모듈 분리 완료 (6개 함수, 234줄)
- ✅ Phase 3.2: features/summary/ 모듈 분리 완료 (3개 함수, 275줄)
- ✅ Phase 3.3: features/calendar/ 모듈 분리 완료 (4개 함수, 484줄)
- ✅ Phase 3.4: features/settings/ 모듈 분리 완료 (9개 함수, 235줄)
- ✅ Phase 3.5: services/dataImportExport 모듈 분리 완료 (5개 함수, 274줄)
- ✅ Phase 4.1: features/report/ 모듈 분리 완료 (16개 함수, ~1104줄)
- ✅ Phase 4.2: features/flashcard/ 모듈 분리 완료 (11개 함수, 194줄)
- ✅ Phase 4.3: features/achievements/ 모듈 분리 완료 (21개 함수, 681줄)
- ✅ Phase 4.4: features/explorer/ 모듈 분리 완료 (2개 함수, 81줄)
- ✅ **Phase 4.5: features/review/ 모듈 분리 완료 (10개 함수, 270줄)** ⬅️ 최신
- ✅ 버그 수정 13건 완료 (HLR 회상률 표시 복원 포함)
- ✅ 기능 추가: 문제목록 정렬 개선, 퀴즈 UI 출처 표시

### 🎯 다음 목표
1. **다음**: Phase 5 - 이벤트 리스너 정리 및 최종 클린업
2. **최종**: index.html 1,000줄 이하 달성 목표

---

## 🏗️ Phase 1-2: 기반 구조 및 Core 모듈 (완료)

### ✅ Phase 1: 초기 모듈화 구조 생성
**일시**: 2025-11-04
**커밋**: `7ec5312`, `8a9d5aa`, `97709ea`

**생성된 기본 구조**:
- `js/config/config.js` - 전역 상수 및 설정
- `js/utils/helpers.js` - 유틸리티 함수
- `js/ui/elements.js` - DOM 요소 참조
- `js/ui/domUtils.js` - DOM 조작 유틸리티
- `js/services/geminiApi.js` - Gemini API 통합
- `js/app.js` - 애플리케이션 진입점

**성과**:
- index.html에서 기본 모듈 분리
- ES6 모듈 시스템 도입

**발생한 주요 오류**:
1. **안푼문제 필터링 로직 버그** (commit: `8a0a3c0`)
   - 문제: 필터링 조건이 제대로 작동하지 않음
   - 해결: 필터링 로직 재작성

---

### ✅ Phase 2.1-2.2: Core 모듈 분리
**일시**: 2025-11-05
**커밋**: `f1ef971` (Phase 2.1), `451c124` (Phase 2.2), `b8143e4` (StateManager)

**생성 모듈**:
- `js/core/dataManager.js` - 데이터 로딩 및 관리
- `js/core/storageManager.js` - localStorage 관리
- `js/core/stateManager.js` - 전역 상태 관리 (중요!)

**발생한 주요 오류**:

1. **Phase 2.1 revert 발생** (commit: `dae32bc`)
   - 문제: dataManager.js 생성 후 기능이 작동하지 않음
   - 원인: 모듈 간 의존성 문제
   - 해결: revert 후 재작업

2. **Phase 3.2 초기 시도 실패** (commits: `eeff85a`, `4f6abaa`, `2ef9f1c`)
   - 문제: storageManager 분리 시 오류 발생
   - 해결: 완전히 revert 후 Phase 2로 재정비

3. **전역 상태 관리 문제** (commit: `b8143e4`)
   - 문제: 모듈 간 전역 변수 공유 어려움
   - 해결: **옵션 C 도입 - StateManager 패턴**
     ```javascript
     // stateManager.js: getter/setter로 전역 상태 관리
     let allData = [];
     export const getAllData = () => allData;
     export const setAllData = (value) => { allData = value; };
     ```

4. **UI 로딩 문제** (commit: `8c8c5a5`)
   - 문제: 모듈 로딩 후 UI가 표시되지 않음
   - 원인: 초기화 순서 문제
   - 해결: 초기화 순서 조정

5. **app.js 로드 순서 오류** (commit: `8d15c2e`)
   - 문제: app.js가 너무 늦게 로드됨
   - 해결: inline script 앞으로 이동

---

### ✅ Phase 2.3-2.5: Quiz 모듈 분리 (재수행)
**일시**: 2025-11-05~06
**최초 시도**: `5225ad2`, `8d5d736`, `6814777`
**재수행**: `1685c1b` (2025-11-07)

**생성 모듈**:
- `js/features/quiz/grading.js` - 채점 로직
- `js/features/quiz/quizCore.js` - 퀴즈 핵심 기능
- `js/features/quiz/navigation.js` - 퀴즈 네비게이션

**발생한 주요 오류 (Phase 2.3-2.5 최초 시도)**:

1. **handlePrevQuestion/handleNextQuestion 참조 오류** (commit: `6f652c3`)
   - 문제: 이벤트 리스너에서 함수 참조 불가
   - 해결: 익명 함수로 래핑

2. **displayQuestion/updateFlagButtonsUI 중복 정의** (commit: `7d7d018`)
   - 문제: index.html과 모듈에 함수가 중복 정의됨
   - 해결: index.html에서 중복 제거

3. **주석 블록 문법 오류** (commit: `753e53c`)
   - 문제: 주석이 제대로 닫히지 않아 SyntaxError 발생
   - 해결: 주석 블록 정리

4. **대규모 revert 발생** (commits: `7e1d6e6`, `d6ea0d9`, `83629be`, `a79dbf7`, `299e4ad`)
   - 문제: 여러 오류가 누적되어 전체 기능 마비
   - 해결: **Phase 2.3-2.5 전체를 처음부터 재수행** (`1685c1b`)

**발생한 주요 오류 (Phase 2.3-2.5 재수행 후)**:

5. **전역 변수 동기화 문제** (commit: `23371f6`)
   - 문제: 모듈과 index.html 간 변수 값이 동기화되지 않음
   - 해결: **Object.defineProperty 사용**
     ```javascript
     Object.defineProperty(window, 'currentQuizData', {
       get: () => getCurrentQuizData(),
       set: (value) => setCurrentQuizData(value)
     });
     ```

6. **치명적인 el 변수 shadowing 문제** (commit: `da9884b`)
   - 문제: 여러 곳에서 `const el = ...`로 변수 shadowing 발생
   - 영향: DOM 요소 참조 오류로 전체 UI 마비
   - 해결: 모든 el 변수 shadowing 제거, ui/elements.js의 el만 사용

7. **모듈 로딩 순서 문제** (commit: `7f0dfc2`)
   - 문제: app.js import 누락으로 모듈이 로드되지 않음
   - 해결: index.html에 app.js import 추가

8. **index.html 함수 window 노출 누락** (commit: `26f142b`)
   - 문제: 모듈 함수가 window에 노출되지 않아 이벤트 리스너에서 참조 불가
   - 해결: app.js에서 모든 함수를 window에 명시적으로 노출

9. **모범답안 박스 표시 오류** (commit: `b32d3d6`)
   - 문제: 채점 후 모범답안이 표시되지 않음
   - 원인: DOM 요소 초기화 누락
   - 해결: displayQuestion에서 초기화 로직 추가

10. **statsRefDate 변수 shadowing** (commit: `3de5424`)
    - 문제: 변수 shadowing으로 통계 UI 오류 발생
    - 해결: shadowing 제거

11. **캘린더/통계에서 questionScores 접근 불가** (commit: `aeba067`)
    - 문제: 모듈에서 전역 변수 접근 오류
    - 해결: stateManager를 통한 접근으로 변경

12. **displayQuestion에서 모범답안 초기화 누락** (commit: `10e941d`)
    - 반복 발생
    - 해결: 추가 초기화 로직

13. **initElements에서 modelAnswerBox 초기화 누락** (commit: `a3e1c0f`)
    - 최종 수정
    - 해결: initElements 함수에 추가

14. **favicon.ico 404 에러** (commit: `74bf7b0`)
    - 문제: 브라우저 콘솔에 404 에러 지속
    - 해결: favicon.ico 파일 생성

---

### ✅ Phase 2.6: 중복 함수 완전 제거
**일시**: 2025-11-07
**커밋**: `1e45516`

**작업 내용**:
- index.html에 남아있던 중복 함수 200줄 제거
- 모든 함수를 모듈로 완전 이동

**성과**: index.html 200줄 감소 (4,802 → 4,602줄)

---

### 📊 Phase 1-2 요약

**생성된 모듈**: 11개
- config: 1개
- utils: 2개
- ui: 2개
- services: 1개
- core: 3개
- features/quiz: 3개

**총 감소량**: index.html 200줄 감소

**해결된 주요 문제**:
1. ✅ 전역 변수 동기화 (Object.defineProperty + StateManager)
2. ✅ el 변수 shadowing (치명적 버그 해결)
3. ✅ 모듈 로딩 순서
4. ✅ 함수 window 노출
5. ✅ 변수 shadowing 전반

**재작업 횟수**:
- Phase 2.1: 1회 revert
- Phase 2.3-2.5: 전체 재수행 1회
- 총 revert: 7회

**교훈**:
- 모듈화 시 전역 변수 동기화가 가장 중요
- el 같은 흔한 변수명은 shadowing 주의
- 모듈 로딩 순서와 window 노출이 필수
- 한 번에 여러 Phase를 진행하지 말 것
- 테스트 없이 커밋하지 말 것

---

## 🔄 Phase 3: 기능 모듈 분리

### ✅ Phase 3.1: features/filter/ (완료)
**생성 모듈**: `js/features/filter/filterCore.js` (234줄 → 241줄)

**이동된 함수**:
- `buildSourceFilterUI()` - 출처 필터 UI 생성
- `getSelectedSourceGroups()` - 선택된 출처 그룹
- `detectSourceGroup()` - 출처 그룹 감지 (기본/심화/기타)
- `applySourceFilter()` - 출처 필터 적용
- `filterByChapterSelection()` - 단원 필터 적용
- `getFilteredByUI()` - 종합 필터 + 정렬
- `getScopeFilteredData()` - 범위 필터링 (Phase 3.3에서 추가)

**성과**: index.html 82줄 감소

---

### ✅ Phase 3.2: features/summary/ (완료)
**생성 모듈**: `js/features/summary/summaryCore.js` (275줄)

**이동된 함수**:
- `updateSummary()` - 단원별 학습 현황 요약
- `updateSummaryHighlight()` - 현재 문제 하이라이트
- `ensureResultBoxReady()` - 결과 박스 초기화

**성과**: index.html 128줄 감소

---

### ✅ Phase 3.3: features/calendar/ (완료)
**생성 모듈**: `js/features/calendar/calendarCore.js` (484줄)

**이동된 함수**:
- `renderCalendarMonth()` - 학습 히트맵 캘린더 렌더링
- `bindCalendarDateClick()` - 캘린더 날짜 클릭 이벤트
- `renderStatsDateNav()` - 통계 날짜 네비게이션 UI
- `renderStats()` - 일/주/월간 통계 대시보드

**성과**:
- index.html 288줄 감소
- getScopeFilteredData() 함수 공통화 (filterCore.js로 이동)

**커밋**: `3029d37`

---

### ✅ Phase 3.4: features/settings/ (완료)
**생성 모듈**: `js/features/settings/settingsCore.js` (235줄)

**이동된 함수**:
- `openApiModal()` / `closeApiModal()` - API 키 모달 관리
- `ensureApiKeyGate()` - API 키 게이트 체크
- `openSettingsModal()` / `closeSettingsModal()` - 설정 모달 관리
- `initApiModalListeners()` - API 모달 이벤트 리스너
- `initSettingsModalListeners()` - 설정 모달 이벤트 리스너 (다크모드/AI 모델 변경)
- `initDDayListeners()` - D-DAY 관련 이벤트 리스너
- `initGlobalEscapeHandler()` - 전역 Escape 키 핸들러
- `initSettings()` - 설정 시스템 초기화 함수

**성과**:
- index.html 39줄 감소
- 설정 관련 로직 완전 분리

**커밋**: `cf534ba`

---

### ✅ Phase 3.5: services/dataImportExport (완료) ⬅️ 최신
**생성 모듈**: `js/services/dataImportExport.js` (274줄)

**이동된 함수**:
- `mergeQuizScores()` - 퀴즈 점수 병합 로직
- `exportData()` - 데이터 백업 파일 생성
- `importData()` - 데이터 가져오기 (덮어쓰기)
- `mergeData()` - 데이터 병합 가져오기
- `initDataImportExport()` - Import/Export 이벤트 리스너 초기화

**성과**:
- index.html 66줄 감소
- 데이터 관리 로직 완전 분리
- 백업/복원 기능 모듈화

**커밋**: `db3ce2e`

---

## 📅 Phase 4: 추가 기능 모듈

### ✅ Phase 4.1: features/report/ (완료)
**생성 모듈**:
- `js/features/report/reportCore.js` (364줄)
- `js/features/report/charts.js` (562줄)
- `js/features/report/analysis.js` (282줄)

**이동된 함수 (16개)**:

**reportCore.js (모달 및 데이터 처리)**:
- `openReportModal()` - 리포트 모달 열기
- `closeReportModal()` - 리포트 모달 닫기
- `switchReportTab()` - 탭 전환
- `getReportData()` - 리포트 데이터 수집
- `generateReport()` - 리포트 생성
- `renderActionPlan()` - 액션 플랜 렌더링
- `initReportListeners()` - 이벤트 리스너 초기화

**charts.js (차트 렌더링)**:
- `renderDailyVolumeChart()` - 일일 학습량 차트
- `renderScoreTrendChart()` - 점수 추이 차트 (이동평균, 골든/데드크로스)
- `renderChapterWeaknessChart()` - 단원별 약점 차트
- `showChapterDetail()` - 단원 상세 차트
- `fillMissingDates()` - 날짜 채우기 helper
- `calculateMovingAverage()` - 이동평균 계산 helper

**analysis.js (AI 분석)**:
- `startAIAnalysis()` - AI 분석 시작
- `copyAIAnalysis()` - AI 분석 복사
- `initAIAnalysisListeners()` - AI 분석 이벤트 리스너 초기화

**성과**:
- index.html 1,104줄 감소 (3,640 → 2,536줄)
- 리포트 시스템 완전 분리
- Chart.js 기반 차트 렌더링 모듈화
- AI 분석 기능 독립 모듈화

**커밋**: `4829152`, `d044049` (import 오류 수정)

---

### ✅ Phase 4.2: features/flashcard/ (완료)
**생성 모듈**: `js/features/flashcard/flashcardCore.js` (260줄)

**이동된 함수 (11개)**:
- `startFlashcardMode()` - 플래시카드 모드 시작
- `refreshFlashcardData()` - 플래시카드 데이터 새로고침
- `displayFlashcard()` - 플래시카드 표시
- `toggleFlashcardAnswer()` - 답변 표시/숨기기 토글
- `showFlashcardAnswer()` - 답변 표시
- `hideFlashcardAnswer()` - 답변 숨기기
- `flashcardPrev()` - 이전 카드
- `flashcardNext()` - 다음 카드
- `flashcardRandom()` - 랜덤 카드
- `exitFlashcardMode()` - 플래시카드 모드 종료
- `initFlashcardListeners()` - 이벤트 리스너 초기화 (키보드 단축키 포함)

**성과**:
- index.html 194줄 감소 (2,536 → 2,342줄)
- 플래시카드 시스템 완전 분리
- 키보드 단축키 (←/→/Space/Esc) 모듈화
- 플래시카드 <-> 퀴즈 모드 전환 로직 독립

**커밋**: (진행 중)

---

### ✅ Phase 4.3: features/achievements/ (완료)
**생성 모듈**: `js/features/achievements/achievementsCore.js` (681줄)

**이동된 함수 (21개)**:
- `unlockAchievement()` - 업적 잠금 해제
- `checkAchievements()` - 업적 조건 체크
- `loadAchievements()` / `saveAchievements()` - 데이터 관리
- `renderAchievementPanel()` - 업적 패널 렌더링
- `showAchievementNotification()` - 알림 표시
- `initAchievementListeners()` - 이벤트 리스너 초기화
- 업적 조건 체크 함수 다수 (21개 업적 타입)

**성과**:
- index.html 657줄 감소 (2,342 → 1,685줄)
- 업적 시스템 완전 분리 (ACHIEVEMENTS 상수 + 체크 로직)
- 업적 알림 및 패널 UI 모듈화

**커밋**: (진행 중)

---

### ✅ Phase 4.4: features/explorer/ (완료)
**생성 모듈**: `js/features/explorer/explorerCore.js` (175줄)

**이동된 함수 (2개)**:
- `renderExplorer()` - 단원별 버튼 + 문제 검색 렌더링
- `moveSourceFilterToSide()` - 출처 필터 UI 이동

**성과**:
- index.html 81줄 감소 (1,685 → 1,604줄)
- 문제 탐색기 + 검색 기능 모듈화
- 단원별 그룹화 로직 독립

**커밋**: (진행 중)

---

### ✅ Phase 4.5: features/review/ (완료)
**생성 모듈**:
- `js/features/review/hlrDataset.js` (217줄)
- `js/features/review/reviewCore.js` (148줄)

**이동된 함수 (10개)**:
- **hlrDataset.js** (HLR 알고리즘):
  - `buildHLRDataset()` - HLR 학습 데이터셋 생성
  - `exportHLRDataset()` - CSV 내보내기
  - `LocalHLRPredictor` - HLR 예측 클래스
  - `buildFeaturesForQID()` - 문제별 피처 추출
  - `calculateRecallProbability()` - 회상 확률 계산
- **reviewCore.js** (복습 전략):
  - `getReviewStrategy()` - 복습 전략 가져오기
  - `prioritizeTodayReview()` - 복습 우선순위 정렬 (smart, HLR, flag, low, recentWrong)
  - `initReviewListeners()` - 복습 UI 이벤트 리스너

**성과**:
- index.html 270줄 감소 (1,604 → 1,334줄)
- HLR (Half-Life Regression) 알고리즘 모듈화
- 5가지 복습 전략 (smart, HLR, flag, low, recentWrong) 독립
- 회상 확률 계산 및 우선순위 정렬 로직 분리

**커밋**: (진행 중)

---

## 🚀 Phase 5: 최종 정리

### Phase 5.1: 이벤트 리스너 정리
- index.html의 모든 addEventListener를 모듈로 이동
- app.js에서 초기화 함수로 통합
- **예상 소요 시간**: 2-3시간

### Phase 5.2: 전역 브릿지 제거
- window.* 노출 최소화
- 모듈 간 직접 import 사용
- **예상 소요 시간**: 3-4시간

### Phase 5.3: index.html 정리
- `<script type="module">` 내용 최소화
- 모든 로직을 모듈로 이동
- **예상 소요 시간**: 2-3시간

---

## 📊 전체 타임라인 요약

| Phase | 작업 | 소요 시간 | 누적 시간 |
|-------|------|-----------|-----------|
| 2.1-2.6 | core/quiz 모듈 + 중복 제거 | 완료 ✅ | - |
| 3.1-3.3 | filter/summary/calendar | 완료 ✅ | - |
| 3.4-3.5 | settings/dataImportExport | 3h | 3h |
| 4.x | 추가 기능 모듈 | 12-17h | 15-20h |
| 5.x | 최종 정리 | 7-10h | 22-30h |

**총 예상**: 22-30시간 (3-4일 집중 작업)

---

## ⚠️ 중요 규칙 및 주의사항

### 🚨 StateManager Import 금지 (Critical!)

**문제**: Phase 4.1 (report 모듈), Phase 4.2 (flashcard 모듈)에서 반복 발생
**원인**: `stateManager.js`는 getter/setter 함수만 export하며, 직접 named export를 제공하지 않음

**❌ 잘못된 사용 (에러 발생)**:
```javascript
import { currentQuizData, currentQuestionIndex, isFlashcardMode } from '../../core/stateManager.js';
import { questionScores, allData, geminiApiKey } from '../../core/stateManager.js';
```

**에러 메시지**:
```
Uncaught SyntaxError: The requested module '../../core/stateManager.js'
does not provide an export named 'currentQuestionIndex'
```

**✅ 올바른 사용**:
```javascript
// stateManager import 제거하고 window 객체 사용
window.currentQuizData
window.currentQuestionIndex
window.isFlashcardMode
window.questionScores
window.allData
window.geminiApiKey
```

**적용 위치**:
- ✅ `js/features/report/reportCore.js` - `window.questionScores`, `window.allData`
- ✅ `js/features/report/analysis.js` - `window.geminiApiKey`, `window.questionScores`
- ✅ `js/features/flashcard/flashcardCore.js` - `window.currentQuizData`, `window.currentQuestionIndex`, `window.isFlashcardMode`

**재발 방지 규칙**:
1. 새 모듈 생성 시 stateManager에서 직접 import 금지
2. 전역 상태는 항상 `window` 객체를 통해 접근
3. setter 함수 대신 직접 할당: `window.isFlashcardMode = true`

**수정 커밋**:
- `d044049` - fix: report 모듈 import 오류 수정
- `9d03332` - fix: flashcardCore.js stateManager import 오류 수정

---

### 📋 Import 경로 주의사항

**chapterLabelText 위치**:
- ❌ `import { chapterLabelText } from '../../utils/helpers.js'` (잘못됨)
- ✅ `import { chapterLabelText } from '../../config/config.js'` (올바름)

**적용 위치**:
- `js/features/report/charts.js`
- `js/features/report/reportCore.js`

---

### 🔒 모듈 Private 변수 직접 접근 금지 (Critical!)

**문제**: Phase 4.2 (flashcard 모듈)에서 발생
**원인**: 모듈 내부의 let 변수는 private이므로 외부(index.html)에서 직접 접근 불가

**❌ 잘못된 사용 (에러 발생)**:
```javascript
// index.html에서 직접 접근 시도
if (isFlashcardMode) {
  flashcardData = list;  // ❌ ReferenceError: flashcardData is not defined
  flashcardIndex = 0;    // ❌ ReferenceError: flashcardIndex is not defined
  displayFlashcard();
}
```

**에러 메시지**:
```
Uncaught ReferenceError: flashcardData is not defined
```

**✅ 올바른 사용**:
```javascript
// flashcardCore.js에 public 함수 추가
export function jumpToFlashcard(list, questionId, label) {
  flashcardData = list;  // 모듈 내부에서만 접근 가능
  flashcardIndex = list.findIndex(x => String(x.고유ID).trim() === String(questionId).trim());
  displayFlashcard();
  // ...
}

// index.html에서 public 함수 사용
if (window.isFlashcardMode) {
  jumpToFlashcard(list, it.고유ID, label);  // ✅ 올바른 접근
}
```

**재발 방지 규칙**:
1. 모듈 내부 let/const 변수는 private으로 외부 접근 불가
2. 외부에서 상태 변경이 필요하면 public 함수를 export
3. 모듈 분리 후 반드시 기존 코드에서 직접 변수 참조가 남아있는지 확인

**수정 커밋**:
- `3986177` - fix: flashcard 모듈 private 변수 접근 오류 수정 - jumpToFlashcard 함수 추가

---

## 📈 진행 상황 추적

### Phase 2 체크리스트
- [x] 2.1-2.5: core/quiz 모듈 생성 ✅
- [x] 2.6: 중복 함수 제거 ✅

### Phase 3 체크리스트
- [x] 3.1: features/filter/ 분리 ✅
- [x] 3.2: features/summary/ 분리 ✅
- [x] 3.3: features/calendar/ 분리 ✅
- [x] 3.4: features/settings/ 분리 ✅
- [x] 3.5: services/dataImportExport 분리 ✅

### Phase 4 체크리스트
- [x] 4.1: features/report/ ✅
- [x] 4.2: features/flashcard/ ✅
- [x] 4.3: features/achievements/ ✅
- [x] 4.4: features/explorer/ ✅
- [x] 4.5: features/review/ ✅

### Phase 5 체크리스트
- [ ] 5.1: 이벤트 리스너 정리
- [ ] 5.2: 전역 브릿지 제거
- [ ] 5.3: index.html 정리

---

## 📦 생성된 모듈 목록 (22개)

### Phase 1: 기본 모듈 (6개) ✅
1. ✅ config/config.js (설정 및 상수)
2. ✅ utils/helpers.js (유틸리티 함수)
3. ✅ ui/elements.js (DOM 엘리먼트)
4. ✅ ui/domUtils.js (DOM 유틸리티)
5. ✅ services/geminiApi.js (Gemini API)
6. ✅ core/stateManager.js (전역 상태 관리)

### Phase 2: 핵심 모듈 (5개) ✅
7. ✅ core/dataManager.js (데이터 로드 및 관리)
8. ✅ core/storageManager.js (저장소 및 마이그레이션)
9. ✅ features/quiz/grading.js (채점 및 힌트)
10. ✅ features/quiz/quizCore.js (퀴즈 핵심 로직)
11. ✅ features/quiz/navigation.js (네비게이션)

### Phase 3: 기능 모듈 (5개) ✅
12. ✅ features/filter/filterCore.js (필터링 시스템)
13. ✅ features/summary/summaryCore.js (요약/대시보드)
14. ✅ features/calendar/calendarCore.js (캘린더/통계)
15. ✅ features/settings/settingsCore.js (설정 관리)
16. ✅ services/dataImportExport.js (데이터 Import/Export)

### Phase 4: 추가 기능 모듈 (8개 완료) ✅
17. ✅ features/report/reportCore.js (리포트 모달 및 데이터)
18. ✅ features/report/charts.js (차트 렌더링)
19. ✅ features/report/analysis.js (AI 분석)
20. ✅ features/flashcard/flashcardCore.js (플래시카드 시스템)
21. ✅ features/achievements/achievementsCore.js (업적 시스템)
22. ✅ features/explorer/explorerCore.js (문제 탐색기)
23. ✅ features/review/hlrDataset.js (HLR 알고리즘)
24. ✅ features/review/reviewCore.js (복습 전략)

---

## 🔧 주요 기술적 변경사항

### 모듈 간 의존성 구조
```
index.html
    ↓
app.js (진입점)
    ↓
├─ config/config.js
├─ utils/helpers.js
├─ ui/ (elements.js, domUtils.js)
├─ services/geminiApi.js
├─ core/ (stateManager, dataManager, storageManager)
└─ features/
   ├─ quiz/ (quizCore, grading, navigation)
   ├─ filter/ (filterCore)
   ├─ summary/ (summaryCore)
   └─ calendar/ (calendarCore)
```

### 전역 브릿지 패턴
- **현재**: window 객체를 통한 하위 호환성 유지
- **Phase 5**: 직접 import로 전환 예정

### StateManager 패턴
- 중앙 집중식 상태 관리
- Object.defineProperty를 통한 전역 변수 동기화
- localStorage 데이터 자동 로드

---

## 📊 코드 라인 수 변화

| 단계 | index.html 라인 수 | 감소량 | 비고 |
|------|-------------------|--------|------|
| 시작 | 4,802 | - | 초기 상태 |
| Phase 2.6 | 4,602 | -200 | 중복 제거 |
| Phase 3.1 | 4,520 | -82 | filter 모듈 |
| Phase 3.2 | 4,392 | -128 | summary 모듈 |
| Phase 3.3 | 3,734 | -658 | calendar 모듈 |
| Phase 3.4 | 3,695 | -39 | settings 모듈 |
| HLR fix | 3,706 | +11 | 함수 노출 |
| Phase 3.5 | 3,640 | -66 | dataImportExport 모듈 |
| Phase 4.1 | 2,536 | -1,104 | report 모듈 (3개 파일) |
| Phase 4.2 | 2,342 | -194 | flashcard 모듈 |
| Phase 4.3 | 1,685 | -657 | achievements 모듈 |
| Phase 4.4 | 1,604 | -81 | explorer 모듈 |
| Phase 4.5 | 1,334 | -270 | review 모듈 (2개 파일) |
| **총 감소** | **-3,468줄** | **72.2%** | **현재** |

**모듈 총 라인 수**: ~7,106줄 (24개 모듈)
- reportCore.js (364줄) + charts.js (562줄) + analysis.js (282줄) = 1,208줄
- flashcardCore.js (260줄)
- achievementsCore.js (681줄)
- explorerCore.js (175줄)
- hlrDataset.js (217줄) + reviewCore.js (148줄) = 365줄

---

## 🐛 해결된 버그 (13건)

1. ✅ 변수 shadowing 문제 (statsRefDate, questionScores)
2. ✅ 모듈 로딩 순서 문제
3. ✅ 함수 전역 노출 누락
4. ✅ 모범답안 박스 초기화
5. ✅ 통계 UI 데이터 로딩
6. ✅ 캘린더 데이터 접근
7. ✅ Favicon 404 에러
8. ✅ 모범답안 즉시 표시
9. ✅ 업적 팝업 타이밍
10. ✅ 모바일 차트 압축 문제
11. ✅ SOURCE_LS export 누락
12. ✅ filterCore import 경로 수정
13. ✅ HLR 회상률 통계 표시 복원 (calculateRecallProbability window 노출)

---

## ✨ 추가 기능 개선 (2건)

1. ✅ 문제목록 정렬 개선 (단원 → 표시번호 기준)
2. ✅ 퀴즈 UI 출처 표시 (기본/심화/기타 배지)

---

## ⚠️ 주의사항

### 모듈 생성 시 반드시:
1. ✅ 모듈 파일 생성 (적절한 디렉토리)
2. ✅ 함수 export (named export 사용)
3. ✅ JSDoc 주석 추가
4. ✅ app.js에 import
5. ✅ window.* 전역 노출 (필요 시)
6. ✅ index.html 중복 제거
7. ✅ 동작 테스트
8. ✅ 명확한 커밋 메시지

### 테스트 시 반드시:
- ✅ 브라우저 콘솔 에러 없음
- ✅ 해당 기능 정상 작동
- ✅ localStorage 데이터 보존
- ✅ 다른 기능에 영향 없음

### 절대 하지 말 것:
- ❌ 여러 Phase를 한 번에 작업
- ❌ 테스트 없이 커밋
- ❌ localStorage 데이터 손실 위험 작업

---

## 📝 주요 커밋 히스토리

### Phase 3.3 (2025-11-07)
```
3029d37 - refactor: Phase 3.3 완료 - features/calendar/ 모듈 분리
83df728 - feat: 문제목록 정렬 개선 및 퀴즈 UI 출처 표시 기능 추가
96dfc4a - fix: 출처 필터 상수(SOURCE_LS) export 누락 수정
c18a796 - fix: summaryCore.js에서 존재하지 않는 SOURCE_LS export 제거
```

### Phase 3.1-3.2 (이전)
```
8e10074 - refactor: Phase 3.2 완료 - features/summary/ 모듈 분리
309c17e - refactor: Phase 3.1 완료 - features/filter/ 모듈 분리
ef3b927 - fix: filterCore import 경로 수정
```

### Phase 2 (이전)
```
1e45516 - refactor: Phase 2.6 완료 - 중복 함수 제거 (200줄)
[Phase 2.1-2.5 커밋들...]
```

---

## 🎯 다음 작업

**Phase 4.3: features/achievements/ 모듈 분리**
- 업적 시스템 관련 함수들
- 업적 체크 및 팝업 표시
- 업적 데이터 관리

**예상 소요 시간**: 3-4시간

---

**작성일**: 2025-11-07
**브랜치**: `claude/phase-4-feature-modules-011CUtW5znGTCVwrt9nAZ93E`
**전체 진행률**: 85% (24/28 모듈 완료, Phase 4 완료)
