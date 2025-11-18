/**
 * @fileoverview 캘린더 및 통계 - 학습 캘린더, 통계 표시, 날짜 네비게이션
 */

import { getElements } from '../../core/stateManager.js';
import { ymd, dowMon0, colorForCount } from '../../utils/helpers.js';
import { chapterLabelText } from '../../config/config.js';
import { showToast, getHeaderOffset } from '../../ui/domUtils.js';
import {
  saveStatsDate,
  getStatsRefDate,
  setStatsRefDate,
  getCalRefDate,
  setCalRefDate
} from '../../core/storageManager.js';
import { getScopeFilteredData } from '../filter/filterCore.js';

// Phase 1: 메모이제이션 캐시
let countsCache = null;
let countsCacheKey = '';

/**
 * counts Map 생성 (메모이제이션 적용)
 * @param {Array} base - 필터된 데이터
 * @param {Object} scores - questionScores 객체
 * @returns {Map} 날짜별 풀이 횟수
 */
function getCountsMap(base, scores) {
  // Phase 1: 캐시 키 생성 (base의 고유ID 배열 + scores 객체 길이)
  const baseIds = base.map(q => String(q.고유ID).trim()).sort().join(',');
  const scoresKeys = Object.keys(scores).sort().join(',');
  const cacheKey = `${baseIds}::${scoresKeys}`;

  // Phase 1: 캐시 히트
  if (countsCacheKey === cacheKey && countsCache) {
    return countsCache;
  }

  // Phase 1: 캐시 미스 - 새로 계산
  const idSet = new Set(base.map(q => String(q.고유ID).trim()));
  const counts = new Map();

  for (const [qid, rec] of Object.entries(scores)) {
    if (!idSet.has(qid)) continue;
    const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
    for (const h of hist) {
      const t = Number(h?.date);
      if (!Number.isFinite(t)) continue;
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      const k = ymd(d);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }

  // Phase 1: 캐시 저장
  countsCache = counts;
  countsCacheKey = cacheKey;

  return counts;
}

/**
 * 캘린더 월 렌더링 (히트맵)
 * Phase 1: DocumentFragment + 메모이제이션 최적화
 */
export function renderCalendarMonth() {
  const el = getElements();
  const grid = el.calendarGrid;
  const title = el.calTitle;

  if (!grid || !title) return;

  const calRefDate = getCalRefDate();

  title.textContent = `${calRefDate.getFullYear()}.${String(calRefDate.getMonth() + 1).padStart(2, '0')}`;

  const base = getScopeFilteredData();

  // questionScores는 전역 변수 (window.questionScores)
  const scores = window.questionScores || window.getQuestionScores?.() || {};

  // Phase 1: 메모이제이션된 counts 가져오기
  const counts = getCountsMap(base, scores);

  const first = new Date(calRefDate);
  const firstDow = dowMon0(first);
  const start = new Date(first);
  start.setDate(first.getDate() - firstDow);

  const lastDay = new Date(calRefDate.getFullYear(), calRefDate.getMonth() + 1, 0);
  const lastDow = dowMon0(lastDay);
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDow));

  grid.innerHTML = '';

  // Phase 1: DocumentFragment로 모든 셀을 배칭
  const fragment = document.createDocumentFragment();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const inMonth = (d.getMonth() === calRefDate.getMonth() && d.getFullYear() === calRefDate.getFullYear());
    const key = ymd(d);
    const c = counts.get(key) || 0;
    const { bg, fg } = colorForCount(c);

    const cell = document.createElement('div');
    cell.className = `cal-cell` + (inMonth ? '' : ' muted');
    cell.title = `${key} · 풀이 ${c}회`;
    cell.style.backgroundColor = bg;
    cell.style.color = fg;

    const day = document.createElement('div');
    day.className = 'cal-day';
    day.textContent = String(d.getDate());
    cell.appendChild(day);
    fragment.appendChild(cell);
  }

  // Phase 1: 한 번에 DOM에 모든 셀 추가
  grid.appendChild(fragment);
}

/**
 * 통계 날짜 네비게이션 렌더링
 */
export function renderStatsDateNav() {
  const el = getElements();
  if (!el.statsOverview) return;

  const existingNav = el.statsOverview.querySelector('#stats-date-nav');
  if (existingNav) existingNav.remove();

  const nav = document.createElement('div');
  nav.id = 'stats-date-nav';
  nav.className = 'flex items-center justify-between mb-3 pb-3 border-b';

  const statsRefDate = getStatsRefDate();
  const displayY = statsRefDate.getFullYear();
  const displayM = String(statsRefDate.getMonth() + 1).padStart(2, '0');
  const displayD = String(statsRefDate.getDate()).padStart(2, '0');
  const displayStr = `${displayY}-${displayM}-${displayD}`;

  nav.innerHTML = `
    <div class="flex items-center gap-2">
      <button id="stats-prev-day" class="w-7 h-7 flex items-center justify-center rounded border hover:bg-gray-100 text-sm" title="이전 날">◀</button>
      <input id="stats-date-input" type="date" class="px-2 py-1 border rounded text-sm" value="${displayStr}">
      <button id="stats-next-day" class="w-7 h-7 flex items-center justify-center rounded border hover:bg-gray-100 text-sm" title="다음 날">▶</button>
    </div>
    <button id="stats-today-btn" class="text-xs px-2 py-1 border rounded hover:bg-gray-100">오늘</button>
  `;

  el.statsOverview.insertBefore(nav, el.statsOverview.firstChild);

  const prevBtn = el.statsOverview.querySelector('#stats-prev-day');
  const nextBtn = el.statsOverview.querySelector('#stats-next-day');
  const todayBtn = el.statsOverview.querySelector('#stats-today-btn');
  const dateInput = el.statsOverview.querySelector('#stats-date-input');

  prevBtn?.addEventListener('click', () => {
    const date = getStatsRefDate();
    date.setDate(date.getDate() - 1);
    saveStatsDate();
    renderStats();
  });

  nextBtn?.addEventListener('click', () => {
    const date = getStatsRefDate();
    date.setDate(date.getDate() + 1);
    saveStatsDate();
    renderStats();
  });

  todayBtn?.addEventListener('click', () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStatsRefDate(now);
    saveStatsDate();
    renderStats();
  });

  dateInput?.addEventListener('change', (e) => {
    if (e.target.value) {
      const newDate = new Date(e.target.value + 'T00:00:00');
      if (!isNaN(newDate.getTime())) {
        setStatsRefDate(newDate);
        saveStatsDate();
        renderStats();
      }
    }
  });
}

/**
 * 통계 렌더링 (일/주/월간 통계)
 */
export function renderStats() {
  const el = getElements();
  if (!el.statsOverview) return;

  renderStatsDateNav();

  const startOfDay = d => { const t = new Date(d); t.setHours(0, 0, 0, 0); return t; };
  const endOfDay = d => { const t = new Date(d); t.setHours(23, 59, 59, 999); return t; };

  // 주간: 월요일 시작 ~ 일요일 끝
  const startOfWeek = d => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    const dow = (t.getDay() + 6) % 7; // 0=월, 6=일
    t.setDate(t.getDate() - dow);
    return t;
  };

  const endOfWeek = d => {
    const t = new Date(d);
    t.setHours(23, 59, 59, 999);
    const dow = (t.getDay() + 6) % 7;
    t.setDate(t.getDate() + (6 - dow));
    return t;
  };

  // 월간: 해당 월의 1일 시작 ~ 마지막일 끝
  const startOfMonth = d => {
    const t = new Date(d.getFullYear(), d.getMonth(), 1);
    t.setHours(0, 0, 0, 0);
    return t;
  };

  const endOfMonth = d => {
    const t = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    t.setHours(23, 59, 59, 999);
    return t;
  };

  const statsRefDate = getStatsRefDate();
  const statsView = window.statsView || 'day';

  // 기간 설정
  let title = '오늘의 통계';
  let label = '오늘';
  let start = startOfDay(statsRefDate);
  let end = endOfDay(statsRefDate);

  if (statsView === 'week') {
    title = '주간 통계';
    label = '주간';
    start = startOfWeek(statsRefDate);
    end = endOfWeek(statsRefDate);
  }

  if (statsView === 'month') {
    title = '월간 통계';
    label = '월간';
    start = startOfMonth(statsRefDate);
    end = endOfMonth(statsRefDate);
  }

  const base = getScopeFilteredData();
  const idSet = new Set(base.map(q => String(q.고유ID).trim()));
  let solved = 0;
  let sum = 0;
  let flagged = 0;
  let last = 0;
  const daySet = new Set();

  const scores = window.questionScores || window.getQuestionScores?.() || {};

  for (const q of base) {
    const id = String(q.고유ID).trim();
    const rec = scores[id];
    if (rec && Number.isFinite(+rec.score)) {
      solved++;
      sum += +rec.score;
    }
    if (rec?.userReviewFlag && !rec.userReviewExclude) flagged++;
    if (rec?.lastSolvedDate && rec.lastSolvedDate > last) last = rec.lastSolvedDate;

    (Array.isArray(rec?.solveHistory) ? rec.solveHistory : []).forEach(h => {
      const t = +h?.date;
      if (!Number.isFinite(t)) return;
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      daySet.add(ymd(d));
    });
  }

  const avgAll = solved ? (sum / solved) : null;
  const recentTxt = last ? ((d => d === 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`)(Math.floor((Date.now() - last) / 86400000))) : '기록 없음';
  const hasSolved = dayKey => daySet.has(dayKey);

  let streak = 0;
  let cur = new Date();
  cur.setHours(0, 0, 0, 0);
  while (hasSolved(ymd(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  const bestKey = 'bestStreak_v1';
  const best = Math.max(streak, +(localStorage.getItem(bestKey) || 0));
  if (best > +(localStorage.getItem(bestKey) || 0)) localStorage.setItem(bestKey, String(best));

  // 기간 내 풀이 집계
  let periodSolves = 0;
  let periodSum = 0;
  const byCh = new Map();
  const chRec = ch => {
    if (!byCh.has(ch)) byCh.set(ch, { solves: 0, sum: 0 });
    return byCh.get(ch);
  };

  for (const q of base) {
    const id = String(q.고유ID).trim();
    const ch = String(q.단원).trim();
    const rec = scores[id];
    const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];

    for (const h of hist) {
      const t = +h?.date;
      const sc = +h?.score;
      if (!Number.isFinite(t)) continue;

      // 기간 체크: start <= t <= end
      if (t >= +start && t <= +end) {
        periodSolves++;
        if (Number.isFinite(sc)) periodSum += sc;
        const slot = chRec(ch);
        slot.solves++;
        if (Number.isFinite(sc)) slot.sum += sc;
      }
    }
  }

  const periodAvg = periodSolves ? (periodSum / periodSolves) : null;

  const weak = [];
  byCh.forEach((v, ch) => {
    if (v.solves >= 3) weak.push({ ch, avg: v.sum / v.solves, cnt: v.solves });
  });
  weak.sort((a, b) => a.avg - b.avg);
  const weakTop = weak.slice(0, 3);

  // HLR 통계 계산
  let hlrDataCount = 0;
  let hlrRecallSum = 0;
  let hlrForgetting = 0;

  // calculateRecallProbability는 hlrDataset 모듈에서 window로 노출됨 (Phase 4.5)
  const calculateRecallProbability = window.calculateRecallProbability;

  if (calculateRecallProbability) {
    for (const q of base) {
      const id = String(q.고유ID).trim();
      const hlrData = calculateRecallProbability(id);
      if (hlrData) {
        hlrDataCount++;
        hlrRecallSum += hlrData.p_current;
        if (hlrData.p_current < 0.5) hlrForgetting++;
      }
    }
  }

  const hlrAvgRecall = hlrDataCount > 0 ? (hlrRecallSum / hlrDataCount) : 0;

  const baseDaily = +(localStorage.getItem('dailyTarget_v1') || 20);
  if (!localStorage.getItem('weeklyTarget_v1')) localStorage.setItem('weeklyTarget_v1', String(baseDaily * 7));
  if (!localStorage.getItem('monthlyTarget_v1')) localStorage.setItem('monthlyTarget_v1', String(baseDaily * 30));

  const targetKey = statsView === 'day' ? 'dailyTarget_v1' : statsView === 'week' ? 'weeklyTarget_v1' : 'monthlyTarget_v1';
  const targetLabel = statsView === 'day' ? '오늘 목표' : statsView === 'week' ? '이번 주 목표 (월~일)' : '이번 달 목표';
  const targetVal = +(localStorage.getItem(targetKey) || (statsView === 'day' ? baseDaily : (statsView === 'week' ? baseDaily * 7 : baseDaily * 30)));
  const pct = Math.max(0, Math.min(100, Math.round((periodSolves / Math.max(1, targetVal)) * 100)));
  const fmt = v => v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1);
  const chip = txt => `<button data-go-ch="${txt}" class="px-2 py-0.5 text-xs rounded border hover:bg-gray-50">${chapterLabelText(txt)}</button>`;
  const weakHtml = weakTop.length ? weakTop.map(w => `${chip(w.ch)} <span class="text-xs text-red-600 ml-1">${fmt(w.avg)}점·${w.cnt}회</span>`).join('<br>') : '데이터 부족';

  // 기간 표시
  let periodInfo = '';
  if (statsView === 'week') {
    const startStr = `${start.getMonth() + 1}/${start.getDate()}`;
    const endStr = `${end.getMonth() + 1}/${end.getDate()}`;
    periodInfo = `<div class="text-[11px] text-gray-400 mb-1">${startStr} ~ ${endStr}</div>`;
  } else if (statsView === 'month') {
    periodInfo = `<div class="text-[11px] text-gray-400 mb-1">${statsRefDate.getFullYear()}년 ${statsRefDate.getMonth() + 1}월</div>`;
  }

  const statsContent = document.createElement('div');
  statsContent.id = 'stats-content';
  statsContent.innerHTML = `
    <div class="border rounded p-3 relative">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-bold" id="stats-title">${title}</h3>
          ${periodInfo}
        </div>
        <div class="relative">
          <button id="stats-view-btn" class="flex items-center gap-1 text-sm px-2 py-1 rounded border hover:bg-gray-50">
            <span id="stats-view-label">${label}</span>
            <span id="stats-caret" class="inline-block transition-transform">▼</span>
          </button>
          <div id="stats-view-menu" class="hidden absolute right-0 mt-1 w-28 bg-white dark:bg-gray-900 border rounded shadow-md overflow-hidden z-10">
            <button data-view="day" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">오늘</button>
            <button data-view="week" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">주간</button>
            <button data-view="month" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">월간</button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="p-2 rounded border"><div class="text-[12px] text-gray-500">기간 풀이</div><div class="text-lg font-semibold">${periodSolves} 개</div></div>
        <div class="p-2 rounded border"><div class="text-[12px] text-gray-500">기간 평균</div><div class="text-lg font-semibold">${fmt(periodAvg)} 점</div></div>
        <div class="p-2 rounded border"><div class="text-[12px] text-gray-500">출석</div><div class="text-lg font-semibold">${streak} 일째 <span class="text-xs text-gray-500">(최고 ${best}일)</span></div></div>
        <div class="p-2 rounded border"><div class="text-[12px] text-gray-500">스코프 평균</div><div class="text-lg font-semibold">${fmt(avgAll)} 점</div></div>
      </div>

      <div class="mt-3">
        <div class="flex items-center justify-between"><div class="text-[12px] text-gray-500">${targetLabel} ${targetVal}개</div><div class="text-[12px] text-gray-500">${pct}%</div></div>
        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden"><div class="h-2 ${pct < 60 ? 'bg-red-500' : (pct < 100 ? 'bg-yellow-500' : 'bg-green-600')}" style="width:${pct}%"></div></div>
        <div class="flex items-center gap-2 mt-2">
          <label for="stats-target-input" class="text-xs text-gray-500">목표:</label>
          <input id="stats-target-input" type="number" min="1" class="w-20 px-2 py-1 text-xs border rounded" value="${targetVal}">
          <button id="apply-stats-target" class="text-xs px-2 py-1 border rounded hover:bg-gray-50">적용</button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 mt-3">
        <div class="p-2 rounded border">
          <div class="text-[12px] text-gray-500 mb-1">약한 단원 Top 3 <span class="text-[11px] text-gray-400">(기간 기준)</span></div>
          <div class="text-sm leading-5">${weakHtml}</div>
        </div>
      </div>

      <div class="text-[12px] text-gray-500 mt-2">
        최근 학습: <strong class="text-gray-700">${recentTxt}</strong> · 복습 추가(★): <strong class="text-gray-700">${flagged}</strong>
        ${hlrDataCount > 0 ? `<br>HLR: 평균 회상 <strong class="text-gray-700">${(hlrAvgRecall * 100).toFixed(0)}%</strong> · 망각 임박 <strong class="text-red-600">${hlrForgetting}</strong>개` : ''}
      </div>
    </div>`;

  // 기존 stats-content 제거 후 새로 추가
  const oldContent = el.statsOverview.querySelector('#stats-content');
  if (oldContent) oldContent.remove();
  el.statsOverview.appendChild(statsContent);

  const btn = document.getElementById('stats-view-btn');
  const caret = document.getElementById('stats-caret');
  const menu = document.getElementById('stats-view-menu');

  const openMenu = () => {
    menu.classList.remove('hidden');
    caret.style.transform = 'rotate(180deg)';
  };

  const closeMenu = () => {
    menu.classList.add('hidden');
    caret.style.transform = 'rotate(0deg)';
  };

  btn?.addEventListener('click', e => {
    e.stopPropagation();
    if (menu.classList.contains('hidden')) openMenu();
    else closeMenu();
  });

  document.addEventListener('click', closeMenu, { once: true });

  menu?.querySelectorAll('[data-view]')?.forEach(i => i.addEventListener('click', () => {
    const v = i.getAttribute('data-view');
    window.statsView = v;
    localStorage.setItem('statsView_v1', v);
    renderStats();
  }));

  const applyBtn = document.getElementById('apply-stats-target');
  applyBtn?.addEventListener('click', () => {
    const input = document.getElementById('stats-target-input');
    const v = Math.max(1, Math.min(9999, Math.round(+(input?.value || 1))));
    localStorage.setItem(targetKey, String(v));
    renderStats();
  });

  // reloadAndRefresh는 window를 통해 접근
  el.statsOverview.querySelectorAll('[data-go-ch]')?.forEach(b => b.addEventListener('click', () => {
    const ch = b.getAttribute('data-go-ch') || '';
    if (ch) {
      el.chapterSelect.value = ch;
      if (window.reloadAndRefresh) {
        window.reloadAndRefresh();
      }
      showToast(`${chapterLabelText(ch)} 로 이동`);
    }
  }));
}

// ============================================
// 이벤트 리스너 초기화 (Phase 5.1)
// ============================================

/**
 * 캘린더 네비게이션 이벤트 리스너 초기화
 * Phase 1.5: Event Delegation 적용
 */
export function initCalendarListeners() {
  const el = getElements();
  if (!el) return;

  // Calendar prev/next buttons
  el.calPrev?.addEventListener('click', () => {
    const date = getCalRefDate();
    date.setMonth(date.getMonth() - 1);
    renderCalendarMonth();
  });

  el.calNext?.addEventListener('click', () => {
    const date = getCalRefDate();
    date.setMonth(date.getMonth() + 1);
    renderCalendarMonth();
  });

  // Phase 1.5: 캘린더 셀 클릭 Event Delegation (한 번만 바인딩)
  if (!el.calendarGrid._calendarCellClickHandler) {
    const clickHandler = (e) => {
      const target = e.target.closest('.cal-cell');
      if (!target) return;

      const title = target.title;
      if (!title) return;

      const dateStr = title.split(' ')[0];
      const clickedDate = new Date(dateStr + 'T00:00:00');
      if (isNaN(clickedDate.getTime())) return;

      setStatsRefDate(clickedDate);
      saveStatsDate();
      renderStats();

      showToast(`${dateStr} 통계로 이동`, 'info');

      setTimeout(() => {
        const offset = getHeaderOffset();
        const statsBox = el.statsOverview?.closest('.bg-white');
        if (statsBox) {
          const y = statsBox.getBoundingClientRect().top + window.pageYOffset - offset - 8;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
      }, 100);
    };

    el.calendarGrid.addEventListener('click', clickHandler);
    el.calendarGrid._calendarCellClickHandler = clickHandler;

    // 커서 스타일을 CSS로 변경 권장하지만, 기존 동작 유지
    el.calendarGrid.style.cursor = 'pointer';
  }
}
