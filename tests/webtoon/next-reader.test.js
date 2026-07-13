const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
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

test("reuses one header object for WebView and all reader pages", async () => {
  let headerCalls = 0;
  const webviewHeaders = [];
  const { extension } = loadWebtoonSource({
    webview: async (_url, headers) => {
      webviewHeaders.push(headers);
      return {
        ok: true,
        images: [
          "https://cdn.example/001.jpg",
          "https://cdn.example/002.jpg",
          "https://cdn.example/003.jpg",
        ],
      };
    },
  });
  extension.getHeaders = () => {
    headerCalls += 1;
    return { "X-Test-Header": "reader" };
  };

  const pages = await extension.getPageList(
    "/webtoon/17970/u-mrezmrs1-hypr",
  );

  assert.equal(headerCalls, 1);
  assert.equal(webviewHeaders[0], pages[0].headers);
  assert.ok(pages.every((page) => page.headers === pages[0].headers));
});

function createImageNode(url) {
  return {
    currentSrc: url,
    getAttribute() {
      return "";
    },
  };
}

function runExtractor(extension, observations) {
  const responses = [];
  const intervals = [];
  const cleared = [];
  let observationIndex = 0;
  let activeObservation = null;
  const readerPath = "/webtoon/17970/u-mrezmrs1-hypr";

  function nextObservation() {
    activeObservation = observations[
      Math.min(observationIndex, observations.length - 1)
    ];
    observationIndex += 1;
    return activeObservation;
  }

  function imageNodes(observation) {
    return (observation.urls || []).map(createImageNode);
  }

  vm.runInNewContext(
    extension.createNextReaderImageExtractorScript(readerPath),
    {
      window: {
        location: { pathname: readerPath },
        setInterval(callback, milliseconds) {
          intervals.push({ callback, milliseconds });
          return 7;
        },
        clearInterval(timer) {
          cleared.push(timer);
        },
        flutter_inappwebview: {
          callHandler(name, payload) {
            responses.push({ name, payload: JSON.parse(payload) });
          },
        },
      },
      document: {
        querySelector(selector) {
          if (selector === ".vw-imgs") {
            const observation = nextObservation();
            if (observation.container === false) return null;
            return {
              children: new Array(observation.childCount),
              querySelectorAll() {
                return imageNodes(activeObservation);
              },
            };
          }
          if (
            selector.includes(".novel-loading")
            && activeObservation?.loading
          ) {
            return { textContent: "불러오는 중..." };
          }
          if (selector.includes(".vw-empty") && activeObservation?.empty) {
            return { textContent: "reader error" };
          }
          return null;
        },
      },
    },
  );

  return { responses, intervals, cleared };
}

function installApiFastPath(extension, responseText) {
  const responses = [];
  const intervals = [];
  const cleared = [];
  const events = [];
  const eventListeners = new Map();
  const fetchCalls = [];
  const readerPath = "/webtoon/17970/u-mrezmrs1-hypr";
  const window = {
    location: { pathname: readerPath },
    setInterval(callback, milliseconds) {
      intervals.push({ callback, milliseconds });
      return 7;
    },
    clearInterval(timer) {
      cleared.push(timer);
    },
    addEventListener(type, listener) {
      const listeners = eventListeners.get(type) || [];
      listeners.push(listener);
      eventListeners.set(type, listeners);
    },
    dispatchEvent(event) {
      events.push(event);
      for (const listener of eventListeners.get(event.type) || []) {
        listener(event);
      }
      return true;
    },
    async fetch(...args) {
      fetchCalls.push(args);
      return {
        clone() {
          return {
            async text() {
              return responseText;
            },
          };
        },
      };
    },
    flutter_inappwebview: {
      callHandler(name, payload) {
        responses.push({ name, payload: JSON.parse(payload) });
      },
    },
  };

  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  vm.runInNewContext(
    extension.createNextReaderImageExtractorScript(readerPath),
    {
      window,
      CustomEvent,
      document: {
        querySelector() {
          return null;
        },
      },
    },
  );

  return {
    window,
    readerPath,
    responses,
    intervals,
    cleared,
    events,
    fetchCalls,
  };
}

test("extractor returns image API URLs before the reader DOM is ready", async () => {
  const { extension } = loadWebtoonSource();
  const execution = installApiFastPath(extension, JSON.stringify({
    images: [
      { page: 1, src: "https://cdn.example/001.webp" },
      { page: 2, src: "https://cdn.example/002.webp" },
      { page: 3, src: "https://cdn.example/001.webp" },
      "https://cdn.example/003.webp",
      { page: 4, src: "javascript:invalid" },
    ],
  }));

  assert.equal(
    execution.window.__ntk_ad_ack_scope,
    execution.readerPath,
  );
  assert.deepEqual(
    execution.events.map((event) => ({
      type: event.type,
      scope: event.detail?.scope,
    })),
    [{ type: "ntk-ad-ack-ready", scope: execution.readerPath }],
  );
  assert.equal(execution.responses.length, 0);
  assert.equal(execution.intervals.length, 1);

  await execution.window.fetch("/api/webtoon-images", { method: "POST" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(execution.responses, [{
    name: "setResponse",
    payload: {
      ok: true,
      images: [
        "https://cdn.example/001.webp",
        "https://cdn.example/002.webp",
        "https://cdn.example/003.webp",
      ],
    },
  }]);
  assert.deepEqual(execution.cleared, [7]);
});

test("extractor leaves DOM fallback active for unrelated or invalid API data", async () => {
  const { extension } = loadWebtoonSource();
  const execution = installApiFastPath(extension, "not-json");

  await execution.window.fetch("/api/works");
  await execution.window.fetch("/api/webtoon-images", { method: "POST" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(execution.responses.length, 0);
  assert.equal(execution.intervals.length, 1);
  assert.deepEqual(execution.cleared, []);
});

test("extractor re-announces ad acknowledgement when the image API requests it", async () => {
  const { extension } = loadWebtoonSource();
  const execution = installApiFastPath(extension, JSON.stringify({
    error: "ad_ack_required",
  }));

  await execution.window.fetch("/api/webtoon-images", { method: "POST" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(execution.responses.length, 0);
  assert.deepEqual(
    execution.events.map((event) => event.type),
    ["ntk-ad-ack-ready", "ntk-ad-ack-ready"],
  );
});

test("extractor handles the reader ad acknowledgement rearm event", () => {
  const { extension } = loadWebtoonSource();
  const execution = installApiFastPath(extension, "{}");

  execution.window.__ntk_ad_ack_scope = "";
  execution.window.dispatchEvent({
    type: "ntk-ack-rearm",
    detail: { scope: execution.readerPath },
  });

  assert.equal(
    execution.window.__ntk_ad_ack_scope,
    execution.readerPath,
  );
  assert.deepEqual(
    execution.events.map((event) => event.type),
    ["ntk-ad-ack-ready", "ntk-ack-rearm", "ntk-ad-ack-ready"],
  );
});

test("extractor waits until every viewer container child is an image", () => {
  const { extension } = loadWebtoonSource();
  const first = "https://cdn.example/001.jpg";
  const second = "https://cdn.example/002.jpg";
  const third = "https://cdn.example/003.jpg";
  const execution = runExtractor(extension, [
    { childCount: 3, urls: [first] },
    { childCount: 3, urls: [first, second] },
    { childCount: 3, urls: [first, second, third] },
  ]);

  assert.equal(execution.intervals.length, 1);
  assert.equal(execution.intervals[0].milliseconds, 200);
  assert.equal(execution.responses.length, 0);

  execution.intervals[0].callback();
  assert.equal(execution.responses.length, 0);

  execution.intervals[0].callback();
  assert.deepEqual(execution.responses, [{
    name: "setResponse",
    payload: { ok: true, images: [first, second, third] },
  }]);
});

test("extractor immediately returns a complete viewer container once", () => {
  const { extension } = loadWebtoonSource();
  const images = [
    "https://cdn.example/001.jpg",
    "https://cdn.example/002.jpg",
  ];
  const execution = runExtractor(extension, [{
    childCount: 2,
    urls: images,
  }]);

  assert.deepEqual(execution.responses, [{
    name: "setResponse",
    payload: { ok: true, images },
  }]);
  assert.equal(execution.intervals.length, 0);
  assert.deepEqual(execution.cleared, []);
});

test("extractor waits for a container, matching child count, and valid URLs", () => {
  const { extension } = loadWebtoonSource();
  const first = "https://cdn.example/001.jpg";
  const second = "https://cdn.example/002.jpg";
  const execution = runExtractor(extension, [
    { container: false, childCount: 0, urls: [] },
    { childCount: 2, urls: [first] },
    { childCount: 2, urls: [first, ""] },
    { childCount: 2, urls: [first, second] },
  ]);

  execution.intervals[0].callback();
  assert.equal(execution.responses.length, 0);

  execution.intervals[0].callback();
  assert.equal(execution.responses.length, 0);

  execution.intervals[0].callback();

  assert.equal(execution.responses.length, 1);
  assert.deepEqual(execution.cleared, [7]);
});

test("extractor keeps waiting while the Next reader shows its loading state", () => {
  const { extension } = loadWebtoonSource();
  const images = [
    "https://cdn.example/001.jpg",
    "https://cdn.example/002.jpg",
  ];
  const execution = runExtractor(extension, [
    { container: false, loading: true },
    { container: false, loading: true },
    { childCount: 2, urls: images },
  ]);

  execution.intervals[0].callback();
  assert.equal(execution.responses.length, 0);

  execution.intervals[0].callback();
  assert.deepEqual(execution.responses, [{
    name: "setResponse",
    payload: { ok: true, images },
  }]);
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

test("does not expose WebView error details", async () => {
  const { extension } = loadWebtoonSource({
    webview: async () => JSON.stringify({
      ok: false,
      error: "token=secret session=secret",
    }),
  });

  await assert.rejects(
    () => extension.getPageList("/webtoon/17970/u-mrezmrs1-hypr"),
    (error) => {
      assert.equal(
        error.message,
        "Next Webtoon reader invalid response parserFamily=next url=/webtoon/17970/u-mrezmrs1-hypr",
      );
      assert.doesNotMatch(error.message, /secret|token=|session=/i);
      return true;
    },
  );
});

test("rejects invalid or cross-origin reader links without exposing input", async () => {
  const { extension } = loadWebtoonSource({ webview: async () => ({
    ok: true,
    images: ["https://cdn.example/001.jpg"],
  }) });
  const unsafeLinks = [
    "/webtoon/17970?token=secret#session=secret",
    "https://evil.example/webtoon/17970/episode?token=secret#session=secret",
  ];

  for (const link of unsafeLinks) {
    await assert.rejects(
      () => extension.getPageList(link),
      (error) => {
        assert.equal(
          error.message,
          "Next Webtoon invalid reader link parserFamily=next",
        );
        assert.doesNotMatch(error.message, /secret|token=|session=|evil\.example/i);
        return true;
      },
    );
  }
});

test("accepts same-origin absolute reader links and object payloads", async () => {
  const calls = [];
  const { extension } = loadWebtoonSource({
    webview: async (url) => {
      calls.push(url);
      return {
        ok: true,
        images: ["https://cdn.example/001.jpg"],
      };
    },
  });

  const pages = JSON.parse(JSON.stringify(await extension.getPageList(
    "https://sbxh9.com/webtoon/17970/u-mrezmrs1-hypr?token=secret#fragment",
  )));

  assert.deepEqual(calls, [
    "https://sbxh9.com/webtoon/17970/u-mrezmrs1-hypr",
  ]);
  assert.deepEqual(pages.map((page) => page.url), [
    "https://cdn.example/001.jpg",
  ]);
});

test("converts WebView rejection to a safe reader failure", async () => {
  const { extension } = loadWebtoonSource({
    webview: async () => {
      throw new Error("token=secret session=secret");
    },
  });

  await assert.rejects(
    () => extension.getPageList("/webtoon/17970/u-mrezmrs1-hypr"),
    (error) => {
      assert.equal(
        error.message,
        "Next Webtoon reader WebView failed parserFamily=next url=/webtoon/17970/u-mrezmrs1-hypr",
      );
      assert.doesNotMatch(error.message, /secret|token=|session=/i);
      return true;
    },
  );
});

test("extractor rejects a mismatched reader path without exposing paths", () => {
  const { extension } = loadWebtoonSource();
  const expectedPath = "/webtoon/17970/u-mrezmrs1-hypr";
  const actualPath = "/webtoon/17970/different-episode";
  const script = extension.createNextReaderImageExtractorScript(expectedPath);
  const responses = [];

  assert.ok(script.includes(JSON.stringify(expectedPath)));
  vm.runInNewContext(script, {
    window: {
      location: { pathname: actualPath },
      clearInterval() {},
      flutter_inappwebview: {
        callHandler(name, payload) {
          responses.push({ name, payload });
        },
      },
    },
    document: {
      querySelectorAll() {
        throw new Error("must not collect images for a mismatched path");
      },
    },
  });

  assert.equal(responses.length, 1);
  assert.equal(responses[0].name, "setResponse");
  assert.deepEqual(JSON.parse(responses[0].payload), {
    ok: false,
    error: "reader path mismatch",
  });
  assert.doesNotMatch(responses[0].payload, /u-mrezmrs1-hypr|different-episode/);
});
