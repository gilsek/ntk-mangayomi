const mangayomiSources = [
  {
    id: 240710001,
    name: "NTK Webtoon",
    lang: "ko",
    baseUrl: "https://sbxh9.com",
    apiUrl: "",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://sbxh9.com",
    typeSource: "single",
    itemType: 0,
    version: "0.1.0",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: true,
    appMinVerReq: "0.5.0",
    additionalParams: "source=webtoon",
    pkgPath: "manga/src/ko/ntk.js"
  },
  {
    id: 240710002,
    name: "NTK Manga",
    lang: "ko",
    baseUrl: "https://sbxh9.com",
    apiUrl: "",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://sbxh9.com",
    typeSource: "single",
    itemType: 0,
    version: "0.1.0",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: true,
    appMinVerReq: "0.5.0",
    additionalParams: "source=manga",
    pkgPath: "manga/src/ko/ntk.js"
  }
];

const ProviderBase = typeof MProvider === "undefined" ? class {} : MProvider;

const VARIANTS = {
  webtoon: {
    name: "NTK Webtoon",
    kind: "webtoon",
    listEndpoint: "/api/works",
    latestEndpoint: "/api/works",
    searchKind: "webtoon",
    imageEndpoint: "/api/webtoon-images"
  },
  manga: {
    name: "NTK Manga",
    kind: "manhwa",
    listEndpoint: "/api/manhwa-list",
    latestEndpoint: "/manhwa/updates",
    searchKind: "manhwa",
    imageEndpoint: "/api/manhwa-images"
  }
};

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function joinUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path || "")) return path;
  const cleanBase = trimSlash(baseUrl);
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path || ""}`;
  return `${cleanBase}${cleanPath}`;
}

function appendQuery(url, params) {
  const pairs = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  if (pairs.length === 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${pairs.join("&")}`;
}

function parseAdditionalParams(params) {
  const result = {};
  String(params || "").split("&").forEach((part) => {
    const [key, value] = part.split("=");
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(value || "");
  });
  return result;
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return htmlDecode(String(value || "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function attrValue(tag, attr) {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(tag || "").match(new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? htmlDecode(match[1]) : "";
}

function absoluteUrl(baseUrl, value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return joinUrl(baseUrl, value);
}

function firstMatch(html, regex) {
  const match = String(html || "").match(regex);
  return match ? match[1] : "";
}

function allMatches(html, regex) {
  const results = [];
  let match;
  const pattern = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  while ((match = pattern.exec(String(html || ""))) !== null) {
    results.push(match[1]);
  }
  return results;
}

function parseStatus(text) {
  if (String(text || "").includes("연재중")) return 0;
  if (String(text || "").includes("완결")) return 1;
  return 5;
}

function parseDetailsHtml(html, baseUrl) {
  const title = stripTags(firstMatch(html, /<h1[^>]*class=["'][^"']*hero-v2-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i));
  const author = stripTags(firstMatch(html, /<div[^>]*class=["'][^"']*hero-v2-author[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i));
  const description = stripTags(firstMatch(html, /<p[^>]*class=["'][^"']*hero-v2-desc[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
  const thumbTag = firstMatch(html, /<div[^>]*class=["'][^"']*hero-v2-thumb[^"']*["'][^>]*>[\s\S]*?(<img[^>]*>)/i);
  const thumbnailUrl = absoluteUrl(baseUrl, attrValue(thumbTag, "src") || attrValue(thumbTag, "data-src"));
  const statusText = stripTags(firstMatch(html, /<span[^>]*class=["'][^"']*pill-status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
  const genres = allMatches(html, /<a[^>]*class=["'][^"']*hero-v2-tag[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi).map(stripTags).filter(Boolean);

  return {
    title,
    author,
    description,
    thumbnailUrl,
    status: parseStatus(statusText),
    genre: genres
  };
}

function parseChaptersHtml(html, baseUrl) {
  const rows = allMatches(html, /<li[^>]*class=["'][^"']*ep-row-v2[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi);
  return rows.map((row) => {
    const linkTag = firstMatch(row, /(<a[^>]*class=["'][^"']*ep-row-v2-link[^"']*["'][^>]*>)/i);
    const href = attrValue(linkTag, "href");
    const name = stripTags(firstMatch(row, /<div[^>]*class=["'][^"']*ep-row-v2-title[^"']*["'][^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i));
    const dateUpload = stripTags(firstMatch(row, /<span[^>]*class=["'][^"']*ep-row-v2-date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
    const locked = /class=["'][^"']*ep-price-badge/i.test(row);
    return {
      name: locked && name ? `${name} 🔒` : name,
      url: href.startsWith("http") ? new URL(href).pathname : href,
      link: absoluteUrl(baseUrl, href),
      dateUpload: toEpochMillis(dateUpload),
      scanlator: locked ? "🔒" : ""
    };
  }).filter((chapter) => chapter.url && chapter.name);
}

function toEpochMillis(text) {
  const value = String(text || "").trim();
  const match = value.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return String(new Date(year, month, day).valueOf());
}

function pickArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["images", "pages", "list", "items", "works", "data", "results", "rows"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  if (data.data && typeof data.data === "object") return pickArray(data.data);
  return [];
}

function fieldOf(item, names) {
  for (const name of names) {
    const value = item && item[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function parseWorksResponse(body, baseUrl, variantName = "webtoon") {
  const data = typeof body === "string" ? JSON.parse(body) : body;
  const routePrefix = variantName === "manga" ? "/manga" : "/webtoon";
  const list = pickArray(data).map((item) => {
    const sourceWorkId = fieldOf(item, ["sourceWorkId", "id", "workId", "hid", "slug"]);
    const rawUrl = fieldOf(item, ["url", "href", "path", "link"]);
    const link = rawUrl || (sourceWorkId ? `${routePrefix}/${sourceWorkId}` : "");
    return {
      name: String(fieldOf(item, ["title", "name", "subject"])),
      imageUrl: absoluteUrl(baseUrl, fieldOf(item, ["thumbnailUrl", "thumbnail", "cover", "coverUrl", "imageUrl"])),
      url: link,
      link
    };
  }).filter((item) => item.name && item.link);

  const hasNextPage = Boolean(data && (data.hasNextPage || data.hasNext || data.hasMore || data.next || data.totalPages > data.page));
  return { list, hasNextPage };
}

function parsePageImagesResponse(body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (/ad_ack_required/.test(text)) {
    throw new Error("Ad acknowledgment required - open the site in a browser to refresh your session, then retry");
  }
  const data = typeof body === "string" ? JSON.parse(body) : body;
  const images = Array.isArray(data) ? data : pickArray({ images: data.images || data.pages || data.list || data.data });
  const urls = images.map((image) => {
    if (typeof image === "string") return image;
    return fieldOf(image, ["url", "src", "image", "imageUrl", "path"]);
  }).filter(Boolean);
  if (urls.length === 0) throw new Error("Failed to load images, please retry");
  return urls;
}

function parseReaderBootstrap(html) {
  const text = String(html || "");
  const readField = (name) => {
    const escapedMarker = `\\"${name}\\":\\"`;
    let start = text.indexOf(escapedMarker);
    let terminator = `\\"`;
    if (start < 0) {
      const normalMarker = `"${name}":"`;
      start = text.indexOf(normalMarker);
      terminator = `"`;
      if (start < 0) return "";
      start += normalMarker.length;
    } else {
      start += escapedMarker.length;
    }
    const end = text.indexOf(terminator, start);
    if (end < 0) return "";
    return text.slice(start, end).replace(/\\"/g, "\"").replace(/\\\//g, "/");
  };
  return {
    imagesToken: readField("imagesToken"),
    viewerUrl: htmlDecode(readField("viewerUrl")),
    sourceWorkId: readField("sourceWorkId"),
    episodeId: readField("episodeId")
  };
}

function base64UrlFromBytes(bytes) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const bits = (a << 16) | (b << 8) | c;
    output += chars[(bits >> 18) & 63];
    output += chars[(bits >> 12) & 63];
    if (i + 1 < bytes.length) output += chars[(bits >> 6) & 63];
    if (i + 2 < bytes.length) output += chars[bits & 63];
  }
  return output;
}

function randomBase64Url(byteLength) {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return base64UrlFromBytes(bytes);
}

async function hmacSha256Base64Url(secret, message) {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return base64UrlFromBytes(hmacSha256Bytes(secret, message));
  }
  const encoder = createTextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64UrlFromBytes(new Uint8Array(signature));
}

function createTextEncoder() {
  if (typeof TextEncoder !== "undefined") return new TextEncoder();
  return {
    encode(value) {
      const encoded = unescape(encodeURIComponent(String(value)));
      const bytes = new Uint8Array(encoded.length);
      for (let i = 0; i < encoded.length; i += 1) bytes[i] = encoded.charCodeAt(i);
      return bytes;
    }
  };
}

function rightRotate(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Bytes(inputBytes) {
  const bytes = Array.from(inputBytes);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  bytes.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255);
  bytes.push((low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array(64);
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      words[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = (rightRotate(words[i - 15], 7) ^ rightRotate(words[i - 15], 18) ^ (words[i - 15] >>> 3)) >>> 0;
      const s1 = (rightRotate(words[i - 2], 17) ^ rightRotate(words[i - 2], 19) ^ (words[i - 2] >>> 10)) >>> 0;
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const s1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + ch + constants[i] + words[i]) >>> 0;
      const s0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  const output = new Uint8Array(32);
  for (let i = 0; i < hash.length; i += 1) {
    output[i * 4] = (hash[i] >>> 24) & 255;
    output[i * 4 + 1] = (hash[i] >>> 16) & 255;
    output[i * 4 + 2] = (hash[i] >>> 8) & 255;
    output[i * 4 + 3] = hash[i] & 255;
  }
  return output;
}

function hmacSha256Bytes(secret, message) {
  const encoder = createTextEncoder();
  let key = Array.from(encoder.encode(secret));
  if (key.length > 64) key = Array.from(sha256Bytes(key));
  while (key.length < 64) key.push(0);
  const outerKey = key.map((byte) => byte ^ 0x5c);
  const innerKey = key.map((byte) => byte ^ 0x36);
  const innerHash = sha256Bytes(innerKey.concat(Array.from(encoder.encode(message))));
  return sha256Bytes(outerKey.concat(Array.from(innerHash)));
}

function createNtkSource(options = {}) {
  const variantName = options.variant || "webtoon";
  const variant = VARIANTS[variantName] || VARIANTS.webtoon;
  const baseUrl = trimSlash(options.baseUrl || "https://sbxh9.com");

  return {
    variantName,
    variant,
    baseUrl,
    buildApiUrl(path, params) {
      return appendQuery(joinUrl(baseUrl, path), params || {});
    },
    __buildPopularUrl(page) {
      return this.buildApiUrl(variant.listEndpoint, {
        status: "ongoing",
        sort: "views",
        page,
        pageSize: 49,
        withTotal: 1
      });
    },
    __buildLatestUrl(page) {
      if (variant.latestEndpoint.startsWith("/api/")) {
        return this.buildApiUrl(variant.latestEndpoint, {
          status: "ongoing",
          page,
          pageSize: 49,
          withTotal: 1
        });
      }
      return this.buildApiUrl(variant.latestEndpoint, { page });
    },
    __buildSearchUrl(query, page) {
      return this.buildApiUrl("/search", {
        q: query,
        kind: variant.searchKind,
        page
      });
    },
    __buildImageCandidates(chapterUrl) {
      const path = chapterUrl.startsWith("http") ? new URL(chapterUrl).pathname : chapterUrl;
      const parts = path.split("/").filter(Boolean);
      const workId = parts[1] || "";
      const episodeId = parts[parts.length - 1] || "";
      return [
        this.buildApiUrl(variant.imageEndpoint, { sourceWorkId: workId, episodeId }),
        this.buildApiUrl(variant.imageEndpoint, { workId, episodeId }),
        this.buildApiUrl(variant.imageEndpoint, { path })
      ];
    }
  };
}

class DefaultExtension extends ProviderBase {
  constructor() {
    super();
    this.client = typeof Client === "undefined" ? null : new Client();
  }

  getVariantName() {
    const params = parseAdditionalParams(this.source && this.source.additionalParams);
    if (params.source) return params.source === "manga" ? "manga" : "webtoon";
    return (this.source && /manga/i.test(this.source.name)) ? "manga" : "webtoon";
  }

  getBaseUrl() {
    const fallback = trimSlash((this.source && this.source.baseUrl) || "https://sbxh9.com");
    if (typeof SharedPreferences === "undefined") return fallback;
    const prefs = new SharedPreferences();
    return trimSlash(prefs.get("ntkBaseUrl") || fallback);
  }

  getSource() {
    return createNtkSource({
      variant: this.getVariantName(),
      baseUrl: this.getBaseUrl()
    });
  }

  getHeaders() {
    const baseUrl = this.getBaseUrl();
    return {
      Referer: `${baseUrl}/`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    };
  }

  async getPopular(page) {
    const source = this.getSource();
    const res = await this.client.get(source.__buildPopularUrl(page), this.getHeaders());
    return parseWorksResponse(res.body, source.baseUrl, source.variantName);
  }

  async getLatestUpdates(page) {
    const source = this.getSource();
    const res = await this.client.get(source.__buildLatestUrl(page), this.getHeaders());
    if (source.variant.latestEndpoint.startsWith("/api/")) {
      return parseWorksResponse(res.body, source.baseUrl, source.variantName);
    }
    return this.parseMangaCards(res.body, source.baseUrl);
  }

  async search(query, page, filters) {
    const source = this.getSource();
    const res = await this.client.get(source.__buildSearchUrl(query, page), this.getHeaders());
    if ((res.body || "").trim().startsWith("{") || (res.body || "").trim().startsWith("[")) {
      return parseWorksResponse(res.body, source.baseUrl, source.variantName);
    }
    return this.parseMangaCards(res.body, source.baseUrl);
  }

  parseMangaCards(body, baseUrl) {
    const list = [];
    const pattern = /(<a[^>]*class=["'][^"']*card[^"']*["'][^>]*>)([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = pattern.exec(String(body || ""))) !== null) {
      const cardTag = match[1];
      const card = match[2];
      const href = attrValue(cardTag, "href");
      const name = stripTags(firstMatch(card, /<p[^>]*class=["'][^"']*subject[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
      const imgTag = firstMatch(card, /(<img[^>]*>)/i);
      const imageUrl = absoluteUrl(baseUrl, attrValue(imgTag, "src") || attrValue(imgTag, "data-src"));
      if (name && href) list.push({ name, imageUrl, url: href, link: href });
    }
    return { list, hasNextPage: false };
  }

  async getDetail(url) {
    const source = this.getSource();
    const detailUrl = joinUrl(source.baseUrl, url);
    const res = await this.client.get(detailUrl, this.getHeaders());
    const details = parseDetailsHtml(res.body, source.baseUrl);
    const chapters = parseChaptersHtml(res.body, source.baseUrl);
    return {
      title: details.title,
      imageUrl: details.thumbnailUrl,
      description: details.description,
      genre: details.genre,
      author: details.author,
      artist: details.author,
      status: details.status,
      chapters
    };
  }

  async getPageList(url) {
    const source = this.getSource();
    const headers = this.getHeaders();
    headers["X-WebView-Intercept"] = "true";
    const readerUrl = joinUrl(source.baseUrl, url);

    try {
      const readerRes = await this.client.get(readerUrl, headers);
      const body = readerRes.body || "";
      if (body.trim().startsWith("{") || body.trim().startsWith("[")) {
        return parsePageImagesResponse(body).map((imageUrl) => ({ url: absoluteUrl(source.baseUrl, imageUrl), headers }));
      }
      const bootstrap = parseReaderBootstrap(body);
      if (bootstrap.imagesToken || bootstrap.viewerUrl) {
        try {
          const sessionRes = await this.client.post(
            joinUrl(source.baseUrl, "/api/nv-issue"),
            headers,
            {}
          );
          const sessionData = JSON.parse(sessionRes.body || "{}");
          const session = sessionData.session;
          if (!session) throw new Error("missing session");
          const nonce = randomBase64Url(24);
          const proof = await hmacSha256Base64Url(session, `${bootstrap.imagesToken}.${nonce}`);
          const endpoint = source.variantName === "manga" ? "/api/manga-images" : "/api/webtoon-images";
          const imageRes = await this.client.post(
            joinUrl(source.baseUrl, endpoint),
            {
              ...headers,
              "content-type": "application/json",
              "x-images-client": "viewer-v1",
              "x-nv-session": session
            },
            {
              workId: bootstrap.sourceWorkId,
              episodeId: bootstrap.episodeId,
              token: bootstrap.imagesToken,
              nonce,
              proof
            }
          );
          return parsePageImagesResponse(imageRes.body).map((imageUrl) => ({ url: absoluteUrl(source.baseUrl, imageUrl), headers }));
        } catch (proofError) {
          throw new Error(`NTK image API requires browser fingerprint/session proof: ${proofError.message}`);
        }
      }
    } catch (error) {
      if (/session proof|Ad acknowledgment/.test(String(error && error.message))) throw error;
    }

    const candidates = source.__buildImageCandidates(url);
    let lastError = null;
    for (const candidate of candidates) {
      try {
        const res = await this.client.get(candidate, headers);
        return parsePageImagesResponse(res.body).map((imageUrl) => ({ url: absoluteUrl(source.baseUrl, imageUrl), headers }));
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    throw new Error("Failed to load images, please retry");
  }

  getFilterList() {
    return [
      {
        type_name: "HeaderFilter",
        name: "Filters are minimal in this Mangayomi port. Text search is supported."
      }
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "ntkBaseUrl",
        editTextPreference: {
          title: "Override BaseUrl",
          summary: "Current NTK domain, for example https://sbxh9.com",
          value: "https://sbxh9.com",
          dialogTitle: "Override BaseUrl",
          dialogMessage: "Change this when the sbxh domain number changes."
        }
      }
    ];
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    mangayomiSources,
    DefaultExtension,
    __ntkTest: {
      createNtkSource,
      parseDetailsHtml(html, baseUrl) {
        const details = parseDetailsHtml(html, baseUrl);
        return {
          title: details.title,
          author: details.author,
          description: details.description,
          thumbnailUrl: details.thumbnailUrl,
          status: details.status === 0 ? "ONGOING" : details.status === 1 ? "COMPLETED" : "UNKNOWN",
          genre: details.genre.join(", ")
        };
      },
      parseChaptersHtml(html, baseUrl) {
        return parseChaptersHtml(html, baseUrl).map((chapter) => ({
          name: chapter.name,
          url: chapter.url,
          dateUpload: chapter.dateUpload ? formatKoreanShortDate(Number(chapter.dateUpload)) : null,
          scanlator: chapter.scanlator
        }));
      },
      parseWorksResponse,
      parsePageImagesResponse,
      parseReaderBootstrap,
      hmacSha256Base64Url,
      buildApiUrl: appendQuery
    }
  };
}

function formatKoreanShortDate(value) {
  const date = new Date(value);
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}
