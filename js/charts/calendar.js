// /js/charts/calendar.js
export function renderCalendar(container, daily){
  if (!container) return;
  container.innerHTML = '';
  // 7x6 grid (recent 42 days)
  const days = 42;
  const today = new Date();
  for (let i=days-1;i>=0;i--){
    const d = new Date(today.getTime() - i*86400000);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const val = daily?.[iso]?.solvedCount || 0;
    const div = document.createElement('div');
    div.className = 'cell ' + intensity(val);
    div.title = `${iso} · ${val} solved`;
    container.appendChild(div);
  }
}
function intensity(n){
  if (n>=8) return 'int-8';
  if (n>=5) return 'int-5';
  if (n>=3) return 'int-3';
  if (n>=1) return 'int-1';
  return '';
}