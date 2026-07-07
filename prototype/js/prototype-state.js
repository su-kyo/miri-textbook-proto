import { createViewStore } from "../../shared/js/view-state.js";
import { prepareInitialState } from "../../shared/js/page-renderer.js?v=20260707a";

const STORAGE_KEY = "miri-textbook-prototype-state";
const PROTOTYPE_DEBUG_DEFAULTS = {
  constellationDebug: { mode: "default", percent: 50, acquiredIds: [] },
  homeDebugOpen: false,
  letterDebugOpen: false,
};

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function persistState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    void error;
  }
}

export async function createPrototypeStore() {
  const initialState = await prepareInitialState();
  const stored = readStoredState();
  const baseState = { ...initialState, ...PROTOTYPE_DEBUG_DEFAULTS };
  const store = createViewStore(stored ? { ...baseState, ...stored } : baseState);

  store.subscribe((state) => {
    persistState(state);
  });

  return store;
}
