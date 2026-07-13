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
  if (
    !candidate ||
    candidate.includes("?") ||
    candidate.includes("#") ||
    candidate.includes("\\") ||
    /%(?:2e|2f|5c)/i.test(candidate)
  ) {
    invalidLink();
  }

  const absolute = candidate.match(
    /^(https):\/\/([^/?#]+)(\/[^?#]*)$/i,
  );
  if (
    !absolute &&
    (/^[a-z][a-z0-9+.-]*:/i.test(candidate) ||
      candidate.startsWith("//") ||
      !candidate.startsWith("/"))
  ) {
    invalidLink();
  }

  const rawPath = absolute ? absolute[3] : candidate;
  let origin;
  let baseOrigin;
  let path;
  if (typeof URL === "function") {
    try {
      const parsed = new URL(candidate, baseUrl);
      const parsedBase = new URL(baseUrl);
      origin = parsed.origin.toLowerCase();
      baseOrigin = parsedBase.origin.toLowerCase();
      path = parsed.pathname;
    } catch (_) {
      invalidLink();
    }
  } else {
    const fallbackOrigin = (authority) => {
      const match = authority.match(/^([^:@]+)(?::(\d+))?$/);
      if (!match) invalidLink();
      const port = match[2];
      return `https://${match[1].toLowerCase()}${
        port && Number(port) !== 443 ? `:${port}` : ""
      }`;
    };
    origin = absolute ? fallbackOrigin(absolute[2]) : baseUrl.toLowerCase();
    baseOrigin = baseUrl.toLowerCase();
    path = rawPath;
  }
  if (origin !== baseOrigin || path !== rawPath) invalidLink();

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

  assertHtmlResponse(response, feature) {
    const statusCode = Number(response?.statusCode ?? response?.status ?? 0);
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`NTK Manhwa ${feature} HTTP failure`);
    }
    const contentType = MANHWA_LIST_METHODS.responseHeader(
      response,
      "content-type",
    ).toLowerCase();
    if (!contentType.includes("text/html")) {
      throw new Error(`NTK Manhwa ${feature} response is not HTML`);
    }
  },

  isUnrelatedWebtoonLink(value) {
    const candidate = String(value ?? "").trim().toLowerCase();
    return (
      candidate.startsWith("/webtoon/") ||
      candidate.startsWith(
        `${this.getNextBaseUrl().toLowerCase()}/webtoon/`,
      )
    );
  },

  coverUrl(card, selector) {
    const cover = card.selectFirst(selector);
    const value = cover ? String(cover.attr("src") ?? "").trim() : "";
    return value ? this.toAbsoluteUrl(value) : "";
  },

  async getPopular(page) {
    if (page > 1) return { list: [], hasNextPage: false };

    const response = await this.client.get(
      `${this.getNextBaseUrl()}/rank?period=week&kind=manhwa`,
      this.getHeaders(),
    );
    MANHWA_LIST_METHODS.assertHtmlResponse(response, "Popular");

    const document = new Document(response.body);
    const container = document.selectFirst("main.rank-v2-page");
    if (!container) {
      throw new Error("NTK Manhwa Popular structure is missing");
    }

    const rankedCards = [
      ...container.select("a.rank-v2-champion"),
      ...container.select("a.rank-v2-runner"),
      ...container.select("a.rank-v2-row"),
    ];
    const list = [];
    for (const card of rankedCards) {
      const rawLink = String(card.attr("href") ?? "").trim();
      if (MANHWA_LIST_METHODS.isUnrelatedWebtoonLink.call(this, rawLink)) {
        continue;
      }

      const classes = String(card.attr("class") ?? "").split(/\s+/);
      const titleElement = classes.includes("rank-v2-champion")
        ? card.selectFirst("h2")
        : classes.includes("rank-v2-runner")
          ? card.selectFirst(".rank-v2-runner-body > strong")
          : card.selectFirst(".rank-v2-row-title > strong");
      const name = titleElement ? String(titleElement.text ?? "").trim() : "";
      if (!name || !rawLink) {
        throw new Error("NTK Manhwa malformed Popular card");
      }

      let link;
      try {
        link = this.normalizeWorkLink(rawLink);
      } catch (_) {
        throw new Error("NTK Manhwa malformed Popular card");
      }
      list.push({
        name,
        link,
        imageUrl: MANHWA_LIST_METHODS.coverUrl.call(
          this,
          card,
          ".rank-v2-cover > img",
        ),
      });
    }
    if (list.length === 0) {
      throw new Error("NTK Manhwa Popular cards are missing");
    }
    return { list, hasNextPage: false };
  },

  async getLatestUpdates(page) {
    if (page > 1) return { list: [], hasNextPage: false };

    const response = await this.client.get(
      `${this.getNextBaseUrl()}/manhwa/updates`,
      this.getHeaders(),
    );
    MANHWA_LIST_METHODS.assertHtmlResponse(response, "Latest");

    const document = new Document(response.body);
    const container = document.selectFirst("main.container.manhwa-updates");
    if (!container) {
      throw new Error("NTK Manhwa Latest structure is missing");
    }
    if (container.selectFirst("div.board-empty > div.t")) {
      return { list: [], hasNextPage: false };
    }

    const grid = container.selectFirst("ul.upd-grid");
    if (!grid) {
      throw new Error("NTK Manhwa Latest structure is missing");
    }

    const list = [];
    for (const card of grid.select("li.upd-card")) {
      const linkElement = card.selectFirst("a.upd-allbtn");
      const rawLink = linkElement
        ? String(linkElement.attr("href") ?? "").trim()
        : "";
      if (MANHWA_LIST_METHODS.isUnrelatedWebtoonLink.call(this, rawLink)) {
        continue;
      }

      const titleElement = card.selectFirst(".upd-title");
      const name = titleElement ? String(titleElement.text ?? "").trim() : "";
      if (!name || !rawLink) {
        throw new Error("NTK Manhwa malformed Latest card");
      }

      let link;
      try {
        link = this.normalizeWorkLink(rawLink);
      } catch (_) {
        throw new Error("NTK Manhwa malformed Latest card");
      }
      list.push({
        name,
        link,
        imageUrl: MANHWA_LIST_METHODS.coverUrl.call(
          this,
          card,
          ".upd-thumb > img",
        ),
      });
    }
    if (list.length === 0) {
      throw new Error("NTK Manhwa Latest cards are missing");
    }
    return { list, hasNextPage: false };
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
