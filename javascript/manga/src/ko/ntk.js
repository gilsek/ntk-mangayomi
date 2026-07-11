const mangayomiSources = [
  {
    id: 240710001,
    name: "NTK Webtoon",
    lang: "ko",
    baseUrl: "https://toki30.com",
    apiUrl: "",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://toki30.com",
    typeSource: "single",
    itemType: 0,
    version: "0.3.7",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: false,
    appMinVerReq: "0.5.0",
    additionalParams: "source=webtoon",
    pkgPath: "manga/src/ko/ntk.js"
  },
  {
    id: 240710002,
    name: "NTK Manhwa",
    lang: "ko",
    baseUrl: "https://toki30.com",
    apiUrl: "",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://toki30.com",
    typeSource: "single",
    itemType: 0,
    version: "0.3.6",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: false,
    appMinVerReq: "0.5.0",
    additionalParams: "source=manga",
    pkgPath: "manga/src/ko/ntk.js"
  },
  {
    id: 240710003,
    name: "NTK Novel",
    lang: "ko",
    baseUrl: "https://toki30.com",
    apiUrl: "",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://toki30.com",
    typeSource: "single",
    itemType: 2,
    version: "0.3.7",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: false,
    appMinVerReq: "0.5.0",
    additionalParams: "source=novel",
    pkgPath: "manga/src/ko/ntk.js"
  }
];

const ProviderBase = typeof MProvider === "undefined" ? class {} : MProvider;

const VARIANTS = {
  webtoon: {
    name: "NTK Webtoon",
    kind: "webtoon",
    listPage: "/webtoon",
    authorField: "author",
    listEndpoint: "/api/works",
    latestEndpoint: "/api/works",
    searchKind: "webtoon",
    imageEndpoint: "/api/webtoon-images"
  },
  manga: {
    name: "NTK Manhwa",
    kind: "manhwa",
    listPage: "/manhwa",
    authorField: "artist",
    listEndpoint: "/api/manhwa-list",
    latestEndpoint: "/api/manhwa-list",
    searchKind: "manhwa",
    imageEndpoint: "/api/manhwa-images"
  },
  novel: {
    name: "NTK Novel",
    kind: "novel",
    listPage: "/novel",
    authorField: "author",
    listEndpoint: "/api/novel-list",
    latestEndpoint: "/api/novel-list",
    searchKind: "novel",
    imageEndpoint: ""
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

function canonicalQueryUrl(url, params) {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
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
  return htmlDecode(String(value || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, ""))
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

function originFromUrl(value) {
  const match = String(value || "").match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : "";
}

function pathFromUrl(value) {
  const text = String(value || "");
  const match = text.match(/^https?:\/\/[^/]+(\/[^?#]*)/i);
  if (match) return match[1];
  const noHash = text.split("#")[0];
  const noQuery = noHash.split("?")[0];
  return noQuery || "/";
}

function normalizeSourceUrl(url, variantName) {
  if (variantName !== "manga") return url;
  return String(url || "").replace(/(^https?:\/\/[^/]+)?\/manga(?=\/|$)/i, "$1/manhwa");
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
  if (/연재|ongoing/i.test(String(text || ""))) return 0;
  if (/완결|complete/i.test(String(text || ""))) return 1;
  return 5;
}

function parseDetailsHtml(html, baseUrl) {
  const metaTitle = htmlDecode(attrValue(firstMatch(html, /(<meta[^>]*property=["']og:title["'][^>]*>)/i), "content")).replace(/\s+-\s+뉴토끼[\s\S]*$/i, "");
  const metaDescription = htmlDecode(attrValue(firstMatch(html, /(<meta[^>]*(?:property=["']og:description["']|name=["']description["'])[^>]*>)/i), "content"));
  const metaImage = attrValue(firstMatch(html, /(<meta[^>]*property=["']og:image["'][^>]*>)/i), "content");
  const title = stripTags(firstMatch(html, /<h1[^>]*class=["'][^"']*hero-v2-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i))
    || stripTags(firstMatch(html, /<div[^>]*class=["'][^"']*theme-detail-title-line[^"']*["'][^>]*>([\s\S]*?)<\/div>/i))
    || metaTitle;
  const author = stripTags(firstMatch(html, /<div[^>]*class=["'][^"']*hero-v2-author[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i))
    || stripTags(firstMatch(html, /<span[^>]*class=["'][^"']*theme-detail-info-label[^"']*["'][^>]*>\s*작가\s*<\/span>\s*<span[^>]*class=["'][^"']*theme-detail-info-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
  const description = stripTags(firstMatch(html, /<p[^>]*class=["'][^"']*hero-v2-desc[^"']*["'][^>]*>([\s\S]*?)<\/p>/i))
    || stripTags(firstMatch(html, /<div[^>]*class=["'][^"']*theme-detail-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i))
    || metaDescription;
  const thumbTag = firstMatch(html, /<div[^>]*class=["'][^"']*hero-v2-thumb[^"']*["'][^>]*>[\s\S]*?(<img[^>]*>)/i);
  const legacyThumbTag = firstMatch(html, /<div[^>]*class=["'][^"']*view-img[^"']*["'][^>]*>[\s\S]*?(<img[^>]*>)/i);
  const thumbnailUrl = absoluteUrl(baseUrl, attrValue(thumbTag, "src") || attrValue(thumbTag, "data-src") || attrValue(legacyThumbTag, "src") || attrValue(legacyThumbTag, "data-src") || metaImage);
  const statusText = stripTags(firstMatch(html, /<span[^>]*class=["'][^"']*pill-status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i))
    || stripTags(firstMatch(html, /<span[^>]*class=["'][^"']*theme-detail-info-label[^"']*["'][^>]*>\s*발행구분\s*<\/span>\s*<span[^>]*class=["'][^"']*theme-detail-info-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
  const genres = allMatches(html, /<a[^>]*class=["'][^"']*hero-v2-tag[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi).map(stripTags).filter(Boolean);
  if (genres.length === 0) {
    const legacyGenre = stripTags(firstMatch(html, /<span[^>]*class=["'][^"']*theme-detail-info-label[^"']*["'][^>]*>\s*장르\s*<\/span>\s*<span[^>]*class=["'][^"']*theme-detail-info-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
    if (legacyGenre) genres.push(...legacyGenre.split(/\s*,\s*/).filter(Boolean));
  }

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
  let rows = allMatches(html, /<li[^>]*class=["'][^"']*ep-row-v2[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi);
  let legacy = false;
  if (rows.length === 0) {
    rows = allMatches(html, /<li[^>]*class=["'][^"']*list-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi);
    legacy = true;
  }
  return rows.map((row) => {
    const linkTag = legacy
      ? firstMatch(row, /(<a[^>]*class=["'][^"']*item-subject[^"']*["'][^>]*>)/i)
      : firstMatch(row, /(<a[^>]*class=["'][^"']*ep-row-v2-link[^"']*["'][^>]*>)/i);
    const href = attrValue(linkTag, "href");
    const legacyTitle = firstMatch(row, /<a[^>]*class=["'][^"']*item-subject[^"']*["'][^>]*>([\s\S]*?)<\/a>/i).replace(/<span[^>]*class=["'][^"']*theme-episode-title-metrics[^"']*["'][^>]*>[\s\S]*$/i, "");
    const name = legacy
      ? stripTags(legacyTitle)
      : stripTags(firstMatch(row, /<div[^>]*class=["'][^"']*ep-row-v2-title[^"']*["'][^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i));
    const dateUpload = legacy
      ? stripTags(firstMatch(row, /<div[^>]*class=["'][^"']*wr-date[^"']*["'][^>]*>([\s\S]*?)<\/div>/i))
      : stripTags(firstMatch(row, /<span[^>]*class=["'][^"']*ep-row-v2-date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
    const locked = /class=["'][^"']*ep-price-badge/i.test(row);
    return {
      name: locked && name ? `${name} 🔒` : name,
      url: href.startsWith("http") ? pathFromUrl(href) : href,
      link: absoluteUrl(baseUrl, href),
      dateUpload: toEpochMillis(dateUpload),
      scanlator: locked ? "🔒" : ""
    };
  }).filter((chapter) => chapter.url && chapter.name);
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

function pickArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["images", "pages", "list", "items", "works", "novels", "data", "results", "rows"]) {
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
  const routePrefix = variantName === "manga" ? "/manhwa" : variantName === "novel" ? "/novel" : "/webtoon";
  const list = pickArray(data).map((item) => {
    const sourceWorkId = variantName === "novel"
      ? fieldOf(item, ["id", "novelId", "sourceWorkId", "workId", "hid", "slug"])
      : fieldOf(item, ["sourceWorkId", "id", "workId", "hid", "slug"]);
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
  if (!text || !text.trim()) {
    throw new Error("Failed to load images: empty image API response");
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

function isMaintenanceHtml(body) {
  return /점검중|maintenance|잠시 후 다시 시도/i.test(String(body || ""));
}

function parseWebviewImageResponse(result) {
  if (!result) throw new Error("WebView image extraction returned no result");
  const data = typeof result === "string" ? JSON.parse(result) : result;
  if (data && data.ok === false) {
    throw new Error(`WebView image extraction failed: ${data.error || "unknown error"}`);
  }
  const images = Array.isArray(data) ? data : pickArray({ images: data.images || data.pages || data.list || data.data });
  const urls = images.map((image) => {
    if (typeof image === "string") return image;
    return fieldOf(image, ["src", "url", "currentSrc", "image", "imageUrl", "path"]);
  }).filter((imageUrl) => /^https?:\/\//i.test(imageUrl));
  if (urls.length === 0) throw new Error("WebView image extraction found no image URLs");
  return urls;
}

function responseSummary(response) {
  const status = response && response.statusCode;
  const body = String((response && response.body) || "").replace(/\s+/g, " ").slice(0, 240);
  return `status=${status}; body=${body}`;
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
    imagesToken: readField("imagesToken") || readField("token"),
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

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let output = "";
  for (let i = 0; i < bytes.length; i += 1) output += bytes[i].toString(16).padStart(2, "0");
  return output;
}

function h32(seed, input) {
  let hash = seed >>> 0;
  const text = String(input || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function createNtkFingerprint(userAgent) {
  const entropy = [
    userAgent || "",
    "ko-KR",
    "1920x1080x24",
    "-540",
    String(Math.random()),
    String(Date.now())
  ].join("|");
  return h32(2166136261, entropy) + h32(3141592653, entropy) + h32(2654435761, entropy) + h32(1597334677, entropy);
}

function cookieHeaderFromMap(cookieMap) {
  return Object.keys(cookieMap).map((key) => `${key}=${cookieMap[key]}`).join("; ");
}

function parseCookieHeader(cookieHeader) {
  const result = {};
  String(cookieHeader || "").split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) result[key] = rest.join("=");
  });
  return result;
}

function cookieNames(cookieHeader) {
  return Object.keys(parseCookieHeader(cookieHeader)).sort().join(",");
}

function mergeSetCookie(cookieHeader, setCookieHeader) {
  const cookies = parseCookieHeader(cookieHeader);
  String(setCookieHeader || "").split(/,(?=\s*[^;,]+=)/).forEach((line) => {
    const first = line.split(";")[0];
    const [key, ...rest] = first.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  });
  return cookieHeaderFromMap(cookies);
}

function responseHeader(response, name) {
  if (!response) return "";
  const wanted = String(name || "").toLowerCase();
  const headers = response.headers || response.header || response.responseHeaders;
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || headers.get(wanted) || "";
  if (Array.isArray(headers)) {
    const found = headers.find((entry) => String(entry && (entry.name || entry.key || entry[0]) || "").toLowerCase() === wanted);
    return found ? String(found.value || found[1] || "") : "";
  }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return String(headers[key] || "");
  }
  return "";
}

function headersWithCookie(headers, cookieHeader) {
  return cookieHeader ? { ...headers, Cookie: cookieHeader, cookie: cookieHeader } : { ...headers };
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
    "x-requested-with": "XMLHttpRequest"
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
    values: values.map(([optionName, value]) => filterOption(optionName, value))
  };
}

function filterValue(filters, type, fallback) {
  const list = Array.isArray(filters) ? filters : [];
  const found = list.find((filter) => filter && filter.type === type);
  if (!found || !Array.isArray(found.values)) return fallback;
  const option = found.values[Number(found.state || 0)];
  return option && option.value !== undefined ? option.value : fallback;
}

function filterTextValue(filters, type) {
  const list = Array.isArray(filters) ? filters : [];
  const found = list.find((filter) => filter && filter.type === type);
  return found && typeof found.state === "string" ? found.state.trim() : "";
}

const STATUS_FILTER_OPTIONS = [["전체", "all"], ["연재중", "ongoing"], ["완결", "completed"]];
const SORT_FILTER_OPTIONS = [
  ["최신순", "as_update"], ["신작순", "as_new"], ["북마크순", "as_bookmark"],
  ["조회순", "as_view"], ["평점순", "as_rating"], ["화수순", "as_episode"]
];

const WEBTOON_GENRES = ["판타지", "액션", "개그", "미스터리", "로맨스", "드라마", "무협", "스포츠", "일상", "학원"];
const MANGA_GENRES = ["17", "BL", "SF", "TS", "개그", "게임", "도박", "드라마", "라노벨", "러브코미디", "먹방", "백합", "보추", "순정", "스릴러", "스포츠", "시대", "애니화", "액션", "음악", "이세계", "일상", "전생", "추리", "판타지", "학원", "호러"];
const NOVEL_GENRES = ["판타지", "무협", "19금", "현대", "로맨스", "로맨스 판타지", "BL", "라노벨", "기타"];

const WEBTOON_CATEGORIES = [
  ["\uC77C\uBC18\uC6F9\uD230", "\uC77C\uBC18\uC6F9\uD230"],
  ["\uC131\uC778\uC6F9\uD230", "\uC131\uC778\uC6F9\uD230"],
  ["BL/GL", "BL/GL"],
  ["\uC644\uACB0\uC6F9\uD230", "\uC644\uACB0\uC6F9\uD230"]
];

function genreOptions(genres) {
  return [["전체", ""], ...genres.map((genre) => [genre, genre])];
}

function buildFilterList(variantName = "webtoon") {
  const commonTail = (genres) => [
    selectFilter("status", "상태", STATUS_FILTER_OPTIONS, 0),
    selectFilter("genre", "장르", genreOptions(genres)),
    selectFilter("sort", "정렬", SORT_FILTER_OPTIONS)
  ];

  if (variantName === "manga") {
    return [
      textFilter("artist", "작가"),
      ...commonTail(MANGA_GENRES)
    ];
  }

  if (variantName === "novel") {
    return [
      textFilter("author", "작가"),
      selectFilter("status", "상태", STATUS_FILTER_OPTIONS, 0),
      selectFilter("genre", "장르", genreOptions(NOVEL_GENRES)),
      selectFilter("platform", "플랫폼", [
        ["전체", ""], ["직접 업로드", "user"], ["노벨피아", "novelpia"], ["북토끼", "booktoki"],
        ["문피아", "munpia"], ["조아라", "joara"], ["카카오페이지", "kakaopage"],
        ["네이버 시리즈", "series"], ["리디북스", "ridi"], ["기타", "etc"]
      ]),
      selectFilter("sort", "정렬", SORT_FILTER_OPTIONS)
    ];
  }

  return [
    textFilter("author", "작가"),
    selectFilter("weekday", "요일", [["전체", ""], ["월", "월"], ["화", "화"], ["수", "수"], ["목", "목"], ["금", "금"], ["토", "토"], ["일", "일"], ["열흘", "열흘"]]),
    selectFilter("platform", "플랫폼", [
      ["전체", ""], ["네이버", "1"], ["카카오", "3"], ["레진", "4"], ["투믹스", "5"],
      ["탑툰", "6"], ["코미카", "7"], ["배틀코믹스", "8"], ["케이툰", "10"],
      ["피너툰", "13"], ["봄툰", "14"], ["코미코", "15"], ["기타", "99"]
    ]),
    selectFilter("category", "\uB300\uCE74\uD14C\uACE0\uB9AC", WEBTOON_CATEGORIES),
    selectFilter("genre", "장르", genreOptions(WEBTOON_GENRES)),
    selectFilter("sort", "정렬", SORT_FILTER_OPTIONS)
  ];
}

function createInitialNtkCookie(headers) {
  const userAgent = (headers && (headers["User-Agent"] || headers["user-agent"])) || "";
  return cookieHeaderFromMap({
    ntk_fp: createNtkFingerprint(userAgent),
    ntk_pid: randomHex(16)
  });
}

function createWebviewImageExtractorScript(readerUrl = "") {
  const expectedReaderUrl = JSON.stringify(String(readerUrl || ""));
  return `
(function(){
  var expectedReaderUrl = ${expectedReaderUrl};
  if (expectedReaderUrl && window.location.pathname === "/") {
    if (window.__ntkBootstrapScheduled) return;
    window.__ntkBootstrapScheduled = true;
    window.setTimeout(function(){ window.location.href = expectedReaderUrl; }, 3000);
    return;
  }
  if (window.__ntkImageInterceptorInstalled) return;
  window.__ntkImageInterceptorInstalled = true;
  var finished = false;
  var lastError = "";
  function respond(payload) {
    if (finished) return;
    finished = true;
    try {
      window.flutter_inappwebview.callHandler("setResponse", JSON.stringify(payload));
    } catch (e) {}
  }
  function imageUrlOf(img) {
    return img.currentSrc || img.src || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
  }
  function imageUrlsOf(payload) {
    var list = Array.isArray(payload) ? payload : (payload && (payload.images || payload.pages || payload.list || payload.data));
    if (!Array.isArray(list)) return [];
    return list.map(function(image){
      if (typeof image === "string") return image;
      return image && (image.url || image.src || image.image || image.imageUrl || image.path) || "";
    }).filter(function(src){ return /^https?:\\/\\//i.test(src); });
  }
  function isImageApi(url) {
    var value = String(url || "");
    return value.indexOf("/api/manhwa-images") >= 0 || value.indexOf("/api/webtoon-images") >= 0;
  }
  function installFetchInterceptor() {
    if (window.__ntkFetchInterceptorInstalled) return;
    var nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function") return;
    window.__ntkFetchInterceptorInstalled = true;
    window.fetch = function(){
      var args = arguments;
      return nativeFetch.apply(this, args).then(function(response){
        var request = args[0];
        var requestUrl = typeof request === "string" ? request : (request && request.url);
        if (isImageApi(response.url || requestUrl)) {
          response.clone().json().then(function(payload){
            var images = imageUrlsOf(payload);
            if (images.length > 0) respond({ ok: true, images: images });
          }).catch(function(){});
        }
        return response;
      });
    };
  }
  window.addEventListener("ntk-ad-ack-ready", function(event){
    var detail = event && event.detail || {};
    if (detail.scope && detail.scope !== window.location.pathname) return;
    Promise.resolve().then(installFetchInterceptor);
  });
  function collect() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(".theme-viewer-images .theme-viewer-image img, .theme-viewer-images img"));
    var images = nodes.map(imageUrlOf).filter(function(src){
      return /^https?:\\/\\//i.test(src) && !/apihost\\.store\\/thema\\//i.test(src);
    });
    if (images.length > 0) {
      respond({ ok: true, images: images });
      return true;
    }
    var error = document.querySelector(".theme-viewer-images .is-error, .theme-viewer-error, [data-theme-unlock-status]");
    if (error) lastError = (error.textContent || "").trim();
    return false;
  }
  if (collect()) return;
  var attempts = 0;
  var timer = window.setInterval(function(){
    attempts += 1;
    if (collect()) {
      window.clearInterval(timer);
      return;
    }
    if (attempts >= 25) {
      window.clearInterval(timer);
      respond({ ok: false, error: lastError || "timeout waiting for rendered reader images" });
    }
  }, 1000);
})();`;
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

function base64UrlToBytes(value) {
  const text = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = text + "=".repeat((4 - (text.length % 4)) % 4);
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(padded, "base64"));
  if (typeof atob === "function") {
    const raw = atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < padded.length; i += 1) {
    const char = padded.charAt(i);
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

function utf8DecodeBytes(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) text += `%${bytes[i].toString(16).padStart(2, "0")}`;
  return decodeURIComponent(text);
}

async function sha256Base64Url(text) {
  const encoder = createTextEncoder();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(text || "")));
    return base64UrlFromBytes(new Uint8Array(digest));
  }
  return base64UrlFromBytes(sha256Bytes(Array.from(encoder.encode(String(text || "")))));
}

const AES_SBOX = [
  99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,
  183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,
  44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,
  67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,
  68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,
  211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,
  221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,
  30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22
];

const AES_RCON = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77];

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
  const nk = key.length / 4;
  const nr = nk + 6;
  const words = [];
  for (let i = 0; i < nk; i += 1) words[i] = [key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]];
  for (let i = nk; i < 4 * (nr + 1); i += 1) {
    let temp = words[i - 1].slice();
    if (i % nk === 0) {
      temp = aesSubWord(aesRotWord(temp));
      temp[0] ^= AES_RCON[i / nk];
    } else if (nk > 6 && i % nk === 4) {
      temp = aesSubWord(temp);
    }
    words[i] = words[i - nk].map((byte, idx) => byte ^ temp[idx]);
  }
  return { words, nr };
}

function aesAddRoundKey(state, words, round) {
  for (let col = 0; col < 4; col += 1) {
    const word = words[round * 4 + col];
    for (let row = 0; row < 4; row += 1) state[col * 4 + row] ^= word[row];
  }
}

function aesSubBytes(state) {
  for (let i = 0; i < 16; i += 1) state[i] = AES_SBOX[state[i]];
}

function aesShiftRows(state) {
  const copy = state.slice();
  for (let row = 1; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) state[col * 4 + row] = copy[((col + row) % 4) * 4 + row];
  }
}

function aesMixColumns(state) {
  for (let col = 0; col < 4; col += 1) {
    const offset = col * 4;
    const a0 = state[offset], a1 = state[offset + 1], a2 = state[offset + 2], a3 = state[offset + 3];
    const t = a0 ^ a1 ^ a2 ^ a3;
    state[offset] ^= t ^ aesXtime(a0 ^ a1);
    state[offset + 1] ^= t ^ aesXtime(a1 ^ a2);
    state[offset + 2] ^= t ^ aesXtime(a2 ^ a3);
    state[offset + 3] ^= t ^ aesXtime(a3 ^ a0);
  }
}

function aesEncryptBlock(block, expanded) {
  const state = Array.from(block);
  aesAddRoundKey(state, expanded.words, 0);
  for (let round = 1; round < expanded.nr; round += 1) {
    aesSubBytes(state);
    aesShiftRows(state);
    aesMixColumns(state);
    aesAddRoundKey(state, expanded.words, round);
  }
  aesSubBytes(state);
  aesShiftRows(state);
  aesAddRoundKey(state, expanded.words, expanded.nr);
  return new Uint8Array(state);
}

function incrementCounter(counter) {
  for (let i = 15; i >= 12; i -= 1) {
    counter[i] = (counter[i] + 1) & 255;
    if (counter[i] !== 0) break;
  }
}

function aesGcmCtrDecryptNoAuth(keyBytes, iv, encryptedWithTag) {
  const ciphertext = encryptedWithTag.slice(0, Math.max(0, encryptedWithTag.length - 16));
  const expanded = aesExpandKey(Array.from(keyBytes));
  const counter = new Uint8Array(16);
  counter.set(iv, 0);
  counter[15] = 1;
  const plain = new Uint8Array(ciphertext.length);
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    incrementCounter(counter);
    const stream = aesEncryptBlock(counter, expanded);
    const size = Math.min(16, ciphertext.length - offset);
    for (let i = 0; i < size; i += 1) plain[offset + i] = ciphertext[offset + i] ^ stream[i];
  }
  return plain;
}

function browserSignatureMessage(input) {
  return [
    "ntk-brsig-v1",
    String(input.method || "POST").toUpperCase(),
    input.path,
    input.scope,
    input.keyId,
    input.timestamp,
    input.nonce,
    input.bodyHash
  ].join("\n");
}

const P256_P = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
const P256_A = P256_P - BigInt(3);
const P256_N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const P256_G = {
  x: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
  y: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
};

function p256Mod(value, modulo) {
  const result = value % modulo;
  return result < BigInt(0) ? result + modulo : result;
}

function p256Inverse(value, modulo) {
  let low = p256Mod(value, modulo);
  let high = modulo;
  let lowCoeff = BigInt(1);
  let highCoeff = BigInt(0);
  while (low > BigInt(1)) {
    const quotient = high / low;
    const next = high - low * quotient;
    high = low;
    low = next;
    const nextCoeff = highCoeff - lowCoeff * quotient;
    highCoeff = lowCoeff;
    lowCoeff = nextCoeff;
  }
  return p256Mod(lowCoeff, modulo);
}

function p256Double(point) {
  if (!point || point.y === BigInt(0)) return null;
  const slope = p256Mod(
    (BigInt(3) * point.x * point.x + P256_A) * p256Inverse(BigInt(2) * point.y, P256_P),
    P256_P
  );
  const x = p256Mod(slope * slope - BigInt(2) * point.x, P256_P);
  return { x, y: p256Mod(slope * (point.x - x) - point.y, P256_P) };
}

function p256Add(first, second) {
  if (!first) return second;
  if (!second) return first;
  if (first.x === second.x) {
    if (p256Mod(first.y + second.y, P256_P) === BigInt(0)) return null;
    return p256Double(first);
  }
  const slope = p256Mod((second.y - first.y) * p256Inverse(second.x - first.x, P256_P), P256_P);
  const x = p256Mod(slope * slope - first.x - second.x, P256_P);
  return { x, y: p256Mod(slope * (first.x - x) - first.y, P256_P) };
}

function p256Multiply(scalar, point = P256_G) {
  let value = scalar;
  let addend = point;
  let result = null;
  while (value > BigInt(0)) {
    if ((value & BigInt(1)) === BigInt(1)) result = p256Add(result, addend);
    addend = p256Double(addend);
    value >>= BigInt(1);
  }
  return result;
}

function p256BytesToInt(bytes) {
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i += 1) value = (value << BigInt(8)) + BigInt(bytes[i]);
  return value;
}

function p256IntToBytes(value, byteLength = 32) {
  const output = new Uint8Array(byteLength);
  let remaining = value;
  for (let i = byteLength - 1; i >= 0; i -= 1) {
    output[i] = Number(remaining & BigInt(255));
    remaining >>= BigInt(8);
  }
  return output;
}

function createP256BrowserKeyPair(entropy) {
  if (typeof BigInt !== "function") throw new Error("BigInt is required for browser key fallback");
  const seed = createTextEncoder().encode(String(entropy || `${randomBase64Url(32)}:${Date.now()}:${Math.random()}`));
  const privateKey = (p256BytesToInt(sha256Bytes(Array.from(seed))) % (P256_N - BigInt(1))) + BigInt(1);
  const publicPoint = p256Multiply(privateKey);
  const privateBytes = p256IntToBytes(privateKey);
  return {
    publicJwk: {
      kty: "EC",
      crv: "P-256",
      x: base64UrlFromBytes(p256IntToBytes(publicPoint.x)),
      y: base64UrlFromBytes(p256IntToBytes(publicPoint.y)),
      ext: true,
      key_ops: ["verify"]
    },
    sign(message) {
      const messageBytes = Array.from(createTextEncoder().encode(String(message)));
      const hash = p256BytesToInt(sha256Bytes(messageBytes));
      for (let attempt = 1; attempt < 256; attempt += 1) {
        const nonceMaterial = Array.from(privateBytes).concat(messageBytes, [attempt]);
        const nonce = (p256BytesToInt(sha256Bytes(nonceMaterial)) % (P256_N - BigInt(1))) + BigInt(1);
        const point = p256Multiply(nonce);
        const r = p256Mod(point.x, P256_N);
        if (r === BigInt(0)) continue;
        const s = p256Mod(p256Inverse(nonce, P256_N) * (hash + r * privateKey), P256_N);
        if (s === BigInt(0)) continue;
        const output = new Uint8Array(64);
        output.set(p256IntToBytes(r), 0);
        output.set(p256IntToBytes(s), 32);
        return output;
      }
      throw new Error("Unable to produce P-256 signature");
    }
  };
}

async function createBrowserSignedHeaders(client, baseUrl, method, path, scope, bodyText, headers) {
  if (!/^\/manhwa\/[^/?#]+\/[^/?#]+$/.test(String(scope || ""))) return {};
  const supportsWebCrypto = typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.generateKey === "function";
  const purePair = supportsWebCrypto ? null : createP256BrowserKeyPair();
  const pair = supportsWebCrypto
    ? await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])
    : null;
  const publicKey = supportsWebCrypto ? await crypto.subtle.exportKey("jwk", pair.publicKey) : purePair.publicJwk;
  const registerRes = await client.post(
    joinUrl(baseUrl, "/api/client-key/register"),
    { ...headers, "content-type": "application/json" },
    { publicKey }
  );
  const registered = JSON.parse(registerRes.body || "{}");
  if (!registered.ok || !registered.keyId) {
    throw new Error(`browser key registration failed; ${responseSummary(registerRes)}`);
  }
  const clientNow = Date.now();
  const serverNow = typeof registered.serverNow === "number" ? registered.serverNow : clientNow;
  const timestamp = String(Math.floor(Date.now() + (serverNow - clientNow)));
  const nonce = randomBase64Url(24);
  const bodyHash = await sha256Base64Url(bodyText);
  const message = browserSignatureMessage({
    method,
    path,
    scope,
    keyId: registered.keyId,
    timestamp,
    nonce,
    bodyHash
  });
  const signature = supportsWebCrypto
    ? await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, createTextEncoder().encode(message))
    : purePair.sign(message);
  return {
    "x-ntk-key-id": registered.keyId,
    "x-ntk-ts": timestamp,
    "x-ntk-nonce": nonce,
    "x-ntk-sig": base64UrlFromBytes(new Uint8Array(signature))
  };
}

async function decryptNovelPayload(payload, nvSession, novelId, episodeId) {
  const data = base64UrlToBytes(payload);
  if (data.length < 28) throw new Error("Novel payload is too short");
  const iv = data.slice(0, 12);
  const body = data.slice(12);
  const nvKey = base64UrlToBytes(String(nvSession || "").split(".")[0] || "");
  const tail = createTextEncoder().encode(`:${novelId}:${episodeId}:v3`);
  const input = new Uint8Array(nvKey.length + tail.length);
  input.set(nvKey, 0);
  input.set(tail, nvKey.length);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", input);
    const key = await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, body);
    return utf8DecodeBytes(new Uint8Array(plain));
  }
  const hash = sha256Bytes(Array.from(input));
  return utf8DecodeBytes(aesGcmCtrDecryptNoAuth(new Uint8Array(hash), iv, body));
}

function unshuffleParagraphs(shuffled, perm) {
  if (!Array.isArray(shuffled) || !Array.isArray(perm) || shuffled.length !== perm.length) return shuffled || [];
  const restored = new Array(shuffled.length);
  const seen = new Array(shuffled.length).fill(false);
  for (let i = 0; i < shuffled.length; i += 1) {
    const originalIndex = perm[i];
    if (!Number.isInteger(originalIndex) || originalIndex < 0 || originalIndex >= shuffled.length || seen[originalIndex]) return shuffled;
    seen[originalIndex] = true;
    restored[originalIndex] = shuffled[i];
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

function renderNovelContentHtml(decoded) {
  let payload = null;
  if (decoded && decoded.charAt(0) === "{") {
    try { payload = JSON.parse(decoded); } catch (e) { payload = null; }
  }
  if (payload && payload.kind === "html" && typeof payload.html === "string") {
    return payload.html
      .split(/(<[^>]+>)/g)
      .map((part) => {
        if (part.startsWith("<")) return part;
        if (!part.trim()) return "";
        return part.replace(/\r\n?|\n/g, "<br>");
      })
      .join("");
  }
  let paragraphs = [];
  if (payload && payload.kind === "text-shuffled") paragraphs = unshuffleParagraphs(payload.paragraphs, payload.perm);
  else if (payload && payload.kind === "text" && Array.isArray(payload.paragraphs)) paragraphs = payload.paragraphs;
  else paragraphs = String(decoded || "").split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => String(paragraph || "").trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r\n?|\n/g, "<br>")}</p>`)
    .join("\n");
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
  const baseUrl = trimSlash(options.baseUrl || "https://toki30.com");

  return {
    variantName,
    variant,
    baseUrl,
    buildApiUrl(path, params) {
      return appendQuery(joinUrl(baseUrl, path), params || {});
    },
    __buildHtmlListUrl(page, filters, defaults = {}) {
      const category = filterValue(filters, "category", "\uC77C\uBC18\uC6F9\uD230");
      const toon = category === "\uC77C\uBC18\uC6F9\uD230" ? "" : category;
      const pub = category === "\uC644\uACB0\uC6F9\uD230"
        ? "completed"
        : (defaults.pub || defaults.status || "ongoing");
      return canonicalQueryUrl(joinUrl(baseUrl, variant.listPage), {
        kind: variant.kind,
        toon,
        stx: String(defaults.query || "").trim(),
        [variant.authorField]: filterTextValue(filters, variant.authorField),
        yoil: filterValue(filters, "weekday", ""),
        plat: filterValue(filters, "platform", ""),
        pub,
        tag: filterValue(filters, "genre", ""),
        sst: filterValue(filters, "sort", defaults.sort || "as_update"),
        sod: "desc",
        page
      });
    },
    __buildListUrl(page, filters, defaults = {}) {
      if (variantName === "webtoon") {
        return this.__buildHtmlListUrl(page, filters, defaults);
      }
      return this.buildApiUrl(variant.listEndpoint, {
        status: filterValue(filters, "status", defaults.status || "ongoing"),
        sort: filterValue(filters, "sort", defaults.sort || "views"),
        page,
        pageSize: 49,
        withTotal: 1
      });
    },
    __buildPopularUrl(page, filters) {
      return this.__buildListUrl(page, filters, {
        status: "ongoing",
        sort: variantName === "webtoon" ? "as_view" : "views"
      });
    },
    __buildLatestUrl(page, filters) {
      if (variantName === "webtoon") {
        return this.__buildHtmlListUrl(page, filters, { status: "ongoing", sort: "as_update" });
      }
      if (variant.latestEndpoint.startsWith("/api/")) {
        return this.buildApiUrl(variant.latestEndpoint, {
          status: filterValue(filters, "status", "ongoing"),
          sort: filterValue(filters, "sort", "latest"),
          page,
          pageSize: 49,
          withTotal: 1
        });
      }
      return this.buildApiUrl(variant.latestEndpoint, { page });
    },
    __buildSearchUrl(query, page, filters) {
      if (variantName === "webtoon") {
        return this.__buildHtmlListUrl(page, filters, {
          query,
          pub: "all",
          sort: "as_update"
        });
      }
      return this.buildApiUrl(variant.listPage, {
        kind: variant.kind,
        toon: filterValue(filters, "category", ""),
        stx: String(query || "").trim(),
        [variant.authorField]: filterTextValue(filters, variant.authorField),
        yoil: filterValue(filters, "weekday", ""),
        plat: filterValue(filters, "platform", ""),
        pub: filterValue(filters, "status", "ongoing"),
        tag: filterValue(filters, "genre", ""),
        sst: filterValue(filters, "sort", "as_update"),
        sod: "desc",
        page
      });
    },
    __buildImageCandidates(chapterUrl) {
      const normalizedUrl = normalizeSourceUrl(chapterUrl, variantName);
      const path = normalizedUrl.startsWith("http") ? pathFromUrl(normalizedUrl) : normalizedUrl;
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
    if (params.source) {
      if (params.source === "manga") return "manga";
      if (params.source === "novel") return "novel";
      return "webtoon";
    }
    if (this.source && /novel/i.test(this.source.name)) return "novel";
    return (this.source && /manga/i.test(this.source.name)) ? "manga" : "webtoon";
  }

  getBaseUrl() {
    const fallback = trimSlash((this.source && this.source.baseUrl) || "https://toki30.com");
    if (typeof SharedPreferences === "undefined") return fallback;
    const prefs = new SharedPreferences();
    const configured = trimSlash(prefs.get("ntkBaseUrl") || "");
    if (!configured || configured === "https://newtoki1.org") {
      if (configured && typeof prefs.setString === "function") {
        prefs.setString("ntkBaseUrl", fallback);
      }
      return fallback;
    }
    return configured;
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

  async getPopular(page, filters) {
    const source = this.getSource();
    const url = source.__buildPopularUrl(page, filters);
    const res = await this.client.get(url, this.getHeaders());
    return url.includes("/api/")
      ? parseWorksResponse(res.body, source.baseUrl, source.variantName)
      : this.parseMangaCards(res.body, source.baseUrl);
  }

  async getLatestUpdates(page, filters) {
    const source = this.getSource();
    const url = source.__buildLatestUrl(page, filters);
    const res = await this.client.get(url, this.getHeaders());
    if (url.includes("/api/")) {
      return parseWorksResponse(res.body, source.baseUrl, source.variantName);
    }
    return this.parseMangaCards(res.body, source.baseUrl);
  }

  async search(query, page, filters) {
    const source = this.getSource();
    const res = await this.client.get(source.__buildSearchUrl(query, page, filters), this.getHeaders());
    if ((res.body || "").trim().startsWith("{") || (res.body || "").trim().startsWith("[")) {
      return parseWorksResponse(res.body, source.baseUrl, source.variantName);
    }
    return this.parseMangaCards(res.body, source.baseUrl);
  }

  parseMangaCards(body, baseUrl) {
    const list = [];
    const seen = new Set();
    const html = String(body || "");
    const listItemPattern = /<li\b([^>]*\bdate-title=["'][^"']+["'][^>]*)>([\s\S]*?)<\/li>/gi;
    let itemMatch;
    while ((itemMatch = listItemPattern.exec(html)) !== null) {
      const itemTag = itemMatch[1];
      const item = itemMatch[2];
      const name = attrValue(itemTag, "date-title") || stripTags(firstMatch(item, /<span[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
      const linkTag = firstMatch(item, /(<a[^>]*href=["'][^"']+["'][^>]*>)/i);
      const href = attrValue(linkTag, "href");
      const imgTag = firstMatch(item, /(<img[^>]*>)/i);
      const imageUrl = absoluteUrl(baseUrl, attrValue(imgTag, "src") || attrValue(imgTag, "data-src"));
      if (name && href && !seen.has(href)) {
        seen.add(href);
        list.push({ name, imageUrl, url: href, link: href });
      }
    }

    const pattern = /(<a[^>]*class=["'][^"']*card[^"']*["'][^>]*>)([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const cardTag = match[1];
      const card = match[2];
      const href = attrValue(cardTag, "href");
      const name = stripTags(firstMatch(card, /<p[^>]*class=["'][^"']*subject[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
      const imgTag = firstMatch(card, /(<img[^>]*>)/i);
      const imageUrl = absoluteUrl(baseUrl, attrValue(imgTag, "src") || attrValue(imgTag, "data-src"));
      if (name && href && !seen.has(href)) {
        seen.add(href);
        list.push({ name, imageUrl, url: href, link: href });
      }
    }
    const hasNextPage = /<a[^>]*href=["'][^"']*[?&](?:amp;)?page=\d+[^"']*["'][^>]*>[\s\S]*?<i[^>]*class=["'][^"']*\bfa-angle-right\b[^"']*["']/i.test(html);
    return { list, hasNextPage };
  }

  async getDetail(url) {
    const source = this.getSource();
    const detailUrl = joinUrl(source.baseUrl, normalizeSourceUrl(url, source.variantName));
    const res = await this.client.get(detailUrl, this.getHeaders());
    if (isMaintenanceHtml(res.body)) {
      throw new Error("NTK manga section is under maintenance; please retry later");
    }
    const details = parseDetailsHtml(res.body, source.baseUrl);
    const chapters = parseChaptersHtml(res.body, source.baseUrl);
    return {
      link: normalizeSourceUrl(url, source.variantName),
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
    const readerUrl = joinUrl(source.baseUrl, normalizeSourceUrl(url, source.variantName));
    const readerPath = pathFromUrl(readerUrl);
    const browserHeaders = browserFetchHeaders(headers, readerUrl);
    let cookieHeader = createInitialNtkCookie(headers);
    let blockingError = null;

    try {
      const appCookieReaderRes = await this.client.get(readerUrl, headersWithoutCookie(headers));
      const appCookieBody = appCookieReaderRes.body || "";
      const appCookieBootstrap = parseReaderBootstrap(appCookieBody);
      if (appCookieBootstrap.imagesToken || appCookieBootstrap.viewerUrl) {
        try {
          const sessionRes = await this.client.post(
            joinUrl(source.baseUrl, "/api/nv-issue"),
            browserHeaders,
            {}
          );
          const sessionData = JSON.parse(sessionRes.body || "{}");
          const session = sessionData.session;
          if (!session) throw new Error(`missing session; ${responseSummary(sessionRes)}`);
          const nonce = randomBase64Url(24);
          const proof = await hmacSha256Base64Url(session, `${appCookieBootstrap.imagesToken}.${nonce}`);
          const endpoint = source.variant.imageEndpoint;
          const imageBody = {
            workId: appCookieBootstrap.sourceWorkId,
            episodeId: appCookieBootstrap.episodeId,
            token: appCookieBootstrap.imagesToken,
            nonce,
            proof
          };
          const signedHeaders = await createBrowserSignedHeaders(
            this.client,
            source.baseUrl,
            "POST",
            endpoint,
            readerPath,
            JSON.stringify(imageBody),
            browserHeaders
          );
          const imageHeaders = {
            ...browserHeaders,
            "content-type": "application/json",
            "x-images-client": "viewer-v1",
            "x-nv-session": session,
            ...signedHeaders
          };
          const imageRes = await this.client.post(
            joinUrl(source.baseUrl, endpoint),
            imageHeaders,
            imageBody
          );
          try {
            return parsePageImagesResponse(imageRes.body).map((imageUrl) => ({ url: absoluteUrl(source.baseUrl, imageUrl), headers: imageHeaders }));
          } catch (parseError) {
            throw new Error(`${parseError.message}; app-cookie ${responseSummary(imageRes)}; bootstrap=${JSON.stringify(appCookieBootstrap)}`);
          }
        } catch (appCookieError) {
          if (/app-cookie/.test(String(appCookieError && appCookieError.message))) blockingError = appCookieError;
        }
      }

      const readerRes = await this.client.get(readerUrl, headersWithCookie(headers, cookieHeader));
      cookieHeader = mergeSetCookie(cookieHeader, responseHeader(readerRes, "set-cookie"));
      const body = readerRes.body || "";
      if (body.trim().startsWith("{") || body.trim().startsWith("[")) {
        return parsePageImagesResponse(body).map((imageUrl) => ({ url: absoluteUrl(source.baseUrl, imageUrl), headers }));
      }
      const bootstrap = parseReaderBootstrap(body);
      if (bootstrap.imagesToken || bootstrap.viewerUrl) {
        try {
          const canaryRes = await this.client.post(
            joinUrl(source.baseUrl, "/api/ad/canary"),
            {
              ...headersWithCookie(browserHeaders, cookieHeader),
              "content-type": "application/json"
            },
            { adGuardLoaded: true }
          );
          cookieHeader = mergeSetCookie(cookieHeader, responseHeader(canaryRes, "set-cookie"));
          const challengeRes = await this.client.post(
            joinUrl(source.baseUrl, "/api/ad/challenge"),
            {
              ...headersWithCookie(browserHeaders, cookieHeader),
              "content-type": "application/json"
            },
            { path: readerPath, force: false }
          );
          cookieHeader = mergeSetCookie(cookieHeader, responseHeader(challengeRes, "set-cookie"));
          const challengeData = JSON.parse(challengeRes.body || "{}");
          if (challengeData.challenge && challengeData.challenge.observationBatchUrl) {
            const challenge = challengeData.challenge;
            const urls = Array.isArray(challenge.impressionUrls)
              ? challenge.impressionUrls.slice(0, Math.max(1, Number(challenge.minSeen || 1)))
              : [];
            const observationRes = await this.client.post(
              absoluteUrl(source.baseUrl, challenge.observationBatchUrl),
              {
                ...headersWithCookie(browserHeaders, cookieHeader),
                "content-type": "application/json"
              },
              { challengeToken: challenge.token, path: readerPath, urls }
            );
            cookieHeader = mergeSetCookie(cookieHeader, responseHeader(observationRes, "set-cookie"));
          }
          const sessionRes = await this.client.post(
            joinUrl(source.baseUrl, "/api/nv-issue"),
            headersWithCookie(browserHeaders, cookieHeader),
            {}
          );
          cookieHeader = mergeSetCookie(cookieHeader, responseHeader(sessionRes, "set-cookie"));
          const sessionData = JSON.parse(sessionRes.body || "{}");
          const session = sessionData.session;
          if (!session) throw new Error("missing session");
          cookieHeader = mergeSetCookie(cookieHeader, `nv=${session}`);
          const nonce = randomBase64Url(24);
          const proof = await hmacSha256Base64Url(session, `${bootstrap.imagesToken}.${nonce}`);
          const endpoint = source.variant.imageEndpoint;
          const imageBody = {
            workId: bootstrap.sourceWorkId,
            episodeId: bootstrap.episodeId,
            token: bootstrap.imagesToken,
            nonce,
            proof
          };
          const signedHeaders = await createBrowserSignedHeaders(
            this.client,
            source.baseUrl,
            "POST",
            endpoint,
            readerPath,
            JSON.stringify(imageBody),
            headersWithCookie(browserHeaders, cookieHeader)
          );
          const imageRes = await this.client.post(
            joinUrl(source.baseUrl, endpoint),
            {
              ...headersWithCookie(browserHeaders, cookieHeader),
              "content-type": "application/json",
              "x-images-client": "viewer-v1",
              "x-nv-session": session,
              ...signedHeaders
            },
            imageBody
          );
          try {
            return parsePageImagesResponse(imageRes.body).map((imageUrl) => ({ url: absoluteUrl(source.baseUrl, imageUrl), headers: headersWithCookie(browserHeaders, cookieHeader) }));
          } catch (parseError) {
            throw new Error(`${parseError.message}; ${responseSummary(imageRes)}; cookies=${cookieNames(cookieHeader)}; bootstrap=${JSON.stringify(bootstrap)}`);
          }
        } catch (proofError) {
          blockingError = new Error(`NTK image API requires browser fingerprint/session proof: ${proofError.message}`);
        }
      }
    } catch (error) {
      if (/session proof|Ad acknowledgment|app-cookie/.test(String(error && error.message))) blockingError = error;
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
    if (typeof evaluateJavascriptViaWebview === "function") {
      try {
        const webviewResult = await evaluateJavascriptViaWebview(`${source.baseUrl}/`, headersWithoutCookie(headers), [createWebviewImageExtractorScript(readerUrl)]);
        return parseWebviewImageResponse(webviewResult).map((imageUrl) => ({ url: absoluteUrl(source.baseUrl, imageUrl), headers }));
      } catch (error) {
        lastError = new Error(`WebView fallback failed: ${error.message || error}`);
      }
    }
    if (lastError && /WebView fallback failed/.test(String(lastError.message || lastError))) throw lastError;
    if (blockingError) throw blockingError;
    if (lastError) throw lastError;
    throw new Error("Failed to load images, please retry");
  }

  async getHtmlContent(name, url) {
    const source = this.getSource();
    const headers = this.getHeaders();
    const readerUrl = joinUrl(source.baseUrl, normalizeSourceUrl(url, source.variantName));
    const readerPath = pathFromUrl(readerUrl);
    const browserHeaders = browserFetchHeaders(headers, readerUrl);
    let cookieHeader = createInitialNtkCookie(headers);

    const readerRes = await this.client.get(readerUrl, headersWithCookie(headers, cookieHeader));
    cookieHeader = mergeSetCookie(cookieHeader, responseHeader(readerRes, "set-cookie"));
    const rawViewerData = firstMatch(readerRes.body, /<script[^>]*id=["']theme-novel-viewer-data["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!rawViewerData) throw new Error("NTK novel viewer data not found");
    const viewerData = JSON.parse(htmlDecode(rawViewerData));

    const canaryRes = await this.client.post(
      joinUrl(source.baseUrl, "/api/ad/canary"),
      { ...headersWithCookie(browserHeaders, cookieHeader), "content-type": "application/json" },
      { adGuardLoaded: true }
    );
    cookieHeader = mergeSetCookie(cookieHeader, responseHeader(canaryRes, "set-cookie"));

    const runChallenge = async (force) => {
      const challengeRes = await this.client.post(
        joinUrl(source.baseUrl, "/api/ad/challenge"),
        { ...headersWithCookie(browserHeaders, cookieHeader), "content-type": "application/json" },
        { path: readerPath, force: !!force }
      );
      cookieHeader = mergeSetCookie(cookieHeader, responseHeader(challengeRes, "set-cookie"));
      const challengeData = JSON.parse(challengeRes.body || "{}");
      if (challengeData.challenge && challengeData.challenge.observationBatchUrl) {
        const challenge = challengeData.challenge;
        const urls = Array.isArray(challenge.impressionUrls)
          ? challenge.impressionUrls.slice(0, Math.max(1, Number(challenge.minSeen || 1)))
          : [];
        const observationRes = await this.client.post(
          absoluteUrl(source.baseUrl, challenge.observationBatchUrl),
          { ...headersWithCookie(browserHeaders, cookieHeader), "content-type": "application/json" },
          { challengeToken: challenge.token, path: readerPath, urls }
        );
        cookieHeader = mergeSetCookie(cookieHeader, responseHeader(observationRes, "set-cookie"));
      }
    };
    await runChallenge(false);

    const sessionRes = await this.client.post(
      joinUrl(source.baseUrl, "/api/nv-issue"),
      headersWithCookie(browserHeaders, cookieHeader),
      {}
    );
    cookieHeader = mergeSetCookie(cookieHeader, responseHeader(sessionRes, "set-cookie"));
    const sessionData = JSON.parse(sessionRes.body || "{}");
    const session = sessionData.session;
    if (!session) throw new Error(`missing novel session; ${responseSummary(sessionRes)}`);

    const requestContent = async () => {
      const nonce = randomBase64Url(24);
      const proof = await hmacSha256Base64Url(session, `${viewerData.token}.${nonce}`);
      return this.client.post(
        joinUrl(source.baseUrl, "/api/novel-content"),
        {
          ...headersWithCookie(browserHeaders, cookieHeader),
          "content-type": "application/json",
          "x-novel-client": "shadow-v3",
          "x-nv-session": session
        },
        {
          novelId: viewerData.novelId,
          episodeId: viewerData.episodeId,
          token: viewerData.token,
          nonce,
          proof
        }
      );
    };

    let contentRes = await requestContent();
    let contentData = JSON.parse(contentRes.body || "{}");
    if (contentRes.statusCode === 403 && (contentData.error === "ad_ack_required" || contentData.error === "fingerprint_required")) {
      await runChallenge(true);
      contentRes = await requestContent();
      contentData = JSON.parse(contentRes.body || "{}");
    }
    if (!contentData.ok || !contentData.payload) {
      throw new Error(`NTK novel content failed; ${responseSummary(contentRes)}`);
    }
    const decoded = await decryptNovelPayload(contentData.payload, session, viewerData.novelId, viewerData.episodeId);
    return renderNovelContentHtml(decoded);
  }

  async cleanHtmlContent(html) {
    return html;
  }

  getFilterList() {
    return buildFilterList(this.getVariantName());
  }

  getSourcePreferences() {
    return [
      {
        key: "ntkBaseUrl",
        editTextPreference: {
          title: "Override BaseUrl",
          summary: "Current NTK domain, for example https://toki30.com",
          value: "https://toki30.com",
          dialogTitle: "Override BaseUrl",
          dialogMessage: "Change this when the Newtoki domain changes."
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
      normalizeSourceUrl,
      parsePageImagesResponse,
      isMaintenanceHtml,
      parseWebviewImageResponse,
      createWebviewImageExtractorScript,
      browserFetchHeaders,
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
