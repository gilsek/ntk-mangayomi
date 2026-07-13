const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const {
  loadManhwaSource,
} = require("../helpers/load-manhwa-source");

const readerPath = "/manhwa/u-work/u-episode";

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
          "https://",
          "https://[bad",
          "https://cdn.example/trailing.webp ",
          "https://cdn.example/001.webp",
          "https://cdn.example/002.webp",
        ],
      });
    },
  });

  const pages = JSON.parse(JSON.stringify(
    await extension.getPageList(readerPath),
  ));

  assert.equal(calls[0].url, `https://sbxh9.com${readerPath}`);
  assert.equal(calls[0].scripts.length, 1);
  assert.match(calls[0].scripts[0], /manhwa-images/);
  assert.match(calls[0].scripts[0], /\.viewer-lazy-img/);
  assert.deepEqual(pages.map((page) => page.url), [
    "https://cdn.example/001.webp",
    "https://cdn.example/002.webp",
  ]);
});

test("reuses one header object for WebView and every reader page", async () => {
  let headerCalls = 0;
  let webviewHeaders;
  const { extension } = loadManhwaSource({
    webview: async (_url, headers) => {
      webviewHeaders = headers;
      return {
        ok: true,
        images: [
          "https://cdn.example/001.webp",
          "https://cdn.example/002.webp",
        ],
      };
    },
  });
  extension.getHeaders = () => {
    headerCalls += 1;
    return { "X-Test-Header": "manhwa-reader" };
  };

  const pages = await extension.getPageList(readerPath);

  assert.equal(headerCalls, 1);
  assert.equal(webviewHeaders, pages[0].headers);
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

  function nextObservation() {
    activeObservation = observations[
      Math.min(observationIndex, observations.length - 1)
    ];
    observationIndex += 1;
    return activeObservation;
  }

  vm.runInNewContext(
    extension.createNextReaderImageExtractorScript(readerPath),
    {
      URL,
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
                return (activeObservation.urls || []).map(createImageNode);
              },
            };
          }
          if (selector === ".vw-empty" && activeObservation?.empty) {
            return { textContent: "reader error" };
          }
          return null;
        },
      },
    },
  );

  return { responses, intervals, cleared };
}

function installApiFastPath(extension, responseText, options = {}) {
  const responses = [];
  const intervals = [];
  const cleared = [];
  const events = [];
  const eventListeners = new Map();
  const fetchCalls = [];
  const window = {
    location: {
      href: `https://sbxh9.com${readerPath}`,
      origin: "https://sbxh9.com",
      pathname: readerPath,
    },
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
        ok: options.responseOk ?? true,
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
      URL,
      document: {
        querySelector() {
          return null;
        },
      },
    },
  );

  return {
    window,
    responses,
    intervals,
    cleared,
    events,
    fetchCalls,
  };
}

test("returns Manhwa image API URLs before the reader DOM is ready", async () => {
  const { extension } = loadManhwaSource();
  const execution = installApiFastPath(extension, JSON.stringify({
    images: [
      { page: 1, src: "https://cdn.example/001.webp" },
      { page: 2, src: "https://cdn.example/002.webp" },
      { page: 3, src: "https://cdn.example/001.webp" },
      "https://cdn.example/003.webp",
      { page: 4, src: "javascript:invalid" },
      { page: 5, src: "https://" },
      { page: 6, src: "https://[bad" },
      { page: 7, src: "https://cdn.example/trailing.webp " },
    ],
  }));

  assert.equal(execution.window.__ntk_ad_ack_scope, readerPath);
  assert.deepEqual(
    execution.events.map((event) => ({
      type: event.type,
      scope: event.detail?.scope,
    })),
    [{ type: "ntk-ad-ack-ready", scope: readerPath }],
  );
  assert.equal(execution.responses.length, 0);
  assert.equal(execution.intervals.length, 1);

  await execution.window.fetch("/api/manhwa-images", { method: "POST" });
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

test("ignores unrelated endpoints and invalid image API JSON", async () => {
  const { extension } = loadManhwaSource();
  const execution = installApiFastPath(extension, "not-json");

  await execution.window.fetch("/api/webtoon-images", { method: "POST" });
  await execution.window.fetch("/api/manhwa-images", { method: "POST" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(execution.responses.length, 0);
  assert.equal(execution.intervals.length, 1);
  assert.deepEqual(execution.cleared, []);
});

test("accepts only a successful same-origin POST image API response", async () => {
  const payload = JSON.stringify({
    images: [{ src: "https://cdn.example/001.webp" }],
  });
  const { extension } = loadManhwaSource();
  const getExecution = installApiFastPath(extension, payload);
  const crossOriginExecution = installApiFastPath(extension, payload);
  const failedExecution = installApiFastPath(extension, payload, {
    responseOk: false,
  });

  await getExecution.window.fetch("/api/manhwa-images");
  await crossOriginExecution.window.fetch(
    "https://ads.example/api/manhwa-images",
    { method: "POST" },
  );
  await failedExecution.window.fetch(
    "/api/manhwa-images",
    { method: "POST" },
  );
  await new Promise((resolve) => setImmediate(resolve));

  for (const execution of [
    getExecution,
    crossOriginExecution,
    failedExecution,
  ]) {
    assert.equal(execution.responses.length, 0);
    assert.equal(execution.intervals.length, 1);
    assert.deepEqual(execution.cleared, []);
  }
});

for (const error of [
  "ad_ack_required",
  "fingerprint_required",
  "browser_key_required",
]) {
  test(`re-announces acknowledgement for ${error}`, async () => {
    const { extension } = loadManhwaSource();
    const execution = installApiFastPath(extension, JSON.stringify({ error }));

    await execution.window.fetch("/api/manhwa-images", { method: "POST" });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(execution.responses.length, 0);
    assert.deepEqual(
      execution.events.map((event) => event.type),
      ["ntk-ad-ack-ready", "ntk-ad-ack-ready"],
    );
  });
}

test("handles the reader acknowledgement rearm event", () => {
  const { extension } = loadManhwaSource();
  const execution = installApiFastPath(extension, "{}");

  execution.window.__ntk_ad_ack_scope = "";
  execution.window.dispatchEvent({
    type: "ntk-ack-rearm",
    detail: { scope: readerPath },
  });

  assert.equal(execution.window.__ntk_ad_ack_scope, readerPath);
  assert.deepEqual(
    execution.events.map((event) => event.type),
    ["ntk-ad-ack-ready", "ntk-ack-rearm", "ntk-ad-ack-ready"],
  );
});

test("waits until every viewer container child is a valid image", () => {
  const { extension } = loadManhwaSource();
  const first = "https://cdn.example/001.webp";
  const second = "https://cdn.example/002.webp";
  const third = "https://cdn.example/003.webp";
  const execution = runExtractor(extension, [
    { childCount: 3, urls: [first] },
    { childCount: 3, urls: [first, second, "https://[bad"] },
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

test("returns a complete viewer container immediately and only once", () => {
  const { extension } = loadManhwaSource();
  const images = [
    "https://cdn.example/001.webp",
    "https://cdn.example/002.webp",
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
});

test("rejects a mismatched reader path without exposing either path", () => {
  const { extension } = loadManhwaSource();
  const actualPath = "/manhwa/u-work/different-episode";
  const responses = [];
  const script = extension.createNextReaderImageExtractorScript(readerPath);

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
      querySelector() {
        throw new Error("must not inspect a mismatched reader page");
      },
    },
  });

  assert.equal(responses.length, 1);
  assert.equal(responses[0].name, "setResponse");
  assert.deepEqual(JSON.parse(responses[0].payload), {
    ok: false,
    error: "reader path mismatch",
  });
  assert.doesNotMatch(responses[0].payload, /u-work|different-episode/);
});

test("rejects a missing bridge and invalid WebView payloads", async () => {
  const missingBridge = loadManhwaSource().extension;
  await assert.rejects(
    () => missingBridge.getPageList(readerPath),
    /WebView bridge unavailable.*parserFamily=next/i,
  );

  for (const payload of [
    "not-json",
    JSON.stringify({ ok: false, error: "blocked" }),
    JSON.stringify({ ok: true, images: [] }),
  ]) {
    const { extension } = loadManhwaSource({ webview: async () => payload });
    await assert.rejects(
      () => extension.getPageList(readerPath),
      /Next Manhwa reader invalid response.*parserFamily=next/i,
    );
  }
});

test("does not expose WebView payload or rejection secrets", async () => {
  const invalidPayload = loadManhwaSource({
    webview: async () => JSON.stringify({
      ok: false,
      error: "token=secret session=secret",
    }),
  }).extension;
  await assert.rejects(
    () => invalidPayload.getPageList(readerPath),
    (error) => {
      assert.equal(
        error.message,
        `Next Manhwa reader invalid response parserFamily=next url=${readerPath}`,
      );
      assert.doesNotMatch(error.message, /secret|token=|session=/i);
      return true;
    },
  );

  const rejected = loadManhwaSource({
    webview: async () => {
      throw new Error("token=secret session=secret");
    },
  }).extension;
  await assert.rejects(
    () => rejected.getPageList(readerPath),
    (error) => {
      assert.equal(
        error.message,
        `Next Manhwa reader WebView failed parserFamily=next url=${readerPath}`,
      );
      assert.doesNotMatch(error.message, /secret|token=|session=/i);
      return true;
    },
  );
});

test("accepts same-origin absolute links and rejects unsafe reader links", async () => {
  const calls = [];
  const { extension } = loadManhwaSource({
    webview: async (url) => {
      calls.push(url);
      return {
        ok: true,
        images: ["https://cdn.example/001.webp"],
      };
    },
  });

  const pages = JSON.parse(JSON.stringify(
    await extension.getPageList(`https://sbxh9.com${readerPath}`),
  ));
  assert.deepEqual(calls, [`https://sbxh9.com${readerPath}`]);
  assert.deepEqual(pages.map((page) => page.url), [
    "https://cdn.example/001.webp",
  ]);

  for (const unsafeLink of [
    `${readerPath}?token=secret`,
    `${readerPath}#session=secret`,
    `https://evil.example${readerPath}`,
    "/manhwa/u-work/u-episode/extra",
  ]) {
    await assert.rejects(
      () => extension.getPageList(unsafeLink),
      (error) => {
        assert.equal(error.message, "NTK Manhwa invalid chapter link");
        assert.doesNotMatch(
          error.message,
          /secret|token=|session=|evil\.example/i,
        );
        return true;
      },
    );
  }
});
