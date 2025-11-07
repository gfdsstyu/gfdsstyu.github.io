/**
 * @fileoverview 딥러닝 리포트 핵심 기능
 * - 리포트 모달 관리
 * - 리포트 데이터 수집 및 처리
 * - 액션 플랜 렌더링
 */

import { el, $ } from '../../ui/elements.js';
import { questionScores, allData } from '../../core/stateManager.js';
import { normId, clamp, chapterLabelText } from '../../utils/helpers.js';
import { renderDailyVolumeChart, renderScoreTrendChart, renderChapterWeaknessChart } from './charts.js';

// Module state
let reportCharts = {};
let reportData = { period: 30, threshold: 60 };

/**
 * 리포트 모달 열기
 */
export function openReportModal() {
  // Close hamburger menu if open (mobile)
  if (window.closeDrawer) window.closeDrawer();

  el.reportModal?.classList.remove('hidden');
  el.reportModal?.classList.add('flex');
  // Delay chart generation to ensure modal is rendered
  setTimeout(() => generateReport(), 50);
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
 * @param {number} tabNum - 탭 번호 (1, 2, 3)
 */
export function switchReportTab(tabNum) {
  const tabs = document.querySelectorAll('.report-tab');
  const contents = document.querySelectorAll('.report-content');
  tabs.forEach((tab, i) => {
    const num = i + 1;
    if (num === tabNum) {
      tab.classList.add('border-blue-600', 'text-blue-600');
      tab.classList.remove('border-transparent', 'text-gray-500');
      tab.setAttribute('aria-selected', 'true');
    } else {
      tab.classList.remove('border-blue-600', 'text-blue-600');
      tab.classList.add('border-transparent', 'text-gray-500');
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
}

/**
 * 리포트 데이터 수집
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

  for (const [qid, rec] of Object.entries(questionScores || {})) {
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
      const problem = allData.find(q => normId(q.고유ID) === qid);
      if (problem) {
        const chapter = problem.단원 || '기타';
        if (!chapterData.has(chapter)) chapterData.set(chapter, { scores: [], dates: [] });
        chapterData.get(chapter).scores.push(score);
        chapterData.get(chapter).dates.push(date);

        // Weak problems
        if (score < threshold) {
          weakProblems.push({ qid, problem, score, date });
        }
      }
    }
  }

  return { dailyData, chapterData, weakProblems };
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
  renderScoreTrendChart(data.dailyData, reportCharts);
  renderChapterWeaknessChart(data.chapterData, reportCharts);
  renderActionPlan(data.weakProblems);
}

/**
 * 액션 플랜 렌더링 (복습 우선순위)
 * @param {Array} weakProblems - 약점 문제 목록
 */
export function renderActionPlan(weakProblems) {
  const now = Date.now();
  const urgent = [], weekly = [], longterm = [];

  for (const wp of weakProblems) {
    const daysSince = (now - wp.date) / (1000 * 60 * 60 * 24);
    if (daysSince <= 3) {
      urgent.push(wp);
    } else if (daysSince <= 10) {
      weekly.push(wp);
    } else {
      longterm.push(wp);
    }
  }

  const urgentList = $('action-urgent-list');
  const weeklyList = $('action-weekly-list');
  const longtermList = $('action-longterm-list');

  if (urgentList) {
    urgentList.innerHTML = urgent.length ? urgent.slice(0, 10).map(wp =>
      `<div class="text-sm">• ${wp.problem.problemTitle || wp.problem.물음?.slice(0, 30) + '...'} (${wp.score}점)</div>`
    ).join('') : '<div class="text-sm text-gray-500">없음</div>';
  }

  if (weeklyList) {
    weeklyList.innerHTML = weekly.length ? weekly.slice(0, 10).map(wp =>
      `<div class="text-sm">• ${wp.problem.problemTitle || wp.problem.물음?.slice(0, 30) + '...'} (${wp.score}점)</div>`
    ).join('') : '<div class="text-sm text-gray-500">없음</div>';
  }

  if (longtermList) {
    longtermList.innerHTML = longterm.length ? longterm.slice(0, 10).map(wp =>
      `<div class="text-sm">• ${wp.problem.problemTitle || wp.problem.물음?.slice(0, 30) + '...'} (${wp.score}점)</div>`
    ).join('') : '<div class="text-sm text-gray-500">없음</div>';
  }

  // Interactive wrong answers
  const wrongAnswers = $('action-wrong-answers');
  if (wrongAnswers) {
    const uniqueProblems = new Map();
    for (const wp of weakProblems) {
      if (!uniqueProblems.has(wp.qid) || uniqueProblems.get(wp.qid).score > wp.score) {
        uniqueProblems.set(wp.qid, wp);
      }
    }

    wrongAnswers.innerHTML = Array.from(uniqueProblems.values()).slice(0, 20).map(wp => {
      const rec = questionScores[wp.qid];
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

    if (window.showToast) {
      window.showToast('AI 분석 및 액션 플랜이 저장되었습니다');
    }
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
        if (window.showToast) window.showToast('올바른 학습 분석 파일이 아닙니다', 'error');
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
      if (window.showToast) window.showToast(`학습 분석 불러오기 완료 (저장 시각: ${snapshotDate})`);

      // Reset file input for next use
      e.target.value = '';

    } catch (err) {
      if (window.showToast) window.showToast('파일 읽기 실패: ' + err.message, 'error');
      e.target.value = '';
    }
  });

  // Print functionality - only print report modal content
  el.reportPrintBtn?.addEventListener('click', () => {
    const printContent = document.getElementById('report-modal');
    const originalDisplay = printContent.style.display;

    // Temporarily show modal for printing
    printContent.style.display = 'block';
    printContent.style.position = 'relative';
    printContent.style.background = 'white';

    window.print();

    // Restore original state
    printContent.style.display = originalDisplay;
    printContent.style.position = '';
    printContent.style.background = '';
  });
}
