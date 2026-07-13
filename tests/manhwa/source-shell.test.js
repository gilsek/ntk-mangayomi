const assert = require("node:assert/strict");
const test = require("node:test");

const { loadManhwaSource } = require("./helpers/load-manhwa-source");

const expectedTabletUserAgent =
  "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

test("exposes the frozen NTK Manhwa source metadata", () => {
  const { sources } = loadManhwaSource();

  assert.equal(sources.length, 1);
  assert.equal(sources[0].name, "NTK Manhwa");
  assert.equal(sources[0].id, 260713002);
  assert.equal(sources[0].baseUrl, "https://sbxh9.com");
  assert.equal(sources[0].itemType, 0);
  assert.equal(sources[0].isManga, true);
  assert.equal(sources[0].isNsfw, false);
  assert.equal(sources[0].appMinVerReq, "0.5.0");
  assert.equal(sources[0].pkgPath, "manga/src/ko/ntk_manhwa.js");
  assert.match(sources[0].sourceCodeUrl, /\/ntk_manhwa\.js$/);
  assert.match(sources[0].version, /^0\.\d+$/);
});

test("uses a numeric preference to build the current Next base URL", () => {
  const { extension } = loadManhwaSource({
    preferences: { ntk_manhwa_next_domain_number: "12" },
  });

  assert.equal(extension.getNextBaseUrl(), "https://sbxh12.com");
  assert.deepEqual(JSON.parse(JSON.stringify(extension.getSourcePreferences())), [
    {
      key: "ntk_manhwa_next_domain_number",
      editTextPreference: {
        title: "Next domain number",
        summary: "Enter only the number after sbxh.",
        value: "9",
        dialogTitle: "Next domain number",
        dialogMessage: "Example: 9 for https://sbxh9.com",
      },
    },
  ]);
});

test("falls back to domain 9 when the domain preference is absent or blank", () => {
  assert.equal(loadManhwaSource().extension.getNextBaseUrl(), "https://sbxh9.com");
  assert.equal(
    loadManhwaSource({
      preferences: { ntk_manhwa_next_domain_number: "   " },
    }).extension.getNextBaseUrl(),
    "https://sbxh9.com",
  );
});

for (const invalidValue of ["-1", "1.5", "abc", "https://sbxh12.com"]) {
  test(`rejects invalid domain preference ${JSON.stringify(invalidValue)}`, () => {
    const { extension } = loadManhwaSource({
      preferences: { ntk_manhwa_next_domain_number: invalidValue },
    });

    assert.throws(() => extension.getNextBaseUrl(), /domain number/i);
  });
}

test("builds frozen source headers and absolute URLs", () => {
  const { extension } = loadManhwaSource();

  assert.equal(extension.supportsLatest, true);
  assert.deepEqual(JSON.parse(JSON.stringify(extension.getHeaders())), {
    Referer: "https://sbxh9.com/",
    "User-Agent": expectedTabletUserAgent,
  });
  assert.equal(
    extension.toAbsoluteUrl("/images/cover.jpg"),
    "https://sbxh9.com/images/cover.jpg",
  );
  assert.equal(
    extension.toAbsoluteUrl("https://cdn.example/cover.jpg"),
    "https://cdn.example/cover.jpg",
  );
  assert.equal(extension.toAbsoluteUrl(""), "");
});

test("normalizes relative and same-origin absolute Manhwa links", () => {
  const { extension } = loadManhwaSource();

  assert.equal(extension.normalizeWorkLink("/manhwa/53483967"), "/manhwa/53483967");
  assert.equal(
    extension.normalizeWorkLink("https://sbxh9.com/manhwa/u-work"),
    "/manhwa/u-work",
  );
  assert.equal(
    extension.normalizeChapterLink("/manhwa/53483967/u-episode"),
    "/manhwa/53483967/u-episode",
  );
  assert.equal(
    extension.normalizeChapterLink("https://SBXH9.com/manhwa/u-work/42"),
    "/manhwa/u-work/42",
  );
});

function assertSafeLinkRejection(normalize, suppliedValue, errorPattern) {
  assert.throws(
    () => normalize(suppliedValue),
    (error) => {
      assert.match(error.message, errorPattern);
      assert.equal(error.message.includes(suppliedValue), false);
      return true;
    },
  );
}

test("rejects unsafe or malformed work links without echoing them", () => {
  const { extension } = loadManhwaSource();
  const invalidLinks = [
    "https://evil.example/manhwa/work",
    "/manhwa/work?preview=1",
    "/manhwa/work#chapter",
    "javascript:alert(1)",
    "data:text/plain,work",
    "//sbxh9.com/manhwa/work",
    "/manhwa/",
    "/manhwa/work/episode",
  ];

  for (const link of invalidLinks) {
    assertSafeLinkRejection(
      extension.normalizeWorkLink.bind(extension),
      link,
      /invalid work link/i,
    );
  }
});

test("rejects unsafe or malformed chapter links without echoing them", () => {
  const { extension } = loadManhwaSource();
  const invalidLinks = [
    "https://evil.example/manhwa/work/episode",
    "/manhwa/work/episode?preview=1",
    "/manhwa/work/episode#page",
    "javascript:alert(1)",
    "data:text/plain,episode",
    "//sbxh9.com/manhwa/work/episode",
    "/manhwa//episode",
    "/manhwa/work/",
    "/manhwa/work/episode/extra",
  ];

  for (const link of invalidLinks) {
    assertSafeLinkRejection(
      extension.normalizeChapterLink.bind(extension),
      link,
      /invalid chapter link/i,
    );
  }
});

test("keeps feature methods as isolated not-implemented delegates", async () => {
  const { extension, requests } = loadManhwaSource();
  const client = extension.client;

  await assert.rejects(() => extension.getPopular(1), /list.*not implemented/i);
  await assert.rejects(
    () => extension.getLatestUpdates(1),
    /list.*not implemented/i,
  );
  await assert.rejects(
    () => extension.search("title", 1, []),
    /search.*not implemented/i,
  );
  assert.throws(() => extension.getFilterList(), /filter.*not implemented/i);
  await assert.rejects(
    () => extension.getDetail("/manhwa/work"),
    /detail.*not implemented/i,
  );
  await assert.rejects(
    () => extension.getPageList("/manhwa/work/episode"),
    /reader.*not implemented/i,
  );

  assert.equal(extension.client, client);
  assert.equal(requests.length, 0);
});
