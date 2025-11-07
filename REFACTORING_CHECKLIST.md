# 🔍 리팩토링 체크리스트 - index.html 기능 비교

## ✅ 이미 모듈로 이동 완료

### 1. 설정 및 상수 (`js/config/config.js`)
- ✅ `BASE_SYSTEM_PROMPT` - AI 채점 프롬프트
- ✅ `LITE_STRICT_ADDENDUM` - 엄격 모드 프롬프트
- ✅ `CHAPTER_LABELS` - 단원 라벨
- ✅ `PART_INSERTIONS` - 파트 정의
- ✅ `ACHIEVEMENTS` - 업적 정의 (82개)
- ✅ `ACHIEVEMENTS_LS_KEY` - 업적 localStorage 키
- ✅ `STATS_DATE_KEY` - 통계 날짜 키
- ✅ `EXAM_DATE_KEY` - 시험 날짜 키
- ✅ `chapterLabelText()` - 단원 라벨 텍스트
- ✅ `PART_VALUE()` - 파트 값 생성
- ✅ `isPartValue()` - 파트 값 검증
- ✅ `parsePartValue()` - 파트 값 파싱

### 2. 유틸리티 함수 (`js/utils/helpers.js`)
- ✅ `clamp()` - 값 제한
- ✅ `normId()` - ID 정규화
- ✅ `sanitizeModelText()` - AI 응답 정제
- ✅ `ymd()` - 날짜 포맷
- ✅ `dowMon0()` - 요일 계산
- ✅ `hslToHex()` - 색상 변환
- ✅ `colorForCount()` - 학습량에 따른 색상
- ✅ `computePartRanges()` - 파트 범위 계산

### 3. DOM 유틸리티 (`js/ui/domUtils.js`)
- ✅ `showToast()` - 토스트 메시지
- ✅ `getHeaderOffset()` - 헤더 높이
- ✅ `smoothScrollTo()` - 부드러운 스크롤
- ✅ `elmTop()` - 엘리먼트 위치
- ✅ `applyDarkMode()` - 다크모드 적용
- ✅ `watchSystemDarkMode()` - 시스템 다크모드 감지
- ✅ `setLoading()` - 로딩 상태 설정

### 4. DOM 엘리먼트 (`js/ui/elements.js`)
- ✅ `$()` - getElementById 헬퍼
- ✅ `initElements()` - 모든 DOM 엘리먼트 초기화
- ✅ `el` 객체 - 모든 DOM 참조

### 5. Gemini API 서비스 (`js/services/geminiApi.js`)
- ✅ `callGeminiAPI()` - AI 채점 API
- ✅ `callGeminiHintAPI()` - 힌트 생성 API
- ✅ `callGeminiTextAPI()` - 범용 텍스트 생성 API

---

## ❌ 아직 index.html에 남아있음 (모듈화 필요)

### 📦 core/dataManager.js (데이터 관리)
**Priority: HIGH** ⭐⭐⭐
- ✅ `loadData()` - 문제 데이터 로드
- ✅ `selfTest()` - 데이터 검증
- ✅ `getAllChapterNums()` - 단원 번호 추출
- ✅ `populateChapterSelect()` - 단원 선택 UI 채우기
- ⚠️ **index.html에 중복 코드 남아있음 (line 928-973) - 제거 필요**

### 📦 core/storageManager.js (스토리지 관리)
**Priority: HIGH** ⭐⭐⭐
- ✅ `loadScores()` - 점수 로드
- ✅ `loadApiKey()` - API 키 로드
- ⚠️ `loadSettings()` - 설정 로드 (index.html에 남아있음 - line 982)
- ✅ `migrateData()` - 데이터 마이그레이션
- ✅ `enforceExclusiveFlagsOnAll()` - 플래그 정합성
- ✅ `setFlagState()` - 플래그 상태 설정
- ✅ `loadReadStore()` - 회독 스토어 로드
- ✅ `saveReadStore()` - 회독 스토어 저장
- ✅ `computeUniqueReadsFromHistory()` - 고유 회독 계산
- ✅ `backfillReadStoreFromScores()` - 회독 데이터 복원
- ✅ `registerUniqueRead()` - 회독 등록

### 📦 core/scoreManager.js (점수 관리)
**Priority: MEDIUM** ⭐⭐
- index.html 안에 점수 계산 로직 산재
- questionScores 객체 관리
- solveHistory 관리

### 📦 features/quiz/ (퀴즈 시스템)
**Priority: HIGH** ⭐⭐⭐

#### features/quiz/quizCore.js
- ✅ `reloadAndRefresh()` - 퀴즈 로드
- ✅ `displayQuestion()` - 문제 표시
- ✅ `updateFlagButtonsUI()` - 플래그 버튼 UI
- ✅ `startRandomQuiz()` - 랜덤 퀴즈 시작
- ✅ `getFilteredByUI()` - UI 필터링 (정렬 로직 포함)
- ⚠️ **index.html에 중복 코드 남아있음 (line 1272-1341) - 제거 필요**

#### features/quiz/grading.js
- ✅ `handleGrade()` - 채점 처리
- ✅ `handleHint()` - 힌트 처리
- ✅ `showResult()` - 결과 표시
- ✅ **모범답안 즉시 표시 기능 추가**
- ⚠️ **index.html에 중복 코드 남아있음 (line 1415-1434) - 제거 필요**

#### features/quiz/navigation.js
- ✅ `enterFocusMode()` - 포커스 모드 진입
- ✅ `exitToDashboard()` - 대시보드로 나가기
- ✅ `backFromFocus()` - 포커스 모드 나가기
- ✅ prevBtn, nextBtn 이벤트 핸들러

### 📦 features/filter/ (필터링/검색)
**Priority: MEDIUM** ⭐⭐
- ❌ `buildSourceFilterUI()` - 출처 필터 UI 구축 (1068줄)
- ❌ `getSelectedSourceGroups()` - 선택된 출처 그룹 (1090줄)
- ❌ `detectSourceGroup()` - 출처 그룹 감지 (1091줄)
- ❌ `applySourceFilter()` - 출처 필터 적용 (1092줄)
- ❌ `filterByChapterSelection()` - 단원 필터 (1094줄)
- ❌ `getFilteredByUI()` - UI 필터 적용 (1104줄)

### 📦 features/summary/ (요약/대시보드)
**Priority: MEDIUM** ⭐⭐
- ❌ `updateSummary()` - 요약 업데이트 (1319줄)
- ❌ `updateSummaryHighlight()` - 요약 하이라이트 (1428줄)
- ❌ `ensureResultBoxReady()` - 결과 박스 준비 (1460줄)

### 📦 features/calendar/ (캘린더)
**Priority: MEDIUM** ⭐⭐
- ❌ `initStatsDate()` - 통계 날짜 초기화 (700줄)
- ❌ `saveStatsDate()` - 통계 날짜 저장 (714줄)
- ❌ `loadExamDate()` - 시험 날짜 로드 (722줄)
- ❌ `saveExamDate()` - 시험 날짜 저장 (730줄)
- ❌ `calculateDDay()` - D-DAY 계산 (734줄)
- ❌ `updateDDayDisplay()` - D-DAY 표시 (749줄)
- ❌ `renderCalendarMonth()` - 캘린더 월 렌더링 (1488줄)
- ❌ `bindCalendarDateClick()` - 캘린더 날짜 클릭 (1528줄)
- ❌ `renderStatsDateNav()` - 통계 날짜 네비게이션 (1562줄)
- ❌ `renderStats()` - 통계 렌더링 (1622줄)

### 📦 features/settings/ (설정)
**Priority: MEDIUM** ⭐⭐
- ❌ `openApiModal()` - API 모달 열기 (926줄)
- ❌ `closeApiModal()` - API 모달 닫기 (929줄)
- ❌ `ensureApiKeyGate()` - API 키 게이트 (930줄)
- ❌ `openSettingsModal()` - 설정 모달 열기 (954줄)
- ❌ `closeSettingsModal()` - 설정 모달 닫기 (961줄)
- ❌ 다크모드 변경 이벤트 핸들러
- ❌ AI 모델 변경 이벤트 핸들러

### 📦 services/dataImportExport.js (데이터 Import/Export)
**Priority: MEDIUM** ⭐⭐
- ❌ `mergeQuizScores()` - 점수 병합 (1014줄)
- ❌ exportDataBtn 이벤트 핸들러 (987줄)
- ❌ importDataBtn 이벤트 핸들러 (994줄)
- ❌ mergeDataBtn 이벤트 핸들러 (1045줄)

### 📦 features/explorer/ (탐색기)
**Priority: MEDIUM** ⭐⭐
- ❌ `renderExplorer()` - 탐색기 렌더링 (1847줄)
- ❌ explorerSearch 이벤트 핸들러

### 📦 features/report/ (리포트)
**Priority: LOW** ⭐

#### features/report/reportCore.js
- ❌ `openReportModal()` - 리포트 모달 열기 (2223줄)
- ❌ `closeReportModal()` - 리포트 모달 닫기 (2233줄)
- ❌ `switchReportTab()` - 리포트 탭 전환 (2249줄)
- ❌ `getReportData()` - 리포트 데이터 가져오기 (2273줄)
- ❌ `generateReport()` - 리포트 생성 (2315줄)
- ❌ `fillMissingDates()` - 누락 날짜 채우기 (2332줄)

#### features/report/charts.js
- ❌ `renderDailyVolumeChart()` - 일일 학습량 차트 (2355줄)
- ❌ `calculateMovingAverage()` - 이동 평균 계산 (2388줄)
- ❌ `renderScoreTrendChart()` - 점수 추세 차트 (2402줄)
- ❌ `renderChapterWeaknessChart()` - 단원 약점 차트 (2602줄)
- ❌ `showChapterDetail()` - 단원 상세 (2654줄)

#### features/report/analysis.js
- ❌ `renderActionPlan()` - 액션 플랜 (2865줄)
- ❌ `markdownToHtml()` - 마크다운 변환 (2950줄)
- ❌ `startAIAnalysis()` - AI 분석 시작 (2981줄)
- ❌ `copyAIAnalysis()` - AI 분석 복사 (3190줄)

### 📦 features/flashcard/ (플래시카드)
**Priority: LOW** ⭐
- ❌ `startFlashcardMode()` - 플래시카드 모드 시작 (3341줄)
- ❌ `refreshFlashcardData()` - 플래시카드 데이터 새로고침 (3371줄)
- ❌ `displayFlashcard()` - 플래시카드 표시 (3398줄)
- ❌ `toggleFlashcardAnswer()` - 답안 토글 (3437줄)
- ❌ `showFlashcardAnswer()` - 답안 표시 (3445줄)
- ❌ `hideFlashcardAnswer()` - 답안 숨기기 (3454줄)
- ❌ `flashcardPrev()` - 이전 카드 (3463줄)
- ❌ `flashcardNext()` - 다음 카드 (3470줄)
- ❌ `flashcardRandom()` - 랜덤 카드 (3477줄)
- ❌ `exitFlashcardMode()` - 플래시카드 모드 종료 (3485줄)

### 📦 features/achievements/ (업적 시스템)
**Priority: LOW** ⭐
- ❌ `loadAchievements()` - 업적 로드 (3625줄)
- ❌ `saveAchievements()` - 업적 저장 (3634줄)
- ❌ `unlockAchievement()` - 업적 해금 (3640줄)
- ❌ `showAchievementNotification()` - 업적 알림 (3660줄)
- ❌ `updateAchievementBadge()` - 업적 뱃지 (3690줄)
- ❌ `checkAchievements()` - 업적 체크 (3702줄)
- ❌ `checkStreakAchievements()` - 연속 학습 업적 (3767줄)
- ❌ `checkVolumeAchievements()` - 학습량 업적 (3812줄)
- ❌ `checkSourceAchievements()` - 출처 업적 (3844줄)
- ❌ `checkOvercomeWeakness()` - 약점 극복 업적 (3864줄)
- ❌ `checkComeback()` - 칠전팔기 업적 (3880줄)
- ❌ `checkPerfectDay()` - 퍼펙트 데이 업적 (3896줄)
- ❌ `checkChapterMaster()` - 챕터 마스터 업적 (3920줄)
- ❌ `check1stCompletion()` - 1회독 완료 업적 (3947줄)
- ❌ `checkTimeBased()` - 시간 기반 업적 (3966줄)
- ❌ `checkChapter1stCompletionPerChapter()` - 단원별 1회독 (4008줄)
- ❌ `checkChapterMasteryPerChapter()` - 단원별 마스터리 (4037줄)
- ❌ `openAchievementsModal()` - 업적 모달 열기 (4071줄)
- ❌ `closeAchievementsModal()` - 업적 모달 닫기 (4085줄)
- ❌ `renderAchievements()` - 업적 렌더링 (4090줄)
- ❌ `createAchievementCard()` - 업적 카드 생성 (4137줄)

### 📦 features/review/ (복습 추천)
**Priority: MEDIUM** ⭐⭐
- ❌ `buildHLRDataset()` - HLR 데이터셋 구축 (1939줄)
- ❌ `exportHLRDataset()` - HLR 데이터셋 내보내기 (2007줄)
- ❌ `buildFeaturesForQID()` - 문제별 특성 구축 (2085줄)
- ❌ `calculateRecallProbability()` - 회상 확률 계산 (2119줄)
- ❌ `prioritizeTodayReview()` - 오늘의 복습 우선순위 (2142줄)
- ❌ `syncStrategy()` - 전략 동기화 (2194줄)

### 📦 ui/navigation.js (네비게이션)
**Priority: LOW** ⭐
- ❌ `openDrawer()` - 드로어 열기 (2197줄)
- ❌ `closeDrawer()` - 드로어 닫기 (2202줄)

### 📦 이벤트 리스너 (app.js로 이동 필요)
**Priority: HIGH** ⭐⭐⭐
- ❌ DOMContentLoaded 메인 핸들러 (4282줄)
- ❌ prevBtn 클릭
- ❌ nextBtn 클릭
- ❌ gradeBtn 클릭
- ❌ hintBtn 클릭
- ❌ loadQuizBtn 클릭
- ❌ randomQuizBtn 클릭
- ❌ reviewFlagToggle 클릭
- ❌ reviewExcludeToggle 클릭
- ❌ loadPrevAnswerBtn 클릭
- ❌ settingsBtn 클릭
- ❌ exportDataBtn 클릭
- ❌ importDataBtn 클릭
- ❌ mergeDataBtn 클릭
- ❌ startReviewBtn 클릭
- ❌ openReportBtn 클릭
- ❌ flashcardModeBtn 클릭
- ❌ openAchievementsBtn 클릭
- ❌ 키보드 단축키 (Escape, Ctrl+Enter 등)
- ❌ 기타 모든 UI 이벤트 핸들러

---

## 📊 통계

- **총 함수 개수**: ~124개 (index.html에서 카운트)
- **모듈로 이동 완료**: ~45개 (36%)
- **아직 남아있음**: ~79개 (64%)
- **중복 코드 블록**: ~25개 주석 블록 (제거 필요)

## ⚠️ Phase 2.6: 중복 코드 제거 작업 (진행 중)

### 발견된 중복 함수 (index.html에 남아있음)
1. **core/dataManager.js 중복**:
   - `loadData()` (line 928-951)
   - `selfTest()` (line 952-958)
   - `populateChapterSelect()` (line 960-972)

2. **core/storageManager.js 중복**:
   - `migrateData()` (line 987-999)
   - 기타 storage 관련 함수들

3. **features/quiz/quizCore.js 중복**:
   - `reloadAndRefresh()` (line 1272-1289)
   - `updateFlagButtonsUI()` (line 1304-1315)
   - `displayQuestion()` (line 1317-1340)

4. **features/quiz/grading.js 중복**:
   - `handleGrade()` (line 1415-1434)

### 주석 처리된 코드 블록
- `/* [이전 코드 - ...] */` 형태의 블록 다수
- `// [리팩토링] ...` 형태의 마커 다수
- 이전 코드가 주석 안에 포함되어 있지만 실제로는 실행 가능한 상태

### 정리 계획
**단계 1**: 중복 함수 제거 (모듈에서 import하는지 확인 후)
**단계 2**: 주석 블록 정리 (실제 삭제 대상 식별)
**단계 3**: 각 단계마다 동작 테스트
**단계 4**: 최종 코드 검증 및 커밋

---

## 🎯 우선순위 추천

### Phase 1 (Critical) - 즉시 필요
1. ✅ config.js (완료)
2. ✅ utils/helpers.js (완료)
3. ✅ ui/domUtils.js (완료)
4. ✅ ui/elements.js (완료)
5. ✅ services/geminiApi.js (완료)

### Phase 2 (High) - 다음 단계
6. ❌ core/dataManager.js
7. ❌ core/storageManager.js
8. ❌ features/quiz/quizCore.js
9. ❌ features/quiz/grading.js
10. ❌ features/quiz/navigation.js

### Phase 3 (Medium) - 그 다음
11. ❌ core/scoreManager.js
12. ❌ features/filter/
13. ❌ features/summary/
14. ❌ features/calendar/
15. ❌ features/settings/
16. ❌ services/dataImportExport.js
17. ❌ features/explorer/
18. ❌ features/review/

### Phase 4 (Low) - 나중에
19. ❌ features/report/
20. ❌ features/flashcard/
21. ❌ features/achievements/
22. ❌ ui/navigation.js

### Phase 5 (Final) - 마지막
23. ❌ 모든 이벤트 리스너를 app.js로 이전
24. ❌ 전역 브릿지 제거
25. ❌ index.html의 <script> 태그 완전 제거
