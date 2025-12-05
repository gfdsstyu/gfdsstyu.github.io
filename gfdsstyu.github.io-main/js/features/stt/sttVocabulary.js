import { getAllData } from '../../core/stateManager.js';

let cachedKeywords = null;

// STT가 자주 틀리는 기본 단어 및 약어
const BASE_KEYWORDS = [
  'ISA', 'KSA', 'RMM', 'CPA', '외감법', '감사위원회', '내부회계관리제도',
  '중요왜곡표시위험', '고유위험', '통제위험', '적발위험', '전문가적 의구심',
  '경영진주장', '재무제표', '감사보고서', '계속기업', '후속사건', '특수관계자'
];

/**
 * 정답 텍스트에서 키워드를 추출하는 정규식
 */
function extractFromText(text, keywordSet) {
  // 예: "ISA 200-A47", "중요왜곡표시위험" 같은 패턴 추출
  const patterns = [
    /\b(ISA|KSA)\s?[\d-]+[A-Z]?\b/g, // ISA 200-A47
    /\b(RMM|CPA)\b/g,
    /(중요왜곡표시위험|전문가적 의구심|고유위험|통제위험|적발위험|내부회계관리제도|감사위원회|경영진주장)/g,
    /([가-힣]{2,}(위험|절차|감사|통제|주장|평가|기준))\b/g // "OO위험", "XX절차" 등
  ];

  patterns.forEach(regex => {
    const matches = text.match(regex);
    if (matches) {
      matches.forEach(match => keywordSet.add(match));
    }
  });
}

/**
 * 전역 allData에서 STT Keyword Boosting 목록을 생성하고 캐시합니다.
 * @returns {Array<string>} 고유 키워드 목록
 */
export function getBoostKeywords() {
  if (cachedKeywords) {
    return cachedKeywords;
  }

  console.log('Generating STT boost keywords...');
  const allData = getAllData();
  const keywordSet = new Set(BASE_KEYWORDS);

  if (!allData || allData.length === 0) {
    console.warn('STT: allData is not ready. Using base keywords only.');
    cachedKeywords = Array.from(keywordSet);
    return cachedKeywords;
  }

  try {
    for (const item of allData) {
      if (item.정답) {
        extractFromText(item.정답, keywordSet);
      }
      if (item.물음) {
        extractFromText(item.물음, keywordSet);
      }
    }

    // 너무 긴 단어(오류)나 너무 짧은 단어(무의미) 제거
    cachedKeywords = Array.from(keywordSet).filter(k => k.length > 2 && k.length < 50);

    console.log(`STT: Generated ${cachedKeywords.length} unique keywords.`);
    return cachedKeywords;
  } catch (error) {
    console.error('STT: Failed to generate keywords:', error);
    // 실패 시 기본 키워드만 반환
    cachedKeywords = Array.from(keywordSet);
    return cachedKeywords;
  }
}
