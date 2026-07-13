const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("./helpers/load-novel-source");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function readIndex() {
  return JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "index.json"), "utf8"),
  );
}

function assertPublishedNovelMetadata(novel) {
  assert.equal(novel.id, 260713003);
  assert.equal(novel.name, "NTK Novel");
  assert.equal(novel.baseUrl, "https://newtoki1.org");
  assert.equal(novel.version, "0.301");
  assert.equal(novel.itemType, 2);
  assert.equal(novel.isManga, false);
  assert.equal(novel.isNsfw, true);
  assert.equal(novel.additionalParams, "");
  assert.equal(
    novel.sourceCodeUrl,
    "https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/novel/src/ko/ntk_novel.js",
  );
  assert.match(novel.notes, /Legacy Popular and Latest are implemented/i);
  assert.match(novel.notes, /Search.*filters.*detail.*chapters.*reader.*not implemented/i);
}

test("publishes exactly one rebuilt NTK Novel index entry", () => {
  const entries = readIndex();
  const novelEntries = entries.filter(
    (entry) => entry.id === 240710003 || entry.id === 260713003,
  );

  assert.equal(novelEntries.length, 1);
  assertPublishedNovelMetadata(novelEntries[0]);
});

test("keeps embedded NTK Novel metadata aligned with the public manifest", () => {
  const { sources } = loadNovelSource();

  assert.equal(sources.length, 1);
  assertPublishedNovelMetadata(sources[0]);
});
