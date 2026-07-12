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

const pageFixture = fixture("next-latest-page.html");

test("parses Next latest cards without using the platform icon", async () => {
  const result = plain(
    await loadWebtoonSource({ body: pageFixture }).extension.getLatestUpdates(1),
  );
  assert.deepEqual(result, {
    list: [
      {
        name: "뻐꾸기는 운다",
        link: "/webtoon/850661",
        imageUrl: "https://cdn.example/850661.jpg",
      },
      {
        name: "표지 없는 최신작",
        link: "/webtoon/u-no-cover",
        imageUrl: "",
      },
    ],
    hasNextPage: true,
  });
});

test("treats a disabled Next latest button as the last page", async () => {
  const result = plain(
    await loadWebtoonSource({
      body: fixture("next-latest-last-page.html"),
    }).extension.getLatestUpdates(10),
  );

  assert.equal(result.hasNextPage, false);
});

test("accepts an explicit empty Next latest page", async () => {
  const result = plain(
    await loadWebtoonSource({ body: '<div class="ep-empty">없음</div>' })
      .extension.getLatestUpdates(1),
  );

  assert.deepEqual(result, { list: [], hasNextPage: false });
});

test("accepts the observed centered empty Next latest page", async () => {
  const result = plain(
    await loadWebtoonSource({
      body: fixture("next-latest-empty-page.html"),
    }).extension.getLatestUpdates(183),
  );

  assert.deepEqual(result, { list: [], hasNextPage: false });
});

test("rejects a Next latest page without a card grid or empty marker", async () => {
  const { extension } = loadWebtoonSource({ body: "<main></main>" });

  await assert.rejects(
    () => extension.getLatestUpdates(1),
    /structure error.*parserFamily=next.*missing=div\.card-grid,\.ep-empty/,
  );
});

test("rejects a Next latest card without a title", async () => {
  const { extension } = loadWebtoonSource({
    body: '<div class="card-grid"><a class="card" href="/webtoon/1"><div class="thumb"></div></a></div>',
  });

  await assert.rejects(
    () => extension.getLatestUpdates(1),
    /structure error.*parserFamily=next.*missing=p\.subject/,
  );
});

test("rejects a Next latest grid without valid webtoon cards", async () => {
  const { extension } = loadWebtoonSource({
    body: '<div class="card-grid"><a class="card" href="/novel/1"><p class="subject">소설</p></a></div>',
  });

  await assert.rejects(
    () => extension.getLatestUpdates(1),
    /structure error.*parserFamily=next.*missing=latest cards/,
  );
});

test("does not convert HTTP failures into empty latest results", async () => {
  const { extension } = loadWebtoonSource({ statusCode: 403 });

  await assert.rejects(
    () => extension.getLatestUpdates(1),
    /Next Webtoon HTTP 403.*parserFamily=next/,
  );
});

test("does not convert non-HTML responses into empty latest results", async () => {
  const { extension } = loadWebtoonSource({
    body: "{}",
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    () => extension.getLatestUpdates(1),
    /Next Webtoon non-HTML response.*parserFamily=next/,
  );
});
