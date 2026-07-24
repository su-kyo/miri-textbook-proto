# 진단평가(Diagnostic Assessment) 추가 계획

> 작성: Fable (계획 전담) · 실행: Opus — 이 문서만 읽고 작업을 시작할 수 있도록 필요한 결정사항을 모두 담았다.
> 이 프로젝트는 **목업/데모**다. 실제 채점 서버·선생님용 화면은 만들지 않는다.

## 목표

- 하단 탭 바의 **'마이' 탭을 진단평가 진입 화면으로 재활용**한다 (마이 페이지는 기획된 것이 없음).
- 학생 플로우: 진입 화면 → 문항 풀이(15문항) → 완료 화면.
- **결과는 학생에게 보여주지 않는다.** 완료 화면은 "선생님이 결과를 알려줄 거예요" 성격의 안내만.
- 진단평가를 완료하면 진입 화면의 시작 버튼이 사라지고 완료 상태 안내로 바뀐다.
- 홈 화면 진입 버튼은 **나중 작업** — 이번엔 만들지 않는다.
- 스타일은 기존 학습 화면(`--learning-*` 토큰, learning-shell, learning-components)을 그대로 활용한다.

## 사용자 플로우

```
[하단 탭 '마이']
   └─ 진입 화면 (my 페이지 재활용, 홈 셸 + 하단 탭 유지)
        ├─ 미완료: 안내 카피 + [진단평가 시작하기] 버튼
        │            └─ 풀이 화면 (learning-shell, 탭 바 없음)
        │                 Q1~Q10 어휘 → 지문1 읽기 → Q11~Q13 → 지문2 읽기 → Q14~Q15
        │                 └─ 완료 화면 → [확인] → 진입 화면으로 복귀 (버튼 사라진 상태)
        └─ 완료됨: "진단평가를 완료했어요" 상태 카드 (버튼 없음)
```

## 실행 순서

| 단계 | 범위 | 할 일 | 완료 기준 |
| --- | --- | --- | --- |
| 1 | 데이터 | `data/diagnostic_content.json` 생성. 아래 스키마 참고. 예시 HTML의 지문 2편·15문항을 정제해 넣는다. | JSON이 로드되고 스키마가 이 문서와 일치 |
| 2 | 어댑터 | `shared/js/data-loader.js`에 `loadDiagnosticContentRaw()` 추가. 필요하면 `shared/js/diagnostic-adapter.js`(간단하면 어댑터 생략하고 init에서 직접 로드해도 됨). | 캐시된 fetch로 로드됨 |
| 3 | 진입 화면 | `page-renderer.js`의 `buildMyBody()`를 진단평가 진입 화면으로 교체. 완료 여부에 따라 시작 버튼/완료 카드 분기. `NAV_ITEMS`의 '마이' 항목은 id·아이콘 유지(라벨도 '마이' 유지). | prototype/publish 양쪽 my 페이지에서 진입 화면이 뜸 |
| 4 | 풀이 화면 | `publish/diagnostic-quiz.html` + init 로직. learning-vocab-mc 화면 골격 재활용. 정오 피드백 없음(선택만 표시), 답 선택 시 '다음' 활성화. 지문 읽기 스텝 2개 삽입. | 15문항 + 지문 2편을 순서대로 진행 가능 |
| 5 | 완료 화면 | `publish/diagnostic-complete.html`. learning-complete 골격 재활용하되 점수·별 보상 없음. 완료 시 localStorage에 기록. | 완료 → 진입 화면 복귀 시 버튼이 사라져 있음 |
| 6 | prototype 연결 | `prototype/pages/diagnostic-quiz.html`·`diagnostic-complete.html` 스텁 생성. `prototype-init.js`의 `pageId?.startsWith("learning-")` 리다이렉트 분기를 `diagnostic-` 접두사도 타도록 확장. | 마이 탭 → 시작 → 완료 → 복귀가 prototype 모드에서 동작 |
| 7 | 검증 | 로컬 서버로 전체 플로우 수동 확인 + 라이트/다크 두 테마 확인 + 기존 회귀 테스트 3종 통과. | 콘솔 에러 0, 기존 테스트 통과 |

## 데이터 스키마 (`data/diagnostic_content.json`)

기존 `learning_content.json`의 관례(설명성 필드는 렌더하지 않음, `reviewNeeded` 플래그)를 따른다.

```jsonc
{
  "schemaVersion": "2026-07-24.diagnostic.v1",
  "assessment": {
    "id": "diagnostic-korean-001",
    "title": "진단평가",
    "subject": "국어",
    "questionCount": 15,
    "flow": ["vocab", "passage-1", "reading-1", "passage-2", "reading-2"]
  },
  "passages": [
    {
      "id": "passage-1",
      "title": "",                    // 원문에 제목 없음 — 빈 값 유지
      "image": null,                  // 원본 이미지(/data/elementary_textimg/…)는 저장소에 없음. 슬롯만 유지
      "imageNote": "원본 이미지 미보유 — 텍스트만 렌더",
      "paragraphs": ["가랑가랑 가랑비가 가만가만 내려요.", "…(원문 그대로 줄 단위)"]
    },
    { "id": "passage-2", "…": "발표 자세 지문 동일 구조" }
  ],
  "questions": [
    {
      "id": "V01",
      "section": "vocab",             // vocab | reading-1 | reading-2
      "passageId": null,              // reading 문항은 해당 지문 id
      "prompt": "다음 뜻에 알맞은 낱말은 무엇인가요?",
      "promptDetail": "빛이 어떤 물체에 가려져 생긴 어두운 부분.",  // 뜻풀이/예문. 없으면 null
      "blank": false,                 // V09·V10은 true — promptDetail 안의 "{blank}" 토큰을 빈칸으로 렌더
      "options": ["햇볕", "그늘", "무지개", "노을"],
      "answerIndex": 1,               // 학생 UI에는 절대 노출하지 않음
      "reviewNeeded": true            // 정답은 원본에 없어 추정값 — 전체 문항에 표시
    }
  ],
  "implementationNotes": {
    "answerKey": "원본 HTML에 정답 없음. 아래 추정 정답을 사람이 검수해야 함.",
    "q11Wording": "R01 문항의 '글자를 사용하지 않은 글자' 워딩은 원문 그대로 유지(선택지는 낱말). 임의 수정 금지.",
    "numbering": "원문 문항 번호(1.~15.)는 제거함 — 진행 표시는 렌더러 책임."
  }
}
```

### 추정 정답 (검수 필요 — 전 문항 `reviewNeeded: true`)

| 문항 | 정답 | 문항 | 정답 | 문항 | 정답 |
|---|---|---|---|---|---|
| V01 | B 그늘 | V06 | D | R01 | C 다닥다닥 |
| V02 | D 연못 | V07 | A | R02 | A 카메라 |
| V03 | A 낙하산 | V08 | C | R03 | B '들'과 '요' ⚠️ |
| V04 | C 꿀꺽 | V09 | A 연주하는 | R04 | D |
| V05 | B | V10 | B 포기하지 | R05 | B |

⚠️ R03은 모음이 자음 아래에 오는 글자('들'=ㅡ, '요'=ㅛ)를 고르는 문항 — 특히 검수 필요.

### 콘텐츠 정제 규칙 (원본 HTML → JSON)

1. 문항 앞 번호(`1. `)와 `V01`류 name 속성은 분리 — 번호 제거, name은 `id`로.
2. `*(        )*` 빈칸 표기는 `{blank}` 토큰으로 치환하고 `blank: true`.
3. 지문의 `<p>` 단위를 `paragraphs` 배열 원소로. 원문 어미·표기 임의 수정 금지.
4. 이미지 `<img>`는 경로가 저장소에 없으므로 `image: null` + `imageNote`.

## 화면 명세

### A. 진입 화면 — my 페이지 재활용 (`buildMyBody()` 교체)

- 셸: 기존 home-shell(상단 프로필 바 + 하단 탭 바) 유지. 탭에서 '마이'가 활성.
- 미완료 상태:
  - 타이틀 "진단평가", 안내 카피(예: "지금 실력을 확인해 보고, 꼭 맞는 학습을 추천받아요. 문항은 15개, 약 10분이 걸려요.")
  - CTA 버튼 → `diagnostic-quiz.html`(모드에 맞는 경로). 기존 `cta-button` 또는 홈 `시작하기` 버튼 스타일 재활용.
- 완료 상태:
  - CTA 없음. 완료 카드(예: "진단평가를 완료했어요 · 결과는 선생님이 알려줄 거예요") + 완료 일시.
- 홈 화면용 별도 진입 버튼은 **이번 작업 범위 아님**.

### B. 풀이 화면 — `publish/diagnostic-quiz.html` (한 화면 한 스텝)

- 셸: `learning-shell` + `learning-header`(뒤로가기 = 진입 화면, 테마 토글 유지). 하단 탭 바 없음.
- 헤더의 커리큘럼 라벨 자리는 "진단평가".
- 스텝 순서: `V01~V10` → 지문1 읽기 → `R01~R03` → 지문2 읽기 → `R04~R05` (총 17스텝).
- 진행 표시: 문항 15개는 기존 progress dot로는 많음 → **`n / 15` 카운터**(단어 카드 pagination 스타일 재활용). 지문 읽기 스텝은 카운트에 넣지 않는다.
- 문항 스텝: `question-block` + `question-prompt-card`(뜻풀이는 카드 안 보조 텍스트) + `mc-options`. **정오 피드백 없음** — 선택 시 `is-selected` 상태만 표시, 다시 눌러 변경 가능. 답이 선택돼야 '다음' CTA 활성(원본의 "모두 골라야 제출" 규칙을 스텝 단위로 유지).
- 지문 읽기 스텝: passage-cloze 화면의 지문 카드 스타일 재활용(빈칸 없이 통짜 텍스트). 하단 '다음' CTA.
- 독해 문항(R01~R05) 화면에는 **'지문 다시 보기'** 버튼 → 기존 `bottom-sheet` 컴포넌트로 해당 지문 표시.
- 이탈 보호: 기존 `initLearningExitModal()` 패턴 재사용(뒤로가기 시 "그만할까요?" 확인). 중도 이탈 시 답안은 버린다(미완료 상태 유지 — 데모 단순화).
- 마지막 문항의 CTA는 "제출하기" → 완료 처리 후 완료 화면으로.

### C. 완료 화면 — `publish/diagnostic-complete.html`

- learning-complete 골격 재활용. **점수·정오 수·별 보상 요소는 전부 제외**(결과 비노출 정책, 별자리 보상 플로우와도 무관).
- 카피 예: "진단평가를 모두 마쳤어요! / 결과는 선생님이 확인한 뒤 알려줄 거예요."
- CTA "확인" → 진입 화면(my)으로. 이때 완료 상태가 반영돼 있어야 함.

## 상태 저장

- localStorage 키: `miri-textbook-diagnostic` (기존 `miri-textbook-prototype-state`와 **별도 키** — 프로토타입 스토어의 TRANSIENT 정리 로직에 얽히지 않게).
- 값: `{ "status": "completed", "completedAt": "<ISO>", "answers": { "V01": 1, … } }`
  - answers는 학생에게 안 보여주지만 기록은 남긴다(추후 선생님용 데모 확장 여지).
- 진입 화면은 렌더 시 이 키를 읽어 분기.
- **데모 리셋 수단 필수**: `?reset=diagnostic` 쿼리 파라미터로 키 삭제(진입 화면에서 처리). 시연 반복을 위해 반드시 넣는다.
- publish 모드(스토어 없는 단독 화면)에서도 동일 키를 직접 읽고 쓴다.

## 파일 목록 (예상)

| 파일 | 신규/수정 | 내용 |
| --- | --- | --- |
| `data/diagnostic_content.json` | 신규 | 지문·문항·추정 정답 |
| `shared/js/data-loader.js` | 수정 | `loadDiagnosticContentRaw()` |
| `shared/js/page-renderer.js` | 수정 | `buildMyBody()` → 진단 진입 화면, 완료 분기, reset 파라미터 처리 |
| `publish/diagnostic-quiz.html` | 신규 | 풀이 화면 골격 |
| `publish/diagnostic-complete.html` | 신규 | 완료 화면 골격 |
| `publish/js/diagnostic-init.js` | 신규 | 풀이·완료 화면 로직 (learning-publish-init 패턴, 공용 헬퍼는 `shared/js/learning-ui-utils.js`에서 import) |
| `prototype/pages/diagnostic-quiz.html` 등 | 신규 | publish로 리다이렉트하는 스텁 |
| `prototype/js/prototype-init.js` | 수정 | `diagnostic-` 접두사 리다이렉트 |
| `shared/css/learning-components.css` | 수정(소폭) | 부족한 스타일만 `diagnostic-` 접두사로 추가. 기존 토큰만 사용, 새 색상값 금지 |

## 작업 시 지켜야 할 것

- 캐시 버전 토큰은 현행 `?v=20260724a` 단일 체계를 따른다(새 파일 포함). 버전을 올리게 되면 전체를 한 번에 올린다.
- 새 CSS는 반드시 `--learning-*` 시맨틱 토큰만 사용. 라이트/다크 모두 확인.
- 문항 텍스트는 JSON에 넣을 때 원문 그대로(R01 워딩 포함). 렌더 시 `escapeHtml` 필수.
- `learning-publish-init.js`에 끼워 넣지 말고 **별도 `diagnostic-init.js`**로. (2,500줄 파일을 더 키우지 않는다.)
- 진단평가는 별자리 보상·홈 리워드 플로우(`storePendingHomeReward` 등)와 **연결하지 않는다**.

## 리스크 / 미결

- **정답 검수**: 추정 정답 15개는 사람 확인 전까지 `reviewNeeded: true`. 결과를 학생에게 안 보여주므로 데모 동작에는 영향 없음.
- **이미지 2장 미보유**: 텍스트만으로 지문 카드가 밋밋할 수 있음. 필요하면 `asset/illustrations/learning`의 기존 일러스트를 임시 배치하되, 콘텐츠와 무관한 이미지이므로 기본은 텍스트만.
- **'마이' 탭 라벨**: 일단 '마이' 유지. 진단평가 전용 탭으로 굳어지면 라벨·아이콘 교체는 `NAV_ITEMS` 한 곳 수정으로 끝남.
- **뒤로가기 중도 이탈**: 답안 임시저장은 하지 않는다(데모 단순화). 실서비스 전환 시 재검토.

---

# 개정 1 — 2026-07-24 1차 구현 후 사용자 리뷰 반영

> 1차 구현(진입/풀이/완료 + 마이 탭 연결)은 완료되어 동작 확인됨. 아래는 시연하며 나온 개선 요청이다.
> **실행: Opus. 이 개정 섹션이 위 원안보다 우선한다.** 캐시 토큰은 다음 배치에서 `20260724b → 20260724c`로 전체 일괄 상향(공유 파일 수정 포함).

## R1. 풀이 화면 '이전' 버튼 추가

- footer를 2버튼 레이아웃으로 변경:
  ```
  [ 이전 ]  [        다음 / 제출하기        ]
  ```
- '이전' = 보조 버튼(secondary). '다음' = 기존 primary CTA 유지, 폭은 남는 공간 채움.
- 동작:
  - `state.stepIndex -= 1`. 첫 스텝(index 0)에서는 '이전' **숨김**(`hidden`).
  - 답안은 이미 `state.answers`에 문항 id로 저장 중이므로, 이전 문항으로 가면 **골랐던 선택지가 그대로 표시**되고 '다음'도 활성 복원됨. 지문 스텝도 이전 대상에 포함.
  - '이전'은 항상 활성(첫 스텝 제외). '다음' 활성 규칙은 기존 그대로(문항 스텝은 답 선택 시, 지문 스텝은 항상).
- 헤더 ← 화살표는 **'나가기'(이탈 모달)로 그대로 둔다.** ← 와 '이전'은 역할이 다름(전자=평가 종료, 후자=한 문항 뒤로).
- 스타일: 보조 버튼은 학습 토큰 사용(`--learning-surface-raised` 배경 / `--learning-border-medium` 테두리 / `--learning-text-secondary`). 새 색상값 금지.

## R2. 진단평가 진입 = 모달 (홈 기준 유지) — 원안의 "진입 페이지" 방식 폐기

- **결정**: 진입을 별도 페이지가 아니라 **모달**로 한다. 홈은 현재 테마/셸 그대로 둔다. (앞서 검토하던 학습 테마 전환·탭 바 라이트 대응 문제는 전부 폐기.)
- **근거**: 최종 진입점은 홈 화면의 버튼이고, 마이 탭으로의 이동은 최종 설계에 없다. "15문항 시험을 시작할까요?" 성격의 짧은 게이트라 모달이 적합하고, 기존 홈 모달 인프라를 그대로 재사용한다.
- **모달 내용**:
  - 미완료: 타이틀 "진단평가" + 안내 카피 + [진단평가 시작하기] 버튼.
  - 완료: 시작 버튼 대신 완료 상태(완료 배지 + "결과는 선생님이 확인한 뒤 알려줄 거예요" + 완료일).
  - [시작하기] → 풀이 페이지(`diagnostic-quiz`, 학습 테마 풀스크린)로 이동.
- **구현**: 기존 홈 모달 패턴 재사용 —
  - `buildDiagnosticEntryModal(state)`를 page-renderer에 추가(다른 모달들 옆). 다크 `modal-card` 계열 스타일, 새 색상값 금지.
  - 상태 플래그 `diagnosticModalOpen`(원안의 `attendanceModalOpen` 등과 동일 패턴). `wireGlobalModalEvents`에 닫기 처리(`data-modal-close="diagnostic"`) 추가.
  - `?modal=diagnostic` 오픈 훅을 현재 `?modal=avatar`/`attendance`가 쓰는 곳(`prototype-init.js`)에 추가.
  - 완료 상태 판정은 기존 localStorage(`miri-textbook-diagnostic`) 그대로 읽어 분기. `?reset=diagnostic` 리셋 유지.
- **모달(다크) → 풀이 화면(라이트 학습 테마) 테마 전환**: 모달은 잠깐 뜨는 게이트라 허용. 인지만 해둔다.

### 임시 트리거(데모) — 확인 필요
- 홈 화면 전용 진입 버튼은 여전히 **나중 작업**. 그 전까지 데모에서 모달을 여는 방법:
  - **(권장) 마이 탭을 트리거로**: 마이 탭을 누르면 홈 셸 위에 진단평가 모달을 연다. 마이 페이지 로드 시 `diagnosticModalOpen: true`로 자동 오픈(마이는 별도 콘텐츠 없음).
  - 대안: 지금 홈 화면에 임시 버튼 하나를 달아 모달을 연다(어차피 만들 홈 버튼을 앞당김).
- **1차 구현 정리**: 원안대로 만든 `buildMyBody` "진입 페이지"와 `diagnostic-entry` 홈 CSS(components.css)는 **모달로 이전하며 제거/대체**. 완료 페이지 `diagnostic-complete.html`은 **유지**.

## R3. 문항 "지시문 vs 문제 텍스트" 분리 + 박스 사용 규칙

문제 인식: `prompt`("다음 뜻에 알맞은 낱말은 무엇인가요?")는 **지시문**이고 실제 **문제 텍스트**(뜻풀이/예문/직접 질문)는 따로다. 현재는 이 둘이 한 카드에 섞여, 지시문이 없는 문항(V05~V08, R01~R05)에서는 실제 질문이 작게 나온다. → **문제 텍스트는 항상 크게**, 지시문은 작게 분리한다.

### 데이터 스키마 개정 (`data/diagnostic_content.json`)

각 문항의 `prompt`/`promptDetail`을 아래 3필드로 재정의(기계적 변환):

| 새 필드 | 의미 | 변환 규칙 |
| --- | --- | --- |
| `instruction` | 지시문(작게, 보조). 없으면 `null` | 기존 `promptDetail`이 있으면 `instruction = 기존 prompt`, 없으면 `null` |
| `stem` | **문제 텍스트(크게, 주인공)**. 항상 존재 | 기존 `promptDetail`이 있으면 `stem = promptDetail`, 없으면 `stem = 기존 prompt` |
| `boxed` | 문제 텍스트를 박스(카드)로 감쌀지 | 아래 규칙표대로. 기본값은 `instruction != null`과 동일 |
| `blank` | 기존 유지 | `stem` 안의 `{blank}` 토큰 위치 |

### 박스 사용 규칙

- **박스로 감싼다 (`boxed: true`)**: 문제 텍스트가 *들여다볼 대상 자료*일 때 — 낱말 뜻풀이(V01~V04), 빈칸 예문(V09~V10). 이때 지시문이 박스 **위에 작게** 붙는다.
- **박스 없이 큰 텍스트 (`boxed: false`)**: 문제 텍스트 자체가 곧 질문일 때 — V05~V08, 독해 R01~R05. 지시문 없음. 큰 문제 텍스트만 노출.

### 15문항 매핑(구현 기준)

| id | instruction | stem | boxed |
| --- | --- | --- | --- |
| V01 | 다음 뜻에 알맞은 낱말은 무엇인가요? | 빛이 어떤 물체에 가려져 생긴 어두운 부분. | true |
| V02 | 〃 | 깊고 넓게 파인 땅에 물이 고여 있는 곳. | true |
| V03 | 〃 | 하늘에서 사람이나 물건이 천천히 떨어지게 하는 데 쓰이는, 펼친 우산과 같은 모양의 장치. | true |
| V04 | 〃 | 물이나 음식물이 목구멍이나 좁은 구멍으로 한꺼번에 넘어가는 소리. 또는 그 모양. | true |
| V05 | (null) | ‘연습’의 뜻으로 알맞은 것은 무엇인가요? | false |
| V06 | (null) | ‘어리둥절하다’의 뜻으로 알맞은 것은 무엇인가요? | false |
| V07 | (null) | ‘초대하다’의 뜻으로 알맞은 것은 무엇인가요? | false |
| V08 | (null) | ‘그렁그렁’의 뜻으로 알맞은 것은 무엇인가요? | false |
| V09 | 빈칸에 들어갈 알맞은 낱말은 무엇인가요? | 태경이는 리코더를 {blank} 것을 좋아해요. | true |
| V10 | 〃 | 달리기가 힘들었지만 나는 {blank} 않고 끝까지 달렸어요. | true |
| R01 | (null) | '가'라는 글자를 사용하지 않은 글자는 무엇인가요? | false |
| R02 | (null) | 모음 'ㅔ'는 어디에 사용되었나요? | false |
| R03 | (null) | '만들어요'라는 글자에서 모음자가 자음자의 아래쪽에 있는 글자는 뭘까요? | false |
| R04 | (null) | 발표를 할 때 허리는 어떻게 해야 하나요? | false |
| R05 | (null) | 발표를 할 때 다리는 어떻게 해야 하나요? | false |

### 렌더 규칙 (`diagnostic-init.js`)

- `instruction`이 있으면: 박스 **위**에 작은 보조 텍스트(예: `.diagnostic-instruction`, 14px, `--learning-text-secondary`).
- `stem`은 항상 **큰 주인공 텍스트**:
  - `boxed: true` → `.learning-card` 계열 카드 안에 큰 텍스트(예: `--learning-type-subheading-size` 20px, `--font-body-eb`).
  - `boxed: false` → **카드 없이** 큰 텍스트만(같은 크기 또는 한 단계 크게). 좌우 여백만 두고 배경/테두리 없음.
- `{blank}` 토큰은 기존 `.diagnostic-blank`로 치환.
- 기존 `.diagnostic-prompt-card__lead`(작은 리드) 방식은 폐기 — 지시문/문제 텍스트를 위 규칙으로 대체.
- 렌더 시 `escapeHtml` 유지.

## R4. '지문 다시 보기' 오버레이 재구성 (여백 문제)

문제 인식: 현재 바텀시트가 `max-height: min(52vh, 420px)`로 제한돼, 지문 1(26줄)처럼 긴 지문에서 시트가 어중간하게 뜨고 위쪽에 빈 여백이 생긴다.

- 변경: 지문 재열람을 **전체 높이(near-fullscreen) 슬라이드업 시트**로.
  - 상단에 작은 인셋만 두고 화면을 거의 가득 채운다(또는 `learning-shell` 높이 전체). `max-height: min(52vh, 420px)` 제거.
  - 시트 헤더: "지문" 라벨 + 닫기(×). 본문은 시트 내부에서만 스크롤(`overscroll-behavior: contain`).
  - 지문 타이포는 기존 `.diagnostic-passage__line`(serif, 1.8 line-height) 유지하되, 읽기 편한 좌우/상하 패딩.
  - 뒤 화면(문항)이 비쳐 생기던 빈 여백 제거 → 스크림(dim) 배경을 깔아 몰입.
- 이유: 긴 지문은 작은 시트로 보면 답답하고 여백이 어색. 독해 문항에서 지문 확인은 "잠깐 크게 펼쳐 읽고 닫기"가 자연스럽다.
- 대안 검토(채택 안 함): 지문을 문항 위에 항상 붙여 보이는 분할 화면 → 문항당 스크롤이 길어져 소형 화면에서 불리. 현행 '다시 보기' 버튼 + 큰 오버레이 유지가 낫다.

## 개정에 따른 파일 영향(추가/변경)

| 파일 | 변경 |
| --- | --- |
| `data/diagnostic_content.json` | 문항 스키마 `instruction`/`stem`/`boxed`로 개정(R3) |
| `publish/js/diagnostic-init.js` | '이전' 버튼(R1), stem/instruction 렌더 규칙(R3), 지문 오버레이 로직(R4) |
| `publish/diagnostic-quiz.html` | footer 2버튼 구조(R1), 지문 시트 마크업 조정(R4) |
| `shared/js/page-renderer.js` | 진단평가 진입 **모달**(`buildDiagnosticEntryModal`) + `diagnosticModalOpen` 상태 + 닫기 wiring(R2). 기존 `buildMyBody` 진입 페이지는 모달로 대체 |
| `prototype/js/prototype-init.js` | `?modal=diagnostic` 오픈 훅 + 임시 트리거(마이 탭 로드 시 모달 오픈)(R2) |
| `shared/css/learning-components.css` | 보조 버튼(R1), stem 박스/비박스·지시문(R3), 전체높이 지문 시트(R4) |
| `shared/css/components.css` | 진단평가 진입 **모달** 스타일(홈 modal-card 계열). 기존 `diagnostic-entry` 진입 페이지 CSS 제거(R2) |

## 개정 미결/확인 필요

- **R2 임시 트리거**: → 개정 2에서 확정(홈 study-card '진단평가' 버튼). 마이 임시 트리거안 폐기.
- 나머지 원안 미결(정답 검수, 이미지 미보유 등)은 그대로 유효.

---

# 개정 2 — 2026-07-24 홈 최종 피그마 반영

> Figma 홈 최종안: file `5rB2kB3Wt23JR9ae9owVlT`, node `341:1494`.
> 개정 1의 R2 "모달" 방향은 유지하되, **트리거를 홈 study-card의 '진단평가' 버튼으로 확정**하고, 홈 study-card를 피그마에 맞춘다.

## H1. 홈 study-card 재구성 (피그마 기준)

현재 `buildStudyCard`/`.study-panel`([page-renderer.js:780](shared/js/page-renderer.js) 부근)은 헤더 + 전체너비 2줄(국어 점수행 / 사회 시작하기행) 구조. 피그마 최종안으로 변경:

- **헤더**: `⭐ 오늘의 학습`(좌) + `2학년 1학기`(우, 학기 라벨 추가).
- **레슨 2단 열**(현재 상하 2줄 → 좌우 2열):
  - 좌: `6회차 국어` + `42점 →` (결과로 이동). 라벨 짧게("6회차 국어", 학년/학기 접두 제거).
  - 우: `7회차 사회` + `→` (라임색, 시작하기 액션).
- **진단평가 행**(신규, 전체너비): `진단평가` + 우측 원형 `→`. **누르면 진단평가 모달**(개정 1 R2)을 연다.
  - **완료 시 이 행 전체가 사라진다**(localStorage `miri-textbook-diagnostic` status=completed → 행 미렌더).
- 색/간격/라운드는 피그마 study-card 값에 맞추되 기존 `--home-*` 토큰 우선 사용, 부족한 값만 추가. 구현 시 `get_design_context`로 정확한 토큰 확보.

## H2. 진단평가 진입 트리거 = 홈 study-card '진단평가' 버튼 (R2 확정)

- 개정 1 R2의 "마이 탭 임시 트리거" 안은 **폐기**. 최종·데모 모두 **홈 study-card '진단평가' 버튼**이 모달을 연다.
- 미완료: 진단평가 행 표시 → 탭 시 모달. 완료: 행 숨김(H1).
- 모달 자체(내용/완료 분기/스타일)는 개정 1 R2 그대로.

## H3. 하단 탭 바에서 '마이' 제거

- 피그마 최종 하단 탭: **홈 · 기록 · 랭킹 · 별자리 (4개)**. '마이' 없음.
- `NAV_ITEMS`([app-config.js:48](shared/js/app-config.js))에서 `my` 항목 제거.
- 파급: `my.html`(publish/prototype), `buildMyBody`, `PAGE_IDS`/`PAGE_TITLES`의 `my`는 **미사용 처리**(라우팅에서 빠짐). 1차 구현의 `buildMyBody` 진입 페이지·`diagnostic-entry` CSS는 개정 1 R2대로 제거되므로 함께 정리.
- **확인 필요**: 마이 탭을 완전히 지우는 게 맞는지(권장: 피그마대로 제거). 남겨둘 이유가 있으면 알려줄 것.

## 개정 2 파일 영향(추가/변경)

| 파일 | 변경 |
| --- | --- |
| `shared/js/page-renderer.js` | `buildStudyCard` 2열+진단평가 행 재구성(H1), 진단평가 행 완료 시 숨김, 모달 트리거 배선(H2) |
| `shared/js/app-config.js` | `NAV_ITEMS`에서 `my` 제거(H3) |
| `shared/css/components.css` | study-card 2열/진단평가 행 스타일(H1), (기존 `diagnostic-entry` 진입페이지 CSS 제거) |
| `publish/my.html`, `prototype/pages/my.html` | 미사용(라우팅 제외). 삭제 여부는 확인 후 |

## 개정 2 미결/확인 필요

- **H3 마이 탭 제거** 여부(권장: 제거).
- **H1 2열 레이아웃** 적용 범위 — 국어/사회를 좌우 2열로 바꾸는 것까지 포함인지(피그마대로 권장) vs 진단평가 행만 추가.
