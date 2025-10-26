export function createStore() {
  let state = {};
  const subs = new Set();
  return {
    get: () => state,
    set: (k, v) => { state = { ...state, [k]: v }; subs.forEach(fn => fn(state)); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); }
  };
}
