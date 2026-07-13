const assert = require("node:assert/strict");
const test = require("node:test");

const { loadManhwaSource } = require("../helpers/load-manhwa-source");

const LIVE_GENRES = [
  "순정", "판타지", "러브코미디", "드라마", "17", "학원", "라노벨",
  "개그", "액션", "백합", "일상", "SF", "이세계", "스릴러", "애니화",
  "전생", "스포츠", "TS", "소년", "먹방", "붕탁", "게임", "호러", "시대",
  "로맨스", "추리", "음악", "무협", "BL",
];

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function byType(filters, type) {
  const filter = filters.find((candidate) => candidate.type === type);
  assert.ok(filter, `missing filter type=${type}`);
  return filter;
}

test("exposes only the live-observed Manhwa status, sort, and genre filters", () => {
  const filters = plain(loadManhwaSource().extension.getFilterList());

  assert.deepEqual(filters.map((filter) => filter.type), [
    "status",
    "genreHint",
    "genres",
    "sort",
  ]);
  assert.deepEqual(byType(filters, "status"), {
    type_name: "SelectFilter",
    type: "status",
    name: "상태",
    state: 1,
    values: [
      { type_name: "SelectOption", name: "전체", value: "" },
      { type_name: "SelectOption", name: "연재/방영중", value: "ongoing" },
      { type_name: "SelectOption", name: "완결", value: "completed" },
    ],
  });
  assert.equal(byType(filters, "genreHint").type_name, "HeaderFilter");
  assert.deepEqual(
    byType(filters, "genres").state.map((genre) => genre.name),
    LIVE_GENRES,
  );
  for (const genre of byType(filters, "genres").state) {
    assert.equal(genre.type_name, "TriState");
    assert.equal(genre.type, "genre");
    assert.equal(genre.value, genre.name);
    assert.equal(genre.state, 0);
  }
  assert.deepEqual(
    byType(filters, "sort").values.map(({ name, value }) => [name, value]),
    [
      ["최신순", "new"],
      ["신작순", "fresh"],
      ["북마크순", "hot"],
      ["조회순", "views"],
      ["평점순", "rating"],
      ["화수순", "episodes"],
    ],
  );
});
