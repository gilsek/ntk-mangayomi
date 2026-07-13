const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { loadNovelSource } = require("../helpers/load-novel-source");

function loadPreSplitUtilities() {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "javascript",
      "manga",
      "src",
      "ko",
      "ntk.js",
    ),
    "utf8",
  );
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(
    `${source}\n;module.exports = { htmlDecode, stripTags, attrValue, firstMatch, allMatches, parseStatus, toEpochMillis, parseDetailsHtml, parseChaptersHtml };`,
    context,
  );
  return context.module.exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("keeps bounded pre-split Legacy detail utility behavior for valid HTML", () => {
  const legacy = loadPreSplitUtilities();
  const { helpers: current } = loadNovelSource();
  const html = fs.readFileSync(
    path.resolve(__dirname, "..", "fixtures", "detail", "legacy-detail.html"),
    "utf8",
  );
  const baseUrl = "https://newtoki1.org";

  for (const value of ["A &amp; B", "&quot;x&quot;", "&#39;x&#39;", ""]) {
    assert.equal(current.htmlDecode(value), legacy.htmlDecode(value));
  }
  assert.equal(
    current.stripTags("<b>A</b><br>B &amp; C"),
    legacy.stripTags("<b>A</b><br>B &amp; C"),
  );
  assert.equal(
    current.attrValue('<a href="/novel/1">', "href"),
    legacy.attrValue('<a href="/novel/1">', "href"),
  );
  assert.equal(
    current.firstMatch("abc123", /(\d+)/),
    legacy.firstMatch("abc123", /(\d+)/),
  );
  assert.deepEqual(
    plain(current.allMatches("a1b2", /(\d)/g)),
    plain(legacy.allMatches("a1b2", /(\d)/g)),
  );
  for (const value of ["연재중", "완결", "휴재"]) {
    assert.equal(current.parseStatus(value), legacy.parseStatus(value));
  }
  for (const value of ["2026.07.14", "26.07.14", "invalid"]) {
    assert.equal(current.toEpochMillis(value), legacy.toEpochMillis(value));
  }

  assert.deepEqual(
    plain(current.parseDetailsHtml(html, baseUrl)),
    plain(legacy.parseDetailsHtml(html, baseUrl)),
  );
  assert.deepEqual(
    plain(current.parseChaptersHtml(html, baseUrl, "60079")),
    plain(legacy.parseChaptersHtml(html, baseUrl)),
  );
});
