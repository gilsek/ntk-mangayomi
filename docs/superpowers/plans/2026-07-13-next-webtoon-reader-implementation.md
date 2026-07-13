# Next Webtoon Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next Webtoon 회차를 수정 Mangayomi의 WebView에서 준비한 이미지 URL로 변환해 기본 세로 스크롤 리더에 표시한다.

**Architecture:** `ntk_webtoon.js`가 Next 회차 URL을 검증하고 해당 URL을 WebView로 직접 연다. 전용 스크립트가 `.viewer-lazy-img`의 URL을 DOM 순서대로 반환하며, 확장은 payload를 엄격히 검증해 Mangayomi 페이지 객체로 변환한다.

**Tech Stack:** Mangayomi JavaScript source API, `evaluateJavascriptViaWebview`, Flutter InAppWebView `setResponse` bridge, Node.js `node:test`.

## Global Constraints

- 구현 버전은 `0.107`이다.
- 루트 페이지 경유와 고정 3초 지연을 사용하지 않는다.
- 실행 즉시 DOM을 확인하고 이미지가 없을 때만 제한적으로 대기한다.
- 확장에서 세션, 광고 확인, nonce 또는 HMAC proof를 재현하지 않는다.
- Legacy Webtoon, Manhwa, Novel, Anime 코드를 수정하거나 공유하지 않는다.
- 과거 `ntk.js` 리더 코드를 호출하거나 복사하지 않는다.
- 토큰, 쿠키와 세션 값을 오류에 포함하지 않는다.
- 새 패키지나 의존성을 추가하지 않는다.

---

### Task 1: Next WebView reader contract

**Files:**
- Modify: `tests/webtoon/helpers/load-webtoon-source.js`
- Create: `tests/webtoon/next-reader.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`

**Interfaces:**
- Consumes: `evaluateJavascriptViaWebview(url, headers, scripts)` and `window.flutter_inappwebview.callHandler("setResponse", payload)`.
- Produces: `normalizeNextReaderLink(url)`, `createNextReaderImageExtractorScript(readerPath)`, `parseNextWebviewImageResponse(payload, readerPath)`, and `DefaultExtension.getPageList(url)` returning `Array<{url: string, headers: object}>`.

- [ ] **Step 1: Extend the test harness and write failing reader tests**

Add an optional `webview` callback to `loadWebtoonSource` and expose it in the VM only when provided:

```js
function loadWebtoonSource({
  body = '<div class="wr-none">등록된 작품이 없습니다.</div>',
  preferences = {},
  statusCode = 200,
  headers = { "content-type": "text/html; charset=utf-8" },
  responses,
  webview,
} = {}) {
  const contextValues = {
    Client: TestClient,
    Document: TestDocument,
    MProvider: TestProvider,
    SharedPreferences: TestPreferences,
    console,
  };
  if (webview) contextValues.evaluateJavascriptViaWebview = webview;
  const context = vm.createContext(contextValues);
}
```

Create `tests/webtoon/next-reader.test.js` with the following imports and cases:

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

test("opens the exact Next episode URL and preserves image order", async () => {
  const calls = [];
  const { extension } = loadWebtoonSource({
    webview: async (url, headers, scripts) => {
      calls.push({ url, headers, scripts });
      return JSON.stringify({
        ok: true,
        images: [
          "https://cdn.example/001.jpg",
          "",
          "https://cdn.example/001.jpg",
          "https://cdn.example/002.jpg",
        ],
      });
    },
  });

  const pages = JSON.parse(JSON.stringify(
    await extension.getPageList("/webtoon/17970/u-mrezmrs1-hypr"),
  ));

  assert.equal(calls[0].url, "https://sbxh9.com/webtoon/17970/u-mrezmrs1-hypr");
  assert.equal(calls[0].scripts.length, 1);
  assert.match(calls[0].scripts[0], /\.viewer-lazy-img/);
  assert.doesNotMatch(calls[0].scripts[0], /3000/);
  assert.deepEqual(pages.map((page) => page.url), [
    "https://cdn.example/001.jpg",
    "https://cdn.example/002.jpg",
  ]);
});

test("rejects malformed links and invalid WebView payloads", async () => {
  const missingBridge = loadWebtoonSource().extension;
  await assert.rejects(
    () => missingBridge.getPageList("/webtoon/17970/u-mrezmrs1-hypr"),
    /WebView bridge unavailable.*parserFamily=next/i,
  );
  await assert.rejects(
    () => missingBridge.getPageList("/webtoon/17970"),
    /invalid reader link.*parserFamily=next/i,
  );

  for (const payload of ["not-json", JSON.stringify({ ok: false, error: "blocked" }), JSON.stringify({ ok: true, images: [] })]) {
    const { extension } = loadWebtoonSource({ webview: async () => payload });
    await assert.rejects(
      () => extension.getPageList("/webtoon/17970/u-mrezmrs1-hypr"),
      /Next Webtoon reader.*parserFamily=next/i,
    );
  }
});
```

- [ ] **Step 2: Run the reader tests and verify RED**

Run: `node --test tests/webtoon/next-reader.test.js`

Expected: FAIL because `getPageList()` and the WebView test binding do not exist.

- [ ] **Step 3: Implement the minimal Next reader**

Add isolated Next helpers to `ntk_webtoon.js`. The reader link must contain exactly `/webtoon/{workId}/{episodeId}` after removing query and fragment. The extractor script must:

```js
(function () {
  if (window.__ntkWebtoonReaderExtractor) return;
  window.__ntkWebtoonReaderExtractor = true;
  var finished = false;
  var timer = null;

  function respond(payload) {
    if (finished) return;
    finished = true;
    if (timer) window.clearInterval(timer);
    window.flutter_inappwebview.callHandler(
      "setResponse",
      JSON.stringify(payload),
    );
  }

  function collect() {
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll(".viewer-lazy-img"),
    );
    if (!nodes.length) return false;
    var seen = {};
    var images = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var url = node.currentSrc || node.getAttribute("src") || node.getAttribute("data-src") || "";
      if (!/^https?:\/\//i.test(url)) return false;
      if (!seen[url]) {
        seen[url] = true;
        images.push(url);
      }
    }
    if (!images.length) return false;
    respond({ ok: true, images: images });
    return true;
  }

  if (collect()) return;
  var attempts = 0;
  timer = window.setInterval(function () {
    attempts += 1;
    if (collect()) return;
    var error = document.querySelector(".vw-empty, .novel-loading");
    if (error) {
      respond({ ok: false, error: (error.textContent || "reader error").trim() });
      return;
    }
    if (attempts >= 100) {
      respond({ ok: false, error: "timeout waiting for reader images" });
    }
  }, 200);
})();
```

`getPageList()` must call the WebView once with the exact absolute reader URL, parse a string or already-decoded object payload, retain only unique HTTP(S) URLs in order, and return page objects with `this.getHeaders()`. Legacy must throw its existing not-implemented error rather than fall through to Next.

- [ ] **Step 4: Run the reader tests and verify GREEN**

Run: `node --test tests/webtoon/next-reader.test.js`

Expected: all reader tests PASS.

- [ ] **Step 5: Run Webtoon regression tests**

Run: `node --test tests/webtoon/*.test.js`

Expected: all Webtoon tests PASS with no uncaught warnings.

- [ ] **Step 6: Commit the reader behavior**

```bash
git add tests/webtoon/helpers/load-webtoon-source.js tests/webtoon/next-reader.test.js javascript/manga/src/ko/ntk_webtoon.js
git commit -m "feat: add next webtoon reader"
```

---

### Task 2: Release metadata 0.107

**Files:**
- Modify: `tests/webtoon/index-entry.test.js`
- Modify: `tests/webtoon/next-popular-request.test.js`
- Modify: `tests/ntk.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`
- Modify: `index.json`

**Interfaces:**
- Consumes: completed Next `getPageList()` behavior from Task 1.
- Produces: repository and embedded source metadata with version `0.107` and notes stating that the Next reader is implemented.

- [ ] **Step 1: Change metadata assertions first**

Update all Webtoon version assertions from `0.106` to `0.107`. Replace `reader is not implemented` assertions with assertions that notes contain `detail`, `full episode lists`, and `reader` without `not implemented`.

- [ ] **Step 2: Run metadata tests and verify RED**

Run: `node --test tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/ntk.test.js`

Expected: FAIL because source and index metadata still report `0.106` and the old reader note.

- [ ] **Step 3: Update source and index metadata**

Set both metadata copies to:

```js
version: "0.107",
notes: "Next Popular, Latest, title search, filters, detail, full episode lists, and WebView-backed reader with platform-safe covers.",
```

- [ ] **Step 4: Run metadata tests and verify GREEN**

Run: `node --test tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/ntk.test.js`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit release metadata**

```bash
git add tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/ntk.test.js javascript/manga/src/ko/ntk_webtoon.js index.json
git commit -m "chore: release next webtoon reader"
```

---

### Task 3: Final validation and publication

**Files:**
- Verify only: all tracked project files

**Interfaces:**
- Consumes: Task 1 reader and Task 2 metadata.
- Produces: validated `master` commits available through the existing raw GitHub repository URL.

- [ ] **Step 1: Run the complete test suite**

Run: `pnpm test`

Expected: every test PASS.

- [ ] **Step 2: Check repository consistency**

Run: `git diff --check && git status --short --branch`

Expected: no tracked uncommitted changes; only the pre-existing untracked `node_modules/`, `pnpm-lock.yaml`, and `resource/` remain.

- [ ] **Step 3: Push master**

Run: `git push origin master`

Expected: the two implementation commits and plan/spec commits are pushed without force.

- [ ] **Step 4: Verify raw publication**

Check that `https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/index.json` returns HTTP 200 and NTK Webtoon `0.107`, and that its `sourceCodeUrl` returns a source containing the same version.

- [ ] **Step 5: Request device validation**

Ask the user to refresh the repository, update NTK Webtoon to `0.107`, reset only the source database if the client keeps stale code, and report first-image latency plus image count/order on the target iPhone or Android tablet.
