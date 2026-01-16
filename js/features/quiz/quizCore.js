// ============================================
// 감린이 v4.0 - 퀴즈 핵심 로직
// 문제 표시, 퀴즈 로드, 플래그 UI
// ============================================

import { normId } from '../../utils/helpers.js';
import { isPartValue } from '../../config/config.js';
import { showToast } from '../../ui/domUtils.js';
import { detectSourceGroup, getFilteredByUI } from '../filter/filterCore.js';
import { loadReadStore, computeUniqueReadsFromHistory } from '../../core/storageManager.js';

// ============================================
// 마크다운 표 렌더링 유틸리티 (grading.js와 동일)
// ============================================

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 인라인 마크다운 렌더링 (볼드, HTML 태그 허용)
 */
function renderInlineMarkdown(text) {
  if (!text) return '';

  // 먼저 HTML 이스케이프 (XSS 방지)
  let result = escapeHtml(text);

  // 하지만 일부 안전한 HTML 태그는 허용 (위첨자, 아래첨자, 줄바꿈)
  result = result.replace(/&lt;sup&gt;(.*?)&lt;\/sup&gt;/g, '<sup>$1</sup>');
  result = result.replace(/&lt;sub&gt;(.*?)&lt;\/sub&gt;/g, '<sub>$1</sub>');
  result = result.replace(/&lt;br&gt;/g, '<br>');
  result = result.replace(/&lt;br\/&gt;/g, '<br>');
  result = result.replace(/&lt;br \/&gt;/g, '<br>');

  // 마크다운 볼드 처리: **텍스트** → <strong>텍스트</strong>
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 마크다운 이탤릭 처리: *텍스트* → <em>텍스트</em>
  result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 마크다운 코드 처리: `코드` → <code>코드</code>
  result = result.replace(/`(.*?)`/g, '<code>$1</code>');

  return result;
}

/**
 * 텍스트 정규화: 과도한 줄바꿈 완화
 */
function normalizeText(text) {
  if (!text) return text;
  return text.replace(/\n{3,}/g, '\n\n');
}

/**
 * 마크다운 표를 HTML 테이블로 변환
 */
function convertMarkdownTablesToHtml(text) {
  if (!text) return text;
  text = normalizeText(text);

  const lines = text.split(/\r?\n/);
  let result = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      const tableData = parseTable(lines, i);
      if (tableData) {
        result += renderTable(tableData.headers, tableData.alignments, tableData.rows);
        i = tableData.nextIndex;
        continue;
      }
    }

    // Blockquote support
    if (line.startsWith('>')) {
      const quoteContent = line.slice(1).trim();
      result += (i > 0 ? '\n' : '') + '<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300">' + renderInlineMarkdown(quoteContent) + '</blockquote>';
      i++;
      continue;
    }

    result += (i > 0 ? '\n' : '') + renderInlineMarkdown(lines[i]);
    i++;
  }

  return result;
}

/**
 * 테이블 파싱
 */
function parseTable(lines, startIndex) {
  const tableRows = [];
  let i = startIndex;
  let alignments = [];

  const headerLine = lines[i].trim();
  if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;

  const headers = parseTableRow(headerLine);
  if (headers.length < 2) return null;
  i++;

  if (i >= lines.length) return null;
  const separatorLine = lines[i].trim();
  if (!separatorLine.startsWith('|') || !separatorLine.endsWith('|')) return null;

  alignments = parseTableRow(separatorLine).map(cell => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    if (trimmed.startsWith(':')) return 'left';
    return 'left';
  });
  i++;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const row = parseTableRow(line);
      if (row.length === headers.length) {
        tableRows.push(row);
        i++;
        continue;
      }
    }
    if (line === '') {
      i++;
      break;
    }
    break;
  }

  if (tableRows.length === 0) return null;
  return { headers, alignments, rows: tableRows, nextIndex: i };
}

/**
 * 테이블 행 파싱
 */
function parseTableRow(line) {
  const cells = line.slice(1, -1).split('|');
  return cells.map(cell => cell.trim());
}

/**
 * HTML 테이블 렌더링
 */
function renderTable(headers, alignments, rows) {
  let html = '<div class="markdown-table-wrapper overflow-x-auto my-4"><table class="markdown-table min-w-full border-collapse border border-gray-300 dark:border-gray-600">';

  html += '<thead class="bg-gray-100 dark:bg-gray-700"><tr>';
  headers.forEach((header, idx) => {
    const align = alignments[idx] || 'left';
    html += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-${align} font-bold text-gray-900 dark:text-gray-100">${renderInlineMarkdown(header)}</th>`;
  });
  html += '</tr></thead>';

  html += '<tbody>';
  rows.forEach(row => {
    html += '<tr class="hover:bg-gray-50 dark:hover:bg-gray-800">';
    row.forEach((cell, idx) => {
      const align = alignments[idx] || 'left';
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-${align} text-gray-800 dark:text-gray-200">${renderInlineMarkdown(cell)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}
import {
  getElements,
  getCurrentQuizData,
  getCurrentQuestionIndex,
  setCurrentQuizData,
  setCurrentQuestionIndex,
  getQuestionScores,
  setQuestionScores,
  saveQuestionScores,
  setSummaryViewMode,
  setActiveHintQuestionKey,
  setActiveMemoryTipQuestionKey,
  setActiveMemoQuestionKey,
  setPrevLoaded,
  getIsFlashcardMode
} from '../../core/stateManager.js';
import { showResult, handleGrade, handleHint, handleMemoryTip } from './grading.js';
import { handlePrevQuestion, handleNextQuestion } from './navigation.js';
import { eventBus } from '../../core/eventBus.js';
import { updateSummary, updateSummaryHighlight } from '../summary/summaryCore.js';

// ============================================
// 복습 플래그 UI 업데이트
// ============================================

/**
 * 복습 플래그 버튼 UI 업데이트 (★/☆, ➖)
 * @param {Object} saved - questionScores의 저장된 데이터
 */
export function updateFlagButtonsUI(saved) {
  const el = getElements();
  if (!el) return;

  const flagged = !!(saved?.userReviewFlag);
  const excluded = !!(saved?.userReviewExclude);

  // 상호배타: excluded가 true면 flagged는 false처럼 표현
  const flagVisual = flagged && !excluded;

  // ★/☆ 표시
  const starEl = el.reviewFlagToggle?.querySelector('span');
  if (starEl) {
    starEl.textContent = flagVisual ? '★' : '☆';
  }

  el.reviewFlagToggle?.setAttribute('aria-pressed', flagVisual ? 'true' : 'false');
  el.reviewExcludeToggle?.setAttribute('aria-pressed', excluded ? 'true' : 'false');
}

// ============================================
// 문제 표시
// ============================================

/**
 * 현재 문제를 화면에 표시
 */
export function displayQuestion() {
  console.log('🔍 displayQuestion 호출됨');

  const el = getElements();
  console.log('🔍 el:', el ? '✅ 존재' : '❌ null');
  if (!el) {
    console.error('❌ elements가 초기화되지 않음!');
    return;
  }

  const currentQuizData = getCurrentQuizData();
  const currentQuestionIndex = getCurrentQuestionIndex();
  console.log('🔍 currentQuizData 길이:', currentQuizData?.length || 0);
  console.log('🔍 currentQuestionIndex:', currentQuestionIndex);

  // 문제가 없으면 숨기기
  if (!currentQuizData.length) {
    console.warn('⚠️ currentQuizData가 비어있음!');
    el.quizArea?.classList.add('hidden');
    return;
  }

  const q = currentQuizData[currentQuestionIndex];
  console.log('🔍 현재 문제:', q?.고유ID, q?.물음?.substring(0, 30));
  if (!q) {
    console.error('❌ 문제 객체가 없음!');
    return;
  }

  // 퀴즈 영역 표시
  console.log('✅ 퀴즈 영역 표시 시도');
  el.quizArea?.classList.remove('hidden');

  // 회독 수 계산
  const qid = normId(q.고유ID);
  const questionScores = getQuestionScores();
  const saved = questionScores[qid];

  // ReadStore에서 회독 정보 가져오기 (없으면 히스토리에서 계산)
  const readStore = loadReadStore();
  const rs = readStore[qid];
  const reads = rs && Number.isFinite(rs.uniqueReads)
    ? rs.uniqueReads
    : computeUniqueReadsFromHistory(saved?.solveHistory || []).uniqueReads;

  // 문제 정보 표시
  if (el.questionNumber) {
    const questionLabel = `문항 ${q.표시번호 || q.물음번호 || q.고유ID}`;

    // 출처 그룹 감지 및 배지 생성
    const sourceGroup = detectSourceGroup(q.출처);
    let sourceBadge = '';
    let badgeClass = '';

    if (sourceGroup === 'basic') {
      sourceBadge = '기본';
      badgeClass = 'bg-green-100 text-green-700 border-green-300';
    } else if (sourceGroup === 'advanced') {
      sourceBadge = '심화';
      badgeClass = 'bg-purple-100 text-purple-700 border-purple-300';
    } else if (sourceGroup === 'basic-advanced') {
      sourceBadge = '기본+심화';
      badgeClass = 'bg-blue-100 text-blue-700 border-blue-300';
    } else {
      sourceBadge = '기타';
      badgeClass = 'bg-gray-100 text-gray-700 border-gray-300';
    }

    el.questionNumber.innerHTML = `
      ${questionLabel}
      <span class="ml-2 text-xs px-2 py-0.5 rounded-full border ${badgeClass}">${sourceBadge}</span>
      <span class="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700" title="현재까지의 총 회독 수">📚 ${reads}회독</span>
    `;
  }
  if (el.questionText) {
    // 마크다운 표 렌더링 적용
    const questionContent = q.물음 || '';
    el.questionText.innerHTML = convertMarkdownTablesToHtml(questionContent);
  }
  if (el.questionCounter) {
    el.questionCounter.textContent = `${currentQuestionIndex + 1} / ${currentQuizData.length}`;
  }
  if (el.dbQuestionId) {
    el.dbQuestionId.textContent = `ID: ${q.고유ID ?? '-'}`;
  }

  // 힌트 초기화
  setActiveHintQuestionKey(null);
  el.hintBox?.classList.add('hidden');
  if (el.hintBox) el.hintBox.innerHTML = '';

  // 암기팁 초기화
  setActiveMemoryTipQuestionKey(null);
  el.memoryTipContainer?.classList.add('hidden');
  if (el.memoryTipContent) el.memoryTipContent.textContent = '';

  // 메모 초기화
  setActiveMemoQuestionKey(null);
  el.userMemoContainer?.classList.add('hidden');
  if (el.userMemoInput) el.userMemoInput.value = '';
  if (el.memoCharCount) el.memoCharCount.textContent = '0';

  // 메모 버튼 텍스트 업데이트 (저장된 메모 확인)
  if (el.userMemoBtnText) {
    const hasMemo = saved?.userMemo && saved.userMemo.trim().length > 0;
    el.userMemoBtnText.textContent = hasMemo ? '메모 보기' : '메모';
  }

  // 결과 및 답안 초기화
  el.resultBox?.classList.add('hidden');
  el.modelAnswerBox?.classList.add('hidden');  // ⚠️ CRITICAL: 새 문제로 이동 시 모범답안 박스도 숨김
  if (el.userAnswer) el.userAnswer.value = '';

  // 이전 답안 버튼 초기화
  if (el.loadPrevAnswerBtn) {
    el.loadPrevAnswerBtn.textContent = '이전 답안 불러오기';
    el.loadPrevAnswerBtn.removeAttribute('aria-pressed');
  }
  setPrevLoaded(false);

  // 저장된 점수 표시 (questionScores, saved는 위에서 이미 선언됨)
  updateFlagButtonsUI(saved);

  if (saved && saved.score !== undefined) {
    showResult(saved.score, saved.feedback, q.정답);
  }

  // 네비게이션 버튼 상태
  if (el.prevBtn) {
    el.prevBtn.disabled = (currentQuestionIndex === 0);
  }
  if (el.nextBtn) {
    el.nextBtn.disabled = (currentQuizData.length - 1 === currentQuestionIndex);
  }

  // 요약 하이라이트 업데이트
  updateSummaryHighlight();
}

// ============================================
// 퀴즈 새로고침
// ============================================

/**
 * 필터 조건에 따라 퀴즈 데이터를 새로고침하고 화면 업데이트
 */
export function reloadAndRefresh() {
  console.log('🔄 reloadAndRefresh 호출됨');

  const el = getElements();
  if (!el) {
    console.error('❌ elements가 초기화되지 않음!');
    return;
  }

  // Part 선택 시 요약 뷰 모드 변경
  if (el.chapterSelect && isPartValue(el.chapterSelect.value)) {
    setSummaryViewMode('CURRENT');
    el.summaryViewCurrentBtn?.classList.add('bg-gray-100');
    el.summaryViewAllBtn?.classList.remove('bg-gray-100');
  }

  // 필터링된 데이터 가져오기 (직접 import로 순환 의존성 해결)
  const filteredData = getFilteredByUI();
  console.log('🔍 필터링된 데이터 길이:', filteredData?.length || 0);

  // 현재 퀴즈 데이터 설정 (StateManager 사용)
  setCurrentQuizData(filteredData);
  setCurrentQuestionIndex(0);

  // index.html의 전역 변수와 동기화 (하위 호환성)
  if (typeof window !== 'undefined') {
    window.currentQuizData = filteredData;
    window.currentQuestionIndex = 0;
  }

  // 플래시카드 모드 확인
  const isFlashcardMode = getIsFlashcardMode();

  if (isFlashcardMode) {
    // 플래시카드 모드 업데이트
    if (typeof window.refreshFlashcardData === 'function') {
      window.refreshFlashcardData();
    }
  } else {
    // 일반 퀴즈 모드
    if (filteredData.length) {
      el.quizArea?.classList.remove('hidden');
      el.summaryArea?.classList.remove('hidden');
      displayQuestion();
    } else {
      el.quizArea?.classList.add('hidden');
      el.summaryArea?.classList.remove('hidden');
      showToast('선택한 조건에 맞는 문제가 없습니다.', 'warn');
    }
  }

  // 요약 및 패널 업데이트
  updateSummary();
  if (typeof window.refreshPanels === 'function') {
    window.refreshPanels();
  }
}

// ============================================
// 랜덤 문제 시작
// ============================================

/**
 * 필터링된 문제 중 랜덤하게 하나 선택
 */
export function startRandomQuiz() {
  const el = getElements();
  if (!el) return;

  // 필터링된 데이터 가져오기 (직접 import로 순환 의존성 해결)
  const list = getFilteredByUI();

  if (!list.length) {
    showToast('선택 조건에 맞는 문제가 없습니다.', 'warn');
    return;
  }

  // 랜덤 인덱스 선택
  const randomIndex = Math.floor(Math.random() * list.length);

  // 현재 퀴즈 데이터 설정 (StateManager 사용)
  setCurrentQuizData(list);
  setCurrentQuestionIndex(randomIndex);

  // index.html의 전역 변수와 동기화 (하위 호환성)
  if (typeof window !== 'undefined') {
    window.currentQuizData = list;
    window.currentQuestionIndex = randomIndex;
  }

  // UI 업데이트
  el.quizArea?.classList.remove('hidden');
  el.summaryArea?.classList.remove('hidden');

  displayQuestion();

  updateSummary();
  if (typeof window.refreshPanels === 'function') {
    window.refreshPanels();
  }

  showToast('랜덤 문제 시작!');
}

// ============================================
// 이벤트 리스너 초기화 (Phase 5.1)
// ============================================

/**
 * 퀴즈 관련 이벤트 리스너 초기화
 */
export function initQuizListeners() {
  const el = getElements();
  console.log('🎯 initQuizListeners 호출됨');
  console.log('  - el:', el ? '✅ 존재' : '❌ null');
  console.log('  - el.userMemoBtn:', el?.userMemoBtn ? '✅ 존재' : '❌ null');
  if (!el) {
    console.error('❌ initQuizListeners: elements가 초기화되지 않음!');
    return;
  }

  // Navigation buttons
  el.prevBtn?.addEventListener('click', handlePrevQuestion);
  el.nextBtn?.addEventListener('click', handleNextQuestion);

  // User answer input
  el.userAnswer?.addEventListener('input', () => {
    el.errorMessage?.classList.add('hidden');
  });

  el.userAnswer?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.gradeBtn?.click();
    }
  });

  // Grade and hint buttons
  el.gradeBtn?.addEventListener('click', handleGrade);

  el.hintBtn?.addEventListener('click', () => {
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    if (cqd.length) handleHint(cqd[cqi]);
  });

  // Memory tip buttons
  el.memoryTipBtn?.addEventListener('click', () => {
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    if (cqd.length) handleMemoryTip(cqd[cqi], false);
  });

  el.memoryTipRegenBtn?.addEventListener('click', () => {
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    if (cqd.length) handleMemoryTip(cqd[cqi], true); // forceRegenerate = true
  });

  el.memoryTipCopyBtn?.addEventListener('click', () => {
    const content = el.memoryTipContent?.textContent;
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        showToast('암기 팁을 복사했습니다');
      }).catch(() => {
        showToast('복사 실패', 'error');
      });
    }
  });

  // User memo - 글자 수 카운팅
  el.userMemoInput?.addEventListener('input', (e) => {
    const len = e.target.value.length;
    if (el.memoCharCount) {
      el.memoCharCount.textContent = len;
    }
  });

  // User memo button - 메모 열기/닫기
  el.userMemoBtn?.addEventListener('click', () => {
    console.log('📝 메모 버튼 클릭됨!');
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    console.log('  - currentQuizData 길이:', cqd.length);
    if (!cqd.length) {
      console.warn('⚠️ 퀴즈 데이터가 없습니다. 먼저 문제를 로드하세요.');
      showToast('먼저 문제를 로드해주세요', 'warn');
      return;
    }

    const q = cqd[cqi];
    const qKey = normId(q.고유ID);
    const questionScores = getQuestionScores();
    const savedMemo = questionScores[qKey]?.userMemo || '';

    const isHidden = el.userMemoContainer?.classList.contains('hidden');

    if (isHidden) {
      // 메모 컨테이너 열기
      el.userMemoContainer?.classList.remove('hidden');
      if (el.userMemoInput) {
        el.userMemoInput.value = savedMemo;
      }
      if (el.memoCharCount) {
        el.memoCharCount.textContent = savedMemo.length;
      }

      // 기존 메모가 있으면 "열람"으로 간주 -> 페널티 플래그 ON
      if (savedMemo.trim().length > 0) {
        setActiveMemoQuestionKey(qKey);
        showToast('메모를 열람했습니다. (채점 시 최대 60점)', 'warn');
      } else {
        // 최초 작성 시 안내
        showToast('나만의 핵심 키워드를 50자 이내로 기록하세요!', 'info');
      }

      // 버튼 텍스트 변경
      if (el.userMemoBtnText) {
        el.userMemoBtnText.textContent = savedMemo.trim().length > 0 ? '메모 보기' : '메모 작성';
      }
    } else {
      // 메모 컨테이너 닫기
      el.userMemoContainer?.classList.add('hidden');
    }
  });

  // User memo save button - 메모 저장
  el.saveMemoBtn?.addEventListener('click', () => {
    console.log('💾 메모 저장 버튼 클릭됨!');
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    if (!cqd.length) return;

    const q = cqd[cqi];
    const qKey = normId(q.고유ID);
    const memoContent = el.userMemoInput?.value.trim() || '';

    // 로컬 저장
    const questionScores = getQuestionScores();
    if (!questionScores[qKey]) {
      questionScores[qKey] = {
        solveHistory: [],  // 빈 배열로 초기화 (0회독 상태)
        isSolved: false
      };
    }
    questionScores[qKey].userMemo = memoContent;
    setQuestionScores(questionScores);
    saveQuestionScores();

    // Firestore 동기화 (records 서브컬렉션)
    if (window.AuthCore && window.AuthCore.getCurrentUser) {
      const currentUser = window.AuthCore.getCurrentUser();
      if (currentUser && window.SyncCore && window.SyncCore.syncToFirestore) {
        window.SyncCore.syncToFirestore(currentUser.uid, qKey);
      }
    }

    showToast('메모가 저장되었습니다.', 'success');

    // 버튼 텍스트 업데이트
    if (el.userMemoBtnText) {
      el.userMemoBtnText.textContent = memoContent.length > 0 ? '메모 보기' : '메모 작성';
    }
  });

  // Review flag toggle (★) - mutually exclusive with exclude (➖)
  el.reviewFlagToggle?.addEventListener('click', () => {
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    if (!cqd.length) return;

    const q = cqd[cqi];
    const key = normId(q.고유ID);
    const questionScores = getQuestionScores(); // Fix: use getQuestionScores() instead of window.questionScores
    const rec = questionScores[key] || {};

    // willFlag: 현재 flag가 활성화될지 여부
    const willFlag = !(rec.userReviewFlag && !rec.userReviewExclude);

    if (willFlag) {
      // 추가로 전환: 제외를 해제
      if (typeof window.setFlagState === 'function') {
        window.setFlagState(key, { flag: true, exclude: false });
      }
      showToast('복습 추가로 전환(➖ 해제)');
    } else {
      // 추가 해제
      if (typeof window.setFlagState === 'function') {
        window.setFlagState(key, { flag: false, exclude: !!rec.userReviewExclude });
      }
      showToast('복습 추가 해제');
    }

    // Update UI with fresh state
    const updatedScores = getQuestionScores();
    updateFlagButtonsUI(updatedScores[key]);
    // 학습현황판 실시간 업데이트
    updateSummary();
    if (typeof window.refreshPanels === 'function') {
      window.refreshPanels();
    }
  });

  // Review exclude toggle (➖) - mutually exclusive with flag (★)
  el.reviewExcludeToggle?.addEventListener('click', () => {
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    if (!cqd.length) return;

    const q = cqd[cqi];
    const key = normId(q.고유ID);
    const questionScores = getQuestionScores(); // Fix: use getQuestionScores() instead of window.questionScores
    const rec = questionScores[key] || {};

    const willExclude = !rec.userReviewExclude;

    if (willExclude) {
      // 제외로 전환: 추가를 해제
      if (typeof window.setFlagState === 'function') {
        window.setFlagState(key, { flag: false, exclude: true });
      }
      showToast('오늘의 복습에서 제외로 전환(★ 해제)');
    } else {
      // 제외 해제 (필요시 사용자가 별도로 ★ 추가)
      if (typeof window.setFlagState === 'function') {
        window.setFlagState(key, { flag: !!rec.userReviewFlag, exclude: false });
      }
      showToast('복습 제외 해제');
    }

    // Update UI with fresh state
    const updatedScores = getQuestionScores();
    updateFlagButtonsUI(updatedScores[key]);
    // 학습현황판 실시간 업데이트
    updateSummary();
    if (typeof window.refreshPanels === 'function') {
      window.refreshPanels();
    }
  });

  // Load previous answer button
  el.loadPrevAnswerBtn?.addEventListener('click', () => {
    const cqd = getCurrentQuizData();
    const cqi = getCurrentQuestionIndex();
    if (!cqd.length) return;

    const q = cqd[cqi];
    const questionScores = window.questionScores || {};
    const saved = questionScores[normId(q.고유ID)];
    const prevLoaded = window.prevLoaded || false;

    if (!prevLoaded) {
      if (saved?.user_answer) {
        el.userAnswer.value = saved.user_answer;
        el.loadPrevAnswerBtn.textContent = '답안 지우기';
        el.loadPrevAnswerBtn.setAttribute('aria-pressed', 'true');
        window.prevLoaded = true;
        setPrevLoaded(true);
        showToast('이전 답안을 불러왔습니다.');
      } else {
        showToast('저장된 답안이 없습니다.', 'warn');
      }
    } else {
      el.userAnswer.value = '';
      el.loadPrevAnswerBtn.textContent = '이전 답안 불러오기';
      el.loadPrevAnswerBtn.setAttribute('aria-pressed', 'false');
      window.prevLoaded = false;
      setPrevLoaded(false);
    }
  });

  console.log('✅ initQuizListeners 완료 - 메모 버튼 이벤트 리스너 등록됨');
}

// ============================================
// EventBus 리스너 초기화 (순환 의존성 해결)
// ============================================

/**
 * EventBus 리스너 초기화
 * filterCore에서 발생한 quiz:reload 이벤트를 수신하여 reloadAndRefresh 실행
 */
export function initQuizEventListeners() {
  eventBus.on('quiz:reload', () => {
    console.log('🎧 EventBus: quiz:reload 이벤트 수신, reloadAndRefresh 실행');
    reloadAndRefresh();
  });
  console.log('✅ Quiz EventBus 리스너 초기화 완료');
}
