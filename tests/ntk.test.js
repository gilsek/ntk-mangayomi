const test = require("node:test");
const assert = require("node:assert/strict");
const nodeCrypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const ntkModule = require("../javascript/manga/src/ko/ntk.js");
const ntk = ntkModule.__ntkTest;

function decodeCanonicalQuery(url) {
  return new URL(url).searchParams.toString();
}

test("builds the general webtoon popular HTML URL", () => {
  const source = ntk.createNtkSource({ variant: "webtoon" });
  const url = source.__buildPopularUrl(2);
  assert.equal(url, "https://toki30.com/ing?page=2");
  assert.equal(source.__buildLatestUrl(2), "https://toki30.com/ing?page=2&sort=new");
});

test("builds manga popular API URL", () => {
  const source = ntk.createNtkSource({ variant: "manga" });
  const url = source.__buildPopularUrl(3);
  assert.equal(url, "https://toki30.com/api/manhwa-list?status=ongoing&sort=views&page=3&pageSize=49&withTotal=1");
});

test("builds source-specific filters from the live NTK search forms", () => {
  const extension = new ntkModule.DefaultExtension();

  extension.source = { additionalParams: "source=webtoon" };
  const webtoon = extension.getFilterList();
  assert.deepEqual(webtoon.map((filter) => filter.type), ["author", "weekday", "platform", "category", "genre", "sort"]);
  assert.deepEqual(
    webtoon.find((filter) => filter.type === "category").values.map((option) => [option.name, option.value]),
    [
      ["\uC77C\uBC18\uC6F9\uD230", "\uC77C\uBC18\uC6F9\uD230"],
      ["\uC131\uC778\uC6F9\uD230", "\uC131\uC778\uC6F9\uD230"],
      ["BL/GL", "BL/GL"],
      ["\uC644\uACB0\uC6F9\uD230", "\uC644\uACB0\uC6F9\uD230"]
    ]
  );
  assert.deepEqual(webtoon.find((filter) => filter.type === "weekday").values.map((option) => option.name), ["전체", "월", "화", "수", "목", "금", "토", "일", "열흘"]);
  assert.ok(webtoon.find((filter) => filter.type === "platform").values.some((option) => option.name === "네이버" && option.value === "1"));
  assert.deepEqual(
    webtoon.find((filter) => filter.type === "genre").values.map((option) => option.value),
    ["", "\uD310\uD0C0\uC9C0", "\uC561\uC158", "\uAC1C\uADF8", "\uBBF8\uC2A4\uD130\uB9AC", "\uB85C\uB9E8\uC2A4", "\uB4DC\uB77C\uB9C8", "\uBB34\uD611", "\uC2A4\uD3EC\uCE20", "\uC77C\uC0C1", "\uD559\uC6D0"]
  );

  extension.source = { additionalParams: "source=manga" };
  const manga = extension.getFilterList();
  assert.deepEqual(manga.map((filter) => filter.type), ["artist", "status", "genre", "sort"]);
  assert.ok(manga.find((filter) => filter.type === "genre").values.some((option) => option.name === "이세계"));

  extension.source = { additionalParams: "source=novel" };
  const novel = extension.getFilterList();
  assert.deepEqual(novel.map((filter) => filter.type), ["author", "status", "genre", "platform", "sort"]);
  assert.ok(novel.find((filter) => filter.type === "platform").values.some((option) => option.name === "문피아" && option.value === "munpia"));
  assert.deepEqual(novel.find((filter) => filter.type === "sort").values.map((option) => option.name), ["최신순", "신작순", "북마크순", "조회순", "평점순", "화수순"]);
});

test("defaults title search to all statuses", () => {
  const extension = new ntkModule.DefaultExtension();
  extension.source = { additionalParams: "source=manga" };
  const filters = extension.getFilterList();
  const status = filters.find((filter) => filter.type === "status");

  assert.equal(status.state, 0);
  assert.match(
    ntk.createNtkSource({ variant: "manga" }).__buildSearchUrl(
      "?꾩닔",
      1,
      filters,
    ),
    /[?&]pub=all(?:&|$)/,
  );
});

test("skips legacy image candidates for current nv reader routes", () => {
  const source = ntk.createNtkSource({ variant: "webtoon" });

  assert.deepEqual(source.__buildImageCandidates("/webtoon/850546/nv-850546-7"), []);
  assert.equal(source.__buildImageCandidates("/webtoon/850546/123456").length, 3);
});

test("migrates the previous default BaseUrl preference", () => {
  const previousSharedPreferences = global.SharedPreferences;
  let saved;
  global.SharedPreferences = class {
    get() { return "https://newtoki1.org"; }
    setString(key, value) { saved = [key, value]; }
  };

  try {
    const extension = new ntkModule.DefaultExtension();
    extension.source = { baseUrl: "https://toki30.com" };
    assert.equal(extension.getBaseUrl(), "https://toki30.com");
    assert.deepEqual(saved, ["ntkBaseUrl", "https://toki30.com"]);
  } finally {
    if (previousSharedPreferences === undefined) delete global.SharedPreferences;
    else global.SharedPreferences = previousSharedPreferences;
  }
});

test("uses the current webtoon routes for list requests", () => {
  const extension = new ntkModule.DefaultExtension();
  extension.source = { additionalParams: "source=webtoon" };
  const filters = extension.getFilterList();
  const source = ntk.createNtkSource({ variant: "webtoon" });

  let url = source.__buildPopularUrl(2, filters);
  assert.equal(url, "https://toki30.com/ing?page=2");

  filters.find((filter) => filter.type === "genre").state = 1;
  url = source.__buildPopularUrl(2, filters);
  assert.equal(url, "https://toki30.com/ing?page=2");
  filters.find((filter) => filter.type === "genre").state = 0;

  filters.find((filter) => filter.type === "category").state = 1;
  url = source.__buildPopularUrl(2, filters);
  assert.equal(url, "https://toki30.com/ing?page=2");

  filters.find((filter) => filter.type === "category").state = 3;
  url = source.__buildPopularUrl(2, filters);
  assert.equal(url, "https://toki30.com/end?page=2");
});

test("builds title search and complete filter URLs against HTML list pages", () => {
  const extension = new ntkModule.DefaultExtension();
  extension.source = { additionalParams: "source=webtoon" };
  const filters = extension.getFilterList();
  filters.find((filter) => filter.type === "author").state = "232";
  filters.find((filter) => filter.type === "weekday").state = 5;
  filters.find((filter) => filter.type === "platform").state = 1;
  filters.find((filter) => filter.type === "category").state = 1;
  filters.find((filter) => filter.type === "genre").state = 1;
  filters.find((filter) => filter.type === "sort").state = 3;

  const source = ntk.createNtkSource({ variant: "webtoon" });
  assert.equal(
    source.__buildSearchUrl("연애혁명", 2, filters),
    "https://toki30.com/search?field=title&match=contains&page=2&q=%EC%97%B0%EC%95%A0%ED%98%81%EB%AA%85"
  );
});

test("builds manga and novel filter URLs with source-specific fields", () => {
  const extension = new ntkModule.DefaultExtension();

  extension.source = { additionalParams: "source=manga" };
  const mangaFilters = extension.getFilterList();
  mangaFilters.find((filter) => filter.type === "artist").state = "니시 오사무";
  mangaFilters.find((filter) => filter.type === "genre").state = mangaFilters.find((filter) => filter.type === "genre").values.findIndex((option) => option.value === "이세계");
  assert.match(ntk.createNtkSource({ variant: "manga" }).__buildSearchUrl("악마", 1, mangaFilters), /^https:\/\/toki30\.com\/manhwa\?kind=manhwa&stx=/);
  assert.match(ntk.createNtkSource({ variant: "manga" }).__buildSearchUrl("악마", 1, mangaFilters), /artist=%EB%8B%88%EC%8B%9C%20%EC%98%A4%EC%82%AC%EB%AC%B4/);
  assert.match(ntk.createNtkSource({ variant: "manga" }).__buildSearchUrl("악마", 1, mangaFilters), /tag=%EC%9D%B4%EC%84%B8%EA%B3%84/);

  extension.source = { additionalParams: "source=novel" };
  const novelFilters = extension.getFilterList();
  novelFilters.find((filter) => filter.type === "platform").state = novelFilters.find((filter) => filter.type === "platform").values.findIndex((option) => option.value === "munpia");
  const novelUrl = ntk.createNtkSource({ variant: "novel" }).__buildSearchUrl("천마", 3, novelFilters);
  assert.match(novelUrl, /^https:\/\/toki30\.com\/novel\?kind=novel&stx=/);
  assert.match(novelUrl, /plat=munpia/);
  assert.match(novelUrl, /page=3$/);
});

test("parses current NTK HTML lists, removes duplicates, and detects next page", () => {
  const extension = new ntkModule.DefaultExtension();
  const html = `
    <ul id="webtoon-list-all" class="list">
      <li data-initial="ㅅ" data-genre="판타지" date-title="수해의 마녀">
        <div class="img-item"><a href="/manhwa/36439"><img class="theme-thumb-img" src="/cover.jpg"></a>
        <div class="in-lable"><a href="/manhwa/36439"><span class="title white">수해의 마녀</span></a></div></div>
      </li>
      <li data-initial="ㅅ" date-title="수해의 마녀">
        <a href="/manhwa/36439"><img src="/cover.jpg"></a>
      </li>
    </ul>
    <ul class="pagination"><li><a href="/manhwa?page=2"><i class="fa fa-angle-right"></i></a></li></ul>`;

  assert.deepEqual(extension.parseMangaCards(html, "https://toki30.com"), {
    list: [
      {
        name: "수해의 마녀",
        imageUrl: "https://toki30.com/cover.jpg",
        url: "/manhwa/36439",
        link: "/manhwa/36439"
      }
    ],
    hasNextPage: true
  });
});

test("parses the current Next.js webtoon cards", () => {
  const extension = new ntkModule.DefaultExtension();
  const html = `
    <div class="weekly-board__grid">
      <a class="weekly-card weekly-card--feature" href="/webtoon/55884394">
        <div class="weekly-card__cover">
          <img src="https://cdn.example/cover.webp" alt="무당기협">
        </div>
        <div class="weekly-card__meta"><strong>무당기협</strong><span>170화</span></div>
      </a>
    </div>
    <a class="pagination__next" href="/ing?page=2">Next</a>`;

  assert.deepEqual(extension.parseMangaCards(html, "https://toki30.com"), {
    list: [{
      name: "무당기협",
      imageUrl: "https://cdn.example/cover.webp",
      url: "/webtoon/55884394",
      link: "/webtoon/55884394"
    }],
    hasNextPage: true
  });
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

test("parses legacy newtoki detail and chapter rows", () => {
  const html = `
    <meta property="og:title" content="연애혁명 - 뉴토끼 웹툰 미리보기">
    <meta property="og:description" content="연애혁명 일반웹툰. 설명">
    <meta property="og:image" content="https://aws-cdn1.site/black/thumbs/426.jpg?v2">
    <div class="view-img"><img src="https://aws-cdn1.site/black/thumbs/426.jpg?v2" alt="연애혁명"></div>
    <div class="theme-detail-title-line">연애혁명</div>
    <span class="theme-detail-info-label">작가</span><span class="theme-detail-info-value"><a href="/webtoon?author=232">232</a></span>
    <span class="theme-detail-info-label">장르</span><span class="theme-detail-info-value">학원, 개그/코미디, 로맨스</span>
    <span class="theme-detail-info-label">발행구분</span><span class="theme-detail-info-value">연재중</span>
    <div class="view-content theme-detail-description">작품 설명<br>두 번째 줄</div>
    <ul class="list-body">
      <li class="list-item" data-index="442">
        <div class="wr-subject">
          <a rel="x" href="/webtoon/570503/1181035" class="item-subject">
            0443 - 후기<span class="theme-episode-title-metrics"><span>8</span></span>
          </a>
        </div>
        <div class="wr-date hidden-xs">2023.04.26</div>
      </li>
    </ul>`;
  assert.deepEqual(ntk.parseDetailsHtml(html, "https://toki30.com"), {
    title: "연애혁명",
    author: "232",
    description: "작품 설명 두 번째 줄",
    thumbnailUrl: "https://aws-cdn1.site/black/thumbs/426.jpg?v2",
    status: "ONGOING",
    genre: "학원, 개그/코미디, 로맨스"
  });
  assert.deepEqual(ntk.parseChaptersHtml(html, "https://toki30.com"), [
    {
      name: "0443 - 후기",
      url: "/webtoon/570503/1181035",
      dateUpload: "23.04.26",
      scanlator: ""
    }
  ]);
});

test("parses image arrays and rejects ad acknowledgment", () => {
  assert.deepEqual(ntk.parsePageImagesResponse(JSON.stringify({ images: ["https://i/1.jpg", { url: "https://i/2.jpg" }] })), [
    "https://i/1.jpg",
    "https://i/2.jpg"
  ]);
  assert.throws(() => ntk.parsePageImagesResponse("{\"ad_ack_required\":true}"), /Ad acknowledgment required/);
});

test("parses WebView image extraction payloads", () => {
  assert.deepEqual(ntk.parseWebviewImageResponse(JSON.stringify({ ok: true, images: [{ src: "https://img/1.webp" }, "https://img/2.webp"] })), [
    "https://img/1.webp",
    "https://img/2.webp"
  ]);
  assert.throws(() => ntk.parseWebviewImageResponse(JSON.stringify({ ok: false, error: "blocked" })), /blocked/);
});

test("detects NTK maintenance pages", () => {
  assert.equal(ntk.isMaintenanceHtml("<title>잠시 점검중</title><p>잠시 후 다시 시도해 주세요.</p>"), true);
  assert.equal(ntk.isMaintenanceHtml("<html><title>normal</title></html>"), false);
});

test("builds WebView extractor script and browser-like headers", () => {
  const script = ntk.createWebviewImageExtractorScript("https://toki30.com/manhwa/work/episode");
  assert.match(script, /theme-viewer-images/);
  assert.match(script, /setResponse/);
  assert.match(script, /window\.fetch/);
  assert.match(script, /response\.clone\(\)/);
  assert.match(script, /\/api\/(?:manhwa|webtoon)-images/);
  assert.match(script, /__ntkImageInterceptorInstalled/);

  const headers = ntk.browserFetchHeaders({ "User-Agent": "UA", Cookie: "a=b" }, "https://toki30.com/webtoon/570503/1181035");
  assert.equal(headers["User-Agent"], "UA");
  assert.equal(headers.origin, "https://toki30.com");
  assert.equal(headers.referer, "https://toki30.com/webtoon/570503/1181035");
  assert.equal(headers.Cookie, undefined);
});

test("lets the reader WebView send image API requests directly", () => {
  assert.deepEqual(
    ntk.directWebviewHeaders({
      Cookie: "cf_clearance=secret",
      "X-WebView-Intercept": "true",
      "User-Agent": "WebView UA",
      Accept: "text/html"
    }),
    {
      "User-Agent": "WebView UA",
      Accept: "text/html"
    }
  );
});

test("falls back to WebView after the current image API rejects the request", async () => {
  const previousEvaluate = global.evaluateJavascriptViaWebview;
  const extension = new ntkModule.DefaultExtension();
  const getCalls = [];
  extension.source = {
    name: "NTK Webtoon",
    baseUrl: "https://toki30.com",
    additionalParams: "source=webtoon"
  };
  extension.client = {
    async get(url) {
      getCalls.push(url);
      if (getCalls.length > 1) throw new Error("reader requested twice");
      return {
        statusCode: 200,
        body: '{"sourceWorkId":"850546","episodeId":"7","imagesToken":"token.value"}'
      };
    },
    async post(url) {
      if (url.endsWith("/api/nv-issue")) {
        return { statusCode: 200, body: '{"session":"session.value"}' };
      }
      return { statusCode: 403, body: '{"error":"forbidden"}' };
    }
  };
  global.evaluateJavascriptViaWebview = async () => JSON.stringify({
    ok: true,
    images: ["https://img.example/page-1.jpg"]
  });

  try {
    const pages = await extension.getPageList("/webtoon/850546/nv-850546-7");
    assert.equal(getCalls.length, 1);
    assert.equal(pages[0].url, "https://img.example/page-1.jpg");
  } finally {
    global.evaluateJavascriptViaWebview = previousEvaluate;
  }
});

test("does not bypass ad verification and captures the image fetch", async () => {
  const responses = [];
  const events = [];
  const listeners = {};
  const imageResponse = {
    url: "https://toki30.com/api/manhwa-images",
    clone() {
      return { json: async () => ({ images: ["https://img/reader-1.webp"] }) };
    }
  };
  const nativeFetch = async () => imageResponse;
  const sandbox = {
    window: {
      fetch: nativeFetch,
      location: {
        pathname: "/manhwa/work/episode",
        href: "https://toki30.com/manhwa/work/episode"
      },
      dispatchEvent(event) {
        events.push(event);
        for (const listener of listeners[event.type] || []) listener(event);
      },
      addEventListener(type, listener) {
        (listeners[type] ||= []).push(listener);
      },
      setInterval: () => 1,
      clearInterval() {},
      flutter_inappwebview: {
        callHandler(_name, payload) {
          responses.push(JSON.parse(payload));
        }
      }
    },
    document: {
      querySelectorAll: () => [],
      querySelector: () => ({ textContent: "광고 검증 후 다시 시도해주세요" })
    },
    Array,
    JSON,
    String,
    RegExp,
    Promise,
    CustomEvent: function(type, init) {
      return { type, detail: init.detail };
    }
  };

  vm.runInNewContext(ntk.createWebviewImageExtractorScript("https://toki30.com/manhwa/work/episode"), sandbox);
  assert.deepEqual(responses, []);
  assert.equal(sandbox.window.fetch, nativeFetch);
  assert.equal(sandbox.window.__ntk_ad_ack_scope, undefined);
  assert.deepEqual(events, []);

  sandbox.window.dispatchEvent(new sandbox.CustomEvent("ntk-ad-ack-ready", {
    detail: { scope: "/manhwa/work/episode", source: "ad-guard" }
  }));
  await Promise.resolve();
  assert.notEqual(sandbox.window.fetch, nativeFetch);

  await sandbox.window.fetch("https://toki30.com/api/manhwa-images");
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(responses, [{ ok: true, images: ["https://img/reader-1.webp"] }]);
});

test("bootstraps the NTK root before navigating to a manhwa reader", () => {
  let navigate;
  const nativeFetch = async () => ({ url: "", clone() { return { json: async () => ({}) }; } });
  const sandbox = {
    window: {
      fetch: nativeFetch,
      location: { pathname: "/", href: "https://toki30.com/" },
      setTimeout(callback) { navigate = callback; },
      setInterval: () => 1,
      clearInterval() {},
      dispatchEvent() {},
      addEventListener() {},
      flutter_inappwebview: { callHandler() {} }
    },
    document: { querySelectorAll: () => [], querySelector: () => null },
    Array,
    JSON,
    String,
    RegExp,
    Promise,
    CustomEvent: function(type, init) { return { type, detail: init.detail }; }
  };

  vm.runInNewContext(ntk.createWebviewImageExtractorScript("https://toki30.com/manhwa/work/episode"), sandbox);

  assert.equal(typeof navigate, "function");
  assert.equal(sandbox.window.fetch, nativeFetch);
  navigate();
  assert.equal(sandbox.window.location.href, "https://toki30.com/manhwa/work/episode");
});

test("detects reader bootstrap token fields", () => {
  const html = String.raw`self.__next_f.push([1,"{\"sourceWorkId\":\"570503\",\"episodeId\":\"1181035\",\"imagesToken\":\"abc.def\",\"viewerUrl\":\"https:\/\/blacktoon410.com\/webtoons\/426\/1181035.html\"}"])`;
  assert.deepEqual(ntk.parseReaderBootstrap(html), {
    imagesToken: "abc.def",
    viewerUrl: "https://blacktoon410.com/webtoons/426/1181035.html",
    sourceWorkId: "570503",
    episodeId: "1181035"
  });
});

test("detects legacy reader token field", () => {
  const html = String.raw`{"sourceWorkId":"570503","episodeId":"1181035","token":"legacy.token","imageApiPath":"\/api\/webtoon-images"}`;
  assert.deepEqual(ntk.parseReaderBootstrap(html), {
    imagesToken: "legacy.token",
    viewerUrl: "",
    sourceWorkId: "570503",
    episodeId: "1181035"
  });
});

test("generates HMAC-SHA256 proof compatible with WebCrypto", async () => {
  const proof = await ntk.hmacSha256Base64Url("session-secret", "token.nonce");
  assert.equal(proof, "4cYlN815p6tkilfjPL5K4_iLdrr6yS7XbAnJl-bTcKI");
});

test("generates HMAC-SHA256 proof without WebCrypto", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
  try {
    const proof = await ntk.hmacSha256Base64Url("session-secret", "token.nonce");
    assert.equal(proof, "4cYlN815p6tkilfjPL5K4_iLdrr6yS7XbAnJl-bTcKI");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
  }
});

test("decodes Base64URL without Buffer or atob", () => {
  const source = fs.readFileSync("javascript/manga/src/ko/ntk.js", "utf8");
  const sandbox = { module: { exports: {} }, Uint8Array, Array, String, Number, Math, JSON, RegExp, Date, decodeURIComponent };
  vm.runInNewContext(`${source}\nmodule.exports = { base64UrlToBytes };`, sandbox);
  assert.deepEqual(Array.from(sandbox.module.exports.base64UrlToBytes("SGVsbG8td29ybGQ")), [72, 101, 108, 108, 111, 45, 119, 111, 114, 108, 100]);
});

test("generates manga image signature headers without WebCrypto", async () => {
  const source = fs.readFileSync("javascript/manga/src/ko/ntk.js", "utf8");
  const sandbox = { module: { exports: {} }, Uint8Array, Array, String, Number, Math, JSON, RegExp, Date, decodeURIComponent, BigInt, crypto: undefined };
  vm.runInNewContext(`${source}\nmodule.exports = { createBrowserSignedHeaders };`, sandbox);
  const headers = await sandbox.module.exports.createBrowserSignedHeaders({
    async post() { return { body: JSON.stringify({ ok: true, keyId: "test-key", serverNow: Date.now() }) }; }
  }, "https://toki30.com", "POST", "/api/manhwa-images", "/manhwa/a/b", "{}", {});
  assert.equal(headers["x-ntk-key-id"], "test-key");
  assert.match(headers["x-ntk-sig"], /^[A-Za-z0-9_-]+$/);
});

test("signs NTK browser requests with a pure P-256 key when WebCrypto is unavailable", () => {
  const source = fs.readFileSync("javascript/manga/src/ko/ntk.js", "utf8");
  const sandbox = { module: { exports: {} }, Uint8Array, Array, String, Number, Math, JSON, RegExp, Date, decodeURIComponent, BigInt, crypto: undefined };
  vm.runInNewContext(`${source}\nmodule.exports = { createP256BrowserKeyPair };`, sandbox);
  const pair = sandbox.module.exports.createP256BrowserKeyPair("test entropy");
  const message = "ntk-brsig-v1\nPOST\n/api/manhwa-images\n/manhwa/a/b\nkey\n1\nnonce\nhash";
  const publicKey = nodeCrypto.createPublicKey({ key: pair.publicJwk, format: "jwk" });
  assert.equal(nodeCrypto.verify("sha256", Buffer.from(message), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(pair.sign(message))), true);
});

test("parses HTML card fallback lists", () => {
  const extension = new ntkModule.DefaultExtension();
  const result = extension.parseMangaCards(`
    <div class="card-grid">
      <a class="card" href="/manga/abc">
        <div class="thumb"><img src="/thumb.jpg"></div>
        <p class="subject">작품</p>
      </a>
    </div>`, "https://sbxh9.com");
  assert.deepEqual(result, {
    list: [
      {
        name: "작품",
        imageUrl: "https://sbxh9.com/thumb.jpg",
        url: "/manga/abc",
        link: "/manga/abc"
      }
    ],
    hasNextPage: false
  });
});

test("parses live-shaped works API response into source routes", () => {
  const body = JSON.stringify({
    works: [
      {
        sourceWorkId: "570503",
        title: "연애혁명",
        thumbnailUrl: "https://aws-cdn1.site/black/thumbs/426.jpg?v2"
      }
    ],
    hasMore: true
  });
  assert.deepEqual(ntk.parseWorksResponse(body, "https://sbxh9.com", "webtoon"), {
    list: [
      {
        name: "연애혁명",
        imageUrl: "https://aws-cdn1.site/black/thumbs/426.jpg?v2",
        url: "/webtoon/570503",
        link: "/webtoon/570503"
      }
    ],
    hasNextPage: true
  });

  const manga = ntk.parseWorksResponse(body, "https://sbxh9.com", "manga");
  assert.equal(manga.list[0].link, "/manhwa/570503");
});

test("parses live-shaped novel API response into novel routes", () => {
  const body = JSON.stringify({
    novels: [
      {
        id: "62101",
        sourceWorkId: "joara-mrdtttq8-sw7u",
        title: "드래곤의 유산",
        thumbnailUrl: "https://aws-cdn1.site/home_thumb/novel/62101.webp"
      }
    ],
    page: 1,
    total: 2,
    pageSize: 1
  });
  const result = ntk.parseWorksResponse(body, "https://toki30.com", "novel");
  assert.equal(result.list[0].link, "/novel/62101");
});

test("preserves line breaks inside novel paragraphs", () => {
  const source = fs.readFileSync("javascript/manga/src/ko/ntk.js", "utf8");
  const sandbox = { module: { exports: {} }, Array, String, JSON };
  vm.runInNewContext(`${source}\nmodule.exports = { renderNovelContentHtml };`, sandbox);
  const decoded = JSON.stringify({
    kind: "text",
    paragraphs: ["첫 번째 문장.\n두 번째 문장.", "다음 문단."]
  });

  assert.equal(
    sandbox.module.exports.renderNovelContentHtml(decoded),
    "<p>첫 번째 문장.<br>두 번째 문장.</p>\n<p>다음 문단.</p>"
  );
});

test("preserves line breaks inside novel HTML payloads", () => {
  const source = fs.readFileSync("javascript/manga/src/ko/ntk.js", "utf8");
  const sandbox = { module: { exports: {} }, Array, String, JSON };
  vm.runInNewContext(`${source}\nmodule.exports = { renderNovelContentHtml };`, sandbox);
  const decoded = JSON.stringify({
    kind: "html",
    html: "\n  <h1>제목</h1>\n  <div class=\"text\">첫 문장.\n\n둘째 문장.</div>\n"
  });

  assert.equal(
    sandbox.module.exports.renderNovelContentHtml(decoded),
    "<h1>제목</h1><div class=\"text\">첫 문장.<br><br>둘째 문장.</div>"
  );
});

test("normalizes cached manga routes from old extension versions", () => {
  assert.equal(ntk.normalizeSourceUrl("/manga/u-moo1unxn-b4jo", "manga"), "/manhwa/u-moo1unxn-b4jo");
  assert.equal(ntk.normalizeSourceUrl("https://toki30.com/manga/2", "manga"), "https://toki30.com/manhwa/2");
  assert.equal(ntk.normalizeSourceUrl("/webtoon/570503", "webtoon"), "/webtoon/570503");
});

test("returns canonical manga links when refreshing cached details", async () => {
  const extension = new ntkModule.DefaultExtension();
  extension.source = { name: "NTK Manhwa", baseUrl: "https://toki30.com", additionalParams: "source=manga" };
  extension.client = { get: async () => ({ body: "<h1 class=\"hero-v2-title\">Test</h1>" }) };

  const detail = await extension.getDetail("/manga/u-moo1unxn-b4jo");
  assert.equal(detail.link, "/manhwa/u-moo1unxn-b4jo");
});

test("repository manifests are consistent", () => {
  const index = JSON.parse(fs.readFileSync("index.json", "utf8"));
  const repo = JSON.parse(fs.readFileSync("repo.json", "utf8"));
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(repo.name, "NTK Mangayomi extensions");
  assert.equal(pkg.scripts.test, "node --test");
  assert.equal(index.length, 3);
  assert.deepEqual(index.map((source) => source.name), ["NTK Webtoon", "NTK Manhwa", "NTK Novel"]);
  assert.deepEqual(index.map((source) => source.version), ["0.109", "0.207", "0.305"]);
  assert.deepEqual(index.map((source) => source.additionalParams), ["", "", ""]);

  const [webtoon, manhwa, novel] = index;
  assert.equal(webtoon.id, 260713001);
  assert.equal(webtoon.baseUrl, "https://sbxh9.com");
  assert.equal(webtoon.sourceCodeLanguage, 1);
  assert.equal(webtoon.isNsfw, true);
  assert.match(webtoon.sourceCodeUrl, /javascript\/manga\/src\/ko\/ntk_webtoon\.js$/);

  assert.equal(manhwa.id, 260713002);
  assert.equal(manhwa.baseUrl, "https://sbxh9.com");
  assert.equal(manhwa.sourceCodeLanguage, 1);
  assert.equal(manhwa.isNsfw, false);
  assert.match(manhwa.sourceCodeUrl, /javascript\/manga\/src\/ko\/ntk_manhwa\.js$/);

  assert.equal(novel.id, 260713003);
  assert.equal(novel.baseUrl, "https://newtoki1.org");
  assert.equal(novel.sourceCodeLanguage, 1);
  assert.equal(novel.isNsfw, true);
  assert.match(novel.sourceCodeUrl, /javascript\/novel\/src\/ko\/ntk_novel\.js$/);
});

test("embedded mangayomiSources match repository index", () => {
  const index = JSON.parse(fs.readFileSync("index.json", "utf8"));
  const { loadWebtoonSource } = require("./webtoon/helpers/load-webtoon-source");
  const [webtoonEmbedded] = loadWebtoonSource().sources;
  const webtoonIndex = index.find((source) => source.id === 260713001);
  const { loadManhwaSource } = require("./manhwa/helpers/load-manhwa-source");
  const [manhwaEmbedded] = loadManhwaSource().sources;
  const manhwaIndex = index.find((source) => source.id === 260713002);

  for (const key of [
    "name",
    "id",
    "baseUrl",
    "version",
    "isNsfw",
    "sourceCodeUrl",
    "additionalParams",
  ]) {
    assert.deepEqual(webtoonEmbedded[key], webtoonIndex[key]);
    assert.deepEqual(manhwaEmbedded[key], manhwaIndex[key]);
  }
});
