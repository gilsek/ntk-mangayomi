const mangayomiSources = [
  {
    name: "NTK Webtoon",
    id: 260713001,
    baseUrl: "https://sbxh9.com",
    lang: "ko",
    typeSource: "single",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=128&domain=https://sbxh9.com",
    dateFormat: "yy.MM.dd",
    dateFormatLocale: "ko",
    isNsfw: true,
    hasCloudflare: false,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/manga/src/ko/ntk_webtoon.js",
    apiUrl: "",
    version: "0.101",
    isManga: true,
    itemType: 0,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes:
      "Next Popular preview only; latest, search, filters, detail, and reader are not implemented.",
    pkgPath: "manga/src/ko/ntk_webtoon.js",
  },
];

const BASE_URL_PREFERENCE = "ntk_webtoon_base_url";
const PARSER_FAMILY_PREFERENCE = "ntk_webtoon_parser_family";
const LEGACY_DEFAULT_BASE_URL = "https://newtoki1.org";
const NEXT_DEFAULT_DOMAIN_NUMBER = "9";
const NEXT_DOMAIN_NUMBER_PREFERENCE = "ntk_webtoon_next_domain_number";

class DefaultExtension extends MProvider {
  get supportsLatest() {
    return true;
  }

  getHeaders() {
    return {
      Referer: `${this.getBaseUrl()}/`,
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    };
  }

  getBaseUrl() {
    return this.getParserFamily() === "next"
      ? this.getNextBaseUrl()
      : this.getLegacyBaseUrl();
  }

  getLegacyBaseUrl() {
    const configured = new SharedPreferences().get(BASE_URL_PREFERENCE);
    const baseUrl = (configured || LEGACY_DEFAULT_BASE_URL).trim();
    return baseUrl.replace(/\/+$/, "");
  }

  getNextDomainNumber() {
    const configured = new SharedPreferences().get(
      NEXT_DOMAIN_NUMBER_PREFERENCE,
    );
    const value = (configured || "").trim() || NEXT_DEFAULT_DOMAIN_NUMBER;
    if (!/^\d+$/.test(value)) {
      throw new Error(`Invalid Next domain number=${value}`);
    }
    return value;
  }

  getNextBaseUrl() {
    return `https://sbxh${this.getNextDomainNumber()}.com`;
  }

  getParserFamily() {
    return (
      new SharedPreferences().get(PARSER_FAMILY_PREFERENCE) || "next"
    ).trim();
  }

  assertLegacyParser() {
    const parserFamily = this.getParserFamily();
    if (parserFamily !== "legacy") {
      throw new Error(`Unsupported parserFamily=${parserFamily}`);
    }
  }

  appendParameter(parameters, name, value) {
    if (value === undefined || value === null || value === "") return;
    parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }

  buildLegacyListUrl({ mode, query = "", page = 1, filters = [] }) {
    const parameters = [];
    this.appendParameter(parameters, "kind", "webtoon");
    this.appendParameter(parameters, "pub", "ongoing");

    const normalizedQuery = query.trim();
    this.appendParameter(parameters, "stx", normalizedQuery);

    let sort = mode === "popular" ? "as_view" : "as_update";
    const fields = {
      author: "author",
      category: "toon",
      weekday: "yoil",
      initial: "jaum",
      platform: "plat",
      genre: "tag",
    };

    for (const filter of filters || []) {
      if (filter.type === "author") {
        this.appendParameter(parameters, "author", (filter.state || "").trim());
        continue;
      }

      const option = filter.values?.[filter.state];
      if (filter.type === "sort") {
        sort = option?.value || sort;
        continue;
      }

      const field = fields[filter.type];
      if (field) this.appendParameter(parameters, field, option?.value || "");
    }

    this.appendParameter(parameters, "sst", sort);
    this.appendParameter(parameters, "sod", "desc");
    if (page > 1) this.appendParameter(parameters, "page", String(page));

    return `${this.getBaseUrl()}/webtoon?${parameters.join("&")}`;
  }

  toAbsoluteUrl(value) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("//")) return `https:${value}`;
    if (value.startsWith("/")) return `${this.getBaseUrl()}${value}`;
    return `${this.getBaseUrl()}/${value}`;
  }

  buildNextPopularUrl() {
    return `${this.getNextBaseUrl()}/rank?period=week&kind=webtoon`;
  }

  buildNextLatestUrl(page) {
    return `${this.getNextBaseUrl()}/ing?page=${encodeURIComponent(String(page))}`;
  }

  buildNextSearchUrl(query) {
    const parameters = [];
    this.appendParameter(parameters, "q", query.trim());
    this.appendParameter(parameters, "field", "title");
    this.appendParameter(parameters, "match", "contains");
    return `${this.getNextBaseUrl()}/search?${parameters.join("&")}`;
  }

  parseNextRankCard(element, titleSelector, requestUrl) {
    const name = (element.selectFirst(titleSelector).text || "").trim();
    if (!name) {
      throw new Error(
        `Next Webtoon structure error parserFamily=next url=${requestUrl} missing=${titleSelector}`,
      );
    }

    const link = element.getHref || element.attr("href") || "";
    if (!link) {
      throw new Error(
        `Next Webtoon structure error parserFamily=next url=${requestUrl} missing=rank href`,
      );
    }

    const cover = element.selectFirst(".rank-v2-cover img");
    const image = cover.getSrc || cover.attr("src") || "";

    return {
      name,
      link,
      imageUrl: this.toAbsoluteUrl(image),
    };
  }

  parseNextChampion(element, requestUrl) {
    return this.parseNextRankCard(element, "h2", requestUrl);
  }

  parseNextRunner(element, requestUrl) {
    return this.parseNextRankCard(
      element,
      ".rank-v2-runner-body > strong",
      requestUrl,
    );
  }

  parseNextRow(element, requestUrl) {
    return this.parseNextRankCard(
      element,
      ".rank-v2-row-title > strong",
      requestUrl,
    );
  }

  parseNextPopularResponse(response, requestUrl) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Next Webtoon HTTP ${response.statusCode} parserFamily=next url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new Error(
        `Next Webtoon non-HTML response parserFamily=next url=${requestUrl}`,
      );
    }

    const document = new Document(response.body);
    if (document.select(".rank-v2-page").length === 0) {
      throw new Error(
        `Next Webtoon structure error parserFamily=next url=${requestUrl} missing=.rank-v2-page`,
      );
    }

    const champions = document
      .select("a.rank-v2-champion")
      .map((element) => this.parseNextChampion(element, requestUrl));
    const runners = document
      .select("a.rank-v2-runner")
      .map((element) => this.parseNextRunner(element, requestUrl));
    const rows = document
      .select("a.rank-v2-row")
      .map((element) => this.parseNextRow(element, requestUrl));
    const list = [...champions, ...runners, ...rows];

    if (list.length === 0) {
      throw new Error(
        `Next Webtoon structure error parserFamily=next url=${requestUrl} missing=rank cards`,
      );
    }

    return { list, hasNextPage: false };
  }

  async fetchNextPopular() {
    const requestUrl = this.buildNextPopularUrl();
    const response = await new Client().get(requestUrl, this.getHeaders());
    return this.parseNextPopularResponse(response, requestUrl);
  }

  parseNextLatestCard(element, requestUrl) {
    const name = (element.selectFirst("p.subject").text || "").trim();
    if (!name) {
      throw new Error(
        `Next Webtoon latest structure error parserFamily=next url=${requestUrl} missing=p.subject`,
      );
    }

    const link = element.getHref || element.attr("href") || "";
    const cover = element.selectFirst(".thumb img:not(.platform-icon)");
    const image = cover.getSrc || cover.attr("src") || "";

    return {
      name,
      link,
      imageUrl: this.toAbsoluteUrl(image),
    };
  }

  hasNextLatestPage(document) {
    return (
      document.select('button[aria-label^="다음"]:not([disabled])').length > 0
    );
  }

  parseNextLatestResponse(response, requestUrl) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Next Webtoon HTTP ${response.statusCode} parserFamily=next url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new Error(
        `Next Webtoon non-HTML response parserFamily=next url=${requestUrl}`,
      );
    }

    const document = new Document(response.body);
    if (document.select(".ep-empty").length > 0) {
      return { list: [], hasNextPage: false };
    }
    if (document.select("div.card-grid").length === 0) {
      throw new Error(
        `Next Webtoon latest structure error parserFamily=next url=${requestUrl} missing=div.card-grid,.ep-empty`,
      );
    }
    const cards = document.select(
      'div.card-grid > a.card[href^="/webtoon/"]',
    );
    if (cards.length === 0) {
      throw new Error(
        `Next Webtoon latest structure error parserFamily=next url=${requestUrl} missing=latest cards`,
      );
    }
    return {
      list: cards.map((element) =>
        this.parseNextLatestCard(element, requestUrl),
      ),
      hasNextPage: this.hasNextLatestPage(document),
    };
  }

  async fetchNextLatest(page) {
    const requestUrl = this.buildNextLatestUrl(page);
    const response = await new Client().get(requestUrl, this.getHeaders());
    return this.parseNextLatestResponse(response, requestUrl);
  }

  parseNextSearchCard(element, requestUrl) {
    const name = (element.selectFirst("p.subject").text || "").trim();
    if (!name) {
      throw new Error(
        `Next Webtoon search structure error parserFamily=next url=${requestUrl} missing=p.subject`,
      );
    }

    const link = element.getHref || element.attr("href") || "";
    const cover = element.selectFirst(".thumb img:not(.platform-icon)");
    const image = cover.getSrc || cover.attr("src") || "";

    return {
      name,
      link,
      imageUrl: this.toAbsoluteUrl(image),
    };
  }

  parseNextSearchResponse(response, requestUrl) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Next Webtoon HTTP ${response.statusCode} parserFamily=next url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new Error(
        `Next Webtoon non-HTML response parserFamily=next url=${requestUrl}`,
      );
    }

    const document = new Document(response.body);
    if (document.select(".ep-empty").length > 0) {
      return { list: [], hasNextPage: false };
    }
    if (document.select("div.search-results-grid").length === 0) {
      throw new Error(
        `Next Webtoon search structure error parserFamily=next url=${requestUrl} missing=div.search-results-grid,.ep-empty`,
      );
    }

    const cards = document.select(
      'div.search-results-grid > a.card[href^="/webtoon/"]',
    );
    return {
      list: cards.map((element) =>
        this.parseNextSearchCard(element, requestUrl),
      ),
      hasNextPage: false,
    };
  }

  async fetchNextSearch(query) {
    const requestUrl = this.buildNextSearchUrl(query);
    const response = await new Client().get(requestUrl, this.getHeaders());
    return this.parseNextSearchResponse(response, requestUrl);
  }

  parseLegacyListItem(element, requestUrl) {
    const titleElement = element.selectFirst("span.title.white");
    const name = (titleElement.text || "").trim();
    if (!name) {
      throw new Error(
        `Legacy Webtoon structure error parserFamily=legacy url=${requestUrl} missing=span.title.white`,
      );
    }

    const linkElement = element.selectFirst('a[href^="/webtoon/"]');
    const link = linkElement.getHref || linkElement.attr("href") || "";
    if (!link) {
      throw new Error(
        `Legacy Webtoon structure error parserFamily=legacy url=${requestUrl} missing=a[href^=\"/webtoon/\"]`,
      );
    }

    const imageElement = element.selectFirst("img.theme-thumb-img");
    const image = imageElement.getSrc || imageElement.attr("src") || "";

    return {
      name,
      link,
      imageUrl: this.toAbsoluteUrl(image),
    };
  }

  hasLegacyNextPage(document, requestedPage) {
    const active = document.selectFirst(
      "ul.pagination-desktop li.active a",
    );
    const activeNumber = Number.parseInt((active.text || "").trim(), 10);
    const currentPage = Number.isFinite(activeNumber)
      ? activeNumber
      : requestedPage;
    let maxPage = currentPage;

    for (const anchor of document.select("ul.pagination-desktop a")) {
      const href = anchor.getHref || anchor.attr("href") || "";
      const hrefMatch = href.match(/[?&]page=(\d+)/);
      const textNumber = Number.parseInt((anchor.text || "").trim(), 10);
      if (hrefMatch) maxPage = Math.max(maxPage, Number(hrefMatch[1]));
      if (Number.isFinite(textNumber)) maxPage = Math.max(maxPage, textNumber);
    }

    return currentPage < maxPage;
  }

  parseLegacyListResponse(response, requestUrl, requestedPage) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Legacy Webtoon HTTP ${response.statusCode} parserFamily=legacy url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new Error(
        `Legacy Webtoon non-HTML response parserFamily=legacy url=${requestUrl}`,
      );
    }

    const document = new Document(response.body);
    if (document.select("div.wr-none").length > 0) {
      return { list: [], hasNextPage: false };
    }

    const elements = document.select("#webtoon-list-all > li");
    if (elements.length > 0) {
      return {
        list: elements.map((element) =>
          this.parseLegacyListItem(element, requestUrl),
        ),
        hasNextPage: this.hasLegacyNextPage(document, requestedPage),
      };
    }

    throw new Error(
      `Legacy Webtoon structure error parserFamily=legacy url=${requestUrl} missing=#webtoon-list-all,div.wr-none`,
    );
  }

  async fetchLegacyList(options) {
    this.assertLegacyParser();
    const requestUrl = this.buildLegacyListUrl(options);
    const response = await new Client().get(requestUrl, this.getHeaders());
    return this.parseLegacyListResponse(response, requestUrl, options.page || 1);
  }

  async getPopular(page) {
    if (this.getParserFamily() === "next") {
      if (page > 1) return { list: [], hasNextPage: false };
      return this.fetchNextPopular();
    }
    return this.fetchLegacyList({ mode: "popular", page });
  }

  async getLatestUpdates(page) {
    if (this.getParserFamily() === "next") return this.fetchNextLatest(page);
    return this.fetchLegacyList({ mode: "latest", page });
  }

  async search(query, page, filters) {
    if (this.getParserFamily() === "next") {
      const normalizedQuery = query.trim();
      if (!normalizedQuery || page > 1) {
        return { list: [], hasNextPage: false };
      }
      return this.fetchNextSearch(normalizedQuery);
    }
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 1) {
      return { list: [], hasNextPage: false };
    }

    return this.fetchLegacyList({
      mode: "search",
      query: normalizedQuery,
      page,
      filters,
    });
  }

  getFilterList() {
    if (this.getParserFamily() === "next") return [];

    const select = (type, name, values) => ({
      type_name: "SelectFilter",
      type,
      name,
      state: 0,
      values: values.map(([optionName, value]) => ({
        type_name: "SelectOption",
        name: optionName,
        value,
      })),
    });

    return [
      {
        type_name: "TextFilter",
        type: "author",
        name: "작가",
        state: "",
      },
      select("category", "분류", [
        ["전체/일반", ""],
        ["성인웹툰", "성인웹툰"],
        ["BL/GL", "BL/GL"],
        ["완결웹툰", "완결웹툰"],
      ]),
      select("weekday", "요일", [
        ["전체", ""],
        ["월", "월"],
        ["화", "화"],
        ["수", "수"],
        ["목", "목"],
        ["금", "금"],
        ["토", "토"],
        ["일", "일"],
        ["열흘", "열흘"],
      ]),
      select("initial", "초성", [
        ["전체", ""],
        ["ㄱ", "ㄱ"],
        ["ㄴ", "ㄴ"],
        ["ㄷ", "ㄷ"],
        ["ㄹ", "ㄹ"],
        ["ㅁ", "ㅁ"],
        ["ㅂ", "ㅂ"],
        ["ㅅ", "ㅅ"],
        ["ㅇ", "ㅇ"],
        ["ㅈ", "ㅈ"],
        ["ㅊ", "ㅊ"],
        ["ㅋ", "ㅋ"],
        ["ㅌ", "ㅌ"],
        ["ㅍ", "ㅍ"],
        ["ㅎ", "ㅎ"],
        ["영문", "a-z"],
        ["숫자", "0-9"],
      ]),
      select("platform", "플랫폼", [
        ["전체", ""],
        ["네이버", "1"],
        ["카카오", "3"],
        ["레진", "4"],
        ["투믹스", "5"],
        ["탑툰", "6"],
        ["코미카", "7"],
        ["배틀코믹스", "8"],
        ["케이툰", "10"],
        ["피너툰", "13"],
        ["봄툰", "14"],
        ["코미코", "15"],
        ["기타", "99"],
      ]),
      select("genre", "장르", [
        ["전체", ""],
        ["판타지", "판타지"],
        ["액션", "액션"],
        ["개그", "개그"],
        ["미스터리", "미스터리"],
        ["로맨스", "로맨스"],
        ["드라마", "드라마"],
        ["무협", "무협"],
        ["스포츠", "스포츠"],
        ["일상", "일상"],
        ["학원", "학원"],
        ["성인", "성인"],
        ["BLGL", "BLGL"],
        ["한국", "한국"],
        ["중국", "중국"],
      ]),
      select("sort", "정렬", [
        ["최신순", "as_update"],
        ["신작순", "as_new"],
        ["북마크순", "as_bookmark"],
        ["조회순", "as_view"],
        ["평점순", "as_rating"],
        ["화수순", "as_episode"],
      ]),
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: NEXT_DOMAIN_NUMBER_PREFERENCE,
        editTextPreference: {
          title: "Next domain number",
          summary: "sbxh 뒤에 붙는 숫자만 입력합니다.",
          value: NEXT_DEFAULT_DOMAIN_NUMBER,
          dialogTitle: "Next domain number",
          dialogMessage: "예: 9 → https://sbxh9.com",
        },
      },
      {
        key: BASE_URL_PREFERENCE,
        editTextPreference: {
          title: "Legacy Base URL",
          summary: "수동으로 사용할 NTK 계열 주소",
          value: LEGACY_DEFAULT_BASE_URL,
          dialogTitle: "Webtoon Base URL",
          dialogMessage: "끝의 /는 자동으로 제거됩니다.",
        },
      },
      {
        key: PARSER_FAMILY_PREFERENCE,
        listPreference: {
          title: "Parser family",
          summary: "주소에 맞는 파서 계열을 수동으로 선택합니다.",
          valueIndex: 0,
          entries: ["Next", "Legacy"],
          entryValues: ["next", "legacy"],
        },
      },
    ];
  }
}
