# Next Webtoon Popular 설계

## 1. 목표

NTK Webtoon 확장의 기본 계열을 Legacy에서 Next로 전환하고, Mangayomi의 `Popular` 목록을 Next 계열의 주간 웹툰 인기랭킹과 일치시킨다.

- 기본 URL: `https://sbxh9.com`
- 기본 파서 계열: `next`
- Popular URL: `/rank?period=week&kind=webtoon`
- 이번 단계의 클라이언트 검증 목표: 순위 1~50위 작품이 사이트 순서대로 표시되는지 확인

Legacy 구현은 삭제하거나 수정하지 않고 별도 경계로 보존한다.

## 2. 범위

이번 단계에서 구현한다.

- Source와 `index.json`의 기본 URL을 `https://sbxh9.com`으로 변경
- 기본 파서 계열을 `next`로 변경
- Next 전용 Popular 요청과 응답 파서 추가
- Next 설정에서 Popular 2페이지 이후는 요청 없이 빈 목록 반환
- Parser family 설정에서 Next를 기본 선택으로 배치
- Next Popular용 fixture와 요청·파서·manifest 테스트 추가
- 확장 버전을 `0.2.0`으로 올려 클라이언트가 변경을 인식하도록 함

이번 단계에서는 구현하지 않는다.

- Next Latest
- Next 제목 검색
- Next 필터
- 작품 상세
- 회차 목록
- 회차 이미지
- Manhwa, Novel, Anime
- Legacy 구현 변경 또는 삭제
- 도메인 자동 전환

## 3. 런타임 동작

### 3.1 파서 선택

`parserFamily=next`가 기본값이다.

- `next`: 이번 단계에서는 Popular만 지원한다.
- `legacy`: 기존 Popular, Latest, 검색과 필터 구현을 그대로 사용한다.

Next 상태에서 아직 구현하지 않은 Latest와 검색은 Legacy로 fallback하지 않는다. Latest 노출은 비활성화하고, 검색이 호출되면 Next 미구현 오류를 명시적으로 반환한다. Next 필터 목록은 빈 배열을 반환한다.

이 원칙은 주소와 파서 계열이 섞여 잘못된 HTML을 정상 빈 목록으로 오인하는 것을 막는다.

### 3.2 Popular 요청

첫 페이지에서만 다음 요청을 보낸다.

```text
GET {baseUrl}/rank?period=week&kind=webtoon
```

요청 헤더는 현재 브라우저형 `User-Agent`와 `{baseUrl}/` Referer를 유지한다.

랭킹 응답에는 페이지네이션이 없고 50위까지 한 페이지에 있으므로 `page > 1`이면 네트워크 요청 없이 다음을 반환한다.

```json
{
  "list": [],
  "hasNextPage": false
}
```

첫 페이지도 항상 `hasNextPage=false`다.

## 4. Next 랭킹 파서

Legacy 선택자와 fallback을 공유하지 않는다. Next 랭킹 내부에서도 카드 형태별 제목 선택자를 명시한다.

### 4.1 카드 형태

| 순위 | 루트 선택자 | 제목 | 표지 |
|---|---|---|---|
| 1위 | `a.rank-v2-champion` | `h2` | `.rank-v2-cover img` 중 첫 이미지 |
| 2~3위 | `a.rank-v2-runner` | `.rank-v2-runner-body > strong` | `.rank-v2-cover img` 중 첫 이미지 |
| 4~50위 | `a.rank-v2-row` | `.rank-v2-row-title > strong` | `.rank-v2-cover img` 중 첫 이미지 |

각 루트 앵커의 `href`를 작품 링크로 그대로 보존한다. 숫자 ID와 `u-...` slug ID를 해석하거나 변환하지 않는다.

플랫폼 아이콘도 `img`이므로 반드시 각 카드의 `.rank-v2-cover` 안에서 첫 번째 이미지만 표지로 선택한다.

### 4.2 순서

반환 순서는 다음과 같이 고정한다.

1. champion
2. runners의 DOM 순서
3. rows의 DOM 순서

실시간 표본은 champion 1개, runner 2개, row 47개로 총 50개다. 파서는 총 개수를 50으로 하드코딩하지 않지만, 발견된 각 카드의 제목과 링크가 없으면 구조 오류를 발생시킨다.

## 5. 오류 처리

다음은 정상 빈 목록으로 처리하지 않는다.

- HTTP 2xx~3xx 범위를 벗어난 응답
- HTML이 아닌 Content-Type
- `rank-v2-page` 컨테이너가 없는 응답
- 첫 페이지에 세 카드 선택자가 모두 없는 응답
- 카드에 제목 또는 작품 링크가 없는 응답

오류에는 `parserFamily=next`, 요청 URL과 누락된 선택자를 포함한다. Cloudflare, 점검 페이지나 구조 변경을 빈 랭킹으로 오인하지 않기 위해서다.

표지가 없는 작품은 작품 자체를 버리지 않고 빈 `imageUrl`로 유지한다.

## 6. 테스트

실제 응답에서 최소 fixture를 새로 추출하되 전체 페이지나 과거 파서 데이터를 복사하지 않는다.

필수 테스트는 다음과 같다.

- Source와 `index.json`의 기본 URL, 버전과 내장 manifest 일치
- 기본 parser family가 Next임
- Popular 첫 페이지 URL의 `period=week`, `kind=webtoon`
- 사용자 지정 Next base URL 적용
- Popular 2페이지는 요청 없이 빈 목록
- champion, runner, row의 제목·표지·링크 파싱
- 숫자 ID와 slug ID 보존
- 플랫폼 아이콘을 표지로 잘못 선택하지 않음
- 반환 순서 유지와 `hasNextPage=false`
- HTTP 오류, 비 HTML, 구조 누락과 잘못된 카드 오류
- Legacy 설정 시 기존 Legacy 테스트가 계속 통과
- 전체 `pnpm test` 회귀 검증

## 7. 배포와 수동 검증

테스트 통과 후 `master`에 반영하고 다음 주소의 HTTP 200과 manifest를 확인한다.

```text
https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/index.json
```

사용자는 Mangayomi에서 저장소를 갱신한 뒤 NTK Webtoon `0.2.0`을 적용하여 다음을 확인한다.

- Popular에 1~50위가 사이트 순서대로 보이는지
- 제목과 표지가 올바른지
- 숫자 및 slug 작품을 눌렀을 때 링크가 보존되는지
- 추가 페이지 로딩이 반복되지 않는지

상세와 회차 기능은 아직 구현 범위가 아니므로 작품 진입 성공은 이 단계의 완료 조건이 아니다.
