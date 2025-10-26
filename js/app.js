// /js/app.js
// Bootstrap: load dataset -> init state -> mount UI -> wire review button
import { store, initStateFromStorage } from './state/store.js';
import { ensureDataset, getAllQuestions, buildDailyActivityCache } from './state/selectors.js';
import { mountDashboard } from './ui/dashboard.js';
import { mountQuiz } from './ui/quiz.js';
import { mountExplorer } from './ui/explorer.js';
import { recommendToday } from './engine/recommend.js';

(async function start() {
  await ensureDataset();             // questions.json or #dataset-json
  initStateFromStorage();            // auditQuizScores, userSettings

  // Left: Dashboard
  mountDashboard({
    calendarEl: document.getElementById('calendar'),
    dailyChartEl: document.getElementById('chart-daily'),
    chapterChartEl: document.getElementById('chart-chapter'),
    strategySelect: document.getElementById('engine-strategy'),
    countRange: document.getElementById('engine-N')
  });

  // Center: Quiz
  mountQuiz({
    metaEl: document.getElementById('question-meta'),
    titleEl: document.getElementById('q-title'),
    bodyEl: document.getElementById('q-body'),
    answerEl: document.getElementById('q-answer'),
    feedbackEl: document.getElementById('ai-feedback'),
    correctEl: document.getElementById('correct-answer'),
    scoreEl: document.getElementById('score'),
    progressEl: document.getElementById('progress-bar'),
    resultBoxEl: document.getElementById('result-box'),
    prevBtn: document.getElementById('btn-prev'),
    nextBtn: document.getElementById('btn-next'),
    gradeBtn: document.getElementById('btn-grade'),
    hintBtn: document.getElementById('hint-btn'),
    loadPrevAnswerBtn: document.getElementById('load-prev-answer-btn'),
    errorMsgEl: document.getElementById('error-message')
  });

  // Right: Explorer
  mountExplorer({ treeEl: document.getElementById('explorer-tree') });

  // Start today's review
  document.getElementById('btn-start-review')?.addEventListener('click', () => {
    const N = Number(document.getElementById('engine-N').value || 10);
    const mode = document.getElementById('engine-strategy').value || 'forgetting';
    const allQuestions = getAllQuestions(store.getState());
    const picks = recommendToday(allQuestions, N, mode);
    store.dispatch({ type: 'LOAD_RECOMMEND_SET', payload: picks });
    const label = document.getElementById('engine-mode-label');
    if (label) label.textContent = mode;
  });

  // First cache build
  const cache = buildDailyActivityCache(store.getState());
  store.dispatch({ type: 'SET_DAILY_CACHE', payload: cache });
})();