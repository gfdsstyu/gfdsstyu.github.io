/**
 * @fileoverview 업적 시스템 핵심 기능
 * - 업적 달성 및 저장
 * - 업적 알림 표시
 * - 업적 모달 관리
 */

import { el } from '../../ui/elements.js';
import { showToast } from '../../ui/domUtils.js';
import { ACHIEVEMENTS, ACHIEVEMENTS_LS_KEY, AUDIT_FLOW_MAP } from '../../config/config.js';
import { normId } from '../../utils/helpers.js';
import { getCurrentUser } from '../auth/authCore.js';
import { syncAchievementsToFirestore } from '../sync/syncCore.js';
import { getTotalUniqueReads, getUniqueReadCount } from '../../core/storageManager.js';

// Module state
let achievementsData = {};
let featuredAchievementId = null; // 대표 업적 ID

/**
 * Load achievements from localStorage
 */
export function loadAchievements() {
  const stored = localStorage.getItem(ACHIEVEMENTS_LS_KEY);
  if (stored) {
    try {
      achievementsData = JSON.parse(stored);
    } catch {}
  }
}

/**
 * Save achievements to localStorage
 */
export function saveAchievements() {
  try {
    localStorage.setItem(ACHIEVEMENTS_LS_KEY, JSON.stringify(achievementsData));
  } catch {}
}

/**
 * Set featured achievement
 * @param {string} achievementId - Achievement ID to feature
 */
export async function setFeaturedAchievement(achievementId) {
  // Check if achievement is unlocked
  if (!achievementsData[achievementId]) {
    showToast('잠금 해제된 업적만 대표로 설정할 수 있습니다.', 'warn');
    return { success: false };
  }

  featuredAchievementId = achievementId;
  localStorage.setItem('featuredAchievement', achievementId);

  // Sync to Firestore
  const currentUser = getCurrentUser();
  if (currentUser) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
      const { db } = await import('../../app.js');

      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        'profile.featuredAchievement': achievementId
      });

      const achievement = ACHIEVEMENTS[achievementId];
      showToast(`대표 업적: ${achievement.icon} ${achievement.name}`, 'success');

      return { success: true };
    } catch (error) {
      console.error('❌ [Achievements] 대표 업적 Firestore 저장 실패:', error);
      showToast('대표 업적 저장에 실패했습니다.', 'error');
      return { success: false };
    }
  }

  return { success: true };
}

/**
 * Load featured achievement
 */
export function loadFeaturedAchievement() {
  const stored = localStorage.getItem('featuredAchievement');
  if (stored) {
    featuredAchievementId = stored;
  }
}

/**
 * Get featured achievement
 * @returns {Object|null} Featured achievement object or null
 */
export function getFeaturedAchievement() {
  if (!featuredAchievementId) return null;
  return ACHIEVEMENTS[featuredAchievementId] || null;
}

/**
 * Get featured achievement ID
 * @returns {string|null}
 */
export function getFeaturedAchievementId() {
  return featuredAchievementId;
}

/**
 * Unlock an achievement
 * @param {string} achievementId - Achievement ID
 */
export function unlockAchievement(achievementId) {
  if (achievementsData[achievementId]) return; // Already unlocked

  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return;

  achievementsData[achievementId] = {
    unlockedAt: Date.now(),
    seen: false
  };

  saveAchievements();

  // Show notification
  showAchievementNotification(achievement);

  // Update badge
  updateAchievementBadge();

  // Sync to Firestore (Phase 2.5: Option C)
  const currentUser = getCurrentUser();
  if (currentUser) {
    console.log(`🏆 [Achievements] 업적 "${achievement.name}" 달성 - Firestore 동기화 시작`);
    syncAchievementsToFirestore(currentUser.uid)
      .then(result => {
        if (result.success) {
          console.log(`✅ [Achievements] Firestore 동기화 성공: ${result.message}`);
        } else {
          console.warn(`⚠️ [Achievements] Firestore 동기화 실패: ${result.message}`);
        }
      })
      .catch(error => {
        console.error(`❌ [Achievements] Firestore 동기화 에러:`, error);
      });
  } else {
    console.log('⚠️ [Achievements] 로그아웃 상태 - Firestore 동기화 스킵');
  }
}

/**
 * Show achievement notification popup
 * @param {Object} achievement - Achievement object
 */
export function showAchievementNotification(achievement) {
  console.log('🎉 업적 팝업 표시:', achievement.name, achievement.desc);

  const tierColors = {
    bronze: 'from-amber-500 to-yellow-600',
    silver: 'from-gray-400 to-gray-500',
    gold: 'from-yellow-400 to-amber-500',
    hidden: 'from-purple-500 to-pink-600'
  };

  const notification = document.createElement('div');
  notification.className = `fixed top-20 right-4 bg-gradient-to-r ${tierColors[achievement.tier]} text-white px-6 py-4 rounded-lg shadow-2xl animate-bounce`;
  notification.style.zIndex = '99999'; // 최상단 보장
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-3xl">${achievement.icon}</span>
      <div>
        <div class="font-bold">업적 달성!</div>
        <div class="text-sm">${achievement.name}</div>
        <div class="text-xs opacity-90">${achievement.desc}</div>
      </div>
    </div>
  `;

  document.body.appendChild(notification);
  console.log('✅ 팝업 DOM 추가 완료 (4초간 표시)');

  setTimeout(() => {
    notification.classList.remove('animate-bounce');
    notification.classList.add('opacity-0', 'transition-opacity');
    setTimeout(() => {
      notification.remove();
      console.log('✅ 팝업 제거 완료');
    }, 500);
  }, 4000);
}

/**
 * Update achievement badge (red dot indicator)
 */
export function updateAchievementBadge() {
  const unseenCount = Object.keys(achievementsData).filter(id => !achievementsData[id].seen).length;
  const badge = document.getElementById('new-achievement-badge');
  if (badge) {
    if (unseenCount > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

/**
 * Check all achievements
 */
export function checkAchievements() {
  // Use window object to access global state (NEVER import from stateManager)
  const questionScores = window.questionScores || {};
  const allData = window.allData || [];

  // Check first problem
  if (Object.keys(questionScores).length >= 1) {
    unlockAchievement('first_problem');
  }

  // Check score achievements
  const scores = Object.values(questionScores).map(s => s.score).filter(s => s !== undefined);
  if (scores.length > 0) {
    const maxScore = Math.max(...scores);
    if (maxScore >= 80) unlockAchievement('first_80');
    if (maxScore >= 90) unlockAchievement('first_90');
    if (maxScore === 100) unlockAchievement('first_100');
  }

  // Check problem count (누적 풀이 횟수 기반 - Achievement System 2.0)
  // 기존: 고유 문제 수 (Object.keys().length)
  // 변경: 누적 고유 회독수 (5분 윈도우 기반)
  const totalSolveCount = getTotalUniqueReads(questionScores);

  if (totalSolveCount >= 100) unlockAchievement('problems_100');
  if (totalSolveCount >= 300) unlockAchievement('problems_300');
  if (totalSolveCount >= 1000) unlockAchievement('problems_1000');
  if (totalSolveCount >= 3000) unlockAchievement('problems_3000');
  if (totalSolveCount >= 5000) unlockAchievement('problems_5000');
  if (totalSolveCount >= 10000) unlockAchievement('problems_10000');

  // Check average score
  if (scores.length > 0) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // avg_80: 평균 80점 이상 (조건 없음)
    if (avgScore >= 80) unlockAchievement('avg_80');

    // avg_90 (예비 회계사): 기본문제(H, S, HS) 전부 풀이 + 평균 90점 이상
    if (avgScore >= 90) {
      const basicSources = allData.filter(q => ['H', 'S', 'HS'].includes(q.출처));
      const basicSolved = basicSources.filter(q => questionScores[normId(q.고유ID)]);
      if (basicSources.length > 0 && basicSolved.length === basicSources.length) {
        unlockAchievement('avg_90');
      }
    }

    // avg_92 (예비 회계사 - Platinum): 평균 92점 이상
    if (avgScore >= 92) {
      unlockAchievement('avg_92');
    }

    // avg_95 (기준서 프린터): 모든 문제 전부 풀이 + 평균 95점 이상
    if (avgScore >= 95) {
      const allProblemsSolved = allData.length > 0 && allData.every(q => questionScores[normId(q.고유ID)]);
      if (allProblemsSolved) {
        unlockAchievement('avg_95');
      }
    }
  }

  // Check platinum_mastery & diamond_perfect
  checkPlatinumMastery();
  checkDiamondPerfect();

  // Check streaks
  checkStreakAchievements();

  // Check daily/weekly/monthly goals
  checkVolumeAchievements();

  // Check source-based achievements
  checkSourceAchievements();

  // Check flag-based achievements
  const flagCount = Object.values(questionScores).filter(s => s.userReviewFlag && !s.userReviewExclude).length;
  if (flagCount >= 20) unlockAchievement('flagged_20');
  if (flagCount >= 50) unlockAchievement('flagged_50');

  // Check comeback achievement
  checkComeback();

  // Check perfect day
  checkPerfectDay();

  // Check chapter master
  checkChapterMaster();

  // Check time-based achievements
  checkTimeBased();

  // Check chapter-specific achievements
  checkChapter1stCompletionPerChapter();
  checkChapterMasteryPerChapter();

  // Check all chapter mastery
  checkAllChapterMastery();

  // Check N회독 (Rotation) achievements - Achievement System 2.0
  checkRotationAchievements();

  // Check flashcard navigation achievements
  checkFlashcardAchievements();

  // Check new achievements
  checkRetrySameDay();
  checkExplorer();
  checkPerfectionist();
  checkWeekendWarrior();
  checkRapidGrowth();
  checkFlowLearner();
  checkReviewKing();
  checkLegendaryStart();
  checkConsistencyMaster();
  checkComebackMaster();
  checkLucky777();
  checkExtremePerfectionist();
  checkFullCourse();
  checkPerfectCollector();
  checkPersistenceMaster();
  checkMidnightLearner();
  checkPerfectStraight10();

  // Check phase 2 achievements
  checkRetryNextDay();
  checkMemoryTest();
  checkWeaknessAnalyzer();
  checkConsistencyBasic();
  checkSpeedHands();
  checkMemoryGod();
  checkMonthlyMaster();
  checkFlashLearning();
  checkScoreStairs();
  checkMemoryGarden();
  checkTimeSlotAchievements();
  checkHolidayAchievements();
}

/**
 * Check streak achievements (연속 학습일)
 */
export function checkStreakAchievements() {
  try {
    const calData = JSON.parse(localStorage.getItem('auditQuizScores') || '{}');
    const dates = new Set();
    Object.values(calData).forEach(record => {
      if (record.solveHistory && Array.isArray(record.solveHistory)) {
        record.solveHistory.forEach(h => {
          if (h.date) {
            const d = new Date(h.date);
            dates.add(d.toDateString());
          }
        });
      }
    });

    const sortedDates = Array.from(dates).sort((a, b) => new Date(a) - new Date(b));
    let currentStreak = 0;
    let maxStreak = 0;
    let prevDate = null;

    sortedDates.forEach(dateStr => {
      const d = new Date(dateStr);
      if (prevDate) {
        const diff = Math.floor((d - prevDate) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          currentStreak++;
        } else if (diff > 1) {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
      prevDate = d;
    });

    if (maxStreak >= 3) unlockAchievement('streak_3');
    if (maxStreak >= 7) unlockAchievement('streak_7');
    if (maxStreak >= 14) unlockAchievement('streak_14');
    if (maxStreak >= 30) unlockAchievement('streak_30');
    if (maxStreak >= 60) unlockAchievement('streak_60');
    if (maxStreak >= 90) unlockAchievement('streak_90');
    if (maxStreak >= 100) unlockAchievement('streak_100');
    if (maxStreak >= 120) unlockAchievement('streak_120');
    if (maxStreak >= 180) unlockAchievement('streak_180');
  } catch {}
}

/**
 * Check volume achievements (daily/weekly/monthly counts)
 */
export function checkVolumeAchievements() {
  try {
    const questionScores = window.questionScores || {};

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const weekAgo = todayTime - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = todayTime - 30 * 24 * 60 * 60 * 1000;

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    // 고유 회독수 기반으로 날짜별 집계
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) {
        return;
      }
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 날짜별로 집계
      uniqueReads.forEach(t => {
        const hDate = new Date(t);
        hDate.setHours(0, 0, 0, 0);
        const hTime = hDate.getTime();

        if (hTime === todayTime) todayCount++;
        if (hTime >= weekAgo) weekCount++;
        if (hTime >= monthAgo) monthCount++;
      });
    });

    // Daily achievements
    if (todayCount >= 20) unlockAchievement('daily_20');
    if (todayCount >= 40) unlockAchievement('daily_40');
    if (todayCount >= 50) unlockAchievement('daily_50');
    if (todayCount >= 70) unlockAchievement('daily_70');
    if (todayCount >= 100) unlockAchievement('daily_100');
    if (todayCount >= 120) unlockAchievement('daily_120');
    if (todayCount >= 150) unlockAchievement('daily_150');

    // Weekly achievements
    if (weekCount >= 100) unlockAchievement('weekly_100');
    if (weekCount >= 200) unlockAchievement('weekly_200');
    if (weekCount >= 300) unlockAchievement('weekly_300');

    // Monthly achievements
    if (monthCount >= 300) unlockAchievement('monthly_300');
    if (monthCount >= 600) unlockAchievement('monthly_600');
    if (monthCount >= 1000) unlockAchievement('monthly_1000');
  } catch {}
}

/**
 * Check source-based achievements (H, S, HS vs SS, P)
 */
export function checkSourceAchievements() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];

    if (!allData || !allData.length) return;

    // Basic sources: H, S, HS
    const basicSources = allData.filter(q => ['H', 'S', 'HS'].includes(q.출처));
    const basicSolved = basicSources.filter(q => questionScores[normId(q.고유ID)]);
    if (basicSources.length > 0 && basicSolved.length === basicSources.length) {
      unlockAchievement('basic_source');
    }

    // Advanced sources: SS, P (심화반 입반: 50개)
    const advancedSolved = Object.keys(questionScores).filter(id => {
      const q = allData.find(item => normId(item.고유ID) === id);
      return q && ['SS', 'P'].includes(q.출처);
    });
    if (advancedSolved.length >= 50) unlockAchievement('advanced_source');

    // Advanced graduate: 150개 + 평균 80점 이상
    if (advancedSolved.length >= 150) {
      const advancedScores = advancedSolved
        .map(id => questionScores[id]?.score)
        .filter(s => s !== undefined);
      if (advancedScores.length > 0) {
        const avgScore = advancedScores.reduce((sum, s) => sum + s, 0) / advancedScores.length;
        if (avgScore >= 80) {
          unlockAchievement('advanced_graduate');
        }
      }
    }

    // Advanced mastery: All SS, P problems solved at least once with avg 85+
    const advancedProblems = allData.filter(q => ['SS', 'P'].includes(q.출처));
    if (advancedProblems.length > 0) {
      const advancedSolvedAll = advancedProblems.filter(q => questionScores[normId(q.고유ID)]);

      // Check if all advanced problems are solved at least once
      if (advancedSolvedAll.length === advancedProblems.length) {
        // Calculate average score
        const scores = advancedSolvedAll
          .map(q => questionScores[normId(q.고유ID)].score)
          .filter(s => s !== undefined);

        if (scores.length > 0) {
          const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          if (avgScore >= 85) {
            unlockAchievement('advanced_mastery');
          }
        }
      }
    }
  } catch {}
}

/**
 * Check overcome weakness (약점 극복: 60점 미만 → 85점 이상)
 */
export function checkOvercomeWeakness() {
  try {
    const questionScores = window.questionScores || {};

    Object.entries(questionScores).forEach(([id, record]) => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 점수 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadTimes = [];
      const uniqueReadScores = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadTimes.push(t);
          uniqueReadScores.push(h.score);
          lastTime = t;
        }
      }
      
      const hadLow = uniqueReadScores.some(s => s !== undefined && s < 60);
      const latestScore = record.score;

      if (hadLow && latestScore >= 85) {
        unlockAchievement('overcome_weakness');
      }
    });
  } catch {}
}

/**
 * Check comeback (컴백: 3회 이상 60점 미만 → 85점 이상)
 */
export function checkComeback() {
  try {
    const questionScores = window.questionScores || {};

    Object.entries(questionScores).forEach(([id, record]) => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 4) return;

      // 고유 회독수 기반으로 점수 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadScores = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadScores.push(h.score);
          lastTime = t;
        }
      }
      
      const scores = uniqueReadScores.filter(s => s !== undefined);
      const lowScores = scores.filter(s => s < 60);
      const latestScore = record.score;

      if (lowScores.length >= 3 && latestScore >= 85) {
        unlockAchievement('comeback');
      }
    });
  } catch {}
}

/**
 * Check perfect day (완벽한 하루: 하루 10문제 80점 이상)
 */
export function checkPerfectDay() {
  try {
    const questionScores = window.questionScores || {};

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const todayProblems = [];

    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;

      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 오늘 날짜의 고유 회독만 집계
      uniqueReadAttempts.forEach(ur => {
        const hDate = new Date(ur.date);
        hDate.setHours(0, 0, 0, 0);
        if (hDate.getTime() === todayTime && ur.score !== undefined) {
          todayProblems.push(ur.score);
        }
      });
    });

    if (todayProblems.length >= 10 && todayProblems.every(s => s >= 80)) {
      unlockAchievement('perfect_day');
    }
  } catch {}
}

/**
 * Check chapter master (단원 마스터: 한 단원 전체 80점 이상)
 */
export function checkChapterMaster() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];

    if (!allData || !allData.length) return;

    const chapters = {};
    allData.forEach(q => {
      const ch = String(q.단원).trim();
      if (!chapters[ch]) chapters[ch] = [];
      chapters[ch].push(q);
    });

    Object.entries(chapters).forEach(([chapter, problems]) => {
      const solvedProblems = problems.filter(q => {
        const score = questionScores[normId(q.고유ID)]?.score;
        return score !== undefined;
      });

      if (solvedProblems.length === problems.length && solvedProblems.length > 0) {
        const avgScore = solvedProblems.reduce((sum, q) => sum + questionScores[normId(q.고유ID)].score, 0) / solvedProblems.length;
        if (avgScore >= 80) {
          unlockAchievement('chapter_master');
        }
      }
    });
  } catch {}
}

/**
 * Check 1st completion (1회독 완료: 모든 단원 최소 1회)
 */
export function check1stCompletion() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];

    if (!allData || !allData.length) return;

    const chapters = new Set(allData.map(q => String(q.단원).trim()));
    const solvedChapters = new Set();

    allData.forEach(q => {
      if (questionScores[normId(q.고유ID)]) {
        solvedChapters.add(String(q.단원).trim());
      }
    });

    if (chapters.size > 0 && chapters.size === solvedChapters.size) {
      unlockAchievement('first_completion');
    }
  } catch {}
}

/**
 * Check time-based achievements (새벽, 심야 학습, D-1)
 */
export function checkTimeBased() {
  try {
    const questionScores = window.questionScores || {};

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const todayByHour = {};
    let todayProblemCount = 0;

    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;

      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 오늘 날짜의 고유 회독만 시간대별 집계
      uniqueReads.forEach(t => {
        const hDate = new Date(t);
        const hDateOnly = new Date(hDate);
        hDateOnly.setHours(0, 0, 0, 0);

        if (hDateOnly.getTime() === todayTime) {
          const hHour = hDate.getHours();
          if (!todayByHour[hHour]) todayByHour[hHour] = 0;
          todayByHour[hHour]++;
          todayProblemCount++;
        }
      });
    });

    // Dawn learner (5-7)
    let dawnCount = 0;
    for (let h = 5; h <= 6; h++) {
      dawnCount += (todayByHour[h] || 0);
    }
    if (dawnCount >= 10) unlockAchievement('dawn_learner');

    // Night owl (1-4) with dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    if (isDarkMode) {
      let nightCount = 0;
      for (let h = 1; h <= 4; h++) {
        nightCount += (todayByHour[h] || 0);
      }
      if (nightCount >= 10) unlockAchievement('night_owl');
    }

    // D-1 achievement (정상 직전)
    const examDateStr = localStorage.getItem('examDate_v1');
    if (examDateStr && todayProblemCount >= 1) {
      const examDate = new Date(examDateStr);
      examDate.setHours(0, 0, 0, 0);

      // Calculate D-1 (one day before exam)
      const dMinus1 = new Date(examDate);
      dMinus1.setDate(dMinus1.getDate() - 1);

      // Check if today is D-1
      if (today.getTime() === dMinus1.getTime()) {
        unlockAchievement('d_day_minus_1');
      }
    }
  } catch {}
}

/**
 * Check per-chapter 1st completion (단원별 기본문제 1회독)
 */
export function checkChapter1stCompletionPerChapter() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];

    if (!allData || !allData.length) return;

    // Chapter list: 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20
    const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];

    chapters.forEach(chNum => {
      const chStr = String(chNum);
      // Get all basic range problems (H, S, HS) for this chapter
      const basicProblems = allData.filter(q =>
        String(q.단원).trim() === chStr && ['H', 'S', 'HS'].includes(q.출처)
      );

      if (basicProblems.length === 0) return;

      // Check if all basic problems have been solved at least once
      const allSolved = basicProblems.every(q => {
        const record = questionScores[normId(q.고유ID)];
        return record !== undefined; // At least attempted once
      });

      if (allSolved) {
        unlockAchievement(`ch${chNum}_1st`);
      }
    });
  } catch {}
}

/**
 * Check per-chapter mastery (단원별 1회독 완료 + 85점 평균)
 */
export function checkChapterMasteryPerChapter() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];

    if (!allData || !allData.length) return;

    // Chapter list: 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20
    const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];

    chapters.forEach(chNum => {
      const chStr = String(chNum);

      // Get basic range problems (H, S, HS) for 1st completion check
      const basicProblems = allData.filter(q =>
        String(q.단원).trim() === chStr && ['H', 'S', 'HS'].includes(q.출처)
      );

      if (basicProblems.length === 0) return;

      // Check 1st completion: all basic problems must be solved at least once
      const all1stCompleted = basicProblems.every(q => {
        const record = questionScores[normId(q.고유ID)];
        return record !== undefined; // At least attempted once
      });

      // If 1st completion is not met, skip this chapter
      if (!all1stCompleted) return;

      // Get ALL problems for this chapter (including advanced) for average score
      const chapterProblems = allData.filter(q => String(q.단원).trim() === chStr);

      // Get solved problems with scores
      const solvedWithScores = chapterProblems.filter(q => {
        const record = questionScores[normId(q.고유ID)];
        return record && record.score !== undefined;
      }).map(q => questionScores[normId(q.고유ID)].score);

      // Need at least some problems solved to calculate average
      if (solvedWithScores.length === 0) return;

      // Calculate average score
      const avgScore = solvedWithScores.reduce((sum, score) => sum + score, 0) / solvedWithScores.length;

      // Unlock if average is 85 or higher AND 1st completion is met
      if (avgScore >= 85) {
        unlockAchievement(`ch${chNum}_master`);
      }
    });
  } catch {}
}

/**
 * Check all chapter mastery (올라운더: 모든 단원 1회독 + 전단원 평균 85점)
 */
export function checkAllChapterMastery() {
  try {
    // Check if all chapter master achievements are unlocked
    const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];
    const achievementsData = JSON.parse(localStorage.getItem('achievements_v1') || '{}');

    // Check if all chapter masters are unlocked
    const allChapterMastersUnlocked = chapters.every(chNum => {
      return achievementsData[`ch${chNum}_master`] !== undefined;
    });

    // Check if first_completion is unlocked
    const firstCompletionUnlocked = achievementsData['first_completion'] !== undefined;

    // Unlock if both conditions are met
    if (allChapterMastersUnlocked && firstCompletionUnlocked) {
      unlockAchievement('all_chapter_mastery');
    }
  } catch {}
}

/**
 * Check flashcard navigation achievements
 */
export function checkFlashcardAchievements() {
  try {
    const count = parseInt(localStorage.getItem('flashcard_navigation_count_v1') || '0', 10);

    if (count >= 100) unlockAchievement('flashcard_100');
    if (count >= 500) unlockAchievement('flashcard_500');
    if (count >= 1000) unlockAchievement('flashcard_1000');
  } catch {}
}

/**
 * Open achievements modal
 */
export function openAchievementsModal() {
  loadAchievements();
  loadFeaturedAchievement();
  renderAchievements();
  el.achievementsModal?.classList.remove('hidden');
  el.achievementsModal?.classList.add('flex');

  // Mark all as seen
  Object.keys(achievementsData).forEach(id => {
    achievementsData[id].seen = true;
  });
  saveAchievements();
  updateAchievementBadge();
}

/**
 * Close achievements modal
 */
export function closeAchievementsModal() {
  el.achievementsModal?.classList.add('hidden');
  el.achievementsModal?.classList.remove('flex');
}

/**
 * Render achievements list with optional tier filter
 * @param {string} filterTier - 'all', 'bronze', 'silver', 'gold', 'hidden'
 */
export function renderAchievements(filterTier = 'all') {
  const list = el.achievementsList;
  if (!list) return;

  list.innerHTML = '';

  // Filter achievements - hide locked hidden achievements
  let achievementsList = Object.values(ACHIEVEMENTS).filter(a => {
    // If it's a hidden achievement and not unlocked, don't show it at all
    if (a.tier === 'hidden' && !achievementsData[a.id]) {
      return false;
    }
    // Otherwise apply tier filter
    return filterTier === 'all' || a.tier === filterTier;
  });

  const unlocked = achievementsList.filter(a => achievementsData[a.id]);
  const locked = achievementsList.filter(a => !achievementsData[a.id]);

  // Update stats - exclude locked hidden achievements from total
  const visibleTotal = Object.values(ACHIEVEMENTS).filter(a => a.tier !== 'hidden' || achievementsData[a.id]).length;
  const unlockedCount = Object.keys(achievementsData).length;
  const progressPercent = visibleTotal > 0 ? Math.round((unlockedCount / visibleTotal) * 100) : 0;

  // Calculate actual points
  const totalPoints = Object.keys(achievementsData).reduce((sum, id) => {
    return sum + (ACHIEVEMENTS[id]?.points || 0);
  }, 0);

  if (el.achievementCountTotal) el.achievementCountTotal.textContent = visibleTotal;
  if (el.achievementCountUnlocked) el.achievementCountUnlocked.textContent = unlockedCount;
  if (el.achievementProgressPercent) el.achievementProgressPercent.textContent = progressPercent;
  if (el.achievementPoints) el.achievementPoints.textContent = totalPoints;

  // Render unlocked first
  unlocked.forEach(achievement => {
    const card = createAchievementCard(achievement, true);
    list.appendChild(card);
  });

  // Then locked (hidden achievements won't be here)
  locked.forEach(achievement => {
    const card = createAchievementCard(achievement, false);
    list.appendChild(card);
  });
}

/**
 * Create achievement card element
 * @param {Object} achievement - Achievement object
 * @param {boolean} isUnlocked - Whether unlocked or not
 * @returns {HTMLElement} Card element
 */
export function createAchievementCard(achievement, isUnlocked) {
  const div = document.createElement('div');
  const tierColors = {
    bronze: 'from-amber-100 to-yellow-100 border-amber-300',
    silver: 'from-gray-200 to-gray-300 border-gray-400',
    gold: 'from-yellow-100 to-amber-200 border-yellow-400',
    hidden: 'from-purple-100 to-pink-100 border-purple-300'
  };

  const tierIcons = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    hidden: '🤫'
  };

  const isFeatured = featuredAchievementId === achievement.id;

  div.className = `bg-gradient-to-r ${tierColors[achievement.tier]} dark:from-gray-800 dark:to-gray-700 border rounded-lg p-4 ${isUnlocked ? '' : 'opacity-50 grayscale'}`;
  div.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="text-4xl">${achievement.icon}</span>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-bold text-gray-900 dark:text-gray-100">${achievement.name}</h3>
          <span class="text-xs">${tierIcons[achievement.tier]}</span>
          ${isUnlocked ? '<span class="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">달성</span>' : ''}
          ${isFeatured ? '<span class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">⭐ 대표</span>' : ''}
        </div>
        <p class="text-sm text-gray-700 dark:text-gray-300">${achievement.desc}</p>
        <div class="flex items-center justify-between mt-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">+ ${achievement.points}P</div>
          ${isUnlocked ? `
            <button
              class="set-featured-btn text-xs px-3 py-1 rounded ${isFeatured ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}"
              data-achievement-id="${achievement.id}"
              ${isFeatured ? 'disabled' : ''}
            >
              ${isFeatured ? '⭐ 대표 업적' : '⭐ 대표로 설정'}
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Add event listener for featured button
  if (isUnlocked && !isFeatured) {
    const btn = div.querySelector('.set-featured-btn');
    btn?.addEventListener('click', async () => {
      await setFeaturedAchievement(achievement.id);
      renderAchievements(); // Re-render to update UI
    });
  }

  return div;
}

/**
 * Check retry same day (오늘도 힘내요)
 */
export function checkRetrySameDay() {
  try {
    const questionScores = window.questionScores || {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 오늘 날짜의 풀이 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadTimes = [];
      const uniqueReadScores = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadTimes.push(t);
          uniqueReadScores.push({ time: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 오늘 날짜의 고유 회독 확인
      const todayUniqueReads = uniqueReadScores.filter(ur => {
        const hDate = new Date(ur.time);
        hDate.setHours(0, 0, 0, 0);
        return hDate.getTime() === todayTime;
      });

      if (todayUniqueReads.length >= 2) {
        // Check if first was < 60, then retried
        const firstScore = todayUniqueReads[0]?.score;
        if (firstScore !== undefined && firstScore < 60) {
          unlockAchievement('retry_same_day');
        }
      }
    });
  } catch {}
}

/**
 * Check explorer (탐험가: 5개 이상 다른 단원)
 */
export function checkExplorer() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];
    if (!allData || !allData.length) return;

    const chaptersExplored = new Set();
    Object.keys(questionScores).forEach(id => {
      const q = allData.find(item => normId(item.고유ID) === id);
      if (q) {
        chaptersExplored.add(String(q.단원).trim());
      }
    });

    if (chaptersExplored.size >= 5) {
      unlockAchievement('explorer');
    }
  } catch {}
}

/**
 * Check perfectionist (완벽주의자: 한 문제 3회 이상 모두 90점 이상)
 */
export function checkPerfectionist() {
  try {
    const questionScores = window.questionScores || {};

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 3) return;

      // 고유 회독수 기반으로 점수 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadScores = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadScores.push(h.score);
          lastTime = t;
        }
      }
      
      const scores = uniqueReadScores.filter(s => s !== undefined);
      if (scores.length >= 3 && scores.every(s => s >= 90)) {
        unlockAchievement('perfectionist');
      }
    });
  } catch {}
}

/**
 * Check weekend warrior (주말 학습러: 토/일 모두 10문제 이상, 4회 이상)
 */
export function checkWeekendWarrior() {
  try {
    const questionScores = window.questionScores || {};
    const weekendCounts = {}; // { 'YYYY-WW': {sat: 0, sun: 0} }

    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 주말 통계 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const day = d.getDay(); // 0=일, 6=토
        if (day !== 0 && day !== 6) return;

        // Get week key (ISO 8601: 월요일 시작)
        const target = new Date(d.valueOf());
        const dayNr = (d.getDay() + 6) % 7; // 월요일 = 0, 일요일 = 6
        target.setDate(target.getDate() - dayNr + 3); // 가장 가까운 목요일로 이동
        const yearStart = new Date(target.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
        const weekKey = `${target.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;

        if (!weekendCounts[weekKey]) {
          weekendCounts[weekKey] = { sat: 0, sun: 0 };
        }

        if (day === 6) weekendCounts[weekKey].sat++;
        if (day === 0) weekendCounts[weekKey].sun++;
      });
    });

    const validWeekends = Object.values(weekendCounts).filter(w => w.sat >= 10 && w.sun >= 10).length;
    if (validWeekends >= 4) {
      unlockAchievement('weekend_warrior');
    }

    // Check weekend_warrior_hidden (주말 반납: 주말 양일 모두 30문제 이상, 1회 이상)
    const hiddenWeekends = Object.values(weekendCounts).filter(w => w.sat >= 30 && w.sun >= 30).length;
    if (hiddenWeekends >= 1) {
      unlockAchievement('weekend_warrior_hidden');
    }
  } catch {}
}

/**
 * Check rapid growth (급성장: 첫 시도 70점 이하 → 두 번째 95점 이상)
 */
export function checkRapidGrowth() {
  try {
    const questionScores = window.questionScores || {};

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 첫 두 회독의 점수 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadScores = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadScores.push(h.score);
          lastTime = t;
        }
      }
      
      const first = uniqueReadScores[0];
      const second = uniqueReadScores[1];

      if (first !== undefined && second !== undefined && first <= 70 && second >= 95) {
        unlockAchievement('rapid_growth');
      }
    });
  } catch {}
}

/**
 * Check flow learner (흐름의 이해자: 한 플로우 내 모든 단원에서 각각 10문제 이상 풀이)
 */
export function checkFlowLearner() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];
    if (!allData || !allData.length) return;

    // Count solved problems per chapter (고유 회독수 기반)
    const chapterCounts = {};
    Object.entries(questionScores).forEach(([id, record]) => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads === 0) return;
      const q = allData.find(item => normId(item.고유ID) === id);
      if (q) {
        const chapter = String(q.단원).trim();
        chapterCounts[chapter] = (chapterCounts[chapter] || 0) + 1;
      }
    });

    // Check each flow to see if all chapters have 10+ problems
    for (const flow of Object.values(AUDIT_FLOW_MAP)) {
      const allChaptersComplete = flow.chapters.every(ch => {
        const count = chapterCounts[String(ch)] || 0;
        return count >= 10;
      });

      if (allChaptersComplete) {
        unlockAchievement('flow_learner');
        return;
      }
    }
  } catch {}
}

/**
 * Check review king (복습왕: 플래그 10개 이상 모두 85점 이상)
 */
export function checkReviewKing() {
  try {
    const questionScores = window.questionScores || {};

    const flaggedProblems = Object.values(questionScores).filter(
      s => s.userReviewFlag && !s.userReviewExclude
    );

    if (flaggedProblems.length >= 10) {
      const allAbove85 = flaggedProblems.every(s => s.score >= 85);
      if (allAbove85) {
        unlockAchievement('review_king');
      }
    }
  } catch {}
}

/**
 * Check legendary start (전설의 시작: 연속 10문제 첫 시도에 95점 이상)
 */
export function checkLegendaryStart() {
  try {
    const questionScores = window.questionScores || {};

    // Get all first unique attempt scores in chronological order
    const firstAttempts = Object.values(questionScores)
      .filter(r => {
        const uniqueReads = getUniqueReadCount(r?.solveHistory || []);
        return uniqueReads > 0;
      })
      .map(r => {
        // 첫 고유 회독 찾기
        const times = (r.solveHistory || [])
          .map(x => +x?.date)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);
        
        if (times.length === 0) return null;
        
        let lastTime = -Infinity;
        let firstUniqueAttempt = null;
        
        for (let i = 0; i < r.solveHistory.length; i++) {
          const h = r.solveHistory[i];
          const t = +h?.date;
          if (!Number.isFinite(t)) continue;
          
          if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
            if (firstUniqueAttempt === null) {
              firstUniqueAttempt = { date: t, score: h.score };
            }
            lastTime = t;
          }
        }
        
        return firstUniqueAttempt ? {
          timestamp: firstUniqueAttempt.date,
          score: firstUniqueAttempt.score
        } : null;
      })
      .filter(a => a !== null && a.score !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Check for 10 consecutive 95+ scores
    let streak = 0;
    for (const attempt of firstAttempts) {
      if (attempt.score >= 95) {
        streak++;
        if (streak >= 10) {
          unlockAchievement('legendary_start');
          break;
        }
      } else {
        streak = 0;
      }
    }
  } catch {}
}

/**
 * Check consistency master (일관성의 화신: 10일 연속 30~50문제)
 */
export function checkConsistencyMaster() {
  try {
    const questionScores = window.questionScores || {};

    // Count problems per day
    const dailyCounts = {};
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory) return;
      record.solveHistory.forEach(h => {
        const d = new Date(h.date);
        d.setHours(0, 0, 0, 0);
        const key = d.toDateString();
        dailyCounts[key] = (dailyCounts[key] || 0) + 1;
      });
    });

    // Sort by date
    const sortedDates = Object.keys(dailyCounts).sort((a, b) => new Date(a) - new Date(b));

    // Check for 10 consecutive days with 30~50 problems
    let streak = 0;
    let prevDate = null;

    for (const dateStr of sortedDates) {
      const count = dailyCounts[dateStr];
      const d = new Date(dateStr);

      if (count >= 30 && count <= 50) {
        if (prevDate) {
          const diff = Math.floor((d - prevDate) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            streak++;
          } else {
            streak = 1;
          }
        } else {
          streak = 1;
        }

        if (streak >= 10) {
          unlockAchievement('consistency_master');
          break;
        }
      } else {
        streak = 0;
      }

      prevDate = d;
    }
  } catch {}
}

/**
 * Check comeback master (역전의 명수: 60점 미만 50개 모두 85점 이상)
 */
export function checkComebackMaster() {
  try {
    const questionScores = window.questionScores || {};

    const comebackProblems = Object.values(questionScores).filter(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return false;
      
      // 고유 회독수 기반으로 점수 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return false;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadScores = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadScores.push(h.score);
          lastTime = t;
        }
      }
      
      const scores = uniqueReadScores.filter(s => s !== undefined);
      const hadLow = scores.some(s => s < 60);
      const currentScore = record.score;
      return hadLow && currentScore >= 85;
    });

    if (comebackProblems.length >= 50) {
      unlockAchievement('comeback_master');
    }
  } catch {}
}

/**
 * Check lucky 777 (행운의 숫자: 정확히 777개)
 */
export function checkLucky777() {
  try {
    const questionScores = window.questionScores || {};
    const totalProblems = Object.keys(questionScores).length;
    if (totalProblems === 777) {
      unlockAchievement('lucky_777');
    }
  } catch {}
}

/**
 * Check extreme perfectionist (완벽주의의 극치: 하루 20문제 모두 95점 이상)
 */
export function checkExtremePerfectionist() {
  try {
    const questionScores = window.questionScores || {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const todayProblems = [];
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 오늘 날짜의 고유 회독만 집계
      uniqueReadAttempts.forEach(ur => {
        const hDate = new Date(ur.date);
        hDate.setHours(0, 0, 0, 0);
        if (hDate.getTime() === todayTime && ur.score !== undefined) {
          todayProblems.push(ur.score);
        }
      });
    });

    if (todayProblems.length >= 20 && todayProblems.every(s => s >= 95)) {
      unlockAchievement('extreme_perfectionist');
    }
  } catch {}
}

/**
 * Check time traveler (시간여행자: 자정 10문제 이상)
 */
export function checkTimeTraveler() {
  try {
    const questionScores = window.questionScores || {};

    let midnightCount = 0;
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 자정 시간대 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const hour = d.getHours();
        if (hour === 0) midnightCount++;
      });
    });

    if (midnightCount >= 10) {
      unlockAchievement('time_traveler');
    }
  } catch {}
}

/**
 * Check full course (풀코스: 하루 모든 단원 1문제씩)
 */
export function checkFullCourse() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];
    if (!allData || !allData.length) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const todayChapters = new Set();

    // Available chapters: 1-20 (19 chapters actually, excluding 9, 19)
    const requiredChapters = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];

    Object.entries(questionScores).forEach(([id, record]) => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 오늘 날짜의 고유 회독만 단원 집계
      uniqueReads.forEach(t => {
        const hDate = new Date(t);
        hDate.setHours(0, 0, 0, 0);
        if (hDate.getTime() === todayTime) {
          const q = allData.find(item => normId(item.고유ID) === id);
          if (q) {
            const chNum = Number(q.단원);
            if (requiredChapters.includes(chNum)) {
              todayChapters.add(chNum);
            }
          }
        }
      });
    });

    if (todayChapters.size >= requiredChapters.length) {
      unlockAchievement('full_course');
    }
  } catch {}
}

/**
 * Check perfect collector (백점 컬렉터: 100점 50번 이상)
 */
export function checkPerfectCollector() {
  try {
    const questionScores = window.questionScores || {};

    let perfectCount = 0;
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ score: h.score });
          lastTime = t;
        }
      }
      
      // 고유 회독만 100점 집계
      uniqueReadAttempts.forEach(ur => {
        if (ur.score === 100) perfectCount++;
      });
    });

    if (perfectCount >= 50) {
      unlockAchievement('perfect_collector');
    }
  } catch {}
}

/**
 * Check persistence master (끈기의 달인: 한 문제 5회 이상 재시도하여 90점 이상)
 */
export function checkPersistenceMaster() {
  try {
    const questionScores = window.questionScores || {};

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 5) return;

      const latestScore = record.score;
      if (latestScore >= 90) {
        unlockAchievement('persistence_master');
      }
    });
  } catch {}
}

/**
 * Check midnight learner (심야 학습러: 새벽 2~4시 연속 3일)
 */
export function checkMidnightLearner() {
  try {
    const questionScores = window.questionScores || {};

    // Count problems per day during 2-4am (고유 회독수 기반)
    const midnightDays = new Set();
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 심야 시간대 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const hour = d.getHours();
        if (hour >= 2 && hour <= 4) {
          const dayOnly = new Date(d);
          dayOnly.setHours(0, 0, 0, 0);
          midnightDays.add(dayOnly.toDateString());
        }
      });
    });

    // Check for 3 consecutive days
    const sortedDays = Array.from(midnightDays).sort((a, b) => new Date(a) - new Date(b));
    let streak = 0;
    let prevDate = null;

    for (const dateStr of sortedDays) {
      const d = new Date(dateStr);
      if (prevDate) {
        const diff = Math.floor((d - prevDate) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          streak++;
          if (streak >= 2) { // 3 days = streak of 2 (day1->day2->day3)
            unlockAchievement('midnight_learner');
            break;
          }
        } else {
          streak = 0;
        }
      }
      prevDate = d;
    }
  } catch {}
}

/**
 * Check rush hour avoider (러시아워 회피: 9~11, 18~20 제외 100문제 이상)
 */
export function checkRushHourAvoider() {
  try {
    const questionScores = window.questionScores || {};

    let nonRushCount = 0;
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 러시아워 제외 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const hour = d.getHours();
        // Exclude 9-11 and 18-20 (6pm-8pm)
        if (!((hour >= 9 && hour <= 11) || (hour >= 18 && hour <= 20))) {
          nonRushCount++;
        }
      });
    });

    if (nonRushCount >= 100) {
      unlockAchievement('rush_hour_avoider');
    }
  } catch {}
}

/**
 * Check morning routine (아침 루틴: 7일 연속 같은 시간대 ±1시간)
 */
export function checkMorningRoutine() {
  try {
    const questionScores = window.questionScores || {};

    // Get first solve time per day (오전만, 고유 회독수 기반)
    const dailyFirstSolve = {};
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 오전 시간대 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const hour = d.getHours();
        if (hour < 12) { // 오전만
          const dayKey = new Date(d);
          dayKey.setHours(0, 0, 0, 0);
          const dayStr = dayKey.toDateString();

          if (!dailyFirstSolve[dayStr] || d < dailyFirstSolve[dayStr].time) {
            dailyFirstSolve[dayStr] = { time: d, hour };
          }
        }
      });
    });

    // Check for 7 consecutive days within ±1 hour range
    const sortedDays = Object.keys(dailyFirstSolve).sort((a, b) => new Date(a) - new Date(b));
    let streak = 1;
    let prevDate = null;
    let baseHour = null;

    for (const dayStr of sortedDays) {
      const d = new Date(dayStr);
      const hour = dailyFirstSolve[dayStr].hour;

      if (prevDate) {
        const diff = Math.floor((d - prevDate) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          // Check if within ±1 hour of base hour
          if (Math.abs(hour - baseHour) <= 1) {
            streak++;
            if (streak >= 7) {
              unlockAchievement('morning_routine');
              break;
            }
          } else {
            streak = 1;
            baseHour = hour;
          }
        } else {
          streak = 1;
          baseHour = hour;
        }
      } else {
        baseHour = hour;
      }
      prevDate = d;
    }
  } catch {}
}

/**
 * Check retry next day (재도전의 미학: 하루 전 틀린 문제 다음날 복습 20회)
 */
export function checkRetryNextDay() {
  try {
    const questionScores = window.questionScores || {};
    let retryCount = 0;

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 날짜 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }

      for (let i = 1; i < uniqueReadAttempts.length; i++) {
        const prevAttempt = uniqueReadAttempts[i - 1];
        const currAttempt = uniqueReadAttempts[i];

        if (prevAttempt.score < 60) {
          const prevDate = new Date(prevAttempt.date);
          prevDate.setHours(0, 0, 0, 0);
          const currDate = new Date(currAttempt.date);
          currDate.setHours(0, 0, 0, 0);

          const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            retryCount++;
            if (retryCount >= 20) {
              unlockAchievement('retry_next_day');
              return;
            }
          }
        }
      }
    });
  } catch {}
}

/**
 * Check memory test (기억력 테스트: 7일 전 문제 재풀이 점수 향상 30개)
 */
export function checkMemoryTest() {
  try {
    const questionScores = window.questionScores || {};
    let improvedCount = 0;

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 날짜 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }

      for (let i = 1; i < uniqueReadAttempts.length; i++) {
        const prevAttempt = uniqueReadAttempts[i - 1];
        const currAttempt = uniqueReadAttempts[i];

        const prevDate = new Date(prevAttempt.date);
        const currDate = new Date(currAttempt.date);
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        // 정확히 7일 간격 (±1일 허용)
        if (diffDays >= 6 && diffDays <= 8) {
          if (currAttempt.score > prevAttempt.score) {
            improvedCount++;
            if (improvedCount >= 30) {
              unlockAchievement('memory_test');
              return;
            }
          }
        }
      }
    });
  } catch {}
}

/**
 * Check nonstop learning (논스톱 학습: 30분 내 20문제)
 */
export function checkNonstopLearning() {
  try {
    const questionScores = window.questionScores || {};

    // Get all unique solve timestamps
    const allSolves = [];
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 타임스탬프 추가
      uniqueReads.forEach(t => {
        allSolves.push(t);
      });
    });

    allSolves.sort((a, b) => a - b);

    // Check for 20 problems within 30 minutes
    for (let i = 0; i <= allSolves.length - 20; i++) {
      const start = allSolves[i];
      const end = allSolves[i + 19];
      const diff = end - start;

      if (diff <= 30 * 60 * 1000) { // 30 minutes
        unlockAchievement('nonstop_learning');
        break;
      }
    }
  } catch {}
}

/**
 * Check weakness analyzer (약점 분석가: 60점 미만 30개 재도전)
 */
export function checkWeaknessAnalyzer() {
  try {
    const questionScores = window.questionScores || {};

    const retriedWeaknesses = Object.values(questionScores).filter(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return false;

      // 고유 회독수 기반으로 첫 회독 점수 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return false;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      let firstUniqueScore = null;
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          if (firstUniqueScore === null) {
            firstUniqueScore = h.score;
          }
          lastTime = t;
        }
      }

      // Check if first unique attempt was < 60 and retried
      return firstUniqueScore !== undefined && firstUniqueScore < 60;
    });

    if (retriedWeaknesses.length >= 30) {
      unlockAchievement('weakness_analyzer');
    }
  } catch {}
}

/**
 * Check consistency basic (꾸준함의 정석: 30일 연속 최소 20문제)
 */
export function checkConsistencyBasic() {
  try {
    const questionScores = window.questionScores || {};

    // Count problems per day
    const dailyCounts = {};
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory) return;
      record.solveHistory.forEach(h => {
        const d = new Date(h.date);
        d.setHours(0, 0, 0, 0);
        const key = d.toDateString();
        dailyCounts[key] = (dailyCounts[key] || 0) + 1;
      });
    });

    // Check for 30 consecutive days with at least 20 problems
    const sortedDates = Object.keys(dailyCounts).sort((a, b) => new Date(a) - new Date(b));
    let streak = 0;
    let prevDate = null;

    for (const dateStr of sortedDates) {
      const count = dailyCounts[dateStr];
      const d = new Date(dateStr);

      if (count >= 20) {
        if (prevDate) {
          const diff = Math.floor((d - prevDate) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            streak++;
            if (streak >= 29) { // 30 days = streak of 29
              unlockAchievement('consistency_basic');
              break;
            }
          } else {
            streak = 0;
          }
        }
      } else {
        streak = 0;
      }

      prevDate = count >= 20 ? d : null;
    }
  } catch {}
}

/**
 * Check speed hands (빠른 손: 30분 내 15문제 평균 80점)
 */
export function checkSpeedHands() {
  try {
    const questionScores = window.questionScores || {};

    // Get all unique solve timestamps with scores
    const allSolves = [];
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ time: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 고유 회독만 타임스탬프와 점수 추가
      uniqueReadAttempts.forEach(ur => {
        if (ur.score !== undefined) {
          allSolves.push({ time: ur.time, score: ur.score });
        }
      });
    });

    allSolves.sort((a, b) => a.time - b.time);

    // Check for 15 problems within 30 minutes with avg 80+
    for (let i = 0; i <= allSolves.length - 15; i++) {
      const window = allSolves.slice(i, i + 15);
      const start = window[0].time;
      const end = window[14].time;
      const diff = end - start;

      if (diff <= 30 * 60 * 1000) { // 30 minutes
        const avg = window.reduce((sum, s) => sum + s.score, 0) / 15;
        if (avg >= 80) {
          unlockAchievement('speed_hands');
          break;
        }
      }
    }
  } catch {}
}

/**
 * Check memory god (암기의 신: 3일 이상 간격 100개 점수 유지/향상)
 */
export function checkMemoryGod() {
  try {
    const questionScores = window.questionScores || {};
    let qualifiedCount = 0;

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 날짜 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }

      for (let i = 1; i < uniqueReadAttempts.length; i++) {
        const prevAttempt = uniqueReadAttempts[i - 1];
        const currAttempt = uniqueReadAttempts[i];

        const prevDate = new Date(prevAttempt.date);
        const currDate = new Date(currAttempt.date);
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diffDays >= 3 && currAttempt.score >= prevAttempt.score) {
          qualifiedCount++;
          if (qualifiedCount >= 100) {
            unlockAchievement('memory_god');
            return;
          }
          break; // Only count once per problem
        }
      }
    });
  } catch {}
}

/**
 * Check monthly master (월간 마스터: 30일 연속 평균 85점 이상)
 */
export function checkMonthlyMaster() {
  try {
    const questionScores = window.questionScores || {};

    // Calculate daily average scores (고유 회독수 기반)
    const dailyAverages = {};
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 고유 회독만 날짜별 점수 집계
      uniqueReadAttempts.forEach(ur => {
        if (ur.score === undefined) return;
        const d = new Date(ur.date);
        d.setHours(0, 0, 0, 0);
        const key = d.toDateString();

        if (!dailyAverages[key]) dailyAverages[key] = [];
        dailyAverages[key].push(ur.score);
      });
    });

    // Check for 30 consecutive days with avg 85+
    const sortedDates = Object.keys(dailyAverages).sort((a, b) => new Date(a) - new Date(b));
    let streak = 0;
    let prevDate = null;

    for (const dateStr of sortedDates) {
      const scores = dailyAverages[dateStr];
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const d = new Date(dateStr);

      if (avg >= 85) {
        if (prevDate) {
          const diff = Math.floor((d - prevDate) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            streak++;
            if (streak >= 29) { // 30 days
              unlockAchievement('monthly_master');
              break;
            }
          } else {
            streak = 0;
          }
        }
      } else {
        streak = 0;
      }

      prevDate = avg >= 85 ? d : null;
    }
  } catch {}
}

/**
 * Check retention 99 (기억 유지율 99%: 2주 전 90점 문제 50개 모두 85점 이상)
 */
export function checkRetention99() {
  try {
    const questionScores = window.questionScores || {};
    let qualifiedCount = 0;

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 날짜 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }

      for (let i = 1; i < uniqueReadAttempts.length; i++) {
        const prevAttempt = uniqueReadAttempts[i - 1];
        const currAttempt = uniqueReadAttempts[i];

        if (prevAttempt.score >= 90) {
          const prevDate = new Date(prevAttempt.date);
          const currDate = new Date(currAttempt.date);
          const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

          // 2주 = 14일 (±2일 허용)
          if (diffDays >= 12 && diffDays <= 16) {
            if (currAttempt.score >= 85) {
              qualifiedCount++;
              if (qualifiedCount >= 50) {
                unlockAchievement('retention_99');
                return;
              }
            }
            break;
          }
        }
      }
    });
  } catch {}
}

/**
 * Check flash learning (플래시 학습: 하루 100문제 평균 85점)
 */
export function checkFlashLearning() {
  try {
    const questionScores = window.questionScores || {};

    // Group by day (고유 회독수 기반)
    const dailyScores = {};
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 고유 회독만 날짜별 점수 집계
      uniqueReadAttempts.forEach(ur => {
        if (ur.score === undefined) return;
        const d = new Date(ur.date);
        d.setHours(0, 0, 0, 0);
        const key = d.toDateString();

        if (!dailyScores[key]) dailyScores[key] = [];
        dailyScores[key].push(ur.score);
      });
    });

    // Check for any day with 100+ problems and avg 85+
    Object.values(dailyScores).forEach(scores => {
      if (scores.length >= 100) {
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        if (avg >= 85) {
          unlockAchievement('flash_learning');
        }
      }
    });
  } catch {}
}

/**
 * Check long term memory (장기 기억: 한 달 전 문제 30개 모두 85점 이상)
 */
export function checkLongTermMemory() {
  try {
    const questionScores = window.questionScores || {};
    let qualifiedCount = 0;

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 2) return;

      // 고유 회독수 기반으로 날짜 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }

      for (let i = 1; i < uniqueReadAttempts.length; i++) {
        const prevAttempt = uniqueReadAttempts[i - 1];
        const currAttempt = uniqueReadAttempts[i];

        const prevDate = new Date(prevAttempt.date);
        const currDate = new Date(currAttempt.date);
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        // 한 달 = 30일 (±3일 허용)
        if (diffDays >= 27 && diffDays <= 33) {
          if (currAttempt.score >= 85) {
            qualifiedCount++;
            if (qualifiedCount >= 30) {
              unlockAchievement('long_term_memory');
              return;
            }
          }
          break;
        }
      }
    });
  } catch {}
}

/**
 * Check photographic memory (포토그래픽 메모리: 연속 50문제 첫 시도 90점 이상)
 */
export function checkPhotographicMemory() {
  try {
    const questionScores = window.questionScores || {};

    // Get all first unique attempt scores in chronological order
    const firstAttempts = Object.values(questionScores)
      .filter(r => {
        const uniqueReads = getUniqueReadCount(r?.solveHistory || []);
        return uniqueReads > 0;
      })
      .map(r => {
        // 첫 고유 회독 찾기
        const times = (r.solveHistory || [])
          .map(x => +x?.date)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);
        
        if (times.length === 0) return null;
        
        let lastTime = -Infinity;
        let firstUniqueAttempt = null;
        
        for (let i = 0; i < r.solveHistory.length; i++) {
          const h = r.solveHistory[i];
          const t = +h?.date;
          if (!Number.isFinite(t)) continue;
          
          if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
            if (firstUniqueAttempt === null) {
              firstUniqueAttempt = { date: t, score: h.score };
            }
            lastTime = t;
          }
        }
        
        return firstUniqueAttempt ? {
          timestamp: firstUniqueAttempt.date,
          score: firstUniqueAttempt.score
        } : null;
      })
      .filter(a => a !== null && a.score !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Check for 50 consecutive 90+ scores
    let streak = 0;
    for (const attempt of firstAttempts) {
      if (attempt.score >= 90) {
        streak++;
        if (streak >= 50) {
          unlockAchievement('photographic_memory');
          break;
        }
      } else {
        streak = 0;
      }
    }
  } catch {}
}

/**
 * Check score stairs (점수 계단: 60→70→80→90→100 순서대로)
 */
export function checkScoreStairs() {
  try {
    const questionScores = window.questionScores || {};

    // Get all unique scores in chronological order
    const allScores = [];
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ time: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 고유 회독만 타임스탬프와 점수 추가
      uniqueReadAttempts.forEach(ur => {
        if (ur.score !== undefined) {
          allScores.push({ time: ur.time, score: ur.score });
        }
      });
    });

    allScores.sort((a, b) => a.time - b.time);

    // Track milestones: 60, 70, 80, 90, 100
    const milestones = [60, 70, 80, 90, 100];
    let currentMilestone = 0;

    for (const { score } of allScores) {
      if (currentMilestone < milestones.length && score >= milestones[currentMilestone]) {
        currentMilestone++;
        if (currentMilestone === milestones.length) {
          unlockAchievement('score_stairs');
          break;
        }
      }
    }
  } catch {}
}

/**
 * Check deja vu (데자뷰: 같은 문제 7일 간격 3번)
 */
export function checkDejaVu() {
  try {
    const questionScores = window.questionScores || {};

    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads < 3) return;

      // 고유 회독수 기반으로 날짜 확인
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      // 고유 회독 추출
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t });
          lastTime = t;
        }
      }

      // Check if any 3 unique attempts are approximately 7 days apart
      for (let i = 0; i < uniqueReadAttempts.length - 2; i++) {
        const first = new Date(uniqueReadAttempts[i].date);
        const second = new Date(uniqueReadAttempts[i + 1].date);
        const third = new Date(uniqueReadAttempts[i + 2].date);

        const diff1 = Math.floor((second - first) / (1000 * 60 * 60 * 24));
        const diff2 = Math.floor((third - second) / (1000 * 60 * 60 * 24));

        // Both gaps should be around 7 days (±1 day)
        if (diff1 >= 6 && diff1 <= 8 && diff2 >= 6 && diff2 <= 8) {
          unlockAchievement('deja_vu');
          return;
        }
      }
    });
  } catch {}
}

/**
 * Check mirroring (미러링: 어제와 같은 개수, 같은 평균)
 */
export function checkMirroring() {
  try {
    const questionScores = window.questionScores || {};

    // Calculate daily stats (고유 회독수 기반)
    const dailyStats = {};
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReadAttempts = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReadAttempts.push({ date: t, score: h.score });
          lastTime = t;
        }
      }
      
      // 고유 회독만 날짜별 점수 집계
      uniqueReadAttempts.forEach(ur => {
        if (ur.score === undefined) return;
        const d = new Date(ur.date);
        d.setHours(0, 0, 0, 0);
        const key = d.toDateString();

        if (!dailyStats[key]) dailyStats[key] = [];
        dailyStats[key].push(ur.score);
      });
    });

    // Check for consecutive days with same count and avg
    const sortedDates = Object.keys(dailyStats).sort((a, b) => new Date(a) - new Date(b));

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

      if (diff === 1) {
        const prevScores = dailyStats[sortedDates[i - 1]];
        const currScores = dailyStats[sortedDates[i]];

        if (prevScores.length === currScores.length && prevScores.length >= 10) {
          const prevAvg = prevScores.reduce((sum, s) => sum + s, 0) / prevScores.length;
          const currAvg = currScores.reduce((sum, s) => sum + s, 0) / currScores.length;

          // Same count and avg within 0.5 points
          if (Math.abs(prevAvg - currAvg) < 0.5) {
            unlockAchievement('mirroring');
            break;
          }
        }
      }
    }
  } catch {}
}

/**
 * Check memory garden (기억의 정원: 각 단원 최고점 95점 이상)
 */
export function checkMemoryGarden() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];
    if (!allData || !allData.length) return;

    // Get highest score per chapter
    const chapterHighScores = {};
    allData.forEach(q => {
      const ch = String(q.단원).trim();
      const record = questionScores[normId(q.고유ID)];
      if (record && record.score !== undefined) {
        if (!chapterHighScores[ch] || record.score > chapterHighScores[ch]) {
          chapterHighScores[ch] = record.score;
        }
      }
    });

    // All chapters must have at least one problem with 95+
    const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];
    const allAbove95 = chapters.every(ch => chapterHighScores[String(ch)] >= 95);

    if (allAbove95) {
      unlockAchievement('memory_garden');
    }
  } catch {}
}

/**
 * Check pattern breaker (패턴 브레이커: 7일 연속 다른 시간대)
 */
export function checkPatternBreaker() {
  try {
    const questionScores = window.questionScores || {};

    // Get first unique solve time slot per day (0-6, 6-12, 12-18, 18-24)
    const dailyTimeSlots = {};
    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 첫 풀이 시간대 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const hour = d.getHours();
        const slot = Math.floor(hour / 6); // 0, 1, 2, 3

        const dayKey = new Date(d);
        dayKey.setHours(0, 0, 0, 0);
        const dayStr = dayKey.toDateString();

        if (!dailyTimeSlots[dayStr] || d < dailyTimeSlots[dayStr].time) {
          dailyTimeSlots[dayStr] = { time: d, slot };
        }
      });
    });

    // Check for 7 consecutive days with all different slots
    const sortedDays = Object.keys(dailyTimeSlots).sort((a, b) => new Date(a) - new Date(b));
    let streak = 1;
    let prevDate = null;
    let prevSlot = null;

    for (const dayStr of sortedDays) {
      const d = new Date(dayStr);
      const slot = dailyTimeSlots[dayStr].slot;

      if (prevDate) {
        const diff = Math.floor((d - prevDate) / (1000 * 60 * 60 * 24));
        if (diff === 1 && slot !== prevSlot) {
          streak++;
          if (streak >= 7) {
            unlockAchievement('pattern_breaker');
            break;
          }
        } else {
          streak = 1;
        }
      }

      prevDate = d;
      prevSlot = slot;
    }
  } catch {}
}

/**
 * Check day-specific achievements (월요병, 불금, 일요일)
 */
export function checkDaySpecificAchievements() {
  try {
    const questionScores = window.questionScores || {};

    // Count problems by day of week (고유 회독수 기반)
    const dayProblems = { 1: [], 5: [], 0: [] }; // Monday, Friday, Sunday

    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 요일별 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const day = d.getDay();
        const hour = d.getHours();
        const dateKey = new Date(d);
        dateKey.setHours(0, 0, 0, 0);
        const dateStr = dateKey.toDateString();

        // Monday (1)
        if (day === 1) {
          if (!dayProblems[1][dateStr]) dayProblems[1][dateStr] = 0;
          dayProblems[1][dateStr]++;
        }

        // Friday evening (5, 18-24)
        if (day === 5 && hour >= 18) {
          if (!dayProblems[5][dateStr]) dayProblems[5][dateStr] = 0;
          dayProblems[5][dateStr]++;
        }

        // Sunday (0)
        if (day === 0) {
          if (!dayProblems[0][dateStr]) dayProblems[0][dateStr] = 0;
          dayProblems[0][dateStr]++;
        }
      });
    });

    // Check Monday: 30 problems
    Object.values(dayProblems[1]).forEach(count => {
      if (count >= 30) unlockAchievement('monday_conqueror');
    });

    // Check Friday evening: 30 problems
    Object.values(dayProblems[5]).forEach(count => {
      if (count >= 30) unlockAchievement('friday_learner');
    });

    // Check Sunday: 50 problems
    Object.values(dayProblems[0]).forEach(count => {
      if (count >= 50) unlockAchievement('sunday_miracle');
    });
  } catch {}
}

/**
 * Check time slot achievements (점심, 퇴근후, 출근전)
 */
export function checkTimeSlotAchievements() {
  try {
    const questionScores = window.questionScores || {};

    let lunchCount = 0; // 12-13
    let afterWorkCount = 0; // 18-20
    let morningCount = 0; // 7-9

    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) {
        return;
      }
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 시간대별 집계
      uniqueReads.forEach(t => {
        const hour = new Date(t).getHours();

        if (hour >= 12 && hour < 13) lunchCount++;
        if (hour >= 18 && hour < 20) afterWorkCount++;
        if (hour >= 7 && hour < 9) morningCount++;
      });
    });

    if (lunchCount >= 10) unlockAchievement('lunch_learner');
    if (afterWorkCount >= 20) unlockAchievement('after_work_warrior');
    if (morningCount >= 20) unlockAchievement('morning_learner');
  } catch {}
}

/**
 * Check holiday achievements (신정, 크리스마스, 설날)
 */
export function checkHolidayAchievements() {
  try {
    const questionScores = window.questionScores || {};

    // Lunar New Year dates (hardcoded 2024-2030)
    const lunarNewYears = [
      '2024-02-10', '2025-01-29', '2026-02-17', '2027-02-06',
      '2028-01-26', '2029-02-13', '2030-02-03'
    ];

    // Count by specific dates (고유 회독수 기반)
    const holidayProblems = {};

    Object.values(questionScores).forEach(record => {
      if (!record.solveHistory || !Array.isArray(record.solveHistory) || record.solveHistory.length === 0) return;
      
      // 5분 윈도우 기반으로 고유 회독 추출
      const times = record.solveHistory
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      const uniqueReads = [];
      
      for (const t of times) {
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          uniqueReads.push(t);
          lastTime = t;
        }
      }
      
      // 고유 회독만 날짜별 집계
      uniqueReads.forEach(t => {
        const d = new Date(t);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (!holidayProblems[dateStr]) holidayProblems[dateStr] = 0;
        holidayProblems[dateStr]++;
      });
    });

    // Check each date
    Object.entries(holidayProblems).forEach(([dateStr, count]) => {
      if (count < 30) return;

      const [year, month, day] = dateStr.split('-');

      // New Year (1/1)
      if (month === '01' && day === '01') {
        unlockAchievement('new_year_dedication');
      }

      // Christmas (12/25)
      if (month === '12' && day === '25') {
        unlockAchievement('christmas_studier');
      }

      // Lunar New Year
      if (lunarNewYears.includes(dateStr)) {
        unlockAchievement('lunar_new_year');
      }
    });
  } catch {}
}

/**
 * Check N-Rotation achievements (회독 수 체크) - Achievement System 2.0
 * 전체 DB 문제 중 95% 이상을 N번 이상 풀었는지 확인
 */
export function checkRotationAchievements() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];

    if (!allData || allData.length === 0) return;

    // 전체 문제 수 (예: 690)
    const totalDBCount = allData.length;

    // 유효성 기준 (전체 문제의 95% 이상을 건드렸을 때 회독 인정)
    // 이유: 신규 문제가 추가되거나, 1~2개 빼먹은 것 때문에 달성 안 되면 스트레스 받음
    const threshold = Math.floor(totalDBCount * 0.95);

    console.log(`🔍 [Rotation] 전체 문제 수: ${totalDBCount}, 95% 기준: ${threshold}`);

    // 각 회독수별 달성 문제 수 카운트
    let rotation1 = 0;
    let rotation3 = 0;
    let rotation5 = 0;
    let rotation7 = 0;

    allData.forEach(q => {
      const record = questionScores[normId(q.고유ID)];
      const solveCount = getUniqueReadCount(record?.solveHistory || []);

      if (solveCount >= 1) rotation1++;
      if (solveCount >= 3) rotation3++;
      if (solveCount >= 5) rotation5++;
      if (solveCount >= 7) rotation7++;
    });

    console.log(`🔍 [Rotation] 회독 현황:`, {
      '1회 이상': rotation1,
      '3회 이상': rotation3,
      '5회 이상': rotation5,
      '7회 이상': rotation7
    });

    // 업적 해금
    if (rotation1 >= threshold) {
      console.log(`✅ [Rotation] 1회독 달성! (${rotation1}/${totalDBCount})`);
      unlockAchievement('rotation_1');
    }
    if (rotation3 >= threshold) {
      console.log(`✅ [Rotation] 3회독 달성! (${rotation3}/${totalDBCount})`);
      unlockAchievement('rotation_3');
    }
    if (rotation5 >= threshold) {
      console.log(`✅ [Rotation] 5회독 달성! (${rotation5}/${totalDBCount})`);
      unlockAchievement('rotation_5');
    }
    if (rotation7 >= threshold) {
      console.log(`✅ [Rotation] 7회독 달성! (${rotation7}/${totalDBCount})`);
      unlockAchievement('rotation_7');
    }

  } catch (e) {
    console.error('❌ [Rotation] 회독 체크 중 오류:', e);
  }
}

/**
 * Check platinum mastery (전 단원 평균 88점 달성)
 */
export function checkPlatinumMastery() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];
    if (!allData || !allData.length) return;

    const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];
    let allAbove88 = true;

    for (const chNum of chapters) {
      const chStr = String(chNum);
      const chapterProblems = allData.filter(q => String(q.단원).trim() === chStr);
      const solvedWithScores = chapterProblems.filter(q => {
        const record = questionScores[normId(q.고유ID)];
        return record && record.score !== undefined;
      }).map(q => questionScores[normId(q.고유ID)].score);

      if (solvedWithScores.length === 0) {
        allAbove88 = false;
        break;
      }

      const avgScore = solvedWithScores.reduce((sum, score) => sum + score, 0) / solvedWithScores.length;
      if (avgScore < 88) {
        allAbove88 = false;
        break;
      }
    }

    if (allAbove88) {
      unlockAchievement('platinum_mastery');
    }
  } catch {}
}

/**
 * Check diamond perfect (전 단원 평균 92점 이상)
 */
export function checkDiamondPerfect() {
  try {
    const questionScores = window.questionScores || {};
    const allData = window.allData || [];
    if (!allData || !allData.length) return;

    const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];
    let allAbove92 = true;

    for (const chNum of chapters) {
      const chStr = String(chNum);
      const chapterProblems = allData.filter(q => String(q.단원).trim() === chStr);
      const solvedWithScores = chapterProblems.filter(q => {
        const record = questionScores[normId(q.고유ID)];
        return record && record.score !== undefined;
      }).map(q => questionScores[normId(q.고유ID)].score);

      if (solvedWithScores.length === 0) {
        allAbove92 = false;
        break;
      }

      const avgScore = solvedWithScores.reduce((sum, score) => sum + score, 0) / solvedWithScores.length;
      if (avgScore < 92) {
        allAbove92 = false;
        break;
      }
    }

    if (allAbove92) {
      unlockAchievement('diamond_perfect');
    }
  } catch {}
}

/**
 * Check perfect straight 10 (10개의 새로운 문제를 연속으로 100점 달성)
 */
export function checkPerfectStraight10() {
  try {
    const questionScores = window.questionScores || {};

    // Get all first unique attempts sorted by date
    const firstAttempts = [];
    Object.values(questionScores).forEach(record => {
      const uniqueReads = getUniqueReadCount(record?.solveHistory || []);
      if (uniqueReads === 0) return;
      
      // 첫 고유 회독 찾기
      const times = (record.solveHistory || [])
        .map(x => +x?.date)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      
      if (times.length === 0) return;
      
      let lastTime = -Infinity;
      let firstUniqueAttempt = null;
      
      for (let i = 0; i < record.solveHistory.length; i++) {
        const h = record.solveHistory[i];
        const t = +h?.date;
        if (!Number.isFinite(t)) continue;
        
        if (t - lastTime >= 5 * 60 * 1000) { // UNIQUE_WINDOW_MS
          if (firstUniqueAttempt === null) {
            firstUniqueAttempt = { date: t, score: h.score };
          }
          lastTime = t;
        }
      }
      
      if (firstUniqueAttempt) {
        firstAttempts.push({ date: firstUniqueAttempt.date, score: firstUniqueAttempt.score });
      }
    });

    firstAttempts.sort((a, b) => a.date - b.date);

    // Check for 10 consecutive 100-point first unique attempts
    let consecutivePerfects = 0;
    for (const attempt of firstAttempts) {
      if (attempt.score === 100) {
        consecutivePerfects++;
        if (consecutivePerfects >= 10) {
          unlockAchievement('perfect_straight_10');
          return;
        }
      } else {
        consecutivePerfects = 0;
      }
    }
  } catch {}
}

/**
 * Initialize achievement event listeners
 */
export function initAchievementListeners() {
  // Modal open/close buttons
  el.openAchievementsBtn?.addEventListener('click', openAchievementsModal);
  el.achievementsCloseBtn?.addEventListener('click', closeAchievementsModal);

  // Tier filter buttons
  document.querySelectorAll('.achievement-tier-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = btn.getAttribute('data-tier');
      renderAchievements(tier);
    });
  });
}

// Export to window for debugging
if (typeof window !== 'undefined') {
  window.AchievementsCore = {
    setFeaturedAchievement,
    getFeaturedAchievement,
    getFeaturedAchievementId,
    loadFeaturedAchievement
  };
}
