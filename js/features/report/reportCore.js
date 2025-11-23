/**
 * @fileoverview 딥러닝 리포트 핵심 기능
 * - 리포트 모달 관리
 * - 리포트 데이터 수집 및 처리
 * - 액션 플랜 렌더링
 */

import { el, $ } from '../../ui/elements.js';
import { normId, clamp } from '../../utils/helpers.js';
import { chapterLabelText } from '../../config/config.js';
import { renderDailyVolumeChart, renderScoreTrendChart, renderChapterWeaknessChart, calculateMovingAverage } from './charts.js';
import { showToast, closeDrawer } from '../../ui/domUtils.js';
import { LocalHLRPredictor, EnhancedHLRPredictor, calculateRecallProbability } from '../review/hlrDataset.js';
import { initFlowMap, updateFlowMapUI } from './flowMap.js';

// Module state
let reportCharts = {};
let reportData = { period: 30, threshold: 60 };
let dailyRecordDate = Date.now(); // Tab 4: 일일 학습 기록 날짜

/**
 * 리포트 모달 열기
 */
export function openReportModal() {
  // Close hamburger menu if open (mobile)
  closeDrawer();

  el.reportModal?.classList.remove('hidden');
  el.reportModal?.classList.add('flex');
  // Delay chart generation to ensure modal is rendered
  setTimeout(() => {
    generateReport();
    initSummaryBookUI(); // Tab 5 챕터 체크박스 초기화
  }, 50);
}

/**
 * 리포트 모달 닫기
 */
export function closeReportModal() {
  el.reportModal?.classList.add('hidden');
  el.reportModal?.classList.remove('flex');
  // Destroy all charts
  Object.values(reportCharts).forEach(chart => chart?.destroy());
  reportCharts = {};

  // Restore left sidebar visibility on desktop
  if (window.innerWidth >= 1024) {
    el.leftDashboard?.classList.remove('hidden');
    el.drawerBackdrop?.classList.add('hidden');
    el.leftDashboard?.classList.remove('fixed', 'inset-0', 'z-[1100]', 'p-4', 'overflow-y-auto', 'bg-white', 'dark:bg-gray-900', 'relative');
    el.drawerClose?.classList.add('hidden');
  }
}

/**
 * 리포트 탭 전환
 * @param {number} tabNum - 탭 번호 (1, 2, 3, 4)
 */
export function switchReportTab(tabNum) {
  const tabs = document.querySelectorAll('.report-tab');
  const contents = document.querySelectorAll('.report-content');
  tabs.forEach((tab, i) => {
    const num = i + 1;
    if (num === tabNum) {
      tab.classList.add('border-blue-600', 'text-blue-600');
      tab.classList.remove('border-transparent');
      tab.setAttribute('aria-selected', 'true');
    } else {
      tab.classList.remove('border-blue-600', 'text-blue-600');
      tab.classList.add('border-transparent');
      tab.setAttribute('aria-selected', 'false');
    }
  });
  contents.forEach((content, i) => {
    if (i + 1 === tabNum) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });

  // Tab 4 진입 시 일일 학습 기록 렌더링
  if (tabNum === 4) {
    renderDailyProblemList(dailyRecordDate);
  }
}

/**
 * 리포트 데이터 수집 (Task 3: HLR 기반 복습 플래너)
 * @returns {{dailyData: Map, chapterData: Map, weakProblems: Array}}
 */
export function getReportData() {
  const period = reportData.period;
  const threshold = reportData.threshold;
  const now = Date.now();
  const cutoffDate = period === 'all' ? 0 : now - (period * 24 * 60 * 60 * 1000);

  const dailyData = new Map(); // date -> {count, scores[]}
  const chapterData = new Map(); // chapter -> {scores[], dates[]}
  const weakProblems = []; // problems below threshold

  // HLR 예측기 생성 (Enhanced with FSRS difficulty)
  const predictor = new EnhancedHLRPredictor();

  // HLR 계산 결과 캐싱 (성능 최적화)
  const hlrCache = new Map();

  for (const [qid, rec] of Object.entries(window.questionScores || {})) {
    const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
    for (const h of hist) {
      const date = +h?.date;
      const score = clamp(+h?.score || 0, 0, 100);
      if (!Number.isFinite(date) || date < cutoffDate) continue;

      // Daily data
      const dateKey = new Date(date).toISOString().slice(0, 10);
      if (!dailyData.has(dateKey)) dailyData.set(dateKey, { count: 0, scores: [] });
      dailyData.get(dateKey).count++;
      dailyData.get(dateKey).scores.push(score);

      // Find problem
      const problem = window.allData.find(q => normId(q.고유ID) === qid);
      if (problem) {
        const chapter = problem.단원 || '기타';
        if (!chapterData.has(chapter)) chapterData.set(chapter, { scores: [], dates: [] });
        chapterData.get(chapter).scores.push(score);
        chapterData.get(chapter).dates.push(date);

        // Weak problems (HLR 데이터 추가)
        if (score < threshold) {
          // 캐시 확인 후 계산 (동일 qid에 대해 중복 계산 방지)
          if (!hlrCache.has(qid)) {
            hlrCache.set(qid, calculateRecallProbability(qid, predictor));
          }
          const hlrData = hlrCache.get(qid);

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
      }
    }
  }

  // 중복 제거: 각 qid당 최신 기록 1개만 유지 (AI 분석용)
  const uniqueWeakProblems = [];
  const qidMap = new Map();

  for (const item of weakProblems) {
    const existing = qidMap.get(item.qid);
    // 같은 qid가 없거나, 현재 기록이 더 최신이면 업데이트
    if (!existing || item.date > existing.date) {
      qidMap.set(item.qid, item);
    }
  }

  // Map을 배열로 변환 (최신순 정렬)
  const deduplicatedWeakProblems = Array.from(qidMap.values())
    .sort((a, b) => b.date - a.date);

  // 차트 데이터 사전 계산 (성능 최적화: 중복 계산 방지)
  let chartData = null;
  const sorted = Array.from(dailyData.entries())
    .filter(([, v]) => v.scores.length > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (sorted.length > 0) {
    const avgScores = sorted.map(([, v]) => {
      const avg = v.scores.reduce((a, b) => a + b, 0) / v.scores.length;
      return Math.round(avg * 10) / 10;
    });

    chartData = {
      sorted,
      avgScores,
      ma5: calculateMovingAverage(avgScores, 5),
      ma20: calculateMovingAverage(avgScores, 20),
      ma60: calculateMovingAverage(avgScores, 60)
    };
  }

  return { dailyData, chapterData, weakProblems: deduplicatedWeakProblems, chartData };
}

// ============================================
// Tab 4: 일일 학습 기록 (Daily Learning Record)
// ============================================

/**
 * YYYY-MM-DD 형식의 날짜 문자열 반환
 * @param {number|Date} d - 날짜 (timestamp 또는 Date 객체)
 * @returns {string} YYYY-MM-DD
 */
function ymd(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 특정 날짜에 풀었던 문제 목록 조회
 * @param {number} targetDate - 조회할 날짜 (timestamp)
 * @returns {Array} 해당 날짜에 푼 문제 목록
 */
function getDailyRecordData(targetDate) {
  const targetYmd = ymd(targetDate);
  const records = [];

  for (const [qid, rec] of Object.entries(window.questionScores || {})) {
    const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
    for (const h of hist) {
      const hDate = +h?.date;
      if (!Number.isFinite(hDate)) continue;

      const hYmd = ymd(hDate);
      if (hYmd === targetYmd) {
        const problem = window.allData?.find(q => normId(q.고유ID) === qid);
        if (problem) {
          records.push({
            qid,
            problem,
            score: clamp(+h?.score || 0, 0, 100),
            timestamp: hDate,
            user_answer: rec?.user_answer || '',
            feedback: rec?.feedback || ''
          });
        }
      }
    }
  }

  // 시간순 정렬 (최신순)
  records.sort((a, b) => b.timestamp - a.timestamp);
  return records;
}

/**
 * 일일 학습 기록 렌더링
 * @param {number} date - 조회할 날짜 (timestamp)
 */
function renderDailyProblemList(date) {
  const dateDisplay = el.dailyRecordDate;
  const problemList = el.dailyProblemList;

  if (!dateDisplay || !problemList) return;

  // 날짜 표시
  const dt = new Date(date);
  const displayText = `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 (${['일', '월', '화', '수', '목', '금', '토'][dt.getDay()]})`;
  dateDisplay.textContent = displayText;

  // 데이터 조회
  const records = getDailyRecordData(date);

  if (records.length === 0) {
    problemList.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-8">이 날짜에 푼 문제가 없습니다.</div>';
    return;
  }

  // 문제 카드 렌더링
  problemList.innerHTML = records.map((rec, idx) => {
    const title = rec.problem.problemTitle || `문항 ${rec.problem.표시번호}`;
    const timeStr = new Date(rec.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const scoreColor = rec.score >= 80 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                       rec.score >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                       'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';

    return `
      <div class="border rounded-lg p-4 dark:border-gray-700" data-daily-problem="${idx}">
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-semibold text-gray-900 dark:text-white">${title}</h4>
          <span class="text-xs px-2 py-1 rounded-full ${scoreColor}">${rec.score}점</span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">${timeStr} 풀이</p>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3"><strong>물음:</strong> ${rec.problem.물음}</p>

        <div class="flex gap-2 flex-wrap">
          <button class="daily-show-answer-btn text-sm px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition" type="button">
            📖 답안 보기
          </button>
          <button class="daily-coach-btn text-sm px-3 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition" type="button" data-qid="${rec.qid}">
            💡 암기팁 보기
          </button>
        </div>

        <div class="daily-answer-detail hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded space-y-2">
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">내 답안:</p>
            <p class="text-sm text-gray-700 dark:text-gray-300">${rec.user_answer || '(기록 없음)'}</p>
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">모범 답안:</p>
            <p class="text-sm text-gray-700 dark:text-gray-300">${rec.problem.정답}</p>
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">AI 총평:</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">${rec.feedback || '(피드백 없음)'}</p>
          </div>
        </div>

        <div class="daily-coaching-tip hidden mt-3 p-4 bg-blue-50 rounded">
          <div class="flex justify-between items-start mb-2">
            <p class="text-sm font-bold text-gray-900">💡 암기 팁</p>
            <div class="flex gap-2">
              <button class="coaching-regen-btn text-xs px-2 py-1 rounded bg-orange-100 text-gray-900 hover:bg-orange-200 transition" type="button" data-qid="${rec.qid}">
                🔄 새로 생성
              </button>
              <button class="coaching-copy-btn text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition" type="button">
                📋 복사
              </button>
            </div>
          </div>
          <pre class="coaching-content whitespace-pre-wrap text-sm font-sans leading-relaxed" style="color: #111827 !important;"></pre>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 날짜 이동 핸들러
 * @param {number} days - 이동할 일수 (음수: 이전, 양수: 다음)
 */
function handleDateNavigation(days) {
  dailyRecordDate += days * 24 * 60 * 60 * 1000;
  renderDailyProblemList(dailyRecordDate);
}

/**
 * 리포트 생성
 */
export function generateReport() {
  reportData.period = el.reportPeriodSelect?.value === 'all' ? 'all' : +el.reportPeriodSelect?.value || 30;
  reportData.threshold = +el.reportThresholdSelect?.value || 60;

  const data = getReportData();

  // Clear previous charts
  Object.values(reportCharts).forEach(chart => chart?.destroy());
  reportCharts = {};

  renderDailyVolumeChart(data.dailyData, reportCharts);
  renderScoreTrendChart(data.dailyData, reportCharts, data.chartData); // 성능 최적화: 사전 계산된 데이터 전달
  renderChapterWeaknessChart(data.chapterData, reportCharts);
  renderActionPlan(data.weakProblems);

  // Update Audit Flow Map (v5.0)
  updateFlowMapUI();
}

/**
 * 액션 플랜 렌더링 (Task 3: HLR 기반 복습 우선순위)
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

  const urgentList = $('action-urgent-list');
  const weeklyList = $('action-weekly-list');
  const longtermList = $('action-longterm-list');

  // 문제 목록 렌더링 (HLR 정보 포함)
  const renderProblemItem = (wp) => {
    let hlrInfo = '';
    if (reviewMode === 'hlr' && wp.p_current !== null) {
      const pPercent = Math.round(wp.p_current * 100);
      const predictor = new EnhancedHLRPredictor();
      const nextReviewDays = Math.round(predictor.getNextReviewDelta(wp.h_pred || 14, 0.9));

      hlrInfo = `<div class="ml-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
        회상 확률: ${pPercent}% | 다음 복습: ${nextReviewDays <= 0 ? '즉시!' : nextReviewDays + '일 후'}
      </div>`;
    }

    const title = wp.problem.problemTitle || wp.problem.물음?.slice(0, 30) + '...';
    return `<div class="text-sm border-b pb-2 mb-2 last:border-b-0">
      <div>• ${title} <span class="text-red-600 dark:text-red-400">(${wp.score}점)</span></div>
      ${hlrInfo}
    </div>`;
  };

  if (urgentList) {
    urgentList.innerHTML = urgent.length
      ? urgent.slice(0, 10).map(renderProblemItem).join('')
      : '<div class="text-sm text-gray-500 dark:text-gray-400">없음</div>';
  }

  if (weeklyList) {
    weeklyList.innerHTML = weekly.length
      ? weekly.slice(0, 10).map(renderProblemItem).join('')
      : '<div class="text-sm text-gray-500 dark:text-gray-400">없음</div>';
  }

  if (longtermList) {
    longtermList.innerHTML = longterm.length
      ? longterm.slice(0, 10).map(renderProblemItem).join('')
      : '<div class="text-sm text-gray-500 dark:text-gray-400">없음</div>';
  }

  // 오답노트 렌더링 (기존 로직 유지)
  renderWrongAnswers(weakProblems);
}

/**
 * 오답노트 렌더링 (기존 코드 분리)
 * @param {Array} weakProblems - 약점 문제 목록
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
      <div class="border rounded-lg p-4 dark:border-gray-700" data-problem-container>
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-semibold">${wp.problem.problemTitle || '문항 ' + wp.problem.표시번호}</h4>
          <span class="text-xs px-2 py-1 rounded-full ${wp.score < 60 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'}">${wp.score}점</span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2"><strong>물음:</strong> ${wp.problem.물음}</p>
        <p class="text-sm mb-2"><strong>내 답안:</strong> ${userAnswer}</p>
        <button class="show-answer-btn text-sm text-blue-600 dark:text-blue-400 hover:underline" type="button">
          🧠 모범 답안 및 AI 총평 보기
        </button>
        <div class="answer-detail hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
          <p class="text-sm mb-2"><strong>모범 답안:</strong> ${wp.problem.정답}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400"><strong>AI 총평:</strong> ${aiFeedback}</p>
        </div>
      </div>
    `;
  }).join('');

  // 이벤트 리스너는 initReportListeners()에서 한 번만 등록됨
}

/**
 * 리포트 이벤트 리스너 초기화
 */
export function initReportListeners() {
  el.openReportBtn?.addEventListener('click', openReportModal);
  el.reportCloseBtn?.addEventListener('click', closeReportModal);
  el.reportRefreshBtn?.addEventListener('click', generateReport);
  el.chartScopeSelect?.addEventListener('change', () => {
    // TODO: Implement daily/weekly/monthly aggregation
    generateReport();
  });

  // Tab switching
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabNum = +tab.getAttribute('data-tab');
      switchReportTab(tabNum);
    });
  });

  // Save snapshot functionality - AI Analysis & Action Plan only
  el.reportSaveSnapshotBtn?.addEventListener('click', () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const snapshot = {
      timestamp: new Date().toISOString(),
      period: reportData.period,
      threshold: reportData.threshold,
      aiAnalysis: {
        errorPattern: $('ai-error-pattern')?.innerHTML || null,
        conceptWeakness: $('ai-concept-weakness')?.innerHTML || null
      },
      actionPlan: $('report-content-3')?.innerHTML || null
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `학습분석_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('AI 분석 및 액션 플랜이 저장되었습니다');
  });

  // Load snapshot functionality
  el.reportLoadSnapshotBtn?.addEventListener('click', () => {
    el.reportLoadSnapshotInput?.click();
  });

  el.reportLoadSnapshotInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);

      // Validate snapshot structure (new format: AI analysis + action plan)
      if (!snapshot.timestamp || !snapshot.aiAnalysis) {
        showToast('올바른 학습 분석 파일이 아닙니다', 'error');
        return;
      }

      // Restore AI analysis
      if (snapshot.aiAnalysis.errorPattern) {
        const aiErrorPattern = $('ai-error-pattern');
        if (aiErrorPattern) {
          aiErrorPattern.innerHTML = snapshot.aiAnalysis.errorPattern;
        }
      }

      if (snapshot.aiAnalysis.conceptWeakness) {
        const aiConceptWeakness = $('ai-concept-weakness');
        if (aiConceptWeakness) {
          aiConceptWeakness.innerHTML = snapshot.aiAnalysis.conceptWeakness;
        }
      }

      // Show AI analysis section
      const aiResult = $('ai-analysis-result');
      const aiLoading = $('ai-analysis-loading');
      if (aiResult) aiResult.classList.remove('hidden');
      if (aiLoading) aiLoading.classList.add('hidden');

      // Restore action plan
      if (snapshot.actionPlan) {
        const actionPlanContent = $('report-content-3');
        if (actionPlanContent) {
          actionPlanContent.innerHTML = snapshot.actionPlan;
        }
      }

      // Update report metadata
      reportData.period = snapshot.period;
      reportData.threshold = snapshot.threshold;

      // Switch to AI analysis tab
      switchReportTab(2);

      const snapshotDate = new Date(snapshot.timestamp).toLocaleString('ko-KR');
      showToast(`학습 분석 불러오기 완료 (저장 시각: ${snapshotDate})`);

      // Reset file input for next use
      e.target.value = '';

    } catch (err) {
      showToast('파일 읽기 실패: ' + err.message, 'error');
      e.target.value = '';
    }
  });

  // PDF Export functionality (Task 2: 선택형 PDF 내보내기)
  el.reportPrintBtn?.addEventListener('click', openPdfOptionsModal);

  // PDF 옵션 모달 이벤트 리스너
  document.getElementById('pdf-options-cancel-btn')?.addEventListener('click', closePdfOptionsModal);
  document.getElementById('pdf-options-execute-btn')?.addEventListener('click', executePdfExport);
  document.getElementById('pdf-check-all')?.addEventListener('change', toggleAllCheckboxes);

  // 개별 체크박스에 리스너 추가
  document.querySelectorAll('.pdf-tab-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateCheckAllStatus);
  });

  // 오답노트 버튼 이벤트 리스너 (전역 등록, 한 번만)
  // innerHTML로 생성된 버튼에도 작동하도록 이벤트 위임 사용
  const wrongAnswersContainer = $('action-wrong-answers');
  if (wrongAnswersContainer) {
    wrongAnswersContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.show-answer-btn');
      if (btn) {
        const container = btn.closest('[data-problem-container]');
        const detail = container?.querySelector('.answer-detail');
        if (detail) {
          detail.classList.toggle('hidden');
          btn.textContent = detail.classList.contains('hidden') ?
            '🧠 모범 답안 및 AI 총평 보기' : '🙈 답안 숨기기';
        }
      }
    });
  }

  // Tab 4: 일일 학습 기록 이벤트 리스너
  el.dailyPrevBtn?.addEventListener('click', () => handleDateNavigation(-1));
  el.dailyNextBtn?.addEventListener('click', () => handleDateNavigation(1));

  // 날짜 클릭 시 date picker 열기
  el.dailyRecordDate?.addEventListener('click', () => {
    if (el.dailyDatePicker) {
      // 현재 날짜를 YYYY-MM-DD 형식으로 설정
      const currentDate = new Date(dailyRecordDate);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      el.dailyDatePicker.value = `${year}-${month}-${day}`;
      el.dailyDatePicker.showPicker();
    }
  });

  // date picker에서 날짜 선택 시
  el.dailyDatePicker?.addEventListener('change', (e) => {
    const selectedDate = new Date(e.target.value);
    dailyRecordDate = selectedDate.getTime();
    renderDailyProblemList(dailyRecordDate);
  });

  // 일일 학습 기록 버튼 이벤트 리스너 (이벤트 위임)
  const dailyProblemList = el.dailyProblemList;
  if (dailyProblemList) {
    dailyProblemList.addEventListener('click', async (e) => {
      // 답안 보기 토글
      const showAnswerBtn = e.target.closest('.daily-show-answer-btn');
      if (showAnswerBtn) {
        const container = showAnswerBtn.closest('[data-daily-problem]');
        const detail = container?.querySelector('.daily-answer-detail');
        if (detail) {
          detail.classList.toggle('hidden');
          showAnswerBtn.textContent = detail.classList.contains('hidden') ?
            '📖 답안 보기' : '🙈 답안 숨기기';
        }
        return;
      }

      // AI 암기 코치
      const coachBtn = e.target.closest('.daily-coach-btn');
      if (coachBtn) {
        const qid = coachBtn.getAttribute('data-qid');
        if (qid) {
          // analysis.js의 handleCoachingRequest 함수 호출
          if (typeof window.handleCoachingRequest === 'function') {
            await window.handleCoachingRequest(qid, coachBtn);
          } else {
            showToast('암기 코치 기능이 아직 구현되지 않았습니다.', 'warn');
          }
        }
        return;
      }

      // 암기 팁 복사 버튼
      const copyBtn = e.target.closest('.coaching-copy-btn');
      if (copyBtn) {
        const container = copyBtn.closest('[data-daily-problem]');
        const content = container?.querySelector('.coaching-content')?.textContent;
        if (content) {
          navigator.clipboard.writeText(content).then(() => {
            showToast('암기 팁을 복사했습니다');
          }).catch(() => {
            showToast('복사 실패', 'error');
          });
        }
        return;
      }

      // 암기 팁 새로 생성 버튼
      const regenBtn = e.target.closest('.coaching-regen-btn');
      if (regenBtn) {
        const qid = regenBtn.getAttribute('data-qid');
        if (qid) {
          // analysis.js의 handleCoachingRequest 함수를 forceRegenerate = true로 호출
          if (typeof window.handleCoachingRequest === 'function') {
            await window.handleCoachingRequest(qid, regenBtn, true);
          } else {
            showToast('암기 코치 기능이 아직 구현되지 않았습니다.', 'warn');
          }
        }
      }
    });
  }

  // Tab 5: 나만의 요약서 이벤트 리스너
  el.reportTab5?.addEventListener('click', () => {
    switchReportTab(5);
    initSummaryBookUI(); // 처음 열릴 때 챕터 체크박스 초기화
  });

  el.generateSummaryBookBtn?.addEventListener('click', generateSummaryBook);

  // Initialize Audit Flow Map (v5.0)
  initFlowMap();
}

/**
 * PDF 옵션 모달 열기
 */
function openPdfOptionsModal() {
  const modal = document.getElementById('pdf-options-modal');
  if (!modal) return;

  // 체크박스 초기화 (모든 탭 기본 체크)
  const checkAll = document.getElementById('pdf-check-all');
  const tab1 = document.getElementById('pdf-check-tab1');
  const tab2 = document.getElementById('pdf-check-tab2');
  const tab3 = document.getElementById('pdf-check-tab3');
  const tab4 = document.getElementById('pdf-check-tab4');
  const tab5 = document.getElementById('pdf-check-tab5');

  if (tab1) tab1.checked = true;
  if (tab2) tab2.checked = true;
  if (tab3) tab3.checked = true;
  if (tab4) tab4.checked = true;
  if (tab5) tab5.checked = true; // Tab 5도 기본 체크

  if (checkAll) checkAll.checked = true; // 전체 선택도 체크

  // 확실하게 최상위에 오도록 body 맨 끝으로 이동 & z-index 명시적 설정
  document.body.appendChild(modal);
  modal.style.zIndex = '99999';

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
  const tab1 = document.getElementById('pdf-check-tab1')?.checked || false;
  const tab2 = document.getElementById('pdf-check-tab2')?.checked || false;
  const tab3 = document.getElementById('pdf-check-tab3')?.checked || false;
  const tab4 = document.getElementById('pdf-check-tab4')?.checked || false;
  const tab5 = document.getElementById('pdf-check-tab5')?.checked || false;

  // 최소 1개는 선택해야 함
  if (!tab1 && !tab2 && !tab3 && !tab4 && !tab5) {
    showToast('최소 1개 탭을 선택해주세요', 'warn');
    return;
  }

  // 선택 해제된 탭에 .print-hidden 클래스 추가
  const contents = [
    { element: document.getElementById('report-content-1'), checked: tab1 },
    { element: document.getElementById('report-content-2'), checked: tab2 },
    { element: document.getElementById('report-content-3'), checked: tab3 },
    { element: document.getElementById('report-content-4'), checked: tab4 },
    { element: document.getElementById('report-content-5'), checked: tab5 }
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

  // Chart.js 차트를 print에 최적화
  // beforeprint 이벤트가 발생하면 차트가 이미 준비되어 있어야 함
  if (tab1 && window.Chart && reportCharts) {
    // 모든 차트의 animation을 끄고 업데이트
    Object.values(reportCharts).forEach(chart => {
      if (chart && chart.update) {
        chart.options.animation = false;
        chart.update('none'); // 즉시 업데이트, 애니메이션 없이
      }
    });
  }

  // 약간의 지연을 두어 차트가 완전히 렌더링되도록 함
  setTimeout(() => {
    // 인쇄 실행
    window.print();

    // 인쇄 후 정리 (브라우저 호환성 대응)
    const cleanup = () => {
      contents.forEach(({ element }) => {
        if (element) element.classList.remove('print-hidden');
      });

      // 차트 animation 복원
      if (window.Chart && reportCharts) {
        Object.values(reportCharts).forEach(chart => {
          if (chart && chart.options) {
            chart.options.animation = true;
          }
        });
      }
    };

    // 표준 이벤트
    window.addEventListener('afterprint', cleanup, { once: true });

    // Safari/iOS 대응: 포커스 복귀 시 정리
    window.addEventListener('focus', () => {
      setTimeout(cleanup, 100);
    }, { once: true });
  }, 100); // 100ms 지연으로 차트 렌더링 보장
}

/**
 * 전체 선택/해제 토글
 */
function toggleAllCheckboxes() {
  const checkAll = document.getElementById('pdf-check-all');
  const checkboxes = document.querySelectorAll('.pdf-tab-checkbox');

  if (checkAll) {
    checkboxes.forEach(cb => cb.checked = checkAll.checked);
  }
}

/**
 * 개별 체크박스 변경 시 전체 선택 상태 갱신
 */
function updateCheckAllStatus() {
  const checkAll = document.getElementById('pdf-check-all');
  const checkboxes = document.querySelectorAll('.pdf-tab-checkbox');

  if (checkAll) {
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkAll.checked = allChecked;
  }
}

// ============================================
// Tab 5: 나만의 요약서 (Summary Book)
// ============================================

/**
 * Tab 5 초기화 및 챕터 체크박스 생성
 */
function initSummaryBookUI() {
  const container = document.getElementById('summary-chapter-filters');
  if (!container || container.dataset.initialized) return;

  // 챕터 1~20 체크박스 생성
  const chapters = Array.from({ length: 20 }, (_, i) => i + 1);

  let html = `<label class="flex items-center space-x-1 text-sm mr-3 mb-2"><input type="checkbox" id="chk-chapter-all" class="rounded" checked> <span class="font-bold">전체</span></label>`;

  chapters.forEach(ch => {
    html += `<label class="flex items-center space-x-1 text-sm mr-3 mb-2"><input type="checkbox" class="chk-chapter rounded" value="${ch}" checked> <span>${ch}장</span></label>`;
  });

  container.innerHTML = html;
  container.dataset.initialized = 'true';

  // 전체 선택/해제 로직
  const allChk = document.getElementById('chk-chapter-all');
  allChk?.addEventListener('change', (e) => {
    document.querySelectorAll('.chk-chapter').forEach(cb => cb.checked = e.target.checked);
  });
}

/**
 * 요약서 데이터 필터링 및 생성
 */
export function generateSummaryBook() {
  console.log('📑 요약서 생성 시작...');

  const questionScores = JSON.parse(localStorage.getItem('questionScores') || '{}');
  const allData = window.allData || [];
  const resultContainer = document.getElementById('summary-book-result');

  console.log(`   - allData: ${allData.length}개 문제`);
  console.log(`   - questionScores: ${Object.keys(questionScores).length}개 기록`);

  if (!resultContainer) {
    console.error('❌ summary-book-result 컨테이너 없음');
    showToast('요약서 컨테이너를 찾을 수 없습니다', 'error');
    return;
  }

  if (allData.length === 0) {
    console.warn('⚠️ allData가 비어있음');
    showToast('문제 데이터가 로드되지 않았습니다', 'warn');
    return;
  }

  // 1. 필터 조건 수집
  const selectedChapters = Array.from(document.querySelectorAll('.chk-chapter:checked')).map(cb => cb.value);
  const selectedSources = Array.from(document.querySelectorAll('.chk-source:checked')).map(cb => cb.value);

  console.log(`   - 선택된 단원: ${selectedChapters.length}개`, selectedChapters);
  console.log(`   - 선택된 출처: ${selectedSources.join(', ')}`);

  const scoreFilters = Array.from(document.querySelectorAll('.chk-condition:checked')).map(cb => cb.value);
  const includeExcluded = scoreFilters.includes('excluded');

  // 표시 옵션
  const showModelAnswer = document.getElementById('show-model-answer')?.checked || false;
  const showMyScore = document.getElementById('show-my-score')?.checked || false;
  const showMemoryTip = document.getElementById('show-memory-tip')?.checked || false;
  const showAiFeedback = document.getElementById('show-ai-feedback')?.checked || false;

  // 2. 출처 그룹 판별 함수 (filterCore.js의 detectSourceGroup 간소화 버전)
  const detectSourceGroup = (source) => {
    if (!source) return 'other';
    const s = source.toUpperCase();
    if (/^(S|H|HS)$/.test(s)) return 'basic';
    if (/^(SS|P)$/.test(s)) return 'advanced';
    if (/^(S|H|HS|SS|P)$/.test(s)) return 'basic-advanced';
    return 'other';
  };

  // 3. 데이터 필터링
  let filtered = allData.filter(q => {
    const qid = normId(q.고유ID);
    const record = questionScores[qid] || {};
    const ch = String(q.단원 || '').trim();
    const sourceGroup = detectSourceGroup(q.출처);

    // 3-1. 단원 필터
    if (!selectedChapters.includes(ch)) return false;

    // 3-2. 출처 필터
    if (sourceGroup === 'basic-advanced') {
      if (!selectedSources.includes('basic') && !selectedSources.includes('advanced')) return false;
    } else {
      if (!selectedSources.includes(sourceGroup)) return false;
    }

    // 3-3. 상태/점수 필터 (OR 조건)
    // 필터가 없으면 모든 문제 허용, 필터가 있으면 하나라도 만족해야 함
    let matchCondition = scoreFilters.length === 0; // 필터 없으면 true로 시작
    const score = record.score !== undefined ? record.score : null;

    if (!matchCondition) {
      // 필터가 있을 때만 조건 체크
      if (scoreFilters.includes('score60') && score !== null && score < 60) matchCondition = true;
      if (scoreFilters.includes('score70') && score !== null && score < 70) matchCondition = true;
      if (scoreFilters.includes('score80') && score !== null && score < 80) matchCondition = true;
      if (scoreFilters.includes('score90') && score !== null && score < 90) matchCondition = true;
      if (scoreFilters.includes('flagged') && record.userReviewFlag) matchCondition = true;
    }

    // 복습 제외 항목 처리
    if (record.userReviewExclude && !includeExcluded) return false;

    return matchCondition;
  });

  // 4. 정렬 (단원 -> 번호)
  filtered.sort((a, b) => {
    const chA = +(a.단원 || 999);
    const chB = +(b.단원 || 999);
    if (chA !== chB) return chA - chB;

    const noA = +(a.표시번호 || a.물음번호 || 0);
    const noB = +(b.표시번호 || b.물음번호 || 0);
    return noA - noB;
  });

  // 5. HTML 렌더링
  if (filtered.length === 0) {
    resultContainer.innerHTML = `
      <div class="text-center py-20 text-gray-500 dark:text-gray-400">
        <p class="text-xl">조건에 맞는 문제가 없습니다.</p>
        <p class="text-sm mt-2">필터 조건을 변경해보세요.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="summary-book-header text-center mb-8 border-b-2 border-gray-800 dark:border-gray-600 pb-4">
      <h1 class="text-3xl font-black mb-2 text-gray-900 dark:text-white">나만의 회계감사 요약서</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400">생성일: ${new Date().toLocaleDateString()} | 총 ${filtered.length}문제</p>
    </div>
  `;

  let currentChapter = null;

  filtered.forEach(q => {
    const chNum = +(q.단원 || 0);
    const qid = normId(q.고유ID);
    const record = questionScores[qid] || {};

    // 챕터 헤더
    if (chNum !== currentChapter) {
      html += `
        <div class="chapter-header mt-6 mb-4 pb-2 border-b-2 border-gray-400 dark:border-gray-600 text-lg font-bold text-blue-800 dark:text-blue-400 break-inside-avoid">
          ${chapterLabelText(chNum)}
        </div>
      `;
      currentChapter = chNum;
    }

    // 문제 카드
    const scoreBadgeColor = (record.score >= 80) ? 'text-green-600' : (record.score >= 60 ? 'text-yellow-600' : 'text-red-600');
    const flagIcon = record.userReviewFlag ? '<span class="text-yellow-500">★</span>' : '';
    const excludeIcon = record.userReviewExclude ? '<span class="text-gray-400">➖</span>' : '';

    html += `
      <div class="problem-card mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 break-inside-avoid">
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-bold text-base text-gray-900 dark:text-white pr-2">
            ${flagIcon}${excludeIcon} [${q.출처 || ''}] ${q.problemTitle || '문항 ' + (q.표시번호 || q.고유ID)}
          </h4>
          ${showMyScore ? `<span class="text-sm font-bold ${scoreBadgeColor}">${record.score || 0}점</span>` : ''}
        </div>

        <div class="question-text text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
          Q. ${q.물음 || ''}
        </div>

        ${showModelAnswer ? `
          <div class="model-answer text-sm bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600 text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
            <span class="font-bold text-xs text-blue-500 block mb-1">모범 답안</span>
            ${q.정답 || ''}
          </div>
        ` : ''}

        ${showMemoryTip && record.memoryTip ? `
          <div class="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-gray-800 dark:text-gray-200">
            <span class="font-bold text-xs text-yellow-600 dark:text-yellow-400 block mb-1">💡 암기팁</span>
            ${record.memoryTip}
          </div>
        ` : ''}

        ${showAiFeedback && record.feedback ? `
          <div class="mt-2 p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400">
            <span class="font-bold text-gray-500 dark:text-gray-400 block mb-1">🤖 AI 총평</span>
            ${record.feedback}
          </div>
        ` : ''}
      </div>
    `;
  });

  resultContainer.innerHTML = html;
  showToast(`${filtered.length}개 문제로 요약서가 생성되었습니다.`);
}
