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
import { LocalHLRPredictor, calculateRecallProbability } from '../review/hlrDataset.js';

// Module state
let reportCharts = {};
let reportData = { period: 30, threshold: 60 };

/**
 * 리포트 모달 열기
 */
export function openReportModal() {
  // Close hamburger menu if open (mobile)
  closeDrawer();

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

  // HLR 예측기 생성 (한 번만 생성하여 성능 최적화)
  const predictor = new LocalHLRPredictor();

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

  return { dailyData, chapterData, weakProblems, chartData };
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
      const predictor = new LocalHLRPredictor();
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
}

/**
 * PDF 옵션 모달 열기
 */
function openPdfOptionsModal() {
  const modal = document.getElementById('pdf-options-modal');
  if (!modal) return;

  // 모든 체크박스 초기화
  const checkAll = document.getElementById('pdf-check-all');
  const checkboxes = document.querySelectorAll('.pdf-tab-checkbox');

  if (checkAll) checkAll.checked = true;
  checkboxes.forEach(cb => cb.checked = true);

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
