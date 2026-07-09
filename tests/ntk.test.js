const test = require("node:test");
const assert = require("node:assert/strict");
const nodeCrypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const ntkModule = require("../javascript/manga/src/ko/ntk.js");
const ntk = ntkModule.__ntkTest;

test("builds webtoon popular API URL", () => {
  const source = ntk.createNtkSource({ variant: "webtoon" });
  const url = source.__buildPopularUrl(2);
  assert.equal(url, "https://newtoki1.org/api/works?status=ongoing&sort=views&page=2&pageSize=49&withTotal=1");
});

test("builds manga popular API URL", () => {
  const source = ntk.createNtkSource({ variant: "manga" });
  const url = source.__buildPopularUrl(3);
  assert.equal(url, "https://newtoki1.org/api/manhwa-list?status=ongoing&sort=views&page=3&pageSize=49&withTotal=1");
});

test("builds filtered API URLs", () => {
  const source = ntk.createNtkSource({ variant: "webtoon" });
  const filters = [
    {
      type_name: "SelectFilter",
      type: "status",
      state: 2,
      values: [
        { type_name: "SelectOption", name: "All", value: "all" },
        { type_name: "SelectOption", name: "Ongoing", value: "ongoing" },
        { type_name: "SelectOption", name: "Completed", value: "completed" }
      ]
    },
    {
      type_name: "SelectFilter",
      type: "sort",
      state: 1,
      values: [
        { type_name: "SelectOption", name: "Views", value: "views" },
        { type_name: "SelectOption", name: "Latest", value: "latest" }
      ]
    }
  ];
  assert.equal(source.__buildPopularUrl(1, filters), "https://newtoki1.org/api/works?status=completed&sort=latest&page=1&pageSize=49&withTotal=1");
  assert.equal(source.__buildSearchUrl("dragon", 2, filters), "https://newtoki1.org/api/works?q=dragon&status=completed&sort=latest&page=2&pageSize=49&withTotal=1");
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
  assert.deepEqual(ntk.parseDetailsHtml(html, "https://newtoki1.org"), {
    title: "연애혁명",
    author: "232",
    description: "작품 설명 두 번째 줄",
    thumbnailUrl: "https://aws-cdn1.site/black/thumbs/426.jpg?v2",
    status: "ONGOING",
    genre: "학원, 개그/코미디, 로맨스"
  });
  assert.deepEqual(ntk.parseChaptersHtml(html, "https://newtoki1.org"), [
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
  const script = ntk.createWebviewImageExtractorScript();
  assert.match(script, /theme-viewer-images/);
  assert.match(script, /setResponse/);

  const headers = ntk.browserFetchHeaders({ "User-Agent": "UA", Cookie: "a=b" }, "https://newtoki1.org/webtoon/570503/1181035");
  assert.equal(headers["User-Agent"], "UA");
  assert.equal(headers.origin, "https://newtoki1.org");
  assert.equal(headers.referer, "https://newtoki1.org/webtoon/570503/1181035");
  assert.equal(headers.Cookie, undefined);
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
  }, "https://newtoki1.org", "POST", "/api/manhwa-images", "/manhwa/a/b", "{}", {});
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
  const result = ntk.parseWorksResponse(body, "https://newtoki1.org", "novel");
  assert.equal(result.list[0].link, "/novel/62101");
});

test("normalizes cached manga routes from old extension versions", () => {
  assert.equal(ntk.normalizeSourceUrl("/manga/u-moo1unxn-b4jo", "manga"), "/manhwa/u-moo1unxn-b4jo");
  assert.equal(ntk.normalizeSourceUrl("https://newtoki1.org/manga/2", "manga"), "https://newtoki1.org/manhwa/2");
  assert.equal(ntk.normalizeSourceUrl("/webtoon/570503", "webtoon"), "/webtoon/570503");
});

test("returns canonical manga links when refreshing cached details", async () => {
  const extension = new ntkModule.DefaultExtension();
  extension.source = { name: "NTK Manga", baseUrl: "https://newtoki1.org", additionalParams: "source=manga" };
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
  assert.deepEqual(index.map((source) => source.name), ["NTK Webtoon", "NTK Manga", "NTK Novel"]);
  assert.deepEqual(index.map((source) => source.additionalParams), ["source=webtoon", "source=manga", "source=novel"]);
  for (const source of index) {
    assert.equal(source.sourceCodeLanguage, 1);
    assert.equal(source.isNsfw, false);
    assert.match(source.sourceCodeUrl, /javascript\/manga\/src\/ko\/ntk\.js$/);
  }
});

test("embedded mangayomiSources match repository index", () => {
  const index = JSON.parse(fs.readFileSync("index.json", "utf8"));
  assert.deepEqual(ntkModule.mangayomiSources.map((source) => source.name), index.map((source) => source.name));
  assert.deepEqual(ntkModule.mangayomiSources.map((source) => source.additionalParams), index.map((source) => source.additionalParams));
});
