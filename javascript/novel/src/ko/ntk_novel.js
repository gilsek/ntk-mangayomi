const mangayomiSources = [
  {
    name: "NTK Novel",
    id: 260713003,
    baseUrl: "https://newtoki1.org",
    lang: "ko",
    typeSource: "single",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=128&domain=https://newtoki1.org",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: true,
    hasCloudflare: false,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/novel/src/ko/ntk_novel.js",
    apiUrl: "",
    version: "0.305",
    isManga: false,
    itemType: 2,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes:
      "Legacy Popular, Latest, title search, filters, detail, complete chapter lists qualified for ten-thousand-row works, and an authenticated text reader are implemented.",
    pkgPath: "novel/src/ko/ntk_novel.js",
  },
];

const LEGACY_DEFAULT_DOMAIN_NUMBER = "1";
const LEGACY_DOMAIN_NUMBER_PREFERENCE =
  "ntk_novel_legacy_domain_number";
const TABLET_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

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

function absoluteUrl(baseUrl, value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return joinUrl(baseUrl, value);
}

function pathFromUrl(value) {
  const text = String(value || "");
  const match = text.match(/^https?:\/\/[^/]+(\/[^?#]*)/i);
  if (match) return match[1];
  const noHash = text.split("#")[0];
  const noQuery = noHash.split("?")[0];
  return noQuery || "/";
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
  return htmlDecode(
    String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function attrValue(tag, attr) {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(tag || "").match(
    new RegExp(`${escaped}\\s*=\\s*[\"']([^\"']+)[\"']`, "i"),
  );
  return match ? htmlDecode(match[1]) : "";
}

function firstMatch(html, regex) {
  const match = String(html || "").match(regex);
  return match ? match[1] : "";
}

function allMatches(html, regex) {
  const results = [];
  let match;
  const pattern = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : `${regex.flags}g`,
  );
  while ((match = pattern.exec(String(html || ""))) !== null) {
    results.push(match[1]);
  }
  return results;
}

function parseStatus(text) {
  if (/연재|ongoing/i.test(String(text || ""))) return 0;
  if (/완결|complete/i.test(String(text || ""))) return 1;
  return 5;
}

function toEpochMillis(text) {
  const value = String(text || "").trim();
  const match = value.match(/^(\d{2}|\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return String(new Date(year, month, day).valueOf());
}

function parseDetailsHtml(html, baseUrl) {
  const metaTitle = htmlDecode(
    attrValue(
      firstMatch(html, /(<meta[^>]*property=["']og:title["'][^>]*>)/i),
      "content",
    ),
  ).replace(/\s+-\s+뉴토끼[\s\S]*$/i, "");
  const metaDescription = htmlDecode(
    attrValue(
      firstMatch(
        html,
        /(<meta[^>]*(?:property=["']og:description["']|name=["']description["'])[^>]*>)/i,
      ),
      "content",
    ),
  );
  const metaImage = attrValue(
    firstMatch(html, /(<meta[^>]*property=["']og:image["'][^>]*>)/i),
    "content",
  );
  const title =
    stripTags(
      firstMatch(
        html,
        /<h1[^>]*class=["'][^"']*hero-v2-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
      ),
    ) ||
    stripTags(
      firstMatch(
        html,
        /<div[^>]*class=["'][^"']*theme-detail-title-line[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      ),
    ) ||
    metaTitle;
  const author =
    stripTags(
      firstMatch(
        html,
        /<div[^>]*class=["'][^"']*hero-v2-author[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      ),
    ) ||
    stripTags(
      firstMatch(
        html,
        /<span[^>]*class=["'][^"']*theme-detail-info-label[^"']*["'][^>]*>\s*작가\s*<\/span>\s*<span[^>]*class=["'][^"']*theme-detail-info-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      ),
    );
  const description =
    stripTags(
      firstMatch(
        html,
        /<p[^>]*class=["'][^"']*hero-v2-desc[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
      ),
    ) ||
    stripTags(
      firstMatch(
        html,
        /<div[^>]*class=["'][^"']*theme-detail-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      ),
    ) ||
    metaDescription;
  const thumbTag = firstMatch(
    html,
    /<div[^>]*class=["'][^"']*hero-v2-thumb[^"']*["'][^>]*>[\s\S]*?(<img[^>]*>)/i,
  );
  const legacyThumbTag = firstMatch(
    html,
    /<div[^>]*class=["'][^"']*view-img[^"']*["'][^>]*>[\s\S]*?(<img[^>]*>)/i,
  );
  const thumbnailUrl = absoluteUrl(
    baseUrl,
    attrValue(thumbTag, "src") ||
      attrValue(thumbTag, "data-src") ||
      attrValue(legacyThumbTag, "src") ||
      attrValue(legacyThumbTag, "data-src") ||
      metaImage,
  );
  const statusText =
    stripTags(
      firstMatch(
        html,
        /<span[^>]*class=["'][^"']*pill-status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      ),
    ) ||
    stripTags(
      firstMatch(
        html,
        /<span[^>]*class=["'][^"']*theme-detail-info-label[^"']*["'][^>]*>\s*발행구분\s*<\/span>\s*<span[^>]*class=["'][^"']*theme-detail-info-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      ),
    );
  const genres = allMatches(
    html,
    /<a[^>]*class=["'][^"']*hero-v2-tag[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
  )
    .map(stripTags)
    .filter(Boolean);
  if (genres.length === 0) {
    const legacyGenre = stripTags(
      firstMatch(
        html,
        /<span[^>]*class=["'][^"']*theme-detail-info-label[^"']*["'][^>]*>\s*장르\s*<\/span>\s*<span[^>]*class=["'][^"']*theme-detail-info-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      ),
    );
    if (legacyGenre) {
      genres.push(...legacyGenre.split(/\s*,\s*/).filter(Boolean));
    }
  }

  return {
    title,
    author,
    description,
    thumbnailUrl,
    status: parseStatus(statusText),
    genre: genres,
  };
}

function filterOption(name, value) {
  return { type_name: "SelectOption", name, value };
}

function textFilter(type, name) {
  return { type_name: "TextFilter", type, name, state: "" };
}

function selectFilter(type, name, values, state = 0) {
  return {
    type_name: "SelectFilter",
    type,
    name,
    state,
    values: values.map(([optionName, value]) => filterOption(optionName, value)),
  };
}

function filterTextValue(filters, type) {
  const list = Array.isArray(filters) ? filters : [];
  const found = list.find((filter) => filter && filter.type === type);
  return found && typeof found.state === "string" ? found.state.trim() : "";
}

const NOVEL_INITIAL_OPTIONS = [
  ["전체", ""],
  ["ㄱ", "ㄱ"], ["ㄴ", "ㄴ"], ["ㄷ", "ㄷ"], ["ㄹ", "ㄹ"],
  ["ㅁ", "ㅁ"], ["ㅂ", "ㅂ"], ["ㅅ", "ㅅ"], ["ㅇ", "ㅇ"],
  ["ㅈ", "ㅈ"], ["ㅊ", "ㅊ"], ["ㅋ", "ㅋ"], ["ㅌ", "ㅌ"],
  ["ㅍ", "ㅍ"], ["ㅎ", "ㅎ"], ["a-z", "a-z"], ["0-9", "0-9"],
];
const NOVEL_STATUS_OPTIONS = [
  ["전체", "all"], ["연재중", "ongoing"], ["완결", "completed"],
];
const NOVEL_GENRE_OPTIONS = [
  ["전체", ""], ["판타지", "판타지"], ["무협", "무협"],
  ["19금", "19금"], ["현대", "현대"], ["로맨스", "로맨스"],
  ["로맨스 판타지", "로맨스 판타지"], ["BL", "BL"],
  ["라노벨", "라노벨"], ["기타", "기타"],
];
const NOVEL_PLATFORM_OPTIONS = [
  ["전체", ""], ["직접 업로드", "user"], ["노벨피아", "novelpia"],
  ["북토끼", "booktoki"], ["문피아", "munpia"], ["조아라", "joara"],
  ["카카오페이지", "kakaopage"], ["네이버 시리즈", "series"],
  ["리디북스", "ridi"], ["기타", "etc"],
];
const NOVEL_SORT_OPTIONS = [
  ["최신순", "as_update"], ["신작순", "as_new"],
  ["북마크순", "as_bookmark"], ["조회순", "as_view"],
  ["평점순", "as_rating"], ["화수순", "as_episode"],
];

function allowlistedFilterValue(filters, type, options, fallback) {
  const list = Array.isArray(filters) ? filters : [];
  const found = list.find((filter) => filter && filter.type === type);
  const state = found?.state;
  if (!Number.isInteger(state) || state < 0 || state >= options.length) {
    return fallback;
  }
  return options[state][1];
}

function normalizeNovelWorkLink(value, baseUrl) {
  const candidate = typeof value === "string" ? value.trim() : "";
  const invalid = () => {
    throw new Error("NTK Novel invalid work link");
  };

  if (
    !candidate ||
    candidate.includes("?") ||
    candidate.includes("#") ||
    candidate.includes("\\") ||
    /%(?:2e|2f|5c)/i.test(candidate)
  ) {
    invalid();
  }

  const absolute = candidate.match(
    /^https:\/\/([^/?#]+)(\/[^?#]*)$/i,
  );
  if (
    !absolute &&
    (/^[a-z][a-z0-9+.-]*:/i.test(candidate) ||
      candidate.startsWith("//") ||
      !candidate.startsWith("/"))
  ) {
    invalid();
  }

  const baseAuthority = String(baseUrl)
    .replace(/^https:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/:443$/i, "")
    .toLowerCase();
  if (
    absolute &&
    absolute[1].replace(/:443$/i, "").toLowerCase() !== baseAuthority
  ) {
    invalid();
  }

  const path = absolute ? absolute[2] : candidate;
  const match = path.match(/^\/novel\/(\d+)$/);
  if (!match) invalid();
  return `/novel/${match[1]}`;
}

function normalizeNovelEpisodeLink(value, baseUrl, expectedWorkId) {
  const candidate = typeof value === "string" ? value.trim() : "";
  const invalid = (reason) => {
    throw new Error(`NTK Novel chapter structure error: ${reason}`);
  };

  if (
    !candidate ||
    candidate.includes("?") ||
    candidate.includes("#") ||
    candidate.includes("\\") ||
    /%(?:2e|2f|5c)/i.test(candidate)
  ) {
    invalid("link");
  }

  const absolute = candidate.match(/^https:\/\/([^/?#]+)(\/[^?#]*)$/i);
  if (
    !absolute &&
    (/^[a-z][a-z0-9+.-]*:/i.test(candidate) ||
      candidate.startsWith("//") ||
      !candidate.startsWith("/"))
  ) {
    invalid("link");
  }

  const baseAuthority = String(baseUrl)
    .replace(/^https:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/:443$/i, "")
    .toLowerCase();
  if (
    absolute &&
    absolute[1].replace(/:443$/i, "").toLowerCase() !== baseAuthority
  ) {
    invalid("ownership");
  }

  const path = absolute ? absolute[2] : candidate;
  const match = path.match(/^\/novel\/(\d+)\/(\d+)$/);
  if (!match) invalid("link");
  if (match[1] !== String(expectedWorkId)) invalid("ownership");
  return `/novel/${match[1]}/${match[2]}`;
}

function normalizeNovelReaderLink(value, baseUrl) {
  const candidate = typeof value === "string" ? value.trim() : "";
  const pathMatch = candidate.match(
    /^(?:https:\/\/[^/?#]+)?\/novel\/(\d+)\/(\d+)$/i,
  );
  if (!pathMatch) throw new Error("NTK Novel invalid reader link");
  try {
    return normalizeNovelEpisodeLink(candidate, baseUrl, pathMatch[1]);
  } catch (_) {
    throw new Error("NTK Novel invalid reader link");
  }
}

function parseNovelViewerData(html, readerPath) {
  const raw = firstMatch(
    html,
    /<script[^>]*id=["']theme-novel-viewer-data["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!raw) throw new Error("NTK Novel viewer data missing=script");
  let data;
  try {
    data = JSON.parse(htmlDecode(raw));
  } catch (_) {
    throw new Error("NTK Novel viewer data invalid=JSON");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("NTK Novel viewer data invalid=root");
  }
  const novelId = String(data.novelId ?? "");
  const episodeId = String(data.episodeId ?? "");
  const token = typeof data.token === "string" ? data.token : "";
  const scopePath = typeof data.scopePath === "string" ? data.scopePath : "";
  if (!/^\d+$/.test(novelId)) {
    throw new Error("NTK Novel viewer data invalid=novelId");
  }
  if (!/^\d+$/.test(episodeId)) {
    throw new Error("NTK Novel viewer data invalid=episodeId");
  }
  if (!token.trim()) throw new Error("NTK Novel viewer data invalid=token");
  const paidGate = data.paidGate;
  const locked =
    paidGate === true ||
    (paidGate &&
      typeof paidGate === "object" &&
      paidGate.locked === true);
  if (locked) {
    throw new Error("NTK Novel locked chapter");
  }
  const expected = `/novel/${novelId}/${episodeId}`;
  if (scopePath !== readerPath || expected !== readerPath) {
    throw new Error("NTK Novel viewer data invalid=ownership");
  }
  return { novelId, episodeId, token, scopePath };
}

function isValidNovelDate(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{2}|\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return false;
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseChaptersHtml(html, baseUrl, expectedWorkId) {
  const form = firstMatch(
    html,
    /<form[^>]*id=["']serial-move["'][^>]*>([\s\S]*?)<\/form>/i,
  );
  if (!form) {
    throw new Error("NTK Novel chapter structure error: missing=serial-move");
  }
  const listBody = firstMatch(
    form,
    /<ul[^>]*class=["'][^"']*\blist-body\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i,
  );
  if (!listBody) {
    throw new Error("NTK Novel chapter structure error: missing=list-body");
  }

  const rows = allMatches(
    listBody,
    /<li[^>]*class=["'][^"']*\blist-item\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi,
  );
  if (rows.length === 0) {
    throw new Error("NTK Novel chapter structure error: missing=rows");
  }

  const chapters = [];
  const seen = new Set();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    const linkTag = firstMatch(
      row,
      /(<a[^>]*class=["'][^"']*\bitem-subject\b[^"']*["'][^>]*>)/i,
    );
    const href = attrValue(linkTag, "href");
    if (!href) {
      throw new Error(
        `NTK Novel chapter structure error: row=${rowNumber} missing=link`,
      );
    }

    let url;
    try {
      url = normalizeNovelEpisodeLink(href, baseUrl, expectedWorkId);
    } catch (error) {
      const reason = /ownership/i.test(String(error?.message))
        ? "ownership"
        : "link";
      throw new Error(
        `NTK Novel chapter structure error: row=${rowNumber} invalid=${reason}`,
      );
    }
    if (seen.has(url)) {
      throw new Error(
        `NTK Novel chapter structure error: row=${rowNumber} duplicate=link`,
      );
    }
    seen.add(url);

    const titleHtml = firstMatch(
      row,
      /<a[^>]*class=["'][^"']*\bitem-subject\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    ).replace(
      /<span[^>]*class=["'][^"']*theme-episode-title-metrics[^"']*["'][^>]*>[\s\S]*$/i,
      "",
    );
    const name = stripTags(titleHtml);
    if (!name) {
      throw new Error(
        `NTK Novel chapter structure error: row=${rowNumber} missing=title`,
      );
    }

    const rawDate = stripTags(
      firstMatch(
        row,
        /<div[^>]*class=["'][^"']*\bwr-date\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      ),
    );
    if (!isValidNovelDate(rawDate)) {
      throw new Error(
        `NTK Novel chapter structure error: row=${rowNumber} invalid=date`,
      );
    }

    const locked = /class=["'][^"']*ep-price-badge/i.test(row);
    chapters.push({
      name: locked ? `${name} 🔒` : name,
      url,
      link: absoluteUrl(baseUrl, url),
      dateUpload: toEpochMillis(rawDate),
      scanlator: locked ? "🔒" : "",
    });
  }
  return chapters;
}

function originFromUrl(value) {
  const match = String(value || "").match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : "";
}

function responseHeader(response, name) {
  if (!response) return "";
  const wanted = String(name || "").toLowerCase();
  const headers =
    response.headers || response.header || response.responseHeaders;
  if (!headers) return "";
  if (typeof headers.get === "function") {
    return String(headers.get(name) || headers.get(wanted) || "");
  }
  if (typeof headers.value === "function") {
    return String(headers.value(name) || headers.value(wanted) || "");
  }
  if (Array.isArray(headers)) {
    const found = headers.find(
      (entry) =>
        String((entry && (entry.name || entry.key || entry[0])) || "").toLowerCase() ===
        wanted,
    );
    return found ? String(found.value || found[1] || "") : "";
  }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return String(headers[key] || "");
  }
  return "";
}

function cookieHeaderFromMap(cookieMap) {
  return Object.keys(cookieMap)
    .map((key) => `${key}=${cookieMap[key]}`)
    .join("; ");
}

function parseCookieHeader(cookieHeader) {
  const result = {};
  String(cookieHeader || "")
    .split(";")
    .forEach((part) => {
      const [key, ...rest] = part.trim().split("=");
      if (key) result[key] = rest.join("=");
    });
  return result;
}

function mergeSetCookie(cookieHeader, setCookieHeader) {
  const cookies = parseCookieHeader(cookieHeader);
  String(setCookieHeader || "")
    .split(/,(?=\s*[^;,]+=)/)
    .forEach((line) => {
      const first = line.split(";")[0];
      const [key, ...rest] = first.trim().split("=");
      if (key) cookies[key] = rest.join("=");
    });
  return cookieHeaderFromMap(cookies);
}

function headersWithCookie(headers, cookieHeader) {
  return cookieHeader
    ? { ...headers, Cookie: cookieHeader, cookie: cookieHeader }
    : { ...headers };
}

function headersWithoutCookie(headers) {
  const clean = { ...headers };
  delete clean.Cookie;
  delete clean.cookie;
  return clean;
}

function browserFetchHeaders(headers, readerUrl) {
  return {
    ...headersWithoutCookie(headers),
    accept: "application/json, text/plain, */*",
    origin: originFromUrl(readerUrl),
    referer: readerUrl,
    "cache-control": "no-store",
    "x-requested-with": "XMLHttpRequest",
  };
}

function base64UrlFromBytes(bytes) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const bits = (first << 16) | (second << 8) | third;
    output += chars[(bits >> 18) & 63];
    output += chars[(bits >> 12) & 63];
    if (index + 1 < bytes.length) output += chars[(bits >> 6) & 63];
    if (index + 2 < bytes.length) output += chars[bits & 63];
  }
  return output;
}

function base64UrlToBytes(value) {
  const text = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = text + "=".repeat((4 - (text.length % 4)) % 4);
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }
  if (typeof atob === "function") {
    const raw = atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      bytes[index] = raw.charCodeAt(index);
    }
    return bytes;
  }
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let index = 0; index < padded.length; index += 1) {
    const char = padded.charAt(index);
    if (char === "=") break;
    const valueAt = alphabet.indexOf(char);
    if (valueAt < 0) throw new Error("Invalid Base64 payload");
    buffer = (buffer << 6) | valueAt;
    bits += 6;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}

function createTextEncoder() {
  if (typeof TextEncoder !== "undefined") return new TextEncoder();
  return {
    encode(value) {
      const encoded = unescape(encodeURIComponent(String(value)));
      const bytes = new Uint8Array(encoded.length);
      for (let index = 0; index < encoded.length; index += 1) {
        bytes[index] = encoded.charCodeAt(index);
      }
      return bytes;
    },
  };
}

function utf8DecodeBytes(bytes) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    text += `%${bytes[index].toString(16).padStart(2, "0")}`;
  }
  return decodeURIComponent(text);
}

function rightRotate(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Bytes(inputBytes) {
  const bytes = Array.from(inputBytes);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  bytes.push(
    (high >>> 24) & 255,
    (high >>> 16) & 255,
    (high >>> 8) & 255,
    high & 255,
    (low >>> 24) & 255,
    (low >>> 16) & 255,
    (low >>> 8) & 255,
    low & 255,
  );

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array(64);
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      words[index] =
        ((bytes[position] << 24) |
          (bytes[position + 1] << 16) |
          (bytes[position + 2] << 8) |
          bytes[position + 3]) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        (rightRotate(words[index - 15], 7) ^
          rightRotate(words[index - 15], 18) ^
          (words[index - 15] >>> 3)) >>>
        0;
      const s1 =
        (rightRotate(words[index - 2], 17) ^
          rightRotate(words[index - 2], 19) ^
          (words[index - 2] >>> 10)) >>>
        0;
      words[index] =
        (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 =
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
      const choice = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + choice + constants[index] + words[index]) >>> 0;
      const s0 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + majority) >>> 0;
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
  for (let index = 0; index < hash.length; index += 1) {
    output[index * 4] = (hash[index] >>> 24) & 255;
    output[index * 4 + 1] = (hash[index] >>> 16) & 255;
    output[index * 4 + 2] = (hash[index] >>> 8) & 255;
    output[index * 4 + 3] = hash[index] & 255;
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
  const innerHash = sha256Bytes(
    innerKey.concat(Array.from(encoder.encode(message))),
  );
  return sha256Bytes(outerKey.concat(Array.from(innerHash)));
}

async function hmacSha256Base64Url(secret, message) {
  if (typeof crypto === "undefined" || !crypto?.subtle) {
    return base64UrlFromBytes(hmacSha256Bytes(secret, message));
  }
  const encoder = createTextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return base64UrlFromBytes(new Uint8Array(signature));
}

function randomBytes(byteLength) {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function randomBase64Url(byteLength) {
  return base64UrlFromBytes(randomBytes(byteLength));
}

function randomHex(byteLength) {
  return Array.from(randomBytes(byteLength))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function h32(seed, input) {
  let hash = seed >>> 0;
  const text = String(input || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (`00000000${hash.toString(16)}`).slice(-8);
}

function createInitialNtkCookie(headers) {
  const userAgent =
    (headers && (headers["User-Agent"] || headers["user-agent"])) || "";
  const entropy = [
    userAgent,
    "ko-KR",
    "1920x1080x24",
    "-540",
    String(Math.random()),
    String(Date.now()),
  ].join("|");
  const fingerprint =
    h32(2166136261, entropy) +
    h32(3141592653, entropy) +
    h32(2654435761, entropy) +
    h32(1597334677, entropy);
  return cookieHeaderFromMap({ ntk_fp: fingerprint, ntk_pid: randomHex(16) });
}

const AES_SBOX = [
  99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,
  183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,
  44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,
  67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,
  68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,
  211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,
  221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,
  30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22,
];
const AES_RCON = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77];

function aesXtime(value) {
  return ((value << 1) ^ (((value >>> 7) & 1) * 0x1b)) & 255;
}

function aesSubWord(word) {
  return word.map((byte) => AES_SBOX[byte]);
}

function aesRotWord(word) {
  return [word[1], word[2], word[3], word[0]];
}

function aesExpandKey(key) {
  if (![16, 24, 32].includes(key.length)) {
    throw new Error("NTK Novel AES key length is invalid");
  }
  const wordCount = key.length / 4;
  const rounds = wordCount + 6;
  const words = [];
  for (let index = 0; index < wordCount; index += 1) {
    words[index] = [
      key[index * 4],
      key[index * 4 + 1],
      key[index * 4 + 2],
      key[index * 4 + 3],
    ];
  }
  for (let index = wordCount; index < 4 * (rounds + 1); index += 1) {
    let temp = words[index - 1].slice();
    if (index % wordCount === 0) {
      temp = aesSubWord(aesRotWord(temp));
      temp[0] ^= AES_RCON[index / wordCount];
    } else if (wordCount > 6 && index % wordCount === 4) {
      temp = aesSubWord(temp);
    }
    words[index] = words[index - wordCount].map(
      (byte, position) => byte ^ temp[position],
    );
  }
  return { words, rounds };
}

function aesAddRoundKey(state, words, round) {
  for (let column = 0; column < 4; column += 1) {
    const word = words[round * 4 + column];
    for (let row = 0; row < 4; row += 1) {
      state[column * 4 + row] ^= word[row];
    }
  }
}

function aesSubBytes(state) {
  for (let index = 0; index < 16; index += 1) {
    state[index] = AES_SBOX[state[index]];
  }
}

function aesShiftRows(state) {
  const copy = state.slice();
  for (let row = 1; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      state[column * 4 + row] = copy[((column + row) % 4) * 4 + row];
    }
  }
}

function aesMixColumns(state) {
  for (let column = 0; column < 4; column += 1) {
    const offset = column * 4;
    const first = state[offset];
    const second = state[offset + 1];
    const third = state[offset + 2];
    const fourth = state[offset + 3];
    const all = first ^ second ^ third ^ fourth;
    state[offset] ^= all ^ aesXtime(first ^ second);
    state[offset + 1] ^= all ^ aesXtime(second ^ third);
    state[offset + 2] ^= all ^ aesXtime(third ^ fourth);
    state[offset + 3] ^= all ^ aesXtime(fourth ^ first);
  }
}

function aesEncryptBlock(block, expanded) {
  const state = Array.from(block);
  aesAddRoundKey(state, expanded.words, 0);
  for (let round = 1; round < expanded.rounds; round += 1) {
    aesSubBytes(state);
    aesShiftRows(state);
    aesMixColumns(state);
    aesAddRoundKey(state, expanded.words, round);
  }
  aesSubBytes(state);
  aesShiftRows(state);
  aesAddRoundKey(state, expanded.words, expanded.rounds);
  return new Uint8Array(state);
}

function incrementCounter(counter) {
  for (let index = 15; index >= 12; index -= 1) {
    counter[index] = (counter[index] + 1) & 255;
    if (counter[index] !== 0) break;
  }
}

function xorBlock(first, second) {
  const output = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    output[index] = first[index] ^ second[index];
  }
  return output;
}

function ghashMultiply(first, second) {
  const product = new Uint8Array(16);
  const value = new Uint8Array(second);
  for (let bit = 0; bit < 128; bit += 1) {
    if ((first[Math.floor(bit / 8)] >>> (7 - (bit % 8))) & 1) {
      for (let index = 0; index < 16; index += 1) {
        product[index] ^= value[index];
      }
    }
    const lowBit = value[15] & 1;
    for (let index = 15; index >= 0; index -= 1) {
      const previous = index > 0 ? value[index - 1] & 1 : 0;
      value[index] = (value[index] >>> 1) | (previous << 7);
    }
    if (lowBit) value[0] ^= 0xe1;
  }
  return product;
}

function writeBitLength(block, offset, byteLength) {
  const bitLength = byteLength * 8;
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  block[offset] = (high >>> 24) & 255;
  block[offset + 1] = (high >>> 16) & 255;
  block[offset + 2] = (high >>> 8) & 255;
  block[offset + 3] = high & 255;
  block[offset + 4] = (low >>> 24) & 255;
  block[offset + 5] = (low >>> 16) & 255;
  block[offset + 6] = (low >>> 8) & 255;
  block[offset + 7] = low & 255;
}

function ghash(ciphertext, hashSubkey) {
  let state = new Uint8Array(16);
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    const block = new Uint8Array(16);
    block.set(ciphertext.slice(offset, offset + 16));
    state = ghashMultiply(xorBlock(state, block), hashSubkey);
  }
  const lengths = new Uint8Array(16);
  writeBitLength(lengths, 0, 0);
  writeBitLength(lengths, 8, ciphertext.length);
  return ghashMultiply(xorBlock(state, lengths), hashSubkey);
}

function constantTimeEqual(first, second) {
  let difference = first.length ^ second.length;
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (first[index % first.length] || 0) ^ (second[index % second.length] || 0);
  }
  return difference === 0;
}

function aesGcmDecryptAuthenticated(keyBytes, iv, encryptedWithTag) {
  if (iv.length !== 12 || encryptedWithTag.length < 16) {
    throw new Error("NTK Novel AES-GCM payload is invalid");
  }
  const ciphertext = encryptedWithTag.slice(0, encryptedWithTag.length - 16);
  const suppliedTag = encryptedWithTag.slice(encryptedWithTag.length - 16);
  const expanded = aesExpandKey(Array.from(keyBytes));
  const hashSubkey = aesEncryptBlock(new Uint8Array(16), expanded);
  const initialCounter = new Uint8Array(16);
  initialCounter.set(iv, 0);
  initialCounter[15] = 1;
  const expectedTag = xorBlock(
    aesEncryptBlock(initialCounter, expanded),
    ghash(ciphertext, hashSubkey),
  );
  if (!constantTimeEqual(suppliedTag, expectedTag)) {
    throw new Error("NTK Novel AES-GCM authentication failed");
  }

  const counter = initialCounter.slice();
  const plaintext = new Uint8Array(ciphertext.length);
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    incrementCounter(counter);
    const stream = aesEncryptBlock(counter, expanded);
    const size = Math.min(16, ciphertext.length - offset);
    for (let index = 0; index < size; index += 1) {
      plaintext[offset + index] = ciphertext[offset + index] ^ stream[index];
    }
  }
  return plaintext;
}

async function decryptNovelPayload(payload, nvSession, novelId, episodeId) {
  const data = base64UrlToBytes(payload);
  if (data.length < 28) throw new Error("NTK Novel payload is invalid");
  const iv = data.slice(0, 12);
  const encryptedWithTag = data.slice(12);
  const nvKey = base64UrlToBytes(String(nvSession || "").split(".")[0] || "");
  const tail = createTextEncoder().encode(`:${novelId}:${episodeId}:v3`);
  const input = new Uint8Array(nvKey.length + tail.length);
  input.set(nvKey, 0);
  input.set(tail, nvKey.length);
  try {
    if (typeof crypto !== "undefined" && crypto?.subtle) {
      const hash = await crypto.subtle.digest("SHA-256", input);
      const key = await crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        encryptedWithTag,
      );
      return utf8DecodeBytes(new Uint8Array(plain));
    }
    const keyBytes = sha256Bytes(Array.from(input));
    return utf8DecodeBytes(
      aesGcmDecryptAuthenticated(keyBytes, iv, encryptedWithTag),
    );
  } catch (_) {
    throw new Error("NTK Novel payload authentication failed");
  }
}

function unshuffleParagraphs(shuffled, perm) {
  if (
    !Array.isArray(shuffled) ||
    !Array.isArray(perm) ||
    shuffled.length !== perm.length
  ) {
    return shuffled || [];
  }
  const restored = new Array(shuffled.length);
  const seen = new Array(shuffled.length).fill(false);
  for (let index = 0; index < shuffled.length; index += 1) {
    const originalIndex = perm[index];
    if (
      !Number.isInteger(originalIndex) ||
      originalIndex < 0 ||
      originalIndex >= shuffled.length ||
      seen[originalIndex]
    ) {
      return shuffled;
    }
    seen[originalIndex] = true;
    restored[originalIndex] = shuffled[index];
  }
  return restored;
}

function strictUnshuffleParagraphs(shuffled, perm) {
  if (
    !Array.isArray(shuffled) ||
    !shuffled.every((paragraph) => typeof paragraph === "string") ||
    !Array.isArray(perm) ||
    shuffled.length !== perm.length
  ) {
    throw new Error("NTK Novel shuffled permutation is invalid");
  }
  const restored = new Array(shuffled.length);
  const seen = new Set();
  for (let index = 0; index < shuffled.length; index += 1) {
    const originalIndex = perm[index];
    if (
      !Number.isInteger(originalIndex) ||
      originalIndex < 0 ||
      originalIndex >= shuffled.length ||
      seen.has(originalIndex)
    ) {
      throw new Error("NTK Novel shuffled permutation is invalid");
    }
    seen.add(originalIndex);
    restored[originalIndex] = shuffled[index];
  }
  return restored;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTextParagraphs(paragraphs) {
  if (
    !Array.isArray(paragraphs) ||
    !paragraphs.every((paragraph) => typeof paragraph === "string")
  ) {
    throw new Error("NTK Novel text payload is invalid");
  }
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replace(/\r\n?|\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

function sanitizeNovelHtml(value) {
  const activeBlocks =
    "script|style|iframe|object|embed|form|svg|math|template|noscript";
  let html = String(value || "").replace(/<!--[\s\S]*?-->/g, "");
  const paired = new RegExp(
    `<(${activeBlocks})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`,
    "gi",
  );
  let previous;
  do {
    previous = html;
    html = html.replace(paired, "");
  } while (html !== previous);
  html = html
    .replace(new RegExp(`<(${activeBlocks})\\b[^>]*>[\\s\\S]*$`, "gi"), "")
    .replace(
      /<(?:meta|link|base|input|button|select|option|textarea|img|video|audio|source|canvas)\b[^>]*\/?\s*>/gi,
      "",
    );

  const allowed = new Set([
    "p", "br", "div", "section", "article", "h1", "h2", "h3", "h4",
    "h5", "h6", "blockquote", "pre", "code", "strong", "b", "em", "i",
    "ul", "ol", "li", "hr",
  ]);
  return (html.match(/<[^>]*>|[^<]+/g) || [])
    .map((part) => {
      if (!part.startsWith("<")) {
        return escapeHtml(htmlDecode(part)).replace(/\r\n?|\n/g, "<br>");
      }
      const closing = part.match(/^<\s*\/\s*([a-z0-9]+)[^>]*>$/i);
      if (closing) {
        const tag = closing[1].toLowerCase();
        return allowed.has(tag) && !["br", "hr"].includes(tag)
          ? `</${tag}>`
          : "";
      }
      const opening = part.match(/^<\s*([a-z0-9]+)\b[^>]*>$/i);
      if (!opening) return "";
      const tag = opening[1].toLowerCase();
      if (!allowed.has(tag)) return "";
      return tag === "br" || tag === "hr" ? `<${tag}>` : `<${tag}>`;
    })
    .join("");
}

function renderNovelContentHtml(decoded) {
  let payload;
  try {
    payload = JSON.parse(String(decoded || ""));
  } catch (_) {
    throw new Error("NTK Novel content payload is invalid");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("NTK Novel content payload is invalid");
  }
  if (payload.kind === "text") {
    return renderTextParagraphs(payload.paragraphs);
  }
  if (payload.kind === "text-shuffled") {
    return renderTextParagraphs(
      strictUnshuffleParagraphs(payload.paragraphs, payload.perm),
    );
  }
  if (payload.kind === "html" && typeof payload.html === "string") {
    return sanitizeNovelHtml(payload.html);
  }
  throw new Error("NTK Novel content kind is unsupported");
}

// region NOVEL_LIST_METHODS
const NOVEL_LIST_METHODS = {
  supportsLatest() {
    return true;
  },

  responseHeader(response, name) {
    const headers = response?.headers;
    if (!headers) return "";
    if (typeof headers.get === "function") {
      return String(
        headers.get(name) ?? headers.get(name.toLowerCase()) ?? "",
      );
    }
    if (typeof headers.value === "function") {
      return String(
        headers.value(name) ?? headers.value(name.toLowerCase()) ?? "",
      );
    }
    const expected = name.toLowerCase();
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === expected) return String(headers[key] ?? "");
    }
    return "";
  },

  assertPage(page) {
    if (!Number.isInteger(page) || page < 1) {
      throw new Error("NTK Novel invalid page");
    }
  },

  assertHtmlResponse(response, feature) {
    const status = Number(response?.statusCode ?? response?.status ?? 0);
    if (status < 200 || status >= 300) {
      throw new Error(`NTK Novel ${feature} HTTP failure status=${status}`);
    }
    const contentType = NOVEL_LIST_METHODS.responseHeader(
      response,
      "content-type",
    ).toLowerCase();
    if (!contentType.includes("text/html")) {
      throw new Error(`NTK Novel ${feature} response is not HTML`);
    }
  },

  buildListUrl(page, pub, sort) {
    NOVEL_LIST_METHODS.assertPage(page);
    return appendQuery(joinUrl(this.getLegacyBaseUrl(), "/novel"), {
      kind: "novel",
      page,
      pub,
      sod: "desc",
      sst: sort,
    });
  },

  parseQuery(href) {
    const normalized = String(href ?? "").replace(/&amp;/g, "&");
    if (!normalized.startsWith("/novel?")) return null;
    const query = {};
    try {
      for (const pair of normalized
        .slice(normalized.indexOf("?") + 1)
        .split("&")) {
        if (!pair) continue;
        const separator = pair.indexOf("=");
        const key = decodeURIComponent(
          separator < 0 ? pair : pair.slice(0, separator),
        );
        const value = decodeURIComponent(
          separator < 0 ? "" : pair.slice(separator + 1),
        );
        if (Object.prototype.hasOwnProperty.call(query, key)) return null;
        query[key] = value;
      }
    } catch (_) {
      return null;
    }
    return query;
  },

  hasNextPageForQuery(document, expectedQuery) {
    return document.select(".pagination-desktop a").some((anchor) => {
      const href = anchor?.getHref || anchor?.attr("href") || "";
      const query = NOVEL_LIST_METHODS.parseQuery(href);
      return Boolean(
        query &&
          Object.keys(query).length === Object.keys(expectedQuery).length &&
          Object.keys(expectedQuery).every(
            (key) => query[key] === String(expectedQuery[key]),
          ),
      );
    });
  },

  parseListPageForQuery(body, expectedQuery, feature) {
    const document = new Document(body);
    const rows = document.select("#webtoon-list-all > li");
    const empty = document.select(".list-wrap .wr-none").length > 0;
    if (rows.length === 0) {
      if (empty) return { list: [], hasNextPage: false };
      throw new Error(`NTK Novel ${feature} structure is missing`);
    }

    const list = [];
    const seen = new Set();
    for (const row of rows) {
      const titleElement = row.selectFirst("span.title.white");
      const linkElement = row.selectFirst(".img-item > a");
      const name = String(titleElement?.text ?? "").trim();
      const rawLink = String(
        linkElement?.getHref || linkElement?.attr("href") || "",
      ).trim();
      if (!name || !rawLink) {
        throw new Error(`NTK Novel malformed ${feature} card`);
      }

      let link;
      try {
        link = this.normalizeWorkLink(rawLink);
      } catch (_) {
        throw new Error(`NTK Novel malformed ${feature} card`);
      }
      if (seen.has(link)) continue;
      seen.add(link);

      const cover = row.selectFirst("img.theme-thumb-img");
      const rawCover = String(
        cover?.getSrc || cover?.attr("src") || "",
      ).trim();
      list.push({
        name,
        link,
        imageUrl: rawCover
          ? absoluteUrl(this.getLegacyBaseUrl(), rawCover)
          : "",
      });
    }

    return {
      list,
      hasNextPage: NOVEL_LIST_METHODS.hasNextPageForQuery(
        document,
        expectedQuery,
      ),
    };
  },

  parseListPage(body, page, pub, sort, feature) {
    return NOVEL_LIST_METHODS.parseListPageForQuery.call(
      this,
      body,
      {
        kind: "novel",
        page: page + 1,
        pub,
        sod: "desc",
        sst: sort,
      },
      feature,
    );
  },

  async requestList(page, pub, sort, feature) {
    const requestUrl = NOVEL_LIST_METHODS.buildListUrl.call(
      this,
      page,
      pub,
      sort,
    );
    const response = await this.client.get(requestUrl, this.getHeaders());
    NOVEL_LIST_METHODS.assertHtmlResponse(response, feature);
    return NOVEL_LIST_METHODS.parseListPage.call(
      this,
      response.body,
      page,
      pub,
      sort,
      feature,
    );
  },

  async getPopular(page) {
    return NOVEL_LIST_METHODS.requestList.call(
      this,
      page,
      "all",
      "as_view",
      "Popular",
    );
  },

  async getLatestUpdates(page) {
    return NOVEL_LIST_METHODS.requestList.call(
      this,
      page,
      "ongoing",
      "as_update",
      "Latest",
    );
  },
};
// endregion NOVEL_LIST_METHODS

// region NOVEL_SEARCH_FILTER_METHODS
const NOVEL_SEARCH_FILTER_METHODS = {
  getFilterList() {
    return [
      textFilter("author", "작가"),
      selectFilter("initial", "초성", NOVEL_INITIAL_OPTIONS),
      selectFilter("status", "상태", NOVEL_STATUS_OPTIONS),
      selectFilter("genre", "장르", NOVEL_GENRE_OPTIONS),
      selectFilter("platform", "플랫폼", NOVEL_PLATFORM_OPTIONS),
      selectFilter("sort", "정렬", NOVEL_SORT_OPTIONS),
    ];
  },

  buildSearchParams(query, page, filters) {
    NOVEL_LIST_METHODS.assertPage(page);
    const title = String(query ?? "").trim();
    if (title) {
      if (title.length < 2) return null;
      return {
        kind: "novel",
        page,
        pub: "all",
        sod: "desc",
        sst: "as_update",
        stx: title,
      };
    }

    return {
      author: filterTextValue(filters, "author"),
      jaum: allowlistedFilterValue(
        filters,
        "initial",
        NOVEL_INITIAL_OPTIONS,
        "",
      ),
      kind: "novel",
      page,
      plat: allowlistedFilterValue(
        filters,
        "platform",
        NOVEL_PLATFORM_OPTIONS,
        "",
      ),
      pub: allowlistedFilterValue(
        filters,
        "status",
        NOVEL_STATUS_OPTIONS,
        "all",
      ),
      sod: "desc",
      sst: allowlistedFilterValue(
        filters,
        "sort",
        NOVEL_SORT_OPTIONS,
        "as_update",
      ),
      tag: allowlistedFilterValue(
        filters,
        "genre",
        NOVEL_GENRE_OPTIONS,
        "",
      ),
    };
  },

  compactParams(params) {
    const compact = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      compact[key] = String(value);
    }
    return compact;
  },

  async search(query, page, filters) {
    const params = NOVEL_SEARCH_FILTER_METHODS.buildSearchParams(
      query,
      page,
      filters,
    );
    if (!params) return { list: [], hasNextPage: false };

    const titleSearch = Boolean(params.stx);
    const feature = titleSearch ? "Search" : "Filters";
    const requestUrl = appendQuery(
      joinUrl(this.getLegacyBaseUrl(), "/novel"),
      params,
    );
    const response = await this.client.get(requestUrl, this.getHeaders());
    NOVEL_LIST_METHODS.assertHtmlResponse(response, feature);

    const expectedQuery = NOVEL_SEARCH_FILTER_METHODS.compactParams({
      ...params,
      page: page + 1,
    });
    return NOVEL_LIST_METHODS.parseListPageForQuery.call(
      this,
      response.body,
      expectedQuery,
      feature,
    );
  },
};
// endregion NOVEL_SEARCH_FILTER_METHODS

// region NOVEL_DETAIL_METHODS
const NOVEL_DETAIL_METHODS = {
  async getDetail(value) {
    const link = this.normalizeWorkLink(value);
    const workId = link.match(/^\/novel\/(\d+)$/)[1];
    const response = await this.client.get(
      joinUrl(this.getLegacyBaseUrl(), link),
      this.getHeaders(),
    );
    NOVEL_LIST_METHODS.assertHtmlResponse(response, "Detail");

    const details = parseDetailsHtml(response.body, this.getLegacyBaseUrl());
    if (!details.title) {
      throw new Error("NTK Novel detail structure error: missing=title");
    }
    const chapters = parseChaptersHtml(
      response.body,
      this.getLegacyBaseUrl(),
      workId,
    );

    return {
      name: details.title,
      link,
      imageUrl: details.thumbnailUrl,
      description: details.description,
      author: details.author,
      artist: details.author,
      status: details.status,
      genre: details.genre,
      chapters,
    };
  },
};
// endregion NOVEL_DETAIL_METHODS

// region NOVEL_READER_METHODS
const NOVEL_READER_RETRY_CODES = new Set([
  "ad_ack_required",
  "fingerprint_required",
]);

function responseStatus(response) {
  return Number(response?.statusCode ?? response?.status ?? 0);
}

function parseSafeJsonResponse(response, feature, allowHttpFailure = false) {
  const status = responseStatus(response);
  if (!allowHttpFailure && (status < 200 || status >= 300)) {
    throw new Error(`NTK Novel ${feature} HTTP failure status=${status}`);
  }
  const contentType = responseHeader(response, "content-type").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw new Error(`NTK Novel ${feature} response is not JSON`);
  }
  try {
    return JSON.parse(String(response?.body || ""));
  } catch (_) {
    throw new Error(`NTK Novel ${feature} JSON is invalid`);
  }
}

function safeServerErrorCode(value) {
  return /^[a-z0-9_-]{1,64}$/i.test(String(value || ""))
    ? String(value)
    : "unknown";
}

function normalizeSameOriginObservationUrl(value, baseUrl) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (
    !candidate ||
    candidate.includes("\\") ||
    candidate.includes("#") ||
    /%(?:2e|2f|5c)/i.test(candidate)
  ) {
    throw new Error("NTK Novel challenge observation URL is invalid");
  }
  const absolute = candidate.match(/^https:\/\/([^/?#]+)(\/[^#]*)$/i);
  const path = (absolute ? absolute[2] : candidate).split("?", 1)[0];
  if (!path.startsWith("/api/ad/") || /\/(?:\.{1,2})(?:\/|$)/.test(path)) {
    throw new Error("NTK Novel challenge observation URL is invalid");
  }
  const baseAuthority = String(baseUrl)
    .replace(/^https:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/:443$/i, "")
    .toLowerCase();
  if (absolute) {
    if (absolute[1].replace(/:443$/i, "").toLowerCase() !== baseAuthority) {
      throw new Error("NTK Novel challenge observation URL is invalid");
    }
    return candidate;
  }
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    throw new Error("NTK Novel challenge observation URL is invalid");
  }
  return joinUrl(baseUrl, candidate);
}

const NOVEL_READER_METHODS = {
  async getHtmlContent(_name, value) {
    const baseUrl = this.getLegacyBaseUrl();
    const readerPath = normalizeNovelReaderLink(value, baseUrl);
    const readerUrl = joinUrl(baseUrl, readerPath);
    const sourceHeaders = this.getHeaders();
    const browserHeaders = browserFetchHeaders(sourceHeaders, readerUrl);
    let cookieHeader = createInitialNtkCookie(sourceHeaders);

    const readerResponse = await this.client.get(
      readerUrl,
      headersWithCookie(sourceHeaders, cookieHeader),
    );
    NOVEL_LIST_METHODS.assertHtmlResponse(readerResponse, "Reader");
    cookieHeader = mergeSetCookie(
      cookieHeader,
      responseHeader(readerResponse, "set-cookie"),
    );
    const viewerData = parseNovelViewerData(readerResponse.body, readerPath);

    const postJson = async (
      pathOrUrl,
      body,
      feature,
      allowHttpFailure = false,
      extraHeaders = {},
      parseBody = true,
    ) => {
      const response = await this.client.post(
        /^https:\/\//i.test(pathOrUrl) ? pathOrUrl : joinUrl(baseUrl, pathOrUrl),
        {
          ...headersWithCookie(browserHeaders, cookieHeader),
          "content-type": "application/json",
          ...extraHeaders,
        },
        body,
      );
      cookieHeader = mergeSetCookie(
        cookieHeader,
        responseHeader(response, "set-cookie"),
      );
      if (!parseBody) {
        const status = responseStatus(response);
        if (status < 200 || status >= 300) {
          throw new Error(`NTK Novel ${feature} HTTP failure status=${status}`);
        }
        return { response, data: null };
      }
      return {
        response,
        data: parseSafeJsonResponse(response, feature, allowHttpFailure),
      };
    };

    await postJson(
      "/api/ad/canary",
      { adGuardLoaded: true },
      "ad canary",
    );

    const runChallenge = async (force) => {
      const { data } = await postJson(
        "/api/ad/challenge",
        { path: readerPath, force: Boolean(force) },
        "ad challenge",
      );
      const challenge = data?.challenge;
      if (!challenge?.observationBatchUrl) return;
      if (
        typeof challenge.token !== "string" ||
        !challenge.token ||
        !Array.isArray(challenge.impressionUrls)
      ) {
        throw new Error("NTK Novel challenge observation data is invalid");
      }
      const minimum = Number(challenge.minSeen ?? 1);
      if (!Number.isInteger(minimum) || minimum < 1) {
        throw new Error("NTK Novel challenge observation data is invalid");
      }
      const urls = challenge.impressionUrls
        .filter((url) => typeof url === "string" && url.length > 0)
        .slice(0, minimum);
      if (urls.length < minimum) {
        throw new Error("NTK Novel challenge observation data is invalid");
      }
      const observationUrl = normalizeSameOriginObservationUrl(
        challenge.observationBatchUrl,
        baseUrl,
      );
      await postJson(
        observationUrl,
        { challengeToken: challenge.token, path: readerPath, urls },
        "challenge observation",
        false,
        {},
        false,
      );
    };
    await runChallenge(false);

    const { data: sessionData } = await postJson(
      "/api/nv-issue",
      {},
      "Novel session",
    );
    const session =
      typeof sessionData?.session === "string" ? sessionData.session : "";
    if (!session) throw new Error("NTK Novel session is missing");

    const requestContent = async () => {
      const nonce = randomBase64Url(24);
      const proof = await hmacSha256Base64Url(
        session,
        `${viewerData.token}.${nonce}`,
      );
      return postJson(
        "/api/novel-content",
        {
          novelId: viewerData.novelId,
          episodeId: viewerData.episodeId,
          token: viewerData.token,
          nonce,
          proof,
        },
        "Novel content",
        true,
        { "x-novel-client": "shadow-v3", "x-nv-session": session },
      );
    };

    let content = await requestContent();
    let status = responseStatus(content.response);
    let code = safeServerErrorCode(content.data?.error);
    if (status === 403 && NOVEL_READER_RETRY_CODES.has(code)) {
      await runChallenge(true);
      content = await requestContent();
      status = responseStatus(content.response);
      code = safeServerErrorCode(content.data?.error);
    }
    if (
      status < 200 ||
      status >= 300 ||
      content.data?.ok !== true ||
      typeof content.data?.payload !== "string" ||
      !content.data.payload
    ) {
      throw new Error(
        `NTK Novel content failure status=${status} code=${code}`,
      );
    }

    const decoded = await decryptNovelPayload(
      content.data.payload,
      session,
      viewerData.novelId,
      viewerData.episodeId,
    );
    return renderNovelContentHtml(decoded);
  },
};
// endregion NOVEL_READER_METHODS

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get supportsLatest() {
    return NOVEL_LIST_METHODS.supportsLatest.call(this);
  }

  getLegacyDomainNumber() {
    const configured = new SharedPreferences().get(
      LEGACY_DOMAIN_NUMBER_PREFERENCE,
    );
    const value =
      String(configured ?? "").trim() || LEGACY_DEFAULT_DOMAIN_NUMBER;
    if (!/^\d+$/.test(value)) {
      throw new Error("Invalid Legacy domain number preference");
    }
    return value;
  }

  getLegacyBaseUrl() {
    return `https://newtoki${this.getLegacyDomainNumber()}.org`;
  }

  getHeaders() {
    return {
      Referer: `${this.getLegacyBaseUrl()}/`,
      "User-Agent": TABLET_USER_AGENT,
    };
  }

  normalizeWorkLink(value) {
    return normalizeNovelWorkLink(value, this.getLegacyBaseUrl());
  }

  async getPopular(page) {
    return NOVEL_LIST_METHODS.getPopular.call(this, page);
  }

  async getLatestUpdates(page) {
    return NOVEL_LIST_METHODS.getLatestUpdates.call(this, page);
  }

  async search(query, page, filters) {
    return NOVEL_SEARCH_FILTER_METHODS.search.call(this, query, page, filters);
  }

  getFilterList() {
    return NOVEL_SEARCH_FILTER_METHODS.getFilterList.call(this);
  }

  async getDetail(url) {
    return NOVEL_DETAIL_METHODS.getDetail.call(this, url);
  }

  async getHtmlContent(name, url) {
    return NOVEL_READER_METHODS.getHtmlContent.call(this, name, url);
  }

  async cleanHtmlContent(html) {
    return html;
  }

  getSourcePreferences() {
    return [
      {
        key: LEGACY_DOMAIN_NUMBER_PREFERENCE,
        editTextPreference: {
          title: "Legacy domain number",
          summary: "Enter only the number after newtoki.",
          value: LEGACY_DEFAULT_DOMAIN_NUMBER,
          dialogTitle: "Legacy domain number",
          dialogMessage: "Example: 1 for https://newtoki1.org",
        },
      },
    ];
  }
}

const NOVEL_TEST_EXPORTS = {
  absoluteUrl,
  aesGcmDecryptAuthenticated,
  allMatches,
  appendQuery,
  attrValue,
  base64UrlFromBytes,
  base64UrlToBytes,
  browserFetchHeaders,
  decryptNovelPayload,
  escapeHtml,
  filterOption,
  filterTextValue,
  firstMatch,
  headersWithCookie,
  headersWithoutCookie,
  hmacSha256Base64Url,
  htmlDecode,
  isValidNovelDate,
  joinUrl,
  mergeSetCookie,
  normalizeNovelEpisodeLink,
  normalizeNovelReaderLink,
  normalizeNovelWorkLink,
  parseChaptersHtml,
  parseDetailsHtml,
  parseNovelViewerData,
  parseStatus,
  pathFromUrl,
  renderNovelContentHtml,
  responseHeader,
  sanitizeNovelHtml,
  selectFilter,
  stripTags,
  textFilter,
  toEpochMillis,
  trimSlash,
  unshuffleParagraphs,
  utf8DecodeBytes,
};
