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
      // 기존 문제 ID - 병합 (최신 풀이 데이터 우선)
      const existingData = result[qid];
      const useImported = (importedData.lastSolvedDate || 0) > (existingData.lastSolvedDate || 0);

      // solveHistory 병합 (날짜 기준 중복 제거)
      const combinedHistory = [
        ...(existingData.solveHistory || []),
        ...(importedData.solveHistory || [])
      ];
      const uniqueHistory = Array.from(
        new Map(combinedHistory.map(h => [h.date, h])).values()
      ).sort((a, b) => a.date - b.date);

      result[qid] = {
        score: useImported ? (importedData.score || 0) : (existingData.score || 0),
        feedback: useImported ? importedData.feedback : existingData.feedback,
        user_answer: useImported ? importedData.user_answer : existingData.user_answer,
        hintUsed: useImported ? importedData.hintUsed : existingData.hintUsed,
        isSolved: existingData.isSolved || importedData.isSolved,
        lastSolvedDate: Math.max(existingData.lastSolvedDate || 0, importedData.lastSolvedDate || 0),
        solveHistory: uniqueHistory,
        userReviewFlag: existingData.userReviewFlag || importedData.userReviewFlag,
        userReviewExclude: existingData.userReviewExclude || importedData.userReviewExclude
      };
    }
  }

  return result;
}

/**
 * 데이터 내보내기 (백업 파일 생성)
 */
export function exportData() {
  try {
    const questionScores = getQuestionScores();
    const selectedAiModel = getSelectedAiModel();
    const darkMode = getDarkMode();

    const data = {
      version: '3.x',
      schemaVersion: +(localStorage.getItem('schemaVersion') || 2),
      exportDate: new Date().toISOString(),
      auditQuizScores: questionScores,
      geminiApiKey: localStorage.getItem('geminiApiKey') || '',
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

    showToast('데이터 내보내기 완료');
  } catch (err) {
    console.error(err);
    showToast('데이터 내보내기 실패', 'error');
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

      if (!data.auditQuizScores) {
        throw new Error('올바른 백업 파일이 아닙니다.');
      }

      // 점수 데이터 저장
      localStorage.setItem('auditQuizScores', JSON.stringify(data.auditQuizScores));
      setQuestionScores(data.auditQuizScores);

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

      showToast('데이터 가져오기 완료');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      console.error(err);
      showToast(`가져오기 실패: ${err.message}`, 'error');
    }
  };

  reader.readAsText(file);
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

      if (!data.auditQuizScores) {
        throw new Error('올바른 백업 파일이 아닙니다.');
      }

      // 기존 데이터와 병합
      const mergedScores = mergeQuizScores(questionScores, data.auditQuizScores);
      localStorage.setItem('auditQuizScores', JSON.stringify(mergedScores));
      setQuestionScores(mergedScores);

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

      showToast('데이터 병합 완료');
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
