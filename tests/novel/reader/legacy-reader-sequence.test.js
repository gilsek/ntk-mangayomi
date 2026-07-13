const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadNovelSource } = require("../helpers/load-novel-source");
const { encryptNovelPayload } = require("../helpers/novel-payload");

const viewerHtml = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "reader", "legacy-viewer.html"),
  "utf8",
);
const session = `${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url")}.signature`;
const plaintext = JSON.stringify({ kind: "text", paragraphs: ["첫째\n둘째", "셋째"] });
const payload = encryptNovelPayload({
  session,
  novelId: "60079",
  episodeId: "9005",
  plaintext,
  iv: Buffer.from("000102030405060708090a0b", "hex"),
});

function response(body, setCookie = "") {
  return {
    statusCode: 200,
    headers: {
      "content-type": body.startsWith("<") ? "text/html; charset=utf-8" : "application/json",
      ...(setCookie ? { "set-cookie": setCookie } : {}),
    },
    body,
  };
}

function deterministicCrypto() {
  return {
    getRandomValues(bytes) {
      bytes.fill(7);
      return bytes;
    },
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("runs the authenticated reader sequence with cookie continuity", async () => {
  const { extension, requests } = loadNovelSource({
    cryptoValue: deterministicCrypto(),
    responses(url, headers, index, request) {
      const pathname = new URL(url).pathname;
      if (request.method === "GET") return response(viewerHtml, "reader=1; Path=/");
      if (pathname === "/api/ad/canary") return response('{"ok":true}', "canary=1; Path=/");
      if (pathname === "/api/ad/challenge") {
        return response(JSON.stringify({
          ok: true,
          challenge: {
            observationBatchUrl: "/api/ad/observe",
            impressionUrls: ["https://ad.invalid/1", "https://ad.invalid/2", "https://ad.invalid/3"],
            minSeen: 2,
            token: "challenge-token",
          },
        }), "challenge=1; Path=/");
      }
      if (pathname === "/api/ad/observe") {
        return {
          statusCode: 204,
          headers: { "set-cookie": "observed=1; Path=/" },
          body: "",
        };
      }
      if (pathname === "/api/nv-issue") return response(JSON.stringify({ ok: true, session }), "nv=1; Path=/");
      if (pathname === "/api/novel-content") return response(JSON.stringify({ ok: true, payload }));
      throw new Error(`unexpected path ${pathname}`);
    },
  });

  const html = await extension.getHtmlContent("테스트 5화", "/novel/60079/9005");

  assert.equal(html, "<p>첫째<br>둘째</p>\n<p>셋째</p>");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    [
      "GET /novel/60079/9005",
      "POST /api/ad/canary",
      "POST /api/ad/challenge",
      "POST /api/ad/observe",
      "POST /api/nv-issue",
      "POST /api/novel-content",
    ],
  );
  assert.deepEqual(plain(requests[1].body), { adGuardLoaded: true });
  assert.deepEqual(plain(requests[2].body), { path: "/novel/60079/9005", force: false });
  assert.deepEqual(plain(requests[3].body), {
    challengeToken: "challenge-token",
    path: "/novel/60079/9005",
    urls: ["https://ad.invalid/1", "https://ad.invalid/2"],
  });
  assert.equal(requests[5].body.novelId, "60079");
  assert.equal(requests[5].body.episodeId, "9005");
  assert.equal(requests[5].body.token, "viewer-token");
  assert.match(requests[5].body.nonce, /^[A-Za-z0-9_-]+$/);
  assert.match(requests[5].body.proof, /^[A-Za-z0-9_-]+$/);
  assert.match(requests[5].headers.Cookie, /reader=1/);
  assert.match(requests[5].headers.Cookie, /canary=1/);
  assert.match(requests[5].headers.Cookie, /challenge=1/);
  assert.match(requests[5].headers.Cookie, /observed=1/);
  assert.match(requests[5].headers.Cookie, /nv=1/);
});

test("retries content exactly once after an observed acknowledgement error", async () => {
  let contentCalls = 0;
  const { extension, requests } = loadNovelSource({
    cryptoValue: deterministicCrypto(),
    responses(url, headers, index, request) {
      const pathname = new URL(url).pathname;
      if (request.method === "GET") return response(viewerHtml);
      if (pathname === "/api/ad/canary") return response('{"ok":true}');
      if (pathname === "/api/ad/challenge") return response('{"ok":true}');
      if (pathname === "/api/nv-issue") return response(JSON.stringify({ ok: true, session }));
      if (pathname === "/api/novel-content") {
        contentCalls += 1;
        if (contentCalls === 1) {
          return {
            statusCode: 403,
            headers: { "content-type": "application/json" },
            body: '{"ok":false,"error":"ad_ack_required"}',
          };
        }
        return response(JSON.stringify({ ok: true, payload }));
      }
      throw new Error(`unexpected path ${pathname}`);
    },
  });

  await extension.getHtmlContent("테스트 5화", "/novel/60079/9005");

  assert.equal(contentCalls, 2);
  const challenges = requests.filter((request) => request.url.endsWith("/api/ad/challenge"));
  assert.deepEqual(challenges.map((request) => request.body.force), [false, true]);
});

test("stops after the single allowed acknowledgement retry", async () => {
  let contentCalls = 0;
  const { extension, requests } = loadNovelSource({
    cryptoValue: deterministicCrypto(),
    responses(url, headers, index, request) {
      const pathname = new URL(url).pathname;
      if (request.method === "GET") return response(viewerHtml);
      if (pathname === "/api/ad/canary") return response('{"ok":true}');
      if (pathname === "/api/ad/challenge") return response('{"ok":true}');
      if (pathname === "/api/nv-issue") return response(JSON.stringify({ ok: true, session }));
      if (pathname === "/api/novel-content") {
        contentCalls += 1;
        return {
          statusCode: 403,
          headers: { "content-type": "application/json" },
          body: '{"ok":false,"error":"ad_ack_required"}',
        };
      }
      throw new Error(`unexpected path ${pathname}`);
    },
  });

  await assert.rejects(
    () => extension.getHtmlContent("name", "/novel/60079/9005"),
    /Novel content.*status=403.*code=ad_ack_required/i,
  );
  assert.equal(contentCalls, 2);
  const challenges = requests.filter((request) => request.url.endsWith("/api/ad/challenge"));
  assert.deepEqual(challenges.map((request) => request.body.force), [false, true]);
});
