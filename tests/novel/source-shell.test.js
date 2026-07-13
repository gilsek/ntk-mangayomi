const assert = require("node:assert/strict");
const test = require("node:test");

const { loadNovelSource } = require("./helpers/load-novel-source");

const expectedTabletUserAgent =
  "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

test("exposes the frozen Legacy NTK Novel metadata", () => {
  const { sources } = loadNovelSource();

  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 260713003);
  assert.equal(sources[0].name, "NTK Novel");
  assert.equal(sources[0].baseUrl, "https://newtoki1.org");
  assert.equal(sources[0].version, "0.301");
  assert.equal(sources[0].itemType, 2);
  assert.equal(sources[0].isManga, false);
  assert.equal(sources[0].isNsfw, true);
  assert.equal(sources[0].additionalParams, "");
  assert.equal(sources[0].pkgPath, "novel/src/ko/ntk_novel.js");
  assert.match(sources[0].sourceCodeUrl, /\/ntk_novel\.js$/);
  assert.match(sources[0].notes, /Popular.*Latest/i);
  assert.match(sources[0].notes, /not implemented/i);
});

test("builds the Legacy host from a numeric preference", () => {
  const { extension } = loadNovelSource({
    preferences: { ntk_novel_legacy_domain_number: "12" },
  });

  assert.equal(extension.getLegacyBaseUrl(), "https://newtoki12.org");
});

test("uses domain 1 when the preference is absent or blank", () => {
  assert.equal(
    loadNovelSource().extension.getLegacyBaseUrl(),
    "https://newtoki1.org",
  );
  assert.equal(
    loadNovelSource({
      preferences: { ntk_novel_legacy_domain_number: "   " },
    }).extension.getLegacyBaseUrl(),
    "https://newtoki1.org",
  );
});

for (const value of ["-1", "1.5", "abc", "https://newtoki12.org"]) {
  test(`rejects invalid Legacy domain preference ${JSON.stringify(value)}`, () => {
    const { extension } = loadNovelSource({
      preferences: { ntk_novel_legacy_domain_number: value },
    });

    assert.throws(() => extension.getLegacyBaseUrl(), /domain number/i);
  });
}

test("builds Legacy headers from the selected domain", () => {
  const { extension } = loadNovelSource({
    preferences: { ntk_novel_legacy_domain_number: "12" },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(extension.getHeaders())), {
    Referer: "https://newtoki12.org/",
    "User-Agent": expectedTabletUserAgent,
  });
});

test("normalizes numeric relative and same-origin Novel work links", () => {
  const { extension } = loadNovelSource();

  assert.equal(extension.normalizeWorkLink("/novel/60079"), "/novel/60079");
  assert.equal(
    extension.normalizeWorkLink("https://newtoki1.org/novel/60079"),
    "/novel/60079",
  );
  assert.equal(
    extension.normalizeWorkLink("https://NEWTOKI1.ORG:443/novel/60079"),
    "/novel/60079",
  );
});

test("rejects unsafe or malformed Novel work links without echoing them", () => {
  const { extension } = loadNovelSource();
  const invalidLinks = [
    "https://evil.example/novel/60079",
    "/novel/work",
    "/novel/60079?preview=1",
    "/novel/60079#chapter",
    "javascript:alert(1)",
    "//newtoki1.org/novel/60079",
    "/novel/%2e%2e",
    "/novel/60079%2fextra",
    "/novel/60079\\extra",
  ];

  for (const link of invalidLinks) {
    assert.throws(
      () => extension.normalizeWorkLink(link),
      (error) => {
        assert.match(error.message, /invalid work link/i);
        assert.equal(error.message.includes(link), false);
        return true;
      },
    );
  }
});

test("keeps one Client instance for the source lifetime", () => {
  const { extension } = loadNovelSource();
  const client = extension.client;

  assert.equal(extension.client, client);
});

test("exposes the numeric Legacy domain preference only", () => {
  const { extension } = loadNovelSource();

  assert.deepEqual(
    JSON.parse(JSON.stringify(extension.getSourcePreferences())),
    [
      {
        key: "ntk_novel_legacy_domain_number",
        editTextPreference: {
          title: "Legacy domain number",
          summary: "Enter only the number after newtoki.",
          value: "1",
          dialogTitle: "Legacy domain number",
          dialogMessage: "Example: 1 for https://newtoki1.org",
        },
      },
    ],
  );
});
