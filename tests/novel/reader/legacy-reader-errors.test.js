const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");

const viewerHtml = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "reader", "legacy-viewer.html"),
  "utf8",
);

function htmlResponse(body) {
  return { statusCode: 200, headers: { "content-type": "text/html" }, body };
}

function jsonResponse(body, statusCode = 200) {
  return { statusCode, headers: { "content-type": "application/json" }, body };
}

test("rejects unsafe reader links before requesting", async () => {
  for (const link of [
    "/novel/60079",
    "/novel/60079/not-numeric",
    "/novel/60079/9005?token=secret",
    "https://evil.invalid/novel/60079/9005",
  ]) {
    const { extension, requests } = loadNovelSource();
    await assert.rejects(() => extension.getHtmlContent("name", link), /invalid reader link/i);
    assert.equal(requests.length, 0);
  }
});

test("rejects missing, mismatched, and locked viewer data without unlocking", async () => {
  const cases = [
    [viewerHtml.replace('"token":"viewer-token"', '"token":""'), /viewer data.*token/i],
    [viewerHtml.replace('"episodeId":"9005"', '"episodeId":"9999"'), /viewer data.*ownership/i],
    [viewerHtml.replace('"active":false,"locked":false', '"active":true,"locked":true'), /locked chapter/i],
  ];

  for (const [html, pattern] of cases) {
    const { extension, requests } = loadNovelSource({ responses: [htmlResponse(html)] });
    await assert.rejects(() => extension.getHtmlContent("name", "/novel/60079/9005"), pattern);
    assert.equal(requests.length, 1);
    assert.doesNotMatch(requests[0].url, /unlock|purchase/i);
  }
});

test("uses paidGate.locked rather than paidGate.active as the lock decision", () => {
  const { helpers } = loadNovelSource();
  const activeButUnlocked = viewerHtml.replace(
    '"active":false,"locked":false',
    '"active":true,"locked":false',
  );
  const inactiveButLocked = viewerHtml.replace(
    '"active":false,"locked":false',
    '"active":false,"locked":true',
  );

  assert.doesNotThrow(() =>
    helpers.parseNovelViewerData(activeButUnlocked, "/novel/60079/9005"),
  );
  assert.throws(
    () => helpers.parseNovelViewerData(inactiveButLocked, "/novel/60079/9005"),
    /locked chapter/i,
  );
});

test("does not retry an unobserved 403 and does not expose secrets or bodies", async () => {
  let contentCalls = 0;
  const session = "c2Vzc2lvbi1zZWNyZXQ.signature";
  const { extension, requests } = loadNovelSource({
    responses(url, headers, index, request) {
      const pathname = new URL(url).pathname;
      if (request.method === "GET") return htmlResponse(viewerHtml);
      if (pathname === "/api/ad/canary") return jsonResponse('{"ok":true}');
      if (pathname === "/api/ad/challenge") return jsonResponse('{"ok":true}');
      if (pathname === "/api/nv-issue") return jsonResponse(JSON.stringify({ ok: true, session }));
      if (pathname === "/api/novel-content") {
        contentCalls += 1;
        return jsonResponse('{"ok":false,"error":"account_required","secret":"body-secret"}', 403);
      }
      throw new Error(`unexpected path ${pathname}`);
    },
  });

  await assert.rejects(
    () => extension.getHtmlContent("name", "/novel/60079/9005"),
    (error) => {
      assert.match(error.message, /Novel content.*status=403.*code=account_required/i);
      assert.doesNotMatch(error.message, /viewer-token|session-secret|body-secret|c2Vzc2lvbi/i);
      return true;
    },
  );
  assert.equal(contentCalls, 1);
  assert.equal(
    requests.filter((request) => request.url.endsWith("/api/ad/challenge")).length,
    1,
  );
});

test("rejects a cross-origin observation endpoint without requesting it", async () => {
  const { extension, requests } = loadNovelSource({
    responses(url, headers, index, request) {
      const pathname = new URL(url).pathname;
      if (request.method === "GET") return htmlResponse(viewerHtml);
      if (pathname === "/api/ad/canary") return jsonResponse('{"ok":true}');
      if (pathname === "/api/ad/challenge") {
        return jsonResponse(JSON.stringify({
          ok: true,
          challenge: {
            observationBatchUrl: "https://evil.invalid/api/observe",
            impressionUrls: ["https://ad.invalid/1"],
            minSeen: 1,
            token: "challenge-token",
          },
        }));
      }
      throw new Error(`unexpected path ${pathname}`);
    },
  });

  await assert.rejects(
    () => extension.getHtmlContent("name", "/novel/60079/9005"),
    /observation URL is invalid/i,
  );
  assert.equal(requests.some((request) => request.url.includes("evil.invalid")), false);
});

test("rejects a same-origin non-ad observation endpoint without requesting it", async () => {
  const { extension, requests } = loadNovelSource({
    responses(url, headers, index, request) {
      const pathname = new URL(url).pathname;
      if (request.method === "GET") return htmlResponse(viewerHtml);
      if (pathname === "/api/ad/canary") return jsonResponse('{"ok":true}');
      if (pathname === "/api/ad/challenge") {
        return jsonResponse(JSON.stringify({
          ok: true,
          challenge: {
            observationBatchUrl: "/api/novel-unlock",
            impressionUrls: ["https://ad.invalid/1"],
            minSeen: 1,
            token: "challenge-token",
          },
        }));
      }
      if (pathname === "/api/novel-unlock") {
        throw new Error("unsafe observation endpoint was requested");
      }
      throw new Error(`unexpected path ${pathname}`);
    },
  });

  await assert.rejects(
    () => extension.getHtmlContent("name", "/novel/60079/9005"),
    /observation URL is invalid/i,
  );
  assert.equal(
    requests.some((request) => /unlock|purchase/i.test(new URL(request.url).pathname)),
    false,
  );
});
