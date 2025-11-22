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
  deleteField,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { db } from '../../app.js';
import { getCurrentUser } from '../auth/authCore.js';
import { showToast } from '../../ui/domUtils.js';
import { getPeriodKey } from '../ranking/rankingCore.js';

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

  // 비밀번호가 제공된 경우에만 검증
  if (password && password.trim().length > 0 && password.trim().length < 4) {
    return { success: false, message: '비밀번호는 최소 4자 이상이어야 합니다.' };
  }

  if (maxMembers < 2 || maxMembers > 100) {
    return { success: false, message: '최대 인원은 2~100명 사이여야 합니다.' };
  }

  // 그룹 가입 제한 체크 (최대 3개)
  const myGroups = await getMyGroups();
  if (myGroups.length >= 3) {
    return { success: false, message: '최대 3개 그룹까지만 가입할 수 있습니다.' };
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
      password: password?.trim() || '', // 비밀번호 선택사항 (빈 문자열 = 비밀번호 없음)
      ownerId: currentUser.uid,
      createdAt: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
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
    await setDoc(userDocRef, {
      groups: {
        [groupId]: {
          role: 'owner',
          joinedAt: serverTimestamp()
        }
      }
    }, { merge: true });

    // groupRankings 컬렉션에 초기 문서 생성 (랭킹 조회를 위해)
    const groupRankingDocRef = doc(db, 'groupRankings', groupId);
    const dailyKey = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const monthlyKey = getPeriodKey('monthly');

    await setDoc(groupRankingDocRef, {
      groupId: groupId,
      groupName: name.trim(),
      memberCount: 1,
      [`daily.${dailyKey}`]: { problems: 0, totalScore: 0, avgScore: 0 },
      [`weekly.${weeklyKey}`]: { problems: 0, totalScore: 0, avgScore: 0 },
      [`monthly.${monthlyKey}`]: { problems: 0, totalScore: 0, avgScore: 0 },
      lastUpdatedAt: serverTimestamp()
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

    // 비밀번호 확인 (비밀번호가 설정된 그룹만)
    if (groupData.password && groupData.password.trim().length > 0) {
      if (groupData.password !== password) {
        return { success: false, message: '비밀번호가 일치하지 않습니다.' };
      }
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

    // 강퇴 기록 확인 (7일간 재가입 제한)
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      const kickHistory = userData.kickHistory?.[groupId];

      if (kickHistory?.kickedAt) {
        const kickedAt = kickHistory.kickedAt.toDate();
        const daysSinceKick = (Date.now() - kickedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceKick < 7) {
          const daysRemaining = Math.ceil(7 - daysSinceKick);
          return {
            success: false,
            message: `이 그룹에서 강퇴당했습니다. ${daysRemaining}일 후에 재가입할 수 있습니다.`
          };
        }
      }
    }

    // 그룹 가입 제한 체크 (최대 3개)
    const myGroups = await getMyGroups();
    if (myGroups.length >= 3) {
      return { success: false, message: '최대 3개 그룹까지만 가입할 수 있습니다.' };
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
      memberCount: increment(1),
      lastUpdatedAt: serverTimestamp()
    });

    // groupRankings에서도 멤버 수 증가
    const groupRankingDocRef = doc(db, 'groupRankings', groupId);
    await updateDoc(groupRankingDocRef, {
      memberCount: increment(1)
    }).catch(err => console.error('❌ groupRankings memberCount 업데이트 실패:', err));

    // 사용자 문서에 그룹 멤버십 추가 (이미 위에서 선언된 userDocRef 사용)
    await setDoc(userDocRef, {
      groups: {
        [groupId]: {
          role: 'member',
          joinedAt: serverTimestamp()
        }
      }
    }, { merge: true });

    console.log('✅ [Group] 그룹 가입 완료:', groupId);
    return {
      success: true,
      message: `"${groupData.name}" 그룹에 가입했습니다!`
    };
  } catch (error) {
    console.error('❌ [Group] 그룹 가입 실패:', error);

    let errorMessage = `그룹 가입 실패: ${error.message}`;
    if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
      errorMessage = '그룹 가입 권한이 없습니다. Firebase 콘솔에서 Firestore 보안 규칙을 최신 상태로 업데이트했는지 확인하세요. (프로젝트의 FIRESTORE_RULES.md 참고)';
    }

    return {
      success: false,
      message: errorMessage
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
      memberCount: increment(-1),
      lastUpdatedAt: serverTimestamp()
    });

    // groupRankings에서도 멤버 수 감소
    const groupRankingDocRef = doc(db, 'groupRankings', groupId);
    await updateDoc(groupRankingDocRef, {
      memberCount: increment(-1)
    }).catch(err => console.error('❌ groupRankings memberCount 업데이트 실패:', err));

    // 사용자 문서에서 그룹 멤버십 삭제
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      [`groups.${groupId}`]: deleteField()
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
// 그룹 삭제
// ============================================

/**
 * 그룹 삭제 (그룹장만 가능)
 * @param {string} groupId - 그룹 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteGroup(groupId) {
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

    // 그룹장 확인
    if (groupData.ownerId !== currentUser.uid) {
      return { success: false, message: '그룹장만 그룹을 삭제할 수 있습니다.' };
    }

    // 1. groupRankings 문서 먼저 삭제 (멤버 권한이 있을 때)
    const groupRankingDocRef = doc(db, 'groupRankings', groupId);
    await deleteDoc(groupRankingDocRef).catch(err =>
      console.error(`❌ groupRankings 삭제 실패:`, err)
    );

    // 2. 모든 멤버 조회
    const membersRef = collection(db, 'groups', groupId, 'members');
    const membersSnapshot = await getDocs(membersRef);

    // 3. 모든 멤버의 users 문서에서 그룹 정보 삭제
    const deletePromises = [];
    membersSnapshot.forEach(memberDoc => {
      const userId = memberDoc.id;
      const userDocRef = doc(db, 'users', userId);
      deletePromises.push(
        updateDoc(userDocRef, {
          [`groups.${groupId}`]: deleteField()
        }).catch(err => console.error(`❌ 사용자 ${userId}의 그룹 정보 삭제 실패:`, err))
      );

      // 멤버 문서 삭제
      deletePromises.push(deleteDoc(memberDoc.ref));
    });

    await Promise.all(deletePromises);

    // 4. 그룹 문서 삭제
    await deleteDoc(groupDocRef);

    console.log('✅ [Group] 그룹 삭제 완료:', groupId);
    return {
      success: true,
      message: `"${groupData.name}" 그룹이 삭제되었습니다.`
    };
  } catch (error) {
    console.error('❌ [Group] 그룹 삭제 실패:', error);
    return {
      success: false,
      message: `그룹 삭제 실패: ${error.message}`
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
 * 그룹 검색 (공개 + 비공개 모두)
 * @param {string} searchTerm - 검색어
 * @returns {Promise<Array>}
 */
export async function searchPublicGroups(searchTerm) {
  try {
    const groupsRef = collection(db, 'groups');

    // 모든 그룹 조회 (비밀번호 설정된 그룹도 포함)
    const q = query(
      groupsRef,
      limit(50)  // 클라이언트 측에서 정렬하므로 더 많이 가져오기
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

    // 클라이언트 측 정렬 (최신순)
    groups.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    // 최대 20개로 제한
    groups = groups.slice(0, 20);

    console.log(`✅ [Group] 그룹 ${groups.length}개 검색 완료 (공개 + 비공개)`);
    return groups;
  } catch (error) {
    console.error('❌ [Group] 그룹 검색 실패:', error);
    return [];
  }
}

// ============================================
// Phase 3.5.5: 그룹 관리 기능
// ============================================

/**
 * 그룹 설명 수정 (그룹장만 가능)
 * @param {string} groupId - 그룹 ID
 * @param {string} newDescription - 새 설명
 * @returns {Promise<Object>}
 */
export async function updateGroupDescription(groupId, newDescription) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    const groupDocRef = doc(db, 'groups', groupId);
    const groupDocSnap = await getDoc(groupDocRef);

    if (!groupDocSnap.exists()) {
      return { success: false, message: '존재하지 않는 그룹입니다.' };
    }

    const groupData = groupDocSnap.data();

    // 그룹장 확인
    if (groupData.ownerId !== currentUser.uid) {
      return { success: false, message: '그룹장만 수정할 수 있습니다.' };
    }

    // 설명 업데이트
    await updateDoc(groupDocRef, {
      description: newDescription.trim(),
      lastUpdatedAt: serverTimestamp()
    });

    console.log('✅ [Group] 그룹 설명 업데이트 완료:', groupId);
    return {
      success: true,
      message: '그룹 설명이 수정되었습니다.'
    };
  } catch (error) {
    console.error('❌ [Group] 그룹 설명 업데이트 실패:', error);
    return {
      success: false,
      message: `설명 수정 실패: ${error.message}`
    };
  }
}

/**
 * 그룹 멤버 목록 조회
 * @param {string} groupId - 그룹 ID
 * @returns {Promise<Array>}
 */
export async function getGroupMembers(groupId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return [];
  }

  try {
    const membersRef = collection(db, 'groups', groupId, 'members');
    const snapshot = await getDocs(membersRef);

    const members = [];
    for (const memberDoc of snapshot.docs) {
      const memberData = memberDoc.data();

      // rankings 컬렉션에서 닉네임 가져오기
      const rankingDocRef = doc(db, 'rankings', memberDoc.id);
      const rankingDocSnap = await getDoc(rankingDocRef);
      const nickname = rankingDocSnap.exists() ? rankingDocSnap.data().nickname : '익명';

      members.push({
        userId: memberDoc.id,
        nickname: nickname,
        role: memberData.role,
        joinedAt: memberData.joinedAt
      });
    }

    console.log(`✅ [Group] 그룹 멤버 ${members.length}명 조회 완료`);
    return members;
  } catch (error) {
    console.error('❌ [Group] 그룹 멤버 조회 실패:', error);
    return [];
  }
}

/**
 * 그룹원 강퇴 (그룹장만 가능)
 * @param {string} groupId - 그룹 ID
 * @param {string} targetUserId - 강퇴할 사용자 ID
 * @returns {Promise<Object>}
 */
export async function kickMember(groupId, targetUserId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    const groupDocRef = doc(db, 'groups', groupId);
    const groupDocSnap = await getDoc(groupDocRef);

    if (!groupDocSnap.exists()) {
      return { success: false, message: '존재하지 않는 그룹입니다.' };
    }

    const groupData = groupDocSnap.data();

    // 그룹장 확인
    if (groupData.ownerId !== currentUser.uid) {
      return { success: false, message: '그룹장만 강퇴할 수 있습니다.' };
    }

    // 본인 강퇴 불가
    if (targetUserId === currentUser.uid) {
      return { success: false, message: '본인은 강퇴할 수 없습니다.' };
    }

    // 멤버 확인
    const memberDocRef = doc(db, 'groups', groupId, 'members', targetUserId);
    const memberDocSnap = await getDoc(memberDocRef);

    if (!memberDocSnap.exists()) {
      return { success: false, message: '해당 사용자가 그룹에 없습니다.' };
    }

    // 멤버 삭제
    await deleteDoc(memberDocRef);

    // 그룹 멤버 수 감소
    await updateDoc(groupDocRef, {
      memberCount: increment(-1),
      lastUpdatedAt: serverTimestamp()
    });

    // groupRankings에서도 멤버 수 감소
    const groupRankingDocRef = doc(db, 'groupRankings', groupId);
    await updateDoc(groupRankingDocRef, {
      memberCount: increment(-1)
    }).catch(err => console.error('❌ groupRankings memberCount 업데이트 실패:', err));

    // 사용자 문서에서 그룹 멤버십 삭제 및 강퇴 기록 저장
    const userDocRef = doc(db, 'users', targetUserId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      const updatedGroups = { ...userData.groups };
      delete updatedGroups[groupId];

      // 강퇴 기록 저장 (7일간 재가입 제한용)
      const kickHistory = userData.kickHistory || {};
      kickHistory[groupId] = {
        kickedAt: serverTimestamp(),
        kickedBy: currentUser.uid,
        groupName: groupData.name
      };

      await updateDoc(userDocRef, {
        groups: updatedGroups,
        kickHistory: kickHistory
      });
    }

    console.log('✅ [Group] 그룹원 강퇴 완료:', targetUserId);
    return {
      success: true,
      message: '그룹원을 강퇴했습니다.'
    };
  } catch (error) {
    console.error('❌ [Group] 그룹원 강퇴 실패:', error);
    return {
      success: false,
      message: `강퇴 실패: ${error.message}`
    };
  }
}

/**
 * 그룹장 위임 (그룹장만 가능)
 * @param {string} groupId - 그룹 ID
 * @param {string} newOwnerId - 새 그룹장이 될 사용자 ID
 * @returns {Promise<Object>}
 */
export async function delegateGroupOwner(groupId, newOwnerId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    const currentOwnerId = currentUser.uid;

    // 1. 그룹 정보 확인
    const groupDocRef = doc(db, 'groups', groupId);
    const groupDocSnap = await getDoc(groupDocRef);

    if (!groupDocSnap.exists()) {
      return { success: false, message: '존재하지 않는 그룹입니다.' };
    }

    const groupData = groupDocSnap.data();
    if (groupData.ownerId !== currentOwnerId) {
      return { success: false, message: '그룹장만 위임할 수 있습니다.' };
    }

    if (newOwnerId === currentOwnerId) {
      return { success: false, message: '자기 자신에게 위임할 수 없습니다.' };
    }

    // 2. 새 그룹장 후보가 멤버인지 확인
    const newOwnerMemberRef = doc(db, 'groups', groupId, 'members', newOwnerId);
    const newOwnerMemberSnap = await getDoc(newOwnerMemberRef);
    if (!newOwnerMemberSnap.exists()) {
      return { success: false, message: '대상 사용자가 그룹 멤버가 아닙니다.' };
    }

    // 3. 일괄 업데이트 (Batch Write)
    const batch = writeBatch(db);

    // A. 그룹 문서의 ownerId 변경
    batch.update(groupDocRef, {
      ownerId: newOwnerId,
      lastUpdatedAt: serverTimestamp()
    });

    // B. 기존 그룹장의 멤버 역할 변경 (owner -> member)
    const currentOwnerMemberRef = doc(db, 'groups', groupId, 'members', currentOwnerId);
    batch.update(currentOwnerMemberRef, { role: 'member' });

    // C. 새 그룹장의 멤버 역할 변경 (member -> owner)
    batch.update(newOwnerMemberRef, { role: 'owner' });

    // D. 사용자 문서 업데이트 (선택 사항: rules에 의해 막힐 수 있음)
    // Client-side에서는 다른 사용자의 문서를 수정하는 것이 규칙에 의해 제한될 수 있습니다.
    // 따라서 자신의 문서는 업데이트하고, 상대방 문서는 업데이트를 시도하되 실패해도 로직이 깨지지 않도록 합니다.
    // 하지만 batch는 전체 성공/실패이므로, 본인 것만 batch에 넣고 상대방 것은 별도로 처리하거나
    // 그룹 조회 시 'groups' 컬렉션의 ownerId를 기준으로 권한을 판단하도록 로직이 구성되어야 합니다.
    // (현재 getMyGroups는 users/{uid}.groups를 참조하므로 데이터 불일치 가능성 있음)
    // -> 안전하게 자신의 문서만 업데이트하고, groups 컬렉션이 진실의 원천(SSOT)이 되도록 합니다.

    const currentUserDocRef = doc(db, 'users', currentOwnerId);
    batch.update(currentUserDocRef, { [`groups.${groupId}.role`]: 'member' });

    // 실행
    await batch.commit();

    // E. (Best Effort) 새 그룹장의 users 문서 업데이트 시도 (규칙 허용 시)
    // 만약 실패하더라도 그룹 기능은 groups 컬렉션을 참조하므로 중요 기능은 작동함.
    // 리스트 표시 등 캐싱된 데이터만 일시적으로 안 맞을 수 있음.
    try {
      const newUserDocRef = doc(db, 'users', newOwnerId);
      await updateDoc(newUserDocRef, { [`groups.${groupId}.role`]: 'owner' });
    } catch (e) {
      console.warn('⚠️ 새 그룹장의 사용자 문서 업데이트 실패 (권한 문제 가능성):', e);
      // 치명적이지 않음
    }

    console.log(`✅ [Group] 그룹장 위임 완료: ${currentOwnerId} -> ${newOwnerId}`);
    return { success: true, message: '그룹장이 변경되었습니다.' };

  } catch (error) {
    console.error('❌ [Group] 그룹장 위임 실패:', error);
    return { success: false, message: `위임 실패: ${error.message}` };
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
    searchPublicGroups,
    updateGroupDescription,
    getGroupMembers,
    kickMember,
    delegateGroupOwner
  };
}
