const assert = require("node:assert/strict");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

function parsedRequest(requests) {
  assert.equal(requests.length, 1);
  return new URL(requests[0].url);
}

test("builds the popular request with the fixed Legacy parameters", async () => {
  const { extension, requests } = loadWebtoonSource();

  await extension.getPopular(1);

  const url = parsedRequest(requests);
  assert.equal(url.origin, "https://newtoki1.org");
  assert.equal(url.pathname, "/webtoon");
  assert.equal(url.searchParams.get("kind"), "webtoon");
  assert.equal(url.searchParams.get("pub"), "ongoing");
  assert.equal(url.searchParams.get("sst"), "as_view");
  assert.equal(url.searchParams.get("sod"), "desc");
  assert.equal(url.searchParams.has("page"), false);
});

test("builds the latest request and includes pages after page one", async () => {
  const { extension, requests } = loadWebtoonSource();

  await extension.getLatestUpdates(2);

  const url = parsedRequest(requests);
  assert.equal(url.searchParams.get("sst"), "as_update");
  assert.equal(url.searchParams.get("page"), "2");
});

test("uses the manually configured base URL without duplicate slashes", async () => {
  const { extension, requests } = loadWebtoonSource({
    preferences: {
      ntk_webtoon_base_url: "https://mirror.example/",
      ntk_webtoon_parser_family: "legacy",
    },
  });

  await extension.getPopular(1);

  assert.equal(parsedRequest(requests).origin, "https://mirror.example");
  assert.equal(requests[0].url.includes("//webtoon"), false);
});

test("sends normal title search parameters and never generates __q", async () => {
  const { extension, requests } = loadWebtoonSource();

  await extension.search("테스트", 1, []);

  const url = parsedRequest(requests);
  assert.equal(url.searchParams.get("stx"), "테스트");
  assert.equal(url.searchParams.get("sst"), "as_update");
  assert.equal(url.pathname.includes("__q"), false);
});

test("returns an empty page without a request for one-character titles", async () => {
  const { extension, requests } = loadWebtoonSource();

  const result = await extension.search("가", 1, []);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    list: [],
    hasNextPage: false,
  });
  assert.equal(requests.length, 0);
});

test("still requests an empty title when filters are present", async () => {
  const { extension, requests } = loadWebtoonSource();

  await extension.search("", 1, [
    {
      type: "category",
      state: 1,
      values: [
        { name: "전체", value: "" },
        { name: "성인웹툰", value: "성인웹툰" },
      ],
    },
  ]);

  const url = parsedRequest(requests);
  assert.equal(url.searchParams.has("stx"), false);
  assert.equal(url.searchParams.get("toon"), "성인웹툰");
});

test("rejects unsupported parser families instead of falling back", async () => {
  const { extension, requests } = loadWebtoonSource({
    preferences: { ntk_webtoon_parser_family: "next" },
  });

  await assert.rejects(() => extension.getPopular(1), /parserFamily=next/);
  assert.equal(requests.length, 0);
});
