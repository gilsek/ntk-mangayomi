const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

const fixture = fs.readFileSync(
  path.join(__dirname, "fixtures", "next-search-title.html"),
  "utf8",
);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("requests a contains title search on the Next site", async () => {
  const { extension, requests } = loadWebtoonSource({ body: fixture });
  await extension.search(" 뻐꾸기 ", 1, []);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("q"), "뻐꾸기");
  assert.equal(url.searchParams.get("field"), "title");
  assert.equal(url.searchParams.get("match"), "contains");
});

test("does not request an empty title or a second search page", async () => {
  for (const [query, page] of [["   ", 1], ["뻐꾸기", 2]]) {
    const { extension, requests } = loadWebtoonSource();
    assert.deepEqual(plain(await extension.search(query, page, [])), {
      list: [],
      hasNextPage: false,
    });
    assert.equal(requests.length, 0);
  }
});
