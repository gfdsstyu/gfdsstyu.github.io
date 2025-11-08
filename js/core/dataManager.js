// ============================================
// 감린이 v4.0 - 데이터 관리자
// questions.json 로드 및 데이터 관리
// ============================================

import { getAllData, setAllData, getElements } from './stateManager.js';
import { showToast } from '../ui/domUtils.js';
import { computePartRanges } from '../utils/helpers.js';
import { PART_VALUE, chapterLabelText } from '../config/config.js';
import { updateSummary } from '../features/summary/summaryCore.js';

// ============================================
// 데이터 조회
// ============================================

/**
 * 모든 단원 번호를 중복 제거하여 정렬된 배열로 반환
 * @returns {number[]} 단원 번호 배열
 */
export function getAllChapterNums() {
  const allData = getAllData();
  return [...new Set(allData.map(i => +i.단원).filter(Number.isFinite))].sort((a, b) => a - b);
}

// ============================================
// 데이터 로드
// ============================================

/**
 * questions.json 파일 로드
 * 여러 경로 후보를 순차적으로 시도하고, 실패 시 내장 데이터 사용
 */
export async function loadData() {
  const CAND = ['questions.json', './questions.json', './data/questions.json', './assets/questions.json'];
  const errs = [];

  // 외부 파일 로드 시도
  for (const path of CAND) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) {
        errs.push(`${path}: HTTP ${res.status}`);
        continue;
      }

      const arr = await res.json();
      if (!Array.isArray(arr)) {
        errs.push(`${path}: JSON 최상위가 배열 아님`);
        continue;
      }

      const need = ['고유ID', '단원', '물음', '정답'];
      const bad = arr.findIndex(r => !r || need.some(k => !(k in r)));
      if (bad !== -1) {
        errs.push(`${path}: 필수키 누락(index ${bad})`);
        continue;
      }

      // 성공: 데이터 설정
      setAllData(arr);
      console.info('[questions.json] loaded from', path);

      selfTest();
      populateChapterSelect();
      updateSummary();

      return;
    } catch (e) {
      errs.push(`${path}: ${e.message}`);
    }
  }

  // 모든 외부 파일 실패: 내장 데이터 폴백
  try {
    const el = getElements();
    const node = el?.datasetJson || document.getElementById('dataset-json');
    if (!node) throw new Error('dataset-json 없음');

    const text = (node.textContent || '').trim();
    if (!text) throw new Error('내장 데이터 비어 있음');

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('내장 데이터 최상위가 배열 아님');

    setAllData(parsed);
    console.warn('[questions.json] 모든 후보 실패. 내장 데이터로 폴백', errs);
    showToast('외부 DB 실패 → 내장 데이터 사용', 'warn');

    selfTest();
    populateChapterSelect();
    updateSummary();
  } catch (err) {
    console.error('질문 데이터 로드 실패:', errs, err);
    showToast('문제 데이터 로드 실패: 콘솔 확인', 'error');

    const el = getElements();
    const questionText = el?.questionText || document.getElementById('question-text');
    if (questionText) {
      questionText.textContent = '문제 데이터 로드 실패 (questions.json 또는 dataset-json 확인).';
    }
  }
}

// ============================================
// 데이터 검증
// ============================================

/**
 * 로드된 데이터의 무결성 검증
 * - 필수 필드 누락 체크
 * - 중복 고유ID 체크
 * - 단원 데이터 존재 체크
 */
export function selfTest() {
  const allData = getAllData();

  // 필수 필드 누락 체크
  const miss = [];
  allData.forEach((r, i) => {
    if (!(r && '고유ID' in r && '단원' in r && '물음' in r && '정답' in r)) {
      miss.push(i + 1);
    }
  });
  if (miss.length) {
    showToast(`경고: 필수 필드 누락 ${miss.length}개`, 'warn');
  }

  // 중복 고유ID 체크
  const seen = new Set();
  const dup = [];
  for (const r of allData) {
    const k = String(r.고유ID).trim();
    if (seen.has(k)) {
      dup.push(k);
    } else {
      seen.add(k);
    }
  }
  if (dup.length) {
    showToast(`경고: 중복 고유ID ${dup.length}개`, 'warn');
  }

  // 단원 데이터 존재 체크
  if (!new Set(allData.map(r => String(r.단원).trim())).size) {
    throw new Error('단원 데이터 없음');
  }
}

// ============================================
// UI 업데이트
// ============================================

/**
 * 챕터 선택 드롭다운 채우기
 * Part 구분선과 각 챕터 옵션 생성
 */
export function populateChapterSelect() {
  const el = getElements();
  if (!el?.chapterSelect) {
    console.warn('chapterSelect element not found');
    return;
  }

  // 기존 옵션 제거 (첫 번째 "전체" 옵션은 유지)
  while (el.chapterSelect.options.length > 1) {
    el.chapterSelect.remove(1);
  }

  const chNums = getAllChapterNums();
  const ranges = computePartRanges(chNums);

  for (const r of ranges) {
    // Part 구분선 옵션
    const opt = document.createElement('option');
    opt.value = PART_VALUE(r.start, r.end);
    opt.textContent = `--- ${r.label} (${r.start}~${r.end}장) ---`;
    opt.className = 'text-gray-700';
    el.chapterSelect.appendChild(opt);

    // 해당 Part의 챕터들
    chNums
      .filter(n => n >= r.start && n <= r.end)
      .forEach(n => {
        const copt = document.createElement('option');
        copt.value = String(n);
        copt.textContent = chapterLabelText(n);
        el.chapterSelect.appendChild(copt);
      });
  }
}
