# Constellations Cleanup Notes

## 정리 결과
- 기준표의 88개 별자리를 기준으로 `asset/constellations/{id}/{id}.png` 구조로 재배치했습니다.
- 공백이 있던 파일명은 모두 kebab-case로 정리했습니다.
- 구조도 파일은 아직 생성하지 않았고, JSON에는 `{id}_map.png` 경로만 미리 넣었습니다.
- 기존 분류 기준 문서는 `data/constellations-grade-type-reference.md`로 이동했습니다.

## 삭제한 파일
- `asset/constellations/.DS_Store`
- `asset/constellations/new_동물형/.DS_Store`
- `asset/constellations/new_인물형/.DS_Store`
- 비어 있는 `asset/constellations/new_동물형`
- 비어 있는 `asset/constellations/new_인물형`
- 비어 있는 `asset/constellations/new_사물형`

## 보류한 파일
- 없음

## requiredLight 메모
- `requiredLight`는 기존 기준표 `data/constellations-grade-type-reference.md`의 값을 그대로 사용했습니다.
- 별도 draft 값은 사용하지 않았습니다.

## type 분류 메모
- `추상형`은 사용하지 않고 모두 `사물형`으로 통일했습니다.
- `centaurus`는 반인반마 이미지이지만 기존 기준표에 맞춰 `인물형`으로 유지했습니다.
- `pegasus`, `phoenix`, `monoceros`는 상상 속 존재이지만 규칙에 따라 `동물형`으로 유지했습니다.
- `coma-berenices`, `eridanus`, `mensa`는 생물이 아닌 개념/지형 계열로 보고 `사물형`으로 유지했습니다.

## description 작성 참고 자료
- IAU 지정 별자리 목록: https://en.wikipedia.org/wiki/IAU_designated_constellations
- 개별 별자리 개요와 신화/대표 특징: 예시로 https://en.wikipedia.org/wiki/Andromeda_(constellation), https://en.wikipedia.org/wiki/Hydra_(constellation), https://en.wikipedia.org/wiki/Hydrus
- 설명 문장은 위 자료를 바탕으로 초등학생용 문체로 짧게 다시 써서 정리했습니다.
