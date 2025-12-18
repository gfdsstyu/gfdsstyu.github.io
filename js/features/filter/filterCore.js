/**
 * @fileoverview 필터링 시스템 - 출처, 단원, 상태별 필터링
 */

import { getElements } from '../../core/stateManager.js';
import { isPartValue, parsePartValue } from '../../config/config.js';
import { normId } from '../../utils/helpers.js';
import { getQuestionScores, getAllData } from '../../core/stateManager.js';
import { eventBus } from '../../core/eventBus.js';

// 필터 설정 저장 키
export const SOURCE_LS = 'sourceFilterSelectionV1';
export const COMPACT_LS = 'compactFilterEnabled';

// 출처 태그 분류
export const BASIC_TAGS = ['S', 'H', 'HS'];
export const ADV_TAGS = ['SS', 'P'];

/**
 * 범위 필터링된 데이터 가져오기 (출처 + 단원 + 컴팩트 필터 적용)
 * @returns {Array} 필터링된 문제 배열
 */
export function getScopeFilteredData() {
  const allData = window.allData || getAllData() || [];
  return applyCompactFilter(filterByChapterSelection(applySourceFilter(allData)));
}

/**
 * 출처 필터 UI 생성 및 초기화
 */
export function buildSourceFilterUI() {
  const el = getElements();
  if (!el.sourceGroupFilter) return;

  el.sourceGroupFilter.innerHTML = `
    <div class="rounded-xl border p-3">
      <div class="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">출처별 필터</div>
      <div class="flex flex-wrap gap-3">
        <label class="text-sm flex items-center gap-1 text-gray-900 dark:text-gray-100"><input type="checkbox" id="source-filter-basic" name="source-filter-basic" value="basic" class="source-filter"> 기본(S/H/HS)</label>
        <label class="text-sm flex items-center gap-1 text-gray-900 dark:text-gray-100"><input type="checkbox" id="source-filter-advanced" name="source-filter-advanced" value="advanced" class="source-filter"> 심화(SS/P)</label>
        <label class="text-sm flex items-center gap-1 text-gray-900 dark:text-gray-100"><input type="checkbox" id="source-filter-other" name="source-filter-other" value="other" class="source-filter"> 기타</label>
        <label class="text-sm flex items-center gap-1 text-gray-900 dark:text-gray-100"><input type="checkbox" id="compact-filter" name="compact-filter" value="compact"> 컴팩트</label>
        <button id="source-filter-all" class="ml-auto text-xs px-2 py-1 border rounded text-gray-900 dark:text-gray-100">전체</button>
        <button id="source-filter-none" class="text-xs px-2 py-1 border rounded text-gray-900 dark:text-gray-100">해제</button>
      </div>
    </div>`;

  const saved = JSON.parse(localStorage.getItem(SOURCE_LS) || '["basic","advanced","other"]');
  el.sourceGroupFilter.querySelectorAll('input.source-filter').forEach(cb => {
    cb.checked = saved.includes(cb.value);
    cb.addEventListener('change', () => {
      localStorage.setItem(SOURCE_LS, JSON.stringify(getSelectedSourceGroups()));
      // EventBus를 통해 quizCore에 리로드 요청 (순환 의존성 해결)
      eventBus.emit('quiz:reload');
    });
  });

  // 컴팩트 필터 초기화
  const compactCheckbox = el.sourceGroupFilter.querySelector('#compact-filter');
  if (compactCheckbox) {
    const compactEnabled = localStorage.getItem(COMPACT_LS) === 'true';
    compactCheckbox.checked = compactEnabled;
    compactCheckbox.addEventListener('change', () => {
      localStorage.setItem(COMPACT_LS, compactCheckbox.checked);
      eventBus.emit('quiz:reload');
    });
  }

  el.sourceGroupFilter.querySelector('#source-filter-all')?.addEventListener('click', () => {
    setAllGroups(['basic', 'advanced', 'other']);
  });

  el.sourceGroupFilter.querySelector('#source-filter-none')?.addEventListener('click', () => {
    setAllGroups([]);
  });

  function setAllGroups(arr) {
    el.sourceGroupFilter.querySelectorAll('input.source-filter').forEach(cb => {
      cb.checked = arr.includes(cb.value);
    });
    localStorage.setItem(SOURCE_LS, JSON.stringify(arr));
    // EventBus를 통해 quizCore에 리로드 요청 (순환 의존성 해결)
    eventBus.emit('quiz:reload');
  }
}

/**
 * 선택된 출처 그룹 가져오기
 * @returns {string[]} 선택된 그룹 배열 (e.g., ['basic', 'advanced'])
 */
export function getSelectedSourceGroups() {
  const el = getElements();
  const boxes = el.sourceGroupFilter?.querySelectorAll('input.source-filter');

  if (!boxes || boxes.length === 0) {
    return JSON.parse(localStorage.getItem(SOURCE_LS) || '["basic","advanced","other"]');
  }

  const arr = [];
  boxes.forEach(cb => {
    if (cb.checked) arr.push(cb.value);
  });
  return arr;
}

/**
 * 컴팩트 필터 활성화 여부 확인
 * @returns {boolean} 컴팩트 필터 활성화 여부
 */
export function isCompactFilterEnabled() {
  return localStorage.getItem(COMPACT_LS) === 'true';
}

/**
 * 컴팩트 필터 적용 (q_001~q_200만 표시)
 * @param {Array} arr - 문제 배열
 * @returns {Array} 필터링된 문제 배열
 */
export function applyCompactFilter(arr) {
  if (!isCompactFilterEnabled()) return arr;

  return (arr || []).filter(q => {
    const id = String(q.고유ID || '').toLowerCase();
    // q_001부터 q_200까지만 포함
    const match = id.match(/^q_(\d+)/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    return num >= 1 && num <= 200;
  });
}

/**
 * 출처 문자열에서 그룹 감지
 * @param {string} src - 출처 문자열 (e.g., "S, H", "SS/P")
 * @returns {string} 그룹명 ('basic', 'advanced', 'basic-advanced', 'other')
 */
export function detectSourceGroup(src) {
  const s = String(src || '').toUpperCase();
  const tok = s.split(/\s*[;,\/\s]\s*/).filter(Boolean);

  const hasBasic = tok.some(t => BASIC_TAGS.includes(t));
  const hasAdv = tok.some(t => ADV_TAGS.includes(t));

  if (hasBasic && !hasAdv) return 'basic';
  if (!hasBasic && hasAdv) return 'advanced';
  if (hasBasic && hasAdv) return 'basic-advanced';
  return 'other';
}

/**
 * 출처 필터 적용
 * @param {Array} arr - 문제 배열
 * @returns {Array} 필터링된 문제 배열
 */
export function applySourceFilter(arr) {
  const selected = new Set(getSelectedSourceGroups());

  // 모두 선택 또는 모두 미선택 시 필터링하지 않음
  if (selected.size === 0 || selected.size === 3) return arr;

  return (arr || []).filter(q => {
    const g = detectSourceGroup(q.출처);

    // 기본+심화 혼합인 경우 둘 중 하나라도 선택되면 포함
    if (g === 'basic-advanced') {
      return selected.has('basic') || selected.has('advanced');
    }

    return selected.has(g);
  });
}

/**
 * 단원 선택에 따라 필터링
 * @param {Array} list - 문제 배열
 * @returns {Array} 필터링된 문제 배열
 */
export function filterByChapterSelection(list) {
  const el = getElements();
  const sel = el.chapterSelect?.value || '';

  if (!sel) return list;

  // 파트 값인 경우 (예: "PART:1-5")
  if (isPartValue(sel)) {
    const pr = parsePartValue(sel);
    if (!pr) return list;

    return list.filter(q => {
      const n = +q.단원;
      return Number.isFinite(n) && n >= pr.start && n <= pr.end;
    });
  }

  // 단일 단원 선택
  return list.filter(q => String(q.단원).trim() === String(sel));
}

/**
 * UI 필터 종합 적용 (출처 + 단원 + 컴팩트 + 상태 + 정렬)
 * @returns {Array} 필터링 및 정렬된 문제 배열
 */
export function getFilteredByUI() {
  const el = getElements();
  const filter = el.filterSelect.value;
  const questionScores = getQuestionScores();

  // 1. 출처 필터 적용
  let list = applySourceFilter(window.allData || getAllData() || []);

  // 2. 단원 필터 적용
  list = filterByChapterSelection(list);

  // 3. 컴팩트 필터 적용
  list = applyCompactFilter(list);

  // 4. 상태 필터 적용
  list = list.filter(q => {
    const key = normId(q.고유ID);
    const s = questionScores[key];

    // 안푼문제: questionScores에 없거나, score가 null/undefined인 경우
    if (filter === 'unanswered') {
      return !s || s.score == null || s.score === undefined;
    }

    // 80점 미만: 점수가 없거나 80점 미만
    if (filter === '80') {
      return !s || s.score == null || s.score === undefined || +s.score < 80;
    }

    // 60점 미만: 점수가 없거나 60점 미만
    if (filter === '60') {
      return !s || s.score == null || s.score === undefined || +s.score < 60;
    }

    return true;
  });

  // 5. 오늘의 복습 필터 (제외 표시 제거 + 우선순위 정렬)
  if (filter === 'today-review') {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:241',message:'today-review filter start',data:{listLength:list.length,filter},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    list = list.filter(q => !questionScores[normId(q.고유ID)]?.userReviewExclude);

    // 플래그된 문제와 플래그되지 않은 문제 분리
    const flagged = list.filter(q => {
      const key = normId(q.고유ID);
      const s = questionScores[key];
      return s?.userReviewFlag && !s?.userReviewExclude;
    });
    const unflagged = list.filter(q => {
      const key = normId(q.고유ID);
      const s = questionScores[key];
      return !s?.userReviewFlag || s?.userReviewExclude;
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:255',message:'today-review after split',data:{flaggedLength:flagged.length,unflaggedLength:unflagged.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
    // #endregion

    // 플래그된 문제와 플래그되지 않은 문제 모두 정렬 적용
    let flaggedSorted = flagged;
    let unflaggedLimited = unflagged;
    if (typeof window.prioritizeTodayReview === 'function') {
      // 현재 복습 전략 가져오기
      const currentStrategy = window.getReviewStrategy ? window.getReviewStrategy() : 'smart';
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:266',message:'today-review before prioritizeTodayReview',data:{currentStrategy,flaggedLength:flagged.length,unflaggedLength:unflagged.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      // 플래그된 문제도 정렬 적용
      flaggedSorted = window.prioritizeTodayReview(flagged);
      // 플래그되지 않은 문제 정렬 후 10개 제한
      unflaggedLimited = window.prioritizeTodayReview(unflagged).slice(0, 10);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:272',message:'today-review after prioritizeTodayReview',data:{currentStrategy,flaggedSortedLength:flaggedSorted.length,unflaggedLimitedLength:unflaggedLimited.length,flaggedFirstThree:flaggedSorted.slice(0,3).map(q=>q.고유ID),unflaggedFirstThree:unflaggedLimited.slice(0,3).map(q=>q.고유ID)},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
    }

    // 플래그된 문제 + 제한된 플래그되지 않은 문제 병합
    list = [...flaggedSorted, ...unflaggedLimited];
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:270',message:'today-review final list',data:{listLength:list.length,firstThreeIds:list.slice(0,3).map(q=>q.고유ID)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
  }

  // 5-1. 사용자 복습만 필터 (플래그된 문제만, 10개 제한 없음)
  if (filter === 'user-review') {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:267',message:'user-review filter before',data:{listLength:list.length,filter},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    list = list.filter(q => {
      const key = normId(q.고유ID);
      const s = questionScores[key];
      return s?.userReviewFlag && !s?.userReviewExclude;
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:273',message:'user-review filter after',data:{listLength:list.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // 복습 전략에 따른 정렬 적용
    if (typeof window.prioritizeTodayReview === 'function') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:277',message:'user-review applying prioritizeTodayReview',data:{listLength:list.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      list = window.prioritizeTodayReview(list);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:280',message:'user-review after prioritizeTodayReview',data:{listLength:list.length,firstThreeIds:list.slice(0,3).map(q=>q.고유ID)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    }
  }

  // 6. 정렬: 1순위 단원, 2순위 표시번호 (자연 정렬)
  // 단, today-review나 user-review 필터의 경우 복습 전략 정렬이 이미 적용되었으므로 스킵
  if (filter !== 'today-review' && filter !== 'user-review') {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:287',message:'applying default sort',data:{filter,listLength:list.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    list.sort((a, b) => {
    // 1순위: 단원 비교
    const chA = +a.단원;
    const chB = +b.단원;

    if (Number.isFinite(chA) && Number.isFinite(chB)) {
      if (chA !== chB) return chA - chB;
    } else if (Number.isFinite(chA)) {
      return -1; // 숫자가 문자보다 앞
    } else if (Number.isFinite(chB)) {
      return 1;
    } else {
      // 둘 다 문자인 경우 사전순
      const cmp = String(a.단원).localeCompare(String(b.단원), 'ko');
      if (cmp !== 0) return cmp;
    }

    // 2순위: 표시번호 (또는 물음번호)
    const numA = +(a.표시번호 || a.물음번호 || 0);
    const numB = +(b.표시번호 || b.물음번호 || 0);

    if (Number.isFinite(numA) && Number.isFinite(numB)) {
      if (numA !== numB) return numA - numB;
    } else if (Number.isFinite(numA)) {
      return -1; // 숫자가 앞
    } else if (Number.isFinite(numB)) {
      return 1;
    }

    // 3순위: 고유ID 자연 정렬 (q_1, q_2, ..., q_10) - 폴백
    const idA = String(a.고유ID || '');
    const idB = String(b.고유ID || '');

    // q_숫자 패턴에서 숫자 추출
    const matchA = idA.match(/^q_(\d+)/i);
    const matchB = idB.match(/^q_(\d+)/i);

    if (matchA && matchB) {
      const numA = parseInt(matchA[1], 10);
      const numB = parseInt(matchB[1], 10);
      if (numA !== numB) return numA - numB;
    }

    // 최종 폴백: 문자열 비교
    return idA.localeCompare(idB, 'ko');
    });
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filterCore.js:321',message:'getFilteredByUI return',data:{filter,listLength:list.length,firstThreeIds:list.slice(0,3).map(q=>q.고유ID)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion

  return list;
}

// ============================================
// 이벤트 리스너 초기화 (Phase 5.1)
// ============================================

/**
 * 필터 관련 이벤트 리스너 초기화
 */
export function initFilterListeners() {
  // Access global state via window (NEVER import from stateManager)
  const el = window.el;
  if (!el) return;

  // Chapter select, filter select, load quiz button
  // EventBus를 통해 quizCore에 리로드 요청 (순환 의존성 해결)
  el.chapterSelect?.addEventListener('change', () => {
    eventBus.emit('quiz:reload');
  });

  el.filterSelect?.addEventListener('change', () => {
    eventBus.emit('quiz:reload');
  });

  // "기준" 버튼 - 기존 학습하기 기능 복원
  el.loadQuizBtn?.addEventListener('click', () => {
    // KAM 모드에서 기준 버튼 클릭 시 사례 종료
    if (window.getIsKAMMode && window.getIsKAMMode()) {
      if (typeof window.exitKAMMode === 'function') {
        window.exitKAMMode();
      }
    }
    // quiz 문제 불러오기
    eventBus.emit('quiz:reload');
  });

  // "사례" 버튼 - KAM 모드 전환
  const kamModeBtn = document.querySelector('#kam-mode-btn');
  kamModeBtn?.addEventListener('click', () => {
    if (window.getIsKAMMode && window.getIsKAMMode()) {
      // KAM 모드 -> 퀴즈 모드로 전환
      if (typeof window.exitKAMMode === 'function') {
        window.exitKAMMode();
      }
    } else {
      // 퀴즈 모드 -> KAM 모드로 전환
      if (typeof window.enterKAMMode === 'function') {
        window.enterKAMMode();
      }
    }
  });

  // Random quiz button
  el.randomQuizBtn?.addEventListener('click', () => {
    if (typeof window.startRandomQuiz === 'function') {
      window.startRandomQuiz();
    }
  });
}
