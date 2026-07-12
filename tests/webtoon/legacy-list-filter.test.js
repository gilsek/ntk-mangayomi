const assert = require("node:assert/strict");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

function loadLegacyWebtoonSource(options = {}) {
  return loadWebtoonSource({
    ...options,
    preferences: {
      ...options.preferences,
      ntk_webtoon_parser_family: "legacy",
    },
  });
}

function filterByType(filters, type) {
  const filter = filters.find((candidate) => candidate.type === type);
  assert.ok(filter, `missing filter type=${type}`);
  return filter;
}

function optionPairs(filter) {
  return JSON.parse(
    JSON.stringify(filter.values.map(({ name, value }) => [name, value])),
  );
}

test("exposes the approved Legacy Webtoon filter types", () => {
  const { extension } = loadLegacyWebtoonSource();
  const filters = extension.getFilterList();

  assert.equal(filterByType(filters, "author").type_name, "TextFilter");
  for (const type of [
    "category",
    "weekday",
    "initial",
    "platform",
    "genre",
    "sort",
  ]) {
    assert.equal(filterByType(filters, type).type_name, "SelectFilter");
    assert.equal(filterByType(filters, type).state, 0);
  }
});

test("exposes the exact category weekday platform and sort mappings", () => {
  const { extension } = loadLegacyWebtoonSource();
  const filters = extension.getFilterList();

  assert.deepEqual(optionPairs(filterByType(filters, "category")), [
    ["전체/일반", ""],
    ["성인웹툰", "성인웹툰"],
    ["BL/GL", "BL/GL"],
    ["완결웹툰", "완결웹툰"],
  ]);
  assert.deepEqual(optionPairs(filterByType(filters, "weekday")), [
    ["전체", ""],
    ["월", "월"],
    ["화", "화"],
    ["수", "수"],
    ["목", "목"],
    ["금", "금"],
    ["토", "토"],
    ["일", "일"],
    ["열흘", "열흘"],
  ]);
  assert.deepEqual(optionPairs(filterByType(filters, "platform")), [
    ["전체", ""],
    ["네이버", "1"],
    ["카카오", "3"],
    ["레진", "4"],
    ["투믹스", "5"],
    ["탑툰", "6"],
    ["코미카", "7"],
    ["배틀코믹스", "8"],
    ["케이툰", "10"],
    ["피너툰", "13"],
    ["봄툰", "14"],
    ["코미코", "15"],
    ["기타", "99"],
  ]);
  assert.deepEqual(optionPairs(filterByType(filters, "sort")), [
    ["최신순", "as_update"],
    ["신작순", "as_new"],
    ["북마크순", "as_bookmark"],
    ["조회순", "as_view"],
    ["평점순", "as_rating"],
    ["화수순", "as_episode"],
  ]);
});

test("exposes every approved initial and genre value", () => {
  const { extension } = loadLegacyWebtoonSource();
  const filters = extension.getFilterList();

  assert.deepEqual(
    optionPairs(filterByType(filters, "initial")).map((pair) => pair[1]),
    [
      "",
      "ㄱ",
      "ㄴ",
      "ㄷ",
      "ㄹ",
      "ㅁ",
      "ㅂ",
      "ㅅ",
      "ㅇ",
      "ㅈ",
      "ㅊ",
      "ㅋ",
      "ㅌ",
      "ㅍ",
      "ㅎ",
      "a-z",
      "0-9",
    ],
  );
  assert.deepEqual(
    optionPairs(filterByType(filters, "genre")).map((pair) => pair[1]),
    [
      "",
      "판타지",
      "액션",
      "개그",
      "미스터리",
      "로맨스",
      "드라마",
      "무협",
      "스포츠",
      "일상",
      "학원",
      "성인",
      "BLGL",
      "한국",
      "중국",
    ],
  );
});

test("serializes text and select filters to their independent query fields", async () => {
  const { extension, requests } = loadLegacyWebtoonSource();
  const filters = extension.getFilterList();

  filterByType(filters, "author").state = "박태준";
  filterByType(filters, "category").state = 1;
  filterByType(filters, "weekday").state = 1;
  filterByType(filters, "initial").state = 6;
  filterByType(filters, "platform").state = 1;
  filterByType(filters, "genre").state = 5;
  filterByType(filters, "sort").state = 3;

  await extension.search("", 3, filters);

  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.searchParams.get("author"), "박태준");
  assert.equal(url.searchParams.get("toon"), "성인웹툰");
  assert.equal(url.searchParams.get("yoil"), "월");
  assert.equal(url.searchParams.get("jaum"), "ㅂ");
  assert.equal(url.searchParams.get("plat"), "1");
  assert.equal(url.searchParams.get("tag"), "로맨스");
  assert.equal(url.searchParams.get("sst"), "as_view");
  assert.equal(url.searchParams.get("sod"), "desc");
  assert.equal(url.searchParams.get("page"), "3");
});

test("omits empty filter values and resets search to page one", async () => {
  const { extension, requests } = loadLegacyWebtoonSource();

  await extension.search("", 1, extension.getFilterList());

  const url = new URL(requests[0].url);
  for (const field of ["author", "toon", "yoil", "jaum", "plat", "tag", "page"]) {
    assert.equal(url.searchParams.has(field), false, `unexpected ${field}`);
  }
  assert.equal(url.searchParams.get("sst"), "as_update");
});
