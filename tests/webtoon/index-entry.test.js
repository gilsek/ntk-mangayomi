const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function readIndex() {
  return JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "index.json"), "utf8"),
  );
}

test("registers the rebuild Webtoon source for client list testing", () => {
  const entries = readIndex();
  const webtoonEntries = entries.filter(
    (entry) => entry.id === 260713001 || entry.id === 240710001,
  );

  assert.equal(webtoonEntries.length, 1);

  const [webtoon] = webtoonEntries;
  assert.equal(webtoon.id, 260713001);
  assert.equal(webtoon.name, "NTK Webtoon");
  assert.equal(webtoon.baseUrl, "https://sbxh9.com");
  assert.equal(webtoon.itemType, 0);
  assert.equal(webtoon.isManga, true);
  assert.equal(webtoon.isNsfw, true);
  assert.equal(webtoon.hasCloudflare, false);
  assert.equal(webtoon.version, "0.106");
  assert.equal(
    path.posix.basename(new URL(webtoon.sourceCodeUrl).pathname),
    "ntk_webtoon.js",
  );
  assert.equal(
    webtoon.sourceCodeUrl,
    "https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/manga/src/ko/ntk_webtoon.js",
  );
  assert.equal(webtoon.additionalParams, "");
  assert.match(webtoon.notes, /Popular.*Latest.*title search.*filters/i);
  assert.match(webtoon.notes, /detail.*reader.*not implemented/i);
});

test("preserves the existing Manhwa and Novel registrations", () => {
  const entries = readIndex();

  assert.equal(entries.length, 3);
  assert.equal(entries.filter((entry) => entry.id === 240710002).length, 1);
  assert.equal(entries.filter((entry) => entry.id === 240710003).length, 1);
});
