const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ntkModule = require("../javascript/manga/src/ko/ntk.js");
const ntk = ntkModule.__ntkTest;

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
  assert.throws(() => ntk.parsePageImagesResponse("{\"ad_ack_required\":true}"), /Ad acknowledgment required/);
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
  assert.equal(manga.list[0].link, "/manga/570503");
});

test("repository manifests are consistent", () => {
  const index = JSON.parse(fs.readFileSync("index.json", "utf8"));
  const repo = JSON.parse(fs.readFileSync("repo.json", "utf8"));
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(repo.name, "Local NTK Mangayomi extensions");
  assert.equal(pkg.scripts.test, "node --test");
  assert.equal(index.length, 2);
  assert.deepEqual(index.map((source) => source.name), ["NTK Webtoon", "NTK Manga"]);
  assert.deepEqual(index.map((source) => source.additionalParams), ["source=webtoon", "source=manga"]);
  for (const source of index) {
    assert.equal(source.sourceCodeLanguage, 1);
    assert.equal(source.isNsfw, true);
    assert.match(source.sourceCodeUrl, /javascript\/manga\/src\/ko\/ntk\.js$/);
  }
});

test("embedded mangayomiSources match repository index", () => {
  const index = JSON.parse(fs.readFileSync("index.json", "utf8"));
  assert.deepEqual(ntkModule.mangayomiSources.map((source) => source.name), index.map((source) => source.name));
  assert.deepEqual(ntkModule.mangayomiSources.map((source) => source.additionalParams), index.map((source) => source.additionalParams));
});
