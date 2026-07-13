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

test("exposes Latest and requests only the first Manhwa updates page", async () => {
  const stopAfterRequest = new Error("stop after request");
  const { extension, requests } = loadManhwaSource({
    responses() {
      throw stopAfterRequest;
    },
  });

  assert.equal(extension.supportsLatest, true);
  await assert.rejects(() => extension.getLatestUpdates(1), stopAfterRequest);

  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/manhwa/updates");
  assert.equal(url.search, "");
  assert.deepEqual(requests[0].headers, extension.getHeaders());
});

test("returns a fixed empty Latest page after page one without a request", async () => {
  const { extension, requests } = loadManhwaSource();

  assert.deepEqual(plain(await extension.getLatestUpdates(2)), {
    list: [],
    hasNextPage: false,
  });
  assert.equal(requests.length, 0);
});

test("parses all 60 Manhwa update cards in DOM order", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("next-latest-page.html"))],
  });

  const result = plain(await extension.getLatestUpdates(1));

  assert.equal(result.hasNextPage, false);
  assert.equal(result.list.length, 60);
  assert.deepEqual(
    result.list.map((item) => item.name),
    Array.from({ length: 60 }, (_, index) =>
      `Latest ${String(index + 1).padStart(2, "0")}`,
    ),
  );
  assert.equal(result.list[0].name, "Latest 01");
  assert.notEqual(result.list[0].name, "Wrong Episode Title 01 77화");
  assert.equal(result.list[0].link, "/manhwa/21737");
  assert.equal(result.list[1].link, "/manhwa/3688");
  assert.equal(result.list[0].imageUrl, "https://sbxh9.com/covers/latest-01.jpg");
  assert.equal(result.list[1].imageUrl, "");
  assert.equal(result.list[2].imageUrl, "");
  assert.equal(
    result.list.some((item) => item.imageUrl.includes("platform-logo")),
    false,
  );
  assert.equal(result.list.some((item) => item.name === "Ignore Webtoon"), false);
});

test("returns a normal empty Latest page only for the board empty marker", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("next-latest-empty.html"))],
  });

  assert.deepEqual(plain(await extension.getLatestUpdates(1)), {
    list: [],
    hasNextPage: false,
  });
});

test("rejects a Latest HTTP failure", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("", { statusCode: 503 })],
  });

  await assert.rejects(() => extension.getLatestUpdates(1), /latest.*http|http.*latest/i);
});

test("rejects a non-HTML Latest response", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse("{}", { headers: { "content-type": "application/json" } }),
    ],
  });

  await assert.rejects(() => extension.getLatestUpdates(1), /latest.*html|html.*latest/i);
});

test("rejects a Latest page without its required container", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("<main><p>maintenance</p></main>")],
  });

  await assert.rejects(() => extension.getLatestUpdates(1), /latest.*structure|structure.*latest/i);
});

test("rejects a Manhwa update card without an upd-title", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse(
        '<main class="container manhwa-updates"><ul class="upd-grid"><li class="upd-card"><a class="upd-card-main" title="Wrong Episode Title 1화" href="/manhwa/broken/episode"><div class="upd-thumb"><img src="/cover.jpg"></div></a><a class="upd-allbtn" href="/manhwa/broken">전편보기</a></li></ul></main>',
      ),
    ],
  });

  await assert.rejects(() => extension.getLatestUpdates(1), /malformed.*latest|latest.*malformed/i);
});

test("does not accept unrelated Webtoon cards as Manhwa updates", async () => {
  const { extension } = loadManhwaSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse(
        '<main class="container manhwa-updates"><ul class="upd-grid"><li class="upd-card"><a class="upd-card-main" href="/webtoon/other/episode"><div class="upd-title">Other source</div></a><a class="upd-allbtn" href="/webtoon/other">전편보기</a></li></ul></main>',
      ),
    ],
  });

  await assert.rejects(() => extension.getLatestUpdates(1), /latest.*cards|cards.*latest/i);
});
