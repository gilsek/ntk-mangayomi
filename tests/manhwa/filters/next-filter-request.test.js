const assert = require("node:assert/strict");
const test = require("node:test");

const { loadManhwaSource } = require("../helpers/load-manhwa-source");
const { TestDocument } = require("../search/test-document");

const jsonResponse = {
  body: JSON.stringify({ works: [], hasMore: false }),
  headers: { "content-type": "application/json; charset=utf-8" },
  statusCode: 200,
};

function byType(filters, type) {
  const filter = filters.find((candidate) => candidate.type === type);
  assert.ok(filter, `missing filter type=${type}`);
  return filter;
}

async function requestFor(page, filters) {
  const { extension, requests } = loadManhwaSource({ responses: [jsonResponse] });
  await extension.search("   ", page, filters || extension.getFilterList());
  assert.equal(requests.length, 1);
  return new URL(requests[0].url);
}

test("routes a blank title to the default Manhwa list API contract", async () => {
  const url = await requestFor(2);

  assert.equal(url.origin, "https://sbxh9.com");
  assert.equal(url.pathname, "/api/manhwa-list");
  assert.equal(url.searchParams.get("status"), "ongoing");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("pageSize"), "49");
  assert.equal(url.searchParams.get("withTotal"), "1");
  assert.equal(url.searchParams.has("q"), false);
  assert.equal(url.searchParams.has("g"), false);
  assert.equal(url.searchParams.has("sort"), false);
});

test("serializes completed status, sort, and included or excluded genres", async () => {
  const filters = loadManhwaSource().extension.getFilterList();
  byType(filters, "status").state = 2;
  byType(filters, "sort").state = 3;
  const genres = byType(filters, "genres").state;
  genres.find((genre) => genre.value === "순정").state = 1;
  genres.find((genre) => genre.value === "판타지").state = 2;

  const url = await requestFor(3, filters);

  assert.equal(url.searchParams.get("status"), "completed");
  assert.equal(url.searchParams.get("sort"), "views");
  assert.equal(url.searchParams.get("g"), "순정,-판타지");
  assert.equal(url.searchParams.get("page"), "3");
});

test("omits the live all-status and default newest sort values", async () => {
  const filters = loadManhwaSource().extension.getFilterList();
  byType(filters, "status").state = 0;
  byType(filters, "sort").state = 0;

  const url = await requestFor(1, filters);

  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("sort"), false);
});

test("omits invalid indexes, genre states, and unobserved genres", async () => {
  const filters = loadManhwaSource().extension.getFilterList();
  byType(filters, "status").state = 999;
  byType(filters, "sort").state = -1;
  byType(filters, "genres").state[0].state = 7;
  byType(filters, "genres").state.push({
    type_name: "TriState",
    type: "genre",
    name: "관찰되지 않은 장르",
    value: "unknown",
    state: 1,
  });

  const url = await requestFor(1, filters);

  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("sort"), false);
  assert.equal(url.searchParams.has("g"), false);
});

test("omits filter option values outside the live Manhwa allowlists", async () => {
  const filters = loadManhwaSource().extension.getFilterList();
  byType(filters, "status").values[1].value = "archived";
  byType(filters, "sort").values[0].value = "random";

  const url = await requestFor(1, filters);

  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("sort"), false);
});

test("a non-empty title takes precedence over every list filter", async () => {
  const { extension, requests } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [{ body: '<div class="ep-empty"></div>', headers: { "content-type": "text/html" }, statusCode: 200 }],
  });
  const filters = extension.getFilterList();
  byType(filters, "status").state = 2;
  byType(filters, "sort").state = 3;

  await extension.search("원피스", 1, filters);

  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("kind"), "manhwa");
  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("sort"), false);
});
