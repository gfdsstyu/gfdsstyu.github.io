/**
 * RAG (Retrieval-Augmented Generation) 서비스
 *
 * 클라이언트 사이드에서 벡터 검색을 수행하고
 * LLM에 전달할 컨텍스트를 구성합니다.
 *
 * 특징:
 * - BYOK (Bring Your Own Key): 사용자의 API Key 사용
 * - Serverless: 모든 처리가 브라우저에서 수행
 * - Lazy Loading: 첫 질문 시 벡터 데이터 로드
 */

class RAGService {
  constructor() {
    this.vectors = null;
    this.metadata = null;
    this.isInitialized = false;
    // 양자화된 버전 우선 사용 (36% 작은 파일, 99.98% 정확도)
    // 절대 경로 사용 (Vercel 호환)
    this.vectorDataPath = '/public/data/vectors_quantized.json';

    // 성능 최적화: 쿼리 결과 캐싱 (LRU)
    this.queryCache = new Map();
    this.cacheMaxSize = 50;

    // 성능 최적화: 타입별 인덱스
    this.indexByType = null;

    // ✨ 백그라운드 로딩: 생성자에서 바로 다운로드 시작 (await 없이)
    // 앱이 시작되자마자 백그라운드에서 다운로드를 시작합니다
    console.log('🚀 RAG 벡터 백그라운드 다운로드 시작...');
    this.loadingPromise = this._initBackgroundLoad();

    // 회계 전문용어 동의어 사전 (쿼리 확장용)
    this.synonyms = {
      '감사위험': ['감사위험', '중요한왜곡표시위험', 'RMM', '통제위험', '고유위험', '발견위험'],
      '독립성': ['독립성', '객관성', '공정성', '이해상충', '독립적'],
      '중요성': ['중요성', '양적중요성', '질적중요성', 'materiality', '중요한'],
      '내부통제': ['내부통제', '통제활동', '통제환경', '내부감사'],
      '표본': ['표본', '샘플링', '표본추출', '표본감사'],
      '실증절차': ['실증절차', '실질적절차', '세부테스트', '분석적절차'],
      '준수사항': ['준수사항', '법규준수', '컴플라이언스', 'compliance'],
      '후속사건': ['후속사건', '기말후사건', '후발사건'],
      '계속기업': ['계속기업', '계속경영', '계속성', 'going concern'],
      'KAM': ['KAM', '핵심감사사항', '핵심감사항목', '주요감사항목'],
      '회계추정': ['회계추정', '추정', '회계추정치', '불확실성'],
      '특수관계자': ['특수관계자', '관계자', '관련당사자', '관계회사'],
      '감사보고서': ['감사보고서', '감사의견', '감사인의견'],
      '부정': ['부정', '오류', '부정위험', '회계부정'],
      '경영진진술서': ['경영진진술서', '진술서', '확인서', 'representation letter']
    };
  }

  /**
   * 백그라운드 로딩 초기화 (생성자에서 자동 호출)
   * @private
   */
  async _initBackgroundLoad() {
    try {
      const startTime = Date.now();

      console.log('📥 벡터 데이터 다운로드 중...');
      const response = await fetch(this.vectorDataPath);

      if (!response.ok) {
        throw new Error(`벡터 파일 로드 실패: ${response.status}`);
      }

      const data = await response.json();

      if (!data.vectors || !Array.isArray(data.vectors)) {
        throw new Error('벡터 데이터 형식이 올바르지 않습니다.');
      }

      // 양자화 확인 및 디코딩
      const isQuantized = data.metadata?.quantization === 'int8';
      if (isQuantized) {
        console.log('🔄 Int8 양자화 벡터 감지 - 디코딩 중...');
        data.vectors = data.vectors.map(doc => ({
          ...doc,
          vector: this._dequantizeVector(doc.vector, doc.vector_min, doc.vector_max)
        }));
        console.log(`✅ 벡터 디코딩 완료 (정확도: ${data.metadata.quantization_accuracy})`);
      }

      this.vectors = data.vectors;
      this.metadata = data.metadata;

      // 타입별 인덱스 생성
      this.buildTypeIndex();

      this.isInitialized = true;

      const duration = Date.now() - startTime;
      console.log(`✅ RAG 벡터 로드 완료! (${this.vectors.length}개 문서, ${duration}ms)`);

      return true;

    } catch (error) {
      console.error('❌ RAG 벡터 로드 실패:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 벡터 데이터 로드 대기 (외부 호출용)
   * 백그라운드 로딩이 완료될 때까지 대기합니다
   */
  async loadVectors() {
    // 이미 로드 완료되었으면 즉시 반환
    if (this.isInitialized) {
      return true;
    }

    // 백그라운드 로딩을 기다림 (대부분의 경우 이미 완료되어 있음)
    console.log('⏳ 벡터 데이터 로드 대기 중...');
    return await this.loadingPromise;
  }

  /**
   * 로딩 상태 확인
   * @returns {Object} { isReady: boolean, isLoading: boolean, progress: string }
   */
  getLoadingStatus() {
    return {
      isReady: this.isInitialized,
      isLoading: !this.isInitialized,
      progress: this.isInitialized ? '완료' : '다운로드 중...'
    };
  }

  /**
   * Int8 역양자화 (디코딩)
   * @private
   */
  _dequantizeVector(quantized, min, max) {
    const scale = (max - min) / 255;
    const vector = new Array(quantized.length);

    for (let i = 0; i < quantized.length; i++) {
      vector[i] = (quantized[i] + 128) * scale + min;
    }

    return vector;
  }

  /**
   * 사용자 API Key 가져오기
   */
  getUserApiKey() {
    const apiKey = localStorage.getItem('gemini_api_key');

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API Key가 설정되지 않았습니다. 설정에서 Gemini API Key를 입력해주세요.');
    }

    return apiKey.trim();
  }

  /**
   * 타입별 인덱스 생성 (성능 최적화)
   */
  buildTypeIndex() {
    this.indexByType = {
      audit: [],
      law: [],
      ethics: [],
      study: [],
      kam: [],
      auditcase: [],
      exam: []
    };

    this.vectors.forEach((doc, idx) => {
      const type = doc.metadata?.type;
      if (type && this.indexByType[type]) {
        this.indexByType[type].push(idx);
      }
    });

    console.log('📑 타입별 인덱스 생성 완료:', {
      audit: this.indexByType.audit.length,
      law: this.indexByType.law.length,
      ethics: this.indexByType.ethics.length,
      study: this.indexByType.study.length,
      kam: this.indexByType.kam.length,
      auditcase: this.indexByType.auditcase.length,
      exam: this.indexByType.exam.length
    });
  }

  /**
   * 캐시 키 생성
   */
  getCacheKey(query, topK, options) {
    return JSON.stringify({ query, topK, options });
  }

  /**
   * 캐시에 추가 (LRU)
   */
  addToCache(key, value) {
    if (this.queryCache.size >= this.cacheMaxSize) {
      // 가장 오래된 항목 제거
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    this.queryCache.set(key, value);
  }

  /**
   * 메타데이터로부터 text 필드 재구성 (최적화된 벡터용)
   */
  reconstructText(metadata) {
    const { type, source, title, content, standard_number, paragraph_number } = metadata;

    switch (type) {
      case 'audit':
        const paraNum = paragraph_number || '';
        const stdTitle = title || '';
        return `[기준서 ${standard_number}] ${stdTitle}\n\n${paraNum} ${content}`.trim();

      case 'law':
        return `[${source}] ${title}\n\n${content}`.trim();

      case 'ethics':
        return `[윤리기준] ${title}\n\n${content}`.trim();

      case 'study':
        return `[회계감사기준 암기교재] ${title}\n\n${content}`.trim();

      case 'kam':
        return `[KAM 실증절차 사례] ${title}\n\n${content}`.trim();

      case 'exam':
        return `[${source}] ${title}\n\n${content}`.trim();

      default:
        return content || '';
    }
  }

  /**
   * 질문을 벡터로 변환 (BYOK)
   * Google Gemini text-embedding-004 REST API 사용
   */
  async getQueryEmbedding(text) {
    try {
      const apiKey = this.getUserApiKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: {
            parts: [{
              text: text
            }]
          },
          taskType: 'RETRIEVAL_QUERY'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        if (response.status === 401 || response.status === 403) {
          throw new Error('API Key가 유효하지 않습니다. 설정에서 올바른 API Key를 입력해주세요.');
        } else if (response.status === 429) {
          throw new Error('API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
        } else {
          throw new Error(`임베딩 생성 실패: ${errorMessage}`);
        }
      }

      const data = await response.json();

      if (!data.embedding || !data.embedding.values) {
        throw new Error('임베딩 데이터 형식이 올바르지 않습니다.');
      }

      return data.embedding.values;

    } catch (error) {
      console.error('❌ 질문 임베딩 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 검색 쿼리 정제 - 불필요한 조사, 의문사, 일반 동사 제거
   * @param {string} query - 원본 쿼리
   * @returns {string} 정제된 쿼리
   */
  _cleanQuery(query) {
    if (!query || typeof query !== 'string') return '';

    let cleaned = query.trim();

    // 1. 의문사와 조사 제거
    const removePatterns = [
      /은\?$/g, /는\?$/g, /이\?$/g, /가\?$/g,  // 조사 + 물음표
      /을\?$/g, /를\?$/g, /에\?$/g, /와\?$/g, /과\?$/g,
      /\?$/g,  // 물음표만
      /이란$/g, /란$/g,  // "~이란", "~란"
      /무엇인가$/g, /뭐야$/g, /뭔가요$/g,  // 의문 표현
      /서술하시오$/g, /서술하라$/g, /설명하시오$/g, /설명하라$/g, /기재하시오$/g, /기재하라$/g,  // 문제 지시어
      /입회시$/g, /절차를$/g,  // "~시", "~를" (문장 끝)
      / 시$/g, / 때$/g, / 경우$/g,  // "~시", "~때", "~경우" (공백 후)
    ];

    removePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // 2. 불필요한 단어 제거 (핵심 키워드만 보존)
    const removeWords = [
      '감사인의', '감사인', '회사의', '경우',
      '있는', '있다', '한다', '된다', '이다',
      '해야', '하여야', '되는', '하는', '인가',
      '수행', '실행', '진행', '시', '를', '에'
    ];

    removeWords.forEach(word => {
      const wordPattern = new RegExp(`\\s*${word}\\s*`, 'gi');
      cleaned = cleaned.replace(wordPattern, ' ');
    });

    // 3. 연속된 공백 제거 및 앞뒤 공백 제거
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 4. 너무 짧으면 원본 반환 (정제가 과도한 경우)
    if (cleaned.length < 2 && query.length > 2) {
      return query;
    }

    return cleaned || query;  // 빈 문자열이면 원본 반환
  }

  /**
   * 코사인 유사도 계산
   * @param {number[]} vecA - 벡터 A
   * @param {number[]} vecB - 벡터 B
   * @returns {number} 유사도 (0~1)
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      console.warn('⚠️  벡터 차원이 일치하지 않습니다.');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * 쿼리 확장 (Query Expansion) - 동의어 추가
   */
  expandQuery(query) {
    let expandedTerms = [];
    const queryLower = query.toLowerCase();

    // 동의어 사전에서 매칭되는 용어 찾기
    Object.entries(this.synonyms).forEach(([key, synonymList]) => {
      if (queryLower.includes(key.toLowerCase())) {
        // 원본 쿼리에 동의어 추가 (중복 제거)
        synonymList.forEach(syn => {
          if (!queryLower.includes(syn.toLowerCase())) {
            expandedTerms.push(syn);
          }
        });
      }
    });

    if (expandedTerms.length > 0) {
      console.log(`📝 쿼리 확장: "${query}" + [${expandedTerms.slice(0, 3).join(', ')}${expandedTerms.length > 3 ? '...' : ''}]`);
      return query + ' ' + expandedTerms.join(' ');
    }

    return query;
  }

  /**
   * 쿼리 타입에 따른 최적 가중치 계산 (성능 최적화)
   */
  getOptimalWeights(query) {
    // 기준서 번호 패턴이 있으면 키워드 가중치 증가
    if (/\d{3,4}-[A-Za-z]?\d+/.test(query)) {
      return { vector: 0.4, keyword: 0.5, quality: 0.1 };
    }

    // 짧은 쿼리 (1-2단어)는 키워드 중시
    const tokens = query.split(/\s+/).filter(t => t.length >= 2);
    if (tokens.length <= 2) {
      return { vector: 0.5, keyword: 0.4, quality: 0.1 };
    }

    // 긴 질문은 벡터 중시 (기본값)
    return { vector: 0.6, keyword: 0.3, quality: 0.1 };
  }

  /**
   * 키워드 매칭 점수 계산 (개선된 BM25 + 기준서 번호 정확 매칭)
   * @param {string} query - 검색 질문
   * @param {Object} doc - 문서 객체
   * @returns {number} 키워드 매칭 점수 (0~1)
   */
  calculateKeywordScore(query, doc) {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    const docText = (doc.text || '').toLowerCase();
    const docTitle = (doc.metadata?.title || '').toLowerCase();
    const docSource = (doc.metadata?.source || '').toLowerCase();

    let score = 0;
    let matchCount = 0;

    // 기준서 번호 패턴 감지 (예: "501-4", "720-12", "200-A21")
    const standardPattern = /(\d{3,4})-([A-Za-z]?\d+)/g;
    const standardMatches = query.match(standardPattern);

    queryTokens.forEach(token => {
      let tokenScore = 0;

      // 제목 완전 매칭 (가중치 5배)
      if (docTitle === token) {
        tokenScore += 5;
      }
      // 제목 부분 매칭 (가중치 3배)
      else if (docTitle.includes(token)) {
        tokenScore += 3;
      }

      // 출처 매칭 (가중치 2배)
      if (docSource.includes(token)) {
        tokenScore += 2;
      }

      // 본문 매칭 (빈도 고려) - 정규식 특수문자 이스케이프
      try {
        const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedToken, 'g');
        const matches = docText.match(regex);
        if (matches) {
          // 빈도에 따라 점수 증가 (최대 3점)
          tokenScore += Math.min(matches.length * 0.5, 3);
          matchCount++;
        }
      } catch (error) {
        // 정규식 오류 무시하고 계속 진행
        console.warn(`⚠️ 정규식 오류 무시: "${token}"`);
      }

      score += tokenScore;
    });

    // 기준서 번호 정확 매칭 (예: "501-4" → standard_number=501, paragraph_number=4)
    if (standardMatches && doc.metadata?.type === 'audit') {
      standardMatches.forEach(match => {
        const [_, stdNum, paraNum] = match.match(/(\d{3,4})-([A-Za-z]?\d+)/);
        const docStdNum = doc.metadata?.standard_number;
        const docParaNum = doc.metadata?.paragraph_number;

        // 기준서 번호와 문단 번호가 정확히 일치하면 높은 점수 부여
        if (docStdNum === stdNum && docParaNum === paraNum) {
          score += 20; // 매우 높은 가중치
          matchCount++;
        }
        // 기준서 번호만 일치하면 중간 점수
        else if (docStdNum === stdNum) {
          score += 3;
          matchCount++;
        }
      });
    }

    // 전체 토큰 중 매칭된 비율 고려
    const coverageBonus = queryTokens.length > 0 ? (matchCount / queryTokens.length) : 0;
    const finalScore = (score + coverageBonus * 3) / (queryTokens.length * 5);

    return Math.min(finalScore, 1);
  }

  /**
   * 문서 품질 점수 계산
   * @param {Object} doc - 문서 객체
   * @returns {number} 품질 점수 (0~1)
   */
  calculateQualityScore(doc) {
    let score = 0;

    // 공식 문서 우대 (audit, law, ethics)
    const officialTypes = ['audit', 'law', 'ethics'];
    if (officialTypes.includes(doc.metadata?.type)) {
      score += 0.3;
    }

    // 문서 길이 적정성 (너무 짧거나 길지 않은 문서 우대)
    const textLength = (doc.text || '').length;
    if (textLength > 100 && textLength < 2000) {
      score += 0.2;
    } else if (textLength >= 50) {
      score += 0.1;
    }

    // 메타데이터 완성도
    if (doc.metadata?.title && doc.metadata?.source) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * 리랭킹: 상위 후보군에 대해 정밀 점수 재계산
   * @param {string} query - 검색 쿼리
   * @param {Array} candidates - 후보 문서 리스트
   * @param {Object} options - 검색 옵션
   * @returns {Array} 리랭킹된 문서 리스트
   */
  rerankResults(query, candidates, options = {}) {
    console.log(`🔄 리랭킹 시작: ${candidates.length}개 후보 문서`);

    const reranked = candidates.map(doc => {
      let rerankScore = 0;
      const bonuses = [];

      // === 1. 기준서 번호 정확 매칭 보너스 ===
      const standardPattern = /(\d{3,4})-([A-Za-z]?\d+)/g;
      const queryStandards = query.match(standardPattern) || [];

      if (queryStandards.length > 0) {
        const docStdNum = doc.metadata?.standard_number;
        const docParaNum = doc.metadata?.paragraph_number;

        queryStandards.forEach(std => {
          const [fullMatch, stdNum, paraNum] = std.match(/(\d{3,4})-([A-Za-z]?\d+)/);

          // 기준서 번호 + 문단 번호 완전 매칭 (+0.4 보너스)
          if (docStdNum === stdNum && docParaNum === paraNum) {
            rerankScore += 0.4;
            bonuses.push(`기준서 정확 매칭(${std}): +40%`);
          }
          // 기준서 번호만 매칭 (+0.2 보너스)
          else if (docStdNum === stdNum) {
            rerankScore += 0.2;
            bonuses.push(`기준서 부분 매칭(${stdNum}): +20%`);
          }
        });
      }

      // === 2. 제목-쿼리 의미적 유사도 ===
      const title = (doc.metadata?.title || '').toLowerCase();
      const queryLower = query.toLowerCase();
      const queryTokens = queryLower.split(/\s+/).filter(t => t.length >= 2);

      let titleMatchCount = 0;
      queryTokens.forEach(token => {
        if (title.includes(token)) {
          titleMatchCount++;
        }
      });

      if (queryTokens.length > 0) {
        const titleMatchRatio = titleMatchCount / queryTokens.length;
        const titleBonus = titleMatchRatio * 0.15;  // 최대 +0.15
        if (titleBonus > 0) {
          rerankScore += titleBonus;
          bonuses.push(`제목 매칭(${(titleMatchRatio*100).toFixed(0)}%): +${(titleBonus*100).toFixed(1)}%`);
        }
      }

      // === 3. 내용-쿼리 키워드 밀집도 (Keyword Density) ===
      const content = (doc.metadata?.content || doc.text || '').toLowerCase();
      const contentTokens = content.split(/\s+/);

      let keywordDensity = 0;
      queryTokens.forEach(token => {
        try {
          // 정규식 특수문자 이스케이프
          const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedToken, 'g');
          const matches = content.match(regex);
          if (matches) {
            // 빈도를 문서 길이로 정규화
            keywordDensity += matches.length / Math.max(contentTokens.length, 1);
          }
        } catch (error) {
          // 정규식 오류 무시
          console.warn(`⚠️ 리랭킹 정규식 오류 무시: "${token}"`);
        }
      });

      const densityBonus = Math.min(keywordDensity * 0.1, 0.15);  // 최대 +0.15
      if (densityBonus > 0) {
        rerankScore += densityBonus;
        bonuses.push(`키워드 밀집도: +${(densityBonus*100).toFixed(1)}%`);
      }

      // === 4. 문서 타입별 가중치 ===
      const docType = doc.metadata?.type;
      let typeWeight = 1.0;

      // 쿼리에 따라 문서 타입 우선순위 조정
      if (queryLower.includes('기준서') || queryLower.includes('감사기준')) {
        if (docType === 'audit') typeWeight = 1.2;
        else if (docType === 'study') typeWeight = 0.9;
      } else if (queryLower.includes('법') || queryLower.includes('법령')) {
        if (docType === 'law') typeWeight = 1.2;
      } else if (queryLower.includes('윤리') || queryLower.includes('독립성')) {
        if (docType === 'ethics') typeWeight = 1.2;
      } else if (queryLower.includes('사례') || queryLower.includes('실무')) {
        if (docType === 'auditcase') typeWeight = 1.2;
        else if (docType === 'kam') typeWeight = 1.15;
      } else {
        // 일반 질문: audit 우선, study는 보조
        if (docType === 'audit') typeWeight = 1.1;
        else if (docType === 'study') typeWeight = 1.05;
      }

      if (typeWeight !== 1.0) {
        bonuses.push(`문서 타입(${docType}): x${typeWeight.toFixed(2)}`);
      }

      // === 5. 최종 점수 계산 ===
      // 기존 하이브리드 점수(0.6) + 리랭크 보너스(0.4)
      const finalScore = (doc.similarity * 0.6 * typeWeight) + (rerankScore * 0.4);

      // 로그 출력 (상위 3개만)
      if (candidates.indexOf(doc) < 3 && bonuses.length > 0) {
        console.log(`   📊 [${candidates.indexOf(doc) + 1}위] ${(finalScore * 100).toFixed(1)}% (기존: ${(doc.similarity * 100).toFixed(1)}%)`);
        console.log(`      보너스: ${bonuses.join(', ')}`);
      }

      return {
        ...doc,
        rerankScore: rerankScore,
        finalScore: finalScore,
        rerankBonuses: bonuses
      };
    });

    // 최종 점수로 재정렬
    reranked.sort((a, b) => b.finalScore - a.finalScore);

    console.log(`✅ 리랭킹 완료`);
    return reranked;
  }

  /**
   * 벡터 검색 수행 (하이브리드: 키워드 + 벡터)
   * @param {string} query - 사용자 질문
   * @param {number} topK - 상위 K개 결과 반환 (기본값: 5)
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array>} 검색 결과
   */
  async search(query, topK = 5, options = {}) {
    try {
      // 1. 캐시 확인 (성능 최적화)
      const cacheKey = this.getCacheKey(query, topK, options);
      if (this.queryCache.has(cacheKey)) {
        console.log('💨 캐시에서 결과 반환');
        return this.queryCache.get(cacheKey);
      }

      // 2. 벡터 데이터 로드 확인
      if (!this.isInitialized) {
        await this.loadVectors();
      }

      if (!this.vectors || this.vectors.length === 0) {
        console.warn('⚠️  검색 가능한 벡터 데이터가 없습니다.');
        return [];
      }

      // 3. 타입 필터로 검색 대상 축소 (성능 최적화)
      let candidateIndices = null;
      if (options.types && Array.isArray(options.types) && options.types.length > 0) {
        candidateIndices = new Set();
        options.types.forEach(type => {
          this.indexByType[type]?.forEach(idx => candidateIndices.add(idx));
        });
        console.log(`📑 인덱스 활용: ${this.vectors.length}개 → ${candidateIndices.size}개로 축소`);
      }

      const candidates = candidateIndices
        ? Array.from(candidateIndices).map(idx => ({ doc: this.vectors[idx], originalIndex: idx }))
        : this.vectors.map((doc, idx) => ({ doc, originalIndex: idx }));

      // 4. 질문을 벡터로 변환
      console.log('🔍 하이브리드 검색 중:', query);
      const queryVector = await this.getQueryEmbedding(query);

      // 5. 쿼리 타입에 따른 최적 가중치 계산 (성능 최적화)
      const weights = this.getOptimalWeights(query);
      console.log(`⚙️  가중치 자동 조정: 벡터(${(weights.vector*100).toFixed(0)}%) + 키워드(${(weights.keyword*100).toFixed(0)}%) + 품질(${(weights.quality*100).toFixed(0)}%)`);

      // 6. 쿼리 확장 (성능 최적화 - 재현율 향상)
      const expandedQuery = this.expandQuery(query);

      // 7. 벡터와 유사도 + 키워드 + 품질 점수 계산
      const results = candidates.map(({ doc }) => {
        const vectorSimilarity = this.cosineSimilarity(queryVector, doc.vector);
        const keywordScore = this.calculateKeywordScore(expandedQuery, doc);  // 확장된 쿼리 사용
        const qualityScore = this.calculateQualityScore(doc);

        // 하이브리드 점수: 동적 가중치 적용
        const hybridScore = (vectorSimilarity * weights.vector) +
                           (keywordScore * weights.keyword) +
                           (qualityScore * weights.quality);

        return {
          ...doc,
          similarity: hybridScore,
          vectorSimilarity: vectorSimilarity,
          keywordScore: keywordScore,
          qualityScore: qualityScore
        };
      });

      // 6. 하이브리드 점수 기준으로 정렬
      results.sort((a, b) => b.similarity - a.similarity);

      // 7. 필터링 옵션 적용 (타입 필터는 이미 적용됨)
      let filteredResults = results;

      // 최소 유사도 임계값 (짧은/긴 쿼리 모두 검색되도록 낮춤)
      const minSimilarity = options.minSimilarity || 0.1;
      filteredResults = filteredResults.filter(r => r.similarity >= minSimilarity);
      console.log(`   🎯 필터링: 임계값 ${minSimilarity} → ${filteredResults.length}개 문서`);

      // 8. 리랭킹: 상위 후보군에 대해 정밀 점수 재계산
      const candidateCount = Math.min(topK * 3, filteredResults.length);  // topK의 3배 후보
      const rerankCandidates = filteredResults.slice(0, candidateCount);
      const rerankedResults = this.rerankResults(query, rerankCandidates, options);

      // 9. 상위 K개 추출
      const topResults = rerankedResults.slice(0, topK);

      // 10. 캐시에 저장 (성능 최적화)
      this.addToCache(cacheKey, topResults);

      console.log(`✅ 하이브리드 검색 완료: ${topResults.length}개 문서 발견`);
      if (topResults.length > 0) {
        const top = topResults[0];
        console.log(`   [1위] ${(top.finalScore * 100).toFixed(1)}% (리랭크 후) = 하이브리드(${(top.similarity * 100).toFixed(1)}%) + 리랭크 보너스(${(top.rerankScore * 100).toFixed(1)}%)`);
        console.log(`      └─ 벡터(${(top.vectorSimilarity * 100).toFixed(1)}%) + 키워드(${(top.keywordScore * 100).toFixed(1)}%) + 품질(${(top.qualityScore * 100).toFixed(1)}%)`);
        if (topResults.length > 1) {
          const second = topResults[1];
          console.log(`   [2위] ${(second.finalScore * 100).toFixed(1)}% (리랭크 후) = 하이브리드(${(second.similarity * 100).toFixed(1)}%) + 리랭크 보너스(${(second.rerankScore * 100).toFixed(1)}%)`);
        }
      }

      return topResults;

    } catch (error) {
      console.error('❌ 검색 중 오류 발생:', error);
      throw error;
    }
  }

  /**
   * 검색 결과를 LLM 프롬프트용 컨텍스트로 포맷팅
   * @param {Array} results - 검색 결과
   * @returns {string} 포맷팅된 컨텍스트
   */
  formatPrompt(results) {
    if (!results || results.length === 0) {
      return '';
    }

    let prompt = '다음은 관련 참고 자료입니다:\n\n';

    results.forEach((result, index) => {
      const type = result.metadata?.type || 'unknown';
      const source = result.metadata?.source || '출처 미상';
      const title = result.metadata?.title || '';
      const content = result.metadata?.content || result.text;
      const similarity = (result.similarity * 100).toFixed(1);

      // 문서 타입별 포맷팅
      let typeLabel = '';
      switch (type) {
        case 'audit':
          typeLabel = '회계감사기준';
          break;
        case 'law':
          typeLabel = '법령';
          break;
        case 'ethics':
          typeLabel = '윤리기준';
          break;
        case 'study':
          typeLabel = '암기교재';
          break;
        case 'kam':
          typeLabel = 'KAM 사례';
          break;
        case 'exam':
          typeLabel = '기출문제';
          break;
        default:
          typeLabel = '기타';
      }

      prompt += `[참고문서 ${index + 1}] (${typeLabel}, 관련도 ${similarity}%)\n`;
      prompt += `출처: ${source}\n`;
      if (title) {
        prompt += `제목: ${title}\n`;
      }
      prompt += `내용:\n${content}\n\n`;
      prompt += '---\n\n';
    });

    return prompt;
  }

  /**
   * RAG 시스템 프롬프트 생성
   * LLM의 System Instruction으로 사용
   */
  getSystemPrompt() {
    return `당신은 회계 감사 전문가입니다.

다음 지침을 반드시 따라주세요:

1. 제공된 [참고문서]를 바탕으로 답변하세요.
2. 답변 시 반드시 근거가 되는 법령명, 기준서 번호, 조항을 명시해야 합니다.
   예: "회계감사기준 200에 따르면...", "외부감사법 제5조에 의하면...", "윤리기준 100.1에 따르면..."
3. 참고문서에 없는 내용은 추측하거나 지어내지 말고, 모른다고 솔직히 답하세요.
4. 참고문서 분류:
   - 공식 문서: 회계감사기준, 법령(외부감사법, 공인회계사법), 윤리기준 → 모두 동등하게 중요하며 함께 고려하세요
   - 참고 자료: 암기교재, KAM 사례, 기출문제 → 학습 및 실무 예시로만 활용하세요
5. 독립성, 윤리 등의 주제는 회계감사기준, 법령, 윤리기준을 종합적으로 검토하여 답변하세요.
6. 복잡한 개념은 쉽게 풀어서 설명하되, 정확성을 잃지 마세요.
7. 불확실한 경우 여러 해석이 가능함을 명시하고, 전문가 확인을 권장하세요.`;
  }

  /**
   * 통합 검색 및 프롬프트 생성
   * 검색부터 프롬프트 구성까지 한 번에 수행
   */
  async searchAndFormat(query, options = {}) {
    try {
      const topK = options.topK || 5;
      const results = await this.search(query, topK, options);

      return {
        systemPrompt: this.getSystemPrompt(),
        context: this.formatPrompt(results),
        results: results,
        hasResults: results.length > 0
      };

    } catch (error) {
      console.error('❌ RAG 처리 중 오류:', error);
      throw error;
    }
  }

  /**
   * 통계 정보 반환
   */
  getStats() {
    if (!this.isInitialized || !this.vectors) {
      return null;
    }

    const stats = {
      total: this.vectors.length,
      byType: {}
    };

    this.vectors.forEach(doc => {
      const type = doc.metadata?.type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  }

  /**
   * 초기화 상태 확인
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * 통합 검색 함수 (챗봇 통합용)
   * 사용자 질문에 관련된 모든 타입의 문서를 검색하고 컨텍스트를 생성
   *
   * @param {string} questionText - 사용자 질문 또는 문제 텍스트
   * @param {Array<string>} keywords - 추가 검색 키워드 (선택)
   * @param {number} topK - 타입별 검색 개수 (기본: 3)
   * @returns {Promise<{context: string, audit: Array, law: Array, ethics: Array, study: Array, kam: Array, exam: Array}>}
   */
  async searchAll(questionText, keywords = [], topK = 3) {
    try {
      await this.loadVectors();

      console.log('🔍 [RAG searchAll] 통합 검색 시작:', { questionText, keywords, topK });

      // 쿼리 정제: 불필요한 조사와 의문사 제거
      const cleanQuery = this._cleanQuery(questionText);
      console.log(`   📝 쿼리 정제: "${questionText}" → "${cleanQuery}"`);

      // 검색 쿼리 구성: 정제된 질문 + 키워드
      const query = keywords.length > 0
        ? `${cleanQuery} ${keywords.join(' ')}`
        : cleanQuery;

      // 타입별 검색 결과 저장
      const results = {
        audit: [],
        law: [],
        ethics: [],
        study: [],
        kam: [],
        auditcase: [],
        exam: [],
        context: ''
      };

      // 1. 학습자료 검색 (최우선 - 전처리 품질 우수)
      try {
        results.study = await this.search(query, topK, { types: ['study'] });
        console.log(`   ✅ 학습자료: ${results.study.length}개`);
      } catch (error) {
        console.error('   ❌ 학습자료 검색 실패:', error);
      }

      // 2. 외부감사법 검색
      try {
        results.law = await this.search(query, topK, { types: ['law'] });
        console.log(`   ✅ 외부감사법: ${results.law.length}개`);
      } catch (error) {
        console.error('   ❌ 외부감사법 검색 실패:', error);
      }

      // 3. 윤리기준 검색
      try {
        results.ethics = await this.search(query, topK, { types: ['ethics'] });
        console.log(`   ✅ 윤리기준: ${results.ethics.length}개`);
      } catch (error) {
        console.error('   ❌ 윤리기준 검색 실패:', error);
      }

      // 4. KAM 사례 검색
      try {
        results.kam = await this.search(query, topK, { types: ['kam'] });
        console.log(`   ✅ KAM 사례: ${results.kam.length}개`);
      } catch (error) {
        console.error('   ❌ KAM 사례 검색 실패:', error);
      }

      // 5. 금감원 감리지적사례 검색
      try {
        results.auditcase = await this.search(query, topK, { types: ['auditcase'] });
        console.log(`   ✅ 감리지적사례: ${results.auditcase.length}개`);
      } catch (error) {
        console.error('   ❌ 감리지적사례 검색 실패:', error);
      }

      // 6. 기출문제 검색
      try {
        results.exam = await this.search(query, topK, { types: ['exam'] });
        console.log(`   ✅ 기출문제: ${results.exam.length}개`);
      } catch (error) {
        console.error('   ❌ 기출문제 검색 실패:', error);
      }

      // 7. 회계감사기준 검색 (낮은 우선순위 - 전처리 품질 개선 필요)
      try {
        results.audit = await this.search(query, topK, { types: ['audit'] });
        console.log(`   ✅ 회계감사기준: ${results.audit.length}개`);
      } catch (error) {
        console.error('   ❌ 회계감사기준 검색 실패:', error);
      }

      // 컨텍스트 생성 (AI에게 전달할 참고 자료)
      results.context = this.buildContext(results);

      console.log('✅ [RAG searchAll] 통합 검색 완료');

      return results;

    } catch (error) {
      console.error('❌ [RAG searchAll] 통합 검색 실패:', error);
      // 실패해도 빈 결과 반환
      return {
        audit: [],
        law: [],
        ethics: [],
        study: [],
        kam: [],
        auditcase: [],
        exam: [],
        context: ''
      };
    }
  }

  /**
   * 검색 결과를 AI용 컨텍스트로 포맷팅 (하이브리드 방식)
   * 학습자료 2-3개 + 나머지 타입 Top 2-3개 = 총 5-6개
   * @private
   */
  buildContext(results) {
    let context = '';
    const MAX_TEXT_LENGTH = 1200; // 각 문서의 최대 텍스트 길이
    const MAX_CONTEXT_LENGTH = 10000; // 전체 컨텍스트 최대 길이 (토큰 절약)

    // 타입별 이모지 매핑
    const typeEmoji = {
      'study': '📚',
      'audit': '📘',
      'law': '📕',
      'ethics': '📗',
      'kam': '💼',
      'auditcase': '🚨',
      'exam': '📝'
    };

    const typeName = {
      'study': '학습자료',
      'audit': '회계감사기준',
      'law': '외부감사법',
      'ethics': '윤리기준',
      'kam': 'KAM 사례',
      'auditcase': '감리지적사례',
      'exam': '기출문제'
    };

    // 🎯 하이브리드 방식: 학습자료 2-3개 + 나머지 Top 2-3개
    const selectedDocs = [];

    // 1. 학습자료 우선 선택 (2-3개)
    if (results.study && results.study.length > 0) {
      const studyDocs = results.study.slice(0, 3);
      selectedDocs.push(...studyDocs);
      console.log(`   📚 학습자료 선택: ${studyDocs.length}개`);
    }

    // 2. 나머지 타입에서 유사도 높은 순으로 Top 2-3개 선택
    const otherDocs = [
      ...(results.law || []),
      ...(results.ethics || []),
      ...(results.kam || []),
      ...(results.auditcase || []),
      ...(results.exam || []),
      ...(results.audit || [])
    ];

    // 유사도 기준으로 정렬하고 Top 3 선택
    const topOthers = otherDocs
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    selectedDocs.push(...topOthers);
    console.log(`   🔍 기타 타입 선택: ${topOthers.length}개 (유사도 기준)`);

    // 3. 최종 선택된 문서들 (최대 5-6개)
    const finalDocs = selectedDocs.slice(0, 6);
    console.log(`   ✅ 최종 컨텍스트: ${finalDocs.length}개 문서`);

    // 4. 컨텍스트 포맷팅
    if (finalDocs.length === 0) {
      return '';
    }

    context += '## 📚 참고 자료 (검색 결과)\n\n';

    finalDocs.forEach((doc, idx) => {
      const type = doc.metadata?.type || 'unknown';
      const emoji = typeEmoji[type] || '📄';
      const typeLabel = typeName[type] || '기타';
      const title = doc.metadata?.title || '';
      const similarity = (doc.similarity * 100).toFixed(1);

      // 문서 제목 및 메타정보
      let header = `### ${idx + 1}. ${emoji} ${typeLabel}`;

      // 타입별 상세 정보
      if (type === 'audit') {
        const stdNum = doc.metadata?.standard_number || '';
        const paraNum = doc.metadata?.paragraph_number || '';
        header += ` - ${title} (${stdNum}${paraNum ? '-' + paraNum : ''})`;
      } else if (type === 'exam') {
        const year = doc.metadata?.year || '';
        header += ` - ${title}${year ? ` [${year}년]` : ''}`;
      } else {
        header += ` - ${title}`;
      }

      header += ` [유사도: ${similarity}%]\n\n`;

      // 본문 (길이 제한)
      const truncatedText = doc.text.length > MAX_TEXT_LENGTH
        ? doc.text.substring(0, MAX_TEXT_LENGTH) + '...'
        : doc.text;

      context += header + truncatedText + '\n\n---\n\n';
    });

    // 5. 컨텍스트 길이 제한
    if (context.length > MAX_CONTEXT_LENGTH) {
      console.warn(`⚠️ [RAG] 컨텍스트 길이 제한: ${context.length}자 → ${MAX_CONTEXT_LENGTH}자로 축소`);
      context = context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n...(이하 생략)';
    } else {
      console.log(`📊 [RAG] 컨텍스트 길이: ${context.length}자 (${finalDocs.length}개 문서)`);
    }

    return context.trim();
  }

  /**
   * 리소스 정리
   */
  cleanup() {
    this.vectors = null;
    this.metadata = null;
    this.isInitialized = false;
    this.isLoading = false;
    console.log('🧹 RAG 서비스 리소스 정리 완료');
  }
}

// 싱글톤 인스턴스 생성 및 ES6 모듈 export
const ragService = new RAGService();

// ES6 모듈로 내보내기 (named export)
export { ragService };

// 브라우저 전역 객체로도 내보내기 (하위 호환성)
if (typeof window !== 'undefined') {
  window.ragService = ragService;
}
