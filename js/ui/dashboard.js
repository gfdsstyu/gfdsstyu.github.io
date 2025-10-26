// /js/ui/dashboard.js
import { store, dispatch } from '../state/store.js';
import { buildDailyActivityCache } from '../state/selectors.js';
import { renderCalendar } from '../charts/calendar.js';
import { renderDailyChart, renderChapterAvgChart } from '../charts/reports.js';

export function mountDashboard({ calendarEl, dailyChartEl, chapterChartEl, strategySelect, countRange }){
  const rerender = () => {
    const st = store.getState();
    renderCalendar(calendarEl, st.dailyActivityCache);
    renderDailyChart(dailyChartEl, st.dailyActivityCache);
    renderChapterAvgChart(chapterChartEl, st.questions, st.auditQuizScores);
  };
  store.subscribe(rerender);
  rerender();

  strategySelect?.addEventListener('change', (e)=>{
    dispatch({ type:'SET_SETTINGS', payload:{ engineMode: e.target.value } });
  });
  countRange?.addEventListener('change', ()=>{/* app.js가 읽음 */});

  // scores 변경 시 cache 재계산
  store.subscribe(()=>{
    const cache = buildDailyActivityCache(store.getState());
    dispatch({ type:'SET_DAILY_CACHE', payload: cache });
  });
}