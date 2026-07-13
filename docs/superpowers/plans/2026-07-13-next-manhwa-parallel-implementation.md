# Next Manhwa Parallel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Every production behavior follows superpowers:test-driven-development: write the test, run it and observe the expected failure, then write the minimum implementation.

**Goal:** Build an independent Next-family `NTK Manhwa` Mangayomi source through full episode-list navigation, while deliberately leaving episode image loading for a later reader project.

**Architecture:** A frozen scaffold defines source metadata, numeric-domain preferences, one persistent client, URL safety, a dependency-injectable test loader, and three non-overlapping method regions. After that scaffold is reviewed, list, search/filter, and detail/episode agents work in separate Git worktrees from the same baseline commit. Only the integration owner modifies `index.json`, and only after all three branches pass their own review.

**Tech Stack:** Mangayomi JavaScript source API, Node.js `node:test`, Node `vm`, Git branches and worktrees, pnpm.

## Global Constraints

- Always respond to the user in Korean; code and test names may follow the repository's existing English style.
- New source ID: `260713002`.
- Final pushed version: `0.205`; feature branches do not modify `index.json` or publish intermediate versions.
- Default Next base URL: `https://sbxh9.com`.
- The user setting accepts only the numeric portion after `sbxh`; the preference key is `ntk_manhwa_next_domain_number`, with default value `9`.
- The source file is `javascript/manga/src/ko/ntk_manhwa.js`; it contains exactly one `DefaultExtension` and does not import or share parsers with `ntk.js` or `ntk_webtoon.js`.
- Tests live only under `tests/manhwa/`; feature-specific test DOM implementations and fixtures stay in the owning feature directory.
- Popular uses `/rank?period=week&kind=manhwa` and has only one page.
- Latest uses `/manhwa/updates` and preserves the observed server pagination contract.
- Title search uses `/search` with a `kind=manhwa` discriminator and only returns `/manhwa/` works.
- Empty-title search uses the live `/api/manhwa-list` filter contract; no Webtoon filter values are copied without current Manhwa evidence.
- Detail uses `/manhwa/{workId}`.
- Full episodes use `/api/manhwa/{workId}/episodes/viewer-nav`.
- Work and episode IDs are opaque non-empty path segments. Numeric and `u-...` values remain strings.
- Chapter URLs use `/manhwa/{workId}/{episodeId}` and retain the API's order.
- The implementation must support at least 2,000 returned episodes without HTML `epage` crawling.
- `getPageList()` always throws a clear not-implemented error and performs no HTTP or WebView work.
- Existing Webtoon and Novel source behavior and registrations remain unchanged until the final manifest-only integration commit.
- No dependency additions, unrelated refactors, formatting sweeps, force pushes, or pull requests.

---

## File and Ownership Map

### Integration owner only

- Create and freeze: `javascript/manga/src/ko/ntk_manhwa.js` core and delegate boundaries
- Create and freeze: `tests/manhwa/helpers/load-manhwa-source.js`
- Create: `tests/manhwa/source-shell.test.js`
- Modify at final integration only: `index.json`
- Modify at final integration only: `tests/webtoon/index-entry.test.js`
- Create at final integration only: `tests/manhwa/index-entry.test.js`

### Lists agent only

- Modify only the `MANHWA_LIST_METHODS` region in `javascript/manga/src/ko/ntk_manhwa.js`
- Create: `tests/manhwa/lists/**`
- Create: `tests/manhwa/fixtures/lists/**`

### Search/filter agent only

- Modify only the `MANHWA_SEARCH_FILTER_METHODS` region in `javascript/manga/src/ko/ntk_manhwa.js`
- Create: `tests/manhwa/search/**`
- Create: `tests/manhwa/filters/**`
- Create: `tests/manhwa/fixtures/search/**`
- Create: `tests/manhwa/fixtures/filters/**`

### Detail/episodes agent only

- Modify only the `MANHWA_DETAIL_EPISODE_METHODS` region in `javascript/manga/src/ko/ntk_manhwa.js`
- Create: `tests/manhwa/detail/**`
- Create: `tests/manhwa/episodes/**`
- Create: `tests/manhwa/fixtures/detail/**`
- Create: `tests/manhwa/fixtures/episodes/**`

If a feature agent needs a frozen core or loader change, it records the request and stops editing that file. The integration owner applies a test-first core change to the baseline and rebases the affected branches.

---

### Task 1: Frozen Manhwa Source Scaffold

**Branch/worktree:** `codex/manhwa-integration` in `.worktrees/manhwa-integration`

**Files:**

- Create: `javascript/manga/src/ko/ntk_manhwa.js`
- Create: `tests/manhwa/helpers/load-manhwa-source.js`
- Create: `tests/manhwa/source-shell.test.js`

**Interfaces:**

- Produces `DefaultExtension.getNextBaseUrl()`, `getHeaders()`, `toAbsoluteUrl()`, `normalizeWorkLink()`, `normalizeChapterLink()`, and `getSourcePreferences()` for all later tasks.
- Produces `loadManhwaSource({ preferences, responses, DocumentClass })` returning `{ extension, requests, sources }`.
- Produces three frozen delegate regions named `MANHWA_LIST_METHODS`, `MANHWA_SEARCH_FILTER_METHODS`, and `MANHWA_DETAIL_EPISODE_METHODS`.

- [ ] **Step 1: Write the failing shell contract test**

Create `tests/manhwa/source-shell.test.js` with focused tests that assert:

```js
assert.equal(sources[0].id, 260713002);
assert.equal(sources[0].baseUrl, "https://sbxh9.com");
assert.equal(extension.getNextBaseUrl(), "https://sbxh12.com");
assert.throws(() => invalid.extension.getNextBaseUrl(), /domain number/i);
assert.deepEqual(extension.getHeaders(), {
  Referer: "https://sbxh9.com/",
  "User-Agent": expectedTabletUserAgent,
});
await assert.rejects(() => extension.getPageList("/manhwa/2/3"), /not implemented/i);
assert.equal(requests.length, 0);
```

Cover blank preference fallback plus invalid `-1`, `1.5`, `abc`, and full-URL values. Assert that same-origin absolute and relative `/manhwa/{work}` and `/manhwa/{work}/{episode}` links normalize, while cross-origin, query-bearing, fragment-bearing, dangerous-scheme, empty-segment, and extra-segment links reject without echoing the supplied value.

- [ ] **Step 2: Run the test and observe RED**

Run:

```powershell
pnpm test -- tests/manhwa/source-shell.test.js
```

Expected: failure because `ntk_manhwa.js` or `load-manhwa-source.js` does not exist.

- [ ] **Step 3: Implement the minimum source shell**

Create metadata for `NTK Manhwa`, source ID `260713002`, base `https://sbxh9.com`, `itemType: 0`, `isManga: true`, `isNsfw: false`, `appMinVerReq: "0.5.0"`, source path `manga/src/ko/ntk_manhwa.js`, and an internal development version that is not registered in `index.json`.

Use one persistent client per extension instance:

```js
constructor() {
  super();
  this.client = new Client();
}
```

Delegate each public method to a feature-owned object with `call(this, ...)`. Placeholder methods throw feature-specific not-implemented errors. `getPageList()` remains in the frozen core and always throws before using the client.

- [ ] **Step 4: Implement the dependency-injectable test loader**

The loader supplies a request-recording `TestClient`, preferences, `MProvider`, and a caller-provided `DocumentClass`. A minimal default document returns empty selections. It exposes only the loaded extension, deep-cloned source metadata, and recorded requests.

- [ ] **Step 5: Run shell and full baseline tests**

Run:

```powershell
pnpm test -- tests/manhwa/source-shell.test.js
pnpm test
git diff --check
```

Expected: shell tests pass; all 137 existing tests still pass; no whitespace errors.

- [ ] **Step 6: Review and commit the baseline**

Review for source isolation, safe URL errors, one client instance, and exact delegate ownership. Commit:

```powershell
git add javascript/manga/src/ko/ntk_manhwa.js tests/manhwa docs/superpowers/plans/2026-07-13-next-manhwa-parallel-implementation.md
git commit -m "feat: scaffold next manhwa source"
```

Record this commit as the base for Tasks 2-4.

---

### Task 2: Weekly Popular and Latest Lists

**Branch/worktree:** `codex/manhwa-lists` in `.worktrees/manhwa-lists`

**Files:**

- Modify: `javascript/manga/src/ko/ntk_manhwa.js`, `MANHWA_LIST_METHODS` region only
- Create: `tests/manhwa/lists/next-popular.test.js`
- Create: `tests/manhwa/lists/next-latest.test.js`
- Create: `tests/manhwa/lists/test-document.js`
- Create: `tests/manhwa/fixtures/lists/next-rank-week.html`
- Create: `tests/manhwa/fixtures/lists/next-latest-page.html`
- Create: `tests/manhwa/fixtures/lists/next-latest-empty.html`

**Interfaces:**

- Produces `getPopular(page)` and `getLatestUpdates(page)` returning `{ list, hasNextPage }`.
- Consumes only frozen core URL, client, and header functions.

- [ ] **Step 1: Capture and document the live list contracts**

Fetch the weekly ranking and latest pages with the source headers. Save minimal sanitized HTML fixtures that retain the actual containers, card classes, link paths, cover attributes, platform-logo images, and pagination markers. Record status and content type in the task report; do not save cookies or secrets.

- [ ] **Step 2: Write failing request tests**

Assert exact weekly ranking URL and one-page behavior:

```js
assert.equal(url.pathname, "/rank");
assert.equal(url.searchParams.get("period"), "week");
assert.equal(url.searchParams.get("kind"), "manhwa");
assert.deepEqual(await extension.getPopular(2), { list: [], hasNextPage: false });
```

Assert Latest uses `/manhwa/updates`, sends the observed page parameter only as the live site requires, and exposes `supportsLatest === true`.

- [ ] **Step 3: Run request tests and observe RED**

Run the two list tests. Expected: feature placeholder errors.

- [ ] **Step 4: Write failing parser and error tests**

Cover ranking order, latest order, titles, `/manhwa/` links, missing covers, platform logo rejection, explicit empty page, last-page detection, HTTP failure, non-HTML response, missing required container, malformed card, and unrelated `/webtoon/` cards.

- [ ] **Step 5: Implement the minimum list methods**

Implement only inside `MANHWA_LIST_METHODS`. Reuse frozen core helpers through `this`; do not copy Webtoon parser functions. A work without a real cover returns `imageUrl: ""` rather than a logo.

- [ ] **Step 6: Validate and commit**

Run:

```powershell
pnpm test -- tests/manhwa/lists
pnpm test
git diff --check
```

Commit:

```powershell
git add javascript/manga/src/ko/ntk_manhwa.js tests/manhwa/lists tests/manhwa/fixtures/lists
git commit -m "feat: add next manhwa lists"
```

---

### Task 3: Title Search and Manhwa Filters

**Branch/worktree:** `codex/manhwa-search-filters` in `.worktrees/manhwa-search-filters`

**Files:**

- Modify: `javascript/manga/src/ko/ntk_manhwa.js`, `MANHWA_SEARCH_FILTER_METHODS` region only
- Create: `tests/manhwa/search/next-search.test.js`
- Create: `tests/manhwa/search/test-document.js`
- Create: `tests/manhwa/filters/next-filter-model.test.js`
- Create: `tests/manhwa/filters/next-filter-request.test.js`
- Create: `tests/manhwa/filters/next-filter-response.test.js`
- Create feature-owned fixtures under `tests/manhwa/fixtures/search/` and `tests/manhwa/fixtures/filters/`

**Interfaces:**

- Produces `search(query, page, filters)` and `getFilterList()`.
- Non-empty query always takes precedence over filters. Empty query uses `/api/manhwa-list`.

- [ ] **Step 1: Capture the live search and filter contracts**

Inspect the current Manhwa search form and its network request. Save a minimal title-search HTML fixture and filter JSON fixture. Record every accepted status, sort, and genre parameter exactly as the current Manhwa UI sends it. Do not copy Webtoon filter constants by similarity.

- [ ] **Step 2: Write and fail title-search tests**

Assert the encoded query and `kind=manhwa`, first-page contract, no request after the server's fixed search page if observed, DOM order, `/manhwa/` filtering, platform-logo rejection, explicit empty result, malformed structure, HTTP errors, and non-HTML errors.

- [ ] **Step 3: Write and fail filter-model and request tests**

Assert only live-observed Manhwa filter options. Assert empty-title routing, page and page-size values, status/sort/genre serialization, invalid state omission, and no search request when the title is blank.

- [ ] **Step 4: Write and fail filter-response tests**

Cover normal and empty results, opaque work IDs, title requirement, cover handling, `hasMore`, malformed JSON, wrong content type, missing required fields, duplicate IDs, and HTTP errors.

- [ ] **Step 5: Implement the minimum search/filter methods**

Implement only inside `MANHWA_SEARCH_FILTER_METHODS`. Keep search HTML parsing and filter JSON parsing separate. Do not add client UI changes or shared Webtoon constants.

- [ ] **Step 6: Validate and commit**

Run feature tests, full `pnpm test`, and `git diff --check`. Commit:

```powershell
git add javascript/manga/src/ko/ntk_manhwa.js tests/manhwa/search tests/manhwa/filters tests/manhwa/fixtures/search tests/manhwa/fixtures/filters
git commit -m "feat: add next manhwa search filters"
```

---

### Task 4: Detail and Full Viewer-Navigation Episodes

**Branch/worktree:** `codex/manhwa-detail-episodes` in `.worktrees/manhwa-detail-episodes`

**Files:**

- Modify: `javascript/manga/src/ko/ntk_manhwa.js`, `MANHWA_DETAIL_EPISODE_METHODS` region only
- Create: `tests/manhwa/detail/next-detail.test.js`
- Create: `tests/manhwa/detail/test-document.js`
- Create: `tests/manhwa/episodes/viewer-nav.test.js`
- Create feature-owned fixtures under `tests/manhwa/fixtures/detail/` and `tests/manhwa/fixtures/episodes/`

**Interfaces:**

- Produces `getDetail(url)` returning Mangayomi manga metadata plus `chapters`.
- Consumes `/api/manhwa/{workId}/episodes/viewer-nav`; never crawls `epage` HTML.

- [ ] **Step 1: Capture live detail and viewer-nav contracts**

Fetch a numeric work and, when available, an opaque-ID work. Save minimal sanitized detail HTML and viewer-nav JSON. Confirm whether the episode API depends on a prior detail cookie. Only parallelize the two requests if a clean-session test proves independence; otherwise keep one persistent client and request detail first.

- [ ] **Step 2: Write and fail detail tests**

Assert canonical link, title, cover, description, author, artist, numeric status, deduplicated genres, missing optional fields, malformed link, HTTP errors, wrong content type, and missing required detail container/title.

- [ ] **Step 3: Implement detail metadata and commit the logical `0.204` checkpoint**

Implement the detail portion inside the owned region and keep episode parsing as a throwing placeholder. Run detail tests and commit:

```powershell
git add javascript/manga/src/ko/ntk_manhwa.js tests/manhwa/detail tests/manhwa/fixtures/detail
git commit -m "feat: add next manhwa detail"
```

- [ ] **Step 4: Write and fail viewer-nav episode tests**

Assert endpoint `/api/manhwa/{workId}/episodes/viewer-nav`, exact API order, titles, opaque IDs, `/manhwa/{workId}/{episodeId}` URLs, empty list, 2,015 episodes, total mismatch, missing ID/title, duplicate ID, malformed JSON, wrong content type, and HTTP errors. `epNo` may differ from the visible title and must not replace a non-empty server title.

- [ ] **Step 5: Implement full episodes and commit the logical `0.205` checkpoint**

Parse the full JSON array once with linear-time duplicate detection. Preserve every API item and return no synthetic upload date. Run detail and episode tests, then commit:

```powershell
git add javascript/manga/src/ko/ntk_manhwa.js tests/manhwa/episodes tests/manhwa/fixtures/episodes
git commit -m "feat: add next manhwa episodes"
```

- [ ] **Step 6: Validate the complete branch**

Run:

```powershell
pnpm test -- tests/manhwa/detail tests/manhwa/episodes
pnpm test
git diff --check
```

Expected: all tests pass and `getPageList()` remains untouched in the frozen core.

---

### Task 5: Reviews, Integration, Manifest 0.205, and Master Publication

**Branch/worktree:** `codex/manhwa-integration` in `.worktrees/manhwa-integration`

**Files:**

- Modify: `index.json`
- Modify: `tests/webtoon/index-entry.test.js`
- Create: `tests/manhwa/index-entry.test.js`
- Integrate reviewed changes to `javascript/manga/src/ko/ntk_manhwa.js` and `tests/manhwa/**`

**Interfaces:**

- Consumes the reviewed commits from Tasks 2-4.
- Produces the only published `NTK Manhwa` entry, version `0.205`.

- [ ] **Step 1: Review each feature branch before integration**

For each branch, generate a diff package from the Task 1 base commit and dispatch a fresh reviewer. The reviewer must return separate spec-compliance and code-quality verdicts. Critical or Important findings return to the owning branch and require a focused test run plus re-review.

- [ ] **Step 2: Merge only approved branches**

Integrate in this order: lists, search/filters, detail/episodes. Preserve Task 4's two commits. Any manual conflict resolution requires the affected feature tests before continuing.

- [ ] **Step 3: Write the failing final manifest tests**

Assert exactly one Manhwa entry across old and new IDs, with:

```js
assert.equal(manhwa.id, 260713002);
assert.equal(manhwa.name, "NTK Manhwa");
assert.equal(manhwa.baseUrl, "https://sbxh9.com");
assert.equal(manhwa.version, "0.205");
assert.equal(manhwa.itemType, 0);
assert.equal(manhwa.isManga, true);
assert.equal(path.posix.basename(new URL(manhwa.sourceCodeUrl).pathname), "ntk_manhwa.js");
assert.match(manhwa.notes, /Popular.*Latest.*search.*filters.*detail.*episodes/i);
assert.match(manhwa.notes, /reader.*not implemented/i);
```

Update the Webtoon index test so it preserves the new Manhwa ID and the existing Novel ID without changing Webtoon metadata.

- [ ] **Step 4: Run the manifest tests and observe RED**

Expected: old Manhwa ID `240710002`, old source URL, and old version fail the new assertions.

- [ ] **Step 5: Update `index.json` and embedded source metadata to 0.205**

Replace the old Manhwa registration with ID `260713002`, source URL ending `ntk_manhwa.js`, base `https://sbxh9.com`, empty `additionalParams`, and final version `0.205`. Keep the notes explicit that list, search, filters, detail, and full episodes work while reader image loading is not implemented.

- [ ] **Step 6: Run final validation**

Run:

```powershell
pnpm test -- tests/manhwa
pnpm test
git diff --check
git status --short
```

Perform read-only live smoke checks for the weekly rank, latest, title search, one filtered API request, one detail page, and one viewer-nav request. Do not log cookies, tokens, or full sensitive response bodies.

- [ ] **Step 7: Dispatch final whole-change review**

Review the complete range from `ee0ad25` through integration HEAD for scope, source isolation, URL safety, cover correctness, pagination, large episode performance, manifest consistency, and absence of reader authentication code.

- [ ] **Step 8: Commit and publish without a PR**

Commit the final manifest integration:

```powershell
git add index.json tests/webtoon/index-entry.test.js tests/manhwa/index-entry.test.js javascript/manga/src/ko/ntk_manhwa.js
git commit -m "feat: publish next manhwa source"
```

After all validation and review pass, integrate the reviewed commit range into `master` and push `master` to `origin`. Do not force push and do not create a pull request.

---

## Self-Review Checklist

- Every user requirement maps to a task: weekly Popular (Task 2), Latest (Task 2), title search and filters (Task 3), detail (Task 4), full episodes and reader URL (Task 4), no image reader (Tasks 1 and 4), final `0.205` (Task 5).
- The three parallel tasks share only frozen interfaces and edit non-overlapping source regions and test directories.
- No feature branch edits `index.json`.
- No task reuses a Webtoon or legacy parser.
- Every production behavior has an explicit RED step before implementation.
- Every task ends with targeted tests, full regression tests, whitespace validation, and a review or commit boundary.
- The plan contains no placeholder implementation requirement; live-discovered values are constrained to current Manhwa evidence and captured in fixtures before code is written.
