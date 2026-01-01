/**
 * @fileoverview 데이터 Import/Export - 백업, 가져오기, 병합 기능
 */

import {
  getElements,
  getQuestionScores,
  setQuestionScores,
  getGeminiApiKey,
  setGeminiApiKey,
  getSelectedAiModel,
  setSelectedAiModel,
  getDarkMode,
  setDarkMode
} from '../core/stateManager.js';
import { showToast, applyDarkMode } from '../ui/domUtils.js';
import { enforceExclusiveFlagsOnAll } from '../core/storageManager.js';
import { unlockAchievement } from '../features/achievements/achievementsCore.js';
import { getCurrentUser } from '../features/auth/authCore.js';

/**
 * 퀴즈 점수 데이터 병합
 * @param {Object} existing - 기존 questionScores 객체
 * @param {Object} imported - 가져온 questionScores 객체
 * @returns {Object} 병합된 questionScores 객체
 */
export function mergeQuizScores(existing, imported) {
  const result = { ...existing };

  for (const [qid, importedData] of Object.entries(imported)) {
    if (!result[qid]) {
      // 새로운 문제 ID - 그냥 추가
      result[qid] = importedData;
    } else {
      const existingData = result[qid];

      // 1. 날짜 비교 (백업본이 더 최신인가?)
      const isImportNewer = (importedData.lastSolvedDate || 0) > (existingData.lastSolvedDate || 0);

      // 2. 내용 존재 여부 확인 (trim()으로 공백만 있는 경우도 체크)
      const hasImportedAnswer = importedData.user_answer != null && String(importedData.user_answer).trim() !== '';
      const hasExistingAnswer = existingData.user_answer != null && String(existingData.user_answer).trim() !== '';

      const hasImportedFeedback = importedData.feedback != null && String(importedData.feedback).trim() !== '';
      const hasExistingFeedback = existingData.feedback != null && String(existingData.feedback).trim() !== '';

      // 3. 결정 로직 (핵심 수정 사항)
      // - 백업이 더 최신이면서 내용이 있을 때
      // - OR 기존 데이터가 비어있는데 백업에는 내용이 있을 때 (날짜 무관)
      // - 기존 데이터가 아예 없는 경우(!hasExistingAnswer)도 커버
      const shouldUseImportedAnswer = (isImportNewer && hasImportedAnswer) || (!hasExistingAnswer && hasImportedAnswer);
      const shouldUseImportedFeedback = (isImportNewer && hasImportedFeedback) || (!hasExistingFeedback && hasImportedFeedback);

      // 점수 등 메타데이터는 날짜가 최신인 쪽을 따름
      const useImportedMeta = isImportNewer;

      // solveHistory 병합 (날짜 기준 중복 제거)
      const combinedHistory = [
        ...(existingData.solveHistory || []),
        ...(importedData.solveHistory || [])
      ];
      const uniqueHistory = Array.from(
        new Map(combinedHistory.map(h => [h.date, h])).values()
      ).sort((a, b) => a.date - b.date);

      // 4. 복습 플래그 병합 로직
      // ⚠️ CRITICAL: OR 연산 사용하면 한 번 true가 되면 false로 되돌릴 수 없음!
      // 해결: Local(existing) 우선 정책 사용
      // - 이유: 사용자가 Local에서 변경한 것이 가장 최근 의도
      // - 단점: 다른 기기에서 변경한 내용은 무시됨 (대부분 단일 기기 사용으로 문제 없음)
      // - 향후 개선: flagModifiedDate 필드 추가하여 타임스탬프 기반 병합
      let mergedReviewFlag = !!existingData.userReviewFlag;
      let mergedReviewExclude = !!existingData.userReviewExclude;

      // 상호배타 검증 (제외 우선)
      if (mergedReviewFlag && mergedReviewExclude) {
        mergedReviewFlag = false;
      }

      result[qid] = {
        // 메타데이터는 최신 날짜 기준
        score: useImportedMeta ? (importedData.score || 0) : (existingData.score || 0),
        hintUsed: useImportedMeta ? importedData.hintUsed : existingData.hintUsed,
        isSolved: existingData.isSolved || importedData.isSolved,
        lastSolvedDate: Math.max(existingData.lastSolvedDate || 0, importedData.lastSolvedDate || 0),
        userReviewFlag: mergedReviewFlag,
        userReviewExclude: mergedReviewExclude,

        // 상세 내용은 '채워진 쪽'을 우선 (위에서 결정한 로직)
        feedback: shouldUseImportedFeedback ? importedData.feedback : existingData.feedback,
        user_answer: shouldUseImportedAnswer ? importedData.user_answer : existingData.user_answer,
        memoryTip: existingData.memoryTip || importedData.memoryTip, // 암기팁 보존 (로컬 우선)

        solveHistory: uniqueHistory
      };
    }
  }

  return result;
}

/**
 * Exam 데이터 수집 (모든 연도)
 */
function collectExamData() {
  const examData = {};
  const keys = Object.keys(localStorage);
  const examKeys = keys.filter(key => key.startsWith('exam_') && key.endsWith('_scores'));

  examKeys.forEach(key => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        examData[key] = JSON.parse(data);
      }
    } catch (error) {
      console.error(`Exam 데이터 수집 실패: ${key}`, error);
    }
  });

  return examData;
}

/**
 * KAM 데이터 수집
 */
function collectKamData() {
  const kamData = {
    scores: {},
    answers: {},
    feedbacks: {}
  };

  try {
    // KAM 점수
    const kamScores = localStorage.getItem('kam_scores');
    if (kamScores) {
      kamData.scores = JSON.parse(kamScores);
    }

    // KAM 답안 및 피드백 (개별 케이스)
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('kam_answer_')) {
        const data = localStorage.getItem(key);
        if (data) {
          kamData.answers[key] = JSON.parse(data);
        }
      } else if (key.startsWith('kam_feedback_')) {
        const data = localStorage.getItem(key);
        if (data) {
          kamData.feedbacks[key] = JSON.parse(data);
        }
      }
    });
  } catch (error) {
    console.error('KAM 데이터 수집 실패:', error);
  }

  return kamData;
}

/**
 * 데이터 내보내기 (백업 파일 생성)
 */
export function exportData() {
  try {
    const questionScores = getQuestionScores();
    const selectedAiModel = getSelectedAiModel();
    const darkMode = getDarkMode();
    const currentUser = getCurrentUser();

    const data = {
      version: '4.0',
      schemaVersion: +(localStorage.getItem('schemaVersion') || 2),
      exportDate: new Date().toISOString(),
      userId: currentUser?.uid || null,
      userEmail: currentUser?.email || null,
      auditQuizScores: questionScores,
      examData: collectExamData(),
      kamData: collectKamData(),
      geminiApiKey: localStorage.getItem('gemini_api_key') || '',
      aiModel: selectedAiModel,
      darkMode: darkMode
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gamlini_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Unlock data backup achievement
    unlockAchievement('data_backup_1');

    showToast('데이터 내보내기 완료 (Quiz + Exam + KAM)');
  } catch (err) {
    console.error(err);
    showToast('데이터 내보내기 실패', 'error');
  }
}

/**
 * Exam 데이터 복원
 */
function restoreExamData(examData) {
  if (!examData) return;

  try {
    Object.entries(examData).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
    console.log(`✅ Exam 데이터 복원 완료: ${Object.keys(examData).length}개 연도`);
  } catch (error) {
    console.error('Exam 데이터 복원 실패:', error);
  }
}

/**
 * KAM 데이터 복원
 */
function restoreKamData(kamData) {
  if (!kamData) return;

  try {
    // KAM 점수 복원
    if (kamData.scores && Object.keys(kamData.scores).length > 0) {
      localStorage.setItem('kam_scores', JSON.stringify(kamData.scores));
    }

    // KAM 답안 복원
    if (kamData.answers) {
      Object.entries(kamData.answers).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
    }

    // KAM 피드백 복원
    if (kamData.feedbacks) {
      Object.entries(kamData.feedbacks).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
    }

    console.log(`✅ KAM 데이터 복원 완료`);
  } catch (error) {
    console.error('KAM 데이터 복원 실패:', error);
  }
}

/**
 * 데이터 가져오기 (덮어쓰기)
 * @param {File} file - 백업 파일
 */
export function importData(file) {
  if (!file) return;

  const reader = new FileReader();
  const el = getElements();

  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);

      if (!data.auditQuizScores && !data.examData && !data.kamData) {
        throw new Error('올바른 백업 파일이 아닙니다.');
      }

      // 사용자 확인
      const currentUser = getCurrentUser();
      if (data.userId && currentUser?.uid && data.userId !== currentUser.uid) {
        const backupUserInfo = data.userEmail || data.userId;
        const currentUserInfo = currentUser.email || currentUser.uid;
        const confirmed = confirm(
          `⚠️ 다른 사용자의 백업 파일입니다.\n\n` +
          `백업 파일 사용자: ${backupUserInfo}\n` +
          `현재 로그인 사용자: ${currentUserInfo}\n\n` +
          `계속하면 현재 데이터가 모두 덮어씌워집니다.\n` +
          `정말 가져오시겠습니까?`
        );
        if (!confirmed) {
          showToast('데이터 가져오기 취소됨');
          return;
        }
      }

      // Quiz 점수 데이터 저장
      if (data.auditQuizScores) {
        localStorage.setItem('auditQuizScores', JSON.stringify(data.auditQuizScores));
        setQuestionScores(data.auditQuizScores);
      }

      // Exam 데이터 복원
      if (data.examData) {
        restoreExamData(data.examData);
      }

      // KAM 데이터 복원
      if (data.kamData) {
        restoreKamData(data.kamData);
      }

      // API 키 복원
      if (data.geminiApiKey) {
        localStorage.setItem('geminiApiKey', data.geminiApiKey);
        setGeminiApiKey(data.geminiApiKey);
      }

      // AI 모델 복원
      if (data.aiModel) {
        localStorage.setItem('aiModel', data.aiModel);
        setSelectedAiModel(data.aiModel);
        if (el.aiModelSelect) {
          el.aiModelSelect.value = data.aiModel;
        }
      }

      // 다크모드 복원
      if (data.darkMode) {
        localStorage.setItem('darkMode', data.darkMode);
        setDarkMode(data.darkMode);
        applyDarkMode();
      }

      // 스키마 버전 복원
      if (data.schemaVersion) {
        localStorage.setItem('schemaVersion', String(data.schemaVersion));
      }

      // 가져오자마자 상호배타 보정
      enforceExclusiveFlagsOnAll();

      showToast('데이터 가져오기 완료 (Quiz + Exam + KAM)');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      console.error(err);
      showToast(`가져오기 실패: ${err.message}`, 'error');
    }
  };

  reader.readAsText(file);
}

/**
 * Exam 데이터 병합 (연도별 점수 배열)
 * @param {Object} existing - 기존 examData (key: exam_YYYY_scores, value: array)
 * @param {Object} imported - 가져온 examData
 */
function mergeExamData(existing, imported) {
  if (!imported) return existing;

  const result = { ...existing };

  Object.entries(imported).forEach(([key, importedScores]) => {
    if (!result[key]) {
      // 새로운 연도 데이터 - 그냥 추가
      result[key] = importedScores;
    } else {
      // 기존 연도 데이터가 있음 - 배열 병합 (날짜 기준 중복 제거)
      const existingScores = result[key] || [];
      const combined = [...existingScores, ...importedScores];

      // 날짜 기준 중복 제거 (같은 날짜의 시도는 최신 것만 유지)
      const uniqueScores = Array.from(
        new Map(combined.map(score => [score.date || score.timestamp, score])).values()
      ).sort((a, b) => (b.date || b.timestamp || 0) - (a.date || a.timestamp || 0));

      result[key] = uniqueScores;
    }
  });

  return result;
}

/**
 * KAM 데이터 병합 (점수, 답안, 피드백)
 * @param {Object} existing - 기존 kamData
 * @param {Object} imported - 가져온 kamData
 */
function mergeKamData(existing, imported) {
  if (!imported) return existing;

  const result = {
    scores: { ...(existing.scores || {}) },
    answers: { ...(existing.answers || {}) },
    feedbacks: { ...(existing.feedbacks || {}) }
  };

  // 1. KAM 점수 병합 (높은 점수 유지)
  if (imported.scores) {
    Object.entries(imported.scores).forEach(([caseNum, importedScore]) => {
      const existingScore = result.scores[caseNum];
      if (!existingScore || (importedScore && importedScore > existingScore)) {
        result.scores[caseNum] = importedScore;
      }
    });
  }

  // 2. KAM 답안 병합 (최신 것 유지)
  if (imported.answers) {
    Object.entries(imported.answers).forEach(([key, importedAnswer]) => {
      const existingAnswer = result.answers[key];

      // 날짜 비교
      const importDate = importedAnswer?.timestamp || importedAnswer?.date || 0;
      const existDate = existingAnswer?.timestamp || existingAnswer?.date || 0;

      // 내용 존재 여부
      const hasImportedContent = importedAnswer?.userAnswer && String(importedAnswer.userAnswer).trim() !== '';
      const hasExistingContent = existingAnswer?.userAnswer && String(existingAnswer.userAnswer).trim() !== '';

      // 최신 것 또는 내용이 있는 것 우선
      const shouldUseImported = (importDate > existDate && hasImportedContent) || (!hasExistingContent && hasImportedContent);

      if (shouldUseImported) {
        result.answers[key] = importedAnswer;
      }
    });
  }

  // 3. KAM 피드백 병합 (최신 것 유지)
  if (imported.feedbacks) {
    Object.entries(imported.feedbacks).forEach(([key, importedFeedback]) => {
      const existingFeedback = result.feedbacks[key];

      // 날짜 비교
      const importDate = importedFeedback?.timestamp || importedFeedback?.date || 0;
      const existDate = existingFeedback?.timestamp || existingFeedback?.date || 0;

      // 내용 존재 여부
      const hasImportedContent = importedFeedback?.feedback && String(importedFeedback.feedback).trim() !== '';
      const hasExistingContent = existingFeedback?.feedback && String(existingFeedback.feedback).trim() !== '';

      // 최신 것 또는 내용이 있는 것 우선
      const shouldUseImported = (importDate > existDate && hasImportedContent) || (!hasExistingContent && hasImportedContent);

      if (shouldUseImported) {
        result.feedbacks[key] = importedFeedback;
      }
    });
  }

  return result;
}

/**
 * 데이터 병합 (기존 데이터 + 새 데이터)
 * @param {File} file - 백업 파일
 */
export function mergeData(file) {
  if (!file) return;

  const reader = new FileReader();
  const el = getElements();
  const questionScores = getQuestionScores();

  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);

      if (!data.auditQuizScores && !data.examData && !data.kamData) {
        throw new Error('올바른 백업 파일이 아닙니다.');
      }

      // 사용자 확인
      const currentUser = getCurrentUser();
      if (data.userId && currentUser?.uid && data.userId !== currentUser.uid) {
        const backupUserInfo = data.userEmail || data.userId;
        const currentUserInfo = currentUser.email || currentUser.uid;
        const confirmed = confirm(
          `⚠️ 다른 사용자의 백업 파일입니다.\n\n` +
          `백업 파일 사용자: ${backupUserInfo}\n` +
          `현재 로그인 사용자: ${currentUserInfo}\n\n` +
          `계속하면 두 사용자의 데이터가 병합됩니다.\n` +
          `정말 병합하시겠습니까?`
        );
        if (!confirmed) {
          showToast('데이터 병합 취소됨');
          return;
        }
      }

      // 1. Quiz 데이터 병합
      if (data.auditQuizScores) {
        const mergedScores = mergeQuizScores(questionScores, data.auditQuizScores);
        localStorage.setItem('auditQuizScores', JSON.stringify(mergedScores));
        setQuestionScores(mergedScores);
      }

      // 2. Exam 데이터 병합
      if (data.examData) {
        const existingExamData = collectExamData();
        const mergedExamData = mergeExamData(existingExamData, data.examData);

        // localStorage에 저장
        Object.entries(mergedExamData).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      }

      // 3. KAM 데이터 병합
      if (data.kamData) {
        const existingKamData = collectKamData();
        const mergedKamData = mergeKamData(existingKamData, data.kamData);

        // KAM 점수 저장
        if (mergedKamData.scores && Object.keys(mergedKamData.scores).length > 0) {
          localStorage.setItem('kam_scores', JSON.stringify(mergedKamData.scores));
        }

        // KAM 답안 저장
        Object.entries(mergedKamData.answers).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });

        // KAM 피드백 저장
        Object.entries(mergedKamData.feedbacks).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      }

      // 설정은 가져온 파일의 값으로 업데이트 (있는 경우)
      if (data.geminiApiKey) {
        localStorage.setItem('geminiApiKey', data.geminiApiKey);
        setGeminiApiKey(data.geminiApiKey);
      }

      if (data.aiModel) {
        localStorage.setItem('aiModel', data.aiModel);
        setSelectedAiModel(data.aiModel);
        if (el.aiModelSelect) {
          el.aiModelSelect.value = data.aiModel;
        }
      }

      if (data.darkMode) {
        localStorage.setItem('darkMode', data.darkMode);
        setDarkMode(data.darkMode);
        applyDarkMode();
      }

      if (data.schemaVersion) {
        localStorage.setItem('schemaVersion', String(data.schemaVersion));
      }

      // 병합 후 상호배타 보정
      enforceExclusiveFlagsOnAll();

      showToast('데이터 병합 완료 (Quiz + Exam + KAM)');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      console.error(err);
      showToast(`병합 실패: ${err.message}`, 'error');
    }
  };

  reader.readAsText(file);
}

/**
 * 데이터 Import/Export 이벤트 리스너 초기화
 */
export function initDataImportExport() {
  const el = getElements();

  // 데이터 내보내기 버튼
  el.exportDataBtn?.addEventListener('click', exportData);

  // 데이터 가져오기 버튼
  el.importDataBtn?.addEventListener('click', () => {
    el.importFileInput.click();
  });

  // 파일 선택 시 가져오기
  el.importFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    importData(file);
    e.target.value = ''; // 파일 입력 초기화
  });

  // 데이터 병합 버튼
  el.mergeDataBtn?.addEventListener('click', () => {
    el.mergeFileInput.click();
  });

  // 파일 선택 시 병합
  el.mergeFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    mergeData(file);
    e.target.value = ''; // 파일 입력 초기화
  });

  console.log('✅ DataImportExport 모듈 초기화 완료');
}
