import { createViewStore } from "../../shared/js/view-state.js?v=20260724a";
import { prepareInitialState } from "../../shared/js/page-renderer.js?v=20260724a";

const STORAGE_KEY = "miri-textbook-prototype-state";
const PROTOTYPE_DEBUG_DEFAULTS = {
  constellationDebug: { preset: 0 },
  homeDebugOpen: false,
  homeDebugStarCount: 1,
  letterDebugOpen: false,
};
const TRANSIENT_STATE_KEYS = [
  "activeConstellationId",
  "activeConstellationSource",
  "attendanceModalOpen",
  "avatarDraft",
  "avatarModalOpen",
  "catalogNoticeActiveId",
  "catalogNoticeOpen",
  "constellationOverlayFace",
  "flashingConstellationIds",
  "homeDebugOpen",
  "letterDebugOpen",
  "rewardModal",
];

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

function sanitizeStoredState(stored, baseState) {
  if (!stored || typeof stored !== "object") {
    return null;
  }

  const sanitized = { ...stored };
  TRANSIENT_STATE_KEYS.forEach((key) => {
    if (key in baseState) {
      sanitized[key] = baseState[key];
    } else {
      delete sanitized[key];
    }
  });
  return sanitized;
}

export async function createPrototypeStore() {
  const initialState = await prepareInitialState();
  const stored = readStoredState();
  const baseState = { ...initialState, ...PROTOTYPE_DEBUG_DEFAULTS };
  const sanitizedStored = sanitizeStoredState(stored, baseState);
  const store = createViewStore(sanitizedStored ? { ...baseState, ...sanitizedStored } : baseState);

  store.subscribe((state) => {
    persistState(state);
  });

  return store;
}
