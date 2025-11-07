# 🎯 리팩토링 상세 실행 계획 (현 시점)

**작성일**: 2025-01-07
**현재 진행률**: Phase 2.6 (48% 완료)
**브랜치**: `claude/refactor-quiz-features-review-011CUsfTCNQCMBNVW8FGBmAP`

---

## 📍 현재 상황 분석

### ✅ 완료된 작업
- Phase 2.1-2.5: 11개 모듈 생성 및 검증 완료
- 버그 수정 11건 (변수 shadowing, 모듈 로딩 등)
- **문제점**: 모듈로 이동한 함수들이 index.html에 중복 정의됨

### ⚠️ 발견된 문제
```javascript
// index.html에 중복 존재:
/* [이전 코드 - XX.js로 이동됨]
async function loadData() { ... }  // ← 모듈에도 있고 여기도 있음!
[이전 코드 종료] */
```

### 🎯 목표
1. **즉시**: Phase 2.6 - 중복 함수 완전 제거
2. **다음**: Phase 3 - 기능 모듈 분리 (filter, summary, calendar, settings)
3. **나중**: Phase 4-5 - 추가 모듈 및 최종 정리

---

## 🔴 Phase 2.6: 중복 코드 제거 (지금 바로)

### 전략 확정
- ✅ **중복 함수**: 지금 완전 제거 (Phase 2 완료분만)
- ✅ **주석 블록**: 중복 함수 포함 블록만 삭제
- ⏸️ **리팩토링 마커**: Phase 5까지 유지 (참고용)

---

## 📋 Phase 2.6-A: core/dataManager 중복 제거

### 1. 사전 확인
```bash
# app.js에서 전역 노출 확인
grep "window.loadData\|window.selfTest\|window.populateChapterSelect" js/app.js

# 예상 출력:
# window.loadData = DataManager.loadData;
# window.selfTest = DataManager.selfTest;
# window.populateChapterSelect = DataManager.populateChapterSelect;
```

### 2. 제거 대상 확인
```bash
# index.html에서 중복 위치 확인
sed -n '927,973p' index.html | head -20
```

**제거할 라인**: 927-973 (총 47줄)

**제거 내용**:
```javascript
/* [이전 코드 - 삭제됨]
async function loadData(){
  // ... 전체 로직 ...
}
function selfTest(){
  // ... 전체 로직 ...
}
function populateChapterSelect(){
  // ... 전체 로직 ...
}
[이전 코드 종료] */
```

### 3. 제거 실행
```bash
# 백업 (안전장치)
cp index.html index.html.backup.phase2.6a

# 방법 1: 에디터로 수동 삭제 (권장)
# - line 927-973 선택 후 삭제

# 방법 2: sed 사용 (자동)
sed -i '927,973d' index.html
```

### 4. 검증
**체크리스트**:
- [ ] 페이지 로드 성공
- [ ] 콘솔에서 `[questions.json] loaded from` 메시지 확인
- [ ] 단원 선택 드롭다운 정상 표시
- [ ] selfTest 통과 (경고 메시지 없음)

**테스트 명령**:
```bash
# 브라우저 개발자 도구에서:
console.log(typeof window.loadData);  // "function"
console.log(typeof window.selfTest);  // "function"
console.log(allData.length);  // 문제 개수 표시
```

### 5. 커밋
```bash
git add index.html
git commit -m "refactor: Phase 2.6-A - core/dataManager 중복 제거

index.html의 loadData, selfTest, populateChapterSelect 중복 함수 삭제
- 제거 라인: 927-973 (47줄)
- js/core/dataManager.js에서 제공
- app.js를 통해 전역 노출됨

테스트 완료:
- 페이지 로드 및 데이터 로드 정상
- 단원 선택 UI 정상 표시"
```

**예상 소요 시간**: 10분

---

## 📋 Phase 2.6-B: core/storageManager 중복 제거

### 1. 사전 확인
```bash
grep "window.migrateData" js/app.js
# 예상: window.migrateData = StorageManager.migrateData;
```

### 2. 제거 대상
**제거할 라인**: 986-999 (총 14줄)

```javascript
/* [이전 코드 - storageManager.js로 이동됨]
function migrateData(){
  // ... 마이그레이션 로직 ...
}
[이전 코드 종료] */
```

**⚠️ 주의**: `loadSettings()` (line 982-984)는 **아직 모듈화 안 됨** → 유지!

### 3. 제거 실행
```bash
# line 986-999만 삭제
sed -i '986,999d' index.html
```

### 4. 검증
- [ ] 기존 사용자 데이터 로드 정상
- [ ] 구 스키마 → 신 스키마 마이그레이션 정상
- [ ] localStorage에서 `schemaVersion: "2"` 확인

### 5. 커밋
```bash
git commit -m "refactor: Phase 2.6-B - core/storageManager 중복 제거

migrateData 중복 함수 삭제 (line 986-999)
- storageManager.js에서 제공
- loadSettings()는 아직 유지 (모듈화 예정)"
```

**예상 소요 시간**: 5분

---

## 📋 Phase 2.6-C: quiz/quizCore 중복 제거

### 1. 사전 확인
```bash
grep "window.reloadAndRefresh\|window.displayQuestion\|window.updateFlagButtonsUI" js/app.js
```

### 2. 제거 대상
**제거할 라인**: 1271-1341 (총 71줄)

```javascript
/* [이전 코드 - quizCore.js로 이동됨]
function reloadAndRefresh(){ ... }
function updateFlagButtonsUI(saved) { ... }
function displayQuestion(){ ... }
[이전 코드 종료] */
```

**⚠️ 주의**:
- Line 1292-1295 (이벤트 리스너)는 **유지**
- 주석 블록만 제거

### 3. 제거 실행
```bash
# line 1271-1341 삭제
sed -i '1271,1341d' index.html
```

### 4. 검증
- [ ] "학습하기" 버튼 클릭 시 문제 표시
- [ ] 단원 선택 변경 시 문제 필터링
- [ ] 이전/다음 버튼 작동
- [ ] 복습 플래그(★/➖) 정상 표시

**테스트**:
```javascript
// 콘솔에서:
reloadAndRefresh();  // 문제 로드
displayQuestion();   // 문제 표시
```

### 5. 커밋
```bash
git commit -m "refactor: Phase 2.6-C - quiz/quizCore 중복 제거

reloadAndRefresh, displayQuestion, updateFlagButtonsUI 중복 삭제
- 제거 라인: 1271-1341 (71줄)
- 이벤트 리스너는 유지

테스트 완료:
- 문제 로드 및 표시 정상
- 필터링 기능 정상"
```

**예상 소요 시간**: 10분

---

## 📋 Phase 2.6-D: quiz/grading 중복 제거

### 1. 사전 확인
```bash
grep "window.handleGrade" js/app.js
```

### 2. 제거 대상
**제거할 라인**: 1414-1436 (총 23줄)

```javascript
/* [이전 코드 - grading.js로 이동됨]
async function handleGrade(){ ... }
[이전 코드 종료] */
```

### 3. 제거 실행
```bash
sed -i '1414,1436d' index.html
```

### 4. 검증
- [ ] 채점 버튼 클릭 시 정상 작동
- [ ] 모범답안 즉시 표시
- [ ] AI 채점 결과 표시
- [ ] 점수 저장 정상

**테스트**:
1. 문제 선택
2. 답안 입력
3. "채점하기" 클릭
4. 모범답안 즉시 표시 확인
5. AI 채점 후 점수 표시 확인

### 5. 커밋
```bash
git commit -m "refactor: Phase 2.6-D - quiz/grading 중복 제거

handleGrade 중복 함수 삭제 (line 1414-1436)
- grading.js에서 제공
- 모범답안 즉시 표시 기능 정상 작동"
```

**예상 소요 시간**: 10분

---

## 📋 Phase 2.6-E: 최종 검증 및 통합 커밋

### 1. 전체 동작 검증

**기본 기능**:
- [ ] 페이지 로드 및 데이터 로드
- [ ] localStorage 데이터 복원
- [ ] 단원 선택 및 필터링

**퀴즈 기능**:
- [ ] 문제 표시
- [ ] 채점 기능
- [ ] 이전/다음 버튼
- [ ] 랜덤 문제
- [ ] 힌트 기능

**데이터 저장**:
- [ ] 점수 저장
- [ ] 복습 플래그(★)
- [ ] 제외 표시(➖)
- [ ] 회독 등록

**UI 기능**:
- [ ] 통계 표시
- [ ] 캘린더/히트맵
- [ ] 업적 시스템
- [ ] 다크모드

### 2. 코드 정리 확인
```bash
# 중복 함수가 완전히 제거되었는지 확인
grep -n "^    async function loadData\|^    function reloadAndRefresh\|^    function displayQuestion\|^    async function handleGrade" index.html

# 출력 없어야 함 (모두 제거됨)
```

### 3. 라인 수 확인
```bash
# 제거 전후 비교
wc -l index.html
# 예상: 약 155줄 감소 (927-973=47, 986-999=14, 1271-1341=71, 1414-1436=23)
```

### 4. 최종 커밋
```bash
git add index.html
git commit -m "refactor: Phase 2.6 완료 - 중복 함수 완전 제거

Phase 2.1-2.5에서 모듈로 이동한 함수들의 중복 정의 제거:
- core/dataManager.js (47줄)
- core/storageManager.js (14줄)
- features/quiz/quizCore.js (71줄)
- features/quiz/grading.js (23줄)

총 155줄 감소, 코드베이스 명확화 완료

전체 기능 검증 완료:
- 페이지 로드 및 데이터 관리 ✅
- 퀴즈 시스템 (표시, 채점, 네비게이션) ✅
- 데이터 저장 및 플래그 관리 ✅
- UI 기능 (통계, 캘린더, 업적) ✅"

git push -u origin claude/refactor-quiz-features-review-011CUsfTCNQCMBNVW8FGBmAP
```

**예상 소요 시간**: 20분

---

## 🟢 Phase 3: 기능 모듈 분리 (다음 단계)

### Phase 3.1: features/filter/ 분리

**타겟 함수**:
```javascript
// features/filter/sourceFilter.js
- buildSourceFilterUI()
- getSelectedSourceGroups()
- detectSourceGroup()
- applySourceFilter()

// features/filter/chapterFilter.js (또는 quizCore에 통합)
- filterByChapterSelection()
```

**작업 순서**:
1. `features/filter/` 디렉토리 생성
2. `sourceFilter.js` 생성 및 함수 이동
3. app.js에 import 및 전역 노출
4. index.html에서 중복 제거
5. 테스트: 출처 필터링 정상 작동
6. 커밋

**예상 소요 시간**: 2시간

---

### Phase 3.2: features/summary/ 분리

**타겟 함수**:
```javascript
// features/summary/summaryCore.js
- updateSummary()
- updateSummaryHighlight()
- refreshPanels()
```

**작업 순서**:
1. `features/summary/` 디렉토리 생성
2. `summaryCore.js` 생성
3. 함수 이동 및 export
4. app.js 통합
5. 테스트: 요약 통계 업데이트
6. 커밋

**예상 소요 시간**: 1.5시간

---

### Phase 3.3: features/calendar/ 분리

**타겟 함수**:
```javascript
// features/calendar/calendar.js
- renderCalendarMonth()
- bindCalendarDateClick()

// features/calendar/stats.js
- renderStats()
- renderStatsDateNav()
```

**⚠️ 주의**: `initStatsDate`, `saveStatsDate`는 이미 storageManager에 있을 수 있음 → 확인 필요

**작업 순서**:
1. storageManager 확인 (날짜 함수 위치)
2. `features/calendar/` 디렉토리 생성
3. calendar.js, stats.js 생성
4. 함수 분리 및 이동
5. app.js 통합
6. 테스트: 캘린더 렌더링 및 통계 표시
7. 커밋

**예상 소요 시간**: 2시간

---

### Phase 3.4: features/settings/ 분리

**타겟 함수**:
```javascript
// features/settings/modals.js
- openApiModal()
- closeApiModal()
- ensureApiKeyGate()
- openSettingsModal()
- closeSettingsModal()

// features/settings/preferences.js
- loadSettings() // index.html line 982에 있음
- 다크모드 변경 핸들러
- AI 모델 변경 핸들러
```

**작업 순서**:
1. `features/settings/` 디렉토리 생성
2. modals.js, preferences.js 생성
3. 함수 및 이벤트 핸들러 이동
4. app.js 통합
5. 테스트: 설정 모달, 다크모드, AI 모델 변경
6. 커밋

**예상 소요 시간**: 1.5시간

---

### Phase 3.5: services/dataImportExport.js 분리

**타겟 함수**:
```javascript
// services/dataImportExport.js
- mergeQuizScores()
- exportDataBtn 이벤트 핸들러
- importDataBtn 이벤트 핸들러
- mergeDataBtn 이벤트 핸들러
```

**작업 순서**:
1. `services/dataImportExport.js` 생성
2. 함수 및 핸들러 이동
3. app.js 통합
4. 테스트: 데이터 내보내기/가져오기/병합
5. 커밋

**예상 소요 시간**: 1.5시간

---

## 📅 전체 타임라인

### 이번 주 (즉시 시작)
- **오늘**: Phase 2.6 완료 (1-2시간)
- **내일**: Phase 3.1-3.2 (filter, summary) (3-4시간)

### 다음 주
- Phase 3.3-3.5 (calendar, settings, import/export) (5시간)
- Phase 4 시작 (report 모듈)

### 타임라인 요약
| 작업 | 소요 시간 | 누적 |
|------|-----------|------|
| Phase 2.6 | 1-2h | 1-2h |
| Phase 3.1-3.2 | 3-4h | 4-6h |
| Phase 3.3-3.5 | 5h | 9-11h |
| Phase 4.x | 12-17h | 21-28h |
| Phase 5.x | 7-10h | 28-38h |

**총 예상**: 28-38시간 (4-5일 집중 작업)

---

## ⚠️ 각 단계 체크리스트

### 모듈 생성 시 반드시:
1. ✅ 모듈 파일 생성 (적절한 디렉토리)
2. ✅ 함수 export (named export 사용)
3. ✅ JSDoc 주석 추가
4. ✅ app.js에 import
5. ✅ window.* 전역 노출 (필요 시)
6. ✅ index.html 중복 제거
7. ✅ 동작 테스트
8. ✅ 명확한 커밋 메시지
9. ✅ 체크리스트 문서 업데이트

### 테스트 시 반드시:
- ✅ 브라우저 콘솔 에러 없음
- ✅ 해당 기능 정상 작동
- ✅ localStorage 데이터 보존
- ✅ 다른 기능에 영향 없음

### 커밋 시 반드시:
```bash
# 1. 스테이징 확인
git status
git diff --cached

# 2. 커밋 메시지 형식
# refactor: Phase X.Y - 작업명
#
# 상세 설명
# - 변경 사항 1
# - 변경 사항 2
#
# 테스트 완료:
# - 기능 1 ✅
# - 기능 2 ✅

# 3. 푸시
git push -u origin claude/refactor-quiz-features-review-011CUsfTCNQCMBNVW8FGBmAP
```

---

## 🚨 주의사항

### 절대 하지 말 것:
- ❌ 여러 Phase를 한 번에 작업
- ❌ 테스트 없이 커밋
- ❌ 중복 함수 제거 전에 다음 모듈 작업
- ❌ localStorage 데이터 손실 위험 작업

### 반드시 할 것:
- ✅ 한 번에 하나씩
- ✅ 각 단계마다 테스트
- ✅ 명확한 커밋 메시지
- ✅ localStorage 백업 권장

### 에러 발생 시:
1. **즉시 중단**
2. `git status` 확인
3. `git diff` 확인
4. 에러 로그 저장
5. 롤백 고려: `git checkout -- index.html`
6. 원인 분석 후 재시도

---

## 📊 진행 상황 추적

### Phase 2.6 체크리스트
- [ ] 2.6-A: core/dataManager 중복 제거
- [ ] 2.6-B: core/storageManager 중복 제거
- [ ] 2.6-C: quiz/quizCore 중복 제거
- [ ] 2.6-D: quiz/grading 중복 제거
- [ ] 2.6-E: 최종 검증 및 커밋

### Phase 3 체크리스트
- [ ] 3.1: features/filter/ 분리
- [ ] 3.2: features/summary/ 분리
- [ ] 3.3: features/calendar/ 분리
- [ ] 3.4: features/settings/ 분리
- [ ] 3.5: services/dataImportExport 분리

---

**다음 작업**: Phase 2.6-A (core/dataManager 중복 제거) 즉시 시작!

```bash
# 지금 바로 실행:
cd /home/user/gfdsstyu.github.io
cp index.html index.html.backup.phase2.6
grep -n "window.loadData" js/app.js  # 확인
# 그 다음 index.html line 927-973 삭제
```
