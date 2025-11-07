/**
 * @fileoverview 필터링 시스템 - 출처, 단원, 상태별 필터링
 */

import { getElements } from '../../core/stateManager.js';
import { isPartValue, parsePartValue } from '../../config/config.js';
import { normId } from '../../utils/helpers.js';
import { getQuestionScores, getAllData } from '../../core/stateManager.js';

// 필터 설정 저장 키
export const SOURCE_LS = 'sourceFilterSelectionV1';

// 출처 태그 분류
export const BASIC_TAGS = ['S', 'H', 'HS'];
export const ADV_TAGS = ['SS', 'P'];

/**
 * 범위 필터링된 데이터 가져오기 (출처 + 단원 필터 적용)
 * @returns {Array} 필터링된 문제 배열
 */
export function getScopeFilteredData() {
  const allData = window.allData || getAllData() || [];
  return filterByChapterSelection(applySourceFilter(allData));
}

/**
 * 출처 필터 UI 생성 및 초기화
 */
export function buildSourceFilterUI() {
  const el = getElements();
  if (!el.sourceGroupFilter) return;

  el.sourceGroupFilter.innerHTML = `
    <div class="rounded-xl border p-3">
      <div class="text-sm font-semibold mb-2">출처별 필터</div>
      <div class="flex flex-wrap gap-3">
        <label class="text-sm flex items-center gap-1"><input type="checkbox" value="basic" class="source-filter"> 기본(S/H/HS)</label>
        <label class="text-sm flex items-center gap-1"><input type="checkbox" value="advanced" class="source-filter"> 심화(SS/P)</label>
        <label class="text-sm flex items-center gap-1"><input type="checkbox" value="other" class="source-filter"> 기타</label>
        <button id="source-filter-all" class="ml-auto text-xs px-2 py-1 border rounded">전체</button>
        <button id="source-filter-none" class="text-xs px-2 py-1 border rounded">해제</button>
      </div>
    </div>`;

  const saved = JSON.parse(localStorage.getItem(SOURCE_LS) || '["basic","advanced","other"]');
  el.sourceGroupFilter.querySelectorAll('input.source-filter').forEach(cb => {
    cb.checked = saved.includes(cb.value);
    cb.addEventListener('change', () => {
      localStorage.setItem(SOURCE_LS, JSON.stringify(getSelectedSourceGroups()));
      // reloadAndRefresh는 window를 통해 호출 (quizCore에서 제공)
      if (typeof window.reloadAndRefresh === 'function') {
        window.reloadAndRefresh();
      }
    });
  });

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
    if (typeof window.reloadAndRefresh === 'function') {
      window.reloadAndRefresh();
    }
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
 * UI 필터 종합 적용 (출처 + 단원 + 상태 + 정렬)
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

  // 3. 상태 필터 적용
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

  // 4. 오늘의 복습 필터 (제외 표시 제거 + 우선순위 정렬)
  if (filter === 'today-review') {
    list = list.filter(q => !questionScores[normId(q.고유ID)]?.userReviewExclude);

    // prioritizeTodayReview는 reviewCore 모듈에서 window로 노출됨 (Phase 4.5)
    if (typeof window.prioritizeTodayReview === 'function') {
      list = window.prioritizeTodayReview(list).slice(0, 10);
    }
  }

  // 5. 정렬: 1순위 단원, 2순위 표시번호
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

    // 2순위: 표시번호 비교
    const numA = +(a.표시번호 || a.물음번호 || 0);
    const numB = +(b.표시번호 || b.물음번호 || 0);

    if (Number.isFinite(numA) && Number.isFinite(numB)) {
      return numA - numB;
    }

    // fallback: 문자열 비교
    return String(a.표시번호 || a.물음번호 || '').localeCompare(
      String(b.표시번호 || b.물음번호 || ''), 'ko'
    );
  });

  return list;
}
