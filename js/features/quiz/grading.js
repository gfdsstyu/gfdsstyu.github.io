// ============================================
// 감린이 v4.0 - 퀴즈 채점 및 힌트
// AI 채점, 힌트 생성, 결과 표시
// ============================================

import { clamp, normId } from '../../utils/helpers.js';
import { callGeminiAPI, callGeminiHintAPI, callGeminiTextAPI } from '../../services/geminiApi.js';
import { showToast } from '../../ui/domUtils.js';
import {
  getElements,
  getCurrentQuizData,
  getCurrentQuestionIndex,
  getQuestionScores,
  setQuestionScores,
  saveQuestionScores,
  getGeminiApiKey,
  getSelectedAiModel,
  getActiveHintQuestionKey,
  setActiveHintQuestionKey,
  getActiveMemoryTipQuestionKey,
  setActiveMemoryTipQuestionKey
} from '../../core/stateManager.js';
import { openApiModal } from '../settings/settingsCore.js';
import { updateSummary } from '../summary/summaryCore.js';
import { saveToLocal } from '../../core/storage.js';

// ============================================
// 로딩 상태 관리 (채점 버튼 전용)
// ============================================

/**
 * 채점 버튼 로딩 상태 설정
 * @param {boolean} isLoading - 로딩 여부
 */
export function setGradeLoading(isLoading) {
  const el = getElements();
  if (!el) return;

  if (isLoading) {
    el.gradeBtnText?.classList.add('hidden');
    el.gradeLoader?.classList.remove('hidden');
    if (el.gradeBtn) el.gradeBtn.disabled = true;
    el.resultBox?.classList.add('hidden');
  } else {
    el.gradeBtnText?.classList.remove('hidden');
    el.gradeLoader?.classList.add('hidden');
    if (el.gradeBtn) el.gradeBtn.disabled = false;
  }
}

// ============================================
// 결과 표시
// ============================================

/**
 * 채점 결과 표시
 * @param {number} scoreVal - 점수 (0-100)
 * @param {string} feedback - AI 피드백
 * @param {string} correctAnswer - 정답
 */
export function showResult(scoreVal, feedback, correctAnswer) {
  console.log('🎯 showResult 호출:', { scoreVal, feedback, correctAnswer: correctAnswer?.substring(0, 50) });

  const el = getElements();
  if (!el) {
    console.error('❌ showResult: el 없음!');
    return;
  }

  console.log('📦 el 상태:', {
    correctAnswer: !!el.correctAnswer,
    modelAnswerBox: !!el.modelAnswerBox,
    resultBox: !!el.resultBox
  });

  const s = clamp(+scoreVal, 0, 100);

  // 점수 표시
  if (el.score) el.score.textContent = s.toFixed(1);

  // 프로그레스 바
  if (el.progressBar) {
    el.progressBar.style.width = `${s}%`;
    el.progressBar.setAttribute('aria-valuenow', String(Math.round(s)));

    // 점수에 따른 색상
    const colorClass = s < 60
      ? 'bg-red-500'
      : s < 80
        ? 'bg-yellow-500'
        : 'bg-blue-600';

    el.progressBar.className = `h-4 rounded-full transition-all duration-500 ease-out ${colorClass}`;
  }

  // 피드백 및 정답 표시
  if (el.aiFeedback) {
    el.aiFeedback.textContent = String(feedback || '');
    console.log('✅ 피드백 설정');
  }

  if (el.correctAnswer) {
    const answerText = String(correctAnswer || '');
    el.correctAnswer.textContent = answerText;
    console.log('✅ 모범답안 설정:', answerText.length, '글자');
  } else {
    console.error('❌ el.correctAnswer 없음!');
  }

  // 결과 박스 및 모범답안 박스 표시
  el.resultBox?.classList.remove('hidden');
  console.log('✅ resultBox 표시');

  if (el.modelAnswerBox) {
    el.modelAnswerBox.classList.remove('hidden');
    console.log('✅ modelAnswerBox 표시, classes:', el.modelAnswerBox.className);
  } else {
    console.error('❌ el.modelAnswerBox 없음!');
  }
}

// ============================================
// 채점 처리
// ============================================

/**
 * 채점 처리 메인 함수
 * 사용자 답안을 AI로 채점하고 결과를 저장
 */
export async function handleGrade() {
  const el = getElements();
  if (!el) return;

  // API 키 확인
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.', 'error');
    return;
  }

  // 답안 확인
  const answer = el.userAnswer?.value.trim() || '';
  if (!answer) {
    if (el.errorMessage) {
      el.errorMessage.textContent = '답안을 입력해주세요.';
      el.errorMessage.classList.remove('hidden');
    }
    el.userAnswer?.focus();
    return;
  }

  // 에러 메시지 숨기기
  el.errorMessage?.classList.add('hidden');

  // 현재 문제 정보
  const currentQuizData = getCurrentQuizData();
  const currentQuestionIndex = getCurrentQuestionIndex();
  const q = currentQuizData[currentQuestionIndex];

  if (!q) {
    showToast('문제 정보를 찾을 수 없습니다.', 'error');
    return;
  }

  const qKey = normId(q.고유ID);

  // ⭐ 즉시 모범답안 표시 (AI 채점 대기 필요 없음)
  if (el.correctAnswer) {
    el.correctAnswer.textContent = String(q.정답 || '');
  }
  if (el.modelAnswerBox) {
    el.modelAnswerBox.classList.remove('hidden');
    console.log('✅ 모범답안 즉시 표시 (AI 채점 전)');
  }

  setGradeLoading(true);

  try {
    // AI 채점 요청
    let { score, feedback } = await callGeminiAPI(
      answer,
      q.정답,
      geminiApiKey,
      getSelectedAiModel()
    );

    // Lite 모델 감점
    const selectedAiModel = getSelectedAiModel();
    if (selectedAiModel === 'gemini-2.5-flash-lite') {
      score = clamp(score - 7, 0, 100);
    }

    // 힌트 사용 감점
    const activeHintQuestionKey = getActiveHintQuestionKey();
    const usedHint = (activeHintQuestionKey === qKey);

    // 암기팁 사용 감점
    const activeMemoryTipQuestionKey = getActiveMemoryTipQuestionKey();
    const usedMemoryTip = (activeMemoryTipQuestionKey === qKey);

    // 힌트와 암기팁 모두 사용 시 더 큰 감점 적용
    let finalScore = score;
    let deductionReason = '';

    if (usedHint && usedMemoryTip) {
      // 둘 다 사용: 0.6배 감점, 최대 59점
      finalScore = Math.min(59, Math.round(score * 0.6));
      deductionReason = '(힌트+암기팁 사용으로 감점)';
    } else if (usedHint) {
      // 힌트만 사용: 0.8배 감점, 최대 59점
      finalScore = Math.min(59, Math.round(score * 0.8));
      deductionReason = '(힌트사용으로 감점)';
    } else if (usedMemoryTip) {
      // 암기팁만 사용: 0.8배 감점, 최대 59점
      finalScore = Math.min(59, Math.round(score * 0.8));
      deductionReason = '(암기팁 사용으로 감점)';
    }

    const finalFeedback = deductionReason
      ? `${feedback ? feedback + ' ' : ''}${deductionReason}`
      : feedback;

    // 결과 표시
    showResult(finalScore, finalFeedback, q.정답);

    // 점수 저장
    const questionScores = getQuestionScores();
    const existing = questionScores[qKey] || {};
    const newHistory = [
      ...(existing.solveHistory || []),
      { date: Date.now(), score: finalScore }
    ];

    questionScores[qKey] = {
      score: finalScore,
      feedback: finalFeedback,
      user_answer: answer,
      hintUsed: usedHint,
      memoryTipUsed: usedMemoryTip,
      isSolved: true,
      lastSolvedDate: Date.now(),
      solveHistory: newHistory,
      userReviewFlag: !!existing.userReviewFlag,
      userReviewExclude: !!existing.userReviewExclude
    };

    // StateManager를 통한 점수 저장
    setQuestionScores(questionScores);

    // 상호배타 플래그 정합성 보정
    if (typeof window.enforceExclusiveFlagsOnAll === 'function') {
      window.enforceExclusiveFlagsOnAll();
    }

    // localStorage 저장
    try {
      saveQuestionScores();
    } catch {
      showToast('localStorage 저장 실패(용량)', 'error');
    }

    // 회독 등록
    if (typeof window.registerUniqueRead === 'function') {
      const { increased, uniqueReads } = window.registerUniqueRead(qKey);
      if (increased) {
        showToast(`회독 +1 (이 문제 고유 ${uniqueReads}회)`);
      }
    }

    // UI 업데이트
    updateSummary();
    if (typeof window.refreshPanels === 'function') {
      window.refreshPanels();
    }

    // 업적 확인 (UI 렌더링 완료 후 팝업 표시를 위해 약간 지연)
    if (typeof window.checkAchievements === 'function') {
      setTimeout(() => {
        window.checkAchievements();
      }, 150);
    }

  } catch (e) {
    console.error('채점 오류:', e);

    if (el.aiFeedback) el.aiFeedback.textContent = `채점 중 오류: ${e.message}`;
    if (el.score) el.score.textContent = 'Error';
    if (el.progressBar) el.progressBar.style.width = '0%';
    el.resultBox?.classList.remove('hidden');

    showToast('채점 요청 실패: API 키/네트워크/할당량 확인.', 'error');
  } finally {
    setGradeLoading(false);
  }
}

// ============================================
// 힌트 생성
// ============================================

/**
 * AI 힌트 생성 및 표시
 * @param {Object} q - 문제 객체
 */
export async function handleHint(q) {
  const el = getElements();
  if (!el) return;

  // API 키 확인
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.', 'error');
    return;
  }

  setGradeLoading(true);

  try {
    const userAnswer = el.userAnswer?.value.trim() || '';
    const hint = await callGeminiHintAPI(
      userAnswer,
      q.정답,
      q.물음,
      geminiApiKey
    );

    // 힌트 표시
    if (el.hintBox) {
      el.hintBox.innerHTML = `<strong class="font-semibold">힌트</strong><br>${String(hint || '').replace(/\n/g, '<br>')}`;
      el.hintBox.classList.remove('hidden');
    }

    // activeHintQuestionKey 설정
    const qKey = normId(q.고유ID);
    setActiveHintQuestionKey(qKey);

    showToast('힌트를 표시했습니다. (즉시 채점 시 감점)', 'warn');

  } catch (e) {
    console.error(e);
    showToast(`힌트 생성 실패: ${e.message}`, 'error');
  } finally {
    setGradeLoading(false);
  }
}

/**
 * 암기 팁 요청 및 표시
 * @param {Object} q - 문제 객체
 * @param {boolean} forceRegenerate - true이면 저장된 팁 무시하고 새로 생성
 */
export async function handleMemoryTip(q, forceRegenerate = false) {
  const el = getElements();
  if (!el) return;

  const qKey = normId(q.고유ID);

  // 1순위: questionScores에 저장된 팁 불러오기 (forceRegenerate가 아닐 때만)
  if (!forceRegenerate) {
    const questionScores = getQuestionScores();
    const savedTip = questionScores[qKey]?.memoryTip;

    if (savedTip) {
      // 저장된 팁이 있으면 표시
      if (el.memoryTipContent) {
        el.memoryTipContent.textContent = savedTip;
      }
      if (el.memoryTipContainer) {
        el.memoryTipContainer.classList.remove('hidden');
      }

      // activeMemoryTipQuestionKey 설정 (감점 처리용)
      setActiveMemoryTipQuestionKey(qKey);

      showToast('저장된 암기 팁을 불러왔습니다! 💡 (즉시 채점 시 감점)', 'warn');
      return;
    }
  }

  // 2순위: Gemini API 호출하여 새로 생성
  // API 키 확인
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.', 'error');
    return;
  }

  setGradeLoading(true);

  try {
    // 유연한 암기 팁 프롬프트 (analysis.js와 동일)
    const prompt = `[역할]
당신은 회계감사 2차 시험을 준비하는 학생의 암기 코치입니다.
아래 문제와 정답을 보고, 학생이 쉽게 기억할 수 있도록 **유연한 암기 팁**을 제공하세요.

[암기 기법 옵션 - 자유롭게 선택]
1. **두문자 암기법**: 핵심 단어의 첫 글자를 조합. 익살스러워서 기억에 남으면 좋음. 선정적이거나 자극적이어도 좋음. (예: "감사증거의 충분성과 적합성" → "충·적")
2. **시각적 연상**: 개념을 이미지나 장면으로 비유. 자극 강렬 황당 기괴하여도 기억에만 잘 남으면 좋음. (예: "내부통제는 회사의 면역 체계")
3. **실무 예시**: 실제 업무 상황으로 설명 (예: "재고조사는 창고에서 직접 세는 것")
4. **비교 대조**: 유사 개념과 차이점 강조 (예: "직접확인 vs 간접확인")
5. **어원/유래**: 용어의 어원이나 영어 원문 활용 (예: "materiality = 중요성")
6. **스토리텔링**: 개념을 짧은 이야기로 연결. 경선식 스타일처럼 익살스럽고 웃기거나 충격적이거나 선정적이거나 자극적이어도 좋음.
7. **기타 창의적 방법**: 위 기법에 국한되지 않고, 해당 내용에 가장 잘 맞는 방법 자유 선택

[중요 원칙]
- **유연성**: 위 기법 중 1-2개만 선택하거나, 여러 개를 혼합해도 좋습니다. 하지만 1. 두문자를 제시하는 것이 다수의 학생들이 사용하는 방식이니 먼저 고려해주세요.
- **간결성**: 2-5줄 이내로 핵심만 전달
- **실용성**: 실제 시험장에서 떠올리기 쉬운 팁 제공
- **완전성**: 개념의 핵심을 왜곡하지 말고 모든 항목을 포함할것. 예를들어 번호 1~4까지 있다면 4항목을 모두 포함하시오.

[문제]
${q.물음}

[정답]
${q.정답}

[요청]
위 정답을 외우기 쉽게 만드는 암기 팁을 2-4줄로 제공하세요.
가장 효과적인 기법을 자유롭게 선택하고, 간결하게 작성하세요.`;

    const response = await callGeminiTextAPI(prompt, geminiApiKey);

    // questionScores에 저장
    const questionScores = getQuestionScores();
    if (!questionScores[qKey]) {
      questionScores[qKey] = {};
    }
    questionScores[qKey].memoryTip = response;
    saveToLocal(); // localStorage에 저장

    // 결과 표시
    if (el.memoryTipContent) {
      el.memoryTipContent.textContent = response;
    }
    if (el.memoryTipContainer) {
      el.memoryTipContainer.classList.remove('hidden');
    }

    // activeMemoryTipQuestionKey 설정 (감점 처리용)
    setActiveMemoryTipQuestionKey(qKey);

    showToast(forceRegenerate ?
      '암기 팁을 새로 생성했습니다! 💡 (즉시 채점 시 감점)' :
      '암기 팁이 생성되었습니다! 💡 (즉시 채점 시 감점)',
      'warn');

  } catch (e) {
    console.error('암기 팁 생성 오류:', e);
    showToast(`암기 팁 생성 실패: ${e.message}`, 'error');
  } finally {
    setGradeLoading(false);
  }
}
