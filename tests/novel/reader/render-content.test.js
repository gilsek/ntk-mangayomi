const assert = require("node:assert/strict");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");

test("escapes text and preserves paragraph and line breaks", () => {
  const { helpers } = loadNovelSource();
  const payload = JSON.stringify({
    kind: "text",
    paragraphs: ['첫째 <script>alert(1)</script>\n둘째', "셋째 & 끝"],
  });

  assert.equal(
    helpers.renderNovelContentHtml(payload),
    "<p>첫째 &lt;script&gt;alert(1)&lt;/script&gt;<br>둘째</p>\n<p>셋째 &amp; 끝</p>",
  );
});

test("restores a valid shuffled payload and rejects an invalid permutation", () => {
  const { helpers } = loadNovelSource();

  assert.equal(
    helpers.renderNovelContentHtml(JSON.stringify({
      kind: "text-shuffled",
      paragraphs: ["둘째", "첫째", "셋째"],
      perm: [1, 0, 2],
    })),
    "<p>첫째</p>\n<p>둘째</p>\n<p>셋째</p>",
  );
  assert.throws(
    () => helpers.renderNovelContentHtml(JSON.stringify({
      kind: "text-shuffled",
      paragraphs: ["둘째", "첫째"],
      perm: [0, 0],
    })),
    /permutation/i,
  );
});

test("sanitizes HTML to structural text tags without attributes", () => {
  const { helpers } = loadNovelSource();
  const payload = JSON.stringify({
    kind: "html",
    html: '<div class="chapter" onclick="steal()"><p style="color:red">본문 <strong data-x="1">강조</strong></p>\n<script>steal()</script><iframe src="evil">bad</iframe><img src=x onerror=steal()><custom>끝</custom></div>',
  });
  const rendered = helpers.renderNovelContentHtml(payload);

  assert.equal(rendered, "<div><p>본문 <strong>강조</strong></p><br>끝</div>");
  assert.doesNotMatch(rendered, /script|iframe|img|onclick|style|data-x|steal|evil/i);
});

test("rejects malformed JSON and unknown content kinds", () => {
  const { helpers } = loadNovelSource();

  assert.throws(() => helpers.renderNovelContentHtml("not-json"), /payload/i);
  assert.throws(
    () => helpers.renderNovelContentHtml(JSON.stringify({ kind: "binary", data: "x" })),
    /kind/i,
  );
});
