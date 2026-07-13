const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadManhwaSource } = require("../helpers/load-manhwa-source");
const { TestDocument } = require("./test-document");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture(name) {
  return fs.readFileSync(
    path.resolve(__dirname, "..", "fixtures", "lists", name),
    "utf8",
  );
}

function htmlResponse(body, overrides = {}) {
  return {
    body,
    headers: { "content-type": "text/html; charset=utf-8" },
    statusCode: 200,
    ...overrides,
  };
}

test("requests the weekly Manhwa ranking with fixed Next parameters", async () => {
  const stopAfterRequest = new Error("stop after request");
  const { extension, requests } = loadManhwaSource({
    responses() {
      throw stopAfterRequest;
    },
  });

  await assert.rejects(() => extension.getPopular(1), stopAfterRequest);

  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/rank");
  assert.equal(url.searchParams.get("period"), "week");
  assert.equal(url.searchParams.get("kind"), "manhwa");
  assert.equal([...url.searchParams].length, 2);
  assert.deepEqual(requests[0].headers, extension.getHeaders());
});

test("returns a fixed empty Popular page after page one without a request", async () => {
  const { extension, requests } = loadManhwaSource();

  assert.deepEqual(plain(await extension.getPopular(2)), {
    list: [],
    hasNextPage: false,
  });
  assert.equal(requests.length, 0);
});

test("parses all 50 weekly ranking cards in champion runner and row order", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("next-rank-week.html"))],
  });

  const result = plain(await extension.getPopular(1));

  assert.equal(result.hasNextPage, false);
  assert.equal(result.list.length, 50);
  assert.deepEqual(
    result.list.map((item) => item.name),
    Array.from({ length: 50 }, (_, index) =>
      `Weekly ${String(index + 1).padStart(2, "0")}`,
    ),
  );
  assert.equal(result.list[0].link, "/manhwa/u-mr9jpf7z-rfhu");
  assert.equal(result.list[1].link, "/manhwa/2");
  assert.equal(result.list[0].imageUrl, "https://sbxh9.com/covers/weekly-01.jpg");
  assert.equal(result.list[2].imageUrl, "");
  assert.equal(result.list[3].imageUrl, "");
  assert.equal(
    result.list.some((item) => item.imageUrl.includes("platform-logo")),
    false,
  );
  assert.equal(result.list.some((item) => item.name === "Ignore Webtoon"), false);
});

test("rejects a weekly ranking HTTP failure", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("", { statusCode: 503 })],
  });

  await assert.rejects(() => extension.getPopular(1), /popular.*http|http.*popular/i);
});

test("rejects a non-HTML weekly ranking response", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse("{}", { headers: { "content-type": "application/json" } }),
    ],
  });

  await assert.rejects(() => extension.getPopular(1), /popular.*html|html.*popular/i);
});

test("rejects a weekly ranking without the required page container", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("<main><p>maintenance</p></main>")],
  });

  await assert.rejects(() => extension.getPopular(1), /popular.*structure|structure.*popular/i);
});

test("rejects a selected weekly ranking card without a title", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse(
        '<main class="rank-v2-page"><a class="rank-v2-champion" href="/manhwa/broken"><div class="rank-v2-cover"><img src="/cover.jpg"></div></a></main>',
      ),
    ],
  });

  await assert.rejects(() => extension.getPopular(1), /malformed.*popular|popular.*malformed/i);
});

test("does not accept unrelated Webtoon rows as a weekly Manhwa ranking", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse(
        '<main class="rank-v2-page"><a class="rank-v2-row" href="/webtoon/not-manhwa"><div class="rank-v2-row-title"><strong>Other source</strong></div></a></main>',
      ),
    ],
  });

  await assert.rejects(() => extension.getPopular(1), /popular.*cards|cards.*popular/i);
});
