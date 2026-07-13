const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");
const { TestDocument } = require("../helpers/test-document");

const fixture = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "filters", "legacy-filtered-list.html"),
  "utf8",
);

function htmlResponse(body) {
  return {
    body,
    headers: { "content-type": "text/html; charset=utf-8" },
    statusCode: 200,
  };
}

function selectedFilters(extension) {
  const filters = extension.getFilterList();
  filters.find((filter) => filter.type === "author").state = "작가";
  filters.find((filter) => filter.type === "initial").state = 1;
  filters.find((filter) => filter.type === "status").state = 2;
  filters.find((filter) => filter.type === "genre").state = 3;
  filters.find((filter) => filter.type === "platform").state = 4;
  filters.find((filter) => filter.type === "sort").state = 5;
  return filters;
}

test("parses a filtered list and requires an exact matching next page", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture)],
  });

  const result = JSON.parse(
    JSON.stringify(await extension.search("", 3, selectedFilters(extension))),
  );

  assert.deepEqual(result, {
    list: [{
      name: "필터 작품",
      link: "/novel/456",
      imageUrl: "https://cdn.example/456.webp",
    }],
    hasNextPage: true,
  });
});

test("a next link for a different filter contract is not accepted", async () => {
  const mismatched = fixture.replace("pub=completed", "pub=ongoing");
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(mismatched)],
  });

  const result = await extension.search("", 3, selectedFilters(extension));
  assert.equal(result.hasNextPage, false);
});
