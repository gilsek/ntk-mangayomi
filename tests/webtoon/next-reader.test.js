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
