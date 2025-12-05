// ============================================
// 감린이 v4.0 - 유틸리티 헬퍼 함수
// ============================================

import { PART_INSERTIONS } from '../config/config.js';

/**
 * 값을 min과 max 사이로 제한
 */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));

/**
 * ID 문자열 정규화 (trim)
 */
export const normId = (v) => String(v).trim();

/**
 * AI 모델 응답 텍스트 정제 (JSON 추출)
 */
export const sanitizeModelText = (t) => {
  let s = (t || '').trim();
  // 코드 블록 제거
  if (s.startsWith('```')) {
    s = s.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
  }
  // BOM 제거
  s = s.replace(/^\uFEFF/, '');
  // JSON 객체만 추출
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1 && b > a) {
    s = s.slice(a, b + 1);
  }
  return s;
};

/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환
 */
export const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/**
 * 요일 인덱스 계산 (월요일=0)
 */
export const dowMon0 = (d) => (d.getDay() + 6) % 7;

/**
 * HSL을 HEX 색상 코드로 변환
 */
export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * 학습량(count)에 따른 색상 계산
 * @returns {{ bg: string, fg: string }}
 */
export function colorForCount(c) {
  if (!Number.isFinite(c) || c <= 0) {
    return { bg: '#e5e7eb', fg: '#111827' };
  }

  const fgForL = (l) => (l < 55 ? '#ffffff' : '#111827');

  // 1~6: 노란색 계열
  if (c >= 1 && c <= 6) {
    const steps = 6;
    const idx = c - 1;
    const h = 50;
    const s = 95;
    const lStart = 92;
    const lEnd = 55;
    const l = lStart + (lEnd - lStart) * (idx / (steps - 1));
    return { bg: hslToHex(h, s, l), fg: fgForL(l) };
  }

  // 7~15: 초록색 계열
  if (c >= 7 && c <= 15) {
    const steps = 9;
    const idx = c - 7;
    const h = 140;
    const s = 85;
    const lStart = 92;
    const lEnd = 45;
    const l = lStart + (lEnd - lStart) * (idx / (steps - 1));
    return { bg: hslToHex(h, s, l), fg: fgForL(l) };
  }

  // 16~30: 파란색 계열
  if (c >= 16 && c <= 30) {
    const steps = 15;
    const idx = c - 16;
    const h = 210;
    const s = 85;
    const lStart = 92;
    const lEnd = 40;
    const l = lStart + (lEnd - lStart) * (idx / (steps - 1));
    return { bg: hslToHex(h, s, l), fg: fgForL(l) };
  }

  // 30 초과: 진한 파란색
  return { bg: '#1e40af', fg: '#ffffff' };
}

/**
 * 주어진 단원 번호 배열을 기반으로 Part 범위 계산
 */
export function computePartRanges(chapterNums) {
  if (!chapterNums.length) return [];

  const parts = [...PART_INSERTIONS].sort((a, b) => a.before - b.before);
  const maxCh = Math.max(...chapterNums);
  const ranges = [];

  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].before;
    const end = (i + 1 < parts.length) ? (parts[i + 1].before - 1) : maxCh;
    if (chapterNums.some((n) => n >= start && n <= end)) {
      ranges.push({ start, end, label: parts[i].label });
    }
  }

  return ranges;
}
