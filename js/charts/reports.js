// /js/charts/reports.js
export function renderDailyChart(canvas, daily){
  if (!canvas || !window.Chart) return;
  const labels = Object.keys(daily).sort();
  const data = labels.map(d=> daily[d].solvedCount);
  new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label:'일별 푼 문제 수', data }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ x:{ ticks:{ maxRotation:0 } } } }
  });
}

export function renderChapterAvgChart(canvas, questions, scores){
  if (!canvas || !window.Chart) return;
  const byCh = new Map();
  questions.forEach(q=>{
    const ch = String(q.단원).trim();
    if (!byCh.has(ch)) byCh.set(ch, []);
    const s = scores?.[String(q.고유ID).trim()]?.score;
    if (Number.isFinite(Number(s))) byCh.get(ch).push(Number(s));
  });
  const labels = [...byCh.keys()].sort((a,b)=>Number(a)-Number(b));
  const data = labels.map(ch=>{
    const arr = byCh.get(ch);
    if (!arr.length) return 0;
    return arr.reduce((a,b)=>a+b,0)/arr.length;
  });
  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label:'단원별 평균 점수', data }] },
    options: { responsive:true, maintainAspectRatio:false }
  });
}