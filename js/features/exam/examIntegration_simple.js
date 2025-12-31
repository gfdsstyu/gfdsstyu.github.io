/**
 * Simple Exam Integration for Testing
 */

console.log('🧪 [Simple] examIntegration_simple.js loaded');

export async function enterExamMode() {
  console.log('🧪 [Simple] enterExamMode called');
  alert('Simple Exam Mode - 모듈 로딩 성공!');
}

export function exitExamMode() {
  console.log('🧪 [Simple] exitExamMode called');
}

export function getIsExamMode() {
  return false;
}

console.log('✅ [Simple] All functions exported');
