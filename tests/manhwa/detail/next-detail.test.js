const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadManhwaSource } = require("../helpers/load-manhwa-source");
const { DetailTestDocument } = require("./test-document");

function fixture(name) {
  return fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "detail", name),
    "utf8",
  );
}

function response(body, contentType, statusCode = 200) {
  return {
    body,
    headers: { "content-type": contentType },
    statusCode,
  };
}

function loadDetail({
  html = fixture("next-detail.html"),
  detailStatus = 200,
  detailContentType = "text/html; charset=utf-8",
} = {}) {
  return loadManhwaSource({
    DocumentClass: DetailTestDocument,
    responses(url) {
      if (url.includes("/episodes/viewer-nav")) {
        return response('{"ok":true,"episodes":[]}', "application/json");
      }
      return response(html, detailContentType, detailStatus);
    },
  });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("loads canonical Next Manhwa detail metadata", async () => {
  const { extension, requests } = loadDetail();

  const result = plain(
    await extension.getDetail("https://sbxh9.com/manhwa/u-detail"),
  );

  assert.deepEqual(result, {
    name: "상세 만화",
    link: "/manhwa/u-detail",
    imageUrl: "https://sbxh9.com/covers/manhwa-detail.jpg",
    description: "작품 설명입니다.",
    author: "작가 A, 작가 B",
    artist: "작가 A, 작가 B",
    status: 1,
    genre: ["액션", "판타지"],
    chapters: [],
  });
  assert.equal(requests[0].url, "https://sbxh9.com/manhwa/u-detail");
  assert.equal(requests[0].headers.Referer, "https://sbxh9.com/");
});

test("accepts missing optional detail fields", async () => {
  const { extension } = loadDetail({
    html: fixture("next-detail-minimal.html"),
  });

  const result = plain(await extension.getDetail("/manhwa/2"));

  assert.equal(result.name, "빈 상세");
  assert.equal(result.imageUrl, "");
  assert.equal(result.description, "");
  assert.equal(result.author, "");
  assert.equal(result.artist, "");
  assert.equal(result.status, 0);
  assert.deepEqual(result.genre, []);
  assert.deepEqual(result.chapters, []);
});

test("uses unknown status when the live status marker is unrecognized", async () => {
  const { extension } = loadDetail({
    html: '<section class="hero-v2"><h1 class="hero-v2-title">상태 미상</h1><span class="pill pill-status">휴재</span></section>',
  });

  const result = await extension.getDetail("/manhwa/work");

  assert.equal(result.status, 5);
});

test("rejects malformed detail links before requesting", async () => {
  const { extension, requests } = loadDetail();

  await assert.rejects(
    () => extension.getDetail("/manhwa/work/episode"),
    /invalid work link/i,
  );
  assert.equal(requests.length, 0);
});

test("rejects detail HTTP and content-type failures", async () => {
  const notFound = loadDetail({ detailStatus: 404 }).extension;
  const json = loadDetail({
    html: "{}",
    detailContentType: "application/json",
  }).extension;

  await assert.rejects(
    () => notFound.getDetail("/manhwa/missing"),
    /Next Manhwa detail HTTP 404/i,
  );
  await assert.rejects(
    () => json.getDetail("/manhwa/work"),
    /Next Manhwa detail non-HTML response/i,
  );
});

test("rejects detail pages without the required container or title", async () => {
  const missingContainer = loadDetail({ html: "<main>maintenance</main>" })
    .extension;
  const missingTitle = loadDetail({
    html: '<section class="hero-v2"><p class="hero-v2-desc">설명</p></section>',
  }).extension;

  await assert.rejects(
    () => missingContainer.getDetail("/manhwa/work"),
    /detail structure error.*missing=section\.hero-v2/i,
  );
  await assert.rejects(
    () => missingTitle.getDetail("/manhwa/work"),
    /detail structure error.*missing=h1\.hero-v2-title/i,
  );
});
