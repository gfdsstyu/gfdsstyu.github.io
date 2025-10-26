// js/app.js
import { initStore } from './state/store.js';
import { renderShell } from './ui/shell.js';
import { mountDashboard } from './ui/dashboard.js';
import { mountQuiz } from './ui/quiz.js';
import { mountExplorer } from './ui/explorer.js';

// Boot
window.addEventListener('DOMContentLoaded', () => {
  const store = initStore();
  renderShell();
  mountDashboard(store);
  mountQuiz(store);
  mountExplorer(store);
  console.log('[v4] shell mounted');
});
