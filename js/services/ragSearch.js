// ============================================
// RAG (Retrieval Augmented Generation) 검색 시스템
// KAM 평가를 위한 회계감사기준서 검색 기능
// ============================================

/**
 * RAG 검색 시스템
 * - questions.json에서 관련 기준서 검색
 * - 키워드 기반 검색 알고리즘
 * - TF-IDF 유사도 기반 순위 결정
 */

export class RAGSearchService {
  constructor() {
    this.questionsData = null;
    this.initialized = false;

    // 유의어/관련어 매핑 (Accounting Ontology)
    // 회계 용어의 특성상 유사한 의미를 가진 단어들을 연결하여 검색 정확도 향상
    this.synonymMap = {
      '매출': ['수익', '수익인식', '기간귀속', '인도기준', '진행기준', '수익기준', '매출액'],
      '재고': ['재고자산', '저가법', '순실현가능가치', '평가충당금', '재고평가', '재고실사'],
      '손상': ['손상차손', '회수가능액', '사용가치', '현금창출단위', 'CGU', '손상평가', '손상징후'],
      '금융상품': ['상각후원가', 'FVPL', 'FVOCI', '공정가치', '금융자산', '금융부채', '파생상품'],
      '충당부채': ['우발부채', '복구충당부채', '제품보증', '충당금', '우발손실'],
      '영업권': ['무형자산', '식별가능', '내용연수', '상각', '손상검사'],
      '유형자산': ['감가상각', '잔존가치', '내용연수', '자본적지출', '수익적지출', '취득원가'],
      '리스': ['사용권자산', '리스부채', '운용리스', '금융리스', '리스료'],
      '퇴직급여': ['확정급여제도', '확정기여제도', '보험수리적가정', '제도자산', '퇴직연금'],
      '법인세': ['이연법인세', '일시적차이', '이월결손금', '세무조정', '유효세율'],
      '연결': ['연결재무제표', '종속기업', '지배력', '내부거래', '비지배지분', '관계기업', '공동기업'],
      '현금흐름': ['영업활동', '투자활동', '재무활동', '현금등가물', '현금흐름표'],
      '특수관계자': ['특수관계자거래', '특수관계자공시', '지배종속관계', '일감몰아주기'],
      '공시': ['주석', '재무제표공시', '중요한회계정책', '우발상황', '약정사항'],
      '내부통제': ['통제환경', '위험평가', '통제활동', 'IT통제', '모니터링'],
      '감사': ['감사절차', '감사증거', '표본추출', '실증절차', '분석적절차', '입증절차'],
      '위험': ['고유위험', '통제위험', '적발위험', '중요왜곡표시위험', '부정위험'],
      '추정': ['회계추정', '불확실성', '민감도분석', '가정', '판단', '측정불확실성'],
      '전문가': ['외부전문가', '내부전문가', '적격성', '객관성', '역량'],
      '진행률': ['진행기준', '총계약원가', '계약수익', '공사진행률', '원가회수기준']
    };
  }

  /**
   * questions.json 데이터 로드
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const response = await fetch('/questions.json');
      if (!response.ok) {
        throw new Error('Failed to load questions.json');
      }
      this.questionsData = await response.json();
      this.initialized = true;
      console.log('✅ RAG Search System initialized with', this.questionsData.length, 'questions');
    } catch (error) {
      console.error('❌ Failed to initialize RAG Search System:', error);
      throw error;
    }
  }

  /**
   * 키워드 확장 (Query Expansion)
   * 원본 키워드 + 유의어를 포함하여 검색 범위 확대
   * @param {string[]} keywords - 원본 키워드 배열
   * @returns {string[]} 확장된 키워드 배열
   */
  expandKeywords(keywords) {
    const expandedKeywords = new Set(keywords);

    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();

      // 유의어 맵에서 해당 키워드가 포함된 그룹 찾기
      Object.entries(this.synonymMap).forEach(([key, synonyms]) => {
        const lowerKey = key.toLowerCase();
        const lowerSynonyms = synonyms.map(s => s.toLowerCase());

        // 현재 키워드가 메인 키워드이거나 유의어 목록에 포함되면
        if (lowerKeyword === lowerKey || lowerSynonyms.includes(lowerKeyword)) {
          // 메인 키워드 추가
          expandedKeywords.add(key);
          // 모든 유의어 추가
          synonyms.forEach(s => expandedKeywords.add(s));
        }
      });
    });

    const result = Array.from(expandedKeywords);
    console.log('[RAG Search] 키워드 확장:', {
      original: keywords,
      expanded: result,
      expandedCount: result.length - keywords.length
    });

    return result;
  }

  /**
   * 키워드 기반 기준서 검색 (Query Expansion 적용)
   * @param {string[]} keywords - 검색할 키워드 배열
   * @param {number} limit - 반환할 최대 결과 수
   * @returns {Array} 관련 기준서 배열
   */
  searchByKeywords(keywords, limit = 5) {
    if (!this.initialized || !this.questionsData) {
      console.warn('RAG Search System not initialized');
      return [];
    }

    if (!keywords || keywords.length === 0) {
      return [];
    }

    // 키워드 확장 (Query Expansion)
    const expandedKeywords = this.expandKeywords(keywords);

    // 각 질문에 대해 유사도 점수 계산 (확장된 키워드 사용)
    const scoredQuestions = this.questionsData.map(question => {
      const score = this.calculateRelevanceScore(question, expandedKeywords);
      return {
        ...question,
        relevanceScore: score
      };
    });

    // 점수 기준으로 정렬하고 상위 결과만 반환
    return scoredQuestions
      .filter(q => q.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * 텍스트 기반 기준서 검색
   * @param {string} text - 사용자 답안 텍스트
   * @param {number} limit - 반환할 최대 결과 수
   * @returns {Array} 관련 기준서 배열
   */
  searchByText(text, limit = 5) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // 텍스트에서 키워드 추출
    const keywords = this.extractKeywords(text);
    return this.searchByKeywords(keywords, limit);
  }

  /**
   * KAM 상황(situation)에서 관련 기준서 검색
   * @param {string} situation - KAM 상황 지문
   * @param {string[]} additionalKeywords - 추가 키워드
   * @param {number} limit - 반환할 최대 결과 수
   * @returns {Array} 관련 기준서 배열
   */
  searchBySituation(situation, additionalKeywords = [], limit = 5) {
    const situationKeywords = this.extractKeywords(situation);
    const allKeywords = [...situationKeywords, ...additionalKeywords];
    return this.searchByKeywords(allKeywords, limit);
  }

  /**
   * 관련성 점수 계산
   * @param {Object} question - 기준서 질문 객체
   * @param {string[]} keywords - 검색 키워드
   * @returns {number} 관련성 점수
   */
  calculateRelevanceScore(question, keywords) {
    let score = 0;
    const searchableText = `${question.problemTitle || ''} ${question.물음 || ''} ${question.정답 || ''}`.toLowerCase();

    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();

      // 제목에 키워드가 있으면 가중치 3
      if (question.problemTitle && question.problemTitle.toLowerCase().includes(lowerKeyword)) {
        score += 3;
      }

      // 문제에 키워드가 있으면 가중치 2
      if (question.물음 && question.물음.toLowerCase().includes(lowerKeyword)) {
        score += 2;
      }

      // 정답에 키워드가 있으면 가중치 1
      if (question.정답 && question.정답.toLowerCase().includes(lowerKeyword)) {
        score += 1;
      }
    });

    return score;
  }

  /**
   * 텍스트에서 중요 키워드 추출
   * @param {string} text - 원본 텍스트
   * @returns {string[]} 추출된 키워드 배열
   */
  extractKeywords(text) {
    if (!text) return [];

    // 불용어 목록 (한국어)
    const stopWords = new Set([
      '은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '으로', '로',
      '에서', '께서', '에게', '한', '하는', '되는', '하고', '있는', '있다', '한다',
      '등', '및', '또는', '그리고', '하여', '통해', '위해', '대한', '관한', '따라',
      '때문에', '경우', '것', '수', '등의', '있습니다', '입니다', '합니다'
    ]);

    // 회계 전문 용어 가중치
    const importantTerms = new Set([
      '수익인식', '기간귀속', '손상평가', '공정가치', '내부통제', '재고자산',
      '감사절차', '왜곡표시', '중요성', '위험', '전문가', '추정', '판단',
      '영업권', '무형자산', '유형자산', '자산손상', '회수가능액', '사용가치',
      '할인율', '현금흐름', '미래예측', '민감도분석', '재계산', '검증',
      '총계약원가', '진행률', '계약수익', '발생', '실재성', '평가', '측정',
      '재무제표', '연결', '독립성', '객관성', '합리성', '불확실성', '복잡성'
    ]);

    // 텍스트를 단어로 분리
    const words = text.split(/\s+/);
    const keywords = new Set();

    words.forEach(word => {
      // 특수문자 제거
      const cleanWord = word.replace(/[^\w가-힣]/g, '');

      // 2글자 이상이고 불용어가 아닌 경우
      if (cleanWord.length >= 2 && !stopWords.has(cleanWord)) {
        keywords.add(cleanWord);
      }
    });

    // 복합 키워드 추출 (예: "수익 인식" -> "수익인식")
    importantTerms.forEach(term => {
      if (text.includes(term)) {
        keywords.add(term);
      }
    });

    return Array.from(keywords);
  }

  /**
   * 특정 단원의 기준서 가져오기
   * @param {number} chapter - 단원 번호
   * @returns {Array} 해당 단원의 기준서 배열
   */
  getByChapter(chapter) {
    if (!this.initialized || !this.questionsData) {
      return [];
    }

    return this.questionsData.filter(q => q.단원 === chapter);
  }

  /**
   * 기준서 ID로 검색
   * @param {string} id - 기준서 고유ID
   * @returns {Object|null} 기준서 객체
   */
  getById(id) {
    if (!this.initialized || !this.questionsData) {
      return null;
    }

    return this.questionsData.find(q => q.고유ID === id);
  }

  /**
   * 전체 기준서 데이터 반환
   * @returns {Array} 전체 기준서 배열
   */
  getAllQuestions() {
    return this.questionsData || [];
  }
}

// 싱글톤 인스턴스 생성 및 export
const ragSearchService = new RAGSearchService();
export default ragSearchService;
