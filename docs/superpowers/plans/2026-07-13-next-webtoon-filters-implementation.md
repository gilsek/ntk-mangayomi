# Next Webtoon Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제목이 비어 있을 때 Next 웹툰 필터를 `/api/works`로 실행하고, 제목이 있으면 기존 제목 검색을 우선한다.

**Architecture:** 기존 `ntk_webtoon.js` 안에 Next 전용 필터 모델, URL builder, JSON parser를 추가한다. Popular, Latest, 제목 검색, Legacy 파서와 구현을 공유하지 않으며 `search()`의 Next 분기에서만 제목 유무에 따라 기존 검색과 새 필터 경로를 선택한다.

**Tech Stack:** Mangayomi JavaScript source API, Node.js `node:test`, JSON fixtures, Git

## Global Constraints

- 설계 계약은 `docs/superpowers/specs/2026-07-13-next-webtoon-filters-design.md`를 따른다.
- Mangayomi 클라이언트는 수정하지 않는다.
- `resource/`, `node_modules/`, `pnpm-lock.yaml`을 읽거나 수정하거나 스테이징하지 않는다.
- Next와 Legacy 필터 및 파서를 공유하지 않는다.
- 작품 구분은 전체, 일반, 비엘, 성인, 완결만 제공하고 요일 필터는 제공하지 않는다.
- 주요 장르는 설계 명세의 정확한 13개, 상세 장르는 정확한 100개를 사용한다.
- 제목이 있으면 필터를 무시하고 기존 제목 검색을 우선한다.
- 버전은 `0.104`이며 `0.2`로 올리지 않는다.
- 의존성을 추가하지 않는다.

---

### Task 1: Next 필터 모델과 요청 직렬화

**Files:**
- Create: `tests/webtoon/next-filter-request.test.js`
- Modify: `tests/webtoon/next-popular-request.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`

**Interfaces:**
- Produces: `getNextFilterList(): Filter[]`
- Produces: `buildNextFilterUrl(page: number, filters: Filter[]): string`
- Consumes: `getNextBaseUrl()`, `appendParameter()`

- [ ] **Step 1: 기존 미구현 계약을 새 필터 계약으로 바꾸는 실패 테스트 작성**

`next-popular-request.test.js`의 `keeps unfinished Next filters unavailable` 테스트를 제거하고 `next-filter-request.test.js`에 다음 계약을 작성한다.

```js
const filters = plain(extension.getFilterList());
assert.deepEqual(filters.map((filter) => filter.type), [
  "workType",
  "genreHint",
  "mainGenres",
  "detailGenres",
  "platform",
  "sort",
]);
assert.deepEqual(
  filters.find((filter) => filter.type === "workType").values.map((e) => [e.name, e.value]),
  [["전체", "all"], ["일반", "normal"], ["비엘", "bl"], ["성인", "adult"], ["완결", "completed"]],
);
assert.equal(filters.some((filter) => filter.type === "weekday"), false);
assert.equal(filters.find((filter) => filter.type === "mainGenres").state.length, 13);
assert.equal(filters.find((filter) => filter.type === "detailGenres").state.length, 100);
```

정확한 배열은 설계 명세 4절과 5절의 ID·표시명 순서를 그대로 단언한다. 각 장르는 `type_name: "TriState"`, `state: 0`, 문자열 `value`를 가져야 한다.

- [ ] **Step 2: 필터 테스트가 현재 빈 배열 때문에 실패하는지 확인**

Run: `node --test tests/webtoon/next-filter-request.test.js tests/webtoon/next-popular-request.test.js`

Expected: Next 필터 목록이 `[]`여서 FAIL.

- [ ] **Step 3: Next 전용 필터 상수와 모델 생성 구현**

`ntk_webtoon.js` 상단에 설계 명세의 정확한 값을 배열로 추가하고, 다음 형태를 생성한다.

```js
getNextFilterList() {
  const select = (type, name, values) => ({
    type_name: "SelectFilter",
    type,
    name,
    state: 0,
    values: values.map(([optionName, value]) => ({
      type_name: "SelectOption",
      name: optionName,
      value,
    })),
  });
  const group = (type, name, values) => ({
    type_name: "GroupFilter",
    type,
    name,
    state: values.map(([value, optionName]) => ({
      type_name: "TriState",
      type: "genre",
      name: optionName,
      value: String(value),
      state: 0,
    })),
  });
  return [
    select("workType", "작품 구분", [["전체", "all"], ["일반", "normal"], ["비엘", "bl"], ["성인", "adult"], ["완결", "completed"]]),
    { type_name: "HeaderFilter", type: "genreHint", name: "장르: 체크=포함, 가로선=제외" },
    group("mainGenres", "주요 장르", NEXT_MAIN_GENRES),
    group("detailGenres", "상세 장르", NEXT_DETAIL_GENRES),
    select("platform", "플랫폼", NEXT_PLATFORMS),
    select("sort", "정렬", NEXT_SORTS),
  ];
}
```

`getFilterList()`는 Next면 `getNextFilterList()`를 반환하고 Legacy 기존 배열은 그대로 둔다.

- [ ] **Step 4: 작품 구분과 복수 장르 직렬화 실패 테스트 작성**

다음 사례를 각각 독립 테스트로 작성한다.

```js
// 전체 기본값
assert.equal(url.pathname, "/api/works");
assert.equal(url.searchParams.get("status"), "ongoing");
assert.equal(url.searchParams.get("cat"), "all");
assert.equal(url.searchParams.get("page"), "2");
assert.equal(url.searchParams.get("pageSize"), "42");
assert.equal(url.searchParams.get("withTotal"), "1");

// 완결
assert.equal(url.searchParams.get("status"), "completed");
assert.equal(url.searchParams.has("cat"), false);

// 주요 1·상세 102 포함, 주요 16·상세 103 제외
assert.equal(url.searchParams.get("tag"), "1,102");
assert.equal(url.searchParams.get("xtag"), "16,103");
```

플랫폼 `99`, 정렬 `views` 매핑과 기본 플랫폼/`new` 생략도 테스트한다. 어느 요청에도 `day`, `xday`가 없어야 한다.

- [ ] **Step 5: URL builder 테스트가 메서드 부재로 실패하는지 확인**

Run: `node --test tests/webtoon/next-filter-request.test.js`

Expected: `buildNextFilterUrl is not a function` 또는 필터 직렬화 불일치로 FAIL.

- [ ] **Step 6: 최소 URL builder 구현**

```js
buildNextFilterUrl(page, filters) {
  const parameters = [];
  const workType = this.getSelectedFilterValue(filters, "workType", "all");
  this.appendParameter(parameters, "status", workType === "completed" ? "completed" : "ongoing");
  if (workType !== "completed") this.appendParameter(parameters, "cat", workType);
  const { included, excluded } = this.getNextGenreStates(filters);
  this.appendParameter(parameters, "tag", included.join(","));
  this.appendParameter(parameters, "xtag", excluded.join(","));
  this.appendParameter(parameters, "plat", this.getSelectedFilterValue(filters, "platform", ""));
  const sort = this.getSelectedFilterValue(filters, "sort", "new");
  if (sort !== "new") this.appendParameter(parameters, "sort", sort);
  this.appendParameter(parameters, "withTotal", "1");
  this.appendParameter(parameters, "page", String(page));
  this.appendParameter(parameters, "pageSize", "42");
  return `${this.getNextBaseUrl()}/api/works?${parameters.join("&")}`;
}
```

헬퍼는 존재하지 않는 필터, 범위를 벗어난 선택 인덱스, 알 수 없는 TriState 상태를 미선택으로 취급한다. 주요 그룹을 먼저, 상세 그룹을 나중에 순회하고 ID를 중복 제거한다.

- [ ] **Step 7: Task 1 테스트 통과 확인**

Run: `node --test tests/webtoon/next-filter-request.test.js tests/webtoon/next-popular-request.test.js tests/webtoon/legacy-list-filter.test.js`

Expected: 모든 테스트 PASS.

- [ ] **Step 8: Task 1 커밋**

```powershell
git add -- tests/webtoon/next-filter-request.test.js tests/webtoon/next-popular-request.test.js javascript/manga/src/ko/ntk_webtoon.js
git commit -m "feat: add next webtoon filters"
```

---

### Task 2: 필터 JSON 파서와 검색 분기

**Files:**
- Create: `tests/webtoon/fixtures/next-filter-page.json`
- Create: `tests/webtoon/next-filter-parser.test.js`
- Modify: `tests/webtoon/next-search-request.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`

**Interfaces:**
- Consumes: `buildNextFilterUrl(page, filters)`
- Produces: `parseNextFilterResponse(response, requestUrl): { list, hasNextPage }`
- Produces: `fetchNextFilters(page, filters): Promise<MangaPage>`

- [ ] **Step 1: 정상 JSON fixture와 실패 테스트 작성**

Fixture는 최소 다음 구조를 사용한다.

```json
{
  "works": [
    {
      "sourceWorkId": 850661,
      "title": "필터 작품",
      "thumbnailUrl": "https://aws-cdn1.site/wt/thumbs/850661.jpg"
    },
    {
      "sourceWorkId": "opaque-key",
      "title": "표지 없는 작품",
      "thumbnailUrl": ""
    }
  ],
  "page": 1,
  "hasMore": true,
  "pageSize": 42,
  "total": 43
}
```

정상 변환은 `/webtoon/850661`, `/webtoon/opaque-key`, API 썸네일, `hasNextPage: true`를 단언한다. `works=[]/hasMore=false`, HTTP 403, HTML Content-Type, 깨진 JSON, `works` 누락, `hasMore` 비불리언, 제목·ID 누락을 각각 테스트한다.

- [ ] **Step 2: 파서 테스트 실패 확인**

Run: `node --test tests/webtoon/next-filter-parser.test.js`

Expected: 필터 fetch/parser 부재로 FAIL.

- [ ] **Step 3: 전용 JSON 파서와 fetch 구현**

```js
parseNextFilterResponse(response, requestUrl) {
  if (response.statusCode < 200 || response.statusCode >= 400) {
    throw new Error(`Next Webtoon HTTP ${response.statusCode} parserFamily=next url=${requestUrl}`);
  }
  const contentType = response.headers?.["content-type"] || response.headers?.["Content-Type"] || "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Next Webtoon non-JSON response parserFamily=next url=${requestUrl}`);
  }
  let payload;
  try { payload = JSON.parse(response.body); }
  catch { throw new Error(`Next Webtoon filter JSON error parserFamily=next url=${requestUrl}`); }
  if (!Array.isArray(payload.works) || typeof payload.hasMore !== "boolean") {
    throw new Error(`Next Webtoon filter structure error parserFamily=next url=${requestUrl}`);
  }
  return {
    list: payload.works.map((work) => this.parseNextFilterWork(work, requestUrl)),
    hasNextPage: payload.hasMore,
  };
}
```

`parseNextFilterWork`는 `sourceWorkId`가 숫자 또는 비어 있지 않은 문자열인지 확인하고 `title`이 비어 있지 않은 문자열인지 확인한다. `thumbnailUrl`이 없으면 빈 문자열을 허용한다.

- [ ] **Step 4: 제목 검색 우선과 빈 제목 필터 분기 실패 테스트 작성**

```js
await extension.search(" 작품 ", 1, filters);
assert.equal(new URL(requests[0].url).pathname, "/search");

await extension.search("   ", 2, filters);
assert.equal(new URL(requests[0].url).pathname, "/api/works");
assert.equal(new URL(requests[0].url).searchParams.get("page"), "2");
```

기존의 “빈 제목은 무요청 빈 결과” 테스트는 “빈 제목이면 필터 API 요청”으로 변경한다. 제목 검색 2페이지 무요청 계약은 유지한다.

- [ ] **Step 5: 검색 분기 테스트 실패 확인**

Run: `node --test tests/webtoon/next-search-request.test.js tests/webtoon/next-filter-parser.test.js`

Expected: 빈 제목이 여전히 무요청이어서 FAIL.

- [ ] **Step 6: `search()` Next 분기 연결**

```js
if (this.getParserFamily() === "next") {
  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    if (page > 1) return { list: [], hasNextPage: false };
    return this.fetchNextSearch(normalizedQuery);
  }
  return this.fetchNextFilters(page, filters);
}
```

- [ ] **Step 7: Task 2 및 전체 Webtoon 테스트 확인**

Run: `node --test tests/webtoon/*.test.js`

Expected: 모든 Webtoon 테스트 PASS.

- [ ] **Step 8: Task 2 커밋**

```powershell
git add -- tests/webtoon/fixtures/next-filter-page.json tests/webtoon/next-filter-parser.test.js tests/webtoon/next-search-request.test.js javascript/manga/src/ko/ntk_webtoon.js
git commit -m "feat: load next filtered webtoons"
```

---

### Task 3: 메타데이터와 최종 검증

**Files:**
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`
- Modify: `index.json`
- Modify: `tests/webtoon/index-entry.test.js` 또는 기존 메타데이터 테스트
- Modify: `docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md`

**Interfaces:**
- Produces: 일치하는 `index.json`과 내장 `mangayomiSources`

- [ ] **Step 1: `0.104` 메타데이터 실패 테스트 작성**

```js
assert.equal(entry.version, "0.104");
assert.match(entry.notes, /Popular.*Latest.*title search.*filters/i);
assert.match(entry.notes, /detail.*reader.*not implemented/i);
```

내장 소스 메타데이터도 동일하게 단언한다.

- [ ] **Step 2: 메타데이터 테스트 실패 확인**

Run: `node --test tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js`

Expected: 현재 `0.103` 때문에 FAIL.

- [ ] **Step 3: 버전·메모·로드맵 갱신**

두 메타데이터의 버전을 `0.104`로 맞추고 메모를 다음 의미로 갱신한다.

```text
Next Popular, Latest, title search, and filters preview with API covers; detail and reader are not implemented.
```

로드맵에는 Next 웹툰 목록 단계에서 필터가 구현되었으며 수동 UI 검증 후 조정할 수 있음을 기록한다.

- [ ] **Step 4: 전체 자동 검증**

Run: `pnpm test`

Expected: 실패 0.

Run: `git diff --check HEAD~2..HEAD`

Expected: 출력 없음.

- [ ] **Step 5: 라이브 API smoke test**

다음 요청을 현재 숫자 도메인에 보내 HTTP 200, JSON Content-Type, `works` 배열, `hasMore` 불리언을 확인한다.

```text
/api/works?status=ongoing&cat=adult&tag=16&sort=views&withTotal=1&page=1&pageSize=42
/api/works?status=completed&withTotal=1&page=1&pageSize=42
```

- [ ] **Step 6: Task 3 커밋**

```powershell
git add -- javascript/manga/src/ko/ntk_webtoon.js index.json tests/webtoon/index-entry.test.js docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md
git commit -m "chore: release next webtoon filters"
```

- [ ] **Step 7: 최종 리뷰와 master 반영 준비**

전체 브랜치 diff를 별도 리뷰하고 Critical/Important 지적을 해결한다. 사용자 수동 테스트를 위해 승인을 받은 뒤 `master`에 병합하고 push하여 기존 raw `master/index.json` 주소로 배포한다.
