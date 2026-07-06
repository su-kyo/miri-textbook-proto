export function createViewStore(initialState) {
  let state = structuredClone(initialState);
  const listeners = new Set();

  return {
    getState() {
      return structuredClone(state);
    },
    update(patchOrUpdater) {
      const nextState =
        typeof patchOrUpdater === "function" ? patchOrUpdater(structuredClone(state)) : { ...state, ...patchOrUpdater };
      state = structuredClone(nextState);
      listeners.forEach((listener) => listener(this.getState()));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
