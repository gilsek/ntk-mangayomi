const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");

function fixture() {
  return fs.readFileSync(
    path.resolve(__dirname, "..", "fixtures", "detail", "legacy-detail.html"),
    "utf8",
  );
}

function response(body, contentType = "text/html; charset=utf-8", statusCode = 200) {
  return { body, headers: { "content-type": contentType }, statusCode };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("loads Legacy Novel metadata and chapters from one detail response", async () => {
  const { extension, requests } = loadNovelSource({
    responses: [response(fixture())],
  });

  const result = plain(await extension.getDetail("/novel/60079"));

  assert.equal(result.name, "레거시 & 소설");
  assert.equal(result.link, "/novel/60079");
  assert.equal(result.imageUrl, "https://newtoki1.org/covers/legacy-detail.jpg");
  assert.equal(result.description, "첫 줄 둘째 줄");
  assert.equal(result.author, "작가 A");
  assert.equal(result.artist, "작가 A");
  assert.equal(result.status, 1);
  assert.deepEqual(result.genre, ["판타지", "무협"]);
  assert.equal(result.chapters.length, 3);
  assert.deepEqual(
    result.chapters.map(({ name, url }) => ({ name, url })),
    [
      { name: "5화", url: "/novel/60079/9005" },
      { name: "3화", url: "/novel/60079/9003" },
      { name: "1화 🔒", url: "/novel/60079/9001" },
    ],
  );
  assert.equal(result.chapters[2].scanlator, "🔒");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://newtoki1.org/novel/60079");
});

test("accepts an optional empty cover and unknown status", async () => {
  const html = fixture()
    .replace('<img data-src="/covers/legacy-detail.jpg" alt="">', "")
    .replace('<meta property="og:image" content="/covers/meta-cover.jpg">', "")
    .replace("<span class=\"theme-detail-info-value\">완결</span>", "<span class=\"theme-detail-info-value\">휴재</span>");
  const { extension } = loadNovelSource({ responses: [response(html)] });

  const result = plain(await extension.getDetail("/novel/60079"));

  assert.equal(result.imageUrl, "");
  assert.equal(result.status, 5);
});

test("rejects malformed detail links before requesting", async () => {
  const { extension, requests } = loadNovelSource({ responses: [] });

  await assert.rejects(
    () => extension.getDetail("/novel/60079/9001"),
    /invalid work link/i,
  );
  assert.equal(requests.length, 0);
});

test("rejects detail HTTP, content-type, title, and chapter-container failures", async () => {
  const http = loadNovelSource({ responses: [response("missing", "text/html", 404)] }).extension;
  const json = loadNovelSource({ responses: [response("{}", "application/json")] }).extension;
  const missingTitle = loadNovelSource({
    responses: [response(fixture().replace("<div class=\"theme-detail-title-line\">레거시 &amp; 소설</div>", "").replace('<meta property="og:title" content="메타 제목 - 뉴토끼">', ""))],
  }).extension;
  const missingChapters = loadNovelSource({
    responses: [response(fixture().replace(/<form id="serial-move"[\s\S]*?<\/form>/, ""))],
  }).extension;

  await assert.rejects(() => http.getDetail("/novel/60079"), /Detail HTTP failure status=404/i);
  await assert.rejects(() => json.getDetail("/novel/60079"), /Detail response is not HTML/i);
  await assert.rejects(() => missingTitle.getDetail("/novel/60079"), /detail structure.*title/i);
  await assert.rejects(() => missingChapters.getDetail("/novel/60079"), /chapter structure.*serial-move/i);
});
