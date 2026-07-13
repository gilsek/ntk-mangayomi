const crypto = require("node:crypto");

function encryptNovelPayload({ session, novelId, episodeId, plaintext, iv }) {
  const nvKey = Buffer.from(session.split(".")[0], "base64url");
  const key = crypto
    .createHash("sha256")
    .update(nvKey)
    .update(`:${novelId}:${episodeId}:v3`)
    .digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url");
}

module.exports = { encryptNovelPayload };
