# Constellations Cleanup Notes

## 정리 결과
- 기준표의 88개 별자리를 기준으로 원본은 `asset/constellation_origin/{id}/{id}.png`로 보관하고, 화면용 자산은 `asset/constellation/{id}/{id}.webp`로 사용합니다.
- 공백이 있던 파일명은 모두 kebab-case로 정리했습니다.
- 일부 별자리는 `hidden` 원본이 없어서 화면에서는 본 이미지 WebP로 fallback 되도록 정리했습니다.
- 기존 분류 기준 문서는 `data/constellations-grade-type-reference.md`로 이동했습니다.

## 삭제한 파일
- legacy 별자리 폴더의 `.DS_Store`
- legacy 분류용 빈 폴더 3종

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
