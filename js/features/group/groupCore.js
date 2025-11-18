// ============================================
// Phase 3.5.2: 그룹 코어 (Group Core)
// ============================================

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { db } from '../../app.js';
import { getCurrentUser } from '../auth/authCore.js';
import { showToast } from '../../ui/domUtils.js';

// ============================================
// 그룹 생성
// ============================================

/**
 * 그룹 생성
 * @param {Object} groupData - 그룹 정보
 * @param {string} groupData.name - 그룹 이름
 * @param {string} groupData.description - 그룹 설명
 * @param {string} groupData.password - 그룹 비밀번호 (평문)
 * @param {boolean} groupData.isPublic - 공개 여부
 * @param {number} groupData.maxMembers - 최대 인원
 * @returns {Promise<{success: boolean, message: string, groupId?: string}>}
 */
export async function createGroup(groupData) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  const { name, description, password, isPublic, maxMembers } = groupData;

  // 유효성 검사
  if (!name || name.trim().length < 2) {
    return { success: false, message: '그룹 이름은 최소 2자 이상이어야 합니다.' };
  }

  if (name.trim().length > 30) {
    return { success: false, message: '그룹 이름은 최대 30자까지 가능합니다.' };
  }

  if (!password || password.length < 4) {
    return { success: false, message: '비밀번호는 최소 4자 이상이어야 합니다.' };
  }

  if (maxMembers < 2 || maxMembers > 100) {
    return { success: false, message: '최대 인원은 2~100명 사이여야 합니다.' };
  }

  try {
    // 그룹 ID 생성
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const groupDocRef = doc(db, 'groups', groupId);

    // 그룹 생성
    await setDoc(groupDocRef, {
      groupId: groupId,
      name: name.trim(),
      description: description?.trim() || '',
      password: password, // TODO: 해싱 필요 (bcrypt 등)
      ownerId: currentUser.uid,
      createdAt: serverTimestamp(),
      memberCount: 1,
      maxMembers: maxMembers || 50,
      isPublic: isPublic !== false, // 기본값 true
      tags: [], // TODO: 태그 기능
      rules: {
        minDailyProblems: 0,
        minWeeklyProblems: 0,
        minMonthlyProblems: 0,
        autoKickEnabled: false,
        kickGracePeriod: 3,
        kickCheckPeriod: 'weekly'
      }
    });

    // 그룹장을 멤버로 추가
    const memberDocRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
    await setDoc(memberDocRef, {
      userId: currentUser.uid,
      role: 'owner',
      joinedAt: serverTimestamp(),
      violations: {
        lastCheckedAt: null,
        warningCount: 0,
        lastViolationDate: null,
        status: 'good'
      },
      lastActiveAt: serverTimestamp()
    });

    // 사용자 문서에 그룹 멤버십 추가
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      [`groups.${groupId}`]: {
        role: 'owner',
        joinedAt: serverTimestamp()
      }
    });

    console.log('✅ [Group] 그룹 생성 완료:', groupId);
    return {
      success: true,
      message: '그룹이 생성되었습니다!',
      groupId: groupId
    };
  } catch (error) {
    console.error('❌ [Group] 그룹 생성 실패:', error);
    return {
      success: false,
      message: `그룹 생성 실패: ${error.message}`
    };
  }
}

// ============================================
// 그룹 가입
// ============================================

/**
 * 그룹 가입
 * @param {string} groupId - 그룹 ID
 * @param {string} password - 그룹 비밀번호
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function joinGroup(groupId, password) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    // 그룹 존재 확인
    const groupDocRef = doc(db, 'groups', groupId);
    const groupDocSnap = await getDoc(groupDocRef);

    if (!groupDocSnap.exists()) {
      return { success: false, message: '존재하지 않는 그룹입니다.' };
    }

    const groupData = groupDocSnap.data();

    // 비밀번호 확인
    if (groupData.password !== password) {
      return { success: false, message: '비밀번호가 일치하지 않습니다.' };
    }

    // 인원 확인
    if (groupData.memberCount >= groupData.maxMembers) {
      return { success: false, message: '그룹 인원이 가득 찼습니다.' };
    }

    // 이미 가입되어 있는지 확인
    const memberDocRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
    const memberDocSnap = await getDoc(memberDocRef);

    if (memberDocSnap.exists()) {
      return { success: false, message: '이미 가입한 그룹입니다.' };
    }

    // 멤버 추가
    await setDoc(memberDocRef, {
      userId: currentUser.uid,
      role: 'member',
      joinedAt: serverTimestamp(),
      violations: {
        lastCheckedAt: null,
        warningCount: 0,
        lastViolationDate: null,
        status: 'good'
      },
      lastActiveAt: serverTimestamp()
    });

    // 그룹 멤버 수 증가
    await updateDoc(groupDocRef, {
      memberCount: increment(1)
    });

    // 사용자 문서에 그룹 멤버십 추가
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      [`groups.${groupId}`]: {
        role: 'member',
        joinedAt: serverTimestamp()
      }
    });

    console.log('✅ [Group] 그룹 가입 완료:', groupId);
    return {
      success: true,
      message: `"${groupData.name}" 그룹에 가입했습니다!`
    };
  } catch (error) {
    console.error('❌ [Group] 그룹 가입 실패:', error);
    return {
      success: false,
      message: `그룹 가입 실패: ${error.message}`
    };
  }
}

// ============================================
// 그룹 탈퇴
// ============================================

/**
 * 그룹 탈퇴
 * @param {string} groupId - 그룹 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function leaveGroup(groupId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    // 그룹 존재 확인
    const groupDocRef = doc(db, 'groups', groupId);
    const groupDocSnap = await getDoc(groupDocRef);

    if (!groupDocSnap.exists()) {
      return { success: false, message: '존재하지 않는 그룹입니다.' };
    }

    const groupData = groupDocSnap.data();

    // 그룹장은 탈퇴 불가
    if (groupData.ownerId === currentUser.uid) {
      return {
        success: false,
        message: '그룹장은 탈퇴할 수 없습니다. 그룹을 삭제하거나 그룹장을 위임하세요.'
      };
    }

    // 멤버 확인
    const memberDocRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
    const memberDocSnap = await getDoc(memberDocRef);

    if (!memberDocSnap.exists()) {
      return { success: false, message: '가입하지 않은 그룹입니다.' };
    }

    // 멤버 삭제
    await deleteDoc(memberDocRef);

    // 그룹 멤버 수 감소
    await updateDoc(groupDocRef, {
      memberCount: increment(-1)
    });

    // 사용자 문서에서 그룹 멤버십 삭제
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      [`groups.${groupId}`]: deleteDoc()
    });

    console.log('✅ [Group] 그룹 탈퇴 완료:', groupId);
    return {
      success: true,
      message: `"${groupData.name}" 그룹에서 탈퇴했습니다.`
    };
  } catch (error) {
    console.error('❌ [Group] 그룹 탈퇴 실패:', error);
    return {
      success: false,
      message: `그룹 탈퇴 실패: ${error.message}`
    };
  }
}

// ============================================
// 그룹 조회
// ============================================

/**
 * 내가 가입한 그룹 목록 조회
 * @returns {Promise<Array>}
 */
export async function getMyGroups() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return [];
  }

  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists() || !userDocSnap.data().groups) {
      return [];
    }

    const groupIds = Object.keys(userDocSnap.data().groups);

    // 각 그룹 정보 가져오기
    const groups = [];
    for (const groupId of groupIds) {
      const groupDocRef = doc(db, 'groups', groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (groupDocSnap.exists()) {
        groups.push({
          groupId: groupId,
          ...groupDocSnap.data()
        });
      }
    }

    console.log(`✅ [Group] 내 그룹 ${groups.length}개 조회 완료`);
    return groups;
  } catch (error) {
    console.error('❌ [Group] 내 그룹 조회 실패:', error);
    return [];
  }
}

/**
 * 그룹 정보 조회
 * @param {string} groupId - 그룹 ID
 * @returns {Promise<Object|null>}
 */
export async function getGroupInfo(groupId) {
  try {
    const groupDocRef = doc(db, 'groups', groupId);
    const groupDocSnap = await getDoc(groupDocRef);

    if (!groupDocSnap.exists()) {
      return null;
    }

    return {
      groupId: groupId,
      ...groupDocSnap.data()
    };
  } catch (error) {
    console.error('❌ [Group] 그룹 정보 조회 실패:', error);
    return null;
  }
}

/**
 * 공개 그룹 검색
 * @param {string} searchTerm - 검색어
 * @returns {Promise<Array>}
 */
export async function searchPublicGroups(searchTerm) {
  try {
    const groupsRef = collection(db, 'groups');
    const q = query(
      groupsRef,
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    let groups = [];

    snapshot.forEach(doc => {
      groups.push({
        groupId: doc.id,
        ...doc.data()
      });
    });

    // 클라이언트 측 필터링 (Firestore는 문자열 부분 검색 미지원)
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      groups = groups.filter(group =>
        group.name.toLowerCase().includes(term) ||
        group.description?.toLowerCase().includes(term)
      );
    }

    console.log(`✅ [Group] 공개 그룹 ${groups.length}개 검색 완료`);
    return groups;
  } catch (error) {
    console.error('❌ [Group] 공개 그룹 검색 실패:', error);
    return [];
  }
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
  window.GroupCore = {
    createGroup,
    joinGroup,
    leaveGroup,
    getMyGroups,
    getGroupInfo,
    searchPublicGroups
  };
}
