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
    version: "0.301",
    isManga: false,
    itemType: 2,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes:
      "Legacy Popular and Latest are implemented. Search, filters, detail, chapters, and reader are not implemented.",
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

// region NOVEL_LIST_METHODS
const NOVEL_LIST_METHODS = {
  supportsLatest() {
    return true;
  },

  async getPopular() {
    return { list: [], hasNextPage: false };
  },

  async getLatestUpdates() {
    return { list: [], hasNextPage: false };
  },
};
// endregion NOVEL_LIST_METHODS

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
  appendQuery,
  joinUrl,
  normalizeNovelWorkLink,
  trimSlash,
};
