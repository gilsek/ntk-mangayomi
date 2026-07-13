const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { encryptNovelPayload } = require("../helpers/novel-payload");
const { loadNovelSource } = require("../helpers/load-novel-source");

function hex(value) {
  return Uint8Array.from(Buffer.from(value, "hex"));
}

test("decrypts the standard zero-key AES-GCM vector with tag authentication", () => {
  const { helpers } = loadNovelSource();
  const plaintext = helpers.aesGcmDecryptAuthenticated(
    hex("00000000000000000000000000000000"),
    hex("000000000000000000000000"),
    hex("0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf"),
  );

  assert.equal(Buffer.from(plaintext).toString("hex"), "00000000000000000000000000000000");
});

test("rejects ciphertext and tag tampering before returning plaintext", () => {
  const { helpers } = loadNovelSource();
  const key = hex("00000000000000000000000000000000");
  const iv = hex("000000000000000000000000");
  const valid = hex("0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf");
  const badCiphertext = valid.slice();
  const badTag = valid.slice();
  badCiphertext[0] ^= 1;
  badTag[badTag.length - 1] ^= 1;

  assert.throws(() => helpers.aesGcmDecryptAuthenticated(key, iv, badCiphertext), /authentication/i);
  assert.throws(() => helpers.aesGcmDecryptAuthenticated(key, iv, badTag), /authentication/i);
});

test("decrypts a deterministic Novel payload without WebCrypto", async () => {
  const { helpers } = loadNovelSource();
  const session = `${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url")}.signature`;
  const payload = encryptNovelPayload({
    session,
    novelId: "60079",
    episodeId: "9005",
    plaintext: JSON.stringify({ kind: "text", paragraphs: ["인증 성공"] }),
    iv: Buffer.from("000102030405060708090a0b", "hex"),
  });

  assert.equal(
    await helpers.decryptNovelPayload(payload, session, "60079", "9005"),
    JSON.stringify({ kind: "text", paragraphs: ["인증 성공"] }),
  );
});

test("uses WebCrypto when available and rejects an authenticated-payload mutation", async () => {
  const { helpers } = loadNovelSource({ cryptoValue: crypto.webcrypto });
  const session = `${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url")}.signature`;
  const expected = JSON.stringify({ kind: "text", paragraphs: ["WebCrypto 성공"] });
  const payload = encryptNovelPayload({
    session,
    novelId: "60079",
    episodeId: "9005",
    plaintext: expected,
    iv: Buffer.from("0b0a09080706050403020100", "hex"),
  });
  const mutated = Buffer.from(payload, "base64url");
  mutated[mutated.length - 1] ^= 1;

  assert.equal(
    await helpers.decryptNovelPayload(payload, session, "60079", "9005"),
    expected,
  );
  await assert.rejects(
    () => helpers.decryptNovelPayload(mutated.toString("base64url"), session, "60079", "9005"),
    /authentication/i,
  );
});
