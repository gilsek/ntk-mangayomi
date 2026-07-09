# NTK Mangayomi Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Mangayomi JavaScript extension repository that ports Tachiyomi NTK Webtoon first and NTK Manga second.

**Architecture:** A single JavaScript source file exposes shared NTK helpers and two source definitions. Repository manifests point Mangayomi at that source file. Node tests validate URL construction and parsers independently from Mangayomi.

**Tech Stack:** Plain JavaScript, Node.js built-in `node:test`, JSON manifests compatible with Mangayomi extension repository metadata.

## Global Constraints

- Use JavaScript rather than Dart for the first iPhone-focused implementation.
- Do not convert or execute the Tachiyomi APK binary.
- Keep `NTK Webtoon` and `NTK Manga` backed by one shared implementation.
- Keep the active `sbxh` domain configurable.
- Mark both sources as NSFW because the Tachiyomi APK declares `tachiyomi.extension.nsfw=1`.
- Local validation cannot prove Mangayomi/iPhone runtime behavior; it must prove repository structure and parser behavior.

---

## File Structure

- `javascript/manga/src/ko/ntk.js`: Mangayomi source implementation and exported test helpers.
- `index.json`: Mangayomi manga source index with `NTK Webtoon` and `NTK Manga`.
- `repo.json`: Repository metadata.
- `tests/ntk.test.js`: Node tests for URL builders and parsers.
- `package.json`: Local test script.

### Task 1: Repository Scaffolding and Manifest Metadata

**Files:**
- Create: `package.json`
- Create: `repo.json`
- Create: `index.json`

**Interfaces:**
- Produces: `index.json` entries with `sourceCodeUrl` pointing to `javascript/manga/src/ko/ntk.js`.
- Produces: `npm test` command for later tasks.

- [ ] **Step 1: Create repository metadata**

Create `repo.json`:

```json
{
  "name": "Local NTK Mangayomi extensions",
  "website": "https://github.com/local/ntk-mangayomi"
}
```

- [ ] **Step 2: Create source index**

Create `index.json`:

```json
[
  {
    "name": "NTK Webtoon",
    "id": 240710001,
    "baseUrl": "https://sbxh9.com",
    "lang": "ko",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://sbxh9.com",
    "dateFormat": "yy.MM.dd",
    "dateFormatLocale": "ko",
    "isNsfw": true,
    "hasCloudflare": false,
    "sourceCodeUrl": "https://raw.githubusercontent.com/local/ntk-mangayomi/main/javascript/manga/src/ko/ntk.js",
    "apiUrl": "",
    "version": "0.1.0",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "source=webtoon",
    "sourceCodeLanguage": 1,
    "notes": "Ported from Tachiyomi NTK v1.4.3. Update sourceCodeUrl after publishing."
  },
  {
    "name": "NTK Manga",
    "id": 240710002,
    "baseUrl": "https://sbxh9.com",
    "lang": "ko",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://sbxh9.com",
    "dateFormat": "yy.MM.dd",
    "dateFormatLocale": "ko",
    "isNsfw": true,
    "hasCloudflare": false,
    "sourceCodeUrl": "https://raw.githubusercontent.com/local/ntk-mangayomi/main/javascript/manga/src/ko/ntk.js",
    "apiUrl": "",
    "version": "0.1.0",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "source=manga",
    "sourceCodeLanguage": 1,
    "notes": "Ported from Tachiyomi NTK v1.4.3. Update sourceCodeUrl after publishing."
  }
]
```

- [ ] **Step 3: Create package script**

Create `package.json`:

```json
{
  "name": "ntk-mangayomi-extension",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 4: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('index.json','utf8')); JSON.parse(require('fs').readFileSync('repo.json','utf8')); JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('json ok')"`

Expected: `json ok`

### Task 2: NTK Shared Source Implementation

**Files:**
- Create: `javascript/manga/src/ko/ntk.js`
- Create: `tests/ntk.test.js`

**Interfaces:**
- Consumes: `additionalParams` values `source=webtoon` and `source=manga`.
- Produces: `__ntkTest` object with `createNtkSource`, `parseDetailsHtml`, `parseChaptersHtml`, `parseWorksResponse`, `parsePageImagesResponse`, `buildApiUrl`.

- [ ] **Step 1: Write parser and URL tests**

Create `tests/ntk.test.js` with tests that import `__ntkTest` and assert:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const ntk = require("../javascript/manga/src/ko/ntk.js").__ntkTest;

test("builds webtoon popular API URL", () => {
  const source = ntk.createNtkSource({ variant: "webtoon" });
  const url = source.__buildPopularUrl(2);
  assert.equal(url, "https://sbxh9.com/api/works?status=ongoing&sort=views&page=2&pageSize=49&withTotal=1");
});

test("builds manga popular API URL", () => {
  const source = ntk.createNtkSource({ variant: "manga" });
  const url = source.__buildPopularUrl(3);
  assert.equal(url, "https://sbxh9.com/api/manhwa-list?status=ongoing&sort=views&page=3&pageSize=49&withTotal=1");
});

test("parses details HTML selectors recovered from APK", () => {
  const html = `
    <h1 class="hero-v2-title">작품 제목</h1>
    <div class="hero-v2-author"><a>작가</a></div>
    <p class="hero-v2-desc">설명</p>
    <div class="hero-v2-thumb"><img src="/cover.jpg"></div>
    <span class="pill-status">연재중</span>
    <a class="hero-v2-tag">액션</a><a class="hero-v2-tag">판타지</a>`;
  assert.deepEqual(ntk.parseDetailsHtml(html, "https://sbxh9.com"), {
    title: "작품 제목",
    author: "작가",
    description: "설명",
    thumbnailUrl: "https://sbxh9.com/cover.jpg",
    status: "ONGOING",
    genre: "액션, 판타지"
  });
});

test("parses chapter rows", () => {
  const html = `
    <ul class="ep-list-v2">
      <li class="ep-row-v2">
        <a class="ep-row-v2-link" href="/webtoon/1/reader/2"></a>
        <div class="ep-row-v2-title"><strong>2화</strong></div>
        <span class="ep-row-v2-date">24.07.10</span>
      </li>
    </ul>`;
  assert.deepEqual(ntk.parseChaptersHtml(html, "https://sbxh9.com"), [
    {
      name: "2화",
      url: "/webtoon/1/reader/2",
      dateUpload: "24.07.10",
      scanlator: ""
    }
  ]);
});

test("parses image arrays and rejects ad acknowledgment", () => {
  assert.deepEqual(ntk.parsePageImagesResponse(JSON.stringify({ images: ["https://i/1.jpg", { url: "https://i/2.jpg" }] })), [
    "https://i/1.jpg",
    "https://i/2.jpg"
  ]);
  assert.throws(() => ntk.parsePageImagesResponse('{"ad_ack_required":true}'), /Ad acknowledgment required/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `javascript/manga/src/ko/ntk.js` does not exist yet.

- [ ] **Step 3: Implement shared source**

Create `javascript/manga/src/ko/ntk.js` with:

- Variant config for `webtoon` and `manga`.
- URL builder helpers.
- Minimal HTML selector parser using regex helpers for known selectors.
- JSON response parser helpers.
- Mangayomi-compatible source methods: `getPopular`, `getLatestUpdates`, `search`, `getDetail`, `getChapters`, `getPageList`.
- `module.exports.__ntkTest` for Node validation.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: all tests pass.

### Task 3: Repository Consistency Validation

**Files:**
- Modify: `tests/ntk.test.js`

**Interfaces:**
- Consumes: `index.json`, `repo.json`, `package.json`.
- Produces: test coverage that guards source metadata consistency.

- [ ] **Step 1: Add manifest tests**

Add tests that assert:

- `index.json` has exactly two entries.
- Source names are `NTK Webtoon` and `NTK Manga`.
- Both entries have `sourceCodeLanguage: 1`.
- Both entries have `isNsfw: true`.
- `additionalParams` are distinct.

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: all tests pass.

### Task 4: Final Verification

**Files:**
- No new files.

**Interfaces:**
- Consumes: all deliverables.
- Produces: final evidence for local completion.

- [ ] **Step 1: Check git status**

Run: `git status --short`

Expected: created files are visible and no unexpected unrelated files exist.

- [ ] **Step 2: Run full validation**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Review publish notes**

Open `index.json` and confirm `sourceCodeUrl` uses placeholder `https://raw.githubusercontent.com/local/ntk-mangayomi/main/...`.
Before using on iPhone, replace it with the actual published raw URL or serve the repository locally through an HTTP server reachable by the phone.

## Self-Review

Spec coverage:

- JavaScript implementation is covered by Task 2.
- Both sources are covered by Task 1 and Task 3.
- Configurable domain is covered by Task 2.
- Local validation is covered by Task 2, Task 3, and Task 4.
- iPhone runtime validation is documented as manual because no Mangayomi runtime is available in this workspace.

Placeholder scan:

- No task contains unresolved placeholders.
- The `sourceCodeUrl` placeholder is intentional and explicitly called out for publishing.

Type consistency:

- `createNtkSource`, parser helper names, and test imports are consistent across tasks.
