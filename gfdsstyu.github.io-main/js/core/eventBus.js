/**
 * @fileoverview 이벤트 버스 - 모듈 간 통신을 위한 Pub/Sub 패턴
 * 순환 의존성 해결을 위해 도입 (quizCore ⇄ filterCore)
 */

/**
 * 간단한 이벤트 버스 (Pub/Sub 패턴)
 * 모듈 간 직접 의존성 없이 이벤트를 통해 통신
 */
class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  /**
   * 일회성 이벤트 리스너 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * 이벤트 리스너 제거
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 제거할 콜백 함수
   */
  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  /**
   * 이벤트 발생
   * @param {string} event - 이벤트 이름
   * @param {...any} args - 전달할 인자들
   */
  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(...args));
  }

  /**
   * 모든 리스너 제거
   */
  clear() {
    this.events = {};
  }

  /**
   * 특정 이벤트의 모든 리스너 제거
   * @param {string} event - 이벤트 이름
   */
  clearEvent(event) {
    delete this.events[event];
  }
}

// 싱글톤 인스턴스 export
export const eventBus = new EventBus();
