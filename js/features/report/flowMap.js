// ============================================
// 감린이 v5.0 - Audit Flow Map
// "숲을 보는 감사, 흐름을 타는 암기"
// ============================================

import { AUDIT_FLOW_MAP, getFlowByChapter, getConnectedChapters } from '../../config/config.js';
import { getQuestionScores } from '../../core/stateManager.js';
import { showToast } from '../../ui/domUtils.js';

/**
 * Flow별 평균 점수 계산
 * @returns {Map<number, {avgScore: number, status: string, totalAttempts: number}>}
 */
export function calculateFlowScores() {
  const questionScores = getQuestionScores();
  const flowScores = new Map();

  // 각 FLOW별 점수 집계
  for (const [flowId, flowData] of Object.entries(AUDIT_FLOW_MAP)) {
    const chapters = flowData.chapters;
    let totalScore = 0;
    let totalAttempts = 0;

    // 해당 FLOW의 모든 단원에 대한 문제들의 점수 수집
    for (const [qid, record] of Object.entries(questionScores)) {
      const problem = window.allData?.find(q => String(q.고유ID).toLowerCase() === String(qid).toLowerCase());
      if (!problem) continue;

      const chapterNum = problem.단원;
      if (!chapters.includes(chapterNum)) continue;

      // 최근 점수만 반영 (solveHistory의 마지막 항목)
      const history = record.solveHistory || [];
      if (history.length > 0) {
        const lastAttempt = history[history.length - 1];
        const score = Number(lastAttempt.score) || 0;
        totalScore += score;
        totalAttempts++;
      }
    }

    // 평균 점수 계산
    const avgScore = totalAttempts > 0 ? totalScore / totalAttempts : 0;

    // 상태 결정 (🟢 안전 / 🟡 주의 / 🔴 위험)
    let status = 'unknown';
    if (avgScore >= 80) {
      status = 'safe'; // 🟢 녹색
    } else if (avgScore >= 60) {
      status = 'warning'; // 🟡 노란색
    } else if (totalAttempts > 0) {
      status = 'danger'; // 🔴 빨간색
    }

    flowScores.set(Number(flowId), {
      avgScore: Math.round(avgScore * 10) / 10,
      status,
      totalAttempts
    });
  }

  return flowScores;
}

/**
 * FlowMap UI 업데이트 (상태 인디케이터 색상 변경)
 */
export function updateFlowMapUI() {
  const flowScores = calculateFlowScores();

  for (const [flowId, data] of flowScores.entries()) {
    const flowStep = document.querySelector(`.flow-step[data-flow-id="${flowId}"]`);
    if (!flowStep) continue;

    const indicator = flowStep.querySelector('.flow-status-indicator');
    if (!indicator) continue;

    // 상태별 색상 적용
    indicator.className = 'flow-status-indicator w-6 h-6 rounded-full transition-colors';

    if (data.status === 'safe') {
      indicator.classList.add('bg-green-500');
      indicator.title = `안전 (평균 ${data.avgScore}점)`;
    } else if (data.status === 'warning') {
      indicator.classList.add('bg-yellow-500');
      indicator.title = `주의 (평균 ${data.avgScore}점)`;
    } else if (data.status === 'danger') {
      indicator.classList.add('bg-red-500');
      indicator.title = `위험 (평균 ${data.avgScore}점)`;
    } else {
      indicator.classList.add('bg-gray-300');
      indicator.title = '데이터 없음';
    }
  }
}

/**
 * Flow 클릭 시 해당 단원 문제로 필터링
 * @param {number} flowId - FLOW ID (1~6)
 */
export function handleFlowClick(flowId) {
  const flowData = AUDIT_FLOW_MAP[flowId];
  if (!flowData) return;

  const chapters = flowData.chapters;
  const chapterList = chapters.join(', ');

  showToast(`${flowData.icon} ${flowData.name} (Ch ${chapterList})로 필터링됩니다.`, 'info');

  // 탐색기 탭으로 이동하고 해당 단원 필터 적용
  const explorerTab = document.querySelector('[data-target="explorer"]');
  if (explorerTab) {
    explorerTab.click();

    // 필터 적용 (약간의 지연 후)
    setTimeout(() => {
      const chapterFilter = document.querySelector('#chapter-filter');
      if (chapterFilter && chapters.length === 1) {
        // 단일 단원이면 직접 선택
        chapterFilter.value = chapters[0];
        chapterFilter.dispatchEvent(new Event('change'));
      } else {
        // 여러 단원이면 첫 번째 단원 선택 (개선 가능)
        chapterFilter.value = chapters[0];
        chapterFilter.dispatchEvent(new Event('change'));
        showToast(`${chapters.length}개 단원 중 Ch ${chapters[0]}이 선택되었습니다. 필터를 조정하세요.`, 'info');
      }
    }, 300);
  }
}

/**
 * Flow 가이드 모달 표시
 */
export function showFlowGuide() {
  const guideHTML = `
    <div class="space-y-4">
      <h3 class="text-xl font-bold text-gray-900 dark:text-white">🌲 Audit Flow 학습 가이드</h3>

      <div class="space-y-3">
        ${Object.values(AUDIT_FLOW_MAP).map(flow => `
          <div class="border-l-4 pl-4" style="border-color: ${flow.color}">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-2xl">${flow.icon}</span>
              <h4 class="font-bold">${flow.name} (FLOW ${flow.id})</h4>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">${flow.meaning}</p>
            <p class="text-xs text-gray-500">
              <span class="font-semibold">전략:</span> ${flow.strategyDetail}
            </p>
            <p class="text-xs text-gray-500 mt-1">
              <span class="font-semibold">포함 단원:</span> Ch ${flow.chapters.join(', ')}
            </p>
          </div>
        `).join('')}
      </div>

      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
        <h4 class="font-semibold mb-2 text-blue-900 dark:text-blue-300">💡 효과적인 학습 방법</h4>
        <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>• <strong>FLOW 3 (위험 평가)</strong>가 흔들리면 FLOW 4 전체가 무너집니다. 우선 복습하세요!</li>
          <li>• <strong>FLOW 4 (감사 수행)</strong>는 암기량이 많습니다. '왜'를 이해하면 더 오래 기억됩니다.</li>
          <li>• <strong>빨간색 상태</strong>의 FLOW는 병목 지점입니다. 먼저 해결하세요.</li>
          <li>• 각 Flow를 클릭하면 해당 단원 문제로 바로 이동합니다.</li>
        </ul>
      </div>
    </div>
  `;

  // 간단한 알림으로 표시 (또는 모달 라이브러리 사용)
  const guideContainer = document.createElement('div');
  guideContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1003] p-4';
  guideContainer.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
      ${guideHTML}
      <button class="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        닫기
      </button>
    </div>
  `;

  guideContainer.querySelector('button').addEventListener('click', () => {
    guideContainer.remove();
  });

  guideContainer.addEventListener('click', (e) => {
    if (e.target === guideContainer) {
      guideContainer.remove();
    }
  });

  document.body.appendChild(guideContainer);
}

/**
 * FlowMap 초기화 (이벤트 리스너 등록)
 */
export function initFlowMap() {
  // Flow 클릭 이벤트
  document.querySelectorAll('.flow-step').forEach(step => {
    step.addEventListener('click', () => {
      const flowId = Number(step.dataset.flowId);
      handleFlowClick(flowId);
    });
  });

  // Flow 가이드 버튼
  const guideBtn = document.querySelector('#flowmap-help-btn');
  if (guideBtn) {
    guideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showFlowGuide();
    });
  }

  // 초기 UI 업데이트
  updateFlowMapUI();

  console.log('✅ [FlowMap] Audit Flow Map 초기화 완료');
}
