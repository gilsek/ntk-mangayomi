const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadManhwaSource } = require("../helpers/load-manhwa-source");

function fixture(name) {
  return fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "filters", name),
    "utf8",
  );
}

function jsonResponse(body, options = {}) {
  return {
    body,
    headers: { "content-type": "application/json; charset=utf-8" },
    statusCode: 200,
    ...options,
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function filterSearch(body, options = {}) {
  return loadManhwaSource({ responses: [jsonResponse(body, options)] }).extension.search(
    "",
    1,
    [],
  );
}

test("parses filtered Manhwa works, opaque IDs, covers, and hasMore", async () => {
  assert.deepEqual(plain(await filterSearch(fixture("page.json"))), {
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
    hasNextPage: true,
  });
});

test("accepts an empty final filtered page", async () => {
  assert.deepEqual(
    plain(await filterSearch(JSON.stringify({ works: [], hasMore: false }))),
    { list: [], hasNextPage: false },
  );
});

test("rejects malformed filter JSON", async () => {
  await assert.rejects(
    () => filterSearch("{"),
    /Manhwa filter JSON error.*parserFamily=next-filter/,
  );
});

test("rejects a non-JSON filter response", async () => {
  await assert.rejects(
    () => filterSearch("<main></main>", { headers: { "content-type": "text/html" } }),
    /Manhwa non-JSON response.*parserFamily=next-filter/,
  );
});

for (const payload of [
  { hasMore: false },
  { works: [] },
  { works: [], hasMore: "false" },
]) {
  test(`rejects missing or invalid filter payload fields ${JSON.stringify(payload)}`, async () => {
    await assert.rejects(
      () => filterSearch(JSON.stringify(payload)),
      /Manhwa filter structure error.*parserFamily=next-filter/,
    );
  });
}

test("rejects a filtered work without a source ID", async () => {
  await assert.rejects(
    () => filterSearch(JSON.stringify({ works: [{ title: "작품" }], hasMore: false })),
    /Manhwa filter work structure error.*missing=sourceWorkId/,
  );
});

test("rejects a filtered work without a title", async () => {
  await assert.rejects(
    () => filterSearch(JSON.stringify({ works: [{ sourceWorkId: "work", title: "  " }], hasMore: false })),
    /Manhwa filter work structure error.*missing=title/,
  );
});

test("rejects duplicate source IDs after canonical string conversion", async () => {
  await assert.rejects(
    () => filterSearch(JSON.stringify({
      works: [
        { sourceWorkId: 2, title: "첫 작품" },
        { sourceWorkId: "2", title: "중복 작품" },
      ],
      hasMore: false,
    })),
    /Manhwa filter structure error.*duplicate=sourceWorkId/,
  );
});

test("does not convert filter HTTP failures to empty results", async () => {
  await assert.rejects(
    () => filterSearch("", { statusCode: 503 }),
    /Manhwa HTTP 503.*parserFamily=next-filter/,
  );
});
