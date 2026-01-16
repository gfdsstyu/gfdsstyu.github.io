/**
 * @fileoverview HLR TensorFlow.js 학습 모듈
 * - On-Device Machine Learning with TensorFlow.js
 * - 선형 회귀 모델로 개인화된 HLR 가중치 학습
 * - Lazy Loading으로 성능 최적화
 */

import { buildHLRDataset } from './hlrDataset.js';
import { showToast } from '../../ui/domUtils.js';

/**
 * TensorFlow.js Lazy Loading
 * @returns {Promise<object>} TensorFlow.js 객체
 */
async function loadTensorFlow() {
  // 이미 로드된 경우
  if (window.tf) return window.tf;

  // 글로벌 로더가 있으면 사용
  if (window.loadTensorFlow) {
    return await window.loadTensorFlow();
  }

  // 직접 로드
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js';

    script.onload = () => {
      console.log('✅ [HLR ML] TensorFlow.js 로드 완료');
      resolve(window.tf);
    };

    script.onerror = () => {
      console.error('❌ [HLR ML] TensorFlow.js 로드 실패');
      reject(new Error('TensorFlow.js 로드 실패'));
    };

    document.head.appendChild(script);
  });
}

/**
 * HLR 모델 학습 (TensorFlow.js)
 * @param {boolean} silent - true면 토스트 메시지 없이 조용히 실행
 * @returns {Promise<object|null>} 학습된 가중치 또는 null
 */
export async function trainHLRModel(silent = false) {
  try {
    // 1. 데이터셋 빌드
    const records = buildHLRDataset();

    if (!records || records.length < 50) {
      if (!silent) {
        console.log(`[HLR ML] 데이터 부족 (${records?.length || 0}건, 최소 50건 필요)`);
      }
      return null;
    }

    if (!silent) {
      console.log(`[HLR ML] 학습 시작: ${records.length}건 데이터`);
    }

    // 2. TensorFlow.js Lazy Loading
    const tf = await loadTensorFlow();

    // 3. 피처 및 타겟 준비
    const featureKeys = [
      'bias', 'total_reviews', 'mean_score', 'last_score',
      'correct_count', 'incorrect_count', 'correct_ratio',
      'last_is_correct', 'time_since_first', 'first_solve_quality'
    ];

    const X = records.map(r => featureKeys.map(k => r.x[k] || 0));
    const y = records.map(r => r.y);

    // 4. Tensor 생성
    const xs = tf.tensor2d(X);
    const ys = tf.tensor2d(y, [y.length, 1]);

    // 5. 모델 생성 (선형 회귀)
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 1,
          inputShape: [featureKeys.length],
          useBias: false // bias는 피처에 포함되어 있음
        })
      ]
    });

    // 6. 컴파일
    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    // 7. 학습 (Epochs 50)
    await model.fit(xs, ys, {
      epochs: 50,
      verbose: 0, // 콘솔 출력 최소화
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (!silent && epoch % 10 === 0) {
            console.log(`[HLR ML] Epoch ${epoch + 1}/50 - Loss: ${logs.loss.toFixed(4)}`);
          }
        }
      }
    });

    // 8. 학습된 가중치 추출
    const weights = model.getWeights()[0]; // Dense layer weights
    const weightsArray = await weights.data();

    const learnedWeights = {};
    featureKeys.forEach((key, idx) => {
      learnedWeights[key] = weightsArray[idx];
    });

    // 9. 가중치 검증 (Safety Clamp)
    const isValid = validateLearnedWeights(learnedWeights);

    if (!isValid) {
      console.warn('[HLR ML] 학습된 가중치가 비정상적입니다. 저장하지 않습니다.');
      if (!silent) {
        showToast('HLR 학습 실패: 비정상적인 가중치', 'error');
      }

      // 텐서 정리
      xs.dispose();
      ys.dispose();
      model.dispose();

      return null;
    }

    // 10. localStorage 저장
    localStorage.setItem('hlr_learned_weights_v2', JSON.stringify(learnedWeights));

    // 학습 메타데이터 저장
    const metadata = {
      timestamp: Date.now(),
      dataCount: records.length,
      version: 2
    };
    localStorage.setItem('hlr_training_meta', JSON.stringify(metadata));

    if (!silent) {
      console.log('[HLR ML] 학습 완료 및 저장:', learnedWeights);
      showToast(`HLR AI 학습 완료 (${records.length}건)`, 'success');
    }

    // 텐서 정리 (메모리 누수 방지)
    xs.dispose();
    ys.dispose();
    model.dispose();

    return learnedWeights;
  } catch (error) {
    console.error('[HLR ML] 학습 실패:', error);
    if (!silent) {
      showToast('HLR 학습 실패', 'error');
    }
    return null;
  }
}

/**
 * 학습된 가중치 검증 (Safety Clamp)
 * @param {object} weights - 검증할 가중치
 * @returns {boolean} 유효성 여부
 */
function validateLearnedWeights(weights) {
  if (!weights || typeof weights !== 'object') {
    console.warn('[HLR ML] 가중치가 객체가 아닙니다');
    return false;
  }

  // bias 범위 체크
  if (weights.bias > 5.0 || weights.bias < -2.0) {
    console.warn(`[HLR ML] bias 범위 초과: ${weights.bias} (허용: -2.0 ~ 5.0)`);
    return false;
  }

  // incorrect_count는 반드시 음수여야 함 (오답은 페널티)
  if (weights.incorrect_count > 0) {
    console.warn(`[HLR ML] incorrect_count가 양수: ${weights.incorrect_count} (오답은 페널티여야 함)`);
    return false;
  }

  // correct_count는 양수여야 함 (정답은 보너스)
  if (weights.correct_count < 0) {
    console.warn(`[HLR ML] correct_count가 음수: ${weights.correct_count}`);
    return false;
  }

  // last_score는 양수여야 함
  if (weights.last_score < 0) {
    console.warn(`[HLR ML] last_score가 음수: ${weights.last_score}`);
    return false;
  }

  // 필수 키 존재 여부
  const requiredKeys = ['bias', 'total_reviews', 'last_score', 'incorrect_count'];
  for (const key of requiredKeys) {
    if (!(key in weights)) {
      console.warn(`[HLR ML] 필수 키 누락: ${key}`);
      return false;
    }
  }

  console.log('[HLR ML] 가중치 검증 통과');
  return true;
}

/**
 * 백그라운드에서 HLR 학습 실행 (requestIdleCallback 사용)
 * @param {boolean} force - true면 즉시 실행, false면 유휴 시간 대기
 */
export function trainHLRInBackground(force = false) {
  const trainTask = async () => {
    try {
      // 데이터 개수 확인
      const records = buildHLRDataset();
      if (!records || records.length < 50) {
        console.log(`[HLR ML] 백그라운드 학습 스킵: 데이터 부족 (${records?.length || 0}/50)`);
        return;
      }

      // 마지막 학습 이후 충분한 데이터가 추가되었는지 확인
      const meta = JSON.parse(localStorage.getItem('hlr_training_meta') || '{}');
      const lastDataCount = meta.dataCount || 0;
      const newDataCount = records.length;

      // 최소 10건 이상 추가되었을 때만 재학습
      if (newDataCount - lastDataCount < 10) {
        console.log(`[HLR ML] 백그라운드 학습 스킵: 신규 데이터 부족 (${newDataCount - lastDataCount}/10)`);
        return;
      }

      console.log(`[HLR ML] 백그라운드 학습 시작 (신규 데이터: ${newDataCount - lastDataCount}건)`);
      await trainHLRModel(true); // silent mode
      console.log('[HLR ML] 백그라운드 학습 완료');
    } catch (error) {
      console.error('[HLR ML] 백그라운드 학습 실패:', error);
    }
  };

  if (force) {
    // 즉시 실행
    trainTask();
  } else {
    // requestIdleCallback 사용 (유휴 시간에 실행)
    if ('requestIdleCallback' in window) {
      requestIdleCallback(trainTask, { timeout: 5000 });
    } else {
      // 폴백: setTimeout
      setTimeout(trainTask, 2000);
    }
  }
}

/**
 * 학습된 가중치 초기화 (디버깅용)
 */
export function clearLearnedWeights() {
  localStorage.removeItem('hlr_learned_weights_v2');
  localStorage.removeItem('hlr_training_meta');
  console.log('[HLR ML] 학습된 가중치 초기화 완료');
  showToast('HLR 학습 데이터 초기화', 'info');
}

/**
 * 학습 상태 확인
 * @returns {object} { hasWeights, dataCount, lastTrained }
 */
export function getTrainingStatus() {
  const weights = localStorage.getItem('hlr_learned_weights_v2');
  const meta = JSON.parse(localStorage.getItem('hlr_training_meta') || '{}');
  const records = buildHLRDataset();

  return {
    hasWeights: !!weights,
    dataCount: records?.length || 0,
    lastDataCount: meta.dataCount || 0,
    lastTrained: meta.timestamp || null,
    version: meta.version || 0
  };
}
