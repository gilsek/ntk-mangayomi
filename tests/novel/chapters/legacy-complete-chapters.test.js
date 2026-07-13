const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");

const fixture = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "detail", "legacy-detail.html"),
  "utf8",
);

function parse(html = fixture) {
  const { helpers } = loadNovelSource();
  return helpers.parseChaptersHtml(html, "https://newtoki1.org", "60079");
}

test("keeps server DOM order and permits display-number gaps", () => {
  const chapters = parse();

  assert.deepEqual(
    JSON.parse(JSON.stringify(chapters.map((chapter) => chapter.url))),
    [
      "/novel/60079/9005",
      "/novel/60079/9003",
      "/novel/60079/9001",
    ],
  );
});

test("rejects a malformed row instead of silently returning a partial list", () => {
  const html = fixture.replace(
    'href="https://newtoki1.org/novel/60079/9003"',
    'href=""',
  );

  assert.throws(() => parse(html), /chapter structure.*row=2.*link/i);
});

test("rejects cross-work, duplicate, missing-title, and malformed-date rows", () => {
  assert.throws(
    () => parse(fixture.replace("/novel/60079/9003", "/novel/99999/9003")),
    /chapter structure.*row=2.*ownership/i,
  );
  assert.throws(
    () => parse(fixture.replace("/novel/60079/9003", "/novel/60079/9005")),
    /chapter structure.*row=2.*duplicate/i,
  );
  assert.throws(
    () => parse(fixture.replace(/>\s*3화\s*<\/a>/, "> </a>")),
    /chapter structure.*row=2.*title/i,
  );
  assert.throws(
    () => parse(fixture.replace("26.07.13", "어제")),
    /chapter structure.*row=2.*date/i,
  );
});

test("rejects missing or truncated chapter structures", () => {
  assert.throws(
    () => parse(fixture.replace('id="serial-move"', 'id="other"')),
    /chapter structure.*serial-move/i,
  );
  assert.throws(
    () => parse(fixture.replace("</ul>", "")),
    /chapter structure.*list-body/i,
  );
  assert.throws(
    () => parse(fixture.replace(/<li class="list-item"[\s\S]*<\/li>/, "")),
    /chapter structure.*rows/i,
  );
});
