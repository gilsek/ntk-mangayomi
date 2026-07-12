const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

function loadLegacyWebtoonSource(options = {}) {
  return loadWebtoonSource({
    ...options,
    preferences: {
      ...options.preferences,
      ntk_webtoon_parser_family: "legacy",
    },
  });
}

const fixtureDirectory = path.join(__dirname, "fixtures");

function fixture(name) {
  return fs.readFileSync(path.join(fixtureDirectory, name), "utf8");
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parses numeric and slug work links without interpreting opaque keys", async () => {
  const { extension } = loadLegacyWebtoonSource({
    body: fixture("legacy-list-page-1.html"),
  });

  const result = plain(await extension.getPopular(1));

  assert.deepEqual(result, {
    list: [
      {
        name: "숫자 작품",
        link: "/webtoon/850661",
        imageUrl: "https://newtoki1.org/data/covers/numeric.jpg",
      },
      {
        name: "슬러그 작품",
        link: "/webtoon/u-bt-sanitized-slug",
        imageUrl: "https://cdn.example/slug.jpg",
      },
    ],
    hasNextPage: true,
  });
});

test("uses page numbers instead of the right arrow to detect the last page", async () => {
  const { extension } = loadLegacyWebtoonSource({
    body: fixture("legacy-list-last-page.html"),
  });

  const result = plain(await extension.getPopular(80));

  assert.equal(result.list.length, 1);
  assert.equal(result.hasNextPage, false);
});

test("keeps works that have no cover image", async () => {
  const { extension } = loadLegacyWebtoonSource({
    body: fixture("legacy-list-missing-cover.html"),
  });

  const result = plain(await extension.getPopular(1));

  assert.deepEqual(result, {
    list: [
      {
        name: "표지 없는 작품",
        link: "/webtoon/u-mr-sanitized-missing-cover",
        imageUrl: "",
      },
    ],
    hasNextPage: false,
  });
});

test("returns a normal empty page only when the wr-none marker exists", async () => {
  const { extension } = loadLegacyWebtoonSource({
    body: fixture("legacy-list-empty.html"),
  });

  assert.deepEqual(plain(await extension.getPopular(1)), {
    list: [],
    hasNextPage: false,
  });
});

test("reports a structure error when both list and empty markers are absent", async () => {
  const { extension } = loadLegacyWebtoonSource({
    body: "<html><body>maintenance</body></html>",
  });

  await assert.rejects(
    () => extension.getPopular(1),
    /structure error.*parserFamily=legacy.*missing=#webtoon-list-all,div\.wr-none/,
  );
});

test("reports malformed rows instead of silently dropping them", async () => {
  const { extension } = loadLegacyWebtoonSource({
    body: '<ul id="webtoon-list-all"><li><a href="/webtoon/123">제목 없음</a></li></ul>',
  });

  await assert.rejects(
    () => extension.getPopular(1),
    /structure error.*missing=span\.title\.white/,
  );
});

test("does not convert non-HTML or HTTP failures into empty pages", async () => {
  const nonHtml = loadLegacyWebtoonSource({
    body: "{}",
    headers: { "content-type": "application/json" },
  });
  const serverError = loadLegacyWebtoonSource({ statusCode: 503 });

  await assert.rejects(
    () => nonHtml.extension.getPopular(1),
    /non-HTML response/,
  );
  await assert.rejects(
    () => serverError.extension.getPopular(1),
    /HTTP 503/,
  );
});
