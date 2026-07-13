const assert = require("node:assert/strict");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

const MAIN_GENRES = [
  ["1", "학원"], ["2", "액션"], ["3", "SF"], ["4", "스토리"],
  ["5", "판타지"], ["6", "BL/백합"], ["9", "드라마"], ["10", "로맨스"],
  ["11", "시대"], ["12", "스포츠"], ["13", "일상"], ["16", "성인"],
  ["19", "무협"],
];

const DETAIL_GENRES = [
  ["7", "개그/코미디"], ["8", "연애/순정"], ["14", "추리/미스터리"], ["15", "공포/스릴러"],
  ["17", "옴니버스"], ["18", "에피소드"], ["20", "소년"], ["99", "기타"],
  ["517", "절륜공"], ["529", "존댓말공"], ["287", "월드드랍"], ["288", "WorldDrop"],
  ["290", "다정남"], ["291", "능글남"], ["292", "능력녀"], ["293", "절륜남"], ["295", "직진남"],
  ["297", "유혹남"], ["298", "순정녀"], ["299", "캠퍼스물"], ["301", "능력남"], ["302", "동양풍"],
  ["304", "인외존재"], ["306", "소꿉친구"], ["310", "강공"], ["311", "피폐물"], ["312", "삼각관계"],
  ["315", "능글공"], ["316", "집착공"], ["317", "까칠수"], ["333", "대형견남"], ["336", "원나잇"],
  ["340", "성장물"], ["343", "순수녀"], ["379", "까칠공"], ["380", "연상수"], ["384", "미남공"],
  ["385", "순정공"], ["387", "연하공"], ["388", "대물공"], ["390", "다정수"], ["392", "계략공"],
  ["393", "대형견공"], ["394", "단정수"], ["409", "후회공"], ["410", "다정공"], ["413", "순진수"],
  ["414", "짝사랑수"], ["416", "상처수"], ["418", "동거"], ["419", "미인수"], ["420", "짝사랑"],
  ["424", "무심수"], ["429", "애증"], ["435", "사랑꾼공"], ["436", "귀염수"], ["438", "능력수"],
  ["440", "상처공"], ["461", "오해/착각"], ["102", "유부녀"], ["103", "하드코어"], ["114", "고수위"],
  ["121", "오피스"], ["127", "능욕"], ["135", "하렘"], ["142", "강제"], ["144", "연상공"],
  ["145", "미인공"], ["147", "강수"], ["148", "연하수"], ["150", "미남수"], ["151", "오메가버스"],
  ["152", "SM"], ["153", "계약관계"], ["154", "섹스파트너"], ["155", "BL"], ["156", "로코"],
  ["157", "다정녀"], ["158", "순정남"], ["160", "연상녀"], ["161", "현대물"], ["162", "연하남"],
  ["163", "첫사랑"], ["164", "달달물"], ["165", "여성인기19"], ["166", "남성인기19"], ["167", "나쁜남자"],
  ["168", "순진녀"], ["169", "더티토크"], ["193", "거유"], ["206", "3P"], ["207", "모럴리스"],
  ["209", "후방주의"], ["234", "복수"], ["241", "상처녀"], ["243", "서양풍"], ["245", "집착남"],
  ["246", "계략남"], ["247", "로판"], ["248", "소설원작"],
];

const PLATFORMS = [
  ["전체", ""], ["네이버", "1"], ["다음", "2"], ["카카오", "3"],
  ["레진", "4"], ["투믹스", "5"], ["탑툰", "6"], ["코미카", "7"],
  ["배틀코믹스", "8"], ["코믹GT", "9"], ["케이툰", "10"], ["애니툰", "11"],
  ["폭스툰", "12"], ["피너툰", "13"], ["봄툰", "14"], ["코미코", "15"],
  ["무툰", "16"], ["기타", "99"],
];

const SORTS = [
  ["최신순", "new"], ["신작순", "fresh"], ["북마크순", "hot"],
  ["조회순", "views"], ["평점순", "rating"], ["화수순", "episodes"],
];

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function filterByType(filters, type) {
  const filter = filters.find((candidate) => candidate.type === type);
  assert.ok(filter, `missing filter type=${type}`);
  return filter;
}

function optionPairs(filter) {
  return filter.values.map(({ name, value }) => [name, value]);
}

function genrePairs(filter) {
  return filter.state.map(({ value, name }) => [value, name]);
}

test("exposes the approved Next filter model", () => {
  const { extension } = loadWebtoonSource();
  const filters = plain(extension.getFilterList());

  assert.deepEqual(filters.map((filter) => filter.type), [
    "workType",
    "genreHint",
    "mainGenres",
    "detailGenres",
    "platform",
    "sort",
  ]);
  assert.deepEqual(optionPairs(filterByType(filters, "workType")), [
    ["전체", "all"],
    ["일반", "normal"],
    ["비엘", "bl"],
    ["성인", "adult"],
    ["완결", "completed"],
  ]);
  assert.equal(filters.some((filter) => filter.type === "weekday"), false);
  assert.equal(filterByType(filters, "genreHint").type_name, "HeaderFilter");
  assert.deepEqual(genrePairs(filterByType(filters, "mainGenres")), MAIN_GENRES);
  assert.deepEqual(genrePairs(filterByType(filters, "detailGenres")), DETAIL_GENRES);
  assert.deepEqual(optionPairs(filterByType(filters, "platform")), PLATFORMS);
  assert.deepEqual(optionPairs(filterByType(filters, "sort")), SORTS);
});

test("builds every Next genre as an unselected TriState", () => {
  const { extension } = loadWebtoonSource();
  const filters = plain(extension.getFilterList());
  const mainGenres = filterByType(filters, "mainGenres");
  const detailGenres = filterByType(filters, "detailGenres");

  assert.equal(mainGenres.state.length, 13);
  assert.equal(detailGenres.state.length, 100);
  for (const genre of [...mainGenres.state, ...detailGenres.state]) {
    assert.equal(genre.type_name, "TriState");
    assert.equal(genre.type, "genre");
    assert.equal(typeof genre.value, "string");
    assert.equal(genre.state, 0);
  }
});

function filterUrl(extension, page, filters) {
  return new URL(extension.buildNextFilterUrl(page, filters));
}

function assertNoWeekdayParameters(url) {
  assert.equal(url.searchParams.has("day"), false);
  assert.equal(url.searchParams.has("xday"), false);
}

test("serializes the default Next filter request", () => {
  const { extension } = loadWebtoonSource();
  const url = filterUrl(extension, 2, extension.getFilterList());

  assert.equal(url.origin, "https://sbxh9.com");
  assert.equal(url.pathname, "/api/works");
  assert.equal(url.searchParams.get("status"), "ongoing");
  assert.equal(url.searchParams.get("cat"), "all");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("pageSize"), "42");
  assert.equal(url.searchParams.get("withTotal"), "1");
  assert.equal(url.searchParams.has("plat"), false);
  assert.equal(url.searchParams.has("sort"), false);
  assertNoWeekdayParameters(url);
});

test("serializes the completed Next work type without cat", () => {
  const { extension } = loadWebtoonSource();
  const filters = extension.getFilterList();
  filterByType(filters, "workType").state = 4;

  const url = filterUrl(extension, 1, filters);

  assert.equal(url.searchParams.get("status"), "completed");
  assert.equal(url.searchParams.has("cat"), false);
  assertNoWeekdayParameters(url);
});

test("serializes included and excluded Next genres without duplicates", () => {
  const { extension } = loadWebtoonSource();
  const filters = extension.getFilterList();
  const mainGenres = filterByType(filters, "mainGenres").state;
  const detailGenres = filterByType(filters, "detailGenres").state;
  mainGenres.find((genre) => genre.value === "1").state = 1;
  mainGenres.find((genre) => genre.value === "16").state = 2;
  detailGenres.find((genre) => genre.value === "102").state = 1;
  detailGenres.find((genre) => genre.value === "103").state = 2;
  detailGenres.push({ ...mainGenres.find((genre) => genre.value === "1") });
  detailGenres.push({ ...mainGenres.find((genre) => genre.value === "16") });

  const url = filterUrl(extension, 1, filters);

  assert.equal(url.searchParams.get("tag"), "1,102");
  assert.equal(url.searchParams.get("xtag"), "16,103");
  assertNoWeekdayParameters(url);
});

test("serializes the selected Next platform and non-default sort", () => {
  const { extension } = loadWebtoonSource();
  const filters = extension.getFilterList();
  const platform = filterByType(filters, "platform");
  const sort = filterByType(filters, "sort");
  platform.state = platform.values.findIndex((option) => option.value === "99");
  sort.state = sort.values.findIndex((option) => option.value === "views");

  const url = filterUrl(extension, 3, filters);

  assert.equal(url.searchParams.get("plat"), "99");
  assert.equal(url.searchParams.get("sort"), "views");
  assertNoWeekdayParameters(url);
});

test("ignores invalid Next filter indexes and TriState values", () => {
  const { extension } = loadWebtoonSource();
  const filters = extension.getFilterList();
  filterByType(filters, "workType").state = 999;
  filterByType(filters, "platform").state = -1;
  filterByType(filters, "sort").state = 999;
  filterByType(filters, "mainGenres").state[0].state = 7;

  const url = filterUrl(extension, 1, filters);

  assert.equal(url.searchParams.get("status"), "ongoing");
  assert.equal(url.searchParams.get("cat"), "all");
  assert.equal(url.searchParams.has("tag"), false);
  assert.equal(url.searchParams.has("xtag"), false);
  assert.equal(url.searchParams.has("plat"), false);
  assert.equal(url.searchParams.has("sort"), false);
  assertNoWeekdayParameters(url);
});

test("uses defaults when Next filters are absent", () => {
  const { extension } = loadWebtoonSource();
  const url = filterUrl(extension, 1, []);

  assert.equal(url.searchParams.get("status"), "ongoing");
  assert.equal(url.searchParams.get("cat"), "all");
  for (const parameter of ["tag", "xtag", "plat", "sort", "day", "xday"]) {
    assert.equal(url.searchParams.has(parameter), false, parameter);
  }
});
