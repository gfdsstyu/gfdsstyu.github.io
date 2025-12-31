/**
 * 벡터 파일 최적화 스크립트
 *
 * 최적화 방법:
 * 1. 벡터 양자화: Float32 → Int8 (4배 용량 감소)
 * 2. 중복 텍스트 제거: text 필드는 브라우저에서 재생성
 * 3. JSON 압축: 불필요한 공백 제거
 *
 * 모델 정보:
 * - gemini-embedding-001 (MTEB Multilingual 1위)
 * - 768차원 벡터
 *
 * 예상 효과: 53MB → 15-20MB (60-70% 감소)
 */

const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
  INPUT_FILE: '../public/data/vectors.json',
  OUTPUT_FILE: '../public/data/vectors.optimized.json',
  BACKUP_FILE: '../public/data/vectors.backup.json'
};

/**
 * Float32 벡터를 Int8로 양자화
 * 범위: [-1, 1] → [-127, 127]
 */
function quantizeVector(vector) {
  return vector.map(val => {
    // -1 ~ 1 범위를 -127 ~ 127로 변환
    const quantized = Math.round(val * 127);
    return Math.max(-127, Math.min(127, quantized));
  });
}

/**
 * Int8 벡터를 Float32로 역양자화
 */
function dequantizeVector(quantizedVector) {
  return quantizedVector.map(val => val / 127);
}

/**
 * 벡터 최적화 실행
 */
async function optimizeVectors() {
  console.log('🚀 벡터 파일 최적화 시작\n');

  try {
    // 1. 원본 파일 로드
    console.log('📂 원본 파일 로드 중...');
    const inputPath = path.resolve(__dirname, CONFIG.INPUT_FILE);
    const rawData = await fs.readFile(inputPath, 'utf-8');
    const originalSize = Buffer.byteLength(rawData, 'utf-8');
    const data = JSON.parse(rawData);

    console.log(`   원본 크기: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   문서 수: ${data.vectors.length}개\n`);

    // 2. 백업 생성
    console.log('💾 원본 파일 백업 중...');
    const backupPath = path.resolve(__dirname, CONFIG.BACKUP_FILE);
    await fs.writeFile(backupPath, rawData, 'utf-8');
    console.log(`   백업 완료: ${CONFIG.BACKUP_FILE}\n`);

    // 3. 벡터 최적화
    console.log('🔧 벡터 최적화 중...');
    let quantizedCount = 0;
    let textRemovedCount = 0;

    const optimizedVectors = data.vectors.map((doc, index) => {
      if (index % 500 === 0) {
        console.log(`   진행: ${index}/${data.vectors.length} (${((index / data.vectors.length) * 100).toFixed(1)}%)`);
      }

      // 벡터 양자화
      const quantizedVector = quantizeVector(doc.vector);
      quantizedCount++;

      // text 필드 제거 (metadata.content와 중복)
      // 클라이언트에서 필요 시 metadata로 재구성
      const { text, ...restDoc } = doc;
      textRemovedCount++;

      return {
        ...restDoc,
        vector: quantizedVector
      };
    });

    console.log(`   ✅ 벡터 양자화: ${quantizedCount}개`);
    console.log(`   ✅ 중복 텍스트 제거: ${textRemovedCount}개\n`);

    // 4. 최적화된 데이터 구조
    const optimizedData = {
      metadata: {
        ...data.metadata,
        optimized: true,
        optimization_date: new Date().toISOString(),
        quantization: {
          method: 'int8',
          range: '[-127, 127]',
          original_range: '[-1, 1]'
        },
        text_removed: true,
        text_reconstruction: 'Use metadata.content to reconstruct text'
      },
      vectors: optimizedVectors
    };

    // 5. 압축된 JSON으로 저장 (공백 제거)
    console.log('💾 최적화된 파일 저장 중...');
    const outputPath = path.resolve(__dirname, CONFIG.OUTPUT_FILE);
    const optimizedJson = JSON.stringify(optimizedData); // 공백 제거
    await fs.writeFile(outputPath, optimizedJson, 'utf-8');

    const optimizedSize = Buffer.byteLength(optimizedJson, 'utf-8');
    const reductionPercent = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

    console.log(`\n✨ 최적화 완료!`);
    console.log(`   출력 파일: ${CONFIG.OUTPUT_FILE}`);
    console.log(`   원본 크기: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   최적화 후: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   용량 감소: ${reductionPercent}% (${((originalSize - optimizedSize) / 1024 / 1024).toFixed(2)} MB 절약)`);

    // 6. 테스트: 역양자화 정확도 검증
    console.log(`\n🧪 정확도 검증 중...`);
    const originalVec = data.vectors[0].vector;
    const quantizedVec = optimizedVectors[0].vector;
    const dequantizedVec = dequantizeVector(quantizedVec);

    // 코사인 유사도 계산
    const dotProduct = originalVec.reduce((sum, val, i) => sum + val * dequantizedVec[i], 0);
    const normA = Math.sqrt(originalVec.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(dequantizedVec.reduce((sum, val) => sum + val * val, 0));
    const similarity = dotProduct / (normA * normB);

    console.log(`   원본 vs 역양자화 유사도: ${(similarity * 100).toFixed(2)}%`);
    console.log(`   ${similarity > 0.95 ? '✅' : '⚠️'} 정확도 ${similarity > 0.95 ? '양호' : '주의 필요'} (목표: >95%)`);

    console.log(`\n📋 다음 단계:`);
    console.log(`   1. vectors.optimized.json을 테스트하세요`);
    console.log(`   2. 문제없으면 vectors.json을 교체하세요:`);
    console.log(`      mv public/data/vectors.json public/data/vectors.old.json`);
    console.log(`      mv public/data/vectors.optimized.json public/data/vectors.json`);
    console.log(`   3. ragService.js에 역양자화 로직 추가 필요`);

  } catch (error) {
    console.error('❌ 최적화 실패:', error.message);
    process.exit(1);
  }
}

// 실행
optimizeVectors();
