const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadManhwaSource } = require("./helpers/load-manhwa-source");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function readIndex() {
  return JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "index.json"), "utf8"),
  );
}

function assertPublishedManhwaMetadata(manhwa) {
  assert.equal(manhwa.id, 260713002);
  assert.equal(manhwa.name, "NTK Manhwa");
  assert.equal(manhwa.baseUrl, "https://sbxh9.com");
  assert.equal(manhwa.version, "0.205");
  assert.equal(manhwa.itemType, 0);
  assert.equal(manhwa.isManga, true);
  assert.equal(manhwa.additionalParams, "");
  assert.equal(
    path.posix.basename(new URL(manhwa.sourceCodeUrl).pathname),
    "ntk_manhwa.js",
  );
  assert.match(
    manhwa.notes,
    /Popular.*Latest.*search.*filters.*detail.*episodes/i,
  );
  assert.match(manhwa.notes, /reader.*not implemented/i);
}

test("publishes exactly one current NTK Manhwa index entry", () => {
  const entries = readIndex();
  const manhwaEntries = entries.filter(
    (entry) => entry.id === 240710002 || entry.id === 260713002,
  );

  assert.equal(manhwaEntries.length, 1);
  assertPublishedManhwaMetadata(manhwaEntries[0]);
});

test("keeps embedded NTK Manhwa metadata aligned with the public manifest", () => {
  const { sources } = loadManhwaSource();

  assert.equal(sources.length, 1);
  assertPublishedManhwaMetadata(sources[0]);
});
