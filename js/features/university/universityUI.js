// ============================================
// Phase 3.6: 대학교 인증 UI (University Verification UI)
// ============================================

import { verifyUniversityEmail, getMyUniversity } from './universityCore.js';
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
 * 인증 메일 발송 처리 (간소화 버전 - 즉시 인증)
 */
async function handleVerifySubmit(e) {
  e.preventDefault();

  const email = document.getElementById('university-email').value;

  // 로딩 표시
  const submitBtn = document.getElementById('university-verify-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '처리 중...';

  try {
    const result = await verifyUniversityEmail(email);

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
    console.error('❌ [UniversityUI] 인증 오류:', error);
    showToast('인증 중 오류가 발생했습니다.', 'error');
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
  // 인증 폼
  const verifyForm = document.getElementById('university-verify-form');
  verifyForm?.addEventListener('submit', handleVerifySubmit);

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
