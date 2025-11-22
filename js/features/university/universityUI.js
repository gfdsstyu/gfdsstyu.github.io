// ============================================
// Phase 3.6: 대학교 인증 UI (University Verification UI)
// ============================================

import { sendVerificationEmail, verifyCode, getMyUniversity } from './universityCore.js';
import { showToast } from '../../ui/domUtils.js';

// ============================================
// 대학교 인증 모달
// ============================================

/**
 * 대학교 인증 모달 열기
 */
export async function openVerifyModal() {
  // 이미 인증된 사용자인지 확인
  const universityInfo = await getMyUniversity();
  if (universityInfo) {
    showToast(`이미 ${universityInfo.university}로 인증되었습니다.`, 'info');
    return;
  }

  const modal = document.getElementById('university-verify-modal');
  if (!modal) {
    console.error('❌ [UniversityUI] 대학교 인증 모달을 찾을 수 없습니다.');
    return;
  }

  // 폼 초기화
  document.getElementById('university-email').value = '';
  const codeSection = document.getElementById('verification-code-section');
  if (codeSection) {
    codeSection.classList.add('hidden');
  }

  // 모달을 body의 직계 자식으로 이동 (최상위 레벨 보장)
  if (modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/**
 * 대학교 인증 모달 닫기
 */
export function closeVerifyModal() {
  const modal = document.getElementById('university-verify-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/**
 * 인증 메일 발송 처리
 */
async function handleVerifySubmit(e) {
  e.preventDefault();

  const email = document.getElementById('university-email').value;

  // 로딩 표시
  const submitBtn = document.getElementById('university-verify-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '발송 중...';

  try {
    const result = await sendVerificationEmail(email);

    if (result.success) {
      showToast(result.message, 'success');

      // 인증 코드 입력 섹션 표시
      const codeSection = document.getElementById('verification-code-section');
      if (codeSection) {
        codeSection.classList.remove('hidden');
      }
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [UniversityUI] 이메일 발송 오류:', error);
    showToast('이메일 발송 중 오류가 발생했습니다.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * 인증 코드 검증 처리
 */
async function handleCodeVerify(e) {
  e.preventDefault();

  const code = document.getElementById('verification-code').value;

  // 로딩 표시
  const submitBtn = document.getElementById('verification-code-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '확인 중...';

  try {
    const result = await verifyCode(code);

    if (result.success) {
      showToast(result.message, 'success');
      closeVerifyModal();

      // 페이지 새로고침 (랭킹 UI 업데이트를 위해)
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [UniversityUI] 인증 코드 확인 오류:', error);
    showToast('인증 코드 확인 중 오류가 발생했습니다.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ============================================
// 이벤트 리스너 초기화
// ============================================

/**
 * 대학교 인증 UI 이벤트 리스너 초기화
 */
export function initUniversityUI() {
  // 인증 메일 발송 폼
  const verifyForm = document.getElementById('university-verify-form');
  verifyForm?.addEventListener('submit', handleVerifySubmit);

  // 인증 코드 확인 폼
  const codeForm = document.getElementById('verification-code-form');
  codeForm?.addEventListener('submit', handleCodeVerify);

  // 모달 닫기 버튼
  const closeBtn = document.getElementById('university-verify-close-btn');
  closeBtn?.addEventListener('click', closeVerifyModal);

  console.log('✅ University UI 모듈 초기화 완료');
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
  window.UniversityUI = {
    openVerifyModal,
    closeVerifyModal
  };
}
