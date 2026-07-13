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

function asMangayomiElement(element) {
  return {
    attr(name) {
      return element?.attr(name) ?? "";
    },
    get text() {
      return element?.text ?? "";
    },
    select(selector) {
      return (element?.select(selector) ?? []).map(asMangayomiElement);
    },
    selectFirst(selector) {
      return asMangayomiElement(element?.selectFirst(selector) ?? null);
    },
  };
}

class MangayomiRuntimeDocument {
  constructor(html) {
    return asMangayomiElement(new TestDocument(html));
  }
}

test("exposes Latest and builds the fixed ongoing update query", async () => {
  const stop = new Error("stop after request");
  const { extension, requests } = loadNovelSource({
    responses() {
      throw stop;
    },
  });

  assert.equal(extension.supportsLatest, true);
  await assert.rejects(() => extension.getLatestUpdates(1), stop);

  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/novel");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    kind: "novel",
    page: "1",
    pub: "ongoing",
    sod: "desc",
    sst: "as_update",
  });
});

test("parses Latest cards and the semantic next page", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("legacy-latest-page.html"))],
  });

  assert.deepEqual(plain(await extension.getLatestUpdates(1)), {
    list: [
      {
        name: "최신 작품 1",
        link: "/novel/59388",
        imageUrl: "https://cdn.example/latest.webp",
      },
    ],
    hasNextPage: true,
  });
});

test("parses Latest when a missing selectFirst match stays truthy", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: MangayomiRuntimeDocument,
    responses: [htmlResponse(fixture("legacy-latest-page.html"))],
  });

  const result = plain(await extension.getLatestUpdates(1));
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "최신 작품 1");
});

test("accepts the explicit empty marker for Latest", async () => {
  const { extension } = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse(fixture("legacy-list-empty.html"))],
  });

  assert.deepEqual(plain(await extension.getLatestUpdates(1)), {
    list: [],
    hasNextPage: false,
  });
});

test("rejects Latest HTTP and content-type failures", async () => {
  const http = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [htmlResponse("failure", { statusCode: 502 })],
  }).extension;
  await assert.rejects(() => http.getLatestUpdates(1), /Latest.*HTTP.*502/i);

  const json = loadNovelSource({
    DocumentClass: TestDocument,
    responses: [
      htmlResponse("{}", {
        headers: { "content-type": "application/json" },
      }),
    ],
  }).extension;
  await assert.rejects(() => json.getLatestUpdates(1), /Latest.*not HTML/i);
});
