const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("returns only Next webtoon search cards in DOM order", async () => {
  const result = plain(
    await loadWebtoonSource({ body: fixture("next-search-title.html") })
      .extension.search("뻐꾸기", 1, []),
  );

  assert.deepEqual(result, {
    list: [
      {
        name: "뻐꾸기는 운다",
        link: "/webtoon/850661",
        imageUrl: "https://sbxh9.com/covers/850661.jpg",
      },
      {
        name: "웹툰 표지 없음",
        link: "/webtoon/u-no-cover",
        imageUrl: "",
      },
    ],
    hasNextPage: false,
  });
});

test("accepts a search container without valid webtoon cards", async () => {
  const result = plain(
    await loadWebtoonSource({
      body: '<div class="card-grid search-results-grid"><a class="card" href="/novel/1"><p class="subject">소설</p></a><a class="card" href="webtoon/2"><p class="subject">잘못된 링크</p></a></div>',
    }).extension.search("없음", 1, []),
  );

  assert.deepEqual(result, { list: [], hasNextPage: false });
});

test("accepts an explicit empty Next search page", async () => {
  const result = plain(
    await loadWebtoonSource({ body: '<div class="ep-empty">없음</div>' })
      .extension.search("없음", 1, []),
  );

  assert.deepEqual(result, { list: [], hasNextPage: false });
});

test("rejects a Next search page without its search results container", async () => {
  const { extension } = loadWebtoonSource({ body: "<main></main>" });

  await assert.rejects(
    () => extension.search("뻐꾸기", 1, []),
    /search structure error.*parserFamily=next.*missing=div\.search-results-grid,\.ep-empty/,
  );
});

test("rejects a selected Next webtoon search card without a title", async () => {
  const { extension } = loadWebtoonSource({
    body: '<div class="card-grid search-results-grid"><a class="card" href="/webtoon/1"><div class="thumb"></div></a></div>',
  });

  await assert.rejects(
    () => extension.search("뻐꾸기", 1, []),
    /search structure error.*parserFamily=next.*missing=p\.subject/,
  );
});

test("does not convert HTTP failures into empty search results", async () => {
  const { extension } = loadWebtoonSource({ statusCode: 403 });

  await assert.rejects(
    () => extension.search("뻐꾸기", 1, []),
    /Next Webtoon HTTP 403.*parserFamily=next/,
  );
});

test("does not convert non-HTML responses into empty search results", async () => {
  const { extension } = loadWebtoonSource({
    body: "{}",
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    () => extension.search("뻐꾸기", 1, []),
    /Next Webtoon non-HTML response.*parserFamily=next/,
  );
});
