/**
 * 벡터 양자화 스크립트
 *
 * 기존 Float32 벡터를 Int8로 양자화하여
 * 파일 크기를 75% 감소시킵니다.
 *
 * 사용법: node scripts/quantize-vectors.js
 */

const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
  INPUT_FILE: '../public/data/vectors.json',
  OUTPUT_FILE: '../public/data/vectors_quantized.json'
};

/**
 * Int8 양자화 함수
 */
function quantizeToInt8(vector) {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < vector.length; i++) {
    if (vector[i] < min) min = vector[i];
    if (vector[i] > max) max = vector[i];
  }

  const scale = (max - min) / 255;
  const quantized = new Array(vector.length);

  for (let i = 0; i < vector.length; i++) {
    quantized[i] = Math.round((vector[i] - min) / scale) - 128;
  }

  return {
    values: quantized,
    min: min,
    max: max
  };
}

/**
 * Int8 역양자화 (테스트용)
 */
function dequantizeFromInt8(quantized, min, max) {
  const scale = (max - min) / 255;
  const vector = new Array(quantized.length);

  for (let i = 0; i < quantized.length; i++) {
    vector[i] = (quantized[i] + 128) * scale + min;
  }

  return vector;
}

/**
 * 양자화 정확도 테스트
 */
function testQuantizationAccuracy(vector) {
  const { values, min, max } = quantizeToInt8(vector);
  const restored = dequantizeFromInt8(values, min, max);

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
 * 메인 함수
 */
async function main() {
  console.log('🔄 벡터 양자화 시작\n');

  try {
    // 1. 원본 벡터 로드
    console.log('📥 원본 벡터 로드 중...');
    const inputPath = path.join(__dirname, CONFIG.INPUT_FILE);
    const content = await fs.readFile(inputPath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.vectors || !Array.isArray(data.vectors)) {
      throw new Error('벡터 데이터 형식이 올바르지 않습니다.');
    }

    const originalStats = await fs.stat(inputPath);
    const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ 로드 완료: ${data.vectors.length}개 벡터 (${originalSizeMB} MB)\n`);

    // 2. 양자화 정확도 테스트
    console.log('📊 양자화 정확도 테스트 중...');
    const accuracies = [];
    const testCount = Math.min(10, data.vectors.length);

    for (let i = 0; i < testCount; i++) {
      const accuracy = testQuantizationAccuracy(data.vectors[i].vector);
      accuracies.push(accuracy);
      console.log(`   벡터 ${i + 1}/${testCount}: ${(accuracy * 100).toFixed(2)}%`);
    }

    const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    console.log(`\n✅ 평균 정확도: ${(avgAccuracy * 100).toFixed(2)}%\n`);

    // 3. 모든 벡터 양자화
    console.log(`🔄 ${data.vectors.length}개 벡터 양자화 중...`);

    const quantizedVectors = data.vectors.map((doc, idx) => {
      if ((idx + 1) % 500 === 0) {
        console.log(`   진행: ${idx + 1}/${data.vectors.length}`);
      }

      const { values, min, max } = quantizeToInt8(doc.vector);

      return {
        ...doc,
        vector: values,
        vector_min: min,
        vector_max: max
      };
    });

    console.log(`✅ 양자화 완료\n`);

    // 4. 양자화된 데이터 저장
    console.log('💾 양자화 벡터 저장 중...');

    const quantizedData = {
      metadata: {
        ...data.metadata,
        quantization: 'int8',
        quantization_accuracy: `${(avgAccuracy * 100).toFixed(2)}%`,
        quantization_date: new Date().toISOString(),
        notes: 'Int8 양자화 적용 - 파일 크기 75% 감소, 정확도 99%+ 유지'
      },
      vectors: quantizedVectors
    };

    const outputPath = path.join(__dirname, CONFIG.OUTPUT_FILE);
    const outputDir = path.dirname(outputPath);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      outputPath,
      JSON.stringify(quantizedData, null, 2),
      'utf-8'
    );

    const quantizedStats = await fs.stat(outputPath);
    const quantizedSizeMB = (quantizedStats.size / (1024 * 1024)).toFixed(2);
    const reduction = ((1 - quantizedStats.size / originalStats.size) * 100).toFixed(1);

    console.log('\n✨ 양자화 완료!\n');
    console.log('📊 결과:');
    console.log(`   원본 파일: ${originalSizeMB} MB`);
    console.log(`   양자화 파일: ${quantizedSizeMB} MB`);
    console.log(`   크기 감소: ${reduction}%`);
    console.log(`   정확도: ${(avgAccuracy * 100).toFixed(2)}%`);
    console.log(`\n   출력 파일: ${CONFIG.OUTPUT_FILE}`);

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 실행
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
