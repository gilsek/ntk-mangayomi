const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

const fixture = fs.readFileSync(
  path.join(__dirname, "fixtures", "next-filter-page.json"),
  "utf8",
);
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFilterSource(options = {}) {
  return loadWebtoonSource({ headers: jsonHeaders, ...options });
}

test("parses Next filtered works and pagination", async () => {
  const { extension } = loadFilterSource({ body: fixture });

  const result = plain(
    await extension.fetchNextFilters(1, extension.getFilterList()),
  );

  assert.deepEqual(result, {
    list: [
      {
        name: "필터 작품",
        link: "/webtoon/850661",
        imageUrl: "https://aws-cdn1.site/wt/thumbs/850661.jpg",
      },
      {
        name: "표지 없는 작품",
        link: "/webtoon/opaque-key",
        imageUrl: "",
      },
    ],
    hasNextPage: true,
  });
});

test("accepts an empty last Next filter page", async () => {
  const { extension } = loadFilterSource({
    body: JSON.stringify({ works: [], hasMore: false }),
  });

  const result = plain(await extension.fetchNextFilters(2, []));

  assert.deepEqual(result, { list: [], hasNextPage: false });
});

test("does not convert HTTP failures into empty filtered results", async () => {
  const { extension } = loadFilterSource({ statusCode: 403 });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon HTTP 403.*parserFamily=next/,
  );
});

test("rejects non-JSON Next filter responses", async () => {
  const { extension } = loadWebtoonSource({
    body: "<main></main>",
    headers: { "content-type": "text/html" },
  });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon non-JSON response.*parserFamily=next/,
  );
});

test("rejects malformed Next filter JSON", async () => {
  const { extension } = loadFilterSource({ body: "{" });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon filter JSON error.*parserFamily=next/,
  );
});

test("rejects a Next filter payload without works", async () => {
  const { extension } = loadFilterSource({
    body: JSON.stringify({ hasMore: false }),
  });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon filter structure error.*parserFamily=next/,
  );
});

test("rejects a null Next filter payload as a structure error", async () => {
  const { extension } = loadFilterSource({ body: "null" });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon filter structure error.*parserFamily=next/,
  );
});

test("rejects a non-boolean Next filter hasMore", async () => {
  const { extension } = loadFilterSource({
    body: JSON.stringify({ works: [], hasMore: "false" }),
  });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon filter structure error.*parserFamily=next/,
  );
});

test("rejects a Next filtered work without a title", async () => {
  const { extension } = loadFilterSource({
    body: JSON.stringify({
      works: [{ sourceWorkId: 1, title: "   " }],
      hasMore: false,
    }),
  });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon filter work structure error.*missing=title/,
  );
});

test("rejects a Next filtered work without a valid source ID", async () => {
  const { extension } = loadFilterSource({
    body: JSON.stringify({
      works: [{ sourceWorkId: "", title: "작품" }],
      hasMore: false,
    }),
  });

  await assert.rejects(
    () => extension.fetchNextFilters(1, []),
    /Next Webtoon filter work structure error.*missing=sourceWorkId/,
  );
});
