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
// localStorage 백업 상수
// ============================================

const QUESTIONS_BACKUP_KEY = 'questions_data_backup';
const QUESTIONS_BACKUP_VERSION = 'v1';
const QUESTIONS_BACKUP_TIMESTAMP_KEY = 'questions_data_timestamp';

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
// localStorage 백업/복원
// ============================================

/**
 * 데이터를 localStorage에 백업
 * @param {Array} data - 백업할 데이터
 */
function backupDataToLocalStorage(data) {
  try {
    const backup = {
      version: QUESTIONS_BACKUP_VERSION,
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(QUESTIONS_BACKUP_KEY, JSON.stringify(backup));
    localStorage.setItem(QUESTIONS_BACKUP_TIMESTAMP_KEY, backup.timestamp.toString());
    console.info('✅ [Backup] 데이터를 localStorage에 백업했습니다');
  } catch (err) {
    console.warn('⚠️ [Backup] localStorage 백업 실패:', err.message);
    // localStorage 공간 부족 등의 이유로 실패할 수 있음 (치명적이지 않음)
  }
}

/**
 * localStorage에서 데이터 복원
 * @returns {Array|null} 복원된 데이터 또는 null
 */
function restoreDataFromLocalStorage() {
  try {
    const backupStr = localStorage.getItem(QUESTIONS_BACKUP_KEY);
    if (!backupStr) return null;

    const backup = JSON.parse(backupStr);

    // 버전 체크
    if (backup.version !== QUESTIONS_BACKUP_VERSION) {
      console.warn('⚠️ [Restore] 백업 버전 불일치, 백업 무시');
      return null;
    }

    // 데이터 유효성 체크
    if (!Array.isArray(backup.data) || backup.data.length === 0) {
      console.warn('⚠️ [Restore] 백업 데이터 형식 오류');
      return null;
    }

    const age = Date.now() - backup.timestamp;
    const ageHours = Math.floor(age / (1000 * 60 * 60));

    console.info(`✅ [Restore] localStorage에서 데이터 복원 (${ageHours}시간 전 백업)`);
    return backup.data;
  } catch (err) {
    console.warn('⚠️ [Restore] localStorage 복원 실패:', err.message);
    return null;
  }
}

// ============================================
// 데이터 로드
// ============================================

/**
 * questions.json 파일 로드
 * 3단계 안전망: fetch → localStorage 백업 → 내장 데이터
 */
export async function loadData() {
  const CAND = ['questions.json', './questions.json', './data/questions.json', './assets/questions.json'];
  const errs = [];

  // ==========================================
  // 1단계: 외부 파일 로드 시도 (우선순위 최상)
  // ==========================================
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

      // ✅ 성공: 데이터 설정 및 localStorage 백업
      setAllData(arr);
      backupDataToLocalStorage(arr);  // 백업 저장
      console.info(`✅ [Load] questions.json 로드 성공: ${path}`);

      // STT 키워드 캐싱 트리거
      // (약간의 지연을 주어 stateManager가 확실히 업데이트되도록 함)
      setTimeout(() => {
        if (window.getBoostKeywords) {
          window.getBoostKeywords(); // 1회 호출하여 캐시 생성
        }
      }, 100);

      selfTest();
      populateChapterSelect();
      updateSummary();

      return;
    } catch (e) {
      errs.push(`${path}: ${e.message}`);
    }
  }

  // ==========================================
  // 2단계: localStorage 백업 복원 시도 (중간 안전망)
  // ==========================================
  console.warn('⚠️ [Load] 모든 외부 파일 로드 실패, localStorage 백업 시도...');
  const cachedData = restoreDataFromLocalStorage();

  if (cachedData) {
    // 백업 데이터 검증
    const need = ['고유ID', '단원', '물음', '정답'];
    const bad = cachedData.findIndex(r => !r || need.some(k => !(k in r)));

    if (bad === -1) {
      setAllData(cachedData);
      console.info(`✅ [Load] localStorage 백업에서 데이터 복원 성공 (${cachedData.length}개 문제)`);
      showToast('오프라인 모드: 캐시된 데이터 사용', 'warn');

      selfTest();
      populateChapterSelect();
      updateSummary();

      return;
    } else {
      console.warn('⚠️ [Load] localStorage 백업 데이터 손상됨');
    }
  }

  // ==========================================
  // 3단계: 내장 데이터 폴백 (최후 수단)
  // ==========================================
  console.warn('⚠️ [Load] localStorage 백업도 없음, 내장 데이터 폴백 시도...');
  try {
    const el = getElements();
    const node = el?.datasetJson || document.getElementById('dataset-json');
    if (!node) throw new Error('dataset-json 없음');

    const text = (node.textContent || '').trim();
    if (!text) throw new Error('내장 데이터 비어 있음');

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('내장 데이터 최상위가 배열 아님');

    setAllData(parsed);
    console.warn('⚠️ [Load] 내장 데이터로 폴백 (개발/테스트용 샘플 데이터)', errs);
    showToast('외부 DB 실패 → 내장 샘플 데이터 사용', 'warn');

    selfTest();
    populateChapterSelect();
    updateSummary();

    return;
  } catch (err) {
    // ==========================================
    // 모든 방법 실패: 치명적 오류
    // ==========================================
    console.error('❌ [Load] 모든 데이터 로드 방법 실패:', errs, err);
    showToast('문제 데이터 로드 완전 실패: 콘솔 확인', 'error');

    const el = getElements();
    const questionText = el?.questionText || document.getElementById('question-text');
    if (questionText) {
      questionText.textContent = '❌ 데이터 로드 실패\n\n시도한 방법:\n1. questions.json (외부 파일)\n2. localStorage 백업\n3. 내장 데이터\n\n모두 실패했습니다. 네트워크 또는 파일을 확인하세요.';
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
