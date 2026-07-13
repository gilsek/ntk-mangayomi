const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadManhwaSource } = require("../helpers/load-manhwa-source");
const { TestDocument } = require("./test-document");

function fixture(name) {
  return fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "search", name),
    "utf8",
  );
}

function response(body, options = {}) {
  return {
    body,
    headers: { "content-type": "text/html; charset=utf-8" },
    statusCode: 200,
    ...options,
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("requests the first encoded Manhwa title search and ignores filters", async () => {
  const { extension, requests } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [response(fixture("title-results.html"))],
  });
  const filters = [
    { type: "status", state: 2, values: [{ value: "" }, { value: "ongoing" }, { value: "completed" }] },
    { type: "sort", state: 3, values: [{ value: "new" }, { value: "fresh" }, { value: "hot" }, { value: "views" }] },
  ];

  await extension.search(" 원피스 A&B ", 1, filters);

  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /q=%EC%9B%90%ED%94%BC%EC%8A%A4%20A%26B/);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("q"), "원피스 A&B");
  assert.equal(url.searchParams.get("kind"), "manhwa");
  assert.equal(url.searchParams.get("field"), "title");
  assert.equal(url.searchParams.get("match"), "contains");
  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("sort"), false);
  assert.equal(url.searchParams.has("g"), false);
});

test("does not request a title search after the fixed first page", async () => {
  const { extension, requests } = loadManhwaSource({ DocumentClass: TestDocument });

  assert.deepEqual(plain(await extension.search("원피스", 2, [])), {
    list: [],
    hasNextPage: false,
  });
  assert.equal(requests.length, 0);
});

test("returns only Manhwa cards in DOM order and rejects platform logos as covers", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [response(fixture("title-results.html"))],
  });

  assert.deepEqual(plain(await extension.search("원피스", 1, [])), {
    list: [
      {
        name: "원피스(ONE PIECE)",
        link: "/manhwa/2",
        imageUrl: "https://sbxh9.com/covers/one-piece.jpg",
      },
      {
        name: "표지 없는 작품",
        link: "/manhwa/u-opaque-work",
        imageUrl: "",
      },
    ],
    hasNextPage: false,
  });
});

test("accepts the explicit empty search result marker", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [response(fixture("empty-results.html"))],
  });

  assert.deepEqual(plain(await extension.search("없는 작품", 1, [])), {
    list: [],
    hasNextPage: false,
  });
});

test("rejects a search response without its result or empty structure", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [response("<main></main>")],
  });

  await assert.rejects(
    () => extension.search("원피스", 1, []),
    /Manhwa search structure error.*missing=div\.search-results-grid,\.ep-empty/,
  );
});

test("rejects a selected Manhwa search card without a title", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [
      response('<div class="search-results-grid"><a class="card" href="/manhwa/2"><div class="thumb"></div></a></div>'),
    ],
  });

  await assert.rejects(
    () => extension.search("원피스", 1, []),
    /Manhwa search card structure error.*missing=p\.subject/,
  );
});

test("does not convert title-search HTTP failures to empty results", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [response("", { statusCode: 403 })],
  });

  await assert.rejects(
    () => extension.search("원피스", 1, []),
    /Manhwa HTTP 403.*parserFamily=next-search/,
  );
});

test("rejects non-HTML title-search responses", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [response("{}", { headers: { "content-type": "application/json" } })],
  });

  await assert.rejects(
    () => extension.search("원피스", 1, []),
    /Manhwa non-HTML response.*parserFamily=next-search/,
  );
});
