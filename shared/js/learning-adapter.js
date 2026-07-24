import { LEARNING_PAGE_TO_ACTIVITY } from "./app-config.js?v=20260724a";
import { loadLearningContentRaw } from "./data-loader.js?v=20260724a";

let cachedBundle = null;

function splitWordUnits(word = "") {
  return Array.from(String(word)).filter((char) => char && !/\s/.test(char));
}

function toInitialSound(char = "") {
  const code = char.codePointAt(0);
  if (!code || code < 0xac00 || code > 0xd7a3) {
    return char;
  }

  const initials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  const offset = code - 0xac00;
  return initials[Math.floor(offset / 588)] ?? char;
}

function buildWordFormCandidates(word = "") {
  const forms = [];
  const push = (value) => {
    if (value && !forms.includes(value)) {
      forms.push(value);
    }
  };

  push(word);

  if (word.endsWith("하다")) {
    const stem = word.slice(0, -2);
    [`${stem}해`, `${stem}한`, `${stem}할`, `${stem}하고`, `${stem}하며`, `${stem}하게`, `${stem}해서`, `${stem}하는`, `${stem}하였다`, `${stem}했다`, stem].forEach(push);
  }

  if (word.endsWith("되다")) {
    const stem = word.slice(0, -2);
    [`${stem}돼`, `${stem}된`, `${stem}될`, `${stem}되면`, `${stem}되어`, `${stem}되는`, stem].forEach(push);
  }

  if (word.endsWith("우다")) {
    const stem = word.slice(0, -2);
    [`${stem}워`, `${stem}웠`, `${stem}운`, `${stem}울`, `${stem}우니`, `${stem}워서`, stem].forEach(push);
  }

  return forms.filter((value) => {
    const unitLength = splitWordUnits(value).length;
    return unitLength >= 2 && unitLength <= 5;
  });
}

function findSentencePrompt(word) {
  const examples = Array.isArray(word?.examples) ? word.examples : [];
  const candidates = buildWordFormCandidates(word?.word ?? "");

  for (const example of examples) {
    for (const candidate of candidates) {
      const index = example.indexOf(candidate);
      if (index === -1) {
        continue;
      }

      return {
        answerText: candidate,
        sentenceBefore: example.slice(0, index),
        sentenceAfter: example.slice(index + candidate.length),
      };
    }
  }

  return null;
}

function buildLetterDistractors(unitPool, answerUnits, seed) {
  const excluded = new Set(answerUnits);
  const candidates = unitPool.filter((unit) => !excluded.has(unit));
  if (!candidates.length) {
    return [];
  }

  const needed = Math.min(3, Math.max(2, answerUnits.length - 1));
  const offset = seed % candidates.length;
  const rotated = candidates.slice(offset).concat(candidates.slice(0, offset));
  return rotated.slice(0, needed);
}

function shuffleWithSeed(items, seed) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = (seed + index * 3) % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildUpperGradeLetterQuestions(bundle) {
  const cardOrder = Array.isArray(bundle.activities?.vocabCard?.cardOrder) ? bundle.activities.vocabCard.cardOrder : [];
  const orderedWords = cardOrder.map((wordId) => bundle.vocabularyIndex.get(wordId)).filter(Boolean);
  const candidates = orderedWords
    .map((word) => {
      const sentencePrompt = findSentencePrompt(word);
      if (!sentencePrompt) {
        return null;
      }

      return {
        word,
        ...sentencePrompt,
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  const unitPool = [...new Set(candidates.flatMap(({ word }) => splitWordUnits(word.word)))];

  return candidates.map(({ word, answerText, sentenceBefore, sentenceAfter }, index) => {
    const answerUnits = splitWordUnits(answerText);
    const distractors = buildLetterDistractors(unitPool, answerUnits, index * 2 + answerUnits.length);

    return {
      id: `letter-upper-${index + 1}`,
      wordId: word.id,
      promptType: "sentence",
      answer: word.word,
      answerText,
      initials: answerUnits.map((unit) => toInitialSound(unit)),
      sentenceBefore,
      sentenceAfter,
      meaning: word.meaning ?? "",
      tiles: shuffleWithSeed([...answerUnits, ...distractors], index + answerUnits.length),
    };
  });
}

function buildVocabularyIndex(vocabulary) {
  return new Map(vocabulary.map((item) => [item.id, item]));
}

function buildPageIndex(flow) {
  return new Map(flow.map((key, index) => [key, index]));
}

export async function loadLearningBundle() {
  if (cachedBundle) {
    return cachedBundle;
  }

  const raw = await loadLearningContentRaw();
  const vocabulary = Array.isArray(raw.vocabulary) ? raw.vocabulary : [];
  const lesson = raw.lesson ?? {};
  const activities = raw.activities ?? {};

  cachedBundle = {
    raw,
    lesson,
    activities,
    vocabulary,
    vocabularyIndex: buildVocabularyIndex(vocabulary),
    flowIndex: buildPageIndex(Array.isArray(lesson.flow) ? lesson.flow : []),
  };

  return cachedBundle;
}

export async function getLessonMeta() {
  const bundle = await loadLearningBundle();
  return bundle.lesson;
}

export async function getVocabularyList() {
  const bundle = await loadLearningBundle();
  return bundle.vocabulary;
}

export async function getWordById(wordId) {
  const bundle = await loadLearningBundle();
  return bundle.vocabularyIndex.get(wordId) ?? null;
}

export async function getActivity(activityKey) {
  const bundle = await loadLearningBundle();
  return bundle.activities[activityKey] ?? null;
}

export async function getPageActivity(pageId) {
  const activityKey = LEARNING_PAGE_TO_ACTIVITY[pageId];
  return activityKey ? getActivity(activityKey) : null;
}

export async function getLearningProgress(pageId) {
  const bundle = await loadLearningBundle();
  const activityKey = LEARNING_PAGE_TO_ACTIVITY[pageId];
  const flow = Array.isArray(bundle.lesson.flow) ? bundle.lesson.flow : [];
  const currentIndex = bundle.flowIndex.get(activityKey) ?? 0;

  return flow.map((key, index) => ({
    key,
    active: index <= currentIndex,
  }));
}

export async function getVocabCardDeck() {
  const bundle = await loadLearningBundle();
  const activity = bundle.activities.vocabCard ?? {};

  return (activity.cardOrder ?? [])
    .map((wordId) => bundle.vocabularyIndex.get(wordId))
    .filter(Boolean);
}

export async function getVocabMatchingPairs() {
  const activity = await getActivity("vocabMatching");
  return activity?.pairs ?? [];
}

export async function getVocabLetterSet(variant = "lowerGrade") {
  const bundle = await loadLearningBundle();
  const activity = bundle.activities.vocabLetter ?? {};
  const questions = activity?.[variant]?.questions ?? [];

  if (variant === "upperGrade" && questions.length === 0) {
    return buildUpperGradeLetterQuestions(bundle);
  }

  return questions;
}

export async function getVocabMeaningQuestions() {
  const activity = await getActivity("vocabMeaningMc");
  return activity?.questions ?? [];
}

export async function getPassageClozeModel() {
  return getActivity("passageCloze");
}

export async function getPassageOxQuestions() {
  const activity = await getActivity("passageOx");
  return activity?.questions ?? [];
}

export async function getPassageMcQuestions() {
  const activity = await getActivity("passageMc");
  return activity?.questions ?? [];
}

export function getHanjaCharacterRows(word) {
  if (!word?.hanjaDetail?.characters) {
    return [];
  }

  return word.hanjaDetail.characters.map((character) => ({
    char: character.char,
    meaningSound: character.meaningSound ?? "",
    radical: character.radical ?? "",
    totalStrokes: character.totalStrokes ?? "",
    strokesExceptRadical: character.strokesExceptRadical ?? "",
  }));
}
