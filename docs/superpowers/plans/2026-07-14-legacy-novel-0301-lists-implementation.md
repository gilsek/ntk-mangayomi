# Legacy Novel 0.301 Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분기 이전 Novel 구현의 목록 단계 유틸리티를 선택적으로 복사·검증하고, 독립 `NTK Novel` Source의 Legacy Popular/Latest를 `0.301`로 배포한다.

**Architecture:** 기존 `ntk.js`는 읽기 전용 기준점으로 유지하고, 이번 단계에 필요한 순수 URL 유틸리티만 신규 `ntk_novel.js`로 복사한다. 목록 요청과 파서는 Legacy `/novel` HTML 전용으로 새로 구현하며, 과거 동등성 테스트와 현재 계약 fixture 테스트를 분리한다. `0.301`이 로컬 검증을 모두 통과한 뒤에만 신규 ID와 `index.json`을 공개한다.

**Tech Stack:** Mangayomi JavaScript Source API, `MProvider`, `Client`, `SharedPreferences`, `Document`, Node.js `node:test`, `vm`, 고정 HTML fixture, Git master 직접 배포.

## Global Constraints

- 허용된 과거 코드 기준은 `b3d79a2`까지이며, 폐기한 Novel `0.305` 계열은 조회·복사·테스트 oracle로 사용하지 않는다.
- 이번 계획의 기능 범위는 독립 Source shell, 숫자형 Legacy 도메인 설정, Popular, Latest뿐이다.
- 검색, 필터, 상세, 회차, 리더는 `0.301`에서 구현하거나 동작하는 것처럼 표시하지 않는다.
- 신규 Source ID는 `260713003`, 버전은 `0.301`, `itemType: 2`, `isManga: false`, `isNsfw: true`, `additionalParams: ""`다.
- 기본 주소는 `https://newtoki1.org`, 설정값은 `newtoki` 뒤의 숫자만 받는다.
- 기존 `javascript/manga/src/ko/ntk.js`는 수정하거나 삭제하지 않는다.
- Webtoon, Manhwa, Novel 파서를 공유하지 않는다. 테스트 전용 범용 DOM helper만 Novel 테스트 폴더에 독립 복사한다.
- 외부 패키지를 추가하지 않고 `package.json`과 lockfile을 변경하지 않는다.
- 기존 미추적 `node_modules/`, `pnpm-lock.yaml`, `resource/`는 건드리지 않는다.
- 실기기, 브라우저, ADB는 자동 조작하지 않는다. 푸시 후 설치 검증은 사용자가 수행한다.
- 각 코드 작업은 실패 테스트 확인 후 최소 구현을 추가한다.

---

## File Map

- Create: `javascript/novel/src/ko/ntk_novel.js` — 독립 Source metadata, Legacy 도메인, URL 정규화, Popular/Latest 요청과 목록 파서
- Create: `tests/novel/helpers/load-novel-source.js` — VM 기반 Mangayomi 테스트 런타임과 요청 기록
- Create: `tests/novel/helpers/test-document.js` — Novel fixture용 최소 CSS selector DOM
- Create: `tests/novel/source-shell.test.js` — metadata, 도메인 설정, link validator, persistent client
- Create: `tests/novel/historical/pre-split-list-utilities.test.js` — 허용된 과거 유틸리티와 신규 유틸리티 차등 테스트
- Create: `tests/novel/fixtures/lists/legacy-list-page.html` — 표지 있음·없음·플랫폼 로고·중복·다음 페이지
- Create: `tests/novel/fixtures/lists/legacy-list-last-page.html` — 정상 마지막 페이지
- Create: `tests/novel/fixtures/lists/legacy-list-empty.html` — 명시적 빈 목록
- Create: `tests/novel/lists/legacy-popular.test.js` — Popular URL, 응답, 파서, pagination
- Create: `tests/novel/lists/legacy-latest.test.js` — Latest URL, 응답, 파서, pagination
- Create: `tests/novel/index-entry.test.js` — 신규/구 ID 중 하나만 공개하고 embedded metadata와 일치
- Modify: `index.json` — 기존 Novel 엔트리를 신규 독립 `0.301` 엔트리로 교체
- Modify: `tests/ntk.test.js` — 저장소 manifest 기대값을 신규 Novel metadata로 갱신
- Modify: `README.md` — 독립 Novel Source와 `0.301` 구현 범위를 정확히 설명

---

### Task 1: 독립 Novel Source shell과 테스트 런타임

**Files:**
- Create: `tests/novel/helpers/load-novel-source.js`
- Create: `tests/novel/source-shell.test.js`
- Create: `javascript/novel/src/ko/ntk_novel.js`

**Interfaces:**
- Produces: `loadNovelSource({ preferences, responses, DocumentClass })`
- Produces: `DefaultExtension.getLegacyDomainNumber(): string`
- Produces: `DefaultExtension.getLegacyBaseUrl(): string`
- Produces: `DefaultExtension.getHeaders(): object`
- Produces: `DefaultExtension.normalizeWorkLink(value): string`
- Produces: `DefaultExtension.getSourcePreferences(): array`

- [ ] **Step 1: Source shell 실패 테스트 작성**

`tests/novel/source-shell.test.js`에 다음 계약을 작성한다.

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const { loadNovelSource } = require("./helpers/load-novel-source");

test("exposes the frozen Legacy NTK Novel metadata", () => {
  const { sources } = loadNovelSource();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 260713003);
  assert.equal(sources[0].name, "NTK Novel");
  assert.equal(sources[0].baseUrl, "https://newtoki1.org");
  assert.equal(sources[0].version, "0.301");
  assert.equal(sources[0].itemType, 2);
  assert.equal(sources[0].isManga, false);
  assert.equal(sources[0].isNsfw, true);
  assert.equal(sources[0].additionalParams, "");
  assert.equal(sources[0].pkgPath, "novel/src/ko/ntk_novel.js");
  assert.match(sources[0].sourceCodeUrl, /\/ntk_novel\.js$/);
  assert.match(sources[0].notes, /Popular.*Latest/i);
  assert.match(sources[0].notes, /not implemented/i);
});

test("builds the Legacy host from a numeric preference", () => {
  const { extension } = loadNovelSource({
    preferences: { ntk_novel_legacy_domain_number: "12" },
  });
  assert.equal(extension.getLegacyBaseUrl(), "https://newtoki12.org");
});

test("uses domain 1 when the preference is absent or blank", () => {
  assert.equal(loadNovelSource().extension.getLegacyBaseUrl(), "https://newtoki1.org");
  assert.equal(
    loadNovelSource({
      preferences: { ntk_novel_legacy_domain_number: "   " },
    }).extension.getLegacyBaseUrl(),
    "https://newtoki1.org",
  );
});

for (const value of ["-1", "1.5", "abc", "https://newtoki12.org"]) {
  test(`rejects invalid Legacy domain preference ${JSON.stringify(value)}`, () => {
    const { extension } = loadNovelSource({
      preferences: { ntk_novel_legacy_domain_number: value },
    });
    assert.throws(() => extension.getLegacyBaseUrl(), /domain number/i);
  });
}

test("normalizes only numeric same-origin Novel work links", () => {
  const { extension } = loadNovelSource();
  assert.equal(extension.normalizeWorkLink("/novel/60079"), "/novel/60079");
  assert.equal(
    extension.normalizeWorkLink("https://newtoki1.org/novel/60079"),
    "/novel/60079",
  );
  for (const value of [
    "https://evil.example/novel/60079",
    "/novel/work",
    "/novel/60079?preview=1",
    "/novel/60079#chapter",
    "javascript:alert(1)",
    "//newtoki1.org/novel/60079",
  ]) {
    assert.throws(() => extension.normalizeWorkLink(value), /invalid work link/i);
  }
});

test("keeps one Client instance for the source lifetime", () => {
  const { extension } = loadNovelSource();
  assert.equal(extension.client, extension.client);
});
```

- [ ] **Step 2: 테스트 loader 작성**

`tests/novel/helpers/load-novel-source.js`는 다음 구조로 작성한다.

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.resolve(
  __dirname, "..", "..", "..", "javascript", "novel", "src", "ko", "ntk_novel.js",
);

class EmptyElement {
  attr() { return ""; }
  get text() { return ""; }
  select() { return []; }
  selectFirst() { return null; }
}

class EmptyDocument extends EmptyElement {}

function loadNovelSource({ preferences = {}, responses, DocumentClass = EmptyDocument } = {}) {
  assert.ok(fs.existsSync(sourcePath), "ntk_novel.js must exist");
  const requests = [];

  class TestClient {
    async get(url, headers = {}) {
      const request = { method: "GET", url, headers };
      requests.push(request);
      if (typeof responses === "function") return responses(url, headers, requests.length - 1, request);
      if (Array.isArray(responses)) return responses[requests.length - 1];
      return { body: "", headers: { "content-type": "text/html; charset=utf-8" }, statusCode: 200 };
    }
  }

  class TestPreferences {
    get(key) { return preferences[key] ?? ""; }
  }

  let context;
  class TestProvider {
    get source() { return context.__sources[0]; }
  }

  context = vm.createContext({
    Client: TestClient,
    Document: DocumentClass,
    MProvider: TestProvider,
    SharedPreferences: TestPreferences,
    console,
  });
  const code = fs.readFileSync(sourcePath, "utf8");
  vm.runInContext(
    `${code}\n;globalThis.__DefaultExtension = DefaultExtension; globalThis.__sources = mangayomiSources; globalThis.__novelTest = NOVEL_TEST_EXPORTS;`,
    context,
    { filename: sourcePath },
  );

  return {
    extension: new context.__DefaultExtension(),
    helpers: context.__novelTest,
    requests,
    sources: JSON.parse(JSON.stringify(context.__sources)),
  };
}

module.exports = { loadNovelSource };
```

- [ ] **Step 3: 실패 확인**

Run:

```powershell
node --test tests/novel/source-shell.test.js
```

Expected: `ntk_novel.js must exist`로 FAIL.

- [ ] **Step 4: 최소 Source shell 구현**

`javascript/novel/src/ko/ntk_novel.js`에 metadata, 도메인 설정, link validator와 빈 목록 메서드를 작성한다. 공개 메서드의 최소 형태는 다음과 같다.

```js
const LEGACY_DEFAULT_DOMAIN_NUMBER = "1";
const LEGACY_DOMAIN_NUMBER_PREFERENCE = "ntk_novel_legacy_domain_number";

const mangayomiSources = [{
  name: "NTK Novel",
  id: 260713003,
  baseUrl: "https://newtoki1.org",
  lang: "ko",
  typeSource: "single",
  iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://newtoki1.org",
  dateFormat: "yy.MM.dd",
  dateFormatLocale: "ko",
  isNsfw: true,
  hasCloudflare: false,
  sourceCodeUrl: "https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/novel/src/ko/ntk_novel.js",
  apiUrl: "",
  version: "0.301",
  isManga: false,
  itemType: 2,
  isFullData: false,
  appMinVerReq: "0.5.0",
  additionalParams: "",
  sourceCodeLanguage: 1,
  notes: "Legacy Popular and Latest are implemented. Search, filters, detail, chapters, and reader are not implemented.",
  pkgPath: "novel/src/ko/ntk_novel.js",
}];

function normalizeNovelWorkLink(value, baseUrl) {
  const candidate = typeof value === "string" ? value.trim() : "";
  const invalid = () => { throw new Error("NTK Novel invalid work link"); };
  if (
    !candidate ||
    candidate.includes("?") ||
    candidate.includes("#") ||
    candidate.includes("\\") ||
    /%(?:2e|2f|5c)/i.test(candidate)
  ) invalid();
  const absolute = candidate.match(/^https:\/\/([^/?#]+)(\/[^?#]*)$/i);
  if (!absolute && (/^[a-z][a-z0-9+.-]*:/i.test(candidate) || candidate.startsWith("//") || !candidate.startsWith("/"))) invalid();
  const baseAuthority = String(baseUrl).replace(/^https:\/\//i, "").replace(/\/+$/, "").replace(/:443$/i, "").toLowerCase();
  if (absolute && absolute[1].replace(/:443$/i, "").toLowerCase() !== baseAuthority) invalid();
  const path = absolute ? absolute[2] : candidate;
  const match = path.match(/^\/novel\/(\d+)$/);
  if (!match) invalid();
  return `/novel/${match[1]}`;
}

const NOVEL_LIST_METHODS = {
  supportsLatest() { return true; },
  async getPopular() { return { list: [], hasNextPage: false }; },
  async getLatestUpdates() { return { list: [], hasNextPage: false }; },
};

class DefaultExtension extends MProvider {
  constructor() { super(); this.client = new Client(); }
  get supportsLatest() { return NOVEL_LIST_METHODS.supportsLatest.call(this); }
  getLegacyDomainNumber() {
    const configured = new SharedPreferences().get(LEGACY_DOMAIN_NUMBER_PREFERENCE);
    const value = String(configured ?? "").trim() || LEGACY_DEFAULT_DOMAIN_NUMBER;
    if (!/^\d+$/.test(value)) throw new Error("Invalid Legacy domain number preference");
    return value;
  }
  getLegacyBaseUrl() { return `https://newtoki${this.getLegacyDomainNumber()}.org`; }
  getHeaders() {
    return {
      Referer: `${this.getLegacyBaseUrl()}/`,
      "User-Agent": "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    };
  }
  normalizeWorkLink(value) { return normalizeNovelWorkLink(value, this.getLegacyBaseUrl()); }
  async getPopular(page) { return NOVEL_LIST_METHODS.getPopular.call(this, page); }
  async getLatestUpdates(page) { return NOVEL_LIST_METHODS.getLatestUpdates.call(this, page); }
  getSourcePreferences() {
    return [{
      key: LEGACY_DOMAIN_NUMBER_PREFERENCE,
      editTextPreference: {
        title: "Legacy domain number",
        summary: "Enter only the number after newtoki.",
        value: LEGACY_DEFAULT_DOMAIN_NUMBER,
        dialogTitle: "Legacy domain number",
        dialogMessage: "Example: 1 for https://newtoki1.org",
      },
    }];
  }
}

const NOVEL_TEST_EXPORTS = { normalizeNovelWorkLink };
```

- [ ] **Step 5: Source shell 통과 확인**

Run:

```powershell
node --test tests/novel/source-shell.test.js
node --check javascript/novel/src/ko/ntk_novel.js
```

Expected: 모든 Source shell 테스트 PASS, syntax check exit 0.

---

### Task 2: 분기 이전 목록 유틸리티 차등 이식

**Files:**
- Create: `tests/novel/historical/pre-split-list-utilities.test.js`
- Modify: `javascript/novel/src/ko/ntk_novel.js`

**Interfaces:**
- Produces: `trimSlash(value): string`
- Produces: `joinUrl(baseUrl, path): string`
- Produces: `appendQuery(url, params): string`
- Produces: `absoluteUrl(baseUrl, value): string`

- [ ] **Step 1: 기존/신규 함수 차등 테스트 작성**

기존 `ntk.js`를 VM에 로드해 허용된 네 함수를 직접 export하고, 신규 helper와 같은 입력을 비교한다.

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { loadNovelSource } = require("../helpers/load-novel-source");

function loadPreSplitUtilities() {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "..", "javascript", "manga", "src", "ko", "ntk.js"),
    "utf8",
  );
  const context = vm.createContext({ module: { exports: {} }, String, Object, Array, RegExp, encodeURIComponent });
  vm.runInContext(
    `${source}\n;module.exports = { trimSlash, joinUrl, appendQuery, absoluteUrl };`,
    context,
  );
  return context.module.exports;
}

test("keeps stage-scoped pre-split URL utility behavior", () => {
  const legacy = loadPreSplitUtilities();
  const { helpers: next } = loadNovelSource();
  assert.equal(next.trimSlash("https://newtoki1.org///"), legacy.trimSlash("https://newtoki1.org///"));
  assert.equal(next.joinUrl("https://newtoki1.org/", "/novel"), legacy.joinUrl("https://newtoki1.org/", "/novel"));
  assert.equal(
    next.appendQuery("https://newtoki1.org/novel", { kind: "novel", page: 2, empty: "" }),
    legacy.appendQuery("https://newtoki1.org/novel", { kind: "novel", page: 2, empty: "" }),
  );
  assert.equal(next.absoluteUrl("https://newtoki1.org", "/cover.jpg"), legacy.absoluteUrl("https://newtoki1.org", "/cover.jpg"));
});
```

- [ ] **Step 2: 실패 확인**

Run:

```powershell
node --test tests/novel/historical/pre-split-list-utilities.test.js
```

Expected: 신규 helper가 정의되지 않아 FAIL.

- [ ] **Step 3: 허용된 네 함수 원형 복사**

`ntk.js`의 `trimSlash`, `joinUrl`, `appendQuery`, `absoluteUrl` 함수 본문을 동작 변경 없이 `ntk_novel.js`로 복사하고 `NOVEL_TEST_EXPORTS`에 추가한다.

```js
const NOVEL_TEST_EXPORTS = {
  absoluteUrl,
  appendQuery,
  joinUrl,
  normalizeNovelWorkLink,
  trimSlash,
};
```

- [ ] **Step 4: 차등 테스트 통과 확인**

Run:

```powershell
node --test tests/novel/historical/pre-split-list-utilities.test.js
```

Expected: PASS.

- [ ] **Step 5: 역사적 동등성 체크포인트 커밋**

Run:

```powershell
git add -- javascript/novel/src/ko/ntk_novel.js tests/novel/helpers/load-novel-source.js tests/novel/source-shell.test.js tests/novel/historical/pre-split-list-utilities.test.js
git diff --cached --check
git commit -m "test: freeze legacy novel list baseline"
```

Expected: 공개 manifest를 바꾸지 않는 baseline 커밋 생성.

---

### Task 3: Legacy Novel 카드 DOM과 목록 parser

**Files:**
- Create: `tests/novel/helpers/test-document.js`
- Create: `tests/novel/fixtures/lists/legacy-list-page.html`
- Create: `tests/novel/fixtures/lists/legacy-list-last-page.html`
- Create: `tests/novel/fixtures/lists/legacy-list-empty.html`
- Create: `tests/novel/lists/legacy-popular.test.js`
- Create: `tests/novel/lists/legacy-latest.test.js`
- Modify: `javascript/novel/src/ko/ntk_novel.js`

**Interfaces:**
- Produces: `NOVEL_LIST_METHODS.buildListUrl(page, pub, sort): string`
- Produces: `NOVEL_LIST_METHODS.parseListPage(body, page, pub, sort): {list, hasNextPage}`
- Produces: `DefaultExtension.getPopular(page): Promise<{list, hasNextPage}>`
- Produces: `DefaultExtension.getLatestUpdates(page): Promise<{list, hasNextPage}>`

- [ ] **Step 1: Novel 전용 test DOM helper 작성**

`tests/manhwa/lists/test-document.js`의 139줄 범용 parser를 Novel 테스트 폴더에 복사한다. `parseCompoundSelector()`만 ID를 지원하도록 다음 구현으로 교체한다.

```js
function parseCompoundSelector(selector) {
  const match = selector.match(/^([a-z][a-z0-9-]*)?(#[a-z0-9_-]+)?((?:\.[a-z0-9_-]+)*)$/i);
  if (!match) throw new Error(`Unsupported test selector: ${selector}`);
  return {
    tag: match[1]?.toLowerCase() ?? "",
    id: match[2]?.slice(1) ?? "",
    classes: match[3].split(".").filter(Boolean),
  };
}

function matchesCompound(node, compound) {
  if (compound.tag && node.tag !== compound.tag) return false;
  if (compound.id && node.attributes.id !== compound.id) return false;
  const classes = new Set((node.attributes.class ?? "").split(/\s+/).filter(Boolean));
  return compound.classes.every((className) => classes.has(className));
}
```

- [ ] **Step 2: 고정 fixture 작성**

`legacy-list-page.html`은 현재 Legacy DOM의 최소 형태를 보존한다.

```html
<div class="list-wrap">
  <ul id="webtoon-list-all" class="list">
    <li date-title="인기 작품 1">
      <div class="list-item"><div class="imgframe"><div class="img-item">
        <a href="/novel/35155"><img class="theme-thumb-img" src="/covers/35155.webp"></a>
        <div class="in-lable"><a href="/novel/35155"><span class="title white">인기 작품 1</span></a></div>
      </div></div></div>
    </li>
    <li date-title="표지 없는 작품">
      <div class="list-item"><div class="imgframe"><div class="img-item">
        <a href="/novel/60079"><span class="theme-novel-thumb-placeholder"></span></a>
        <img class="platform-logo" src="/logos/platform.png">
        <div class="in-lable"><a href="/novel/60079"><span class="title white">표지 없는 작품</span></a></div>
      </div></div></div>
    </li>
    <li date-title="인기 작품 1">
      <div class="list-item"><div class="imgframe"><div class="img-item">
        <a href="/novel/35155"><img class="theme-thumb-img" src="/covers/duplicate.webp"></a>
        <div class="in-lable"><a href="/novel/35155"><span class="title white">인기 작품 1</span></a></div>
      </div></div></div>
    </li>
  </ul>
</div>
<div class="list-page"><ul class="pagination pagination-desktop">
  <li class="active"><a>1</a></li>
  <li><a href="/novel?sod=desc&amp;page=2&amp;kind=novel&amp;sst=as_view&amp;pub=all">2</a></li>
</ul></div>
```

`legacy-list-last-page.html`에는 한 개의 정상 카드와 현재 page만 둔다. `legacy-list-empty.html`은 `.list-wrap .wr-none`만 포함하고 `#webtoon-list-all`은 포함하지 않는다.

- [ ] **Step 3: Popular/Latest 실패 테스트 작성**

두 테스트 파일에서 다음을 검증한다.

```js
test("builds the fixed Legacy Popular query", async () => {
  const stop = new Error("stop after request");
  const { extension, requests } = loadNovelSource({ responses() { throw stop; } });
  await assert.rejects(() => extension.getPopular(1), stop);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/novel");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    kind: "novel", page: "1", pub: "all", sod: "desc", sst: "as_view",
  });
});

test("builds the fixed Legacy Latest query", async () => {
  const stop = new Error("stop after request");
  const { extension, requests } = loadNovelSource({ responses() { throw stop; } });
  await assert.rejects(() => extension.getLatestUpdates(1), stop);
  const url = new URL(requests[0].url);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    kind: "novel", page: "1", pub: "ongoing", sod: "desc", sst: "as_update",
  });
});

test("keeps DOM order, removes duplicate works, and never uses platform logos", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("legacy-list-page.html"))],
  });
  const result = plain(await extension.getPopular(1));
  assert.deepEqual(result, {
    list: [
      { name: "인기 작품 1", link: "/novel/35155", imageUrl: "https://newtoki1.org/covers/35155.webp" },
      { name: "표지 없는 작품", link: "/novel/60079", imageUrl: "" },
    ],
    hasNextPage: true,
  });
});

test("accepts only an explicit empty list marker", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("legacy-list-empty.html"))],
  });
  assert.deepEqual(plain(await extension.getPopular(1)), { list: [], hasNextPage: false });
});

test("rejects malformed pages instead of returning an empty success", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("<main>maintenance</main>")],
  });
  await assert.rejects(() => extension.getPopular(1), /Popular.*structure/i);
});
```

추가 테스트는 page 0/음수/소수/문자열, HTTP 503, JSON content-type, 제목 누락, 숫자가 아닌 Novel link, query 순서가 다른 다음 페이지, 마지막 페이지를 각각 검증한다.

- [ ] **Step 4: 목록 테스트 실패 확인**

Run:

```powershell
node --test tests/novel/lists/legacy-popular.test.js tests/novel/lists/legacy-latest.test.js
```

Expected: 빈 목록 stub 또는 미정의 parser 때문에 FAIL.

- [ ] **Step 5: Legacy 목록 최소 구현**

`NOVEL_LIST_METHODS`를 다음 책임으로 교체한다.

```js
const NOVEL_LIST_METHODS = {
  supportsLatest() { return true; },
  responseHeader(response, name) {
    const headers = response?.headers;
    if (!headers) return "";
    if (typeof headers.get === "function") return String(headers.get(name) ?? headers.get(name.toLowerCase()) ?? "");
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    return key ? String(headers[key] ?? "") : "";
  },
  assertPage(page) {
    if (!Number.isInteger(page) || page < 1) throw new Error("NTK Novel invalid page");
  },
  assertHtmlResponse(response, feature) {
    const status = Number(response?.statusCode ?? response?.status ?? 0);
    if (status < 200 || status >= 300) throw new Error(`NTK Novel ${feature} HTTP failure status=${status}`);
    if (!this.responseHeader(response, "content-type").toLowerCase().includes("text/html")) {
      throw new Error(`NTK Novel ${feature} response is not HTML`);
    }
  },
  buildListUrl(page, pub, sort) {
    NOVEL_LIST_METHODS.assertPage(page);
    return appendQuery(joinUrl(this.getLegacyBaseUrl(), "/novel"), {
      kind: "novel", page, pub, sod: "desc", sst: sort,
    });
  },
  parseListPage(body, page, pub, sort, feature) {
    const document = new Document(body);
    const rows = document.select("#webtoon-list-all > li");
    const empty = document.select(".list-wrap .wr-none").length > 0;
    if (rows.length === 0) {
      if (empty) return { list: [], hasNextPage: false };
      throw new Error(`NTK Novel ${feature} structure is missing`);
    }

    const list = [];
    const seen = new Set();
    for (const row of rows) {
      const titleElement = row.selectFirst("span.title.white");
      const linkElement = row.selectFirst(".img-item > a");
      const name = String(titleElement?.text ?? "").trim();
      const rawLink = String(linkElement?.attr("href") ?? "").trim();
      if (!name || !rawLink) throw new Error(`NTK Novel malformed ${feature} card`);
      let link;
      try { link = this.normalizeWorkLink(rawLink); } catch (_) { throw new Error(`NTK Novel malformed ${feature} card`); }
      if (seen.has(link)) continue;
      seen.add(link);
      const cover = row.selectFirst("img.theme-thumb-img");
      const rawCover = String(cover?.attr("src") ?? "").trim();
      list.push({ name, link, imageUrl: rawCover ? absoluteUrl(this.getLegacyBaseUrl(), rawCover) : "" });
    }

    const nextPage = String(page + 1);
    const hasNextPage = document.select(".pagination-desktop a").some((anchor) => {
      const href = String(anchor.attr("href") ?? "").replace(/&amp;/g, "&");
      if (!href.startsWith("/novel?")) return false;
      const query = {};
      for (const pair of href.slice(href.indexOf("?") + 1).split("&")) {
        if (!pair) continue;
        const separator = pair.indexOf("=");
        const key = decodeURIComponent(separator < 0 ? pair : pair.slice(0, separator));
        const value = decodeURIComponent(separator < 0 ? "" : pair.slice(separator + 1));
        if (Object.prototype.hasOwnProperty.call(query, key)) return false;
        query[key] = value;
      }
      return query.kind === "novel" && query.page === nextPage && query.pub === pub && query.sod === "desc" && query.sst === sort;
    });
    return { list, hasNextPage };
  },
  async requestList(page, pub, sort, feature) {
    const response = await this.client.get(this.buildListUrl.call(this, page, pub, sort), this.getHeaders());
    NOVEL_LIST_METHODS.assertHtmlResponse(response, feature);
    return NOVEL_LIST_METHODS.parseListPage.call(this, response.body, page, pub, sort, feature);
  },
  async getPopular(page) { return NOVEL_LIST_METHODS.requestList.call(this, page, "all", "as_view", "Popular"); },
  async getLatestUpdates(page) { return NOVEL_LIST_METHODS.requestList.call(this, page, "ongoing", "as_update", "Latest"); },
};
```

- [ ] **Step 6: 목록 테스트와 Source shell 재검증**

Run:

```powershell
node --test tests/novel/source-shell.test.js tests/novel/historical/pre-split-list-utilities.test.js tests/novel/lists/legacy-popular.test.js tests/novel/lists/legacy-latest.test.js
```

Expected: 모두 PASS.

---

### Task 4: 0.301 manifest와 문서 공개

**Files:**
- Create: `tests/novel/index-entry.test.js`
- Modify: `index.json`
- Modify: `tests/ntk.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: `mangayomiSources[0]` from `ntk_novel.js`
- Produces: 설치 가능한 public Novel entry `260713003` version `0.301`

- [ ] **Step 1: public manifest 실패 테스트 작성**

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { loadNovelSource } = require("./helpers/load-novel-source");

const root = path.resolve(__dirname, "..", "..");

function assertNovelMetadata(source) {
  assert.equal(source.id, 260713003);
  assert.equal(source.name, "NTK Novel");
  assert.equal(source.baseUrl, "https://newtoki1.org");
  assert.equal(source.version, "0.301");
  assert.equal(source.itemType, 2);
  assert.equal(source.isManga, false);
  assert.equal(source.isNsfw, true);
  assert.equal(source.additionalParams, "");
  assert.match(source.sourceCodeUrl, /\/javascript\/novel\/src\/ko\/ntk_novel\.js$/);
  assert.match(source.notes, /Popular.*Latest/i);
  assert.match(source.notes, /Search.*not implemented/i);
}

test("publishes exactly one current Novel entry", () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
  const candidates = index.filter((source) => source.id === 240710003 || source.id === 260713003);
  assert.equal(candidates.length, 1);
  assertNovelMetadata(candidates[0]);
});

test("keeps embedded metadata aligned with index.json", () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
  const published = index.find((source) => source.id === 260713003);
  const { sources } = loadNovelSource();
  assertNovelMetadata(published);
  assert.deepEqual(sources[0], { ...published, pkgPath: "novel/src/ko/ntk_novel.js" });
});
```

- [ ] **Step 2: manifest 실패 확인**

Run:

```powershell
node --test tests/novel/index-entry.test.js
```

Expected: 기존 ID `240710003`과 `0.3.7` 때문에 FAIL.

- [ ] **Step 3: `index.json`을 신규 Novel entry로 교체**

기존 Novel 객체 하나만 다음 값으로 교체한다. Webtoon과 Manhwa 객체는 변경하지 않는다.

```json
{
  "name": "NTK Novel",
  "id": 260713003,
  "baseUrl": "https://newtoki1.org",
  "lang": "ko",
  "typeSource": "single",
  "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://newtoki1.org",
  "dateFormat": "yy.MM.dd",
  "dateFormatLocale": "ko",
  "isNsfw": true,
  "hasCloudflare": false,
  "sourceCodeUrl": "https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/novel/src/ko/ntk_novel.js",
  "apiUrl": "",
  "version": "0.301",
  "isManga": false,
  "itemType": 2,
  "isFullData": false,
  "appMinVerReq": "0.5.0",
  "additionalParams": "",
  "sourceCodeLanguage": 1,
  "notes": "Legacy Popular and Latest are implemented. Search, filters, detail, chapters, and reader are not implemented."
}
```

- [ ] **Step 4: 기존 manifest 테스트 기대값 수정**

`tests/ntk.test.js`의 저장소 manifest 검증만 다음으로 갱신한다.

```js
assert.deepEqual(index.map((source) => source.version), ["0.109", "0.207", "0.301"]);
assert.deepEqual(index.map((source) => source.additionalParams), ["", "", ""]);
assert.equal(novel.id, 260713003);
assert.equal(novel.baseUrl, "https://newtoki1.org");
assert.equal(novel.isNsfw, true);
assert.match(novel.sourceCodeUrl, /\/javascript\/novel\/src\/ko\/ntk_novel\.js$/);
```

기존 `ntk.js` embedded 3-source 배열과 새 public index 전체가 같다고 요구하는 테스트는 Webtoon/Manhwa 과거 호환 테스트로 축소한다. 새 Novel metadata는 `tests/novel/index-entry.test.js`가 담당한다.

- [ ] **Step 5: README 범위 수정**

README의 포함 항목과 reader 설명을 다음 사실에 맞춘다.

```markdown
- `NTK Novel` uses the independent Legacy source at `javascript/novel/src/ko/ntk_novel.js`.
- Version `0.301` implements Popular and Latest only.
- Search, filters, detail, chapters, and the Novel reader remain intentionally unavailable until their staged releases.
```

과거 `NTK Novel` 리더가 현재 공개 source에서 동작한다고 단정하는 문장은 제거한다.

- [ ] **Step 6: manifest·전체 테스트 통과 확인**

Run:

```powershell
node --test tests/novel/index-entry.test.js tests/ntk.test.js
npm test
node --check javascript/novel/src/ko/ntk_novel.js
git diff --check
```

Expected: 모든 테스트 PASS, syntax/diff check exit 0.

---

### Task 5: 리뷰, 0.301 커밋, master 푸시

**Files:**
- Review: `javascript/novel/src/ko/ntk_novel.js`
- Review: `tests/novel/**`
- Review: `index.json`
- Review: `tests/ntk.test.js`
- Review: `README.md`

**Interfaces:**
- Produces: GitHub raw URL에서 설치 가능한 `NTK Novel 0.301`

- [ ] **Step 1: 변경 범위 검토**

Run:

```powershell
git status --short
git diff --stat
git diff -- javascript/novel/src/ko/ntk_novel.js tests/novel index.json tests/ntk.test.js README.md
```

Expected: 지정 파일만 변경되고 `node_modules/`, `pnpm-lock.yaml`, `resource/`는 diff에 없음.

- [ ] **Step 2: 보안·오류 계약 검토**

다음을 직접 확인한다.

- 외부 origin과 query/fragment가 붙은 작품 link 거부
- HTTP/비 HTML/구조 없음/명시적 empty 구분
- malformed card를 빈 성공이나 부분 성공으로 바꾸지 않음
- 표지가 없을 때 플랫폼 로고를 대신 사용하지 않음
- 오류에 HTML body나 설정값 전체를 넣지 않음
- 검색·상세·회차·리더 구현을 notes에서 주장하지 않음

- [ ] **Step 3: 최종 검증 재실행**

Run:

```powershell
npm test
node --check javascript/novel/src/ko/ntk_novel.js
git diff --check
```

Expected: 전체 PASS.

- [ ] **Step 4: 0.301 공개 커밋**

Run:

```powershell
git add -- javascript/novel/src/ko/ntk_novel.js tests/novel index.json tests/ntk.test.js README.md
git diff --cached --check
git commit -m "feat: publish legacy novel lists"
```

Expected: `0.301` 기능·manifest·문서가 한 커밋에 포함됨.

- [ ] **Step 5: 푸시 직전 확인 후 master 푸시**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -5
git push origin master
```

Expected: push 성공, `master...origin/master` 동기화. 기존 미추적 세 항목은 그대로 남아도 된다.

- [ ] **Step 6: 사용자 설치 검증 인계**

사용자에게 다음을 전달한다.

- repository URL: `https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/index.json`
- 설치 대상: `NTK Novel 0.301`
- 확인 항목: Popular 제목/표지/페이지 이동, Latest 제목/표지/페이지 이동, 숫자형 Legacy 도메인 설정
- 미구현 확인: 검색, 상세, 회차, 리더는 아직 `0.301` 범위가 아님

사용자의 앱이나 실기기를 대신 조작하지 않는다.
