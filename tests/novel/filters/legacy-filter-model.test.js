const assert = require("node:assert/strict");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");

function values(filter) {
  return filter.values.map((option) => [option.name, option.value]);
}

test("exposes only the observed Legacy Novel filter model", () => {
  const { extension } = loadNovelSource();
  const filters = JSON.parse(JSON.stringify(extension.getFilterList()));

  assert.deepEqual(
    filters.map((filter) => filter.type),
    ["author", "initial", "status", "genre", "platform", "sort"],
  );
  assert.equal(filters[0].type_name, "TextFilter");
  assert.equal(filters[0].state, "");
  for (const filter of filters.slice(1)) {
    assert.equal(filter.type_name, "SelectFilter");
    assert.equal(filter.state, 0);
    assert.ok(filter.values.every((option) => option.type_name === "SelectOption"));
  }

  assert.deepEqual(values(filters[1]), [
    ["전체", ""],
    ["ㄱ", "ㄱ"], ["ㄴ", "ㄴ"], ["ㄷ", "ㄷ"], ["ㄹ", "ㄹ"],
    ["ㅁ", "ㅁ"], ["ㅂ", "ㅂ"], ["ㅅ", "ㅅ"], ["ㅇ", "ㅇ"],
    ["ㅈ", "ㅈ"], ["ㅊ", "ㅊ"], ["ㅋ", "ㅋ"], ["ㅌ", "ㅌ"],
    ["ㅍ", "ㅍ"], ["ㅎ", "ㅎ"], ["a-z", "a-z"], ["0-9", "0-9"],
  ]);
  assert.deepEqual(values(filters[2]), [
    ["전체", "all"], ["연재중", "ongoing"], ["완결", "completed"],
  ]);
  assert.deepEqual(values(filters[3]), [
    ["전체", ""], ["판타지", "판타지"], ["무협", "무협"],
    ["19금", "19금"], ["현대", "현대"], ["로맨스", "로맨스"],
    ["로맨스 판타지", "로맨스 판타지"], ["BL", "BL"],
    ["라노벨", "라노벨"], ["기타", "기타"],
  ]);
  assert.deepEqual(values(filters[4]), [
    ["전체", ""], ["직접 업로드", "user"], ["노벨피아", "novelpia"],
    ["북토끼", "booktoki"], ["문피아", "munpia"], ["조아라", "joara"],
    ["카카오페이지", "kakaopage"], ["네이버 시리즈", "series"],
    ["리디북스", "ridi"], ["기타", "etc"],
  ]);
  assert.deepEqual(values(filters[5]), [
    ["최신순", "as_update"], ["신작순", "as_new"],
    ["북마크순", "as_bookmark"], ["조회순", "as_view"],
    ["평점순", "as_rating"], ["화수순", "as_episode"],
  ]);
});
