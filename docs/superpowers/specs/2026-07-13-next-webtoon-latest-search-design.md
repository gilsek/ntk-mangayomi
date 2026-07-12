# Next Webtoon Latest 및 제목 검색 설계

## 1. 목표와 범위

NTK Webtoon Source ID `260713001`에 Next 계열 Latest 목록과 제목 검색을 추가한다. 기본 도메인은 숫자 설정 `9`로 구성한 `https://sbxh9.com`이며 버전은 `0.102`로 올린다.

이번 범위에 포함되는 기능은 다음과 같다.

- Latest 탭 노출
- `/ing?page=N` 최신 목록 요청과 페이지 처리
- `/search?q={query}&field=title&match=contains` 제목 검색
- 통합 검색 결과에서 Webtoon만 분리
- 빈 목록, 표지 누락, HTTP 오류, 비HTML 응답과 구조 변경 처리
- 최소 fixture와 요청·파서 회귀 테스트
- `index.json`과 내장 `mangayomiSources` 메타데이터 동기화

필터, 작품 상세, 회차 목록과 회차 이미지는 포함하지 않는다. Popular과 Legacy 동작도 변경하지 않는다.

## 2. 조사 기준과 계층 경계

계약은 2026-07-13 현재 `https://sbxh9.com/ing`과 공개 검색 응답에서 직접 확인했다. 로컬 `resource/` HTML, 과거 GitHub 파서와 기존 통합 `ntk.js` 구현은 조사 입력으로 사용하지 않았다.

Next Latest와 Next 검색은 각각 전용 요청 함수와 전용 파서 함수를 가진다. 카드 모양이 비슷해도 두 파서 사이에 카드 파싱 함수를 공유하지 않는다. 기존 Next URL 정규화와 응답 상태 검증처럼 콘텐츠 구조와 무관한 보조 로직만 재사용할 수 있다.

다음 파서 사이에는 선택자 fallback을 두지 않는다.

- Next Popular
- Next Latest
- Next 제목 검색
- Legacy 목록

## 3. Next Latest 계약

### 요청

- 1페이지: `GET https://sbxh{number}.com/ing?page=1`
- 이후 페이지: `GET https://sbxh{number}.com/ing?page={page}`
- 기본 페이지 크기: 42개
- 확장에 설정된 브라우저형 `User-Agent`와 현재 Next Base URL의 `Referer`를 사용한다.

현재 서버는 `/ing`과 `/ing?page=1`을 같은 첫 페이지로 처리하지만 확장에서는 모든 페이지에 `page`를 명시해 요청 계약을 단순화한다.

### 목록 구조

- 페이지 목록 컨테이너: `div.card-grid`
- 작품 카드: `div.card-grid > a.card[href^="/webtoon/"]`
- 작품 제목: `p.subject`
- 작품 링크: 카드 루트의 `href`
- 표지: `.thumb img:not(.platform-icon)`의 첫 이미지

`.thumb`의 첫 번째 이미지는 플랫폼 아이콘일 수 있으므로 단순히 첫 `img`를 표지로 사용하지 않는다. 표지가 없으면 작품은 유지하고 `imageUrl`만 빈 문자열로 반환한다.

### 페이지 판정

- 현재 페이지 표식: `.pager-num.is-active`
- 다음 묶음 버튼: `button[aria-label^="다음"]`
- `button[aria-label^="다음"]:not([disabled])`가 하나라도 있으면 `hasNextPage=true`다.
- 마지막 정상 페이지에서 다음 버튼은 모두 `disabled`이며 `hasNextPage=false`다.
- 범위를 넘긴 페이지는 `.ep-empty`를 가진 정상 빈 목록으로 처리한다.

2026-07-13 관측값은 1·2페이지 각 42개, 182페이지 13개, 183페이지 0개였다. 이 숫자는 fixture 검증 근거이며 런타임에서 전체 페이지 수를 하드코딩하지 않는다.

## 4. Next 제목 검색 계약

### 요청

- `GET https://sbxh{number}.com/search?q={query}&field=title&match=contains`
- `q`는 URL query component로 인코딩한다.
- `field=title`과 `match=contains`는 고정한다.
- 공백을 제거한 검색어가 비어 있으면 네트워크 요청 없이 빈 목록을 반환한다.

### 결과 구조

검색은 Webtoon, Manhwa, Novel과 Anime이 섞인 통합 결과를 반환한다. Webtoon Source는 다음 선택자에 일치하는 카드만 반환한다.

- 검색 컨테이너: `div.search-results-grid`
- Webtoon 카드: `div.search-results-grid > a.card[href^="/webtoon/"]`
- 제목: `p.subject`
- 링크: 카드 루트의 `href`
- 표지: `.thumb img:not(.platform-icon)`의 첫 이미지
- 빈 검색 결과: `.ep-empty`와 `검색 결과가 없습니다`

다른 종류의 카드가 존재해도 오류가 아니며 결과에서 제외한다. 검색 컨테이너 안에 카드가 있지만 Webtoon 카드가 하나도 없는 경우에도 정상 빈 Webtoon 결과다.

### 검색 페이지 처리

현재 검색 페이지는 결과를 한 번에 반환하며 `page=2`를 추가해도 같은 결과가 반복된다. 중복 요청과 무한 페이지를 막기 위해 다음 규칙을 사용한다.

- Mangayomi 검색 1페이지에서만 네트워크 요청
- 2페이지부터는 요청 없이 `{ list: [], hasNextPage: false }`
- 1페이지 결과도 항상 `hasNextPage=false`

## 5. 응답 검증과 오류 처리

Latest와 검색은 각각 다음 순서로 응답을 검증한다.

1. HTTP 상태가 200인지 확인한다.
2. `Content-Type`이 HTML인지 확인한다.
3. 정상 목록 표식 또는 정상 빈 표식이 있는지 확인한다.
4. 각 Webtoon 카드의 제목과 링크가 존재하는지 확인한다.

HTTP 403/500, JSON 응답, 로그인·점검 페이지, 필수 컨테이너 누락과 손상된 카드가 발생하면 빈 목록으로 숨기지 않고 `parserFamily=next`, 기능 이름과 요청 URL을 포함한 오류를 던진다.

검색 응답에서 `.ep-empty`가 있으면 정상 빈 결과다. Latest 응답도 `.ep-empty`가 있으면 정상 빈 페이지다. 단, 아무 목록 표식도 빈 표식도 없는 HTML은 구조 오류다.

## 6. Source 노출과 버전

- `supportsLatest`는 Next와 Legacy 모두 `true`가 된다.
- `getLatestUpdates(page)`는 파서 계열에 따라 Next Latest 또는 Legacy Latest로 명시적으로 분기한다.
- `search(query, page, filters)`는 Next 제목 검색 또는 Legacy 검색으로 명시적으로 분기한다.
- Next 필터 목록은 계속 빈 배열이다.
- 버전은 내장 메타데이터와 `index.json` 모두 `0.102`로 맞춘다.
- Source ID `260713001`, `isNsfw: true`, 기본 Base URL `https://sbxh9.com`과 숫자 도메인 설정은 유지한다.

## 7. 테스트와 수동 검증

자동 테스트는 다음을 포함한다.

- `/ing?page=1`과 이후 페이지 URL
- Latest 카드 42개 형태와 제목·링크·표지
- 플랫폼 아이콘 제외와 표지 누락 유지
- 활성 페이지 및 enabled/disabled 다음 버튼에 따른 `hasNextPage`
- `.ep-empty` 정상 빈 Latest 페이지
- 제목 검색 query 인코딩과 고정 필드
- 혼합 검색 결과에서 `/webtoon/`만 반환
- Webtoon이 없는 통합 검색 결과와 완전 빈 검색 결과
- 검색 2페이지의 무요청 빈 결과
- Latest와 검색의 HTTP·Content-Type·구조 오류
- Popular 및 Legacy 회귀 테스트
- 내장 메타데이터와 `index.json`의 `0.102` 일치

실사이트 검증은 기본 도메인에서 다음만 확인한다.

- `/ing?page=1`, `/ing?page=2`가 서로 다른 작품을 반환한다.
- Latest 페이지당 42개와 마지막 페이지의 `hasNextPage=false`가 성립한다.
- 한글 제목 검색이 Webtoon 결과를 반환한다.
- 결과 없는 제목 검색이 정상 빈 결과를 반환한다.

실사이트 전체 HTML은 저장하지 않고 선택자 계약에 필요한 최소 fixture만 저장한다.

## 8. 완료 기준

- Mangayomi에서 Latest 탭이 표시된다.
- Latest 1페이지와 다음 페이지의 작품 목록이 중복 없이 표시된다.
- 제목 일부로 검색했을 때 Webtoon만 표시된다.
- 검색 결과가 없을 때 오류 없이 빈 목록이 표시된다.
- Popular과 Legacy 목록 회귀 테스트가 유지된다.
- 저장소 전체 테스트와 실사이트 smoke test가 통과한다.
- 사용자 수동 확인 전에는 필터·상세·회차 구현으로 넘어가지 않는다.
