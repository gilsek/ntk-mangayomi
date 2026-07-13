const mangayomiSources = [
  {
    name: "NTK Manhwa",
    id: 260713002,
    baseUrl: "https://sbxh9.com",
    lang: "ko",
    typeSource: "single",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=128&domain=https://sbxh9.com",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/manga/src/ko/ntk_manhwa.js",
    apiUrl: "",
    version: "0.201",
    isManga: true,
    itemType: 0,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes:
      "Internal Next Manhwa scaffold; lists, search, filters, detail, episodes, and reader are not implemented.",
    pkgPath: "manga/src/ko/ntk_manhwa.js",
  },
];

const NEXT_DEFAULT_DOMAIN_NUMBER = "9";
const NEXT_DOMAIN_NUMBER_PREFERENCE = "ntk_manhwa_next_domain_number";
const TABLET_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function normalizeManhwaLink(value, expectedSegmentCount, errorMessage, baseUrl) {
  const invalidLink = () => {
    throw new Error(errorMessage);
  };
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.includes("?") || candidate.includes("#")) {
    invalidLink();
  }

  let path = candidate;
  const absolute = candidate.match(
    /^(https):\/\/([^/?#]+)(\/[^?#]*)$/i,
  );
  if (absolute) {
    const origin = `${absolute[1].toLowerCase()}://${absolute[2].toLowerCase()}`;
    if (origin !== baseUrl.toLowerCase()) invalidLink();
    path = absolute[3];
  } else if (
    /^[a-z][a-z0-9+.-]*:/i.test(candidate) ||
    candidate.startsWith("//") ||
    !candidate.startsWith("/")
  ) {
    invalidLink();
  }

  const segments = path.split("/");
  if (
    segments.length !== expectedSegmentCount + 2 ||
    segments[0] !== "" ||
    segments[1] !== "manhwa"
  ) {
    invalidLink();
  }
  for (const segment of segments.slice(2)) {
    if (!segment || segment.trim() !== segment || segment === "." || segment === "..") {
      invalidLink();
    }
  }
  return path;
}

// region MANHWA_LIST_METHODS
const MANHWA_LIST_METHODS = {
  supportsLatest() {
    return true;
  },

  async getPopular() {
    throw new Error("NTK Manhwa list feature is not implemented");
  },

  async getLatestUpdates() {
    throw new Error("NTK Manhwa list feature is not implemented");
  },
};
// endregion MANHWA_LIST_METHODS

// region MANHWA_SEARCH_FILTER_METHODS
const MANHWA_SEARCH_FILTER_METHODS = {
  async search() {
    throw new Error("NTK Manhwa search feature is not implemented");
  },

  getFilterList() {
    throw new Error("NTK Manhwa filter feature is not implemented");
  },
};
// endregion MANHWA_SEARCH_FILTER_METHODS

// region MANHWA_DETAIL_EPISODE_METHODS
const MANHWA_DETAIL_EPISODE_METHODS = {
  async getDetail() {
    throw new Error("NTK Manhwa detail and episode feature is not implemented");
  },
};
// endregion MANHWA_DETAIL_EPISODE_METHODS

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get supportsLatest() {
    return MANHWA_LIST_METHODS.supportsLatest.call(this);
  }

  getNextDomainNumber() {
    const configured = new SharedPreferences().get(
      NEXT_DOMAIN_NUMBER_PREFERENCE,
    );
    const value = String(configured ?? "").trim() || NEXT_DEFAULT_DOMAIN_NUMBER;
    if (!/^\d+$/.test(value)) {
      throw new Error("Invalid Next domain number preference");
    }
    return value;
  }

  getNextBaseUrl() {
    return `https://sbxh${this.getNextDomainNumber()}.com`;
  }

  getHeaders() {
    return {
      Referer: `${this.getNextBaseUrl()}/`,
      "User-Agent": TABLET_USER_AGENT,
    };
  }

  toAbsoluteUrl(value) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("//")) return `https:${value}`;
    if (value.startsWith("/")) return `${this.getNextBaseUrl()}${value}`;
    return `${this.getNextBaseUrl()}/${value}`;
  }

  normalizeWorkLink(value) {
    return normalizeManhwaLink(
      value,
      1,
      "NTK Manhwa invalid work link",
      this.getNextBaseUrl(),
    );
  }

  normalizeChapterLink(value) {
    return normalizeManhwaLink(
      value,
      2,
      "NTK Manhwa invalid chapter link",
      this.getNextBaseUrl(),
    );
  }

  async getPopular(page) {
    return MANHWA_LIST_METHODS.getPopular.call(this, page);
  }

  async getLatestUpdates(page) {
    return MANHWA_LIST_METHODS.getLatestUpdates.call(this, page);
  }

  async search(query, page, filters) {
    return MANHWA_SEARCH_FILTER_METHODS.search.call(this, query, page, filters);
  }

  getFilterList() {
    return MANHWA_SEARCH_FILTER_METHODS.getFilterList.call(this);
  }

  async getDetail(url) {
    return MANHWA_DETAIL_EPISODE_METHODS.getDetail.call(this, url);
  }

  async getPageList() {
    throw new Error("NTK Manhwa reader is not implemented");
  }

  getSourcePreferences() {
    return [
      {
        key: NEXT_DOMAIN_NUMBER_PREFERENCE,
        editTextPreference: {
          title: "Next domain number",
          summary: "Enter only the number after sbxh.",
          value: NEXT_DEFAULT_DOMAIN_NUMBER,
          dialogTitle: "Next domain number",
          dialogMessage: "Example: 9 for https://sbxh9.com",
        },
      },
    ];
  }
}
