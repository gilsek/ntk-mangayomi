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
    version: "0.205",
    isManga: true,
    itemType: 0,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes:
      "Popular, Latest, search, filters, detail, and full episodes are implemented; reader image loading is not implemented.",
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
  appendParameter(parameters, name, value) {
    if (value === undefined || value === null || value === "") return;
    parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  },

  selectedFilterValue(filters, type) {
    const filter = Array.isArray(filters)
      ? filters.find((candidate) => candidate?.type === type)
      : null;
    if (!filter || !Number.isInteger(filter.state)) return null;
    const option = Array.isArray(filter.values)
      ? filter.values[filter.state]
      : null;
    return typeof option?.value === "string" ? option.value : null;
  },

  buildSearchUrl(query) {
    const parameters = [];
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(parameters, "q", query);
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "kind",
      "manhwa",
    );
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "field",
      "title",
    );
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "match",
      "contains",
    );
    return `${this.getNextBaseUrl()}/search?${parameters.join("&")}`;
  },

  buildFilterUrl(page, filters) {
    const parameters = [];
    const liveFilters = MANHWA_SEARCH_FILTER_METHODS.getFilterList.call(this);
    const statusFilter = Array.isArray(filters)
      ? filters.find((candidate) => candidate?.type === "status")
      : null;
    const selectedStatus = statusFilter
      ? MANHWA_SEARCH_FILTER_METHODS.selectedFilterValue(filters, "status")
      : "ongoing";
    const liveStatuses = new Set(
      liveFilters
        .find((candidate) => candidate.type === "status")
        .values.map((option) => option.value),
    );
    const status = liveStatuses.has(selectedStatus) ? selectedStatus : null;
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "status",
      status,
    );

    const liveGenres = new Set(
      liveFilters
        .find((candidate) => candidate.type === "genres")
        .state.map((genre) => genre.value),
    );
    const genreFilter = Array.isArray(filters)
      ? filters.find((candidate) => candidate?.type === "genres")
      : null;
    const selectedGenres = [];
    const seenGenres = new Set();
    for (const genre of genreFilter?.state || []) {
      const value = typeof genre?.value === "string" ? genre.value : "";
      if (
        !liveGenres.has(value) ||
        seenGenres.has(value) ||
        (genre.state !== 1 && genre.state !== 2)
      ) {
        continue;
      }
      seenGenres.add(value);
      selectedGenres.push(genre.state === 2 ? `-${value}` : value);
    }
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "g",
      selectedGenres.join(","),
    );

    const selectedSort = MANHWA_SEARCH_FILTER_METHODS.selectedFilterValue(
      filters,
      "sort",
    );
    const liveSorts = new Set(
      liveFilters
        .find((candidate) => candidate.type === "sort")
        .values.map((option) => option.value),
    );
    const sort = liveSorts.has(selectedSort) ? selectedSort : null;
    if (sort && sort !== "new") {
      MANHWA_SEARCH_FILTER_METHODS.appendParameter(
        parameters,
        "sort",
        sort,
      );
    }
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "withTotal",
      "1",
    );
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "page",
      String(page),
    );
    MANHWA_SEARCH_FILTER_METHODS.appendParameter(
      parameters,
      "pageSize",
      "49",
    );
    return `${this.getNextBaseUrl()}/api/manhwa-list?${parameters.join("&")}`;
  },

  assertResponse(response, requestUrl, parserFamily, expectedContentType) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `NTK Manhwa HTTP ${response.statusCode} parserFamily=${parserFamily} url=${requestUrl}`,
      );
    }
    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (
      contentType &&
      !contentType.toLowerCase().includes(expectedContentType)
    ) {
      const label = expectedContentType === "text/html" ? "HTML" : "JSON";
      throw new Error(
        `NTK Manhwa non-${label} response parserFamily=${parserFamily} url=${requestUrl}`,
      );
    }
  },

  parseSearchResponse(response, requestUrl) {
    MANHWA_SEARCH_FILTER_METHODS.assertResponse(
      response,
      requestUrl,
      "next-search",
      "text/html",
    );
    const document = new Document(response.body);
    if (document.select(".ep-empty").length > 0) {
      return { list: [], hasNextPage: false };
    }
    if (document.select("div.search-results-grid").length === 0) {
      throw new Error(
        `NTK Manhwa search structure error parserFamily=next-search url=${requestUrl} missing=div.search-results-grid,.ep-empty`,
      );
    }

    const cards = document.select(
      'div.search-results-grid > a.card[href^="/manhwa/"]',
    );
    return {
      list: cards.map((element) => {
        const name = (element.selectFirst("p.subject").text || "").trim();
        if (!name) {
          throw new Error(
            `NTK Manhwa search card structure error parserFamily=next-search url=${requestUrl} missing=p.subject`,
          );
        }
        const suppliedLink = element.getHref || element.attr("href") || "";
        const cover = element.selectFirst(".thumb img.search-thumb-img");
        const image = cover.getSrc || cover.attr("src") || "";
        return {
          name,
          link: this.normalizeWorkLink(suppliedLink),
          imageUrl: this.toAbsoluteUrl(image),
        };
      }),
      hasNextPage: false,
    };
  },

  parseFilterResponse(response, requestUrl) {
    MANHWA_SEARCH_FILTER_METHODS.assertResponse(
      response,
      requestUrl,
      "next-filter",
      "application/json",
    );
    let payload;
    try {
      payload = JSON.parse(response.body);
    } catch (_) {
      throw new Error(
        `NTK Manhwa filter JSON error parserFamily=next-filter url=${requestUrl}`,
      );
    }
    if (
      !Array.isArray(payload?.works) ||
      typeof payload?.hasMore !== "boolean"
    ) {
      throw new Error(
        `NTK Manhwa filter structure error parserFamily=next-filter url=${requestUrl}`,
      );
    }

    const seenIds = new Set();
    const list = payload.works.map((work) => {
      const sourceWorkId = work?.sourceWorkId;
      const validId =
        (typeof sourceWorkId === "number" && Number.isFinite(sourceWorkId)) ||
        (typeof sourceWorkId === "string" && sourceWorkId.trim().length > 0);
      if (!validId) {
        throw new Error(
          `NTK Manhwa filter work structure error parserFamily=next-filter url=${requestUrl} missing=sourceWorkId`,
        );
      }
      const id = String(sourceWorkId).trim();
      if (seenIds.has(id)) {
        throw new Error(
          `NTK Manhwa filter structure error parserFamily=next-filter url=${requestUrl} duplicate=sourceWorkId`,
        );
      }
      seenIds.add(id);

      const name = typeof work?.title === "string" ? work.title.trim() : "";
      if (!name) {
        throw new Error(
          `NTK Manhwa filter work structure error parserFamily=next-filter url=${requestUrl} missing=title`,
        );
      }
      const image =
        typeof work.thumbnailUrl === "string" ? work.thumbnailUrl.trim() : "";
      return {
        name,
        link: this.normalizeWorkLink(`/manhwa/${id}`),
        imageUrl: this.toAbsoluteUrl(image),
      };
    });
    return { list, hasNextPage: payload.hasMore };
  },

  async search(query, page, filters) {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";
    if (normalizedQuery) {
      if (page > 1) return { list: [], hasNextPage: false };
      const requestUrl = MANHWA_SEARCH_FILTER_METHODS.buildSearchUrl.call(
        this,
        normalizedQuery,
      );
      const response = await this.client.get(requestUrl, this.getHeaders());
      return MANHWA_SEARCH_FILTER_METHODS.parseSearchResponse.call(
        this,
        response,
        requestUrl,
      );
    }

    const requestUrl = MANHWA_SEARCH_FILTER_METHODS.buildFilterUrl.call(
      this,
      page,
      filters,
    );
    const response = await this.client.get(requestUrl, this.getHeaders());
    return MANHWA_SEARCH_FILTER_METHODS.parseFilterResponse.call(
      this,
      response,
      requestUrl,
    );
  },

  getFilterList() {
    const select = (type, name, state, values) => ({
      type_name: "SelectFilter",
      type,
      name,
      state,
      values: values.map(([optionName, value]) => ({
        type_name: "SelectOption",
        name: optionName,
        value,
      })),
    });
    const genres = [
      "순정",
      "판타지",
      "러브코미디",
      "드라마",
      "17",
      "학원",
      "라노벨",
      "개그",
      "액션",
      "백합",
      "일상",
      "SF",
      "이세계",
      "스릴러",
      "애니화",
      "전생",
      "스포츠",
      "TS",
      "소년",
      "먹방",
      "붕탁",
      "게임",
      "호러",
      "시대",
      "로맨스",
      "추리",
      "음악",
      "무협",
      "BL",
    ];
    return [
      select("status", "상태", 1, [
        ["전체", ""],
        ["연재/방영중", "ongoing"],
        ["완결", "completed"],
      ]),
      {
        type_name: "HeaderFilter",
        type: "genreHint",
        name: "장르: 체크=포함, 가로선=제외",
      },
      {
        type_name: "GroupFilter",
        type: "genres",
        name: "장르",
        state: genres.map((genre) => ({
          type_name: "TriState",
          type: "genre",
          name: genre,
          value: genre,
          state: 0,
        })),
      },
      select("sort", "정렬", 0, [
        ["최신순", "new"],
        ["신작순", "fresh"],
        ["북마크순", "hot"],
        ["조회순", "views"],
        ["평점순", "rating"],
        ["화수순", "episodes"],
      ]),
    ];
  },
};
// endregion MANHWA_SEARCH_FILTER_METHODS

// region MANHWA_DETAIL_EPISODE_METHODS
const MANHWA_DETAIL_EPISODE_METHODS = {
  uniqueTexts(elements, { stripHash = false } = {}) {
    const values = [];
    const seen = new Set();
    for (const element of elements) {
      let value = (element.text || "").trim();
      if (stripHash) value = value.replace(/^#\s*/, "");
      if (!value || seen.has(value)) continue;
      seen.add(value);
      values.push(value);
    }
    return values;
  },

  parseDetailResponse(response, requestUrl, link) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(`Next Manhwa detail HTTP ${response.statusCode} url=${requestUrl}`);
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Next Manhwa detail non-HTML response url=${requestUrl}`);
    }

    const document = new Document(response.body);
    if (document.select("section.hero-v2").length === 0) {
      throw new Error(
        `Next Manhwa detail structure error url=${requestUrl} missing=section.hero-v2`,
      );
    }

    const name = (document.selectFirst("h1.hero-v2-title").text || "").trim();
    if (!name) {
      throw new Error(
        `Next Manhwa detail structure error url=${requestUrl} missing=h1.hero-v2-title`,
      );
    }

    const cover = document.selectFirst(".hero-v2-thumb img");
    const image = cover.getSrc || cover.attr("src") || cover.attr("data-src") || "";
    let description = (
      document.selectFirst("p.hero-v2-desc").text || ""
    ).trim();
    if (description === "등록된 작품 설명이 없습니다.") description = "";

    const authors = MANHWA_DETAIL_EPISODE_METHODS.uniqueTexts(
      document.select(".hero-v2-author a"),
    );
    const author = authors.join(", ");
    const genre = MANHWA_DETAIL_EPISODE_METHODS.uniqueTexts(
      document.select(".hero-v2-tags a.hero-v2-tag"),
      { stripHash: true },
    );

    const statusElement = document.selectFirst("span.pill-status");
    const statusText = (statusElement.text || "").trim();
    const statusClasses = (statusElement.attr("class") || "")
      .split(/\s+/)
      .filter(Boolean);
    let status = 5;
    if (statusClasses.includes("completed") || statusText.includes("완결")) {
      status = 1;
    } else if (
      statusClasses.includes("ongoing") ||
      statusText.includes("연재")
    ) {
      status = 0;
    }

    return {
      name,
      link,
      imageUrl: this.toAbsoluteUrl(image),
      description,
      author,
      artist: author,
      status,
      genre,
    };
  },

  parseEpisodeResponse(response, requestUrl, link) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Next Manhwa episode HTTP ${response.statusCode} url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("application/json")) {
      throw new Error(`Next Manhwa episode non-JSON response url=${requestUrl}`);
    }

    let payload;
    try {
      payload = JSON.parse(response.body);
    } catch (_) {
      throw new Error(`Next Manhwa episode JSON error url=${requestUrl}`);
    }

    if (payload?.ok !== true || !Array.isArray(payload?.episodes)) {
      throw new Error(
        `Next Manhwa episode structure error url=${requestUrl} invalid=ok,episodes`,
      );
    }

    const chapters = [];
    const seenIds = new Set();
    for (const episode of payload.episodes) {
      const sourceEpisodeId =
        typeof episode?.sourceEpisodeId === "string"
          ? episode.sourceEpisodeId.trim()
          : "";
      if (!sourceEpisodeId) {
        throw new Error(
          `Next Manhwa episode structure error url=${requestUrl} missing=sourceEpisodeId`,
        );
      }
      if (seenIds.has(sourceEpisodeId)) {
        throw new Error(
          `Next Manhwa episode structure error url=${requestUrl} duplicate=sourceEpisodeId`,
        );
      }

      const title = typeof episode?.title === "string" ? episode.title.trim() : "";
      if (!title) {
        throw new Error(
          `Next Manhwa episode structure error url=${requestUrl} missing=title`,
        );
      }

      let chapterLink;
      try {
        chapterLink = this.normalizeChapterLink(
          `${link}/${encodeURIComponent(sourceEpisodeId)}`,
        );
      } catch (_) {
        throw new Error(
          `Next Manhwa episode structure error url=${requestUrl} invalid=sourceEpisodeId`,
        );
      }

      seenIds.add(sourceEpisodeId);
      chapters.push({
        name: title,
        url: chapterLink,
        scanlator: "",
      });
    }
    return chapters;
  },

  async getDetail(url) {
    const link = this.normalizeWorkLink(url);
    const sourceWorkId = link.slice("/manhwa/".length);
    const baseUrl = this.getNextBaseUrl();
    const detailUrl = `${baseUrl}${link}`;
    const episodeUrl = `${baseUrl}/api/manhwa/${encodeURIComponent(sourceWorkId)}/episodes/viewer-nav`;
    const headers = this.getHeaders();
    const [detailResponse, episodeResponse] = await Promise.all([
      this.client.get(detailUrl, headers),
      this.client.get(episodeUrl, headers),
    ]);
    const detail = MANHWA_DETAIL_EPISODE_METHODS.parseDetailResponse.call(
      this,
      detailResponse,
      detailUrl,
      link,
    );
    const chapters = MANHWA_DETAIL_EPISODE_METHODS.parseEpisodeResponse.call(
      this,
      episodeResponse,
      episodeUrl,
      link,
    );
    return { ...detail, chapters };
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
