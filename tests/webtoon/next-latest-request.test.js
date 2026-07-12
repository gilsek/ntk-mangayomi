const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

const fixture = fs.readFileSync(
  path.join(__dirname, "fixtures", "next-latest-page.html"),
  "utf8",
);

test("exposes Latest for the Next family", () => {
  const { extension } = loadWebtoonSource();
  assert.equal(extension.supportsLatest, true);
});

test("requests the numbered Next latest page", async () => {
  const { extension, requests } = loadWebtoonSource({ body: fixture });
  await extension.getLatestUpdates(2);
  const url = new URL(requests[0].url);
  assert.equal(url.origin, "https://sbxh9.com");
  assert.equal(url.pathname, "/ing");
  assert.equal(url.searchParams.get("page"), "2");
});
