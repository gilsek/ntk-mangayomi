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
        throw new Error("NTK reader requires session proof in WebView before image API access. Open the chapter in a browser-capable view or update this port with Mangayomi WebView proof support.");
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
