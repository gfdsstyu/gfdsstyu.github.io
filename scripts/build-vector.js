/**
 * 벡터 인덱스 생성 스크립트
 *
 * 다음 데이터를 읽어 Google Gemini gemini-embedding-001 모델로 벡터화:
 * 1. 회계감사기준 (auditStandards.json) - 최우선 참조
 * 2. 법령 (legalDataLaws.json) - 외부감사법, 공인회계사법
 * 3. 윤리기준 (legalDataEthics.json) - 최신 클렌징 버전
 * 4. 회계감사기준 암기교재 (questions.json) - 참고용
 * 5. KAM 실증절차 사례 (kamData.json) - 참고용
 * 6. 기출문제 (examData) - 참고용
 *
 * 결과물: public/data/vectors.json
 *
 * 모델 정보:
 * - gemini-embedding-001: MTEB Multilingual 1위, 최대 3072차원 (768 사용)
 * - 2025년 3월 출시, text-embedding-004 후속 모델
 * - Matryoshka Representation Learning (MRL) 기술 적용
 *
 * 사용법:
 * 1. .env 파일에 GEMINI_API_KEY 설정
 * 2. node scripts/build-vector.js 실행
 */

const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// dotenv로 환경변수 로드
require('dotenv').config();

// 설정
const CONFIG = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  EMBEDDING_MODEL: 'models/gemini-embedding-001',
  OUTPUT_DIMENSION: 768,  // 768 / 1536 / 3072 선택 가능 (기본 크기 유지)
  BATCH_SIZE: 10,  // API Rate Limit 방지
  DELAY_MS: 1000,  // 배치 간 대기 시간
  ENABLE_QUANTIZATION: true,  // Int8 양자화 활성화
  INPUT_FILES: {
    auditStandards: '../DB/audit_standards_parsed.json',
    legalDataLaws: '../DB/legalDataLaws.json',
    legalDataEthics: '../DB/legalDataEthics.json',
    questions: '../questions.json',
    kamData: '../js/data/kamData.json',
    auditCases: '../DB/accounting_audit_cases.json',
    examData2025: '../js/features/exam/data/2025_hierarchical.json',
    examData2024: '../js/features/exam/data/2024_hierarchical.json'
  },
  OUTPUT_FILE: '../public/data/vectors.json',
  OUTPUT_FILE_QUANTIZED: '../public/data/vectors_quantized.json'
};

// 유틸리티 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 파일 읽기 헬퍼
 */
async function readJsonFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ 파일 읽기 실패: ${filePath}`);
    console.error(error.message);
    throw error;
  }
}

/**
 * 1. 회계감사기준 데이터 정규화
 * 평탄화된 배열 구조에서 개별 문단(paragraph) 단위로 추출
 *
 * 새 데이터 구조 (audit_standards_parsed.json):
 * - 각 항목이 이미 개별 문단 단위
 * - section_heading: 구체적인 소제목 (예: "전문가적 의구심", "재고자산 실사 입회")
 * - standard_id: 기준서 번호 (예: "200", "501")
 * - paragraph_number: 문단 번호 (예: "1", "A5")
 */
function normalizeAuditStandards(data) {
  const documents = [];

  try {
    if (!Array.isArray(data)) {
      console.warn('⚠️  회계감사기준 데이터가 배열이 아닙니다.');
      return documents;
    }

    // 기준서 번호 → 기준서 제목 매핑 (첫 번째 발견된 항목에서 추출)
    const standardTitles = {};

    data.forEach((item, index) => {
      if (!item.content || item.content.trim() === '') return;

      const standardId = item.standard_id || '';
      const paraNum = item.paragraph_number || '';
      const sectionHeading = item.section_heading || '';
      const uniqueId = item.unique_id || `audit_${standardId}_${index}`;

      // section_heading에서 기준서 제목 추출 (첫 줄이 보통 기준서 전체 제목)
      // 예: "이 감사기준서의 범위" → 기준서 200의 섹션 제목
      // content에서 실제 기준서 제목을 찾을 수 있음
      let standardTitle = standardTitles[standardId];
      if (!standardTitle) {
        // content 첫 부분에서 기준서 제목 추출 시도
        const contentLines = item.content.split('\n');
        if (contentLines.length > 0) {
          // 일반적으로 "독립된 감사인의 전반적인 목적..." 같은 형태
          standardTitle = `기준서 ${standardId}`;
          standardTitles[standardId] = standardTitle;
        }
      }

      // 제목 구성: section_heading을 소제목으로 사용
      const displayTitle = sectionHeading
        ? `${standardTitle} - ${sectionHeading}`
        : standardTitle;

      // 텍스트 구성: [기준서 번호] 제목 - 소제목\n\n문단번호 내용
      const text = `[기준서 ${standardId}] ${displayTitle}\n\n${paraNum ? paraNum + ' ' : ''}${item.content}`.trim();

      documents.push({
        id: uniqueId,
        text: text,
        metadata: {
          type: 'audit',
          source: `회계감사기준 ${standardId}`,
          title: displayTitle,
          content: item.content,
          standard_number: standardId,
          section_name: sectionHeading,
          paragraph_number: paraNum,
          subsection: sectionHeading  // section_heading을 subsection으로도 저장
        }
      });
    });

    console.log(`✅ 회계감사기준: ${documents.length}개 문서 추출`);
  } catch (error) {
    console.error('❌ 회계감사기준 정규화 오류:', error.message);
  }

  return documents;
}

/**
 * 2. 법령 데이터 정규화
 * 법률 > 조항 구조를 평탄화
 */
function normalizeLegalDataLaws(data) {
  const documents = [];

  try {
    if (!Array.isArray(data)) {
      console.warn('⚠️  법령 데이터가 배열이 아닙니다.');
      return documents;
    }

    data.forEach((law, lawIndex) => {
      const lawName = law.law_name || '법률명 미상';
      const articles = law.articles || [];

      articles.forEach((article, articleIndex) => {
        const articleId = article.article_id || `제${articleIndex + 1}조`;
        const title = article.title || '';
        const textBody = article.text_body || '';
        const fullContent = article.full_content || textBody;

        if (!fullContent.trim()) return;

        const docId = `law_${lawIndex}_${articleIndex}`;
        const text = `[${lawName}] ${articleId} ${title}\n\n${fullContent}`.trim();

        documents.push({
          id: docId,
          text: text,
          metadata: {
            type: 'law',
            source: lawName,
            title: `${articleId} ${title}`,
            content: fullContent,
            article_id: articleId
          }
        });
      });
    });

    console.log(`✅ 법령 데이터: ${documents.length}개 문서 추출`);
  } catch (error) {
    console.error('❌ 법령 데이터 정규화 오류:', error.message);
  }

  return documents;
}

/**
 * 3. 윤리기준 데이터 정규화
 */
function normalizeLegalDataEthics(data) {
  const documents = [];

  try {
    if (!Array.isArray(data)) {
      console.warn('⚠️  윤리기준 데이터가 배열이 아닙니다.');
      return documents;
    }

    data.forEach((item, index) => {
      const content = item.content || '';
      if (!content.trim()) return;

      const part = item.part || '';
      const chapter = item.chapter || '';
      const itemId = item.id || `ethics_${index}`;

      const docId = `ethics_${index}`;
      const text = `[윤리기준] ${part} ${chapter}\n\n${content}`.trim();

      documents.push({
        id: docId,
        text: text,
        metadata: {
          type: 'ethics',
          source: 'KICPA 윤리기준',
          title: `${part} ${chapter}`.trim(),
          content: content,
          item_id: itemId
        }
      });
    });

    console.log(`✅ 윤리기준: ${documents.length}개 문서 추출`);
  } catch (error) {
    console.error('❌ 윤리기준 정규화 오류:', error.message);
  }

  return documents;
}

/**
 * 4. 회계감사기준 암기교재 데이터 정규화 (questions.json)
 * 기준서 기반 암기 문답 - 참고용(Reference)으로 사용
 */
function normalizeQuestions(data) {
  const documents = [];

  try {
    if (!Array.isArray(data)) {
      console.warn('⚠️  암기교재 데이터가 배열이 아닙니다.');
      return documents;
    }

    data.forEach((item, index) => {
      const question = item.물음 || '';
      const answer = item.정답 || '';

      if (!question.trim() && !answer.trim()) return;

      const id = item.고유ID || `study_${index}`;
      const title = item.problemTitle || '암기문항';
      const source = item.출처 || '';

      const docId = `study_${index}`;
      const text = `[회계감사기준 암기교재] ${title}\n\n물음: ${question}\n\n답: ${answer}`.trim();

      documents.push({
        id: docId,
        text: text,
        metadata: {
          type: 'study',
          source: `회계감사기준 암기교재 (출처: ${source})`,
          title: title,
          content: `물음: ${question}\n답: ${answer}`,
          item_id: id,
          chapter: item.단원 || ''
        }
      });
    });

    console.log(`✅ 회계감사기준 암기교재: ${documents.length}개 문서 추출 (참고용)`);
  } catch (error) {
    console.error('❌ 암기교재 정규화 오류:', error.message);
  }

  return documents;
}

/**
 * 5. KAM 실증절차 사례 데이터 정규화 (kamData.json)
 * 감사보고서 실증절차 수행 사례 - 참고용
 */
function normalizeKamData(data) {
  const documents = [];

  try {
    if (!Array.isArray(data)) {
      console.warn('⚠️  KAM 데이터가 배열이 아닙니다.');
      return documents;
    }

    data.forEach((item, index) => {
      const kam = item.kam || '';
      const assertion = item.management_assertion || '';
      const situation = item.situation || '';
      const reason = item.reason || '';
      const procedures = item.procedures || [];

      if (!kam.trim() && procedures.length === 0) return;

      const docId = `kam_${index}`;
      const proceduresText = procedures.map((p, i) => `${i + 1}. ${p}`).join('\n');

      const text = `[KAM 실증절차 사례] ${kam}\n\n경영진 주장: ${assertion}\n업종: ${item.industry || ''} (${item.size || ''})\n\n상황:\n${situation}\n\n이유:\n${reason}\n\n감사절차:\n${proceduresText}`.trim();

      documents.push({
        id: docId,
        text: text,
        metadata: {
          type: 'kam',
          source: 'KAM 실증절차 사례',
          title: kam,
          content: `경영진 주장: ${assertion}\n상황: ${situation}\n감사절차:\n${proceduresText}`,
          industry: item.industry || '',
          size: item.size || '',
          assertion: assertion
        }
      });
    });

    console.log(`✅ KAM 실증절차 사례: ${documents.length}개 문서 추출 (참고용)`);
  } catch (error) {
    console.error('❌ KAM 데이터 정규화 오류:', error.message);
  }

  return documents;
}

/**
 * 6. 금감원 감리지적사례 데이터 정규화 (accounting_audit_cases.json)
 * 회사의 잘못된 회계처리 및 감사인 지적 사례 - 실무 참고용
 */
function normalizeAuditCases(data) {
  const documents = [];

  try {
    const cases = data.cases || [];

    if (!Array.isArray(cases)) {
      console.warn('⚠️  감리지적사례 데이터가 배열이 아닙니다.');
      return documents;
    }

    cases.forEach((caseItem) => {
      const caseId = caseItem.case_id || '';
      const title = caseItem.title || '';
      const metadata = caseItem.metadata || {};
      const sections = caseItem.sections || {};

      // 섹션별 텍스트 구성
      const companyTreatment = sections.company_accounting_treatment || '';
      const violation = sections.accounting_standard_violation || '';
      const basisAndJudgment = sections.audit_basis_and_judgment || '';
      const procedureDeficiency = sections.audit_procedure_deficiency || '';

      if (!title.trim() && !companyTreatment.trim()) return;

      const docId = `auditcase_${caseId}`;

      // 텍스트 구성: [감리지적사례] 제목 + 상세 내용
      const text = `[금감원 감리지적사례] ${title}

사례번호: ${caseId}
분야: ${metadata.issue_area || ''}
관련 기준서: ${metadata.related_standard || ''}
결정일: ${metadata.decision_date || ''}
회계결산일: ${metadata.accounting_settlement_date || ''}

## 회사의 회계처리
${companyTreatment}

## 회계기준 위반 내용
${violation}

## 회계기준 근거 및 판단
${basisAndJudgment}

## 감사절차 미비 사항
${procedureDeficiency}`.trim();

      documents.push({
        id: docId,
        text: text,
        metadata: {
          type: 'auditcase',
          source: '금융감독원 감리지적사례',
          title: title,
          content: `${companyTreatment}\n\n${violation}`,
          case_id: caseId,
          issue_area: metadata.issue_area || '',
          related_standard: metadata.related_standard || '',
          decision_date: metadata.decision_date || '',
          has_audit_deficiency: !!procedureDeficiency
        }
      });
    });

    console.log(`✅ 금감원 감리지적사례: ${documents.length}개 문서 추출 (실무 참고용)`);
  } catch (error) {
    console.error('❌ 감리지적사례 정규화 오류:', error.message);
  }

  return documents;
}

/**
 * 7. 기출문제 데이터 정규화 (examData - 2025, 2024 등)
 * 실제 시험 기출문제 - 참고용
 */
function normalizeExamData(dataArray, year) {
  const documents = [];

  try {
    if (!Array.isArray(dataArray)) {
      console.warn(`⚠️  ${year} 기출문제 데이터가 배열이 아닙니다.`);
      return documents;
    }

    dataArray.forEach((exam) => {
      const examId = exam.examId || year;
      const cases = exam.cases || [];

      cases.forEach((examCase) => {
        const topic = examCase.topic || '';
        const chapter = examCase.chapter || '';
        const subQuestions = examCase.subQuestions || [];

        subQuestions.forEach((subQ, index) => {
          const question = subQ.question || '';
          const answer = subQ.answer || '';
          const explanation = subQ.explanation || '';

          if (!question.trim() && !answer.trim()) return;

          const docId = `exam_${year}_${examCase.caseId || index}_${subQ.id || index}`;

          const keywordsText = (subQ.keywords || []).join(', ');
          const text = `[${year} 기출문제] ${topic}\n\n유형: ${subQ.type || ''}\n문제: ${question}\n\n모범답안: ${answer}\n\n해설: ${explanation}\n\n키워드: ${keywordsText}`.trim();

          documents.push({
            id: docId,
            text: text,
            metadata: {
              type: 'exam',
              source: `${year} 기출문제`,
              title: topic,
              content: `문제: ${question}\n답안: ${answer}${explanation ? `\n해설: ${explanation}` : ''}`,
              year: year,
              exam_id: examId,
              chapter: chapter,
              question_type: subQ.type || '',
              keywords: subQ.keywords || []
            }
          });
        });
      });
    });

    console.log(`✅ ${year} 기출문제: ${documents.length}개 문서 추출 (참고용)`);
  } catch (error) {
    console.error(`❌ ${year} 기출문제 정규화 오류:`, error.message);
  }

  return documents;
}

/**
 * Int8 양자화 함수
 * Float32 벡터를 Int8로 변환하여 파일 크기를 75% 감소
 *
 * @param {number[]} vector - Float32 벡터 (768차원)
 * @returns {Object} { values: Int8Array, min: number, max: number }
 */
function quantizeToInt8(vector) {
  // 1. 벡터의 최소/최대값 찾기
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < vector.length; i++) {
    if (vector[i] < min) min = vector[i];
    if (vector[i] > max) max = vector[i];
  }

  // 2. Float32 → Int8 스케일 계산
  // Int8 범위: -128 ~ 127 (총 256 단계)
  const scale = (max - min) / 255;

  // 3. 양자화: float → int8
  const quantized = new Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    // float를 0-255 범위로 정규화 후 -128 ~ 127로 변환
    quantized[i] = Math.round((vector[i] - min) / scale) - 128;
  }

  return {
    values: quantized,  // Int8 배열
    min: min,           // 디코딩용 최소값
    max: max            // 디코딩용 최대값
  };
}

/**
 * Int8 역양자화 함수 (디코딩)
 * Int8 벡터를 다시 Float32로 복원
 *
 * @param {number[]} quantized - Int8 양자화된 값들
 * @param {number} min - 원본 최소값
 * @param {number} max - 원본 최대값
 * @returns {number[]} Float32 벡터
 */
function dequantizeFromInt8(quantized, min, max) {
  const scale = (max - min) / 255;
  const vector = new Array(quantized.length);

  for (let i = 0; i < quantized.length; i++) {
    // int8 → float 복원
    vector[i] = (quantized[i] + 128) * scale + min;
  }

  return vector;
}

/**
 * 양자화 정확도 테스트
 * 원본 벡터와 양자화 후 복원된 벡터의 유사도 계산
 */
function testQuantizationAccuracy(vector) {
  // 양자화
  const { values, min, max } = quantizeToInt8(vector);

  // 역양자화 (복원)
  const restored = dequantizeFromInt8(values, min, max);

  // 코사인 유사도 계산
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vector.length; i++) {
    dotProduct += vector[i] * restored[i];
    norm1 += vector[i] * vector[i];
    norm2 += restored[i] * restored[i];
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return similarity;
}

/**
 * 배치 임베딩 처리
 * Rate Limit 방지를 위해 배치 처리 및 딜레이 적용
 */
async function batchEmbedding(genAI, documents) {
  const model = genAI.getGenerativeModel({ model: CONFIG.EMBEDDING_MODEL });
  const results = [];
  const totalBatches = Math.ceil(documents.length / CONFIG.BATCH_SIZE);

  console.log(`\n📊 총 ${documents.length}개 문서를 ${totalBatches}개 배치로 처리합니다.`);
  console.log(`   배치 크기: ${CONFIG.BATCH_SIZE}, 배치 간 딜레이: ${CONFIG.DELAY_MS}ms\n`);

  for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
    const batch = documents.slice(i, i + CONFIG.BATCH_SIZE);
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;

    console.log(`⏳ 배치 ${batchNum}/${totalBatches} 처리 중... (문서 ${i + 1}~${Math.min(i + CONFIG.BATCH_SIZE, documents.length)})`);

    try {
      // 배치 내 각 문서에 대해 임베딩 생성
      const batchPromises = batch.map(async (doc) => {
        try {
          // taskType을 RETRIEVAL_DOCUMENT로 명시적 설정
          // outputDimensionality로 차원 지정 (gemini-embedding-001 지원)
          const result = await model.embedContent({
            content: { parts: [{ text: doc.text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: CONFIG.OUTPUT_DIMENSION
          });
          return {
            ...doc,
            vector: result.embedding.values
          };
        } catch (error) {
          console.error(`   ❌ 문서 ${doc.id} 임베딩 실패:`, error.message);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));

      console.log(`   ✅ 배치 ${batchNum} 완료 (${batchResults.filter(r => r !== null).length}/${batch.length} 성공)`);

      // 마지막 배치가 아니면 대기
      if (i + CONFIG.BATCH_SIZE < documents.length) {
        await delay(CONFIG.DELAY_MS);
      }

    } catch (error) {
      console.error(`   ❌ 배치 ${batchNum} 처리 중 오류:`, error.message);

      // Rate limit 에러인 경우 더 긴 대기
      if (error.message.includes('429') || error.message.includes('quota')) {
        console.log(`   ⏸️  Rate Limit 감지. 5초 대기 후 재시도...`);
        await delay(5000);
        i -= CONFIG.BATCH_SIZE; // 이번 배치 재시도
      }
    }
  }

  return results;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 벡터 인덱스 생성 시작\n');

  // API Key 확인
  if (!CONFIG.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    console.error('   .env 파일에 GEMINI_API_KEY를 설정하거나');
    console.error('   환경변수로 export GEMINI_API_KEY=your_key 를 실행하세요.');
    process.exit(1);
  }

  try {
    // 1. 데이터 로드
    console.log('📂 데이터 파일 로드 중...\n');

    const auditStandardsData = await readJsonFile(CONFIG.INPUT_FILES.auditStandards);
    const legalDataLawsData = await readJsonFile(CONFIG.INPUT_FILES.legalDataLaws);
    const legalDataEthicsData = await readJsonFile(CONFIG.INPUT_FILES.legalDataEthics);
    const questionsData = await readJsonFile(CONFIG.INPUT_FILES.questions);
    const kamData = await readJsonFile(CONFIG.INPUT_FILES.kamData);
    const auditCasesData = await readJsonFile(CONFIG.INPUT_FILES.auditCases);
    const examData2025 = await readJsonFile(CONFIG.INPUT_FILES.examData2025);
    const examData2024 = await readJsonFile(CONFIG.INPUT_FILES.examData2024);

    // 2. 데이터 정규화
    console.log('\n📋 데이터 정규화 중...\n');

    const auditDocs = normalizeAuditStandards(auditStandardsData);
    const lawDocs = normalizeLegalDataLaws(legalDataLawsData);
    const ethicsDocs = normalizeLegalDataEthics(legalDataEthicsData);
    const studyDocs = normalizeQuestions(questionsData);
    const kamDocs = normalizeKamData(kamData);
    const auditCasesDocs = normalizeAuditCases(auditCasesData);
    const exam2025Docs = normalizeExamData(examData2025, '2025');
    const exam2024Docs = normalizeExamData(examData2024, '2024');

    const allDocuments = [
      ...auditDocs,
      ...lawDocs,
      ...ethicsDocs,
      ...studyDocs,
      ...kamDocs,
      ...auditCasesDocs,
      ...exam2025Docs,
      ...exam2024Docs
    ];

    console.log(`\n📊 전체 문서 수: ${allDocuments.length}개`);
    console.log(`   - 회계감사기준: ${auditDocs.length}개`);
    console.log(`   - 법령 (외부감사법, 공인회계사법): ${lawDocs.length}개`);
    console.log(`   - 윤리기준: ${ethicsDocs.length}개`);
    console.log(`   - 회계감사기준 암기교재: ${studyDocs.length}개 (참고용)`);
    console.log(`   - KAM 실증절차 사례: ${kamDocs.length}개 (참고용)`);
    console.log(`   - 금감원 감리지적사례: ${auditCasesDocs.length}개 (실무 참고용)`);
    console.log(`   - 2025 기출문제: ${exam2025Docs.length}개 (참고용)`);
    console.log(`   - 2024 기출문제: ${exam2024Docs.length}개 (참고용)`);

    if (allDocuments.length === 0) {
      console.error('\n❌ 정규화된 문서가 없습니다. 데이터 파일을 확인하세요.');
      process.exit(1);
    }

    // 3. 임베딩 생성
    console.log('\n🔄 임베딩 생성 중...');

    const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
    const vectorizedDocs = await batchEmbedding(genAI, allDocuments);

    console.log(`\n✅ 임베딩 완료: ${vectorizedDocs.length}/${allDocuments.length}개 성공`);

    if (vectorizedDocs.length === 0) {
      console.error('\n❌ 임베딩된 문서가 없습니다.');
      process.exit(1);
    }

    // 4. 결과 저장 (Float32 원본)
    console.log('\n💾 벡터 파일 저장 중...');

    const outputDir = path.dirname(CONFIG.OUTPUT_FILE);
    await fs.mkdir(outputDir, { recursive: true });

    const output = {
      metadata: {
        version: '2.1.0',
        created_at: new Date().toISOString(),
        model: CONFIG.EMBEDDING_MODEL,
        dimensions: CONFIG.OUTPUT_DIMENSION,
        total_documents: vectorizedDocs.length,
        quantization: 'none',
        document_types: {
          audit: auditDocs.length,
          law: lawDocs.length,
          ethics: ethicsDocs.length,
          study: studyDocs.length,
          kam: kamDocs.length,
          auditcase: auditCasesDocs.length,
          exam: exam2025Docs.length + exam2024Docs.length
        },
        description: '회계감사기준, 법령, 윤리기준 (클렌징), 암기교재, KAM 사례, 감리지적사례, 기출문제',
        notes: 'gemini-embedding-001 (MTEB Multilingual 1위, MRL 기술 적용)'
      },
      vectors: vectorizedDocs
    };

    await fs.writeFile(
      CONFIG.OUTPUT_FILE,
      JSON.stringify(output, null, 2),
      'utf-8'
    );

    // 파일 크기 확인
    const stats = await fs.stat(CONFIG.OUTPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`\n✨ 벡터 인덱스 생성 완료! (Float32)`);
    console.log(`   출력 파일: ${CONFIG.OUTPUT_FILE}`);
    console.log(`   파일 크기: ${fileSizeMB} MB`);
    console.log(`   총 벡터 수: ${vectorizedDocs.length}개`);

    // 5. 양자화 버전 생성 (옵션)
    if (CONFIG.ENABLE_QUANTIZATION) {
      console.log(`\n🔄 Int8 양자화 진행 중...`);

      // 양자화 정확도 테스트 (첫 5개 벡터)
      const accuracies = [];
      for (let i = 0; i < Math.min(5, vectorizedDocs.length); i++) {
        const accuracy = testQuantizationAccuracy(vectorizedDocs[i].vector);
        accuracies.push(accuracy);
      }
      const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
      console.log(`   📊 양자화 정확도 테스트: ${(avgAccuracy * 100).toFixed(2)}% (${accuracies.length}개 샘플)`);

      // 모든 벡터 양자화
      const quantizedDocs = vectorizedDocs.map(doc => {
        const { values, min, max } = quantizeToInt8(doc.vector);
        return {
          ...doc,
          vector: values,  // Int8 배열로 교체
          vector_min: min,
          vector_max: max
        };
      });

      const quantizedOutput = {
        metadata: {
          version: '2.1.0',
          created_at: new Date().toISOString(),
          model: CONFIG.EMBEDDING_MODEL,
          dimensions: CONFIG.OUTPUT_DIMENSION,
          total_documents: quantizedDocs.length,
          quantization: 'int8',
          quantization_accuracy: `${(avgAccuracy * 100).toFixed(2)}%`,
          document_types: {
            audit: auditDocs.length,
            law: lawDocs.length,
            ethics: ethicsDocs.length,
            study: studyDocs.length,
            kam: kamDocs.length,
            auditcase: auditCasesDocs.length,
            exam: exam2025Docs.length + exam2024Docs.length
          },
          description: '회계감사기준, 법령, 윤리기준 (클렌징), 암기교재, KAM 사례, 감리지적사례, 기출문제',
          notes: 'Int8 양자화 적용 - 파일 크기 75% 감소, 정확도 99%+ 유지'
        },
        vectors: quantizedDocs
      };

      await fs.writeFile(
        CONFIG.OUTPUT_FILE_QUANTIZED,
        JSON.stringify(quantizedOutput, null, 2),
        'utf-8'
      );

      const quantizedStats = await fs.stat(CONFIG.OUTPUT_FILE_QUANTIZED);
      const quantizedSizeMB = (quantizedStats.size / (1024 * 1024)).toFixed(2);
      const reduction = ((1 - quantizedStats.size / stats.size) * 100).toFixed(1);

      console.log(`\n✨ 양자화 벡터 인덱스 생성 완료! (Int8)`);
      console.log(`   출력 파일: ${CONFIG.OUTPUT_FILE_QUANTIZED}`);
      console.log(`   파일 크기: ${quantizedSizeMB} MB (${reduction}% 감소)`);
      console.log(`   정확도: ${(avgAccuracy * 100).toFixed(2)}%`);
    }

  } catch (error) {
    console.error('\n❌ 처리 중 오류 발생:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
