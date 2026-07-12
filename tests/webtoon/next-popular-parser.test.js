const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parses champion runner and row cards in ranking order", async () => {
  const { extension } = loadWebtoonSource({
    body: fixture("next-rank-week.html"),
  });

  const result = plain(await extension.getPopular(1));

  assert.deepEqual(result, {
    list: [
      {
        name: "무선 연결 오나홀",
        link: "/webtoon/17970",
        imageUrl: "https://aws-cdn1.site/black/thumbs/17970.png?v2",
      },
      {
        name: "픽 미 업!",
        link: "/webtoon/60914825",
        imageUrl: "https://sbxh9.com/thumbs/60914825.jpg",
      },
      {
        name: "남자가 부족해요",
        link: "/webtoon/u-mpfm64y1-5iea",
        imageUrl: "https://sbxh9.com/thumbs/slug.png",
      },
    ],
    hasNextPage: false,
  });
});

test("keeps a ranked work that has no cover image", async () => {
  const { extension } = loadWebtoonSource({
    body: `
      <main class="rank-v2-page">
        <a class="rank-v2-row" href="/webtoon/u-no-cover">
          <div class="rank-v2-row-title"><strong>표지 없음</strong></div>
        </a>
      </main>
    `,
  });

  const result = plain(await extension.getPopular(1));

  assert.deepEqual(result.list, [
    {
      name: "표지 없음",
      link: "/webtoon/u-no-cover",
      imageUrl: "",
    },
  ]);
});

test("rejects a Next ranking page without its page marker", async () => {
  const { extension } = loadWebtoonSource({
    body: '<a class="rank-v2-row" href="/webtoon/1"><div class="rank-v2-row-title"><strong>작품</strong></div></a>',
  });

  await assert.rejects(
    () => extension.getPopular(1),
    /structure error.*parserFamily=next.*missing=\.rank-v2-page/,
  );
});

test("rejects a marked Next ranking page with no cards", async () => {
  const { extension } = loadWebtoonSource({
    body: '<main class="rank-v2-page"></main>',
  });

  await assert.rejects(
    () => extension.getPopular(1),
    /structure error.*parserFamily=next.*missing=rank cards/,
  );
});

test("rejects ranked cards with no title or link", async () => {
  const noTitle = loadWebtoonSource({
    body: '<main class="rank-v2-page"><a class="rank-v2-row" href="/webtoon/1"><div class="rank-v2-row-title"></div></a></main>',
  }).extension;
  const noLink = loadWebtoonSource({
    body: '<main class="rank-v2-page"><a class="rank-v2-champion"><h2>작품</h2></a></main>',
  }).extension;

  await assert.rejects(
    () => noTitle.getPopular(1),
    /structure error.*missing=\.rank-v2-row-title > strong/,
  );
  await assert.rejects(
    () => noLink.getPopular(1),
    /structure error.*missing=rank href/,
  );
});

test("does not convert HTTP or non-HTML failures into empty rankings", async () => {
  const forbidden = loadWebtoonSource({ statusCode: 403 }).extension;
  const json = loadWebtoonSource({
    body: "{}",
    headers: { "content-type": "application/json" },
  }).extension;

  await assert.rejects(
    () => forbidden.getPopular(1),
    /Next Webtoon HTTP 403.*parserFamily=next/,
  );
  await assert.rejects(
    () => json.getPopular(1),
    /Next Webtoon non-HTML response.*parserFamily=next/,
  );
});
