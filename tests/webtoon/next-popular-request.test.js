const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

const fixture = fs.readFileSync(
  path.join(__dirname, "fixtures", "next-rank-week.html"),
  "utf8",
);

function parsedRequest(requests) {
  assert.equal(requests.length, 1);
  return new URL(requests[0].url);
}

test("defaults the rebuild source to the Next family", () => {
  const { extension, sources } = loadWebtoonSource();

  assert.equal(sources[0].baseUrl, "https://sbxh9.com");
  assert.equal(sources[0].version, "0.104");
  assert.match(sources[0].notes, /Popular.*Latest.*title search.*filters/i);
  assert.match(sources[0].notes, /detail.*reader.*not implemented/i);
  assert.equal(extension.getParserFamily(), "next");
  assert.equal(extension.getNextBaseUrl(), "https://sbxh9.com");
});

test("builds the Next host from a numeric domain setting", () => {
  const { extension } = loadWebtoonSource({
    preferences: { ntk_webtoon_next_domain_number: " 12 " },
  });

  assert.equal(extension.getNextBaseUrl(), "https://sbxh12.com");
});

test("uses the default domain for a blank setting", () => {
  const { extension } = loadWebtoonSource({
    preferences: { ntk_webtoon_next_domain_number: "   " },
  });

  assert.equal(extension.getNextBaseUrl(), "https://sbxh9.com");
});

for (const value of ["-1", "1.5", "abc", "https://sbxh9.com"]) {
  test(`rejects invalid Next domain number ${value}`, () => {
    const { extension } = loadWebtoonSource({
      preferences: { ntk_webtoon_next_domain_number: value },
    });

    assert.throws(() => extension.getNextBaseUrl(), /domain number/i);
  });
}

test("requests the weekly Next webtoon ranking for Popular page one", async () => {
  const { extension, requests } = loadWebtoonSource({ body: fixture });

  await extension.getPopular(1);

  const url = parsedRequest(requests);
  assert.equal(url.origin, "https://sbxh9.com");
  assert.equal(url.pathname, "/rank");
  assert.equal(url.searchParams.get("period"), "week");
  assert.equal(url.searchParams.get("kind"), "webtoon");
  assert.equal(requests[0].headers.Referer, "https://sbxh9.com/");
});

test("returns an empty Popular page after the fixed ranking page", async () => {
  const { extension, requests } = loadWebtoonSource();

  const result = await extension.getPopular(2);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    list: [],
    hasNextPage: false,
  });
  assert.equal(requests.length, 0);
});

test("keeps Legacy latest and filters behind the Legacy preference", () => {
  const { extension } = loadWebtoonSource({
    preferences: { ntk_webtoon_parser_family: "legacy" },
  });

  assert.equal(extension.supportsLatest, true);
  assert.ok(extension.getFilterList().length > 0);
});

test("exposes separate Next number and Legacy URL preferences", () => {
  const { extension } = loadWebtoonSource();

  const preferences = extension.getSourcePreferences();
  const nextDomain = preferences.find(
    (preference) => preference.key === "ntk_webtoon_next_domain_number",
  );
  const legacyUrl = preferences.find(
    (preference) => preference.key === "ntk_webtoon_base_url",
  );
  const parser = preferences.find(
    (preference) => preference.key === "ntk_webtoon_parser_family",
  );

  assert.equal(nextDomain.editTextPreference.value, "9");
  assert.equal(legacyUrl.editTextPreference.title, "Legacy Base URL");
  assert.deepEqual(Array.from(parser.listPreference.entries), ["Next", "Legacy"]);
  assert.deepEqual(Array.from(parser.listPreference.entryValues), ["next", "legacy"]);
  assert.equal(parser.listPreference.valueIndex, 0);
});
