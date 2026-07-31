# 스펙: 글자 맞추기(vocab-letter) 학년 모드 + 튜토리얼 오버레이

> 이 문서는 구현 담당 AI(Opus)를 위한 **확정 스펙**이다.
> 모든 결정은 이미 사용자와 합의되어 이 문서에 반영되어 있다.
> **재해석·개선 제안·범위 확장 금지.** 문서에 없는 결정이 필요해지면 구현을 중단하고 사용자에게 질문할 것.
> 문서 기준일: 2026-07-31. 기준 커밋: `8e014d9` 이후의 main.

---

## 0. 절대 규칙

1. 이 문서에 적힌 것만 구현한다. 적히지 않은 리팩터링·정리·개선을 하지 않는다.
2. **수정 금지 영역**: `prototype/` 전체, `publish/`의 vocab-letter 외 다른 화면 html, `diagnostic-*`, 홈/별자리/랭킹/기록, `demo/`, `.claude/worktrees/` (검색 시에도 제외할 것).
3. 튜토리얼 오버레이는 **문제 데이터(JSON)를 절대 읽지 않는다.** 튜토리얼의 모든 시각 요소는 하드코딩된 스켈레톤이다.
4. 외부 라이브러리 추가 금지. 순수 HTML/CSS/JS(ES module)만 사용.
5. 캐시버스팅 토큰 규칙(§8.1)을 반드시 지킨다. 하나라도 빠뜨리면 스테일 캐시 버그가 난다.
6. grep/일괄치환 시 항상 `.git`, `demo/`, `.claude/` 제외.

---

## 1. 배경: 현재 구조 (사실관계)

### 1.1 파일 맵

| 파일 | 역할 |
|---|---|
| `publish/learning-vocab-letter.html` | 글자 맞추기 화면 (유일한 마크업. prototype의 letter 페이지는 이 페이지로 리다이렉트됨) |
| `publish/js/learning-publish-init.js` | `initVocabLetter()` (현재 1333행 부근)이 이 화면의 전체 로직 |
| `shared/js/learning-adapter.js` | `getVocabLetterSet(variant)`, `buildUpperGradeLetterQuestions(bundle)` |
| `data/learning_content.json` | `activities.vocabLetter` 아래 문항 데이터 |
| `shared/css/learning-components.css` | `letter-*` 클래스 전부 |

### 1.2 현재 변형(variant) — ⚠️ 이름 함정

| 현재 코드명 | 실제 의미 | 내용 |
|---|---|---|
| `lowerGrade` | **3~4학년** | 초성 힌트 있는 빈칸 + 뜻 + 오답 섞인 타일 (데이터 3문항) |
| `upperGrade` | **5~6학년** | 예문 빈칸 + 오답 섞인 타일 (데이터 비어있음 → `buildUpperGradeLetterQuestions`가 런타임 생성) |
| (없음) | **1~2학년** | 미구현. 이번에 신규 |

변형 결정 로직 (initVocabLetter 첫머리): `?variant=lower|upper` 쿼리 → 없으면 `lesson.grade >= 3 ? upperGrade : lowerGrade`. `?variant=` 링크는 저장소 어디에도 없다(코드만 읽음) → 레거시 값 하위호환 불필요.

### 1.3 현재 인터랙션 (3-4/5-6 공통, **변경 금지**)

탭 전용: 타일 탭 → 빈칸에 순서대로 채움 / 채워진 빈칸 탭 → 제거 / 다 채우면 자동 판정 → 정답이면 `letter-feedback-sheet`(정답! + CTA), 오답이면 shake 후 `LETTER_WRONG_FEEDBACK_MS(420ms)` 뒤 리셋. **이 화면들에 드래그를 추가하지 않는다** (비범위).

### 1.4 재사용할 기존 헬퍼 (새로 만들지 말 것)

- `openBottomSheet(sheet)` / `closeBottomSheet(sheet)` — learning-publish-init.js 상단
- `buildProgressStateMarkup(states)` — 진행 도트
- `escapeHtml` — `shared/js/learning-ui-utils.js`
- `hrefWithTheme`, `pageHref` — 라우팅
- 오버레이 포지셔닝 패턴: `.learning-exit-modal` (position:absolute; inset:0; z-index:4 — learning-shell 내부 기준)

---

## 2. 작업 A — variant 리네이밍 + 데이터 마이그레이션

### 2.1 새 변형 ID (전 영역 통일)

| 새 ID | 학년 밴드 | 유래 |
|---|---|---|
| `grade12` | 1~2학년 | 신규 (§4) |
| `grade34` | 3~4학년 | 기존 `lowerGrade` 데이터/로직 그대로 이름만 변경 |
| `grade56` | 5~6학년 | 기존 `upperGrade` 생성 로직 그대로 이름만 변경 |

### 2.2 `data/learning_content.json` 변경 (activities.vocabLetter)

1. 키 `lowerGrade` → `grade34` (내용 그대로)
2. 키 `upperGrade` → `grade56` (내용 그대로 — 빈 questions)
3. 메타 필드 `instruction`, `debugToggleTarget` **삭제** (코드 어디에서도 읽지 않는 죽은 필드임을 확인함)
4. `grade12` 키 신규 추가 — 아래 JSON을 **그대로** 넣는다 (뜻 문구는 vocabulary의 meaning과 동일):

```json
"grade12": {
  "questions": [
    {
      "id": "letter-12-01",
      "wordId": "word-green",
      "promptType": "assemble",
      "prompt": "파랑과 노랑의 중간인, 짙은 풀과 같은 색.",
      "answer": "초록색",
      "tiles": ["록", "색", "초"]
    },
    {
      "id": "letter-12-02",
      "wordId": "word-wither",
      "promptType": "assemble",
      "prompt": "꽃이나 풀 같은 식물이 물기가 말라 원래의 색이나 모양을 잃다.",
      "answer": "시들다",
      "tiles": ["다", "시", "들"]
    },
    {
      "id": "letter-12-03",
      "wordId": "word-lack",
      "promptType": "assemble",
      "prompt": "필요한 양이나 기준에 모자라거나 넉넉하지 않다.",
      "answer": "부족하다",
      "tiles": ["족", "부", "다", "하"]
    }
  ]
}
```

`tiles`는 **데이터에 고정된 섞인 순서**다. 런타임 셔플 금지 (Math.random 금지 — 이 프로젝트 관례).

### 2.3 코드 변경

- `shared/js/learning-adapter.js`
  - `getVocabLetterSet(variant = "grade34")` — 기본값 변경
  - 내부 조건 `variant === "upperGrade"` → `variant === "grade56"`
  - `buildUpperGradeLetterQuestions` → `buildGrade56LetterQuestions` 로 함수명 변경 (내부 로직 유지, 단 §3의 initials 제거 반영)
- `publish/js/learning-publish-init.js` `initVocabLetter()`
  - 변형 결정을 §5.4의 새 로직으로 교체
  - `isUpperGrade` → `isGrade56` (의미 동일: 정답 시 뜻 공개 여부)
- 리네이밍 후 저장소 전체에서 `lowerGrade|upperGrade` 잔존 0건인지 grep으로 확인 (`.claude/` 제외)

---

## 3. 작업 B — 5~6학년 빈칸 초성 제거 (피그마 정합)

피그마(노드 `170:3553`)에서 5~6학년 빈칸은 **완전히 빈 칸**이다. 초성 힌트는 3~4학년 전용.

1. `buildGrade56LetterQuestions`(구 buildUpperGradeLetterQuestions)의 반환 객체에서 `initials` 필드 제거. `toInitialSound` 함수가 이로 인해 미사용이 되면 함께 제거.
2. `normalizeQuestion`의 sentence 레이아웃 분기에서 `hints: question.initials ?? []` → `hints: []` (또는 필드 자체 제거 후 렌더에서 안전 처리). meaning 레이아웃(grade34)의 hints는 **그대로 유지**.
3. 결과: grade56 빈칸에 `letter-blank__hint`가 절대 렌더되지 않는다. grade34는 기존과 동일하게 초성 표시.

---

## 4. 작업 C — grade12 (1~2학년) 신규 모드

### 4.1 개요

빈칸/초성/오답 타일 없음. **뜻 박스 + 섞인 정답 낱자 타일 행**만 있고, 타일을 **행 안에서 재정렬**해 정답 순서를 만들면 성공. 피그마: 문제 `371:2538`, 정답 상태 `371:2585`.

### 4.2 화면 구성 (기존 DOM 구조 재사용)

기존 `learning-vocab-letter.html`은 수정 범위 최소화: §5의 헤더 버튼 추가 외 구조 변경 없음. 렌더는 JS에서 분기.

- step-info(상단): title "글자 맞추기" 고정. **description은 변형별로 하드코딩**:
  - grade12: `글자를 옮겨 단어를 완성해보세요.`
  - grade34: `초성을 보고 알맞은 글자를 옮겨 단어를 완성해보세요.`
  - grade56: `예문을 보고 어떤 단어인지 추리해보세요.`
- 진행 도트: 기존 `buildProgressStates()` 그대로 (3문항)
- 카드: `normalizeQuestion`에 `layout: "assemble"` 분기 추가 (`promptType === "assemble"` 일 때). `buildCardMarkup`의 assemble 분기:

```html
<div class="letter-assemble">
  <p class="letter-assemble__instruction">글자를 옮겨 단어를 완성해보세요.</p>
  <div class="letter-assemble__meaning">{escapeHtml(question.meaning)}</div>
</div>
```

- 카드에 modifier `letter-question-card--assemble` 부여 (기존 `--lower` 토글과 같은 방식). CSS:
  - `.letter-question-card--assemble` : `background: transparent; border: none; box-shadow: none; padding: 0;`
  - `.letter-assemble__instruction` : 14px, `var(--learning-text-secondary)`, 가운데 정렬, margin-bottom 12px
  - `.letter-assemble__meaning` : `background: var(--learning-brand-primary-soft); border-radius: 16px; padding: 20px 16px;` 글자 20px / weight 800 / line-height 1.5 / `var(--learning-text-primary)` / 가운데 정렬
- 타일 행: 기존 `[data-letter-tiles]` 컨테이너 재사용 + modifier `letter-tiles--assemble` (가운데 정렬, nowrap, gap은 기존 타일 gap 유지). 타일은 기존 `.letter-tile` 스타일 재사용.

### 4.3 상태 모델

grade12일 때 `state.assembleOrder: number[]` 를 사용 (초기값 `[0,1,...,tiles.length-1]` = 데이터의 섞인 순서 그대로). 렌더 시 `assembleOrder.map(i => question.tiles[i])` 순서로 타일을 그린다. 기존 `pickedTileIndexes`는 grade12에서 사용하지 않는다.

### 4.4 인터랙션 — 두 가지 모두 구현

**(a) 드래그 재정렬** (Pointer Events):

1. `pointerdown` 타일에서: `setPointerCapture`, 시작 x·인덱스 기록.
2. 이동 중: 해당 타일에 `transform: translateX(dx)` + 클래스 `is-dragging` (`scale(1.05)`, `z-index: 2`, 그림자 강조). 이동량 6px 미만이면 드래그로 취급하지 않는다(→ 탭으로 처리).
3. 드래그 중 삽입 위치 프리뷰: 드래그 타일 중심 x로 목표 슬롯 인덱스 계산(슬롯 폭 = 타일 폭 + gap). 목표 인덱스가 바뀔 때마다 **다른 타일들이 `transform` + `transition: transform 120ms ease`로 비켜난다** (이 "비켜남"은 필수 연출).
4. `pointerup`: 새 순서를 `assembleOrder`에 커밋하고 행을 재렌더(즉시, FLIP 불필요) → §4.5 판정.

**(b) 탭 교환 (보조)**:

1. 타일 탭 → `is-selected` (테두리 `var(--learning-brand-primary)`, 배경 `var(--learning-brand-primary-soft)`).
2. 선택 상태에서 다른 타일 탭 → 두 타일 위치 교환(assembleOrder에서 swap) 후 재렌더 → 판정. 같은 타일 재탭 → 선택 해제.

### 4.5 판정

재정렬/교환이 커밋될 때마다: `assembleOrder.map(i=>tiles[i]).join("") === answer` 이면
- `state.mode = "correct"` → 기존 정답 플로우 재사용: `letter-feedback-sheet` 열림, CTA는 기존 로직대로 마지막 문항이면 "다음 학습으로"(→ `learning-vocab-mc`), 아니면 "다음 문제".
- **grade12의 correct 상태에서는 타일 행을 숨기지 않는다** (기존 renderTiles는 correct 시 숨김 — assemble 분기에서는 완성된 순서 그대로 보여주고 `disabled` + `pointer-events: none`). 뜻 공개(`meaningReveal`)는 grade56 전용이므로 grade12에서는 열지 않는다.
- 오답 상태 없음: 순서가 틀려도 아무 피드백 없이 계속 조작 가능 (중간 과정으로 취급).
- 다음 문항 진입 시 `assembleOrder` 를 새 문항 기준으로 초기화.

---

## 5. 작업 D — 학년 전환 DEBUG 버튼

### 5.1 위치와 마크업

`publish/learning-vocab-letter.html` 헤더의 `learning-header__inner` 안, **테마 토글 버튼 바로 앞(왼쪽)** 에 정적 마크업 추가:

```html
<div class="letter-grade-switch" data-letter-grade-switch>
  <button class="letter-grade-switch__button" type="button" aria-haspopup="true" aria-expanded="false" aria-label="학년 전환 (디버그)" data-letter-grade-button>3-4학년</button>
  <div class="letter-grade-switch__popover" hidden data-letter-grade-popover>
    <span class="letter-grade-switch__tag">DEBUG</span>
    <button class="letter-grade-switch__option" type="button" data-letter-grade="12">1-2학년</button>
    <button class="letter-grade-switch__option" type="button" data-letter-grade="34">3-4학년</button>
    <button class="letter-grade-switch__option" type="button" data-letter-grade="56">5-6학년</button>
  </div>
</div>
```

버튼 라벨 텍스트는 init 시 현재 변형으로 JS가 갱신한다 ("1-2학년"/"3-4학년"/"5-6학년").

### 5.2 스타일

- `.letter-grade-switch` : `position: relative;` (헤더 flex 안에 자연 배치)
- `__button` : 높이 24px, `border-radius: 999px`, `border: 1px dashed var(--learning-border-medium)`, 배경 투명, 글자 11px `var(--learning-text-secondary)`, padding 0 8px — "디버그스러운" 점선 무드
- `__popover` : `position: absolute; top: calc(100% + 8px); right: 0; z-index: 5;` 배경 `var(--learning-surface-default)`, radius 12px, `box-shadow: 0 8px 24px rgba(0,0,0,.18)`, padding 8px, 세로 스택, 최소폭 120px
- `__tag` : 9px, letter-spacing 1px, `var(--learning-text-secondary)`, 상단에 작게
- `__option` : 풀폭 버튼, 높이 32px, radius 8px, 13px. 현재 변형인 옵션에 `is-active` (배경 `var(--learning-brand-primary-soft)`, 글자 `var(--learning-text-brand)`)
- 라이트/다크 모두 `--learning-*` 토큰만 사용하므로 자동 대응

### 5.3 동작

- 버튼 탭 → 팝오버 토글 (`hidden` + `aria-expanded`)
- 팝오버 밖 클릭 → 닫힘
- 옵션 탭 →
  1. `localStorage.setItem("miri-textbook-letter-grade", "12"|"34"|"56")`
  2. 현재 URL에서 `variant` 쿼리 파라미터를 **제거**한 URL로 `location.replace()` (theme/mode 파라미터는 보존) — 진행 상태는 리셋되어 1번 문항부터 시작 (의도된 동작)
- localStorage 접근은 이 프로젝트 관례대로 try/catch로 감싼다.

### 5.4 변형 결정 로직 (initVocabLetter 교체분)

우선순위:
1. `?variant=12|34|56` → 해당 변형 (localStorage에 **저장하지 않음** — 일회성 오버라이드)
2. `localStorage("miri-textbook-letter-grade")`가 `12|34|56` 중 하나 → 해당 변형
3. `lesson.grade` 기본 매핑: `<= 2` → grade12 / `3~4` → grade34 / `>= 5` → grade56

주의: 현재 lesson.grade는 3이므로 **기본 화면이 기존 upperGrade(5-6형)에서 grade34(3-4형)로 바뀐다. 이는 의도된 변경**이다.
유효하지 않은 값(레거시 `lower|upper` 포함)은 무시하고 다음 우선순위로 넘어간다.

---

## 6. 작업 E — 튜토리얼 오버레이 3종

### 6.1 파일 구성

- 신규 모듈 `publish/js/letter-tutorial.js` — 오버레이 마크업 주입 + 표시 판단 + 이벤트. `learning-publish-init.js`의 `initVocabLetter()` 마지막(첫 `render()` 후)에서 import하여 `initLetterTutorial({ variant, query })` 호출. import 경로에 캐시 토큰 필수.
- CSS는 `shared/css/learning-components.css` 하단에 `letter-tutorial-*` 블록 추가.

### 6.2 표시 조건 (이 순서대로)

```
suffix = "12" | "34" | "56"  (variant에서 도출)
if query has reset=tutorial → 세 키 모두 removeItem 후 계속 진행
hiddenKey = `miri-textbook-letter-tutorial-hidden-${suffix}`
show = (query has tutorial=1) || (localStorage[hiddenKey] 없음)
```

- 학년 전환으로 리로드되면 새 변형 기준으로 같은 판단이 다시 일어난다 (변형별 독립).
- 표시 중에는 오버레이가 화면 전체를 덮어 뒤 화면 조작 불가.
- 닫기는 **오직 "시작하기" 버튼**. dim 탭·ESC 무시.
- 시작하기 탭 시: 체크박스가 체크 상태면 `localStorage[hiddenKey] = "1"` 저장 → 오버레이 제거. 미체크면 저장 없이 제거(다음 진입 시 다시 표시).

### 6.3 오버레이 DOM (body가 아니라 `.learning-shell` 내부 마지막 자식으로 주입 — exit modal과 동일한 좌표계)

```html
<section class="letter-tutorial" data-letter-tutorial>
  <div class="letter-tutorial__card" role="dialog" aria-modal="true" aria-labelledby="letter-tutorial-title">
    <h2 class="letter-tutorial__title" id="letter-tutorial-title">이렇게 풀어요!</h2>
    <div class="letter-tutorial__stage letter-tutorial__stage--grade{suffix}">
      <!-- §6.5 변형별 무대 -->
    </div>
    <p class="letter-tutorial__caption">{변형별 문구}</p>
    <label class="letter-tutorial__check">
      <input type="checkbox" data-letter-tutorial-check />
      <span>다시 보지 않기</span>
    </label>
    <button class="letter-tutorial__cta" type="button" data-letter-tutorial-start>시작하기</button>
  </div>
</section>
```

문구 (확정, 수정 금지):
- grade12: `글자 타일을 끌어서 순서를 바꿔 단어를 완성해요.`
- grade34: `알맞은 타일을 빈칸에 끌어다 놓아요.`
- grade56: `알맞은 타일을 빈칸에 끌어다 놓아요.`

### 6.4 오버레이 스타일

- `.letter-tutorial` : `position: absolute; inset: 0; z-index: 6;` (exit modal의 z=4보다 위) `display:flex; align-items:center; justify-content:center;` dim = `background: rgba(0,0,0,0.55);`
- `__card` : `width: min(320px, calc(100% - 40px));` 배경 `var(--learning-surface-default)`, radius 20px, padding 24px 20px, 세로 스택 가운데 정렬, gap 16px
- `__title` : 18px / 800 / `var(--learning-text-primary)`
- `__caption` : 14px / `var(--learning-text-secondary)` / 가운데 / line-height 1.5
- `__check` : 13px `var(--learning-text-secondary)`, 체크박스는 `accent-color: var(--learning-brand-primary)`
- `__cta` : 풀폭, 높이 44px, radius 12px, 배경 `var(--learning-brand-primary)`, 글자 `var(--learning-text-on-brand)` 15px/700
- 모든 색은 `--learning-*` 토큰 → 다크모드 자동 대응. **주의: `--color-static-text-on-color`는 사용 금지** (라임 액센트용 다크 잉크. 과거 버그 전례 있음)

### 6.5 무대(stage) 구성 — 스켈레톤 시각 규칙

무대는 고정 `280×180px`, `margin: 0 auto`, `position: relative`, `overflow: hidden`, 배경 `var(--learning-bg-default)` + radius 14px. 내부 요소는 전부 `position: absolute`로 px 좌표 배치. **글자·텍스트 일절 없음.**

**3계층 시각 언어 (필수 구분):**

| 요소 | 표현 |
|---|---|
| 텍스트(뜻/문장) | 납작한 회색 바: 높이 10px, radius 5px, `var(--learning-border-medium)` |
| 타일 | 흰 카드: 44×44px, radius 10px, 배경 `var(--learning-surface-default)`, `border: 1px solid var(--learning-border-medium)`, `box-shadow: 0 2px 6px rgba(0,0,0,.10)` — "집을 수 있는" 느낌 |
| 빈칸 | 받는 곳: 40×40px, radius 10px, `border: 1.5px dashed var(--learning-border-medium)`, 배경 투명 |

**타일 무늬(필수)**: 각 타일 중앙에 가로 바(높이 8px, radius 4px, `var(--learning-border-medium)`)를 넣되 **타일마다 폭이 다르다**: A=24px, B=12px, C=18px, (오답 D=20px, E=10px). 이 무늬가 타일의 정체성이며, 재정렬·채움을 눈에 보이게 만든다. 타일이 빈칸에 들어가면 **빈칸이 해당 무늬를 표시**한다(채워짐 상태).

**포인터**: 지름 18px 원, `background: var(--learning-brand-primary)`, opacity 0.85. 누름 상태 = `scale(0.8)` + 바깥 링(box-shadow spread).

**변형별 무대 배치:**

- `--grade12`: 상단에 뜻 박스 스켈레톤(바 2줄: 폭 180/120px, 연보라 배경 박스 240×56px `var(--learning-brand-primary-soft)` radius 12px 안에 배치, y≈18px) + 하단 y≈110px에 타일 3개 행 `[B][A][C]` (전체 가운데, gap 10px)
- `--grade34`: 상단 y≈22px에 빈칸 3개 행(가운데, gap 8px, 힌트 무늬 없음 — 완전 빈 칸) + 그 아래 y≈76px 뜻 바 1줄(폭 160px 가운데) + 하단 y≈116px 타일 5개 행 `[A][D][B][E][C]` (gap 8px)
- `--grade56`: y≈26px에 문장 바(폭 200px 가운데) + y≈52px에 [짧은 바 40px][빈칸×3][짧은 바 40px] 인라인 행 + 하단 y≈116px 타일 5개 행 (grade34와 동일)

### 6.6 애니메이션 (순수 CSS keyframes)

구현 방식: 무대 안 모든 애니메이션 요소가 **동일 duration, `infinite`, 동일 시작**의 `animation`을 갖고, 아래 비트를 keyframe %로 표현한다. `Date.now()`/`Math.random()` 사용 금지. `prefers-reduced-motion: reduce`에서는 애니메이션을 끄고 완성 상태(성공 순간)를 정지 화면으로 보여준다.

**공통 필수 연출 2개** (이것이 이 튜토리얼의 존재 이유):
1. grade12: 드래그 중 **옆 타일이 미끄러지며 비켜나 자리를 만드는** 모션
2. grade34/56: 타일이 빈칸 위에 겹치는 동안 **빈칸이 하이라이트**(테두리 `var(--learning-brand-primary)` + 옅은 글로우)됐다가 놓으면 쏙 들어가는 모션

**grade12 타임라인 — duration 4.2s** (타일 A를 2번째 자리에서 맨 앞으로):

| 구간(%) | 내용 |
|---|---|
| 0–8 | 무대 콘텐츠 opacity 0→1 (루프 리셋 페이드인) |
| 8–18 | 포인터 등장, 타일 A 위로 이동 |
| 18–21 | 누름: 포인터 scale 0.8+링, 타일 A `translateY(-4px)` + 그림자 강조 + z 최상 |
| 21–40 | 타일 A+포인터가 1번 자리로 이동. **26–34%: 타일 B가 오른쪽으로 (타일폭+gap)만큼 슬라이드해 비켜남** |
| 40–44 | 놓음: A가 1번 자리에 안착(translateY 0), 포인터 링 해제 후 페이드아웃 |
| 50–58 | 성공: 타일 3개 테두리가 `var(--learning-brand-primary)`로 플래시 + 행 위 중앙에 ✓ 배지(24px 원, 브랜드 배경, 흰 체크) scale 0→1 팝 |
| 58–92 | 완성 상태 유지 |
| 92–100 | 콘텐츠 opacity 1→0 |

✓ 체크 표시는 텍스트가 아니라 CSS(border 회전) 또는 인라인 SVG로 그린다.

**grade34 / grade56 타임라인 — duration 5.6s** (타일 A→빈칸1, B→빈칸2, C→빈칸3):

| 구간(%) | 내용 |
|---|---|
| 0–6 | 페이드인 |
| 6–11 | 포인터 → 타일 A, 11%에 누름(+타일 리프트) |
| 11–22 | A 드래그 → 빈칸1. **17–22%: 빈칸1 하이라이트** |
| 22–24 | 드롭: 빈칸1이 A 무늬 표시(채워짐), 타일 A 원위치는 빈 자리로 |
| 24–27 | 포인터 → 타일 B, 누름 |
| 27–36 | B 드래그 → 빈칸2 (32–36% 하이라이트) |
| 36–38 | 드롭 |
| 38–41 | 포인터 → 타일 C, 누름 |
| 41–50 | C 드래그 → 빈칸3 (46–50% 하이라이트) |
| 50–52 | 드롭, 포인터 페이드아웃. 오답 타일 D·E는 하단에 그대로 남음(의도) |
| 56–63 | 성공: 빈칸 3개 플래시 + ✓ 배지 팝 |
| 63–92 | 유지 |
| 92–100 | 페이드아웃 |

grade34와 grade56은 **같은 타임라인**을 쓰고 무대 배치(§6.5)만 다르다. 구현 시 keyframes를 공유하고 배치만 modifier로 분기해도 되고, 별도로 작성해도 된다 — 단 비트는 표와 일치시킬 것.

---

## 7. 명시적 비범위 (하지 말 것)

- grade34/grade56 화면에 드래그 앤 드롭 추가 ❌ (탭 방식 유지)
- 다른 학습 화면·진단평가·홈·튜토리얼의 타 화면 확장 ❌
- 문항 데이터 추가 셔플/랜덤화 ❌
- vocabulary 데이터 수정 ❌
- 기존 3-4 문항 내용 변경 ❌
- 튜토리얼에 실제 한글 낱자·단어 표기 ❌ (스켈레톤만)

---

## 8. 공통 규칙

### 8.1 캐시버스팅 토큰 (중요)

- 현재 토큰: `20260725a` (저장소 전역 187곳)
- 작업 완료 후 **모든** html/js/css의 토큰을 다음 값으로 **일괄** 상향: 같은 날이면 `20260725b`, 다른 날이면 `YYYYMMDDa`
- 절차:
```bash
grep -rl "20260725a" --include="*.html" --include="*.js" --include="*.css" . | grep -v "/.git/" | grep -v "/demo/" | grep -v "/.claude/" | xargs sed -i '' 's/20260725a/<새토큰>/g'
```
- 검증: 구 토큰 잔존 0건 + 새 토큰 총계가 이전 총계 이상(신규 import 추가로 +1 이상 될 수 있음)
- 신규 파일 `letter-tutorial.js`의 import 구문과 이를 import하는 구문 모두 새 토큰 사용

### 8.2 코드 관례

- localStorage/sessionStorage 접근은 try/catch (기존 패턴 따름)
- 색·크기는 가능한 한 `--learning-*` 토큰 사용, 하드코딩 최소화
- 이벤트 위임/명명은 기존 `data-letter-*` 관례 유지
- 주석 밀도·스타일은 주변 코드 수준으로

---

## 9. 검증 체크리스트 (전부 통과해야 완료)

1. `node --check` — 수정/신규 JS 전부
2. `python3 -c "import json; json.load(open('data/learning_content.json'))"`
3. `for t in tests/*.mjs; do node "$t"; done` — 3종 모두 pass (변형 리네이밍으로 깨지면 테스트를 새 이름에 맞게 수정)
4. `grep -rn "lowerGrade\|upperGrade" --include="*.js" --include="*.json" . | grep -v "/.git/" | grep -v "/.claude/" | grep -v "/demo/"` → 0건
5. 서버(`python3 -m http.server 8000 --bind 127.0.0.1`) + 브라우저 375×812:
   - `publish/learning-vocab-letter.html?variant=12` / `=34` / `=56` 각각:
     - 튜토리얼 오버레이 표시, 애니메이션 루프 동작, 필수 연출(비켜남/빈칸 하이라이트) 확인
     - "다시 보지 않기" 체크 + 시작하기 → 새로고침 시 미표시 / `?reset=tutorial` → 재표시 / `?tutorial=1` → 강제 표시
     - 콘솔 에러 0
   - grade12: 드래그 재정렬 동작(비켜남 포함), 탭-탭 교환 동작, 정답 순서 완성 → 정답 시트 → 3문항 진행 → 마지막 CTA가 `learning-vocab-mc`로 이동
   - grade34: 빈칸에 초성 표시됨(기존 유지), 탭 플로우 기존과 동일
   - grade56: 빈칸에 초성 **없음**, 정답 시 뜻 공개 유지
   - 학년 전환 버튼: 팝오버 열림/바깥 클릭 닫힘, 각 밴드 선택 시 리로드되어 해당 변형 1번 문항부터 + 버튼 라벨 갱신, localStorage 반영
   - 다크모드: 위 화면 전부 토글해 시각 확인 (특히 튜토리얼 오버레이·팝오버)
   - 쿼리 없는 기본 진입: localStorage 없을 때 grade34로 진입(lesson.grade=3 매핑) 확인
6. 회귀: `publish/learning-vocab-matching.html` → 글자 맞추기로 이어지는 기존 플로우가 깨지지 않았는지 1회 통과

## 10. 커밋

- 검증 완료 후 **커밋 1개**: `Add grade-band modes, debug grade switch, and tutorial overlay to vocab-letter`
- 푸시는 하지 않는다 (사용자가 별도 지시)
