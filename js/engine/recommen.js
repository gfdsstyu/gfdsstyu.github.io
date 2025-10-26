export function recommend(scores, N = 10, strategy = 'forgetting') {
  const items = Object.entries(scores || {}).map(([id, s]) => {
    const last = s.lastSolvedDate || 0;
    const lastScore = Number(s.score || 0);
    const days = (Date.now() - last) / 86400000;
    const fi = Math.max(0, days) * (100 - Math.min(100, lastScore)) / 100; // 망각 지수(간이)
    return { id, fi, last, lastScore, wrong: lastScore < 60 };
  });

  if (strategy === 'low-score') items.sort((a, b) => a.lastScore - b.lastScore);
  else if (strategy === 'recent-wrong') {
    items.sort((a, b) => {
      const aw = a.wrong ? 0 : 1, bw = b.wrong ? 0 : 1; // 틀린 문제 우선
      if (aw !== bw) return aw - bw;
      return b.last - a.last; // 더 최근 것이 먼저
    });
  } else items.sort((a, b) => b.fi - a.fi); // 망각지수 기본

  return items.slice(0, Math.max(1, Number(N) || 10));
}
