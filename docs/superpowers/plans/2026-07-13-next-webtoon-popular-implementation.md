# Next Webtoon Popular Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NTK Webtoon의 기본 계열을 Next로 바꾸고 `sbxh{숫자}.com/rank?period=week&kind=webtoon`의 주간 랭킹을 Mangayomi Popular 목록으로 반환한다.

**Architecture:** Source metadata, 숫자 도메인 설정, Next Popular 요청과 rank-v2 파서를 하나의 실행 가능한 기능 단위로 구현한다. Next와 Legacy는 dispatcher에서만 만나며 선택자와 실패 fallback은 공유하지 않는다. Next Latest·검색·필터는 다음 단계까지 명시적으로 비활성화한다.

**Tech Stack:** Mangayomi JavaScript extension API (`MProvider`, `Client`, `Document`, `SharedPreferences`), Node.js built-in test runner, CommonJS fixture harness, pnpm.

## Global Constraints

- Source ID는 `260713001`을 유지한다.
- 이번 버전은 정확히 `0.101`이다.
- `0.2`는 Webtoon 전체 완료 후 Manhwa 개발 착수 시점이다.
- 기본 manifest URL은 `https://sbxh9.com`이다.
- Next 도메인 설정은 숫자만 받고 `https://sbxh{domainNumber}.com`으로 조합한다.
- Next Popular는 `/rank?period=week&kind=webtoon`만 사용한다.
- Legacy 구현, `javascript/manga/src/ko/ntk.js`, `resource/`는 수정하지 않는다.
- Next와 Legacy 선택자 또는 실패 fallback을 공유하지 않는다.
- 새 패키지를 추가하지 않고 미추적 `node_modules/`, `pnpm-lock.yaml`을 커밋하지 않는다.

---

## File Map

- Modify `javascript/manga/src/ko/ntk_webtoon.js`: Next 기본 metadata, 숫자 도메인 설정, Next Popular 요청·파서와 dispatcher.
- Modify `index.json`: Source metadata를 내장 manifest와 동일하게 갱신.
- Modify `tests/webtoon/helpers/load-webtoon-source.js`: Next rank-v2 선택자를 fixture harness에서 지원.
- Create `tests/webtoon/fixtures/next-rank-week.html`: champion, runner, row, 숫자/slug 링크와 플랫폼 아이콘을 포함한 최소 fixture.
- Create `tests/webtoon/next-popular-request.test.js`: Next 기본값, 주소 설정, 요청과 단일 페이지 계약 테스트.
- Create `tests/webtoon/next-popular-parser.test.js`: 세 카드 형태, 순서, 링크, 표지와 오류 처리 테스트.
- Modify `tests/webtoon/index-entry.test.js`: `sbxh9.com`, `0.101`, Next Popular preview 계약 검증.
- Modify `tests/webtoon/legacy-list-request.test.js`: Legacy 테스트가 명시적 Legacy preference를 사용하도록 격리.
- Modify `docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md`: Next 4종 우선순위, Popular와 Latest 기준 URL 기록.

---

### Task 1: Complete Next Popular Slice

**Files:**
- Create: `tests/webtoon/fixtures/next-rank-week.html`
- Create: `tests/webtoon/next-popular-request.test.js`
- Create: `tests/webtoon/next-popular-parser.test.js`
- Modify: `tests/webtoon/helpers/load-webtoon-source.js`
- Modify: `tests/webtoon/index-entry.test.js`
- Modify: `tests/webtoon/legacy-list-request.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`
- Modify: `index.json`

**Interfaces:**
- Consumes: `SharedPreferences.get(key)`, Source manifest `baseUrl`, `Client.get(url, headers)`, `Document` CSS selection.
- Produces: `getParserFamily()`, `getNextDomainNumber()`, `getNextBaseUrl()`, `getLegacyBaseUrl()`, `buildNextPopularUrl()`, `parseNextPopularResponse(response, url)`, `fetchNextPopular()`, `getPopular(page)`.

- [ ] **Step 1: Create the live-shaped fixture**

Create `tests/webtoon/fixtures/next-rank-week.html` with all three card forms and a platform icon after each cover:

```html
<main class="container rank-v2-page">
  <a class="rank-v2-champion" href="/webtoon/17970">
    <div class="rank-v2-cover rank-v2-cover--large">
      <img src="https://aws-cdn1.site/black/thumbs/17970.png?v2" alt="무선 연결 오나홀">
      <img src="https://apihost.store/platforms/toptoon.png" class="rank-v2-platform" alt="">
    </div>
    <div class="rank-v2-champion-body"><h2>무선 연결 오나홀</h2></div>
  </a>
  <a class="rank-v2-runner" href="/webtoon/60914825">
    <div class="rank-v2-cover rank-v2-cover--small">
      <img src="/thumbs/60914825.jpg" alt="픽 미 업!">
      <img src="/kakao.png" class="rank-v2-platform" alt="">
    </div>
    <span class="rank-v2-runner-body"><strong>픽 미 업!</strong></span>
  </a>
  <section class="rank-v2-table">
    <a class="rank-v2-row" href="/webtoon/u-mpfm64y1-5iea">
      <div class="rank-v2-cover rank-v2-cover--small">
        <img src="/thumbs/slug.png" alt="남자가 부족해요">
        <img src="/tomics.png" class="rank-v2-platform" alt="">
      </div>
      <div class="rank-v2-row-main">
        <div class="rank-v2-row-title"><strong>남자가 부족해요</strong><span>웹툰</span></div>
      </div>
    </a>
  </section>
</main>
```

- [ ] **Step 2: Write failing manifest, request and parser tests**

Update `tests/webtoon/index-entry.test.js` to require:

```js
assert.equal(webtoon.baseUrl, "https://sbxh9.com");
assert.equal(webtoon.version, "0.101");
assert.match(webtoon.notes, /Next.*Popular/i);
assert.match(webtoon.notes, /latest.*search.*filter.*not implemented/i);
```

Create `tests/webtoon/next-popular-request.test.js` covering:

```js
test("defaults the rebuild source to the Next family", () => {
  const { extension, sources } = loadWebtoonSource();
  assert.equal(sources[0].baseUrl, "https://sbxh9.com");
  assert.equal(sources[0].version, "0.101");
  assert.equal(extension.getParserFamily(), "next");
  assert.equal(extension.getNextBaseUrl(), "https://sbxh9.com");
});

test("builds the Next host from a numeric domain setting", () => {
  const { extension } = loadWebtoonSource({
    preferences: { ntk_webtoon_next_domain_number: " 12 " },
  });
  assert.equal(extension.getNextBaseUrl(), "https://sbxh12.com");
});

test("uses the default domain for a blank setting", () => {
  const { extension } = loadWebtoonSource({
    preferences: { ntk_webtoon_next_domain_number: "   " },
  });
  assert.equal(extension.getNextBaseUrl(), "https://sbxh9.com");
});
```

Reject `-1`, `1.5`, `abc`, and `https://sbxh9.com` with `/domain number/i`. Test `getPopular(1)` requests origin `https://sbxh9.com`, path `/rank`, `period=week`, and `kind=webtoon`. Test `getPopular(2)` returns `{list: [], hasNextPage:false}` without a request.

Create `tests/webtoon/next-popular-parser.test.js` requiring this exact ordered result from the fixture:

```js
[
  {
    name: "무선 연결 오나홀",
    link: "/webtoon/17970",
    imageUrl: "https://aws-cdn1.site/black/thumbs/17970.png?v2",
  },
  {
    name: "픽 미 업!",
    link: "/webtoon/60914825",
    imageUrl: "https://sbxh9.com/thumbs/60914825.jpg",
  },
  {
    name: "남자가 부족해요",
    link: "/webtoon/u-mpfm64y1-5iea",
    imageUrl: "https://sbxh9.com/thumbs/slug.png",
  },
]
```

Also test missing cover preservation, malformed title/link, missing `.rank-v2-page`, zero cards, HTTP 403, non-HTML Content-Type and `hasNextPage=false`.

- [ ] **Step 3: Extend the fixture DOM harness**

Add explicit selector support in `tests/webtoon/helpers/load-webtoon-source.js` for:

```text
.rank-v2-page
a.rank-v2-champion
a.rank-v2-runner
a.rank-v2-row
h2
.rank-v2-runner-body > strong
.rank-v2-row-title > strong
.rank-v2-cover img
```

Anchor selectors must return DOM order. `.rank-v2-cover img` must return the cover first so platform icons cannot become `imageUrl`.

- [ ] **Step 4: Isolate existing Legacy tests**

Make each test in `tests/webtoon/legacy-list-request.test.js` pass this preference unless it already supplies preferences:

```js
preferences: { ntk_webtoon_parser_family: "legacy" }
```

For the custom Legacy URL test, keep both `ntk_webtoon_base_url` and the explicit Legacy parser family.

- [ ] **Step 5: Run the new focused tests and verify RED**

```powershell
node --test tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/webtoon/next-popular-parser.test.js tests/webtoon/legacy-list-request.test.js
```

Expected: FAIL because metadata is Legacy and the Next URL/parser methods do not exist.

- [ ] **Step 6: Implement Next metadata and separated URL resolution**

Set Source and `index.json` fields exactly:

```js
baseUrl: "https://sbxh9.com",
iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://sbxh9.com",
version: "0.101",
notes: "Next Popular preview only; latest, search, filters, detail, and reader are not implemented.",
```

Add:

```js
const LEGACY_DEFAULT_BASE_URL = "https://newtoki1.org";
const NEXT_DEFAULT_DOMAIN_NUMBER = "9";
const NEXT_DOMAIN_NUMBER_PREFERENCE = "ntk_webtoon_next_domain_number";

getParserFamily() {
  return (
    new SharedPreferences().get(PARSER_FAMILY_PREFERENCE) || "next"
  ).trim();
}

getNextDomainNumber() {
  const configured = new SharedPreferences().get(NEXT_DOMAIN_NUMBER_PREFERENCE);
  const value = (configured || "").trim() || NEXT_DEFAULT_DOMAIN_NUMBER;
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid Next domain number=${value}`);
  }
  return value;
}

getNextBaseUrl() {
  return `https://sbxh${this.getNextDomainNumber()}.com`;
}

getLegacyBaseUrl() {
  const configured = new SharedPreferences().get(BASE_URL_PREFERENCE);
  return (configured || LEGACY_DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
}

getBaseUrl() {
  return this.getParserFamily() === "next"
    ? this.getNextBaseUrl()
    : this.getLegacyBaseUrl();
}
```

- [ ] **Step 7: Implement Next request, three explicit selectors and dispatcher**

Add `buildNextPopularUrl()` and `fetchNextPopular()`:

```js
buildNextPopularUrl() {
  return `${this.getNextBaseUrl()}/rank?period=week&kind=webtoon`;
}

async fetchNextPopular() {
  const requestUrl = this.buildNextPopularUrl();
  const response = await new Client().get(requestUrl, this.getHeaders());
  return this.parseNextPopularResponse(response, requestUrl);
}
```

Use selectors only through these wrappers:

```js
parseNextChampion(element, requestUrl) {
  return this.parseNextRankCard(element, "h2", requestUrl);
}

parseNextRunner(element, requestUrl) {
  return this.parseNextRankCard(
    element,
    ".rank-v2-runner-body > strong",
    requestUrl,
  );
}

parseNextRow(element, requestUrl) {
  return this.parseNextRankCard(
    element,
    ".rank-v2-row-title > strong",
    requestUrl,
  );
}
```

`parseNextRankCard` validates title and root `href`, selects the first `.rank-v2-cover img`, preserves missing covers as an empty URL, and returns `{name, link, imageUrl}`.

`parseNextPopularResponse` must:

1. reject status outside 200~399;
2. reject a present Content-Type that does not include `text/html`;
3. require `.rank-v2-page`;
4. concatenate champion, runners and rows in that order;
5. reject a zero-card first page;
6. return `{list, hasNextPage:false}`.

Dispatch without fallback:

```js
async getPopular(page) {
  if (this.getParserFamily() === "next") {
    if (page > 1) return { list: [], hasNextPage: false };
    return this.fetchNextPopular();
  }
  return this.fetchLegacyList({ mode: "popular", page });
}
```

- [ ] **Step 8: Run Webtoon tests and verify GREEN**

```powershell
node --test tests/webtoon/*.test.js
```

Expected: every Webtoon test PASS.

- [ ] **Step 9: Commit the complete Next Popular slice**

```powershell
git add -- index.json javascript/manga/src/ko/ntk_webtoon.js tests/webtoon/index-entry.test.js tests/webtoon/legacy-list-request.test.js tests/webtoon/helpers/load-webtoon-source.js tests/webtoon/fixtures/next-rank-week.html tests/webtoon/next-popular-request.test.js tests/webtoon/next-popular-parser.test.js
git commit -m "feat: add next webtoon popular ranking"
```

---

### Task 2: Prevent Cross-Family Feature Fallback

**Files:**
- Modify: `tests/webtoon/next-popular-request.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`

**Interfaces:**
- Consumes: `getParserFamily()` and existing Legacy Latest/search/filter paths.
- Produces: dynamic `supportsLatest`, explicit Next not-implemented errors, Next-empty filter list and source preferences.

- [ ] **Step 1: Write failing capability tests**

Require:

```js
test("does not expose unfinished Next list features", async () => {
  const { extension, requests } = loadWebtoonSource();
  assert.equal(extension.supportsLatest, false);
  assert.deepEqual(JSON.parse(JSON.stringify(extension.getFilterList())), []);
  await assert.rejects(
    () => extension.getLatestUpdates(1),
    /Next Webtoon latest is not implemented/,
  );
  await assert.rejects(
    () => extension.search("테스트", 1, []),
    /Next Webtoon search is not implemented/,
  );
  assert.equal(requests.length, 0);
});
```

Add a Legacy preference test requiring `supportsLatest=true` and a non-empty Legacy filter list.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --test tests/webtoon/next-popular-request.test.js
```

Expected: FAIL because unfinished Next capabilities still enter Legacy code.

- [ ] **Step 3: Implement explicit capability boundaries**

Use:

```js
get supportsLatest() {
  return this.getParserFamily() === "legacy";
}
```

At the start of `getLatestUpdates` and `search`, throw the exact errors from Step 1 when the parser is Next. At the start of `getFilterList`, return `[]` for Next.

In `getSourcePreferences()`:

- add `Next domain number` edit text with key `ntk_webtoon_next_domain_number` and value `9`;
- retain the old full URL input under the title `Legacy Base URL`;
- order parser options as `Next`, `Legacy`;
- set `entryValues` to `next`, `legacy` and `valueIndex: 0`.

- [ ] **Step 4: Run Webtoon tests and verify GREEN**

```powershell
node --test tests/webtoon/*.test.js
```

Expected: all Webtoon tests PASS, including Legacy isolation.

- [ ] **Step 5: Commit the capability boundary**

```powershell
git add -- javascript/manga/src/ko/ntk_webtoon.js tests/webtoon/next-popular-request.test.js
git commit -m "fix: isolate unfinished next features"
```

---

### Task 3: Roadmap, Verification, and Master Publication

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md`
- Verify: `index.json`
- Verify: `javascript/manga/src/ko/ntk_webtoon.js`

**Interfaces:**
- Consumes: completed Next Popular implementation.
- Produces: tested master raw repository ready for Mangayomi manual verification.

- [ ] **Step 1: Update the roadmap**

Record:

```text
Next implementation order: Webtoon -> Manhwa -> Novel -> Anime -> Legacy
Next Webtoon Popular: /rank?period=week&kind=webtoon
Next Webtoon Latest: /ing (future step, not implemented in 0.101)
After Popular manual verification: analyze and implement Next filters and title search
```

- [ ] **Step 2: Run complete local validation**

```powershell
git diff --check
node --test tests/webtoon/*.test.js
pnpm test
```

Expected: diff check exits 0, Webtoon tests PASS, all repository tests PASS.

- [ ] **Step 3: Run a live read-only smoke check**

Request `https://sbxh9.com/rank?period=week&kind=webtoon` with the extension headers and verify HTTP 200, HTML Content-Type, `.rank-v2-page`, and at least one champion/runner/row. Record the observed item count but do not require exactly 50 in runtime code.

- [ ] **Step 4: Commit the roadmap checkpoint**

```powershell
git add -- docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md
git commit -m "docs: prioritize next source development"
```

- [ ] **Step 5: Push master and verify raw artifacts**

```powershell
git push origin master
```

Verify both URLs return HTTP 200 and the remote index contains ID `260713001`, version `0.101`, base URL `https://sbxh9.com`, and the master source URL:

```text
https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/index.json
https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/manga/src/ko/ntk_webtoon.js
```

- [ ] **Step 6: Hand off the Mangayomi manual test**

Tell the user to refresh the repository, install/update NTK Webtoon `0.101`, and verify only Popular ordering, titles, covers and absence of repeated pagination. State that detail, Latest, search and filters remain outside this test.
