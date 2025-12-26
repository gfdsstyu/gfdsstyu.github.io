/**
 * RAG Service - Local Data Retrieval for AI Tutor
 *
 * 기능:
 * - kamData.json에서 실증절차 검색
 * - questions.json에서 회계감사기준서 검색
 * - examData에서 유사 기출문제 검색
 * - 검색 결과를 AI 프롬프트 Context로 변환
 */

/**
 * 키워드 기반 유사도 점수 계산
 * @param {string} text - 검색 대상 텍스트
 * @param {string[]} keywords - 검색 키워드 배열
 * @returns {number} - 유사도 점수 (0~100)
 */
function calculateRelevanceScore(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return 0;

  const normalizedText = text.toLowerCase();
  let score = 0;
  let matchedKeywords = 0;

  keywords.forEach(keyword => {
    const normalizedKeyword = keyword.toLowerCase();

    // 완전 일치 시 높은 점수
    if (normalizedText.includes(normalizedKeyword)) {
      matchedKeywords++;
      // 키워드 길이에 비례한 점수 부여
      score += normalizedKeyword.length * 10;

      // 여러 번 등장할수록 추가 점수
      const occurrences = (normalizedText.match(new RegExp(normalizedKeyword, 'g')) || []).length;
      score += (occurrences - 1) * 5;
    }
  });

  // 매칭 비율 보너스
  const matchRatio = matchedKeywords / keywords.length;
  score += matchRatio * 50;

  return Math.min(score, 100); // 최대 100점
}

/**
 * 텍스트에서 주요 키워드 추출
 * @param {string} text - 텍스트
 * @param {number} maxKeywords - 최대 키워드 수
 * @returns {string[]} - 추출된 키워드 배열
 */
function extractKeywords(text, maxKeywords = 5) {
  if (!text) return [];

  // 특수문자 제거 및 단어 분리
  const words = text
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2); // 2글자 이상만

  // 빈도수 계산
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // 빈도순 정렬 후 상위 N개 추출
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * RAG Service 클래스
 */
export class RAGService {
  constructor() {
    this.kamData = null; // 실증절차 데이터 (kamData.json)
    this.standardsData = null; // 기준서 데이터 (questions.json - 회계감사기준서 정리 목록)
    this.examData = null; // examData (2025, 2024, 2023... 모든 연도)
    this.initialized = false;
  }

  /**
   * 🆕 exam/data 폴더의 모든 연도별 JSON 파일 로드
   * 2025, 2024, 2023... 모든 연도를 자동으로 시도
   */
  async loadExamData() {
    try {
      const currentYear = new Date().getFullYear();
      const startYear = 2014; // 최소 연도
      const examDataFiles = [];

      // 현재 연도부터 2014년까지 역순으로 파일 경로 생성
      for (let year = currentYear; year >= startYear; year--) {
        examDataFiles.push(`/js/features/exam/data/${year}_hierarchical.json`);
      }

      console.log('🔄 [RAG Service] ExamData 로딩 시도 중...', {
        yearRange: `${currentYear}~${startYear}`,
        totalFiles: examDataFiles.length
      });

      const examDataArrays = await Promise.all(
        examDataFiles.map(async (url) => {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              // 404는 정상 (아직 없는 연도)
              if (response.status !== 404) {
                console.warn(`⚠️ [RAG Service] ${url} 로드 실패 (${response.status})`);
              }
              return [];
            }
            const data = await response.json();
            console.log(`✅ [RAG Service] ${url} 로드 성공`);
            return data;
          } catch (err) {
            // 파일 없음은 조용히 무시
            return [];
          }
        })
      );

      // 모든 연도 데이터를 하나의 배열로 병합
      this.examData = examDataArrays.flat();

      const loadedYears = examDataArrays.filter(arr => arr.length > 0).length;

      console.log('✅ [RAG Service] ExamData 로딩 완료:', {
        totalExams: this.examData.length,
        loadedYears: loadedYears,
        yearRange: `${currentYear}~${startYear}`
      });

      return this.examData;
    } catch (error) {
      console.error('❌ [RAG Service] ExamData 로딩 실패:', error);
      this.examData = [];
      return [];
    }
  }

  /**
   * 데이터 파일 로드
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔄 [RAG Service] 데이터 로딩 시작...');

      // 병렬 로딩
      const [kamDataRes, standardsRes, examDataRes] = await Promise.all([
        fetch('/js/data/kamData.json').then(r => r.json()), // 실증절차
        fetch('/questions.json').then(r => r.json()), // 기준서 데이터
        this.loadExamData() // examData 로딩
      ]);

      this.kamData = kamDataRes;
      this.standardsData = standardsRes; // questions.json = 회계감사기준서 정리
      this.examData = examDataRes;

      this.initialized = true;
      console.log('✅ [RAG Service] 데이터 로딩 완료:', {
        kamData: this.kamData.length,
        standards: this.standardsData.length,
        examData: this.examData.length
      });
    } catch (error) {
      console.error('❌ [RAG Service] 데이터 로딩 실패:', error);
      throw error;
    }
  }

  /**
   * kamData에서 관련 실증절차 검색
   * @param {string[]} keywords - 검색 키워드
   * @param {number} limit - 반환할 최대 결과 수
   * @returns {Array} - 관련 실증절차 배열
   */
  searchSubstantiveProcedures(keywords, limit = 3) {
    if (!this.initialized) {
      console.warn('⚠️ [RAG Service] 아직 초기화되지 않음');
      return [];
    }

    const results = this.kamData
      .map(item => {
        // 검색 대상 텍스트 조합
        const searchableText = [
          item.management_assertion,
          item.kam,
          item.situation,
          item.reason,
          ...(item.procedures || [])
        ].join(' ');

        const score = calculateRelevanceScore(searchableText, keywords);

        return {
          score,
          data: item
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`🔍 [RAG] 실증절차 검색 완료:`, {
      keywords,
      found: results.length,
      topScore: results[0]?.score || 0
    });

    return results.map(r => r.data);
  }

  /**
   * questions.json에서 기준서 검색
   * @param {string} questionText - 현재 문제 텍스트
   * @param {string[]} keywords - 검색 키워드
   * @param {number} limit - 반환할 최대 결과 수
   * @returns {Array} - 관련 기준서 배열
   */
  searchStandards(questionText, keywords = [], limit = 3) {
    if (!this.initialized) {
      console.warn('⚠️ [RAG Service] 아직 초기화되지 않음');
      return [];
    }

    // 키워드가 없으면 자동 추출
    if (keywords.length === 0) {
      keywords = extractKeywords(questionText, 7);
    }

    const results = this.standardsData
      .map(item => {
        const searchableText = [
          item.물음 || '',
          item.정답 || '',
          item.problemTitle || ''
        ].join(' ');

        const score = calculateRelevanceScore(searchableText, keywords);

        return {
          score,
          data: item
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`🔍 [RAG] 기준서 검색 완료:`, {
      keywords,
      found: results.length,
      topScore: results[0]?.score || 0
    });

    return results.map(r => r.data);
  }

  /**
   * 🆕 examData에서 유사 문제 검색 (2025, 2024... 모든 연도)
   * @param {string} questionText - 현재 문제 텍스트
   * @param {number} limit - 반환할 최대 결과 수
   * @returns {Array} - 유사 문제 배열 (examData 구조)
   */
  searchExamQuestions(questionText, limit = 3) {
    if (!this.initialized || !this.examData) {
      console.warn('⚠️ [RAG Service] examData 초기화되지 않음');
      return [];
    }

    // 현재 문제에서 키워드 추출
    const keywords = extractKeywords(questionText, 7);

    // examData는 계층 구조이므로 평탄화 (flatten)
    const allSubQuestions = [];
    this.examData.forEach(exam => {
      exam.cases?.forEach(examCase => {
        examCase.subQuestions?.forEach(subQ => {
          allSubQuestions.push({
            ...subQ,
            examId: exam.examId,
            topic: examCase.topic,
            chapter: examCase.chapter
          });
        });
      });
    });

    const results = allSubQuestions
      .map(item => {
        const searchableText = [
          item.question || '',
          item.answer || '',
          item.topic || '',
          item.explanation || '',
          ...(item.keywords || [])
        ].join(' ');

        const score = calculateRelevanceScore(searchableText, keywords);

        return {
          score,
          data: item
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`🔍 [RAG] examData 유사 문제 검색 완료:`, {
      keywords,
      totalQuestions: allSubQuestions.length,
      found: results.length,
      topScore: results[0]?.score || 0
    });

    return results.map(r => r.data);
  }

  /**
   * 검색 결과를 AI Context로 변환
   * @param {Array} procedures - 실증절차 데이터 (kamData)
   * @param {Array} standards - 기준서 데이터 (questions.json - 회계감사기준서)
   * @param {Array} examQuestions - 유사 문제 데이터 (examData)
   * @returns {string} - AI 프롬프트용 Context 텍스트
   */
  formatAsContext({ procedures = [], standards = [], examQuestions = [] }) {
    let context = '';

    // 기준서 Context (questions.json - 최우선 표시)
    if (standards.length > 0) {
      context += '\n\n# 📖 관련 회계감사기준서 (Standards)\n\n';
      standards.forEach((std, idx) => {
        context += `## ${idx + 1}. ${std.problemTitle || '제목 없음'}\n`;
        context += `- **물음**: ${std.물음}\n`;
        context += `- **정답**: ${std.정답}\n`;
        if (std.단원) {
          context += `- **단원**: ${std.단원}\n`;
        }
        context += '\n';
      });
    }

    // 실증절차 Context (kamData)
    if (procedures.length > 0) {
      context += '\n\n# 📚 관련 실증절차 (Substantive Procedures)\n\n';
      procedures.forEach((proc, idx) => {
        context += `## ${idx + 1}. ${proc.kam}\n`;
        context += `- **경영진 주장**: ${proc.management_assertion}\n`;
        context += `- **업종**: ${proc.industry} (${proc.size})\n`;
        context += `- **상황**: ${proc.situation}\n\n`;
        context += `**감사인의 절차**:\n`;
        proc.procedures.forEach((p, i) => {
          context += `${i + 1}. ${p}\n`;
        });
        context += '\n';
      });
    }

    // 🆕 examData 유사 문제 Context
    if (examQuestions.length > 0) {
      context += '\n\n# 🎯 유사 기출문제 (최신 시험)\n\n';
      examQuestions.forEach((q, idx) => {
        context += `## ${idx + 1}. ${q.topic || '주제 없음'} (${q.examId})\n`;
        context += `- **유형**: ${q.type}\n`;
        context += `- **물음**: ${q.question}\n`;
        context += `- **모범답안**: ${q.answer}\n`;
        if (q.explanation) {
          context += `- **해설**: ${q.explanation}\n`;
        }
        if (q.keywords && q.keywords.length > 0) {
          context += `- **키워드**: ${q.keywords.join(', ')}\n`;
        }
        context += '\n';
      });
    }

    return context;
  }

  /**
   * 종합 검색 (실증절차 + 기준서 + examData)
   * @param {string} questionText - 문제 텍스트
   * @param {string[]} customKeywords - 추가 키워드 (선택)
   * @returns {Object} - { context: string, procedures: [], standards: [], examQuestions: [] }
   */
  async searchAll(questionText, customKeywords = []) {
    if (!this.initialized) {
      await this.initialize();
    }

    // 자동 키워드 추출
    const autoKeywords = extractKeywords(questionText, 5);
    const keywords = [...new Set([...autoKeywords, ...customKeywords])];

    console.log('🔍 [RAG] 종합 검색 시작:', keywords);

    // 병렬 검색
    const [procedures, standards, examQuestions] = await Promise.all([
      Promise.resolve(this.searchSubstantiveProcedures(keywords, 3)), // kamData 실증절차
      Promise.resolve(this.searchStandards(questionText, keywords, 3)), // questions.json 기준서
      Promise.resolve(this.searchExamQuestions(questionText, 2)) // examData 유사 문제
    ]);

    const context = this.formatAsContext({
      procedures,
      standards,
      examQuestions
    });

    return {
      context,
      procedures, // kamData 실증절차
      standards, // questions.json 기준서
      examQuestions, // examData 유사 문제
      keywords
    };
  }
}

// 싱글톤 인스턴스
export const ragService = new RAGService();

/**
 * 간편 사용 함수
 */
export async function searchContext(questionText, customKeywords = []) {
  return await ragService.searchAll(questionText, customKeywords);
}
