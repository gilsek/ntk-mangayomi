const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadManhwaSource } = require("../helpers/load-manhwa-source");
const { DetailTestDocument } = require("../detail/test-document");

function fixture(group, name) {
  return fs.readFileSync(
    path.join(__dirname, "..", "fixtures", group, name),
    "utf8",
  );
}

const detailHtml = fixture("detail", "next-detail.html");
const episodeJson = fixture("episodes", "viewer-nav.json");

function response(body, contentType, statusCode = 200) {
  return {
    body,
    headers: { "content-type": contentType },
    statusCode,
  };
}

function loadEpisodes({
  episodeBody = episodeJson,
  episodeContentType = "application/json",
  episodeStatus = 200,
  responses,
} = {}) {
  return loadManhwaSource({
    DocumentClass: DetailTestDocument,
    responses:
      responses ??
      ((url) => {
        if (url.includes("/episodes/viewer-nav")) {
          return response(episodeBody, episodeContentType, episodeStatus);
        }
        return response(detailHtml, "text/html; charset=utf-8");
      }),
  });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("loads viewer-nav episodes in exact API order", async () => {
  const { extension, requests } = loadEpisodes();

  const result = plain(await extension.getDetail("/manhwa/u-work"));

  assert.deepEqual(result.chapters, [
    {
      name: "서버 제목 3화",
      url: "/manhwa/u-work/nv-episode-3",
      scanlator: "",
    },
    {
      name: "서버 제목 2화",
      url: "/manhwa/u-work/opaque-episode-2",
      scanlator: "",
    },
    {
      name: "서버 제목 1화",
      url: "/manhwa/u-work/episode-1",
      scanlator: "",
    },
  ]);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://sbxh9.com/manhwa/u-work",
      "https://sbxh9.com/api/manhwa/u-work/episodes/viewer-nav",
    ],
  );
  assert.equal("dateUpload" in result.chapters[0], false);
});

test("accepts an empty viewer-nav response without a total field", async () => {
  const { extension, requests } = loadEpisodes({
    episodeBody: '{"ok":true,"episodes":[]}',
  });

  const result = await extension.getDetail("/manhwa/2");

  assert.deepEqual(Array.from(result.chapters), []);
  assert.equal(requests[1].url.endsWith("/api/manhwa/2/episodes/viewer-nav"), true);
});

test("keeps all 2,015 viewer-nav episodes", async () => {
  const episodes = Array.from({ length: 2015 }, (_, index) => ({
    sourceEpisodeId: `episode-${2015 - index}`,
    title: `${2015 - index}화`,
    epNo: index,
    active: index === 0,
  }));
  const { extension } = loadEpisodes({
    episodeBody: JSON.stringify({ ok: true, episodes }),
  });

  const result = await extension.getDetail("/manhwa/large-work");

  assert.equal(result.chapters.length, 2015);
  assert.equal(result.chapters[0].url, "/manhwa/large-work/episode-2015");
  assert.equal(result.chapters.at(-1).url, "/manhwa/large-work/episode-1");
});

test("rejects missing, blank, or non-string episode IDs", async () => {
  for (const sourceEpisodeId of [undefined, "", "   ", 42]) {
    const episode = { title: "1화" };
    if (sourceEpisodeId !== undefined) episode.sourceEpisodeId = sourceEpisodeId;
    const { extension } = loadEpisodes({
      episodeBody: JSON.stringify({ ok: true, episodes: [episode] }),
    });

    await assert.rejects(
      () => extension.getDetail("/manhwa/work"),
      /episode structure error.*missing=sourceEpisodeId/i,
    );
  }
});

test("rejects unsafe episode IDs without exposing the supplied value", async () => {
  const unsafeIds = [
    ".",
    "..",
    "episode/child",
    "episode\\child",
    "https://private.invalid/episode",
  ];
  const expectedMessage =
    "Next Manhwa episode structure error url=https://sbxh9.com/api/manhwa/work/episodes/viewer-nav invalid=sourceEpisodeId";

  for (const sourceEpisodeId of unsafeIds) {
    const { extension } = loadEpisodes({
      episodeBody: JSON.stringify({
        ok: true,
        episodes: [{ sourceEpisodeId, title: "1화" }],
      }),
    });

    await assert.rejects(
      () => extension.getDetail("/manhwa/work"),
      (error) => {
        assert.equal(error.message, expectedMessage);
        return true;
      },
    );
  }
});

test("rejects missing or blank server episode titles", async () => {
  for (const title of [undefined, "", "   "]) {
    const episode = { sourceEpisodeId: "episode-1", epNo: 1 };
    if (title !== undefined) episode.title = title;
    const { extension } = loadEpisodes({
      episodeBody: JSON.stringify({ ok: true, episodes: [episode] }),
    });

    await assert.rejects(
      () => extension.getDetail("/manhwa/work"),
      /episode structure error.*missing=title/i,
    );
  }
});

test("rejects duplicate episode IDs", async () => {
  const { extension } = loadEpisodes({
    episodeBody: JSON.stringify({
      ok: true,
      episodes: [
        { sourceEpisodeId: "duplicate", title: "2화" },
        { sourceEpisodeId: "duplicate", title: "1화" },
      ],
    }),
  });

  await assert.rejects(
    () => extension.getDetail("/manhwa/work"),
    /episode structure error.*duplicate=sourceEpisodeId/i,
  );
});

test("rejects malformed viewer-nav response roots", async () => {
  for (const payload of [
    {},
    { ok: "true", episodes: [] },
    { ok: true },
    { ok: true, episodes: null },
    { ok: false, episodes: [] },
  ]) {
    const { extension } = loadEpisodes({
      episodeBody: JSON.stringify(payload),
    });

    await assert.rejects(
      () => extension.getDetail("/manhwa/work"),
      /episode structure error.*invalid=ok,episodes/i,
    );
  }
});

test("rejects viewer-nav HTTP, content-type, and JSON failures", async () => {
  const forbidden = loadEpisodes({ episodeStatus: 403 }).extension;
  const html = loadEpisodes({ episodeContentType: "text/html" }).extension;
  const malformed = loadEpisodes({ episodeBody: "not-json" }).extension;

  await assert.rejects(
    () => forbidden.getDetail("/manhwa/work"),
    /Next Manhwa episode HTTP 403/i,
  );
  await assert.rejects(
    () => html.getDetail("/manhwa/work"),
    /Next Manhwa episode non-JSON response/i,
  );
  await assert.rejects(
    () => malformed.getDetail("/manhwa/work"),
    /Next Manhwa episode JSON error/i,
  );
});

test("starts detail and viewer-nav requests independently", async () => {
  const pending = [];
  const { extension, requests } = loadEpisodes({
    responses(url) {
      return new Promise((resolve) => pending.push({ url, resolve }));
    },
  });

  const detailPromise = extension.getDetail("/manhwa/work");
  await Promise.resolve();

  assert.deepEqual(
    requests.map((request) => new URL(request.url).pathname),
    ["/manhwa/work", "/api/manhwa/work/episodes/viewer-nav"],
  );
  pending
    .find((entry) => entry.url.includes("/episodes/viewer-nav"))
    .resolve(response('{"ok":true,"episodes":[]}', "application/json"));
  pending
    .find((entry) => !entry.url.includes("/episodes/viewer-nav"))
    .resolve(response(detailHtml, "text/html; charset=utf-8"));

  const result = await detailPromise;
  assert.equal(result.chapters.length, 0);
});
