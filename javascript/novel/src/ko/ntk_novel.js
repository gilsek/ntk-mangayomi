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
    version: "0.303",
    isManga: false,
    itemType: 2,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes:
      "Legacy Popular, Latest, title search, filters, detail, and complete chapter lists are implemented. Reader is not implemented.",
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
  allMatches,
  appendQuery,
  attrValue,
  filterOption,
  filterTextValue,
  firstMatch,
  htmlDecode,
  isValidNovelDate,
  joinUrl,
  normalizeNovelEpisodeLink,
  normalizeNovelWorkLink,
  parseChaptersHtml,
  parseDetailsHtml,
  parseStatus,
  pathFromUrl,
  selectFilter,
  stripTags,
  textFilter,
  toEpochMillis,
  trimSlash,
};
