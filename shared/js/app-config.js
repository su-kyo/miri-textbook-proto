export const PAGE_IDS = [
  "login",
  "home",
  "learning-vocab-card",
  "learning-vocab-matching",
  "learning-vocab-letter",
  "learning-vocab-mc",
  "learning-passage-cloze",
  "learning-passage-ox",
  "learning-passage-mc",
  "learning-complete",
  "learning-result",
  "records",
  "ranking",
  "constellations",
  "my",
];

export const PAGE_TITLES = {
  login: "로그인",
  home: "홈",
  "learning-vocab-card": "단어 카드",
  "learning-vocab-matching": "짝맞추기",
  "learning-vocab-letter": "글자 맞추기",
  "learning-vocab-mc": "어휘 객관식",
  "learning-passage-cloze": "지문 읽기",
  "learning-passage-ox": "OX",
  "learning-passage-mc": "지문 객관식",
  "learning-complete": "학습 완료",
  "learning-result": "결과",
  records: "기록",
  ranking: "랭킹",
  constellations: "별자리",
  my: "마이",
  "docs-design-system": "Design System",
};

export const LEARNING_PAGE_TO_ACTIVITY = {
  "learning-vocab-card": "vocabCard",
  "learning-vocab-matching": "vocabMatching",
  "learning-vocab-letter": "vocabLetter",
  "learning-vocab-mc": "vocabMeaningMc",
  "learning-passage-cloze": "passageCloze",
  "learning-passage-ox": "passageOx",
  "learning-passage-mc": "passageMc",
};

export const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "asset/icons/common/nav-home.svg" },
  { id: "records", label: "기록", icon: "asset/icons/common/nav-records.svg" },
  { id: "ranking", label: "랭킹", icon: "asset/icons/common/nav-ranking.svg" },
  { id: "constellations", label: "별자리", icon: "asset/icons/common/nav-constellations.svg" },
  { id: "my", label: "마이", icon: "asset/icons/common/nav-my.svg" },
];

export const HOME_CONSTELLATION_COUNT = 4;

export const DEFAULT_AVATAR = {
  theme: "green",
  head: 0,
  forehead: 0,
  eye: 0,
  mouth: 0,
};

export const HOME_PROFILE = {
  gradeLabel: "3-1",
  studentName: "김지민",
  schoolName: "울산매일매일매일국어학원",
};
