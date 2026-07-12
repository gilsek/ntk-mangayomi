# Legacy Webtoon 작품 목록 구현 계획

> **상태:** 로컬 구현·자동 검증·라이브 스모크 완료 v1.2. Git 게시와 사용자 클라이언트 검증은 대기 중이다.

## 목표

현재 `newtoki1.org`에서 직접 검증한 계약만 사용해 신규 Webtoon Source의 다음 기능을 구현한다.

1. 인기 목록: `getPopular(page)` → 조회순
2. 최신 목록: `getLatestUpdates(page)` → 최신순
3. 제목 검색: `search(query, page, filters)`
4. 작가, 분류, 요일, 초성, 플랫폼, 장르, 정렬 전체 필터
5. 정상 빈 결과, 마지막 페이지, 표지 누락과 구조 오류의 구분

이번 계획은 작품 목록 단계에만 한정한다. 작품 상세, 에피소드 목록, 에피소드 이미지와 Next 계열 파서는 후속 계획으로 남긴다. `index.json`은 사용자가 클라이언트에서 목록을 직접 테스트할 수 있도록 개발 단계 엔트리로 갱신한다.

## 구현 근거와 금지 입력

- 계약 원본: `docs/research/2026-07-13-newtoki1-webtoon-list-contract.md`
- 상위 로드맵: `docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md`
- 기본 도메인: `https://newtoki1.org`
- 파서 계열: `legacy`
- 신규 Source ID: `260713001`
- 최초 Webtoon 개발 버전: `0.1.0`
- Source 메타데이터: `isNsfw: true`

다음 자료는 구현 입력으로 사용하지 않는다.

- 기존 `javascript/manga/src/ko/ntk.js`
- 기존 NTK 테스트
- `resource/` 내부 HTML
- 과거 계획과 과거 파서에서 추출한 selector 또는 URL 규칙

fixture가 필요하면 구현 시점의 `newtoki1.org` 응답을 새로 받아 최소 구조로 축약하고, 수집 URL과 날짜를 fixture 주석 또는 인접 문서에 기록한다.

## 변경 경계

### 이번 구현 승인 시 생성할 파일

```text
javascript/manga/src/ko/ntk_webtoon.js
tests/webtoon/helpers/load-webtoon-source.js
tests/webtoon/fixtures/legacy-list-page-1.html
tests/webtoon/fixtures/legacy-list-last-page.html
tests/webtoon/fixtures/legacy-list-empty.html
tests/webtoon/fixtures/legacy-list-missing-cover.html
tests/webtoon/legacy-list-request.test.js
tests/webtoon/legacy-list-parser.test.js
tests/webtoon/legacy-list-filter.test.js
tests/webtoon/index-entry.test.js
```

fixture 수는 구현 중 실제 증거가 겹치면 줄일 수 있다. 서로 다른 계약을 한 fixture가 명확히 검증할 수 있을 때만 합친다.

### 이번 구현 승인 시 수정할 파일

```text
index.json
```

기존 Webtoon 엔트리를 신규 ID `260713001`, 신규 구현 파일과 `isNsfw: true`로 교체한다. Manhwa와 Novel 엔트리는 변경하지 않는다.

### 이번 단계에서 수정하지 않을 파일

```text
javascript/manga/src/ko/ntk.js
기존 tests 하위 파일
resource/**
```

`index.json`의 Webtoon 엔트리에는 목록 기능만 구현된 개발 단계임을 `notes`로 명시한다. 상세·회차·이미지가 완성되기 전까지 안정 버전으로 표시하지 않는다.

## 내부 구조 원칙

`ntk_webtoon.js` 안에서만 다음 책임을 분리한다. 다른 계층과 공유 파일을 만들지 않는다.

```text
설정 읽기
  └─ Legacy 요청 URL 생성
       ├─ 필터 직렬화
       └─ HTTP 요청
            └─ Legacy 목록 응답 파싱
                 ├─ 작품 필드 추출
                 ├─ 빈 결과 판정
                 └─ 다음 페이지 판정
```

예상되는 내부 함수 경계는 다음과 같다. 함수명은 구현 전에 Mangayomi 실행 형식과 충돌하지 않는지 확인하고 확정한다.

```js
function getWebtoonSettings() {}
function normalizeBaseUrl(value) {}
function buildLegacyListUrl({ mode, query, page, filters }) {}
function serializeLegacyFilters(filters) {}
function parseLegacyListPage(html, requestedPage) {}
function parseLegacyListItem(element) {}
function hasLegacyNextPage(document, requestedPage) {}
```

이 함수들은 Webtoon 파일 내부 전용이다. Manhwa, Novel, Anime 구현으로 이동하거나 공통 모듈로 승격하지 않는다.

## 작업 0: 변경 전 안전 점검

**읽기 전용 확인 대상**

- Git 브랜치와 작업 트리
- 이번 계획 문서와 승인된 계약 문서
- `package.json`의 테스트 명령

**절차**

1. `git branch --show-current`가 `codex/webtoon-rebuild`인지 확인한다.
2. `git status --short`로 사용자 변경과 미추적 파일을 기록한다.
3. `resource/`가 미추적 상태여도 추가·수정·스테이징하지 않는다.
4. 실제 생성 예정 파일이 아직 존재하지 않는지 확인한다.
5. Mangayomi 고정 기준 커밋 `c1302608767d6699c38ae40ce3c6c23c8e116a86`의 공식 JavaScript API에서 Source 진입 객체, 목록 반환형과 설정 API만 확인한다.
6. 생성·수정할 파일 목록과 첫 검증 명령을 사용자에게 제시하고 구현 허락을 받는다.

**검증 명령**

```powershell
git branch --show-current
git status --short
Test-Path 'javascript/manga/src/ko/ntk_webtoon.js'
Test-Path 'tests/webtoon'
```

**중단 조건**

- 대상 파일이 이미 존재하면 덮어쓰지 않고 내용을 읽기 전에 사용자에게 알린다.
- 예상하지 못한 tracked 변경이 있으면 겹치는 범위를 분석하기 전까지 구현하지 않는다.

## 작업 1: Webtoon 전용 테스트 로더와 최소 fixture

**생성 파일**

- `tests/webtoon/helpers/load-webtoon-source.js`
- `tests/webtoon/fixtures/legacy-list-page-1.html`
- `tests/webtoon/fixtures/legacy-list-last-page.html`
- `tests/webtoon/fixtures/legacy-list-empty.html`
- `tests/webtoon/fixtures/legacy-list-missing-cover.html`

**테스트 로더 책임**

- Node `vm` 또는 현재 저장소의 무의존 방식으로 `ntk_webtoon.js`를 격리 로드한다.
- Mangayomi가 제공하는 네트워크, 설정, HTML 파서 경계를 테스트 대역으로 주입한다.
- 요청 URL, 요청 횟수와 반환 HTML을 기록한다.
- Webtoon 테스트 폴더 밖에서 재사용하지 않는다.

**fixture 원칙**

- 현재 사이트에서 다시 수집한 HTML만 사용한다.
- 개인 정보, 쿠키, Cloudflare 토큰과 불필요한 스크립트는 저장하지 않는다.
- selector 계약을 검증하는 데 필요한 부모·자식 구조와 속성만 남긴다.
- 숫자 키 작품과 slug 키 작품을 모두 포함한다.
- 표지 없는 항목도 결과에서 유지되는 표본을 포함한다.

**우선 검증**

```powershell
node --test tests/webtoon/legacy-list-parser.test.js
```

이 단계에서는 아직 테스트 파일이 없으므로 실제 커밋 지점이 아니다. fixture와 로더는 첫 실패 테스트와 함께 생성한다.

## 작업 2: 요청 URL 계약을 실패 테스트로 고정

**생성 파일**

- `tests/webtoon/legacy-list-request.test.js`

**테스트 사례**

1. 기본 URL 끝의 `/` 유무와 관계없이 `/webtoon`이 한 번만 붙는다.
2. `getPopular(1)`은 `sst=as_view`, `sod=desc`를 보낸다.
3. `getLatestUpdates(1)`은 `sst=as_update`, `sod=desc`를 보낸다.
4. 검색은 `stx=<제목>`을 표준 GET query로 전송하고 `__q` URL을 직접 만들지 않는다.
5. 두 글자 이상 검색은 서버의 302 redirect를 HTTP 계층에 맡긴다.
6. 한 글자 제목 검색은 네트워크를 호출하지 않고 빈 목록을 반환한다.
7. 빈 제목과 필터 조합은 네트워크를 호출한다.
8. `page > 1`일 때만 `page` 값을 직렬화한다.
9. 고정값 `kind=webtoon`, `pub=ongoing`을 보존한다.
10. 사용자가 고른 필터만 해당 필드로 직렬화한다.

**필터 직렬화 표**

| UI 필터 | 요청 필드 | 형식 |
|---|---|---|
| 제목 | `stx` | 문자열 |
| 작가 | `author` | 문자열 |
| 분류 | `toon` | 선택값 |
| 요일 | `yoil` | 선택값 |
| 초성 | `jaum` | 선택값 |
| 플랫폼 | `plat` | 선택값 |
| 장르 | `tag` | 선택값 |
| 정렬 | `sst` | 선택값 |
| 정렬 방향 | `sod` | 항상 `desc` |
| 페이지 | `page` | 2 이상 정수 |

**첫 실행의 기대 결과**

```powershell
node --test tests/webtoon/legacy-list-request.test.js
```

신규 구현이 없으므로 테스트가 실패해야 한다. 실패 원인이 모듈 부재 또는 미구현 요청 함수인지 확인하고 기록한다.

## 작업 3: 최소 Source 골격과 설정 읽기

**생성 파일**

- `javascript/manga/src/ko/ntk_webtoon.js`

**최소 구현 범위**

1. Mangayomi가 요구하는 Webtoon Source 진입 객체와 목록 메서드를 선언한다.
2. 기본 `baseUrl`은 `https://newtoki1.org`로 둔다.
3. 사용자 설정의 `baseUrl`을 읽고 끝의 `/`만 정규화한다.
4. `parserFamily` 기본값을 `legacy`로 읽는다.
5. 이번 단계에서 `legacy` 외 값이 들어오면 조용히 다른 파서를 시도하지 않고 명시적 미지원 오류를 낸다.
6. 설정 키는 Webtoon 파일 안에서만 정의한다.

개념적 상수는 다음과 같다.

```js
const DEFAULT_BASE_URL = "https://newtoki1.org";
const DEFAULT_PARSER_FAMILY = "legacy";
```

`toki30.com` 또는 `sbxh9.com`을 자동 대체 URL로 넣지 않는다. 도메인 전환은 사용자 수동 설정만 허용한다.

**검증**

```powershell
node --test tests/webtoon/legacy-list-request.test.js
```

요청 생성 테스트가 통과하기 전에는 파서 구현으로 넘어가지 않는다.

## 작업 4: 필터 UI 계약 구현

**수정 파일**

- `javascript/manga/src/ko/ntk_webtoon.js`
- `tests/webtoon/legacy-list-filter.test.js`

**실패 테스트로 고정할 항목**

- 작가는 `TextFilter`다.
- 분류, 요일, 초성, 플랫폼, 장르, 정렬은 `SelectFilter`다.
- 빈 선택값은 해당 query 필드를 보내지 않는다.
- 성인 분류의 요청값은 `성인웹툰`이다.
- BL/GL 분류의 요청값은 `BL/GL`이다.
- 장르의 BLGL 요청값은 `BLGL`이다.
- 플랫폼의 표시명과 숫자 값 매핑은 승인 계약과 정확히 일치한다.
- 정렬 6종은 모두 `desc`와 함께 전송된다.

**구현 주의점**

- 표시명과 실제 요청값을 별도 데이터로 둔다.
- 초성 `ㅂ`을 임의로 `ㅂ/ㅃ` 같은 다른 값으로 변환하지 않는다. 사이트가 `jaum=ㅂ`을 해석하게 둔다.
- 필터 초기화 시 이전 `page`를 보존하지 않는다.
- `pub=ongoing`의 의미를 추측해 UI 필터로 노출하지 않는다.

**검증**

```powershell
node --test tests/webtoon/legacy-list-filter.test.js
node --test tests/webtoon/legacy-list-request.test.js
```

## 작업 5: Legacy 작품 목록 파서 구현

**수정 파일**

- `javascript/manga/src/ko/ntk_webtoon.js`
- `tests/webtoon/legacy-list-parser.test.js`

**selector 계약**

| 필드 | selector 또는 규칙 |
|---|---|
| 항목 | `#webtoon-list-all > li` |
| 제목 | `span.title.white` |
| 작품 URL | 첫 `a[href^="/webtoon/"]` |
| 표지 | `img.theme-thumb-img` |
| 플랫폼 | `div.list-platform[title]`의 `title` |
| 날짜 | `div.list-date` |
| 분류 보조값 | 항목의 `data-weekday`, `data-initial`, `data-genre` |

**파서 테스트 사례**

1. 목록 항목 수와 반환 항목 수가 같다.
2. 제목 앞뒤 공백을 제거한다.
3. 작품 URL은 숫자와 slug를 구분하지 않고 상대경로 문자열 그대로 보존한다.
4. slug를 숫자로 변환하거나 버리지 않는다.
5. 상대 표지 URL은 현재 설정의 `baseUrl` 기준 절대 URL로 만든다.
6. 표지 노드가 없으면 `imageUrl`은 빈 문자열이고 항목은 유지한다.
7. 플랫폼과 날짜가 없을 때 전체 항목을 버리지 않는다.
8. 목록 컨테이너가 있고 유효 항목이 있으면 정상 결과다.
9. `div.wr-none`이 있으면 정상 빈 결과다.
10. 목록과 `wr-none`이 모두 없으면 구조 오류다.
11. HTML이 아닌 응답, 최종 4xx/5xx, timeout은 빈 결과로 바꾸지 않는다.

**오류 메시지 원칙**

- 오류에는 `parserFamily`, 요청 URL과 누락된 핵심 selector를 포함한다.
- HTML 본문, 쿠키, 헤더 전체는 오류에 출력하지 않는다.
- Legacy 실패 시 Next 파서를 자동 호출하지 않는다.

**검증**

```powershell
node --test tests/webtoon/legacy-list-parser.test.js
```

## 작업 6: 다음 페이지 판정 구현

**수정 파일**

- `javascript/manga/src/ko/ntk_webtoon.js`
- `tests/webtoon/legacy-list-parser.test.js`

**판정 계약**

1. pagination의 활성 페이지 숫자를 찾는다.
2. pagination 링크가 가진 모든 실제 페이지 숫자의 최댓값을 찾는다.
3. `currentPage < maxPage`일 때만 `hasNextPage`를 `true`로 반환한다.
4. 오른쪽 화살표의 존재만으로 다음 페이지라고 판정하지 않는다.
5. pagination이 없고 정상 목록 또는 `wr-none`만 있으면 다음 페이지는 없다.

개념식:

```js
const hasNextPage = currentPage < maxPage;
```

**테스트 표본**

| 표본 | 현재 | 최댓값 | 기대값 |
|---|---:|---:|---|
| 기본 1페이지 | 1 | 80 | `true` |
| 기본 마지막 페이지 | 80 | 80 | `false` |
| 조합 검색 1페이지 | 1 | 2 | `true` |
| 조합 검색 2페이지 | 2 | 2 | `false` |

**검증**

```powershell
node --test tests/webtoon/legacy-list-parser.test.js
```

## 작업 7: 공개 목록 메서드 연결

**수정 파일**

- `javascript/manga/src/ko/ntk_webtoon.js`
- `tests/webtoon/legacy-list-request.test.js`
- `tests/webtoon/legacy-list-filter.test.js`
- `tests/webtoon/legacy-list-parser.test.js`

**연결 순서**

```text
getPopular / getLatestUpdates / search
  → 설정 읽기
  → parserFamily=legacy 확인
  → URL과 query 생성
  → HTTP 요청
  → 상태·콘텐츠 형식 확인
  → Legacy 목록 파싱
  → { list, hasNextPage } 반환
```

**검색 단축 반환**

한 글자 제목이면 HTTP 요청 전에 빈 결과를 반환한다.

```js
if (normalizedQuery.length === 1) {
  return { list: [], hasNextPage: false };
}
```

빈 제목은 필터 검색에 필요하므로 같은 단축 반환을 적용하지 않는다.

**검증**

```powershell
node --test tests/webtoon/*.test.js
pnpm test
```

첫 명령은 Webtoon 범위 회귀를, 두 번째 명령은 저장소 전체 Node 테스트 회귀를 확인한다. `pnpm`을 사용할 수 없는 환경이면 패키지를 설치하지 않고 원인을 보고한 뒤 `node --test`를 대체 검증으로 사용한다.

## 작업 8: 실제 사이트 스모크 검증

자동 테스트 통과 뒤에만 실행한다. 라이브 응답은 바뀔 수 있으므로 fixture 테스트와 분리한다.

**검증 항목**

1. `newtoki1.org/webtoon` 인기·최신 각 1페이지
2. 두 글자 이상 제목 검색
3. 존재하지 않는 제목의 정상 빈 결과
4. 성인웹툰 분류 단독
5. 작가 검색 단독
6. 요일+장르+플랫폼 3중 조합
7. 기본 마지막 페이지
8. 표지 누락 항목이 있을 경우 항목 보존

**모바일 UA 표본**

- iPhone Safari 계열 UA
- Android 태블릿 WebView 계열 UA

두 UA의 결과가 다르면 성공으로 간주하지 않고 응답 상태, 최종 URL, 콘텐츠 형식과 목록 개수를 기록한다.

**비밀정보 보호**

- 쿠키, `cf_clearance`, 전체 헤더와 WebView 세션 값은 로그 또는 fixture에 저장하지 않는다.

## 목록 단계 완료 게이트

다음 조건을 모두 만족해야 작품 상세 계획으로 넘어간다.

- Webtoon 전용 테스트 전체 통과
- 저장소 전체 `pnpm test` 통과 또는 `pnpm` 부재를 기록한 `node --test` 대체 검증 통과
- 한 글자 검색에서 요청 횟수 0 확인
- 숫자·slug 작품 URL 보존 확인
- 성인 필터와 전체 필터 매핑 확인
- 마지막 페이지 오판 없음
- 정상 빈 결과와 구조 오류가 구분됨
- iPhone 및 Android 태블릿 UA 스모크 결과 기록
- `resource/`, 과거 `ntk.js`, 과거 테스트가 변경되지 않음
- `index.json`의 Webtoon 엔트리만 신규 ID와 신규 파일로 교체되고 Manhwa·Novel 엔트리는 보존됨

완료 후 사용자에게 다음 내용을 보고한다.

1. 생성·수정 파일
2. 테스트 명령과 결과
3. 라이브 스모크 결과와 검증 시각
4. 남은 불확실성
5. Git diff 요약
6. 커밋 또는 작품 상세 단계 진행 여부에 대한 승인 요청

## 작업 10: 클라이언트 테스트용 `index.json` 연결

**생성·수정 파일**

- `tests/webtoon/index-entry.test.js`
- `index.json`

**RED 테스트**

1. ID `260713001`인 Webtoon 엔트리가 정확히 하나다.
2. `itemType`은 `0`이다.
3. `sourceCodeUrl`의 파일명은 `ntk_webtoon.js`다.
4. `isNsfw`는 `true`다.
5. 버전은 `0.1.0`이다.
6. 기본 `baseUrl`은 `https://newtoki1.org`다.
7. `notes`는 목록 개발 단계이며 상세·회차·이미지가 미구현임을 알린다.
8. 과거 Webtoon ID `240710001`은 제거된다.
9. 기존 Manhwa ID `240710002`와 Novel ID `240710003`의 직렬화 결과는 변경 전과 동일하다.

**GREEN 변경**

기존 Webtoon 엔트리 한 개만 신규 메타데이터로 교체한다. `additionalParams`를 과거 다중 Source 분기 수단으로 재사용하지 않는다. Mangayomi가 Source 설정을 구현 파일에서 읽는 구조라면 엔트리에는 불필요한 설정 복제본을 넣지 않는다.

**검증**

```powershell
node --test tests/webtoon/index-entry.test.js
node --test tests/webtoon/*.test.js
pnpm test
```

클라이언트에서는 목록까지만 검증한다. 작품을 눌렀을 때의 상세 동작은 이번 완료 조건에 포함하지 않는다.

## 커밋 체크포인트 후보

커밋은 자동 생성하지 않는다. 각 경계에서 검증 결과를 제시하고 사용자 승인을 받는다.

### 체크포인트 A: 목록 계약 구현

- Webtoon 전용 fixture, 테스트 로더와 테스트
- `ntk_webtoon.js`의 설정, 요청, 필터, 목록 파서
- 신규 Webtoon `index.json` 엔트리와 manifest 테스트
- `node --test tests/webtoon/*.test.js` 통과
- `pnpm test` 통과 또는 사유가 기록된 `node --test` 대체 검증 통과

권장 커밋 메시지:

```text
feat: implement legacy webtoon listing
```

### 체크포인트 B: 라이브 목록 검증

라이브 검증에서 코드 변경이 필요하지 않으면 별도 커밋을 만들지 않는다. 코드나 fixture가 바뀌면 변경 근거와 재검증 결과를 보고한 뒤 별도 승인받는다.

## 후속 계획으로 넘길 항목

- 작품 상세 페이지 계약과 구현
- 에피소드 목록 계약과 구현
- 에피소드 이미지 목록 계약과 구현
- Next 계열 Webtoon 파서
- 사용자 수동 `baseUrl`/`parserFamily` 전환의 실기기 검증
- 네 Source가 완성된 시점의 `0.5.0` 통합 버전 정규화

## 바로 다음 승인 요청 범위

이 계획이 승인되면 다음 한 묶음만 먼저 실행한다.

```text
1. tests/webtoon 전용 로더·최소 fixture 생성
2. 요청·필터·목록 파서 실패 테스트 생성
3. javascript/manga/src/ko/ntk_webtoon.js 최소 구현
4. index.json의 Webtoon 엔트리를 신규 ID와 신규 파일로 교체
5. Webtoon 범위 테스트와 저장소 전체 테스트
```

작품 상세, 회차와 이미지는 이 묶음에 포함하지 않는다.

## 2026-07-13 실행 체크포인트

### 구현 결과

- 신규 Source: `javascript/manga/src/ko/ntk_webtoon.js`
- 신규 Source ID: `260713001`
- 버전: `0.1.0`
- 기본 주소: `https://newtoki1.org`
- 기본 파서: `legacy`
- NSFW: `true`
- 구현 범위: 인기, 최신, 제목 검색, 전체 필터, 작품 목록 파싱, 빈 결과와 오류 구분, 다음 페이지 판정
- 미구현 범위: 작품 상세, 회차, 이미지 리더, Next 파서
- `index.json`: 기존 Webtoon 엔트리를 신규 ID와 신규 파일로 교체

### TDD 및 회귀 검증

- Webtoon 전용 테스트: 21개 통과
- 저장소 전체 `pnpm test`: 59개 통과
- 기존 manifest 테스트 두 개는 과거 Webtoon을 `ntk.js`와 버전 `0.3.11`로 고정해 실패했다.
- 파서 테스트를 변경하지 않고 manifest 테스트의 소유 경계를 분리했다.
  - 신규 Webtoon은 `ntk_webtoon.js`와 비교
  - 기존 Manhwa·Novel은 과거 `ntk.js`와 계속 비교

### 라이브 스모크

2026-07-13 현재 `newtoki1.org`를 직접 요청하고 신규 파서로 처리했다.

| 표본 | 결과 |
|---|---|
| iPhone 인기 | 200, 96개, 다음 페이지 있음 |
| Android 태블릿 인기 | 200, 96개, iPhone과 링크 해시 동일 |
| 제목 검색 | 200, 4개, 표준 query 뒤 검색 경로 redirect |
| 성인웹툰 | 200, 96개 |
| 월+로맨스+네이버 | 200, 96개, 다음 페이지 있음 |
| 무결과 | 200, 0개, 다음 페이지 없음 |
| 기본 80페이지 | 200, 31개, 다음 페이지 없음, 표지 누락 1개 보존 |

### 게시 전 남은 게이트

- 현재 변경은 로컬에만 있으며 커밋·push되지 않았다.
- `index.json`과 내장 Source의 `sourceCodeUrl`은 클라이언트 테스트를 위해 GitHub `codex/webtoon-rebuild` raw URL을 가리킨다.
- 사용자 클라이언트에서 테스트하려면 현재 변경을 커밋하고 같은 브랜치로 push해야 한다.
- PR 병합 직전에는 `sourceCodeUrl`을 `master`로 전환하고 버전을 올린 뒤 다시 검증한다.
- 작품 상세가 없으므로 클라이언트 검증 범위는 목록·검색·필터까지만이다.
