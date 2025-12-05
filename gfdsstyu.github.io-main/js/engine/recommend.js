// [교체] js/engine/recommend.js

/**
 * 항목의 학습 기록을 바탕으로 현재 추정 반감기(h, 단위: 일)를 계산합니다.
 * HLR 모델의 h 예측(Theta*x)을 휴리스틱으로 근사합니다.
 * @param {Array<Object>} history - { date: number, score: number } 객체의 배열
 * @returns {number} - 추정된 반감기 (일)
 */
function estimateHalfLife(history = []) {
  if (!history || history.length === 0) {
    return 1.0; // 학습 기록이 없으면 기본 반감기 1일
  }

  let h = 1.0; // 초기 반감기
  
  // solveHistory가 날짜순 정렬이 아닐 수 있으므로 정렬
  const sortedHistory = [...history].sort((a, b) => (a.date || 0) - (b.date || 0));
  
  sortedHistory.forEach((event, index) => {
    const score = event.score || 0;
    
    // 이전 학습과의 간격 (Delta) 계산
    const lastDate = (index > 0) ? (sortedHistory[index - 1].date || 0) : (event.date || 0) - (1000 * 60 * 60 * 24); // 첫 이벤트는 1일 전으로 간주
    const delta = Math.max(0.5, ((event.date || 0) - lastDate) / (1000 * 60 * 60 * 24)); // 최소 0.5일 간격

    let factor;
    if (score >= 90) { // 쉬움 (90점 이상)
      factor = 2.0 + (score - 90) / 10.0; // 2.0 ~ 3.0
    } else if (score >= 70) { // 적절함 (70~89점)
      factor = 1.4 + (score - 70) / 20.0 * 0.5; // 1.4 ~ 1.9
    } else if (score >= 50) { // 어려움 (50~69점)
      factor = 1.1; // 1.1 (거의 유지)
    } else { // 틀림 (50점 미만)
      factor = 0.6; // 반감기 감소
    }

    // 새 반감기 = (이전 반감기 + 경과일) * (성적에 따른 계수)
    // FSRS/SM-2의 'Stability' 계산을 단순화한 버전
    h = (h + delta) * factor; 
    h = Math.max(1.0, h); // 최소 1일
  });

  return h;
}

/**
 * @param {Object} scores - 스토어의 scores 객체
 * @param {number} N - 추천 개수
 * @param {string} strategy - 추천 전략
 * @returns {Array<Object>} - 추천 항목 배열
 */
export function recommend(scores, N = 10, strategy = 'forgetting') {
  const items = Object.entries(scores || {}).map(([id, s]) => {
    const last = s.lastSolvedDate || 0;
    const lastScore = Number(s.score || 0);
    const deltaDays = (Date.now() - last) / 86400000; // 마지막 학습 후 경과 시간 (Δ)
    
    // 1. HLR-Lite: 항목별 반감기(h) 추정
    // v3.3의 'solveHistory' (line 894 in index.html)가 s 객체에 포함되어 있다고 가정
    const h = estimateHalfLife(s.solveHistory); 
    
    // 2. HLR: 회상 확률(p_recall) 예측 (이 값이 낮을수록 잊었을 확률이 높음)
    const p_recall = 2 ** (-deltaDays / h); 

    return { 
      id, 
      p_recall, // 회상 확률 (0~1, 낮을수록 시급)
      fi: (1 - p_recall) * 100, // 망각 지수 (fi)를 p_recall의 역으로 재정의 (디버깅/표시용)
      h, // 디버깅용 반감기
      last, 
      lastScore, 
      wrong: lastScore < 60 
    };
  });

  if (strategy === 'low-score') {
    items.sort((a, b) => a.lastScore - b.lastScore);
  } else if (strategy === 'recent-wrong') {
    items.sort((a, b) => {
      const aw = a.wrong ? 0 : 1, bw = b.wrong ? 0 : 1; // 틀린 문제 우선
      if (aw !== bw) return aw - bw;
      return b.last - a.last; // 더 최근 것이 먼저
    });
  } else {
    // 'forgetting' (지능형) 전략: 회상 확률(p_recall)이 낮은 순서대로 (오름차순)
    // p_recall이 낮을수록 (잊었을 확률이 높음) 우선순위가 높다.
    items.sort((a, b) => a.p_recall - b.p_recall);
  }

  return items.slice(0, Math.max(1, Number(N) || 10));
}
