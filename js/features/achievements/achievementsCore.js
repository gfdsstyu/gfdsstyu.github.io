/**
 * @fileoverview 업적 시스템 핵심 기능
 * - 업적 달성 및 저장
 * - 업적 알림 표시
 * - 업적 모달 관리
 */

import { el } from '../../ui/elements.js';
import { showToast } from '../../ui/domUtils.js';
import { ACHIEVEMENTS, ACHIEVEMENTS_LS_KEY } from '../../config/config.js';
import { normId } from '../../utils/helpers.js';

// Module state
let achievementsData = {};

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

  // Check problem count
  const totalProblems = Object.keys(questionScores).length;
  if (totalProblems >= 100) unlockAchievement('problems_100');
  if (totalProblems >= 1000) unlockAchievement('problems_1000');
  if (totalProblems >= 5000) unlockAchievement('problems_5000');

  // Check average score
  if (scores.length > 0) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avgScore >= 80) unlockAchievement('avg_80');
    if (avgScore >= 90) unlockAchievement('avg_90');
    if (avgScore >= 95) unlockAchievement('avg_95');
  }

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

  // Check overcome weakness
  checkOvercomeWeakness();

  // Check comeback achievement
  checkComeback();

  // Check perfect day
  checkPerfectDay();

  // Check chapter master
  checkChapterMaster();

  // Check 1회독 완료
  check1stCompletion();

  // Check time-based achievements
  checkTimeBased();

  // Check chapter-specific achievements
  checkChapter1stCompletionPerChapter();
  checkChapterMasteryPerChapter();

  // Check all chapter mastery
  checkAllChapterMastery();

  // Check flashcard navigation achievements
  checkFlashcardAchievements();
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
    if (maxStreak >= 30) unlockAchievement('streak_30');
    if (maxStreak >= 60) unlockAchievement('streak_60');
    if (maxStreak >= 90) unlockAchievement('streak_90');
    if (maxStreak >= 120) unlockAchievement('streak_120');
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

    Object.values(questionScores).forEach(record => {
      if (record.solveHistory && Array.isArray(record.solveHistory)) {
        record.solveHistory.forEach(h => {
          const hDate = new Date(h.date);
          hDate.setHours(0, 0, 0, 0);
          const hTime = hDate.getTime();

          if (hTime === todayTime) todayCount++;
          if (hTime >= weekAgo) weekCount++;
          if (hTime >= monthAgo) monthCount++;
        });
      }
    });

    if (todayCount >= 20) unlockAchievement('daily_20');
    if (weekCount >= 100) unlockAchievement('weekly_100');
    if (monthCount >= 300) unlockAchievement('monthly_300');
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

    // Advanced sources: SS, P
    const advancedSolved = Object.keys(questionScores).filter(id => {
      const q = allData.find(item => normId(item.고유ID) === id);
      return q && ['SS', 'P'].includes(q.출처);
    });
    if (advancedSolved.length >= 10) unlockAchievement('advanced_source');

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
      if (!record.solveHistory || record.solveHistory.length < 2) return;

      const scores = record.solveHistory.map(h => h.score).filter(s => s !== undefined);
      const hadLow = scores.some(s => s < 60);
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
      if (!record.solveHistory || record.solveHistory.length < 4) return;

      const scores = record.solveHistory.map(h => h.score).filter(s => s !== undefined);
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
      if (!record.solveHistory || !Array.isArray(record.solveHistory)) return;

      record.solveHistory.forEach(h => {
        const hDate = new Date(h.date);
        hDate.setHours(0, 0, 0, 0);
        if (hDate.getTime() === todayTime && h.score !== undefined) {
          todayProblems.push(h.score);
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
      if (!record.solveHistory || !Array.isArray(record.solveHistory)) return;

      record.solveHistory.forEach(h => {
        const hDate = new Date(h.date);
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

  div.className = `bg-gradient-to-r ${tierColors[achievement.tier]} dark:from-gray-800 dark:to-gray-700 border rounded-lg p-4 ${isUnlocked ? '' : 'opacity-50 grayscale'}`;
  div.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="text-4xl">${achievement.icon}</span>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-bold text-gray-900 dark:text-gray-100">${achievement.name}</h3>
          <span class="text-xs">${tierIcons[achievement.tier]}</span>
          ${isUnlocked ? '<span class="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">달성</span>' : ''}
        </div>
        <p class="text-sm text-gray-700 dark:text-gray-300">${achievement.desc}</p>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">+ ${achievement.points}P</div>
      </div>
    </div>
  `;

  return div;
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
