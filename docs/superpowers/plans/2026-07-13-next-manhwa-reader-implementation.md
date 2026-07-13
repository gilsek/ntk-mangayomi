# Next Manhwa Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe WebView-backed image reader to the independent NTK Manhwa source and publish it as version 0.207.

**Architecture:** Keep a dedicated `MANHWA_READER_METHODS` boundary inside `ntk_manhwa.js`. The extractor lets the live Next viewer create its session proof and browser-key signature, intercepts successful `/api/manhwa-images` responses, and retains a strict viewer-DOM fallback. `DefaultExtension.getPageList()` only delegates to this Manhwa-specific boundary.

**Tech Stack:** Mangayomi JavaScript extensions, Node.js `node:test`, `vm`, Flutter InAppWebView bridge supplied by the existing modified client.

## Global Constraints

- Work on the user-designated `master` deployment branch; do not create a feature branch or PR.
- Do not modify the Mangayomi client in this task.
- Do not share or refactor the Webtoon parser or reader helper into Manhwa.
- Keep Popular, Latest, search, filters, detail, and episode-list behavior unchanged.
- Keep the one persistent `Client` instance.
- Return image URLs only; do not download image bytes in `getPageList()`.
- Publish NTK Manhwa as version `0.207` only after all automated checks pass.

---

### Task 1: Manhwa Reader Test Harness and RED Contract

**Files:**
- Modify: `tests/manhwa/helpers/load-manhwa-source.js`
- Create: `tests/manhwa/reader/next-reader.test.js`
- Modify: `tests/manhwa/source-shell.test.js`

**Interfaces:**
- Consumes: `loadManhwaSource({ preferences, responses, DocumentClass })`.
- Produces: `loadManhwaSource({ webview })`, exposing the injected function to the extension VM as `evaluateJavascriptViaWebview`.
- Tests the desired production interfaces `createNextReaderImageExtractorScript(readerPath)`, `parseNextWebviewImageResponse(payload, readerPath)`, and `getPageList(url)`.

- [ ] **Step 1: Extend the loader with an optional WebView bridge**

```js
function loadManhwaSource({
  preferences = {},
  responses,
  DocumentClass = EmptyDocument,
  webview,
} = {}) {
  // existing setup
  context = vm.createContext({
    Client: TestClient,
    Document: DocumentClass,
    MProvider: TestProvider,
    SharedPreferences: TestPreferences,
    evaluateJavascriptViaWebview: webview,
    console,
  });
}
```

- [ ] **Step 2: Write the failing reader contract tests**

Create tests that call the real extension VM and assert:

```js
test("opens the exact Next Manhwa episode URL and preserves image order", async () => {
  const calls = [];
  const { extension } = loadManhwaSource({
    webview: async (url, headers, scripts) => {
      calls.push({ url, headers, scripts });
      return JSON.stringify({
        ok: true,
        images: [
          "https://cdn.example/001.webp",
          "",
          "https://cdn.example/001.webp",
          "https://cdn.example/002.webp",
        ],
      });
    },
  });

  const pages = JSON.parse(JSON.stringify(
    await extension.getPageList("/manhwa/u-work/u-episode"),
  ));

  assert.equal(calls[0].url, "https://sbxh9.com/manhwa/u-work/u-episode");
  assert.equal(calls[0].scripts.length, 1);
  assert.match(calls[0].scripts[0], /\/api\/manhwa-images/);
  assert.match(calls[0].scripts[0], /\.viewer-lazy-img/);
  assert.deepEqual(pages.map((page) => page.url), [
    "https://cdn.example/001.webp",
    "https://cdn.example/002.webp",
  ]);
});
```

Add separate tests for one header object reused by WebView and pages, missing bridge, malformed payload, empty payload, WebView rejection, same-origin absolute URL normalization, cross-origin rejection, rejection of every query or fragment, and absence of secret data in errors.

- [ ] **Step 3: Replace the old unimplemented-reader assertion**

Keep the persistent-client assertion but change the old `reader is not implemented` expectation to the new missing-WebView boundary:

```js
await assert.rejects(
  () => extension.getPageList("/manhwa/work/episode"),
  /WebView bridge unavailable.*parserFamily=next/i,
);
assert.equal(extension.client, client);
assert.equal(requests.length, 0);
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```powershell
node --test tests/manhwa/reader/next-reader.test.js tests/manhwa/source-shell.test.js
```

Expected: FAIL because `getPageList()` still throws `NTK Manhwa reader is not implemented` and the reader helper methods do not exist.

- [ ] **Step 5: Commit the RED contract with the later GREEN implementation, not separately**

Do not commit a deliberately failing tree. Preserve the observed RED output as the TDD checkpoint.

---

### Task 2: Independent Manhwa WebView Extractor

**Files:**
- Modify: `javascript/manga/src/ko/ntk_manhwa.js`
- Test: `tests/manhwa/reader/next-reader.test.js`

**Interfaces:**
- Produces: `MANHWA_READER_METHODS.createNextReaderImageExtractorScript(readerPath) -> string`.
- Produces: `MANHWA_READER_METHODS.parseNextWebviewImageResponse(payload, readerPath) -> string[]`.
- Produces: `MANHWA_READER_METHODS.getPageList(url) -> Promise<Array<{url:string, headers:Object}>>`.

- [ ] **Step 1: Add extractor behavior tests before production methods**

Execute the generated script with `vm.runInNewContext()` and assert these independent behaviors:

```js
await execution.window.fetch("/api/manhwa-images", { method: "POST" });
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(execution.responses[0].payload, {
  ok: true,
  images: [
    "https://cdn.example/001.webp",
    "https://cdn.example/002.webp",
  ],
});
```

Also assert that unrelated endpoints and invalid JSON leave DOM polling active, `ad_ack_required`, `fingerprint_required`, and `browser_key_required` re-announce the scoped acknowledgement, mismatched paths return a safe error, and a complete `.vw-imgs` container returns every `.viewer-lazy-img` exactly once in order.

- [ ] **Step 2: Run the extractor tests and verify RED**

Run:

```powershell
node --test tests/manhwa/reader/next-reader.test.js
```

Expected: FAIL because `createNextReaderImageExtractorScript` and `getPageList` are absent.

- [ ] **Step 3: Add the dedicated production boundary**

Add a new region before `DefaultExtension`:

```js
const MANHWA_READER_METHODS = {
  createNextReaderImageExtractorScript(readerPath) {
    return `(function () {
  if (window.__ntkManhwaReaderExtractor) return;
  window.__ntkManhwaReaderExtractor = true;
  var expectedPath = ${JSON.stringify(readerPath)};
  var finished = false;
  var timer = null;

  function respond(payload) {
    if (finished) return;
    finished = true;
    if (timer) window.clearInterval(timer);
    window.flutter_inappwebview.callHandler("setResponse", JSON.stringify(payload));
  }

  if (window.location.pathname !== expectedPath) {
    respond({ ok: false, error: "reader path mismatch" });
    return;
  }

  function signalAdAck() {
    window.__ntk_ad_ack_scope = expectedPath;
    try {
      window.dispatchEvent(new CustomEvent("ntk-ad-ack-ready", {
        detail: { scope: expectedPath },
      }));
    } catch (_) {}
  }

  function apiImages(payload) {
    if (!payload || !Array.isArray(payload.images)) return [];
    var seen = {};
    var images = [];
    for (var i = 0; i < payload.images.length; i += 1) {
      var image = payload.images[i];
      var url = typeof image === "string" ? image : image && image.src;
      if (typeof url !== "string" || !/^https?:\\/\\//i.test(url)) continue;
      if (seen[url]) continue;
      seen[url] = true;
      images.push(url);
    }
    return images;
  }

  if (typeof window.fetch === "function") {
    var originalFetch = window.fetch;
    window.fetch = function () {
      var fetchArguments = arguments;
      return originalFetch.apply(this, fetchArguments).then(function (response) {
        var input = fetchArguments[0];
        var url = input && input.url ? input.url : String(input || "");
        if (!/\\/api\\/manhwa-images(?:[?#]|$)/i.test(url)) return response;
        try {
          response.clone().text().then(function (text) {
            if (finished) return;
            try {
              var payload = JSON.parse(text);
              if (payload && /^(?:ad_ack_required|fingerprint_required|browser_key_required)$/.test(payload.error || "")) {
                signalAdAck();
                return;
              }
              var images = apiImages(payload);
              if (images.length) respond({ ok: true, images: images });
            } catch (_) {}
          }).catch(function () {});
        } catch (_) {}
        return response;
      });
    };
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("ntk-ack-rearm", function (event) {
      if (event && event.detail && event.detail.scope === expectedPath) signalAdAck();
    });
  }
  signalAdAck();

  function collect() {
    var container = document.querySelector(".vw-imgs");
    if (!container || !container.children.length) return false;
    var nodes = Array.prototype.slice.call(container.querySelectorAll(".viewer-lazy-img"));
    if (nodes.length !== container.children.length) return false;
    var seen = {};
    var images = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var url = node.currentSrc || node.getAttribute("src") || node.getAttribute("data-src") || "";
      if (!/^https?:\\/\\//i.test(url)) return false;
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
    var error = document.querySelector(".vw-empty");
    if (error) {
      respond({ ok: false, error: (error.textContent || "reader error").trim() });
      return;
    }
    if (attempts >= 100) respond({ ok: false, error: "timeout waiting for reader images" });
  }, 200);
})();`;
  },
};
```

- [ ] **Step 4: Add safe payload parsing and WebView orchestration**

Implement `parseNextWebviewImageResponse()` to accept string or object payloads, require `{ok:true, images:[...]}`, keep only unique absolute HTTP(S) strings in order, and throw a stable error without payload details. Implement `getPageList()` as:

```js
async getPageList(url) {
  const readerPath = this.normalizeChapterLink(url);
  if (typeof evaluateJavascriptViaWebview !== "function") {
    throw new Error(
      `Next Manhwa reader WebView bridge unavailable parserFamily=next url=${readerPath}`,
    );
  }
  const headers = this.getHeaders();
  let payload;
  try {
    payload = await evaluateJavascriptViaWebview(
      `${this.getNextBaseUrl()}${readerPath}`,
      headers,
      [this.createNextReaderImageExtractorScript(readerPath)],
    );
  } catch (_) {
    throw new Error(
      `Next Manhwa reader WebView failed parserFamily=next url=${readerPath}`,
    );
  }
  return this.parseNextWebviewImageResponse(payload, readerPath).map(
    (image) => ({ url: image, headers }),
  );
}
```

- [ ] **Step 5: Delegate through `DefaultExtension` without sharing Webtoon code**

```js
createNextReaderImageExtractorScript(readerPath) {
  return MANHWA_READER_METHODS.createNextReaderImageExtractorScript.call(
    this,
    readerPath,
  );
}

parseNextWebviewImageResponse(payload, readerPath) {
  return MANHWA_READER_METHODS.parseNextWebviewImageResponse.call(
    this,
    payload,
    readerPath,
  );
}

async getPageList(url) {
  return MANHWA_READER_METHODS.getPageList.call(this, url);
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/manhwa/reader/next-reader.test.js tests/manhwa/source-shell.test.js
```

Expected: all focused reader and source-shell tests pass.

- [ ] **Step 7: Run all Manhwa tests**

Run:

```powershell
$tests = @(rg --files tests/manhwa | Where-Object { $_ -like '*.test.js' })
node --test @tests
```

Expected: all Manhwa tests pass with the old unimplemented-reader case replaced by reader coverage.

---

### Task 3: Version 0.207, Full Validation, and Deployment

**Files:**
- Modify: `javascript/manga/src/ko/ntk_manhwa.js`
- Modify: `index.json`
- Modify: `tests/manhwa/index-entry.test.js`
- Modify: `tests/manhwa/source-shell.test.js`

**Interfaces:**
- Produces: one public NTK Manhwa entry with ID `260713002`, version `0.207`, and reader-complete notes.
- Preserves: source URL, base URL, numeric domain setting, NSFW flag, and all non-reader registrations.

- [ ] **Step 1: Write failing metadata expectations**

```js
assert.equal(manhwa.version, "0.207");
assert.match(manhwa.notes, /reader/i);
assert.match(manhwa.notes, /WebView/i);
assert.doesNotMatch(manhwa.notes, /reader image loading is not implemented/i);
```

- [ ] **Step 2: Run metadata tests and verify RED**

Run:

```powershell
node --test tests/manhwa/index-entry.test.js tests/manhwa/source-shell.test.js
```

Expected: FAIL because embedded and repository metadata still report `0.206` and an unimplemented reader.

- [ ] **Step 3: Update both metadata copies**

Set version to `0.207` and notes to:

```text
Popular, Latest, search, filters, detail, full episodes, and a WebView-backed reader with a Manhwa image API fast path and DOM fallback are implemented. Reader requires the modified Mangayomi WebView payload-preservation patch.
```

- [ ] **Step 4: Run metadata tests and verify GREEN**

Run the same focused metadata command and expect all tests to pass.

- [ ] **Step 5: Run complete automated validation**

```powershell
node --check javascript/manga/src/ko/ntk_manhwa.js
$manhwaTests = @(rg --files tests/manhwa | Where-Object { $_ -like '*.test.js' })
node --test @manhwaTests
pnpm test
git diff --check
```

Expected: JavaScript syntax valid, every Manhwa test passes, the complete repository suite passes, and `git diff --check` prints nothing.

- [ ] **Step 6: Review the exact deployment diff**

```powershell
git status --short
git diff --stat
git diff -- javascript/manga/src/ko/ntk_manhwa.js index.json tests/manhwa docs/superpowers
```

Confirm that no existing untracked `node_modules/`, `pnpm-lock.yaml`, or `resource/` content is staged.

- [ ] **Step 7: Commit and push master**

```powershell
git add docs/superpowers/specs/2026-07-13-next-manhwa-reader-design.md docs/superpowers/plans/2026-07-13-next-manhwa-reader-implementation.md javascript/manga/src/ko/ntk_manhwa.js index.json tests/manhwa
git commit -m "feat: add next manhwa reader"
git push origin master
```

- [ ] **Step 8: Verify public metadata propagation**

Fetch the raw GitHub `index.json` with a cache-busting query and confirm ID `260713002` reports `0.207` and the reader-complete notes.

- [ ] **Step 9: Hand off manual runtime validation**

Ask the user to refresh the Mangayomi repository, update NTK Manhwa to `0.207`, open one representative chapter on Windows and iPhone, and report first-list latency, first-image latency, subsequent-image speed, and any safe error text.
