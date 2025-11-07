// ============================================
// 감린이 v4.0 - 퀴즈 채점 및 힌트
// AI 채점, 힌트 생성, 결과 표시
// ============================================

import { clamp, normId } from '../../utils/helpers.js';
import { callGeminiAPI, callGeminiHintAPI } from '../../services/geminiApi.js';
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
  setActiveHintQuestionKey
} from '../../core/stateManager.js';

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
  const el = getElements();
  if (!el) return;

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
  if (el.aiFeedback) el.aiFeedback.textContent = String(feedback || '');
  if (el.correctAnswer) el.correctAnswer.textContent = String(correctAnswer || '');

  // 결과 박스 및 모범답안 박스 표시
  el.resultBox?.classList.remove('hidden');
  el.modelAnswerBox?.classList.remove('hidden');
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
    if (typeof window.openApiModal === 'function') {
      window.openApiModal(false);
    }
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
    const finalScore = usedHint
      ? Math.min(59, Math.round(score * 0.8))
      : score;
    const finalFeedback = usedHint
      ? `${feedback ? feedback + ' ' : ''}(힌트사용으로 감점)`
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
    if (typeof window.updateSummary === 'function') {
      window.updateSummary();
    }
    if (typeof window.refreshPanels === 'function') {
      window.refreshPanels();
    }

    // 업적 확인
    if (typeof window.checkAchievements === 'function') {
      window.checkAchievements();
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
    if (typeof window.openApiModal === 'function') {
      window.openApiModal(false);
    }
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
