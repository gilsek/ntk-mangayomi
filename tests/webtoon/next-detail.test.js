const assert = require("node:assert/strict");
const test = require("node:test");

const { loadWebtoonSource } = require("./helpers/load-webtoon-source");

const detailHtml = `
  <section class="hero-v2">
    <div class="hero-v2-thumb"><img src="/covers/detail.png" alt=""></div>
    <h1 class="hero-v2-title">상세 작품</h1>
    <span class="pill-status completed">완결</span>
    <div class="hero-v2-author"><a>작가 A</a><a>작가 B</a></div>
    <div class="hero-v2-tags">
      <a class="hero-v2-tag">성인</a>
      <a class="hero-v2-tag">드라마</a>
      <a class="hero-v2-tag">성인</a>
    </div>
    <p class="hero-v2-desc">작품 설명입니다.</p>
  </section>
`;

function response(body, contentType, statusCode = 200) {
  return {
    body,
    headers: { "content-type": contentType },
    statusCode,
  };
}

function loadDetail({ html = detailHtml, episodePayload, detailStatus = 200 } = {}) {
  return loadWebtoonSource({
    responses(url) {
      if (url.includes("/api/webtoon/")) {
        return response(
          JSON.stringify(
            episodePayload ?? {
              ok: true,
              total: 2,
              episodes: [
                { sourceEpisodeId: "episode-2", title: "2화", epNo: 2 },
                { sourceEpisodeId: "episode-1", title: "1화", epNo: 1 },
              ],
            },
          ),
          "application/json",
        );
      }
      return response(html, "text/html; charset=utf-8", detailStatus);
    },
  });
}

test("loads Next detail metadata and all chapters from the episode API", async () => {
  const { extension, requests } = loadDetail();

  const result = JSON.parse(
    JSON.stringify(await extension.getDetail("https://sbxh9.com/webtoon/u-detail")),
  );

  assert.deepEqual(result, {
    name: "상세 작품",
    link: "/webtoon/u-detail",
    imageUrl: "https://sbxh9.com/covers/detail.png",
    description: "작품 설명입니다.",
    author: "작가 A, 작가 B",
    artist: "작가 A, 작가 B",
    status: 1,
    genre: ["성인", "드라마"],
    chapters: [
      {
        name: "2화",
        url: "/webtoon/u-detail/episode-2",
        scanlator: "",
      },
      {
        name: "1화",
        url: "/webtoon/u-detail/episode-1",
        scanlator: "",
      },
    ],
  });
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://sbxh9.com/webtoon/u-detail",
      "https://sbxh9.com/api/webtoon/u-detail/episodes",
    ],
  );
  assert.deepEqual(requests.map((request) => request.method), ["GET", "GET"]);
});

test("keeps every chapter returned for a work with more than two thousand episodes", async () => {
  const episodes = Array.from({ length: 2015 }, (_, index) => {
    const epNo = 2015 - index;
    return {
      sourceEpisodeId: `episode-${epNo}`,
      title: `${epNo}화`,
      epNo,
    };
  });
  const { extension } = loadDetail({
    episodePayload: { ok: true, total: episodes.length, episodes },
  });

  const result = await extension.getDetail("/webtoon/53483967");

  assert.equal(result.chapters.length, 2015);
  assert.equal(result.chapters[0].url, "/webtoon/53483967/episode-2015");
  assert.equal(result.chapters.at(-1).url, "/webtoon/53483967/episode-1");
});

test("accepts a valid detail with no description tags authors or chapters", async () => {
  const { extension } = loadDetail({
    html: `
      <section class="hero-v2">
        <h1 class="hero-v2-title">빈 상세</h1>
        <span class="pill-status ongoing">연재중</span>
        <p class="hero-v2-desc">등록된 작품 설명이 없습니다.</p>
      </section>
    `,
    episodePayload: { ok: true, total: 0, episodes: [] },
  });

  const result = JSON.parse(JSON.stringify(await extension.getDetail("/webtoon/15007")));

  assert.equal(result.description, "");
  assert.equal(result.author, "");
  assert.equal(result.artist, "");
  assert.equal(result.status, 0);
  assert.deepEqual(result.genre, []);
  assert.deepEqual(result.chapters, []);
});

test("rejects malformed detail links and incomplete episode payloads", async () => {
  const malformedLink = loadDetail().extension;
  const incompleteEpisodes = loadDetail({
    episodePayload: {
      ok: true,
      total: 2,
      episodes: [{ sourceEpisodeId: "episode-1", title: "1화", epNo: 1 }],
    },
  }).extension;

  await assert.rejects(
    () => malformedLink.getDetail("/webtoon/work/episode"),
    /invalid detail link/i,
  );
  await assert.rejects(
    () => incompleteEpisodes.getDetail("/webtoon/work"),
    /episode structure error.*total/i,
  );
});

test("rejects duplicate source episode IDs instead of returning fewer chapters than total", async () => {
  const { extension } = loadDetail({
    episodePayload: {
      ok: true,
      total: 2,
      episodes: [
        { sourceEpisodeId: "duplicate", title: "2화", epNo: 2 },
        { sourceEpisodeId: "duplicate", title: "1화", epNo: 1 },
      ],
    },
  });

  await assert.rejects(
    () => extension.getDetail("/webtoon/work"),
    /episode structure error.*duplicate=sourceEpisodeId/i,
  );
});

test("does not convert detail HTTP or structure failures into empty details", async () => {
  const notFound = loadDetail({ detailStatus: 404 }).extension;
  const missingHero = loadDetail({ html: "<main>maintenance</main>" }).extension;

  await assert.rejects(
    () => notFound.getDetail("/webtoon/missing"),
    /Next Webtoon detail HTTP 404/i,
  );
  await assert.rejects(
    () => missingHero.getDetail("/webtoon/maintenance"),
    /detail structure error.*hero-v2/i,
  );
});
