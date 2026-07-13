const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");
const { TestDocument } = require("../helpers/test-document");

const fixture = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "search", "legacy-title-search.html"),
  "utf8",
);

function htmlResponse(body, overrides = {}) {
  return {
    body,
    headers: { "content-type": "text/html; charset=utf-8" },
    statusCode: 200,
    ...overrides,
  };
}

test("parses title search cards and its exact semantic next page", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture)],
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(await extension.search("천마", 1, []))),
    {
      list: [{
        name: "천마 검색 결과",
        link: "/novel/123",
        imageUrl: "https://newtoki1.org/covers/123.webp",
      }],
      hasNextPage: true,
    },
  );
});

test("rejects title search HTTP, content-type, and structure failures", async () => {
  const forbidden = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("denied", { statusCode: 403 })],
  }).extension;
  const json = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("{}", { headers: { "content-type": "application/json" } })],
  }).extension;
  const missing = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("<main>maintenance</main>")],
  }).extension;

  await assert.rejects(() => forbidden.search("천마", 1, []), /search.*HTTP.*403/i);
  await assert.rejects(() => json.search("천마", 1, []), /search.*not HTML/i);
  await assert.rejects(() => missing.search("천마", 1, []), /search.*structure/i);
});

test("accepts only the explicit empty marker for an empty title result", async () => {
  const empty = fs.readFileSync(
    path.resolve(__dirname, "..", "fixtures", "lists", "legacy-list-empty.html"),
    "utf8",
  );
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(empty)],
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(await extension.search("없는제목", 1, []))),
    { list: [], hasNextPage: false },
  );
});
