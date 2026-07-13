const assert = require("node:assert/strict");
const test = require("node:test");

const { largeHtml } = require("../helpers/large-chapters");
const { loadNovelSource } = require("../helpers/load-novel-source");

function parse(html) {
  const { helpers } = loadNovelSource();
  return helpers.parseChaptersHtml(html, "https://newtoki1.org", "60079");
}

test("keeps all 10,000 chapters in exact DOM order despite display-number gaps", () => {
  const chapters = parse(largeHtml());

  assert.equal(chapters.length, 10000);
  assert.deepEqual(
    [chapters[0], chapters[4999], chapters.at(-1)].map(({ name, url }) => ({
      name,
      url,
    })),
    [
      { name: "20000화", url: "/novel/60079/900000" },
      { name: "10002화", url: "/novel/60079/895001" },
      { name: "2화", url: "/novel/60079/890001" },
    ],
  );
});

test("fails a duplicate or cross-work row even near the end of 10,000 rows", () => {
  const duplicate = largeHtml(10000, (row, index) => ({
    ...row,
    episodeId: index === 9999 ? "900000" : row.episodeId,
  }));
  const crossWork = largeHtml(10000, (row, index) => ({
    ...row,
    workId: index === 9999 ? "99999" : row.workId,
  }));

  assert.throws(() => parse(duplicate), /row=10000.*duplicate/i);
  assert.throws(() => parse(crossWork), /row=10000.*ownership/i);
});

test("fails a missing title or link and a truncated large response", () => {
  const missingTitle = largeHtml(100, (row, index) => ({
    ...row,
    title: index === 99 ? "" : undefined,
  }));
  const missingLink = largeHtml(100).replace(
    'href="/novel/60079/899901"',
    'href=""',
  );
  const truncated = largeHtml(100).replace("</ul>", "");

  assert.throws(() => parse(missingTitle), /row=100.*title/i);
  assert.throws(() => parse(missingLink), /row=100.*link/i);
  assert.throws(() => parse(truncated), /missing=list-body/i);
});
