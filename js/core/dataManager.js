// ============================================
// 감린이 v4.0 - 데이터 관리
// ============================================

import { PART_VALUE, chapterLabelText } from '../config/config.js';
import { computePartRanges } from '../utils/helpers.js';
import { showToast } from '../ui/domUtils.js';

/**
 * 전역 문제 데이터
 * @type {Array<Object>}
 */
export let allData = [];

/**
 * allData 설정 (외부에서 접근 가능)
 */
export function setAllData(data) {
  allData = data;
}

/**
 * allData 가져오기
 */
export function getAllData() {
  return allData;
}

/**
 * 모든 단원 번호 추출
 * @returns {Array<number>} 정렬된 단원 번호 배열
 */
export function getAllChapterNums() {
  return [...new Set(allData.map(i => +i.단원).filter(Number.isFinite))].sort((a, b) => a - b);
}

/**
 * 문제 데이터 로드
 * @param {Function} updateSummaryCallback - 로드 완료 후 호출할 콜백
 */
export async function loadData(updateSummaryCallback) {
  const CAND = ['questions.json', './questions.json', './data/questions.json', './assets/questions.json'];
  const errs = [];

  // 외부 JSON 파일 시도
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

      // 성공
      allData = arr;
      console.info('[questions.json] loaded from', path);
      selfTest();
      if (updateSummaryCallback) updateSummaryCallback();
      return;
    } catch (e) {
      errs.push(`${path}: ${e.message}`);
    }
  }

  // 폴백: 내장 데이터
  try {
    const node = document.getElementById('dataset-json');
    if (!node) throw new Error('dataset-json 없음');

    const text = (node.textContent || '').trim();
    if (!text) throw new Error('내장 데이터 비어 있음');

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('내장 데이터 최상위가 배열 아님');

    allData = parsed;
    console.warn('[questions.json] 모든 후보 실패. 내장 데이터로 폴백', errs);
    showToast('외부 DB 실패 → 내장 데이터 사용', 'warn');
    selfTest();
    if (updateSummaryCallback) updateSummaryCallback();
  } catch (err) {
    console.error('질문 데이터 로드 실패:', errs, err);
    showToast('문제 데이터 로드 실패: 콘솔 확인', 'error');
    const questionText = document.getElementById('question-text');
    if (questionText) {
      questionText.textContent = '문제 데이터 로드 실패 (questions.json 또는 dataset-json 확인).';
    }
  }
}

/**
 * 데이터 검증 (selfTest)
 */
export function selfTest() {
  // 필수 필드 검증
  const miss = [];
  allData.forEach((r, i) => {
    if (!(r && '고유ID' in r && '단원' in r && '물음' in r && '정답' in r)) {
      miss.push(i + 1);
    }
  });
  if (miss.length) {
    showToast(`경고: 필수 필드 누락 ${miss.length}개`, 'warn');
  }

  // 중복 ID 검증
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

  // 단원 데이터 검증
  if (!new Set(allData.map(r => String(r.단원).trim())).size) {
    throw new Error('단원 데이터 없음');
  }
}

/**
 * 단원 선택 UI 채우기
 * @param {HTMLSelectElement} chapterSelect - 단원 선택 엘리먼트
 */
export function populateChapterSelect(chapterSelect) {
  if (!chapterSelect) return;

  // 기존 옵션 제거 (첫 번째 "전체" 옵션 제외)
  while (chapterSelect.options.length > 1) {
    chapterSelect.remove(1);
  }

  const chNums = getAllChapterNums();
  const ranges = computePartRanges(chNums);

  for (const r of ranges) {
    // 파트 구분자 추가
    const opt = document.createElement('option');
    opt.value = PART_VALUE(r.start, r.end);
    opt.textContent = `--- ${r.label} (${r.start}~${r.end}장) ---`;
    opt.className = 'text-gray-700';
    chapterSelect.appendChild(opt);

    // 해당 파트의 단원들 추가
    chNums.filter(n => n >= r.start && n <= r.end).forEach(n => {
      const copt = document.createElement('option');
      copt.value = String(n);
      copt.textContent = chapterLabelText(n);
      chapterSelect.appendChild(copt);
    });
  }
}
