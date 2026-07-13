const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { loadNovelSource } = require("../helpers/load-novel-source");

function loadPreSplitUtilities() {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "..", "javascript", "manga", "src", "ko", "ntk.js"),
    "utf8",
  );
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(
    `${source}\n;module.exports = { responseHeader, mergeSetCookie, base64UrlFromBytes, base64UrlToBytes, utf8DecodeBytes, hmacSha256Base64Url, unshuffleParagraphs, escapeHtml, renderNovelContentHtml };`,
    context,
  );
  return context.module.exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("keeps bounded pre-split reader utility behavior", async () => {
  const legacy = loadPreSplitUtilities();
  const { helpers: current } = loadNovelSource();

  const response = { headers: { "Set-Cookie": "sid=abc" } };
  assert.equal(current.responseHeader(response, "set-cookie"), legacy.responseHeader(response, "set-cookie"));
  assert.equal(
    current.mergeSetCookie("seed=1", "sid=abc; Path=/, ack=yes; Path=/"),
    legacy.mergeSetCookie("seed=1", "sid=abc; Path=/, ack=yes; Path=/"),
  );

  const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
  const encoded = legacy.base64UrlFromBytes(bytes);
  assert.equal(current.base64UrlFromBytes(bytes), encoded);
  assert.deepEqual(
    plain(Array.from(current.base64UrlToBytes(encoded))),
    plain(Array.from(legacy.base64UrlToBytes(encoded))),
  );
  const utf8 = new TextEncoder().encode("한글 text");
  assert.equal(current.utf8DecodeBytes(utf8), legacy.utf8DecodeBytes(utf8));
  assert.equal(
    await current.hmacSha256Base64Url("secret", "message"),
    await legacy.hmacSha256Base64Url("secret", "message"),
  );
  assert.deepEqual(
    plain(current.unshuffleParagraphs(["B", "A", "C"], [1, 0, 2])),
    plain(legacy.unshuffleParagraphs(["B", "A", "C"], [1, 0, 2])),
  );
  assert.equal(current.escapeHtml('<>&"'), legacy.escapeHtml('<>&"'));
  const textPayload = JSON.stringify({ kind: "text", paragraphs: ["첫째\n둘째", "셋째"] });
  assert.equal(current.renderNovelContentHtml(textPayload), legacy.renderNovelContentHtml(textPayload));
});
