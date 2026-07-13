const assert = require("node:assert/strict");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");

function paramsOf(request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}

test("a title of two or more characters takes priority over every filter", async () => {
  const stop = new Error("stop after request");
  const { extension, requests } = loadNovelSource({
    responses() {
      throw stop;
    },
  });
  const filters = extension.getFilterList();
  filters.find((filter) => filter.type === "author").state = "무시할 작가";
  for (const filter of filters.filter((item) => item.type_name === "SelectFilter")) {
    filter.state = filter.values.length - 1;
  }

  await assert.rejects(() => extension.search("  천마  ", 2, filters), stop);

  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url).pathname, "/novel");
  assert.deepEqual(paramsOf(requests[0]), {
    kind: "novel",
    page: "2",
    pub: "all",
    sod: "desc",
    sst: "as_update",
    stx: "천마",
  });
});

test("a one-character title returns empty without requesting or applying filters", async () => {
  const { extension, requests } = loadNovelSource();
  const filters = extension.getFilterList();
  filters.find((filter) => filter.type === "status").state = 2;

  assert.deepEqual(
    JSON.parse(JSON.stringify(await extension.search(" 천 ", 1, filters))),
    { list: [], hasNextPage: false },
  );
  assert.equal(requests.length, 0);
});

test("an empty title serializes only selected allowlisted filters", async () => {
  const stop = new Error("stop after request");
  const { extension, requests } = loadNovelSource({
    responses() {
      throw stop;
    },
  });
  const filters = extension.getFilterList();
  filters.find((filter) => filter.type === "author").state = "  작가  ";
  filters.find((filter) => filter.type === "initial").state = 1;
  filters.find((filter) => filter.type === "status").state = 2;
  filters.find((filter) => filter.type === "genre").state = 3;
  filters.find((filter) => filter.type === "platform").state = 4;
  filters.find((filter) => filter.type === "sort").state = 5;

  await assert.rejects(() => extension.search("   ", 3, filters), stop);

  assert.deepEqual(paramsOf(requests[0]), {
    author: "작가",
    jaum: "ㄱ",
    kind: "novel",
    page: "3",
    plat: "munpia",
    pub: "completed",
    sod: "desc",
    sst: "as_episode",
    tag: "19금",
  });
});

test("caller-supplied option values outside the allowlists are never sent", async () => {
  const stop = new Error("stop after request");
  const { extension, requests } = loadNovelSource({
    responses() {
      throw stop;
    },
  });
  const malicious = [
    { type: "status", state: 0, values: [{ value: "private" }] },
    { type: "genre", state: 0, values: [{ value: "<script>" }] },
    { type: "platform", state: 0, values: [{ value: "external" }] },
    { type: "sort", state: 0, values: [{ value: "random" }] },
    { type: "initial", state: 0, values: [{ value: "../" }] },
  ];

  await assert.rejects(() => extension.search("", 1, malicious), stop);

  assert.deepEqual(paramsOf(requests[0]), {
    kind: "novel",
    page: "1",
    pub: "all",
    sod: "desc",
    sst: "as_update",
  });
});
