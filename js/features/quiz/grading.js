// ============================================
// 감린이 v4.0 - 퀴즈 채점 및 힌트
// AI 채점, 힌트 생성, 결과 표시
// ============================================

import { clamp, normId } from '../../utils/helpers.js';
import { callGeminiAPI, callGeminiHintAPI, callGeminiTipAPI } from '../../services/geminiApi.js';
import { showToast } from '../../ui/domUtils.js';
import { createMemoryTipPrompt } from '../../config/config.js';
import { getCurrentUser } from '../auth/authCore.js';
import { syncToFirestore } from '../sync/syncCore.js';
import { updateUserStats, updateGroupStats } from '../ranking/rankingCore.js';
import { getMyGroups } from '../group/groupCore.js';
import { updateUniversityStats } from '../university/universityCore.js';
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
  setActiveMemoryTipQuestionKey,
  getActiveMemoQuestionKey,
  getMemoryTipMode
} from '../../core/stateManager.js';
import { openApiModal } from '../settings/settingsCore.js';
import { updateSummary } from '../summary/summaryCore.js';

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

    // 메모 열람 여부 확인
    const activeMemoQuestionKey = getActiveMemoQuestionKey();
    const usedMemo = (activeMemoQuestionKey === qKey);

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

    // 메모 열람 시 점수 상한 60점 적용
    if (usedMemo) {
      if (finalScore > 60) {
        finalScore = 60;
        deductionReason += deductionReason ? ' (메모 열람으로 60점 제한)' : '(메모 열람으로 60점 제한)';
      }
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
      userReviewExclude: !!existing.userReviewExclude,
      memoryTip: existing.memoryTip // 암기팁 보존
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

    // Firestore 동기화 (Phase 2)
    const currentUser = getCurrentUser();
    console.log('🔄 [Grading] Firestore 동기화 시도...');
    console.log('   - 로그인 상태:', currentUser ? `✅ ${currentUser.email}` : '❌ 로그아웃');

    if (currentUser) {
      console.log('   - 동기화 시작:', currentUser.uid, '문제 ID:', qKey);
      // 🆕 specificQid(qKey) 전달하여 상세 데이터를 서브컬렉션에 저장
      syncToFirestore(currentUser.uid, qKey)
        .then(result => {
          if (result.success) {
            console.log('   - ✅ Firestore 동기화 성공:', result.message);
          } else {
            console.error('   - ❌ Firestore 동기화 실패:', result.message);
          }
        })
        .catch(err => {
          console.error('   - ❌ Firestore 동기화 에러:', err);
        });
    } else {
      console.log('   - ⏭️ 로그아웃 상태 - Firestore 동기화 스킵');
    }

    // Phase 3.2: 랭킹 통계 업데이트
    if (currentUser) {
      console.log('📊 [Grading] 랭킹 통계 업데이트 시작...');
      updateUserStats(currentUser.uid, finalScore)
        .then(result => {
          if (result.success) {
            console.log('   - ✅ 랭킹 통계 업데이트 성공');
          } else {
            console.warn('   - ⚠️ 랭킹 통계 업데이트 실패:', result.message);
          }
        })
        .catch(err => {
          console.error('   - ❌ 랭킹 통계 업데이트 에러:', err);
        });

      // Phase 3.5.3: 그룹 랭킹 통계 업데이트
      console.log('📊 [Grading] 그룹 랭킹 통계 업데이트 시작...');
      getMyGroups()
        .then(groups => {
          if (groups && groups.length > 0) {
            console.log(`   - 📋 ${groups.length}개 그룹 발견`);
            // 모든 그룹에 대해 통계 업데이트
            groups.forEach(group => {
              updateGroupStats(group.groupId, currentUser.uid, finalScore)
                .then(result => {
                  if (result.success) {
                    console.log(`   - ✅ 그룹 "${group.name}" 통계 업데이트 성공`);
                  } else {
                    console.warn(`   - ⚠️ 그룹 "${group.name}" 통계 업데이트 실패:`, result.message);
                  }
                })
                .catch(err => {
                  console.error(`   - ❌ 그룹 "${group.name}" 통계 업데이트 에러:`, err);
                });
            });
          } else {
            console.log('   - ℹ️ 가입한 그룹이 없습니다.');
          }
        })
        .catch(err => {
          console.error('   - ❌ 그룹 목록 조회 에러:', err);
        });

      // Phase 3.6: 대학교 랭킹 통계 업데이트
      console.log('🎓 [Grading] 대학교 랭킹 통계 업데이트 시작...');
      updateUniversityStats(currentUser.uid, finalScore)
        .then(result => {
          if (result.success) {
            console.log('   - ✅ 대학교 통계 업데이트 성공');
          } else {
            console.log(`   - ℹ️ 대학교 통계 업데이트: ${result.message}`);
          }
        })
        .catch(err => {
          console.error('   - ❌ 대학교 통계 업데이트 에러:', err);
        });
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
    // 사용자 메모 가져오기
    const questionScores = getQuestionScores();
    const userMemo = questionScores[qKey]?.userMemo || '';

    // config.js의 통합 프롬프트 템플릿 사용 (사용자 설정 모드 + 사용자 메모 반영)
    const mode = getMemoryTipMode();
    let prompt = createMemoryTipPrompt(q.물음, q.정답, mode, userMemo);
    let response;

    try {
      response = await callGeminiTipAPI(prompt, geminiApiKey);
    } catch (apiErr) {
      // MAX_TOKENS 에러 시 더 짧은 버전으로 재시도
      if (apiErr.message && (apiErr.message.includes('프롬프트 길이 초과') || apiErr.message.includes('생성 토큰 제한'))) {
        console.warn('⚠️ 프롬프트가 너무 깁니다. 메모 없이 재시도합니다...');
        // 메모 없이 재시도
        prompt = createMemoryTipPrompt(q.물음, q.정답, mode, '');
        response = await callGeminiTipAPI(prompt, geminiApiKey);
        showToast('프롬프트가 길어 메모 없이 생성되었습니다', 'warn');
      } else {
        throw apiErr;
      }
    }

    // questionScores에 저장 (기존 데이터와 병합)
    if (!questionScores[qKey]) {
      questionScores[qKey] = {
        solveHistory: [],  // 빈 배열로 초기화 (0회독 상태)
        isSolved: false
      };
    }
    questionScores[qKey].memoryTip = response;
    setQuestionScores(questionScores);
    saveQuestionScores(); // localStorage에 저장

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

    // 503 Service Unavailable 에러는 조용히 실패 (서버 과부하)
    if (e.message && e.message.includes('503')) {
      console.warn('⚠️ Gemini API 서버 과부하 (503) - 암기 팁 생성 스킵');
      // 토스트 표시 안 함
    } else {
      // 다른 에러는 사용자에게 알림
      showToast(`암기 팁 생성 실패: ${e.message}`, 'error');
    }
  } finally {
    setGradeLoading(false);
  }
}
