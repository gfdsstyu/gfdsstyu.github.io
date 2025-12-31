/**
 * Exam Integration Test
 * 어느 모듈에서 문제가 발생하는지 테스트
 */

console.log('📦 [Test] Step 1: Loading examService...');
import { examService } from './examService.js';
console.log('✅ [Test] Step 1 OK: examService loaded');

console.log('📦 [Test] Step 2: Loading examUI...');
import { renderExamMode } from './examUI.js';
console.log('✅ [Test] Step 2 OK: examUI loaded');

console.log('📦 [Test] Step 3: Loading authCore...');
import { getCurrentUser } from '../auth/authCore.js';
console.log('✅ [Test] Step 3 OK: authCore loaded');

console.log('📦 [Test] Step 4: Loading domUtils...');
import { showToast } from '../../ui/domUtils.js';
console.log('✅ [Test] Step 4 OK: domUtils loaded');

console.log('✅ [Test] ALL IMPORTS SUCCESSFUL');

export { examService, renderExamMode, getCurrentUser, showToast };
