# 📘 감린이 2.0 - 상세 개발 계획서 (Final Version)

| | |
| :--- | :--- |
| **TO** | AI Development Agent |
| **FROM** | Project Owner |
| **PROJECT** | 감린이 2.0 - 지능형 리포트 및 스냅샷 기능 개발 |
| **DATE** | 2025년 11월 10일 |
| **VERSION** | 2.0 (피드백 반영 완료) |

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [현황 분석 (As-Is)](#2-현황-분석-as-is)
3. [개발 우선순위](#3-개발-우선순위)
4. [Task 2: 선택형 PDF 내보내기](#task-2-선택형-pdf-내보내기-우선순위-1)
5. [Task 3: HLR 기반 최적 복습 플래너](#task-3-hlr-기반-최적-복습-플래너-우선순위-2)
6. [Task 4: AI 차트 자동 해석](#task-4-ai-차트-자동-해석-우선순위-3)
7. [Task 1: 인-브라우저 스냅샷 기능](#task-1-인-브라우저-스냅샷-기능-우선순위-4)
8. [통합 테스트 시나리오](#8-통합-테스트-시나리오)
9. [롤백 계획](#9-롤백-계획)
10. [배포 체크리스트](#10-배포-체크리스트)

---

## 1. 프로젝트 개요

### 1.1 목표 (Objective)

1. **PDF 내보내기 개선:** 선택형 탭 인쇄 기능 구현 (현재 버그 수정 포함)
2. **스냅샷 기능 신설:** 브라우저 내 날짜별 학습 백업 시스템 구축
3. **리포트 지능화 (HLR):** 망각 곡선 기반 최적 복습 플래너
4. **리포트 지능화 (AI):** 차트 동향 자동 해석 기능

### 1.2 주요 피드백 반영 사항

- ✅ 기존 코드 충돌 분석 완료 및 통합 방안 수립
- ✅ 브라우저 호환성 대응 (Safari/iOS)
- ✅ 성능 최적화 전략 수립
- ✅ localStorage 용량 최적화 (압축 라이브러리)
- ✅ 구체적인 구현 예시 코드 포함
- ✅ 단계별 롤백 계획 수립

---

## 2. 현황 분석 (As-Is)

### 2.1 기존 기능 현황

#### 2.1.1 데이터 관리 (settingsCore.js)
```javascript
// index.html:529-537
- ✅ 데이터 내보내기 (export-data-btn)
- ✅ 데이터 가져오기 (import-data-btn)
- ✅ 데이터 병합 (merge-data-btn)
```

#### 2.1.2 리포트 스냅샷 (reportCore.js:252-276)
```javascript
// 현재: AI 분석 결과만 파일 다운로드 방식
- ⚠️ questionScores는 저장하지 않음
- ⚠️ localStorage 활용 안 함
```

#### 2.1.3 PDF 내보내기 (reportCore.js:345-361)
```javascript
// 현재: 단순 window.print() 호출
- ❌ 전체 페이지가 인쇄되는 버그
- ❌ 탭 선택 기능 없음
```

#### 2.1.4 액션 플랜 (reportCore.js:147-183)
```javascript
// 현재: 시간 기반 분류
- urgent: 3일 이내
- weekly: 10일 이내
- longterm: 10일 이후
```

#### 2.1.5 AI 분석 (analysis.js:52-259)
```javascript
// 현재: 오답 데이터만 분석
- ⚠️ 차트 데이터 미연동
- ⚠️ trendhelp.html 해석 로직 미반영
```

### 2.2 기술 스택

- **프론트엔드:** Vanilla JavaScript (ES6 Modules)
- **차트:** Chart.js
- **AI:** Gemini API (geminiApi.js)
- **스토리지:** localStorage
- **스타일:** Tailwind CSS

---

## 3. 개발 우선순위

| 순위 | Task | 이유 | 리스크 | 예상 공수 |
|------|------|------|--------|-----------|
| **1** | Task 2: PDF 내보내기 | 빠른 효과, 낮은 리스크 | 🟢 Low | 2-3시간 |
| **2** | Task 3: HLR 복습 플래너 | HLR 코드 이미 완성 | 🟡 Medium | 3-4시간 |
| **3** | Task 4: AI 차트 해석 | 프롬프트 수정 위주 | 🟡 Medium | 2-3시간 |
| **4** | Task 1: 스냅샷 기능 | 가장 복잡, 기존 기능 충돌 | 🔴 High | 5-6시간 |

---

## Task 2: 선택형 PDF 내보내기 (우선순위 1)

### 2.1 목표

- ❌ **버그 수정:** "무지성 전체 페이지 인쇄" 방지
- ✅ **신규 기능:** 탭 선택 UI (차트, AI 분석, 액션 플랜)
- ✅ **브라우저 호환성:** Safari/iOS 대응

### 2.2 파일 수정 목록

```
📁 수정 대상
├─ index.html                    # PDF 옵션 모달 UI 추가
├─ js/features/report/reportCore.js  # 인쇄 로직 수정
└─ (CSS는 index.html 내부 <style> 태그에 포함)
```

### 2.3 구현 상세

#### 2.3.1 UI 추가 (index.html)

**위치:** `#report-modal` 내부 최하단에 추가

```html
<!-- PDF 옵션 선택 모달 (숨김 상태) -->
<div id="pdf-options-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1200]">
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">📤 내보내기 옵션 선택</h3>

    <!-- 전체 선택/해제 -->
    <div class="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" id="pdf-check-all" class="w-4 h-4 rounded" checked>
        <span class="font-semibold text-gray-700 dark:text-gray-300">전체 선택</span>
      </label>
    </div>

    <!-- 개별 탭 선택 -->
    <div class="space-y-3 mb-6">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" id="pdf-check-tab1" class="pdf-tab-checkbox w-4 h-4 rounded" checked>
        <span class="text-gray-700 dark:text-gray-300">📊 차트 분석</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" id="pdf-check-tab2" class="pdf-tab-checkbox w-4 h-4 rounded" checked>
        <span class="text-gray-700 dark:text-gray-300">🧠 AI 심층 분석</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" id="pdf-check-tab3" class="pdf-tab-checkbox w-4 h-4 rounded" checked>
        <span class="text-gray-700 dark:text-gray-300">📝 액션 플랜 & 오답노트</span>
      </label>
    </div>

    <!-- 버튼 -->
    <div class="flex gap-3">
      <button id="pdf-options-cancel-btn" class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
        취소
      </button>
      <button id="pdf-options-execute-btn" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        실행
      </button>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400 mt-4">
      ℹ️ 선택한 탭만 PDF로 내보냅니다. 브라우저의 인쇄 대화상자에서 "PDF로 저장"을 선택하세요.
    </p>
  </div>
</div>
```

#### 2.3.2 CSS 수정 (index.html 내 `<style id="report-css">`)

**기존 CSS 완전 교체:**

```css
/* ================================================
   PDF 내보내기 전용 스타일 (리포트 전용)
   ================================================ */
@media print {
  /* 1. 전체 페이지 초기화 */
  * {
    background: white !important;
    color: black !important;
    box-shadow: none !important;
  }

  /* 2. 불필요한 요소 숨김 */
  body > *:not(#report-modal),
  nav, aside, header, footer,
  button, .no-print,
  #left-dashboard,
  #drawer-backdrop,
  .report-tab,
  #report-close-btn,
  #report-refresh-btn,
  #report-save-snapshot-btn,
  #report-load-snapshot-btn,
  #report-print-btn,
  #pdf-options-modal {
    display: none !important;
  }

  /* 3. 리포트 모달만 표시 */
  #report-modal {
    display: block !important;
    position: static !important;
    background: white !important;
    overflow: visible !important;
    max-height: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  #report-modal > div {
    max-height: none !important;
    overflow: visible !important;
    box-shadow: none !important;
    border: none !important;
  }

  /* 4. 선택 해제된 탭 숨김 */
  .print-hidden {
    display: none !important;
  }

  /* 5. 모든 탭 컨텐츠를 순차적으로 표시 */
  .report-content {
    display: block !important;
    page-break-after: always;
    page-break-inside: avoid;
    margin-bottom: 20px;
  }

  .report-content:last-child {
    page-break-after: auto;
  }

  /* 6. 차트 최적화 */
  canvas {
    max-height: 400px !important;
    page-break-inside: avoid;
  }

  /* 7. 페이지 헤더/푸터 */
  @page {
    margin: 1.5cm;
    size: A4;
  }

  /* 8. 제목 스타일 */
  h1, h2, h3 {
    page-break-after: avoid;
    color: black !important;
  }

  /* 9. 다크모드 비활성화 */
  .dark {
    color: black !important;
  }
}
```

#### 2.3.3 로직 개발 (js/features/report/reportCore.js)

**기존 코드 위치:** Line 345-361

**수정 내용:**

```javascript
/**
 * PDF 옵션 모달 열기
 */
function openPdfOptionsModal() {
  const modal = document.getElementById('pdf-options-modal');
  if (!modal) return;

  // 모든 체크박스 초기화
  document.getElementById('pdf-check-all').checked = true;
  document.querySelectorAll('.pdf-tab-checkbox').forEach(cb => cb.checked = true);

  modal.classList.remove('hidden');
}

/**
 * PDF 옵션 모달 닫기
 */
function closePdfOptionsModal() {
  const modal = document.getElementById('pdf-options-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

/**
 * PDF 내보내기 실행
 */
function executePdfExport() {
  const tab1 = document.getElementById('pdf-check-tab1').checked;
  const tab2 = document.getElementById('pdf-check-tab2').checked;
  const tab3 = document.getElementById('pdf-check-tab3').checked;

  // 최소 1개는 선택해야 함
  if (!tab1 && !tab2 && !tab3) {
    showToast('최소 1개 탭을 선택해주세요', 'warn');
    return;
  }

  // 선택 해제된 탭에 .print-hidden 클래스 추가
  const contents = [
    { element: document.getElementById('report-content-1'), checked: tab1 },
    { element: document.getElementById('report-content-2'), checked: tab2 },
    { element: document.getElementById('report-content-3'), checked: tab3 }
  ];

  contents.forEach(({ element, checked }) => {
    if (element) {
      if (!checked) {
        element.classList.add('print-hidden');
      } else {
        element.classList.remove('print-hidden');
      }
    }
  });

  // 모달 닫기
  closePdfOptionsModal();

  // 인쇄 실행
  window.print();

  // 인쇄 후 정리 (브라우저 호환성 대응)
  const cleanup = () => {
    contents.forEach(({ element }) => {
      if (element) element.classList.remove('print-hidden');
    });
  };

  // 표준 이벤트
  window.addEventListener('afterprint', cleanup, { once: true });

  // Safari/iOS 대응: 포커스 복귀 시 정리
  window.addEventListener('focus', () => {
    setTimeout(cleanup, 100);
  }, { once: true });
}

/**
 * 전체 선택/해제 토글
 */
function toggleAllCheckboxes() {
  const checkAll = document.getElementById('pdf-check-all');
  const checkboxes = document.querySelectorAll('.pdf-tab-checkbox');
  checkboxes.forEach(cb => cb.checked = checkAll.checked);
}

/**
 * 개별 체크박스 변경 시 전체 선택 상태 갱신
 */
function updateCheckAllStatus() {
  const checkAll = document.getElementById('pdf-check-all');
  const checkboxes = document.querySelectorAll('.pdf-tab-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkAll.checked = allChecked;
}
```

**이벤트 리스너 추가 (initReportListeners 함수 내):**

```javascript
// 기존 코드 수정 (Line 346)
el.reportPrintBtn?.addEventListener('click', openPdfOptionsModal); // window.print() 대신

// 신규 이벤트 리스너 추가
document.getElementById('pdf-options-cancel-btn')?.addEventListener('click', closePdfOptionsModal);
document.getElementById('pdf-options-execute-btn')?.addEventListener('click', executePdfExport);
document.getElementById('pdf-check-all')?.addEventListener('change', toggleAllCheckboxes);

// 개별 체크박스에 리스너 추가
document.querySelectorAll('.pdf-tab-checkbox').forEach(checkbox => {
  checkbox.addEventListener('change', updateCheckAllStatus);
});
```

### 2.4 테스트 시나리오

- [ ] **TC-2.1:** 모든 탭 선택 → PDF 생성 → 3개 탭 모두 포함 확인
- [ ] **TC-2.2:** 탭 1개만 선택 → PDF 생성 → 1개만 포함 확인
- [ ] **TC-2.3:** 모든 탭 해제 → "최소 1개 선택" 경고 확인
- [ ] **TC-2.4:** Chrome에서 인쇄 취소 → `.print-hidden` 정리 확인
- [ ] **TC-2.5:** Safari/iOS에서 인쇄 → 정상 작동 확인
- [ ] **TC-2.6:** 다크모드에서 PDF 생성 → 흰 배경 확인
- [ ] **TC-2.7:** 차트가 PDF에 정상 렌더링 확인

### 2.5 롤백 계획

**롤백 조건:**
- Safari에서 인쇄 후 `.print-hidden`이 제거되지 않음
- PDF에서 차트가 깨짐

**롤백 방법:**
```bash
git revert <commit-hash>
# 또는
git checkout HEAD~1 -- js/features/report/reportCore.js index.html
```

---

## Task 3: HLR 기반 최적 복습 플래너 (우선순위 2)

### 3.1 목표

- ✅ 시간 기반 분류 → **회상 확률 기반 분류**로 전환
- ✅ 사용자 친화적 UI 텍스트
- ✅ 성능 최적화 (1000+ 문제 환경 대응)
- ✅ 기존 로직과 병행 운영 (설정 옵션)

### 3.2 파일 수정 목록

```
📁 수정 대상
├─ js/features/report/reportCore.js  # getReportData, renderActionPlan 수정
├─ js/features/review/hlrDataset.js  # (수정 없음, 기존 사용)
└─ index.html                        # 설정 모달에 복습 기준 옵션 추가
```

### 3.3 구현 상세

#### 3.3.1 HLR 데이터 수집 (reportCore.js)

**수정 위치:** `getReportData()` 함수 (Line 82-122)

**기존 코드:**
```javascript
// Weak problems
if (score < threshold) {
  weakProblems.push({ qid, problem, score, date });
}
```

**수정 후:**
```javascript
import { LocalHLRPredictor, calculateRecallProbability } from '../review/hlrDataset.js';

// ... (함수 시작 부분)
const predictor = new LocalHLRPredictor(); // 한 번만 생성 (성능 최적화)

// ... (루프 내부)
// Weak problems
if (score < threshold) {
  const hlrData = calculateRecallProbability(qid, predictor);

  weakProblems.push({
    qid,
    problem,
    score,
    date,
    // HLR 데이터 추가
    p_current: hlrData?.p_current || null,
    h_pred: hlrData?.h_pred || null,
    timeSinceLastReview: hlrData?.timeSinceLastReview || null
  });
}
```

#### 3.3.2 액션 플랜 재구성 (reportCore.js)

**수정 위치:** `renderActionPlan()` 함수 (Line 147-183)

**신규 코드:**

```javascript
/**
 * 액션 플랜 렌더링 (HLR 기반 복습 우선순위)
 * @param {Array} weakProblems - 약점 문제 목록 (HLR 데이터 포함)
 */
export function renderActionPlan(weakProblems) {
  const now = Date.now();
  const reviewMode = localStorage.getItem('reviewMode') || 'hlr'; // 'hlr' or 'time'

  let urgent = [], weekly = [], longterm = [];

  if (reviewMode === 'hlr') {
    // HLR 기반 분류
    for (const wp of weakProblems) {
      if (wp.p_current === null) {
        // HLR 데이터 없으면 시간 기반으로 fallback
        const daysSince = (now - wp.date) / (1000 * 60 * 60 * 24);
        if (daysSince <= 3) urgent.push(wp);
        else if (daysSince <= 10) weekly.push(wp);
        else longterm.push(wp);
      } else {
        // HLR 회상 확률 기반
        if (wp.p_current < 0.5) {
          urgent.push(wp);
        } else if (wp.p_current < 0.8) {
          weekly.push(wp);
        } else {
          longterm.push(wp);
        }
      }
    }
  } else {
    // 기존 시간 기반 분류
    for (const wp of weakProblems) {
      const daysSince = (now - wp.date) / (1000 * 60 * 60 * 24);
      if (daysSince <= 3) urgent.push(wp);
      else if (daysSince <= 10) weekly.push(wp);
      else longterm.push(wp);
    }
  }

  // UI 렌더링
  const urgentList = $('action-urgent-list');
  const weeklyList = $('action-weekly-list');
  const longtermList = $('action-longterm-list');

  // 섹션 제목 동적 변경
  const urgentTitle = $('action-urgent-title');
  const weeklyTitle = $('action-weekly-title');
  const longtermTitle = $('action-longterm-title');

  if (reviewMode === 'hlr') {
    if (urgentTitle) urgentTitle.innerHTML = '🚨 긴급 복습 필요 <span class="text-sm font-normal text-gray-500">(까먹기 직전! 회상 확률 &lt; 50%)</span>';
    if (weeklyTitle) weeklyTitle.innerHTML = '⚠️ 이번 주 복습 <span class="text-sm font-normal text-gray-500">(조금씩 희미해짐, 회상 확률 50~80%)</span>';
    if (longtermTitle) longtermTitle.innerHTML = '✅ 장기 기억 <span class="text-sm font-normal text-gray-500">(안정적, 회상 확률 ≥ 80%)</span>';
  } else {
    if (urgentTitle) urgentTitle.textContent = '🚨 긴급 복습 (3일 이내)';
    if (weeklyTitle) weeklyTitle.textContent = '⚠️ 이번 주 복습 (10일 이내)';
    if (longtermTitle) longtermTitle.textContent = '📌 장기 복습 (10일 이후)';
  }

  // 문제 목록 렌더링 (HLR 정보 포함)
  const renderProblemItem = (wp) => {
    let hlrInfo = '';
    if (reviewMode === 'hlr' && wp.p_current !== null) {
      const pPercent = Math.round(wp.p_current * 100);
      const predictor = new LocalHLRPredictor();
      const nextReviewDays = Math.round(predictor.getNextReviewDelta(wp.h_pred || 14, 0.9));

      hlrInfo = `<span class="text-xs text-gray-500">
        회상 확률: ${pPercent}% | 다음 복습: ${nextReviewDays}일 ${nextReviewDays <= 0 ? '전 (긴급!)' : '후'}
      </span>`;
    }

    const title = wp.problem.problemTitle || wp.problem.물음?.slice(0, 30) + '...';
    return `<div class="text-sm border-b pb-2 mb-2 last:border-b-0">
      <div>• ${title} <span class="text-red-600">(${wp.score}점)</span></div>
      ${hlrInfo ? `<div class="ml-3 mt-1">${hlrInfo}</div>` : ''}
    </div>`;
  };

  if (urgentList) {
    urgentList.innerHTML = urgent.length
      ? urgent.slice(0, 10).map(renderProblemItem).join('')
      : '<div class="text-sm text-gray-500">없음</div>';
  }

  if (weeklyList) {
    weeklyList.innerHTML = weekly.length
      ? weekly.slice(0, 10).map(renderProblemItem).join('')
      : '<div class="text-sm text-gray-500">없음</div>';
  }

  if (longtermList) {
    longtermList.innerHTML = longterm.length
      ? longterm.slice(0, 10).map(renderProblemItem).join('')
      : '<div class="text-sm text-gray-500">없음</div>';
  }

  // 기존 오답노트 섹션은 그대로 유지
  renderWrongAnswers(weakProblems);
}

/**
 * 오답노트 렌더링 (기존 코드 분리)
 */
function renderWrongAnswers(weakProblems) {
  const wrongAnswers = $('action-wrong-answers');
  if (!wrongAnswers) return;

  const uniqueProblems = new Map();
  for (const wp of weakProblems) {
    if (!uniqueProblems.has(wp.qid) || uniqueProblems.get(wp.qid).score > wp.score) {
      uniqueProblems.set(wp.qid, wp);
    }
  }

  wrongAnswers.innerHTML = Array.from(uniqueProblems.values()).slice(0, 20).map(wp => {
    const rec = window.questionScores[wp.qid];
    const userAnswer = rec?.user_answer || '(답안 없음)';
    const aiFeedback = rec?.feedback || '(피드백 없음)';
    return `
      <div class="border rounded-lg p-4">
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-semibold">${wp.problem.problemTitle || '문항 ' + wp.problem.표시번호}</h4>
          <span class="text-xs px-2 py-1 rounded-full ${wp.score < 60 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">${wp.score}점</span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2"><strong>물음:</strong> ${wp.problem.물음}</p>
        <p class="text-sm mb-2"><strong>내 답안:</strong> ${userAnswer}</p>
        <button class="show-answer-btn text-sm text-blue-600 hover:underline" data-qid="${wp.qid}">
          🧠 모범 답안 및 AI 총평 보기
        </button>
        <div class="answer-detail hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
          <p class="text-sm mb-2"><strong>모범 답안:</strong> ${wp.problem.정답}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400"><strong>AI 총평:</strong> ${aiFeedback}</p>
        </div>
      </div>
    `;
  }).join('');

  // Add toggle listeners
  wrongAnswers.querySelectorAll('.show-answer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const detail = e.target.nextElementSibling;
      if (detail) {
        detail.classList.toggle('hidden');
        e.target.textContent = detail.classList.contains('hidden') ?
          '🧠 모범 답안 및 AI 총평 보기' : '🙈 답안 숨기기';
      }
    });
  });
}
```

#### 3.3.3 설정 UI 추가 (index.html)

**위치:** `#settings-modal` 내부, "데이터 관리" 섹션 위에 추가

```html
<!-- 복습 기준 설정 -->
<div class="mb-6">
  <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">복습 기준 설정</h3>
  <select id="review-mode-select" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
    <option value="hlr">HLR 기반 (추천) - 망각 곡선 기반 지능형 복습</option>
    <option value="time">시간 기반 (기존) - 3일/10일 기준 단순 분류</option>
  </select>
  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
    HLR(망각 곡선) 기반은 개인별 학습 패턴을 분석하여 최적의 복습 시기를 제안합니다.
  </p>
</div>
```

**이벤트 리스너 추가 (settingsCore.js):**

```javascript
// initSettingsModalListeners 함수 내부에 추가
el.reviewModeSelect?.addEventListener('change', (e) => {
  const mode = e.target.value;
  localStorage.setItem('reviewMode', mode);
  showToast(`복습 기준 변경: ${mode === 'hlr' ? 'HLR 기반' : '시간 기반'}`);
});

// openSettingsModal 함수에 초기값 로드 추가
if (el.reviewModeSelect) {
  el.reviewModeSelect.value = localStorage.getItem('reviewMode') || 'hlr';
}
```

#### 3.3.4 HTML 수정 (index.html - 액션 플랜 섹션)

**위치:** `#report-content-3` 내부

```html
<!-- 기존 섹션 제목에 id 추가 -->
<h3 id="action-urgent-title" class="text-lg font-semibold mb-3">🚨 긴급 복습 필요</h3>
<div id="action-urgent-list" class="mb-6">
  <!-- 동적 렌더링 -->
</div>

<h3 id="action-weekly-title" class="text-lg font-semibold mb-3">⚠️ 이번 주 복습</h3>
<div id="action-weekly-list" class="mb-6">
  <!-- 동적 렌더링 -->
</div>

<h3 id="action-longterm-title" class="text-lg font-semibold mb-3">✅ 장기 기억</h3>
<div id="action-longterm-list" class="mb-6">
  <!-- 동적 렌더링 -->
</div>
```

### 3.4 테스트 시나리오

- [ ] **TC-3.1:** HLR 모드에서 회상 확률 < 50% 문제가 "긴급"에 표시
- [ ] **TC-3.2:** 시간 모드로 전환 → 기존 로직 작동 확인
- [ ] **TC-3.3:** HLR 데이터 없는 문제 → 시간 기반 fallback 확인
- [ ] **TC-3.4:** 1000개 문제 환경에서 성능 테스트 (리포트 생성 < 2초)
- [ ] **TC-3.5:** "다음 복습: X일 후" 계산 정확도 검증

### 3.5 롤백 계획

**롤백 조건:**
- HLR 계산에서 NaN/Infinity 발생
- 성능 저하 (리포트 생성 > 5초)

**롤백 방법:**
```javascript
// localStorage에서 'reviewMode'를 'time'으로 강제 변경
localStorage.setItem('reviewMode', 'time');
```

---

## Task 4: AI 차트 자동 해석 (우선순위 3)

### 4.1 목표

- ✅ AI가 차트 데이터 자동 분석
- ✅ 골든크로스/데드크로스 자동 감지 및 해석
- ✅ trendhelp.html 해석 로직 활용
- ✅ 토큰 최적화 (비용 절감)

### 4.2 파일 수정 목록

```
📁 수정 대상
├─ js/features/report/analysis.js    # AI 프롬프트 수정
└─ js/features/report/charts.js      # (수정 없음, 데이터 추출 함수만 export)
```

### 4.3 구현 상세

#### 4.3.1 차트 데이터 추출 함수 (analysis.js 신규 추가)

```javascript
import { calculateMovingAverage } from './charts.js'; // export 필요

/**
 * 차트 컨텍스트 추출 (AI 프롬프트용)
 * @param {object} reportData - getReportData() 반환값
 * @returns {object} 차트 분석 컨텍스트
 */
function extractChartContext(reportData) {
  const { dailyData, chapterData } = reportData;

  // 일일 평균 점수 계산
  const sorted = Array.from(dailyData.entries())
    .filter(([, v]) => v.scores.length > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (sorted.length === 0) {
    return null; // 데이터 없음
  }

  const avgScores = sorted.map(([, v]) => {
    const avg = v.scores.reduce((a, b) => a + b, 0) / v.scores.length;
    return Math.round(avg * 10) / 10;
  });

  // 이동평균 계산 (charts.js의 함수 재사용)
  const ma5 = calculateMovingAverage(avgScores, 5);
  const ma20 = calculateMovingAverage(avgScores, 20);
  const ma60 = calculateMovingAverage(avgScores, 60);

  // 최근 7일치만 추출 (토큰 절약)
  const recentDays = 7;
  const recentMA5 = ma5.slice(-recentDays);
  const recentMA20 = ma20.slice(-recentDays);
  const recentMA60 = ma60.slice(-recentDays);

  // 골든크로스/데드크로스 감지
  let lastGoldenCross = null;
  let lastDeadCross = null;

  for (let i = ma5.length - 7; i < ma5.length; i++) {
    if (i < 1) continue;
    if (ma5[i] !== null && ma20[i] !== null && ma5[i-1] !== null && ma20[i-1] !== null) {
      // Golden Cross
      if (ma5[i-1] <= ma20[i-1] && ma5[i] > ma20[i]) {
        lastGoldenCross = {
          date: sorted[i][0],
          daysAgo: sorted.length - 1 - i
        };
      }
      // Dead Cross
      if (ma5[i-1] >= ma20[i-1] && ma5[i] < ma20[i]) {
        lastDeadCross = {
          date: sorted[i][0],
          daysAgo: sorted.length - 1 - i
        };
      }
    }
  }

  // 정배열 확인
  const lastIdx = ma5.length - 1;
  const isPerfectOrder = ma5[lastIdx] && ma20[lastIdx] && ma60[lastIdx] &&
                        ma5[lastIdx] > ma20[lastIdx] && ma20[lastIdx] > ma60[lastIdx];

  // 취약 단원 Top 3
  const weakChapters = Array.from(chapterData.entries())
    .map(([chapter, data]) => ({
      chapter,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 3);

  return {
    recentMA5,
    recentMA20,
    recentMA60,
    lastGoldenCross,
    lastDeadCross,
    isPerfectOrder,
    weakChapters,
    currentMA5: ma5[lastIdx],
    currentMA20: ma20[lastIdx],
    currentMA60: ma60[lastIdx]
  };
}
```

#### 4.3.2 차트 해석 규칙 정의 (analysis.js 상단)

```javascript
/**
 * 차트 해석 규칙 (trendhelp.html에서 핵심 내용 추출)
 */
const CHART_INTERPRETATION_RULES = `
# 학습 점수 추세 차트 해석 규칙

## 1. 이동평균선 정의
- **5일선 (단기 컨디션선):** 최근 5 학습일의 평균 점수. 단기 학습 성과를 반영.
- **20일선 (중기 실력선) ⭐️:** 최근 20 학습일의 평균 점수. 진짜 실력 추세를 나타내는 핵심 지표.
- **60일선 (장기 기반선):** 최근 60 학습일의 평균 점수. 기본 실력 수준.

## 2. 주요 시그널

### 골든 크로스 (Golden Cross) 🟢
- **정의:** 5일선이 20일선을 하향→상향 돌파
- **의미:** 단기 학습 성과가 중기 실력을 추월 → **긍정적 신호**
- **해석:** "최근 학습법이 효과적으로 작용하고 있습니다. 현재 페이스를 유지하세요."
- **조치:** 현재 학습 전략 유지 및 강화

### 데드 크로스 (Dead Cross) 🔴
- **정의:** 5일선이 20일선을 상향→하향 이탈
- **의미:** 최근 컨디션 저하 → **경고 신호**
- **해석:** "최근 학습 성과가 떨어지고 있습니다. 슬럼프이거나 학습 방법에 문제가 있을 수 있습니다."
- **조치:** 학습 방법 점검, 휴식 또는 전략 변경 필요

### 정배열 (Perfect Order) 🚀
- **정의:** 5일선 > 20일선 > 60일선 (3개 선이 모두 상승 방향으로 정렬)
- **의미:** 단기·중기·장기 모두 상승 추세 → **최상의 상태**
- **해석:** "현재 학습이 매우 안정적으로 상승 중입니다. 합격 가능성이 높아지고 있습니다."
- **조치:** 현재 페이스 유지

### 역배열 (Reverse Order) ⚠️
- **정의:** 5일선 < 20일선 < 60일선
- **의미:** 장기 침체 상태
- **해석:** "학습 방법 전반을 재점검해야 합니다. 개념 복습이 필요합니다."

## 3. 중요 원칙
- **단기 등락에 일희일비하지 말 것:** 5일선은 변동성이 크므로, 20일선(중기) 추세를 더 신뢰해야 합니다.
- **난이도 일관성 전제:** 매일 유사한 난이도의 문제를 풀 때 차트가 유효합니다.
- **진단 도구임을 인지:** 이 차트는 미래를 예측하는 도구가 아니라, 현재 상태를 진단하는 계기판입니다.

## 4. AI 분석 시 활용 방법
사용자의 차트 데이터를 받으면:
1. 골든크로스/데드크로스 발생 여부를 확인하고, 발생 시점을 명시하세요.
2. 정배열/역배열 상태를 진단하세요.
3. 20일선의 방향(상승/하락/보합)을 분석하세요.
4. 위 해석 규칙에 따라 구체적인 조치 사항을 제안하세요.
`;
```

#### 4.3.3 AI 프롬프트 수정 (analysis.js)

**수정 위치:** `startAIAnalysis()` 함수 내부 (Line 91-242)

**기존 프롬프트 끝부분에 추가:**

```javascript
export async function startAIAnalysis() {
  // ... (기존 코드)

  try {
    const data = getReportData();

    // 차트 컨텍스트 추출
    const chartContext = extractChartContext(data);

    // ... (기존 weakProblemsSummary 코드)

    // 프롬프트 확장
    const prompt = `[시스템 역할 정의]

당신은 사용자의 CPA 2차 회계감사 시험 합격을 돕는 AI 학습 코치입니다.
단, 당신의 전문적 페르소나는 다음 두 역할을 결합합니다:

20년 차 현직 회계사(CPA)
풍부한 실무 경험과 기준서·세법·감사절차에 정통한 전문가입니다.

회계감사 2차 시험 '채점위원'
답안을 기준서적 문구와 실제 평가 기준으로 냉철히 판단할 수 있는 평가자입니다.

[추가 역할: 학습 추세 분석가]
당신은 사용자의 학습 점수 추세 차트를 분석하여, 골든크로스·데드크로스·정배열 등의 시그널을 자동으로 해석합니다.

[차트 해석 규칙]
${CHART_INTERPRETATION_RULES}

[사용자의 차트 데이터]
${chartContext ? `
- 최근 7일 이동평균:
  - 5일선: ${chartContext.recentMA5.join(', ')}
  - 20일선: ${chartContext.recentMA20.join(', ')}
  - 60일선: ${chartContext.recentMA60.join(', ')}

- 현재 이동평균:
  - 5일선: ${chartContext.currentMA5}
  - 20일선: ${chartContext.currentMA20}
  - 60일선: ${chartContext.currentMA60}

- 골든크로스: ${chartContext.lastGoldenCross ? `${chartContext.lastGoldenCross.daysAgo}일 전 발생 (${chartContext.lastGoldenCross.date})` : '최근 7일 내 발생 없음'}
- 데드크로스: ${chartContext.lastDeadCross ? `${chartContext.lastDeadCross.daysAgo}일 전 발생 (${chartContext.lastDeadCross.date})` : '최근 7일 내 발생 없음'}
- 정배열 상태: ${chartContext.isPerfectOrder ? '예 🚀 (5일 > 20일 > 60일)' : '아니오'}

- 취약 단원 Top 3:
${chartContext.weakChapters.map((c, i) => `  ${i+1}. ${c.chapter}: 평균 ${c.avgScore}점`).join('\n')}
` : '(차트 데이터 부족)'}

[핵심 어조 지침]
... (기존 프롬프트 내용 유지)

[출력 형식 (Markdown)]
ㄱ 감린이 AI 채점위원 딥러닝 리포트

안녕하세요. 최근 학습 데이터를 채점위원의 시각으로 면밀히 분석했습니다.
객관적 데이터로 '현재 위치'를 진단하고, 성장 방향을 함께 설계해보겠습니다.

📊 차트 추세 분석 (자동 생성)

[여기에 차트 데이터 기반 자동 분석을 추가하세요]
- 골든크로스/데드크로스 발생 여부와 의미
- 정배열 상태 진단
- 20일선 방향성 분석
- 차트 기반 종합 진단 및 조치 사항

예시:
"최근 ${chartContext?.lastGoldenCross ? chartContext.lastGoldenCross.daysAgo + '일 전' : '7일 이내'} 골든크로스가 발생했습니다.
이는 단기 학습 성과(5일선)가 중기 실력(20일선)을 추월했다는 의미로, 현재 학습법이 효과적으로 작용하고 있음을 나타냅니다.
${chartContext?.isPerfectOrder ? '또한 정배열 상태(5일 > 20일 > 60일)가 형성되어, 단기·중기·장기 모두 상승 추세입니다. 현재 페이스를 유지하세요.' : ''}"

1️⃣ 정량적 학습 성과 (Quantitative Performance)
... (기존 프롬프트 내용 유지)

2️⃣ 답안 서술 능력 진단 (Qualitative Diagnosis)
... (기존 프롬프트 내용 유지)

3️⃣ 행동 패턴 분석 (Behavioral Pattern)
... (기존 프롬프트 내용 유지)

4️⃣ Top 3 교정 노트 (채점위원 첨삭)
... (기존 프롬프트 내용 유지)

🧾 총평 (Encouragement & Next Steps)
... (기존 프롬프트 내용 유지)

[추가 기술 지침]
- 차트 데이터가 제공되면, 반드시 "📊 차트 추세 분석" 섹션을 리포트 최상단에 포함하세요.
- 골든크로스/데드크로스가 발생했다면, 그 의미를 사용자가 이해하기 쉽게 설명하세요.
- 차트 데이터가 없거나 부족하면 해당 섹션을 생략하세요.

[오답 데이터]
${JSON.stringify(weakProblemsSummary, null, 2)}

마크다운 형식으로 답변하세요.`;

    const response = await callGeminiTextAPI(prompt, window.geminiApiKey);

    // ... (기존 코드)
  } catch (err) {
    // ... (기존 코드)
  }
}
```

#### 4.3.4 charts.js 수정 (함수 export)

**수정 위치:** charts.js 최상단

```javascript
/**
 * 이동평균 계산 (export for analysis.js)
 * @param {Array<number>} data - 데이터 배열
 * @param {number} period - 이동평균 기간 (일)
 * @returns {Array<number|null>} - 이동평균 배열
 */
export function calculateMovingAverage(data, period) {
  // ... (기존 코드 그대로)
}
```

### 4.4 테스트 시나리오

- [ ] **TC-4.1:** 골든크로스 발생한 데이터 → AI가 자동 감지 및 해석 확인
- [ ] **TC-4.2:** 데드크로스 발생한 데이터 → AI가 경고 메시지 생성 확인
- [ ] **TC-4.3:** 정배열 상태 → AI가 긍정적 피드백 생성 확인
- [ ] **TC-4.4:** 차트 데이터 없을 때 → 해당 섹션 생략 확인
- [ ] **TC-4.5:** 토큰 사용량 측정 (최근 7일 vs 전체 기간)

### 4.5 롤백 계획

**롤백 조건:**
- AI가 차트 데이터를 잘못 해석
- 토큰 비용 과다 발생

**롤백 방법:**
```javascript
// extractChartContext() 함수의 recentDays 값을 0으로 변경
const recentDays = 0; // 차트 분석 비활성화
```

---

## Task 1: 인-브라우저 스냅샷 기능 (우선순위 4)

### 1.1 목표

- ✅ 기존 "리포트 스냅샷"과 구분되는 "학습 데이터 스냅샷"
- ✅ localStorage 활용한 시각적 백업/복원
- ✅ 압축 라이브러리 도입 (용량 최적화)
- ✅ 사용자 친화적 UI (날짜, 레이블, 통계)

### 1.2 파일 수정 목록

```
📁 수정 대상
├─ index.html                        # 설정 모달 UI 추가
├─ js/features/settings/settingsCore.js  # 스냅샷 로직 구현
└─ (CDN 추가) lz-string 라이브러리
```

### 1.3 구현 상세

#### 1.3.1 압축 라이브러리 추가 (index.html)

**위치:** `<head>` 섹션 내 다른 CDN 스크립트 아래

```html
<!-- LZ-String 압축 라이브러리 (localStorage 용량 최적화) -->
<script src="https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js"></script>
```

#### 1.3.2 UI 추가 (index.html)

**위치:** `#settings-modal` 내부, "데이터 관리" 섹션 재구성

```html
<!-- 데이터 관리 섹션 재구성 -->
<div class="mb-6">
  <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">데이터 관리</h3>

  <!-- 신규: 학습 스냅샷 관리 -->
  <div class="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
    <h4 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">📸 학습 스냅샷 (브라우저 내 백업)</h4>
    <p class="text-xs text-blue-700 dark:text-blue-300 mb-3">
      현재 학습 상태를 브라우저에 저장하고, 나중에 불러올 수 있습니다. (최대 5개)
    </p>

    <button id="save-snapshot-btn" class="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition mb-3">
      💾 현재 학습 상태 저장
    </button>

    <!-- 스냅샷 목록 컨테이너 -->
    <div id="snapshot-list-container" class="space-y-2">
      <!-- 동적으로 렌더링됨 -->
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
      ⚠️ 브라우저 데이터를 삭제하면 스냅샷도 함께 사라집니다. 중요한 백업은 "수동 백업(JSON)"을 이용하세요.
    </p>
  </div>

  <!-- 기존: 수동 백업/복원 (JSON) -->
  <div class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <h4 class="font-semibold text-gray-900 dark:text-white mb-2">📦 수동 백업/복원 (JSON 파일)</h4>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
      학습 기록을 파일로 저장하거나, 다른 기기에서 가져올 때 사용합니다.
    </p>

    <div class="flex gap-3 mb-2">
      <button id="export-data-btn" class="flex-1 bg-green-50 border border-green-300 text-green-700 font-medium py-2 px-4 rounded-lg hover:bg-green-100 transition">
        📥 데이터 내보내기
      </button>
      <button id="import-data-btn" class="flex-1 bg-yellow-50 border border-yellow-300 text-yellow-700 font-medium py-2 px-4 rounded-lg hover:bg-yellow-100 transition">
        📤 데이터 가져오기
      </button>
    </div>
    <div class="flex gap-3">
      <button id="merge-data-btn" class="flex-1 bg-blue-50 border border-blue-300 text-blue-700 font-medium py-2 px-4 rounded-lg hover:bg-blue-100 transition">
        🔀 데이터 병합 가져오기
      </button>
    </div>
    <input type="file" id="import-file-input" name="import-data-file" accept=".json" class="hidden" aria-label="데이터 가져오기 파일 선택" />
    <input type="file" id="merge-file-input" name="merge-data-file" accept=".json" class="hidden" aria-label="데이터 병합 파일 선택" />
  </div>
</div>
```

#### 1.3.3 스냅샷 로직 구현 (settingsCore.js)

**파일 최하단에 추가:**

```javascript
// ============================================
// 스냅샷 관리 (Phase: Gamlini 2.0)
// ============================================

const SNAPSHOT_LIST_KEY = 'gamlini_snapshots_list';
const MAX_SNAPSHOTS = 5;

/**
 * 스냅샷 목록 렌더링
 */
export function renderSnapshotList() {
  const container = document.getElementById('snapshot-list-container');
  if (!container) return;

  const snapshots = getSnapshotList();

  if (snapshots.length === 0) {
    container.innerHTML = `
      <div class="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
        저장된 스냅샷이 없습니다.
      </div>
    `;
    return;
  }

  container.innerHTML = snapshots.map(snap => {
    const date = new Date(snap.timestamp);
    const dateStr = date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1">
            <div class="font-semibold text-sm text-gray-900 dark:text-white">
              ${snap.label || '스냅샷'}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              ${dateStr}
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            ${snap.stats.totalSolved}문제 | 평균 ${snap.stats.avgScore}점
          </div>
        </div>
        <div class="flex gap-2">
          <button class="load-snapshot-btn flex-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700" data-id="${snap.id}">
            불러오기
          </button>
          <button class="delete-snapshot-btn text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900" data-id="${snap.id}">
            삭제
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 이벤트 리스너 바인딩
  container.querySelectorAll('.load-snapshot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      handleLoadSnapshot(id);
    });
  });

  container.querySelectorAll('.delete-snapshot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      handleDeleteSnapshot(id);
    });
  });
}

/**
 * 스냅샷 목록 가져오기
 * @returns {Array} 스냅샷 메타데이터 배열
 */
function getSnapshotList() {
  const raw = localStorage.getItem(SNAPSHOT_LIST_KEY);
  if (!raw) return [];

  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('스냅샷 목록 파싱 실패:', e);
    return [];
  }
}

/**
 * 스냅샷 목록 저장
 * @param {Array} list - 스냅샷 메타데이터 배열
 */
function saveSnapshotList(list) {
  localStorage.setItem(SNAPSHOT_LIST_KEY, JSON.stringify(list));
}

/**
 * 스냅샷 저장 핸들러
 */
export function handleSaveSnapshot() {
  const questionScores = window.questionScores || {};

  // 통계 계산
  const stats = calculateQuestionScoresStats(questionScores);

  // 사용자 레이블 입력 (선택사항)
  const label = prompt('스냅샷 이름을 입력하세요 (선택사항):', `백업 ${new Date().toLocaleDateString('ko-KR')}`);
  if (label === null) return; // 취소

  // 압축 저장
  const timestamp = Date.now();
  const snapshotId = `snap_${timestamp}`;

  try {
    // LZ-String로 압축
    const compressed = LZString.compress(JSON.stringify(questionScores));
    localStorage.setItem(snapshotId, compressed);

    // 메타데이터 추가
    const snapshots = getSnapshotList();
    snapshots.unshift({
      id: snapshotId,
      timestamp,
      label: label.trim() || '스냅샷',
      stats
    });

    // 최대 개수 제한
    if (snapshots.length > MAX_SNAPSHOTS) {
      const removed = snapshots.pop();
      localStorage.removeItem(removed.id);
      showToast(`가장 오래된 스냅샷이 자동 삭제되었습니다 (최대 ${MAX_SNAPSHOTS}개)`, 'warn');
    }

    saveSnapshotList(snapshots);
    renderSnapshotList();
    showToast('학습 상태가 저장되었습니다');

  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      showToast('저장 공간이 부족합니다. 오래된 스냅샷을 삭제하거나 수동 백업을 이용하세요.', 'error');
    } else {
      showToast('저장 실패: ' + e.message, 'error');
    }
    console.error('스냅샷 저장 실패:', e);
  }
}

/**
 * 스냅샷 불러오기 핸들러
 * @param {string} snapshotId - 스냅샷 ID
 */
export function handleLoadSnapshot(snapshotId) {
  if (!confirm('⚠️ 현재 학습 기록이 스냅샷으로 덮어씌워집니다. 계속하시겠습니까?\n\n(현재 기록을 먼저 백업하는 것을 권장합니다)')) {
    return;
  }

  try {
    const compressed = localStorage.getItem(snapshotId);
    if (!compressed) {
      showToast('스냅샷을 찾을 수 없습니다', 'error');
      return;
    }

    // 압축 해제
    const decompressed = LZString.decompress(compressed);
    const questionScores = JSON.parse(decompressed);

    // 복원
    window.questionScores = questionScores;
    localStorage.setItem('auditQuizScores', JSON.stringify(questionScores));

    showToast('스냅샷을 불러왔습니다. 페이지를 새로고침합니다...');

    // 페이지 새로고침
    setTimeout(() => {
      location.reload();
    }, 1000);

  } catch (e) {
    showToast('스냅샷 불러오기 실패: ' + e.message, 'error');
    console.error('스냅샷 불러오기 실패:', e);
  }
}

/**
 * 스냅샷 삭제 핸들러
 * @param {string} snapshotId - 스냅샷 ID
 */
export function handleDeleteSnapshot(snapshotId) {
  if (!confirm('이 스냅샷을 삭제하시겠습니까?')) {
    return;
  }

  try {
    localStorage.removeItem(snapshotId);

    const snapshots = getSnapshotList();
    const filtered = snapshots.filter(s => s.id !== snapshotId);
    saveSnapshotList(filtered);

    renderSnapshotList();
    showToast('스냅샷이 삭제되었습니다');

  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
    console.error('스냅샷 삭제 실패:', e);
  }
}

/**
 * questionScores 통계 계산
 * @param {object} questionScores - 문제 점수 객체
 * @returns {object} 통계 {totalSolved, avgScore, lastActivity}
 */
function calculateQuestionScoresStats(questionScores) {
  const entries = Object.entries(questionScores);

  if (entries.length === 0) {
    return { totalSolved: 0, avgScore: 0, lastActivity: null };
  }

  let totalScore = 0;
  let totalCount = 0;
  let lastActivity = 0;

  for (const [, rec] of entries) {
    const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
    for (const h of hist) {
      totalScore += h.score || 0;
      totalCount++;
      if (h.date > lastActivity) lastActivity = h.date;
    }
  }

  return {
    totalSolved: totalCount,
    avgScore: totalCount > 0 ? Math.round(totalScore / totalCount) : 0,
    lastActivity: lastActivity > 0 ? new Date(lastActivity).toLocaleDateString('ko-KR') : null
  };
}
```

#### 1.3.4 이벤트 리스너 등록 (settingsCore.js)

**수정 위치:** `openSettingsModal()` 함수 내부

```javascript
export function openSettingsModal() {
  const el = getElements();

  el.settingsModal.classList.remove('hidden');
  el.settingsModal.classList.add('flex');

  if (el.aiModelSelect) {
    el.aiModelSelect.value = getSelectedAiModel();
  }
  if (el.darkModeSelect) {
    el.darkModeSelect.value = getDarkMode();
  }
  if (el.examDateInput) {
    el.examDateInput.value = loadExamDate();
  }

  // 신규: 스냅샷 목록 렌더링
  renderSnapshotList();
}
```

**수정 위치:** `initSettingsModalListeners()` 함수 내부

```javascript
export function initSettingsModalListeners() {
  const el = getElements();

  // ... (기존 코드)

  // 신규: 스냅샷 저장 버튼
  document.getElementById('save-snapshot-btn')?.addEventListener('click', handleSaveSnapshot);
}
```

### 1.4 테스트 시나리오

- [ ] **TC-1.1:** 빈 데이터 스냅샷 저장 → 0문제 표시 확인
- [ ] **TC-1.2:** 100개 문제 데이터 저장 → 압축률 확인 (50% 이상)
- [ ] **TC-1.3:** 5개 스냅샷 저장 후 6번째 저장 → 가장 오래된 것 자동 삭제 확인
- [ ] **TC-1.4:** 스냅샷 불러오기 → 페이지 새로고침 후 데이터 일치 확인
- [ ] **TC-1.5:** 스냅샷 삭제 → localStorage에서 제거 확인
- [ ] **TC-1.6:** localStorage 용량 초과 시뮬레이션 → 경고 메시지 확인
- [ ] **TC-1.7:** 압축 라이브러리 로드 실패 시 → 에러 핸들링 확인

### 1.5 롤백 계획

**롤백 조건:**
- 압축 라이브러리 호환성 문제
- localStorage 오염으로 인한 앱 오작동

**롤백 방법:**
```javascript
// localStorage에서 모든 스냅샷 제거
const keys = Object.keys(localStorage);
keys.forEach(key => {
  if (key.startsWith('snap_') || key === 'gamlini_snapshots_list') {
    localStorage.removeItem(key);
  }
});
```

---

## 8. 통합 테스트 시나리오

### 8.1 크로스 기능 테스트

- [ ] **T-1:** Task 2 PDF 내보내기 → Task 3 HLR 액션 플랜 포함 → PDF에 "회상 확률" 정보 표시 확인
- [ ] **T-2:** Task 4 AI 차트 해석 → Task 2 PDF 내보내기 → AI 분석에 차트 해석 포함 확인
- [ ] **T-3:** Task 1 스냅샷 저장 → Task 3 HLR 모드 전환 → 스냅샷 불러오기 → HLR 데이터 유지 확인
- [ ] **T-4:** 모든 기능 활성화 → 리포트 생성 → 성능 측정 (< 3초)

### 8.2 호환성 테스트

- [ ] **Chrome (Desktop):** 모든 기능 정상 작동
- [ ] **Safari (Desktop):** PDF 인쇄 정상 작동
- [ ] **Mobile (iOS Safari):** PDF 내보내기 정상 작동
- [ ] **Mobile (Android Chrome):** 스냅샷 저장/불러오기 정상 작동

### 8.3 부하 테스트

- [ ] **대용량 데이터 (1000+ 문제):**
  - HLR 계산 성능 < 2초
  - 스냅샷 압축 성능 < 3초
  - PDF 생성 성능 < 5초

---

## 9. 롤백 계획

### 9.1 Git 브랜치 전략

```bash
# 각 Task별 브랜치 생성
git checkout -b task-2-pdf-export
git checkout -b task-3-hlr-review
git checkout -b task-4-ai-chart-analysis
git checkout -b task-1-snapshot

# 메인 브랜치: claude/gamlini-2-0-ux-enhancement-011CUxAp8KYwyUh8bhJN2uf6
```

### 9.2 롤백 우선순위

1. **Task 1 (스냅샷):** 독립적 기능, 롤백해도 다른 기능 영향 없음
2. **Task 4 (AI 차트):** 프롬프트 변경만, 롤백 용이
3. **Task 3 (HLR):** 설정에서 'time' 모드로 전환 가능
4. **Task 2 (PDF):** CSS 충돌 가능성, 롤백 시 신중 필요

### 9.3 긴급 롤백 스크립트

```bash
# 특정 Task만 롤백
git revert <task-commit-hash>

# 전체 롤백
git reset --hard HEAD~4  # 4개 Task 모두 롤백
```

---

## 10. 배포 체크리스트

### 10.1 배포 전 확인사항

- [ ] 모든 테스트 시나리오 통과
- [ ] 코드 리뷰 완료
- [ ] 콘솔 에러 0개
- [ ] 다크모드 정상 작동
- [ ] 모바일 반응형 확인

### 10.2 배포 순서

1. ✅ **Task 2 배포** → 사용자 피드백 수집 (1일)
2. ✅ **Task 3 배포** → HLR 정확도 검증 (2일)
3. ✅ **Task 4 배포** → AI 응답 품질 모니터링 (2일)
4. ✅ **Task 1 배포** → localStorage 안정성 확인 (3일)

### 10.3 배포 후 모니터링

- [ ] localStorage 용량 사용량 모니터링
- [ ] Gemini API 토큰 사용량 모니터링
- [ ] 사용자 에러 리포트 수집
- [ ] PDF 내보내기 성공률 측정

---

## 📌 최종 요약

### 개발 우선순위 (재확인)
1. **Task 2** (PDF) → 빠른 효과, 즉시 배포 가능
2. **Task 3** (HLR) → HLR 코드 완성되어 있어 구현 용이
3. **Task 4** (AI) → 프롬프트 수정만 필요
4. **Task 1** (스냅샷) → 가장 복잡, 충분한 테스트 필요

### 예상 총 공수
- **Task 2:** 2-3시간
- **Task 3:** 3-4시간
- **Task 4:** 2-3시간
- **Task 1:** 5-6시간
- **통합 테스트:** 2-3시간
- **총합:** 약 14-19시간 (2-3일 소요)

### 성공 지표 (KPI)
- PDF 내보내기 사용률 > 30%
- HLR 복습 플랜 정확도 > 80%
- AI 차트 해석 만족도 > 4.0/5.0
- 스냅샷 저장 성공률 > 95%

---

**End of Document**
