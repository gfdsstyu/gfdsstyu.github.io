/**
 * 영구 저장소 관리 (IndexedDB 백업)
 * localStorage 데이터를 IndexedDB에 자동 백업하여
 * 브라우저 캐시 삭제, git pull 등의 상황에서도 데이터 보존
 */

const DB_NAME = 'GamliniPersistentDB';
const DB_VERSION = 2;  // v2: API 키 전용 스토어 추가
const STORE_NAME = 'localStorageBackup';

// 백업할 localStorage 키 목록
const BACKUP_KEYS = [
  'gemini_api_key',                // Gemini API Key
  'grok_api_key',                  // Groq API Key
  'googleSttKey_v1',               // Google STT Key
  'auditQuizScores',               // 문제 풀이 기록
  'readSessions_v2',               // 읽음 상태
  'schemaVersion',                 // 스키마 버전
  'statsRefDate',                  // 통계 기준 날짜
  'examRefDate',                   // 시험 날짜
  'customReviewLists',             // 사용자 복습 목록
  'gamlini_chat_history',          // Gamlini 챗봇 대화 기록
  'user_settings',                 // 사용자 설정
  'theme',                         // 테마 설정
  'lastSyncTime',                  // 마지막 동기화 시간
];

// API 키 전용 상수 (Safari ITP 대응)
const API_KEY_STORE = 'apiKeyStore';
const API_KEYS = ['gemini_api_key', 'grok_api_key', 'googleSttKey_v1'];

class PersistentStorage {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * IndexedDB 초기화
   */
  async init() {
    if (this.isInitialized) return true;

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      return new Promise((resolve, reject) => {
        request.onerror = () => {
          console.error('❌ IndexedDB 열기 실패:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.isInitialized = true;
          console.log('✅ IndexedDB 초기화 완료');
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Object Store 생성 (키-값 저장소)
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            console.log('📦 IndexedDB Object Store 생성');
          }

          // v2: API 키 전용 스토어 (Safari ITP 대응)
          if (!db.objectStoreNames.contains(API_KEY_STORE)) {
            db.createObjectStore(API_KEY_STORE, { keyPath: 'key' });
            console.log('🔐 IndexedDB API Key Store 생성');
          }
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB 초기화 실패:', error);
      return false;
    }
  }

  /**
   * localStorage → IndexedDB 백업
   */
  async backupToIndexedDB() {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.db) {
      console.warn('⚠️ IndexedDB가 초기화되지 않음');
      return false;
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let backupCount = 0;

      for (const key of BACKUP_KEYS) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          store.put({
            key: key,
            value: value,
            timestamp: Date.now()
          });
          backupCount++;
        }
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(`✅ localStorage → IndexedDB 백업 완료 (${backupCount}개 항목)`);
          resolve(true);
        };

        transaction.onerror = () => {
          console.error('❌ IndexedDB 백업 실패:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDB 백업 중 오류:', error);
      return false;
    }
  }

  /**
   * IndexedDB → localStorage 복원
   */
  async restoreFromIndexedDB() {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.db) {
      console.warn('⚠️ IndexedDB가 초기화되지 않음');
      return false;
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      let restoreCount = 0;

      for (const key of BACKUP_KEYS) {
        const request = store.get(key);

        await new Promise((resolve) => {
          request.onsuccess = () => {
            const record = request.result;
            if (record && record.value) {
              // localStorage에 값이 없거나 비어있으면 복원
              const currentValue = localStorage.getItem(key);
              if (!currentValue || currentValue === '') {
                localStorage.setItem(key, record.value);
                restoreCount++;
                console.log(`♻️ 복원: ${key}`);
              }
            }
            resolve();
          };

          request.onerror = () => {
            console.warn(`⚠️ ${key} 복원 실패:`, request.error);
            resolve();
          };
        });
      }

      if (restoreCount > 0) {
        console.log(`✅ IndexedDB → localStorage 복원 완료 (${restoreCount}개 항목)`);
        return true;
      } else {
        console.log('ℹ️ 복원할 데이터 없음 (localStorage에 이미 존재)');
        return false;
      }
    } catch (error) {
      console.error('❌ IndexedDB 복원 중 오류:', error);
      return false;
    }
  }

  /**
   * 특정 키만 백업
   */
  async backupKey(key) {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.db) return false;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const value = localStorage.getItem(key);

      if (value !== null) {
        store.put({
          key: key,
          value: value,
          timestamp: Date.now()
        });
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error(`❌ ${key} 백업 실패:`, error);
      return false;
    }
  }

  /**
   * 모든 백업 데이터 조회 (디버깅용)
   */
  async getAllBackups() {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.db) return {};

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const backups = {};
          request.result.forEach(record => {
            backups[record.key] = {
              value: record.value,
              timestamp: new Date(record.timestamp).toLocaleString('ko-KR')
            };
          });
          resolve(backups);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ 백업 데이터 조회 실패:', error);
      return {};
    }
  }
}

// 싱글톤 인스턴스
export const persistentStorage = new PersistentStorage();

/**
 * 앱 시작 시 자동 복원 & 주기적 백업 설정
 */
export async function initPersistentStorage() {
  try {
    // 1. IndexedDB 초기화
    await persistentStorage.init();

    // 2. API 키 우선 복원 (Safari ITP 대응)
    await restoreAllApiKeys();

    // 3. 복원 (localStorage에 데이터가 없으면 IndexedDB에서 복원)
    await persistentStorage.restoreFromIndexedDB();

    // 4. 즉시 백업 (현재 localStorage 상태 저장)
    await persistentStorage.backupToIndexedDB();

    // 5. 주기적 백업 (5분마다)
    setInterval(async () => {
      await persistentStorage.backupToIndexedDB();
    }, 5 * 60 * 1000); // 5분

    // 6. 페이지 종료 시 백업
    window.addEventListener('beforeunload', () => {
      persistentStorage.backupToIndexedDB();
    });

    console.log('✅ 영구 저장소 시스템 초기화 완료');
    return true;
  } catch (error) {
    console.error('❌ 영구 저장소 초기화 실패:', error);
    return false;
  }
}

/**
 * localStorage.setItem 래퍼 (자동 백업)
 */
export function setItemWithBackup(key, value) {
  localStorage.setItem(key, value);

  // 백업 대상 키인 경우 IndexedDB에도 저장
  if (BACKUP_KEYS.includes(key)) {
    persistentStorage.backupKey(key).catch(err => {
      console.warn(`⚠️ ${key} 자동 백업 실패:`, err);
    });
  }
}

/**
 * 수동 백업 트리거 (설정 화면에서 사용)
 */
export async function manualBackup() {
  return await persistentStorage.backupToIndexedDB();
}

/**
 * 수동 복원 트리거 (설정 화면에서 사용)
 */
export async function manualRestore() {
  return await persistentStorage.restoreFromIndexedDB();
}

/**
 * 백업 상태 확인 (설정 화면에서 사용)
 */
export async function getBackupStatus() {
  const backups = await persistentStorage.getAllBackups();
  return {
    total: Object.keys(backups).length,
    keys: Object.keys(backups),
    details: backups
  };
}

// ============================================
// API 키 전용 저장소 (Safari ITP 대응)
// localStorage가 삭제되어도 IndexedDB에서 복원
// ============================================

/**
 * API 키를 IndexedDB에 저장 (localStorage와 함께)
 * @param {string} keyName - 키 이름 (gemini_api_key, grok_api_key, googleSttKey_v1)
 * @param {string} value - API 키 값
 */
export async function saveApiKey(keyName, value) {
  if (!API_KEYS.includes(keyName)) {
    console.warn(`⚠️ [ApiKeyStore] 알 수 없는 키: ${keyName}`);
    return false;
  }

  // localStorage에 저장
  if (value) {
    localStorage.setItem(keyName, value);
  } else {
    localStorage.removeItem(keyName);
  }

  // IndexedDB에 저장
  if (!persistentStorage.isInitialized) {
    await persistentStorage.init();
  }

  if (!persistentStorage.db) return false;

  try {
    const transaction = persistentStorage.db.transaction([API_KEY_STORE], 'readwrite');
    const store = transaction.objectStore(API_KEY_STORE);

    if (value) {
      store.put({
        key: keyName,
        value: value,
        timestamp: Date.now()
      });
    } else {
      store.delete(keyName);
    }

    return new Promise((resolve) => {
      transaction.oncomplete = () => {
        console.log(`🔐 [ApiKeyStore] ${keyName} 저장 완료`);
        resolve(true);
      };
      transaction.onerror = () => {
        console.error(`❌ [ApiKeyStore] ${keyName} 저장 실패`);
        resolve(false);
      };
    });
  } catch (error) {
    console.error(`❌ [ApiKeyStore] ${keyName} 저장 오류:`, error);
    return false;
  }
}

/**
 * API 키를 IndexedDB에서 조회 (localStorage 없으면 복원)
 * @param {string} keyName - 키 이름
 * @returns {Promise<string|null>} API 키 값
 */
export async function getApiKey(keyName) {
  // 먼저 localStorage 확인
  const localValue = localStorage.getItem(keyName);
  if (localValue) {
    return localValue;
  }

  // localStorage에 없으면 IndexedDB에서 복원 시도
  if (!persistentStorage.isInitialized) {
    await persistentStorage.init();
  }

  if (!persistentStorage.db) return null;

  try {
    const transaction = persistentStorage.db.transaction([API_KEY_STORE], 'readonly');
    const store = transaction.objectStore(API_KEY_STORE);
    const request = store.get(keyName);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const record = request.result;
        if (record && record.value) {
          // localStorage에 복원
          localStorage.setItem(keyName, record.value);
          console.log(`♻️ [ApiKeyStore] ${keyName} IndexedDB에서 복원됨`);
          resolve(record.value);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error(`❌ [ApiKeyStore] ${keyName} 조회 실패`);
        resolve(null);
      };
    });
  } catch (error) {
    console.error(`❌ [ApiKeyStore] ${keyName} 조회 오류:`, error);
    return null;
  }
}

/**
 * 모든 API 키를 IndexedDB에서 localStorage로 복원
 * (앱 시작 시 호출)
 */
export async function restoreAllApiKeys() {
  if (!persistentStorage.isInitialized) {
    await persistentStorage.init();
  }

  if (!persistentStorage.db) return 0;

  let restoredCount = 0;

  for (const keyName of API_KEYS) {
    const localValue = localStorage.getItem(keyName);
    if (!localValue) {
      const restored = await getApiKey(keyName);
      if (restored) {
        restoredCount++;
      }
    }
  }

  if (restoredCount > 0) {
    console.log(`🔐 [ApiKeyStore] ${restoredCount}개 API 키 복원 완료`);
  }

  return restoredCount;
}
