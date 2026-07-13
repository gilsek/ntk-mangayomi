const assert = require("node:assert/strict");
const test = require("node:test");

const { largeHtml } = require("../helpers/large-chapters");
const { loadNovelSource } = require("../helpers/load-novel-source");

test("uses one Set membership check and insertion per large-list chapter", () => {
  const operations = { has: 0, add: 0 };
  class CountingSet extends Set {
    has(value) {
      operations.has += 1;
      return super.has(value);
    }

    add(value) {
      operations.add += 1;
      return super.add(value);
    }
  }
  const { helpers } = loadNovelSource({ SetClass: CountingSet });
  operations.has = 0;
  operations.add = 0;

  const chapters = helpers.parseChaptersHtml(
    largeHtml(),
    "https://newtoki1.org",
    "60079",
  );

  assert.equal(chapters.length, 10000);
  assert.deepEqual(operations, { has: 10000, add: 10000 });
});
