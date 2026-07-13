const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");
const { TestDocument } = require("../helpers/test-document");

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

test("builds the fixed Legacy Popular query", async () => {
  const stop = new Error("stop after request");
  const { extension, requests } = loadNovelSource({
    responses() {
      throw stop;
    },
  });

  await assert.rejects(() => extension.getPopular(1), stop);

  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/novel");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    kind: "novel",
    page: "1",
    pub: "all",
    sod: "desc",
    sst: "as_view",
  });
  assert.deepEqual(requests[0].headers, extension.getHeaders());
});

for (const page of [0, -1, 1.5, "2"]) {
  test(`rejects invalid Popular page ${JSON.stringify(page)} before requesting`, async () => {
    const { extension, requests } = loadNovelSource();

    await assert.rejects(() => extension.getPopular(page), /invalid page/i);
    assert.equal(requests.length, 0);
  });
}

test("keeps DOM order, removes duplicate works, and never uses platform logos", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("legacy-list-page.html"))],
  });

  assert.deepEqual(plain(await extension.getPopular(1)), {
    list: [
      {
        name: "인기 작품 1",
        link: "/novel/35155",
        imageUrl: "https://newtoki1.org/covers/35155.webp",
      },
      {
        name: "표지 없는 작품",
        link: "/novel/60079",
        imageUrl: "",
      },
    ],
    hasNextPage: true,
  });
});

test("uses the semantic next-page query instead of card count", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("legacy-list-last-page.html"))],
  });

  const result = plain(await extension.getPopular(3));
  assert.equal(result.list.length, 1);
  assert.equal(result.hasNextPage, false);
});

test("does not accept a next link for a different list contract", async () => {
  const html = fixture("legacy-list-last-page.html").replace(
    "</ul></div>",
    '<li><a href="/novel?kind=novel&page=4&pub=ongoing&sod=desc&sst=as_update">4</a></li></ul></div>',
  );
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(html)],
  });

  assert.equal((await extension.getPopular(3)).hasNextPage, false);
});

test("accepts only an explicit empty list marker", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("legacy-list-empty.html"))],
  });

  assert.deepEqual(plain(await extension.getPopular(1)), {
    list: [],
    hasNextPage: false,
  });
});

test("rejects a Popular page without list or empty structure", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("<main>maintenance</main>")],
  });

  await assert.rejects(() => extension.getPopular(1), /Popular.*structure/i);
});

test("rejects a selected Popular card without a title", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse(
        '<div class="list-wrap"><ul id="webtoon-list-all"><li><div class="img-item"><a href="/novel/1"><img class="theme-thumb-img" src="/cover.webp"></a></div></li></ul></div>',
      ),
    ],
  });

  await assert.rejects(() => extension.getPopular(1), /malformed.*Popular/i);
});

test("rejects a selected Popular card with a non-numeric Novel link", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse(
        '<div class="list-wrap"><ul id="webtoon-list-all"><li><div class="img-item"><a href="/novel/work"><img class="theme-thumb-img" src="/cover.webp"></a><span class="title white">Broken</span></div></li></ul></div>',
      ),
    ],
  });

  await assert.rejects(() => extension.getPopular(1), /malformed.*Popular/i);
});

test("rejects Popular HTTP failures without exposing a response body", async () => {
  const secretBody = "private-response-body";
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(secretBody, { statusCode: 503 })],
  });

  await assert.rejects(
    () => extension.getPopular(1),
    (error) => {
      assert.match(error.message, /Popular.*HTTP.*503/i);
      assert.equal(error.message.includes(secretBody), false);
      return true;
    },
  );
});

test("rejects non-HTML Popular responses", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse("{}", {
        headers: { "content-type": "application/json" },
      }),
    ],
  });

  await assert.rejects(() => extension.getPopular(1), /Popular.*not HTML/i);
});
