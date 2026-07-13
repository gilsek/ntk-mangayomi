const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { loadNovelSource } = require("../helpers/load-novel-source");

function loadPreSplitUtilities() {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "..", "javascript", "manga", "src", "ko", "ntk.js"),
    "utf8",
  );
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(
    `${source}\n;module.exports = { filterOption, textFilter, selectFilter, filterTextValue };`,
    context,
  );
  return context.module.exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("keeps the bounded pre-split filter utility behavior", () => {
  const legacy = loadPreSplitUtilities();
  const { helpers: current } = loadNovelSource();

  assert.deepEqual(
    plain(current.filterOption("전체", "all")),
    plain(legacy.filterOption("전체", "all")),
  );
  assert.deepEqual(
    plain(current.textFilter("author", "작가")),
    plain(legacy.textFilter("author", "작가")),
  );
  assert.deepEqual(
    plain(current.selectFilter("status", "상태", [["전체", "all"]], 0)),
    plain(legacy.selectFilter("status", "상태", [["전체", "all"]], 0)),
  );

  const filters = [{ type: "author", state: "  작가  " }];
  assert.equal(
    current.filterTextValue(filters, "author"),
    legacy.filterTextValue(filters, "author"),
  );
});
