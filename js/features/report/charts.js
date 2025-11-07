/**
 * @fileoverview 리포트 차트 렌더링 기능
 * - Chart.js를 사용한 차트 렌더링
 * - 이동평균선, 골든크로스/데드크로스 분석
 */

import { $ } from '../../ui/elements.js';
import { chapterLabelText } from '../../utils/helpers.js';
import { questionScores } from '../../core/stateManager.js';

/**
 * 누락된 날짜를 0으로 채우기 (연속된 날짜 생성)
 * @param {Map} dailyData - 날짜별 데이터 맵
 * @returns {Map} - 채워진 데이터 맵
 */
function fillMissingDates(dailyData) {
  if (dailyData.size === 0) return new Map();

  const sorted = Array.from(dailyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const startDate = new Date(sorted[0][0]);
  const endDate = new Date(sorted[sorted.length - 1][0]);

  const filled = new Map();
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    if (dailyData.has(dateStr)) {
      filled.set(dateStr, dailyData.get(dateStr));
    } else {
      filled.set(dateStr, { count: 0, scores: [] });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return filled;
}

/**
 * 이동평균 계산
 * @param {Array<number>} data - 데이터 배열
 * @param {number} period - 이동평균 기간 (일)
 * @returns {Array<number|null>} - 이동평균 배열
 */
function calculateMovingAverage(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null); // Not enough data for this period
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      result.push(Math.round(avg * 10) / 10);
    }
  }
  return result;
}

/**
 * 일일 학습량 차트 렌더링
 * @param {Map} dailyData - 날짜별 데이터
 * @param {Object} reportCharts - 차트 저장 객체
 */
export function renderDailyVolumeChart(dailyData, reportCharts) {
  const ctx = $('chart-daily-volume');
  if (!ctx || !window.Chart) return;

  const filledData = fillMissingDates(dailyData);
  const sorted = Array.from(filledData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const labels = sorted.map(([date]) => date.slice(5));
  const data = sorted.map(([, v]) => v.count);

  reportCharts.dailyVolume = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '문제 수',
        data,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

/**
 * 점수 추이 차트 렌더링 (이동평균선, 골든/데드크로스 포함)
 * @param {Map} dailyData - 날짜별 데이터
 * @param {Object} reportCharts - 차트 저장 객체
 */
export function renderScoreTrendChart(dailyData, reportCharts) {
  const ctx = $('chart-score-trend');
  if (!ctx || !window.Chart) return;

  // Only use days with actual data (no empty days)
  const sorted = Array.from(dailyData.entries())
    .filter(([, v]) => v.scores.length > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const labels = sorted.map(([date]) => date.slice(5));
  const avgScores = sorted.map(([, v]) => {
    const avg = v.scores.reduce((a, b) => a + b, 0) / v.scores.length;
    return Math.round(avg * 10) / 10;
  });

  // Calculate cumulative average (총누적평균선)
  const cumulativeAvg = [];
  let sum = 0;
  for (let i = 0; i < avgScores.length; i++) {
    sum += avgScores[i];
    cumulativeAvg.push(Math.round((sum / (i + 1)) * 10) / 10);
  }

  // Calculate moving averages
  const ma5 = calculateMovingAverage(avgScores, 5);
  const ma20 = calculateMovingAverage(avgScores, 20);
  const ma60 = calculateMovingAverage(avgScores, 60);

  // Detect Golden Cross and Dead Cross points
  const goldenCross = [], deadCross = [];
  for (let i = 1; i < ma5.length; i++) {
    if (ma5[i] !== null && ma20[i] !== null && ma5[i-1] !== null && ma20[i-1] !== null) {
      // Golden Cross: MA5 crosses above MA20
      if (ma5[i-1] <= ma20[i-1] && ma5[i] > ma20[i]) {
        goldenCross.push({ x: i, y: ma5[i] });
      }
      // Dead Cross: MA5 crosses below MA20
      if (ma5[i-1] >= ma20[i-1] && ma5[i] < ma20[i]) {
        deadCross.push({ x: i, y: ma5[i] });
      }
    }
  }

  // Check perfect order (정배열) at last point
  const lastIdx = ma5.length - 1;
  const isPerfectOrder = ma5[lastIdx] && ma20[lastIdx] && ma60[lastIdx] &&
                        ma5[lastIdx] > ma20[lastIdx] && ma20[lastIdx] > ma60[lastIdx];

  reportCharts.scoreTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '일일 평균',
          data: avgScores,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
          pointRadius: 2,
          borderWidth: 2
        },
        {
          label: 'MA5 (단기)',
          data: ma5,
          borderColor: 'rgba(34, 197, 94, 0.8)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'MA20 (중기★)',
          data: ma20,
          borderColor: 'rgba(234, 179, 8, 0.8)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'MA60 (장기)',
          data: ma60,
          borderColor: 'rgba(239, 68, 68, 0.8)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        {
          label: '총누적평균',
          data: cumulativeAvg,
          borderColor: 'rgba(107, 114, 128, 0.5)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        // Golden Cross markers
        {
          label: '골든 크로스',
          data: goldenCross,
          type: 'scatter',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: 'rgba(34, 197, 94, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          showLine: false
        },
        // Dead Cross markers
        {
          label: '데드 크로스',
          data: deadCross,
          type: 'scatter',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            // Disable click for golden/dead cross markers (indices 5 and 6)
            if (index === 5 || index === 6) return;
            // Default behavior for other datasets
            const chart = legend.chart;
            const meta = chart.getDatasetMeta(index);
            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
            chart.update();
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            footer: (items) => {
              const idx = items[0].dataIndex;
              if (isPerfectOrder && idx === lastIdx) {
                return '\n🚀 정배열 상태!';
              }
              return '';
            }
          }
        },
        title: {
          display: isPerfectOrder,
          text: '🚀 현재 정배열 상태! (5일 > 20일 > 60일)',
          color: 'rgba(34, 197, 94, 1)',
          font: { size: 14, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 10 }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1
          },
          pinch: {
            enabled: true
          },
          mode: 'x'
        },
        pan: {
          enabled: true,
          mode: 'x'
        },
        limits: {
          x: { min: 'original', max: 'original' }
        }
      }
    },
    onDoubleClick: (event, activeElements, chart) => {
      chart.resetZoom();
    }
  });
}

/**
 * 단원별 약점 차트 렌더링 (상위 10개 취약 단원)
 * @param {Map} chapterData - 단원별 데이터
 * @param {Object} reportCharts - 차트 저장 객체
 */
export function renderChapterWeaknessChart(chapterData, reportCharts) {
  const ctx = $('chart-chapter-weakness');
  if (!ctx || !window.Chart) return;

  const chapters = Array.from(chapterData.entries()).map(([chapter, data]) => {
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    return { chapter, avgScore };
  }).sort((a, b) => a.avgScore - b.avgScore).slice(0, 10);

  const labels = chapters.map(c => chapterLabelText(c.chapter));
  const data = chapters.map(c => Math.round(c.avgScore));

  reportCharts.chapterWeakness = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '평균 점수',
        data,
        backgroundColor: data.map(score =>
          score < 60 ? 'rgba(239, 68, 68, 0.5)' :
          score < 80 ? 'rgba(251, 146, 60, 0.5)' :
          'rgba(34, 197, 94, 0.5)'
        ),
        borderColor: data.map(score =>
          score < 60 ? 'rgba(239, 68, 68, 1)' :
          score < 80 ? 'rgba(251, 146, 60, 1)' :
          'rgba(34, 197, 94, 1)'
        ),
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: 100 }
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const chapter = chapters[index].chapter;
          showChapterDetail(chapter, chapterData.get(chapter), reportCharts);
        }
      }
    }
  });
  ctx.style.height = `${Math.max(300, chapters.length * 40)}px`;
}

/**
 * 단원별 상세 차트 표시
 * @param {string} chapter - 단원명
 * @param {Object} data - {scores: [], dates: []}
 * @param {Object} reportCharts - 차트 저장 객체
 */
export function showChapterDetail(chapter, data, reportCharts) {
  const container = $('chapter-detail-chart');
  if (!container) return;
  container.classList.remove('hidden');

  const ctx = $('chart-chapter-detail');
  if (!ctx || !window.Chart) return;

  // Group by date and calculate daily average
  const dailyMap = new Map();
  data.dates.forEach((timestamp, i) => {
    const dateStr = new Date(timestamp).toISOString().slice(0, 10);
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, []);
    }
    dailyMap.get(dateStr).push(data.scores[i]);
  });

  // Calculate daily averages
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, scores]) => ({
      date,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const labels = dailyData.map(d => d.date.slice(5));
  const avgScores = dailyData.map(d => Math.round(d.avg * 10) / 10);

  // Calculate cumulative average
  const cumulativeAvg = [];
  let sum = 0;
  for (let i = 0; i < avgScores.length; i++) {
    sum += avgScores[i];
    cumulativeAvg.push(Math.round((sum / (i + 1)) * 10) / 10);
  }

  // Calculate moving averages
  const ma5 = calculateMovingAverage(avgScores, 5);
  const ma20 = calculateMovingAverage(avgScores, 20);
  const ma60 = calculateMovingAverage(avgScores, 60);

  // Detect Golden Cross and Dead Cross
  const goldenCross = [], deadCross = [];
  for (let i = 1; i < ma5.length; i++) {
    if (ma5[i] !== null && ma20[i] !== null && ma5[i-1] !== null && ma20[i-1] !== null) {
      if (ma5[i-1] <= ma20[i-1] && ma5[i] > ma20[i]) {
        goldenCross.push({ x: i, y: ma5[i] });
      }
      if (ma5[i-1] >= ma20[i-1] && ma5[i] < ma20[i]) {
        deadCross.push({ x: i, y: ma5[i] });
      }
    }
  }

  // Check perfect order
  const lastIdx = ma5.length - 1;
  const isPerfectOrder = ma5[lastIdx] && ma20[lastIdx] && ma60[lastIdx] &&
                        ma5[lastIdx] > ma20[lastIdx] && ma20[lastIdx] > ma60[lastIdx];

  if (reportCharts.chapterDetail) reportCharts.chapterDetail.destroy();

  reportCharts.chapterDetail = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '일평균',
          data: avgScores,
          borderColor: 'rgba(147, 51, 234, 1)',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          tension: 0.1,
          pointRadius: 2,
          borderWidth: 2
        },
        {
          label: 'MA5 (단기)',
          data: ma5,
          borderColor: 'rgba(34, 197, 94, 0.8)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'MA20 (중기★)',
          data: ma20,
          borderColor: 'rgba(234, 179, 8, 0.8)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'MA60 (장기)',
          data: ma60,
          borderColor: 'rgba(239, 68, 68, 0.8)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        {
          label: '총누적평균',
          data: cumulativeAvg,
          borderColor: 'rgba(107, 114, 128, 0.5)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0,
          fill: false
        },
        {
          label: '골든 크로스',
          data: goldenCross,
          type: 'scatter',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: 'rgba(34, 197, 94, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          showLine: false
        },
        {
          label: '데드 크로스',
          data: deadCross,
          type: 'scatter',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            // Disable click for golden/dead cross markers (indices 5 and 6)
            if (index === 5 || index === 6) return;
            // Default behavior for other datasets
            const chart = legend.chart;
            const meta = chart.getDatasetMeta(index);
            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
            chart.update();
          }
        },
        title: {
          display: true,
          text: chapterLabelText(chapter) + ' - 점수 추이 (일평균)' + (isPerfectOrder ? ' 🚀 정배열!' : '')
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            footer: (items) => {
              const idx = items[0].dataIndex;
              if (isPerfectOrder && idx === lastIdx) {
                return '\n🚀 정배열 상태!';
              }
              return '';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 10 }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1
          },
          pinch: {
            enabled: true
          },
          mode: 'x'
        },
        pan: {
          enabled: true,
          mode: 'x'
        },
        limits: {
          x: { min: 'original', max: 'original' }
        }
      }
    },
    onDoubleClick: (event, activeElements, chart) => {
      chart.resetZoom();
    }
  });
}
