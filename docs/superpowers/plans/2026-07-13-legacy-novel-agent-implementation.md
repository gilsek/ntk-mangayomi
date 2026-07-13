# Legacy Novel Agent Implementation Plan

> **실행 지침:** 이 문서는 구현 승인을 받기 위한 계획서다. 승인 전에는 확장 코드와 `index.json`을 수정하지 않는다. 승인 후에는 `superpowers:subagent-driven-development`와 `superpowers:test-driven-development`를 사용해 한 단계씩 구현하고, 각 단계의 검토와 실기기 확인이 끝나야 다음 단계로 넘어간다.

**목표:** `newtoki1.org` 레거시 계열을 기본으로 사용하는 독립 `NTK Novel` Source를 새 ID로 만들고, Popular/Latest부터 텍스트 리더까지 다섯 단계로 검증한다.

**핵심 구조:** 기존 혼합 파일 `javascript/manga/src/ko/ntk.js`는 구현 재료로 복사하거나 호출하지 않는다. 소설 전용 파일은 Mangayomi 공식 Novel 디렉터리 관례에 맞춰 `javascript/novel/src/ko/ntk_novel.js`에 둔다. 목록, 검색/필터, 상세/회차, 본문 파서는 서로 구획을 나누고 레거시 계약만 처리한다. Next/Hybrid 모드는 이번 범위에서 넣지 않는다.

**기술:** Mangayomi JavaScript Source API, Node.js `node:test`, Node `vm`, HTML/JSON 고정 fixture, 실제 iPhone·Android 패드 검증, Git master 직접 배포.

## 1. 병렬 조사 결과와 확정 계약

### 1.1 Source와 배포 정책

- 신규 Source ID: `260713003`
- 이름: `NTK Novel`
- 기본 주소: `https://newtoki1.org`
- 파일: `javascript/novel/src/ko/ntk_novel.js`
- 테스트: `tests/novel/**`
- `itemType: 2`, `isManga: false`, `additionalParams: ""`
- 기존 ID `240710003`과 신규 ID는 자동으로 연결하지 않는다. 사용자의 기존 라이브러리·읽음 상태도 자동 마이그레이션되지 않는다.
- 과거 `javascript/manga/src/ko/ntk.js`는 삭제하지 않는다. 다른 과거 엔트리의 정리가 모두 끝난 뒤 별도 승인으로 처리한다.
- PR과 기능 브랜치를 만들지 않는다. 각 단계가 승인되면 검증된 커밋을 `master`에 직접 쌓고, 사용자가 실기기 테스트할 수 있도록 해당 버전의 `index.json`도 함께 배포한다.
- 단계 버전은 `0.301` 목록, `0.302` 검색/필터, `0.303` 상세+전체 회차, `0.304` 대규모 회차 성능 안정화, `0.305` 본문 리더로 사용한다. 회차 일부만 반환하는 공개 버전은 만들지 않는다.
- 신규 ID를 처음 공개하는 `0.301`부터 기존 `240710003`의 라이브러리·읽음 상태가 자동 이전되지 않는다는 점을 notes와 배포 보고에 명시한다.

### 1.2 도메인 설정

- 설정에는 `newtoki` 뒤의 숫자만 받는다.
- 키: `ntk_novel_legacy_domain_number`
- 기본값: `1`
- 결과 주소: `https://newtoki{number}.org`
- 빈 값은 기본값 `1`을 사용한다.
- 음수, 소수, 문자, 전체 URL은 거부한다.
- Next 주소 `sbxh{number}.com`과 Hybrid 모드는 후속 설계로 남긴다. 레거시 함수에서 Next 선택자를 fallback으로 시도하지 않는다.

### 1.3 Popular / Latest

- 두 탭 모두 `/novel` HTML 목록을 사용한다.
- Popular는 완결을 포함하는 조회순이다.
  - `kind=novel`
  - `pub=all`
  - `sst=as_view`
  - `sod=desc`
  - `page={page}`
- Latest는 연재중만 표시하는 최신순이다.
  - `kind=novel`
  - `pub=ongoing`
  - `sst=as_update`
  - `sod=desc`
  - `page={page}`
- 정상 첫 페이지에서 현재 96개 작품이 관측되었지만, 96을 영구적인 성공 조건이나 pagination 신호로 사용하지 않는다.
- 필수 목록 컨테이너는 `#webtoon-list-all`, 작품 행은 내부 `li.list-item`이다.
- 작품 제목은 `span.title.white`, 링크는 `/novel/{workId}`, 표지는 `img.theme-thumb-img`에서 얻는다.
- 플랫폼 로고를 표지로 사용하지 않는다. 정상 표지가 없으면 `imageUrl: ""`로 둔다.
- 정상 결과는 `.list-wrap #webtoon-list-all`을 요구한다. 빈 결과는 `.list-wrap .wr-none`이 있고 작품 컨테이너/행이 없을 때만 인정한다. 페이지 다른 위치의 `wr-none` 문자열은 무시한다.
- 서버 DOM 순서를 그대로 유지하고, 정규화된 작품 URL 기준으로 중복을 제거한다.
- 사이트 내부의 `/novel/__q/...` 재작성 주소는 생성하지 않는다. 일반 query URL만 요청한다.
- `.list-page ul.pagination-desktop`에서 현재 page의 바로 다음 번호를 가진 동일 `/novel` query anchor가 있을 때만 `hasNextPage: true`로 반환한다. query 문자열 순서가 아니라 `page`를 제외한 key/value 의미를 비교하며, 카드 수만으로 추정하지 않는다.
- 목록/검색/필터는 하나의 **소설 레거시 카드 파서**를 공유한다. 다른 콘텐츠 계층의 카드 파서는 공유하지 않는다.
- 선택된 작품 행 하나라도 필수 제목이나 유효한 `/novel/{numericWorkId}` 링크가 없으면 페이지 전체를 오류로 처리한다. 표지만 선택 필드라서 없을 수 있다.
- HTTP 오류, HTML이 아닌 응답, 정상/empty 구조가 모두 없는 응답은 각각 endpoint와 status만 포함한 명확한 `Legacy Novel list ...` 오류를 던지고 부분 배열이나 빈 성공으로 바꾸지 않는다.

### 1.4 제목 검색과 필터

- 제목은 `trim()`한 뒤 판단하고, 비어 있지 않으면 제목 검색이 항상 필터보다 우선한다.
- 제목 검색 파라미터는 `stx={trimmedQuery}`이며, `kind=novel`, `pub=all`, `page={positiveIntegerPage}`를 함께 보낸다. 사용자가 고른 장르·상태·플랫폼·작가·초성·정렬은 모두 무시한다.
- 제목이 비어 있을 때만 필터를 적용한다.
- 장르 query key는 실제 페이지에서 확인된 `tag`다. `genre`는 사용하지 않는다.
- 제공할 필터:
  - 상태 `pub`: 전체 `all`, 연재중 `ongoing`, 완결 `completed`
  - 초성 `jaum`: 전체, `ㄱ`~`ㅎ`, `a-z`, `0-9`
  - 플랫폼 `plat`: 전체, `user`, `novelpia`, `booktoki`, `munpia`, `joara`, `kakaopage`, `series`, `ridi`, `etc`
  - 정렬 `sst`: 업데이트 `as_update`, 신규 `as_new`, 북마크 `as_bookmark`, 조회 `as_view`, 평점 `as_rating`, 회차 `as_episode`
  - 정렬 방향 `sod`: 라이브 UI의 모든 정렬 버튼이 보내는 `desc`로 고정한다. 확인되지 않은 `asc` 선택은 제공하지 않는다.
  - 장르 `tag`: 전체, 판타지, 무협, 19금, 현대, 로맨스, 로맨스 판타지, BL, 라노벨, 기타
  - 작가명 `author`: 텍스트 입력
- `toon`은 현재 소설 필터 기능으로 확인되지 않았으므로 보내지 않는다.
- 상태·초성·플랫폼·정렬·장르는 라이브 UI처럼 각각 단일 선택이다. 작가만 텍스트 입력이다.
- 빈 제목의 기본 query는 `kind=novel&page={page}&pub=all&sst=as_update&sod=desc`다. 빈 선택값(`jaum`, `plat`, `tag`)과 빈 작가는 URL에서 생략한다.
- 필터 값은 위 whitelist에 있는 값만 직렬화하고, 알 수 없는 값은 URL에 보내지 않고 해당 필터의 기본값으로 처리한다.
- page는 1 이상의 정수만 허용한다. 1 미만, 소수, 문자열은 요청 전에 오류로 처리한다.
- 검색어 인코딩은 한글과 `+`, `&`, `%`, `?`를 각각 테스트한다.

### 1.5 작품 상세와 대규모 회차

- 상세 경로: `/novel/{workId}`
- 제목: `.theme-detail-title-line`
- 표지: `.view-img`
- 설명: `.theme-detail-description`
- 정보 라벨/값: `.theme-detail-info-label` / `.theme-detail-info-value`
- 현재 확인된 라벨: 작가, 장르, 발행구분
- 회차 행: 상세 문서의 작품 회차용 `ul.list-body` 내부 `li.list-item`으로 범위를 제한한다.
- 회차 링크: `/novel/{workId}/{episodeId}`
- 라이브 표본 `novel/60079`는 약 7.11MB이며 9,772개 회차를 한 문서에 포함한다.
- DOM 순서는 최신 10028화에서 1화 방향이다. 이 순서를 그대로 반환한다.
- 회차 번호에는 256개 누락이 있고 여러 구간의 gap이 있으므로 연속 번호를 요구하거나 `최신 회차 번호 === 회차 수`로 계산하지 않는다.
- Legacy에서 확인된 work/episode ID는 숫자다. 파싱 뒤 문자열로 보존하지만 이번 단계의 URL validator는 숫자 segment만 허용한다. 회차 번호를 URL ID로 대체하지 않는다.
- 날짜가 존재하더라도 정렬 기준으로 쓰지 않는다. 확인 표본은 모든 행의 날짜가 동일했다.
- 전 행을 선형 시간으로 검증하고 URL 기준으로 중복을 탐지한다.
- 9,772개 중 일부만 성공한 결과는 절대 반환하지 않는다. 필수 구조가 깨졌거나 중복/누락 행을 발견하면 전체 요청을 오류로 종료한다.
- 원본 회차 행 수와 변환 결과 수가 같아야 하고, 모든 링크가 현재 `/novel/{workId}/{episodeId}`에 속해야 한다. URL·episode ID·`data-index`는 각각 중복이 없어야 하며 `data-index`는 DOM 순서대로 엄격히 감소해야 한다. 제목·링크·`data-index`가 없는 행은 필터링하지 않고 전체 실패한다.
- 정상적인 회차 0개는 작품 회차 컨테이너 내부의 명시적 empty marker가 있을 때만 허용한다. 컨테이너가 없거나 잘린 HTML은 실패다.
- 확장 자체의 백그라운드 수집·영구 캐시는 이번 범위에 넣지 않는다. 수정 Mangayomi 클라이언트는 저장된 chapters가 있으면 일반 재진입 시 `getDetail()`을 생략하므로, 최초 로드 또는 명시적 새로고침 때만 전체 회차를 수집하는 구조를 이용한다.
- 과거 버전에서 부분 chapters가 이미 저장된 경우 버전 상승만으로 캐시가 무효화되지 않으며 수동 새로고침이 필요하다. 서버에서 삭제된 회차도 클라이언트 merge 과정에서 자동 삭제된다고 가정하지 않는다.
- 응답 도착순으로 배열에 추가하는 병렬 페이지 수집은 사용하지 않는다. 레거시는 단일 상세 HTML에 전체 회차가 있으므로 한 번 내려받아 DOM 순서대로 처리한다.
- 후속 Hybrid에서도 Source ID `260713003`과 도메인 없는 `/novel/{workId}`·`/novel/{workId}/{episodeId}` 저장 키를 유지한다. Next의 부분 회차를 `getDetail()` 성공값으로 반환하지 않는다.

### 1.6 텍스트 리더

- 리더 경로: `/novel/{workId}/{episodeId}`
- 정적 `.theme-novel-content`는 `본문 불러오는 중...`만 포함하므로 HTML만 읽어서는 본문을 얻을 수 없다.
- `script#theme-novel-viewer-data`의 JSON에서 `novelId`, `episodeId`, `token`, `scopePath`, `unlockApiPath`, 제목 및 잠금 상태를 검증한다.
- 실제 흐름은 동일한 persistent client/cookie jar 안에서 다음 순서를 따른다. 유효한 `nv` session이 있으면 재사용하고, 없거나 만료됐을 때만 새 session을 발급한다.
  1. 리더 HTML GET
  2. `/api/ad/canary`
  3. `/api/ad/challenge`와 필요한 observation
  4. 유효한 `nv` session이 없거나 만료된 경우에만 `/api/nv-issue`
  5. nonce와 HMAC proof 생성
  6. `/api/novel-content` POST
  7. AES-GCM payload 복호화
  8. 허용된 태그만 남긴 본문 HTML 반환
- 기존 `ntk.js`에 비슷한 흐름이 있어도 코드를 복사하지 않는다. 라이브 요청 계약과 새 fixture/mock을 먼저 만든 후 소설 전용 구현을 작성하고, 마지막 비교 검토에만 과거 파일을 참고한다.
- `paidGate`는 boolean이 아니라 `{ active, locked, loggedIn, cost, balance, timeUntilFree }` 객체로 검증한다. `active`와 `locked`를 각각 판정하고, 잠긴 회차에서는 `unlockApiPath`를 자동 호출하거나 구매하지 않는다.
- volatile token, cookie, session, proof는 fixture와 로그에 저장하지 않는다.
- 최종 본문은 DOM 기반 allowlist 정화를 사용한다. 허용 태그는 `p`, `br`, `div`, `span`, `strong`, `b`, `em`, `i`, `u`, `s`, `blockquote`, `hr`이고, 허용 속성은 안전한 `class`와 인라인 정렬 표현에 필요한 제한된 `style`만이다. `script`, `iframe`, `object`, `embed`, 모든 `on*` 속성, `javascript:` URL과 외부 추적 태그를 제거한다. 문자열 정규식만으로 정화하지 않으며, 정화 후 본문이 비면 오류로 처리한다.
- AES-GCM은 인증 태그를 반드시 검증한다. WebCrypto가 없는 QuickJS fallback도 ciphertext/tag/키 조합 변조 시 성공 본문을 반환해서는 안 된다.
- 오류에는 status, endpoint 분류, 서버 error code만 포함하고 cookie, session, token, payload, nonce, proof와 응답 body 전체를 넣지 않는다.

## 2. 에이전트 운영 구조

소설 구현은 기능적으로 나뉘지만 같은 Source 파일과 앞 단계 계약에 의존한다. 따라서 만화 때처럼 조사와 검토는 병렬화하되, 실제 통합은 다음 순서로 진행한다.

1. **통합 담당 에이전트**가 Source shell, 테스트 loader, 함수 소유 구역을 만든다.
2. **목록 에이전트**가 Popular/Latest만 구현한다.
3. **검색/필터 에이전트**가 검색과 필터만 구현한다.
4. **상세 에이전트**가 메타데이터만 구현한다.
5. **회차 에이전트**가 9,772개 전체 회차와 성능을 구현한다.
6. **리더 에이전트**가 인증·복호화·HTML 정리만 구현한다.
7. 각 구현 뒤에 코드 작성자와 다른 **명세 검토 에이전트**와 **품질 검토 에이전트**가 차례로 검토한다.
8. Critical/Important 지적은 같은 단계에서 수정·재검토한 뒤 사용자 테스트로 넘긴다.

모든 에이전트는 공용 코어 수정이 필요하면 직접 범위를 넘지 않고 통합 담당에게 변경 요청을 남긴다. 서로 다른 에이전트가 동시에 `ntk_novel.js`를 수정하지 않는다. 이렇게 하면 병렬 작업의 merge 충돌과 계약 변경 누락을 막을 수 있다.

## 3. 파일 및 소유권

### 통합 담당

- Create: `javascript/novel/src/ko/ntk_novel.js`
- Create: `tests/novel/helpers/load-novel-source.js`
- Create: `tests/novel/source-shell.test.js`
- Modify per release checkpoint: `index.json`
- Modify: `tests/ntk.test.js`를 새 `loadNovelSource()` 기반 manifest/embedded metadata 비교로 개편
- Modify: `tests/webtoon/index-entry.test.js`의 Novel ID 보존 검증
- Modify: `README.md`의 공용 `ntk.js` 및 Novel 지원 설명
- Create: `tests/novel/index-entry.test.js`
- Track: `docs/superpowers/plans/2026-07-13-legacy-novel-agent-implementation.md`

### 목록 담당

- Modify: `ntk_novel.js`의 `NOVEL_LIST_METHODS` 구역만
- Create: `tests/novel/lists/**`
- Create: `tests/novel/fixtures/lists/**`

### 검색/필터 담당

- Modify: `ntk_novel.js`의 `NOVEL_SEARCH_FILTER_METHODS` 구역만
- Create: `tests/novel/search/**`
- Create: `tests/novel/filters/**`
- Create: `tests/novel/fixtures/search/**`
- Create: `tests/novel/fixtures/filters/**`

### 상세/회차 담당

- Modify: `ntk_novel.js`의 `NOVEL_DETAIL_METHODS` 또는 `NOVEL_CHAPTER_METHODS` 구역만
- Create: `tests/novel/detail/**`
- Create: `tests/novel/chapters/**`
- Create: `tests/novel/fixtures/detail/**`
- Create: `tests/novel/fixtures/chapters/**`

### 리더 담당

- Modify: `ntk_novel.js`의 `NOVEL_READER_METHODS` 구역만
- Create: `tests/novel/reader/**`
- Create: `tests/novel/fixtures/reader/**`

## 4. 단계별 구현 계획

### Task 1: 독립 Source shell과 0.301 Popular/Latest

**결과:** 새 Novel Source를 클라이언트에 설치해 Popular와 Latest를 직접 확인할 수 있다.

**TDD 순서:**

1. `tests/novel/source-shell.test.js`를 먼저 작성한다.
   - ID `260713003`, base URL, `itemType: 2`, `isManga: false`, `isNsfw: false`, `isFullData: false`, `appMinVerReq: "0.5.0"`, `sourceCodeLanguage: 1`, `additionalParams: ""`를 검증한다.
   - embedded `pkgPath: "novel/src/ko/ntk_novel.js"`와 public `sourceCodeUrl`의 `javascript/novel/src/ko/ntk_novel.js` 경로를 검증한다.
   - 숫자 도메인 기본값과 유효/무효 값을 검증한다.
   - 상대·동일 origin `/novel/{id}`만 허용하고 외부 origin, query/fragment가 붙은 작품 링크, 위험 scheme을 거부한다.
   - 한 extension 인스턴스가 한 persistent `Client`를 재사용하는지 검증한다.
2. `tests/novel/lists/legacy-popular.test.js`와 `legacy-latest.test.js`를 작성한다.
   - 위 1.3의 query를 정확히 검증한다.
   - 관측된 96개 정상 fixture의 제목/URL/표지, DOM 순서, 중복, 표지 없음, 플랫폼 로고, 명시적 빈 페이지를 검증한다. 96은 parser 성공 조건으로 쓰지 않는다.
   - `96개+다음 있음`, `96개+다음 없음`, `96개 미만+다음 있음` fixture로 pagination anchor 기반 판정을 검증한다.
   - HTTP 오류, 비 HTML, 필수 컨테이너 없음, malformed card가 endpoint/status를 포함한 오류가 되고 빈 배열/부분 배열로 숨겨지지 않는지 검증한다.
   - page 0, 음수, 소수, 문자열과 `/novel/__q/` 미생성을 검증한다.
3. 테스트가 Source 파일 부재 또는 미구현 오류로 실패하는 것을 확인한다.
4. 최소 shell과 목록 파서를 구현한다.
5. `index.json`의 과거 Novel 엔트리를 신규 ID와 전용 파일로 교체하고 `0.301`로 등록한다.
6. `tests/novel/index-entry.test.js`로 신규/과거 ID 중 정확히 하나만 공개되는지 검증한다.
7. 대상 테스트, 전체 `pnpm test`, `node --check`, `git diff --check`를 실행한다.
8. 두 검토 에이전트의 승인을 받고 커밋한다: `feat: add legacy novel lists`
9. 사용자 승인 후 `master`를 push하고 Windows/iPhone/Android 패드에서 Popular·Latest를 확인한다.

**0.301 종료 조건:** Popular는 완결 포함 조회순, Latest는 연재중 최신순이며 잘못된 로고 표지가 없고 실제 페이지 이동이 된다.

### Task 2: 0.302 제목 검색과 전체 필터

**결과:** 제목 입력 시 제목 검색, 빈 제목 시 레거시 필터가 동작한다.

**TDD 순서:**

1. title fixture와 empty fixture로 제목 검색 request/response 테스트를 작성한다.
2. 필터 model 테스트에서 1.4의 상태·초성·플랫폼·정렬·장르·작가 값을 정확히 검증한다.
3. request 테스트에서 공백뿐인 제목, 제목 우선순위, 한글과 `+ & % ?` URL encoding, 단일 선택 직렬화, unknown filter의 기본값 처리, `author`/`tag` key와 페이지 번호를 검증한다.
4. pagination 테스트에서 `.pagination-desktop`의 동일 query `page=current+1` anchor만 다음 페이지 신호로 인정하고 카드 수나 mobile 중복 pager는 무시하는지 검증한다.
5. parser 테스트에서 공통 Legacy Novel 카드 파서를 사용해 `/novel/` 작품만 통과, 중복 제거, 표지 선택, `.list-wrap .wr-none` empty, malformed/HTTP 오류를 검증한다.
6. 실패를 확인한 뒤 `NOVEL_SEARCH_FILTER_METHODS`만 구현한다.
7. embedded metadata와 `index.json`을 `0.302`로 올리고 notes를 갱신한다.
8. 대상/전체 테스트와 두 에이전트 검토 후 커밋한다: `feat: add legacy novel search filters`
9. 별도 배포 승인 후 push하고 필터 UI와 조합 결과를 실기기에서 확인한다.

**0.302 종료 조건:** 비어 있지 않은 제목이 필터를 확실히 덮어쓰며, 빈 제목에서는 선택한 filter query가 사이트와 일치한다.

### Task 3: 0.303 작품 상세와 전체 회차 정확성

**결과:** 작품을 열었을 때 제목, 표지, 작가, 장르, 상태, 설명과 **전체 회차**가 함께 표시된다. Mangayomi가 `getDetail()`의 metadata와 chapters를 한 번에 캐시하므로 부분 회차나 빈 placeholder를 공개하지 않는다.

**TDD 순서:**

1. 정상/최소 상세 fixture로 모든 선택자와 선택 필드 누락을 검증한다.
2. `발행구분`을 Mangayomi 상태 숫자로 매핑하고 알 수 없는 상태는 unknown으로 처리하는 테스트를 작성한다.
3. 표지 URL 정규화, genre 중복 제거, 설명 정리, canonical 작품 URL을 검증한다.
4. 잘못된 작품 URL, HTTP 오류, 비 HTML, 필수 제목/상세 컨테이너 누락을 검증한다.
5. 작은 회차 fixture로 newest-first 순서, 제목, 숫자 episode ID를 문자열로 보존하는 URL을 검증한다.
6. 10,028화 번호지만 9,772개 행인 생성 fixture로 결번을 허용하고 전 행을 보존하는지 검증한다.
7. 원본/결과 행 수 일치, 현재 작품 소속, URL·episode ID·`data-index` 중복 없음, `data-index` 엄격 감소를 검증한다.
8. 필수 링크/제목/`data-index` 누락, 다른 작품 링크, 컨테이너 잘림, 부분 파싱 실패가 전체 오류가 되는지 검증한다.
9. 실패를 확인한 뒤 `NOVEL_DETAIL_METHODS`와 `NOVEL_CHAPTER_METHODS`를 함께 구현한다. 회차는 단일 pass와 `Set`을 사용하는 O(n) parser로 만든다.
10. 실제 `novel/60079`에서 9,772개 및 양 끝 URL을 읽기 전용 smoke test로 확인한다.
11. `0.303` metadata/index/notes 갱신, 대상/전체 테스트, 독립 검토, 커밋 `feat: add legacy novel details`를 수행한다.
12. 사용자에게 **구현 승인과 별개인 배포 승인**을 받은 뒤 push하고 여러 작품의 상세와 전체 회차를 확인한다.

**0.303 종료 조건:** 필수 정보가 정확하고 실제 `novel/60079`의 9,772개가 newest-first로 전부 나오며, 부분 chapters가 캐시될 수 있는 성공 응답이 없다.

### Task 4: 0.304 대규모 회차 캐시/성능 안정화

**결과:** Task 3의 정확한 전체 회차 동작을 유지하면서, 1만 회차 작품의 모바일 병목을 측정하고 안전한 범위에서 최적화한다. 기능적으로 부분 회차나 백그라운드 캐시를 새로 도입하지 않는다.

**TDD 순서:**

1. Node의 10,000행 생성 fixture로 정확성과 O(n) 회귀를 반복 측정한다. 절대 시간만 고정하지 않고 Task 3 baseline 대비 악화를 탐지한다.
2. 수정 클라이언트에서 iPhone과 Android 패드 각각 최초 진입을 3회 이상 측정한다.
3. 측정 구간을 HTML 다운로드, JavaScript DOM 파싱/배열 생성, JSON 직렬화·QuickJS→Dart 변환, Isar transaction 저장, 화면 표시까지 총시간으로 분리한다.
4. `getDetail()` isolate 구간의 최악값은 35초 이하, 3회 중앙값은 30초 이하를 합격 기준으로 둔다. 40초 timeout까지 최소 5초 여유를 확보한다.
5. 앱 종료·메모리 부족·장시간 UI 무응답이 없고, 두 번째 진입은 `getDetail()` 네트워크 요청 0회인지 확인한다.
6. 수동 새로고침 후 새 회차 중복 0개와 읽음 상태 보존을 확인한다. 서버에서 삭제된 기존 회차의 자동 삭제는 합격 조건으로 간주하지 않는다.
7. 성능 개선이 필요하면 DOM query 수, 문자열 복사, 중복 자료구조만 최소화한다. 병렬 수집, 부분 반환, extension 영구 캐시는 도입하지 않는다.
8. 기존 부분 캐시는 수동 새로고침해야 하며 확장 버전 상승만으로 자동 복구되지 않는다는 notes를 확인한다.
9. 정확성 회귀와 부분 목록 저장 가능성이 없음을 두 검토 에이전트가 승인해야 한다.
10. `0.304` metadata/index 갱신, 전체 테스트, 커밋 `perf: stabilize legacy novel chapters`를 수행한다.
11. 별도 배포 승인 후 push한다.

**0.304 종료 조건:** 9,772개 정확성이 유지되고, 위 구간별 측정과 35초/30초 기준을 통과하며, 재진입 네트워크 요청이 0회다.

### Task 5: 0.305 텍스트 본문 리더

**결과:** 공개 회차의 실제 본문이 안전한 HTML로 표시되고 잠김/인증 실패는 명확한 오류가 된다.

**TDD 순서:**

1. viewer-data 파서 테스트를 작성하고 필수 `novelId`, `episodeId`, `token` 누락을 거부한다.
2. 구현 시작 직전에 공개 회차와 잠긴 회차의 viewer-data/challenge/content 계약을 다시 라이브 확인한다. volatile 값은 저장하지 않는다.
3. request recording client로 유효 session 재사용, session 없음→발급, 만료→재발급, cookie 계승, challenge observation을 각각 검증한다.
4. `ad_ack_required`/`fingerprint_required`에서는 강제 challenge 뒤 정확히 한 번만 재시도하고 반복 실패에 무한 재시도하지 않는지 검증한다.
5. 고정 test key/nonce/payload로 HMAC과 AES-GCM 복호화를 검증한다. 정상 ciphertext/tag는 성공하고 ciphertext 1바이트, tag, session, novelId, episodeId 중 하나라도 변조되면 WebCrypto와 QuickJS fallback 모두 실패해야 한다.
6. `paidGate.active`와 `paidGate.locked` 조합을 검증하고 잠긴 경우 `unlockApiPath`를 호출하지 않는지 확인한다.
7. 본문 renderer는 DOM allowlist로 문단·줄바꿈을 보존하고, 금지 태그·모든 `on*` 속성·`javascript:` URL을 제거하며 정화 후 빈 본문을 오류로 처리한다.
8. 잘못된 payload, 복호화 실패, 비 JSON/HTTP 오류 메시지에 cookie/session/token/payload/nonce/proof/응답 body가 포함되지 않는지 검증한다.
9. 테스트 실패를 확인한 뒤 `NOVEL_READER_METHODS`와 `getHtmlContent()`를 최소 구현한다.
10. 공개 회차, 긴 본문, 잠긴 회차를 Windows/iPhone/Android 패드에서 검증한다.
11. 과거 `ntk.js`와 독립 비교 검토를 하되 소설 전용 코드가 혼합 parser나 Next fallback을 포함하지 않는지 확인한다.
12. `0.305` metadata/index 갱신, 대상/전체 테스트, 보안/품질 검토, 커밋 `feat: add legacy novel reader`를 수행한다.
13. 별도 배포 승인 후 `master`를 push한다.

**0.305 종료 조건:** 공개 본문 표시, 문단 보존, 잠김 처리, 모바일 안정성, 비밀값 비기록이 모두 확인된다. 이 조건을 못 맞추면 `0.304`를 안정판으로 유지하고 리더만 다음 버전으로 넘긴다.

## 5. 공통 검증 명령

각 단계에서 최소 다음을 실행한다.

```powershell
$novelTests = @(rg --files tests/novel | Where-Object { $_ -like '*.test.js' })
node --test @novelTests
pnpm test
node --check javascript/novel/src/ko/ntk_novel.js
git diff --check
git status --short --branch
```

현재 회귀 baseline은 229개 통과다. `pnpm test -- tests/novel`은 현재 package script에서 디렉터리를 모듈로 해석해 실패하므로 사용하지 않는다.

커밋은 `git add .`를 사용하지 않고 변경 파일을 명시한다. 미추적 `node_modules/`, `pnpm-lock.yaml`, `resource/`는 staging하지 않는다. 커밋 전에는 `git diff --cached --name-only`와 `git status --short`로 범위를 확인한다.

라이브 smoke test는 민감한 응답을 파일이나 콘솔 전체에 출력하지 않고 다음만 기록한다.

- 요청 경로와 query key
- HTTP status와 content type
- 선택된 작품/회차 개수
- 파싱 소요 시간
- 오류 분류

## 6. 검토 체크리스트

- [ ] 신규 ID `260713003`만 공개되고 과거 Novel 엔트리는 제거되었는가
- [ ] `javascript/novel/src/ko/ntk_novel.js`가 `ntk.js`, Webtoon, Manhwa parser를 호출하지 않는가
- [ ] Legacy 기본 주소와 숫자 도메인 설정만 존재하는가
- [ ] Popular는 `pub=all + as_view`, Latest는 `pub=ongoing + as_update`인가
- [ ] 제목 검색 우선순위와 `tag` 장르 key가 정확한가
- [ ] 플랫폼 로고가 표지로 선택되지 않는가
- [ ] 다음 페이지를 카드 수로 추측하지 않는가
- [ ] 9,772개 회차의 gap을 허용하고 숫자 work/episode ID를 문자열로 정확히 보존하는가
- [ ] 부분 회차 목록을 성공으로 반환하지 않는가
- [ ] 최초 로드와 재진입 캐시 동작을 실기기에서 확인했는가
- [ ] 리더가 static placeholder가 아니라 보호된 content API를 사용하는가
- [ ] AES-GCM ciphertext/tag/키 변조가 WebCrypto와 QuickJS fallback에서 모두 실패하는가
- [ ] `paidGate.active/locked`를 판정하고 자동 unlock/구매를 하지 않는가
- [ ] 본문 DOM allowlist와 민감 정보 비노출 테스트가 통과하는가
- [ ] session/token/cookie/proof가 fixture, 로그, commit에 들어가지 않았는가
- [ ] 각 단계가 RED → 최소 구현 → 대상 테스트 → 전체 회귀 → 독립 검토 순서를 지켰는가
- [ ] 사용자 승인 없이 다음 단계 코드나 push를 진행하지 않았는가

## 7. 계획 승인 뒤의 바로 다음 작업

승인 후에도 한 번에 다 구현하지 않는다. 먼저 **Task 1: Source shell + Popular/Latest 0.301**만 에이전트에게 맡기고, 리뷰와 로컬 검증 결과를 사용자에게 보여준 뒤 push 여부를 확인한다. 실기기 목록 결과가 정상일 때만 Task 2로 넘어간다.
