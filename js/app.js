import { createStore } from './state/store.js';
import { mountShell } from './ui/shell.js';
import { mountDashboard } from './ui/dashboard.js';
import { mountQuiz } from './ui/quiz.js';

const store = createStore();

// v3.2 기록 → 상태 로드
try {
  const raw = localStorage.getItem('auditQuizScores');
  store.set('scores', raw ? JSON.parse(raw) : {});
} catch (e) { console.warn('[v4] scores parse fail', e); }

// 미니 캘린더 데이터 파생
store.set('cache', { dailyActivity: deriveDailyActivity(store.get().scores) });

function deriveDailyActivity(scores) {
  const map = {};
  Object.values(scores || {}).forEach(s => {
    (s.solveHistory || []).forEach(h => {
      const d = new Date(h.date || 0); if (isNaN(d)) return;
      const key = d.toISOString().slice(0, 10);
      map[key] = map[key] || { solvedCount: 0 };
      map[key].solvedCount += 1;
    });
  });
  return map;
}

mountShell();
mountDashboard(store);
mountQuiz(store);
