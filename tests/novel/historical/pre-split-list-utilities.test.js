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
    `${source}\n;module.exports = { trimSlash, joinUrl, appendQuery, absoluteUrl };`,
    context,
  );
  return context.module.exports;
}

test("keeps the stage-scoped pre-split URL utility behavior", () => {
  const legacy = loadPreSplitUtilities();
  const { helpers: current } = loadNovelSource();

  const trimInputs = [
    "https://newtoki1.org///",
    "https://newtoki1.org",
    "",
  ];
  for (const value of trimInputs) {
    assert.equal(current.trimSlash(value), legacy.trimSlash(value));
  }

  const joinInputs = [
    ["https://newtoki1.org/", "/novel"],
    ["https://newtoki1.org", "novel"],
    ["https://newtoki1.org", "https://cdn.example/cover.webp"],
  ];
  for (const [baseUrl, value] of joinInputs) {
    assert.equal(
      current.joinUrl(baseUrl, value),
      legacy.joinUrl(baseUrl, value),
    );
  }

  const params = {
    kind: "novel",
    page: 2,
    pub: "all",
    empty: "",
  };
  assert.equal(
    current.appendQuery("https://newtoki1.org/novel", params),
    legacy.appendQuery("https://newtoki1.org/novel", params),
  );

  const coverInputs = [
    "/cover.jpg",
    "cover.jpg",
    "//cdn.example/cover.jpg",
    "https://cdn.example/cover.jpg",
    "",
  ];
  for (const value of coverInputs) {
    assert.equal(
      current.absoluteUrl("https://newtoki1.org", value),
      legacy.absoluteUrl("https://newtoki1.org", value),
    );
  }
});
