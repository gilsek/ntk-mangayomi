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
    version: "0.108",
    isManga: true,
    itemType: 0,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes:
      "Next Popular, Latest, title search, filters, detail, full episode lists, and WebView-backed reader with platform-safe covers. Reader requires modified Mangayomi with the WebView payload-preservation patch.",
    pkgPath: "manga/src/ko/ntk_webtoon.js",
  },
];

const BASE_URL_PREFERENCE = "ntk_webtoon_base_url";
const PARSER_FAMILY_PREFERENCE = "ntk_webtoon_parser_family";
const LEGACY_DEFAULT_BASE_URL = "https://newtoki1.org";
const NEXT_DEFAULT_DOMAIN_NUMBER = "9";
const NEXT_DOMAIN_NUMBER_PREFERENCE = "ntk_webtoon_next_domain_number";
const NEXT_MAIN_GENRES = [
  [1, "학원"], [2, "액션"], [3, "SF"], [4, "스토리"], [5, "판타지"],
  [6, "BL/백합"], [9, "드라마"], [10, "로맨스"], [11, "시대"],
  [12, "스포츠"], [13, "일상"], [16, "성인"], [19, "무협"],
];
const NEXT_DETAIL_GENRES = [
  [7, "개그/코미디"], [8, "연애/순정"], [14, "추리/미스터리"], [15, "공포/스릴러"],
  [17, "옴니버스"], [18, "에피소드"], [20, "소년"], [99, "기타"],
  [517, "절륜공"], [529, "존댓말공"], [287, "월드드랍"], [288, "WorldDrop"],
  [290, "다정남"], [291, "능글남"], [292, "능력녀"], [293, "절륜남"], [295, "직진남"],
  [297, "유혹남"], [298, "순정녀"], [299, "캠퍼스물"], [301, "능력남"], [302, "동양풍"],
  [304, "인외존재"], [306, "소꿉친구"], [310, "강공"], [311, "피폐물"], [312, "삼각관계"],
  [315, "능글공"], [316, "집착공"], [317, "까칠수"], [333, "대형견남"], [336, "원나잇"],
  [340, "성장물"], [343, "순수녀"], [379, "까칠공"], [380, "연상수"], [384, "미남공"],
  [385, "순정공"], [387, "연하공"], [388, "대물공"], [390, "다정수"], [392, "계략공"],
  [393, "대형견공"], [394, "단정수"], [409, "후회공"], [410, "다정공"], [413, "순진수"],
  [414, "짝사랑수"], [416, "상처수"], [418, "동거"], [419, "미인수"], [420, "짝사랑"],
  [424, "무심수"], [429, "애증"], [435, "사랑꾼공"], [436, "귀염수"], [438, "능력수"],
  [440, "상처공"], [461, "오해/착각"], [102, "유부녀"], [103, "하드코어"], [114, "고수위"],
  [121, "오피스"], [127, "능욕"], [135, "하렘"], [142, "강제"], [144, "연상공"],
  [145, "미인공"], [147, "강수"], [148, "연하수"], [150, "미남수"], [151, "오메가버스"],
  [152, "SM"], [153, "계약관계"], [154, "섹스파트너"], [155, "BL"], [156, "로코"],
  [157, "다정녀"], [158, "순정남"], [160, "연상녀"], [161, "현대물"], [162, "연하남"],
  [163, "첫사랑"], [164, "달달물"], [165, "여성인기19"], [166, "남성인기19"], [167, "나쁜남자"],
  [168, "순진녀"], [169, "더티토크"], [193, "거유"], [206, "3P"], [207, "모럴리스"],
  [209, "후방주의"], [234, "복수"], [241, "상처녀"], [243, "서양풍"], [245, "집착남"],
  [246, "계략남"], [247, "로판"], [248, "소설원작"],
];
const NEXT_PLATFORMS = [
  ["전체", ""], ["네이버", "1"], ["다음", "2"], ["카카오", "3"],
  ["레진", "4"], ["투믹스", "5"], ["탑툰", "6"], ["코미카", "7"],
  ["배틀코믹스", "8"], ["코믹GT", "9"], ["케이툰", "10"],
  ["애니툰", "11"], ["폭스툰", "12"], ["피너툰", "13"],
  ["봄툰", "14"], ["코미코", "15"], ["무툰", "16"], ["기타", "99"],
];
const NEXT_SORTS = [
  ["최신순", "new"], ["신작순", "fresh"], ["북마크순", "hot"],
  ["조회순", "views"], ["평점순", "rating"], ["화수순", "episodes"],
];

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

  getSelectedFilterValue(filters, type, fallback) {
    const filter = (filters || []).find((candidate) => candidate.type === type);
    if (!filter || !Number.isInteger(filter.state)) return fallback;
    const option = filter.values?.[filter.state];
    if (!option || option.value === undefined || option.value === null) {
      return fallback;
    }
    return String(option.value);
  }

  getNextGenreStates(filters) {
    const included = [];
    const excluded = [];
    const seen = new Set();

    for (const type of ["mainGenres", "detailGenres"]) {
      const group = (filters || []).find(
        (candidate) => candidate.type === type,
      );
      for (const genre of group?.state || []) {
        if (genre.state !== 1 && genre.state !== 2) continue;
        const value = String(genre.value || "");
        if (!value || seen.has(value)) continue;
        seen.add(value);
        if (genre.state === 1) included.push(value);
        if (genre.state === 2) excluded.push(value);
      }
    }

    return { included, excluded };
  }

  buildNextFilterUrl(page, filters) {
    const parameters = [];
    const workType = this.getSelectedFilterValue(
      filters,
      "workType",
      "all",
    );
    this.appendParameter(
      parameters,
      "status",
      workType === "completed" ? "completed" : "ongoing",
    );
    if (workType !== "completed") {
      this.appendParameter(parameters, "cat", workType);
    }
    const { included, excluded } = this.getNextGenreStates(filters);
    this.appendParameter(parameters, "tag", included.join(","));
    this.appendParameter(parameters, "xtag", excluded.join(","));
    this.appendParameter(
      parameters,
      "plat",
      this.getSelectedFilterValue(filters, "platform", ""),
    );
    const sort = this.getSelectedFilterValue(filters, "sort", "new");
    if (sort !== "new") this.appendParameter(parameters, "sort", sort);
    this.appendParameter(parameters, "withTotal", "1");
    this.appendParameter(parameters, "page", String(page));
    this.appendParameter(parameters, "pageSize", "42");
    return `${this.getNextBaseUrl()}/api/works?${parameters.join("&")}`;
  }

  parseNextFilterWork(work, requestUrl) {
    const sourceWorkId = work?.sourceWorkId;
    const validSourceWorkId =
      (typeof sourceWorkId === "number" && Number.isFinite(sourceWorkId)) ||
      (typeof sourceWorkId === "string" && sourceWorkId.trim().length > 0);
    if (!validSourceWorkId) {
      throw new Error(
        `Next Webtoon filter work structure error parserFamily=next url=${requestUrl} missing=sourceWorkId`,
      );
    }

    const name = typeof work?.title === "string" ? work.title.trim() : "";
    if (!name) {
      throw new Error(
        `Next Webtoon filter work structure error parserFamily=next url=${requestUrl} missing=title`,
      );
    }

    const image =
      typeof work.thumbnailUrl === "string" ? work.thumbnailUrl : "";
    return {
      name,
      link: `/webtoon/${String(sourceWorkId)}`,
      imageUrl: this.toAbsoluteUrl(image),
    };
  }

  parseNextFilterResponse(response, requestUrl) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Next Webtoon HTTP ${response.statusCode} parserFamily=next url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("application/json")) {
      throw new Error(
        `Next Webtoon non-JSON response parserFamily=next url=${requestUrl}`,
      );
    }

    let payload;
    try {
      payload = JSON.parse(response.body);
    } catch (_) {
      throw new Error(
        `Next Webtoon filter JSON error parserFamily=next url=${requestUrl}`,
      );
    }

    if (
      !Array.isArray(payload?.works) ||
      typeof payload?.hasMore !== "boolean"
    ) {
      throw new Error(
        `Next Webtoon filter structure error parserFamily=next url=${requestUrl}`,
      );
    }

    return {
      list: payload.works.map((work) =>
        this.parseNextFilterWork(work, requestUrl),
      ),
      hasNextPage: payload.hasMore,
    };
  }

  async fetchNextFilters(page, filters) {
    const requestUrl = this.buildNextFilterUrl(page, filters);
    const response = await new Client().get(requestUrl, this.getHeaders());
    return this.parseNextFilterResponse(response, requestUrl);
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

    let image = "";
    for (const candidate of element.select(".rank-v2-cover img")) {
      const classes = (candidate.attr("class") || "")
        .split(/\s+/)
        .filter(Boolean);
      if (classes.includes("rank-v2-platform")) continue;
      image = candidate.getSrc || candidate.attr("src") || "";
      if (image) break;
    }

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
    let image = "";
    for (const candidate of element.select(".thumb img")) {
      const classes = (candidate.attr("class") || "")
        .split(/\s+/)
        .filter(Boolean);
      if (classes.includes("platform-icon")) continue;
      image = candidate.getSrc || candidate.attr("src") || "";
      break;
    }

    return {
      name,
      link,
      imageUrl: this.toAbsoluteUrl(image),
    };
  }

  hasNextLatestPage(document) {
    return (
      document.select(
        'nav.pager button[aria-label^="다음"]:not([disabled])',
      ).length > 0
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
    const centeredEmpty = document.select(
      'main.container > div[style*="text-align:center"]',
    );
    if (
      centeredEmpty.length > 0 &&
      (centeredEmpty[0].text || "").trim() === "결과가 없습니다"
    ) {
      return { list: [], hasNextPage: false };
    }
    if (document.select("div.card-grid").length === 0) {
      throw new Error(
        `Next Webtoon latest structure error parserFamily=next url=${requestUrl} missing=div.card-grid,.ep-empty,centered empty marker`,
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
    const cover = element.selectFirst(".thumb img.search-thumb-img");
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

  normalizeNextDetailLink(url) {
    const value = typeof url === "string" ? url.trim() : "";
    const withoutOrigin = value.replace(/^https?:\/\/[^/]+/i, "");
    const path = withoutOrigin.split(/[?#]/)[0];
    const match = path.match(/^\/webtoon\/([^/]+)\/?$/);
    if (!match) {
      throw new Error(`Next Webtoon invalid detail link url=${value}`);
    }
    return {
      link: `/webtoon/${match[1]}`,
      sourceWorkId: match[1],
    };
  }

  normalizeNextReaderLink(url) {
    const value = typeof url === "string" ? url.trim() : "";
    const invalidLink = () => {
      throw new Error("Next Webtoon invalid reader link parserFamily=next");
    };
    let path = value;
    const absolute = value.match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?(?:[?#].*)?$/i);
    if (absolute) {
      const origin = `${absolute[1].toLowerCase()}://${absolute[2].toLowerCase()}`;
      if (origin !== this.getNextBaseUrl().toLowerCase()) invalidLink();
      path = absolute[3] || "/";
    } else {
      if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
        invalidLink();
      }
      path = value.split(/[?#]/)[0];
      if (path && !path.startsWith("/")) path = `/${path}`;
    }
    const match = path.match(/^\/webtoon\/([^/]+)\/([^/]+)$/);
    if (!match) invalidLink();
    return `/webtoon/${match[1]}/${match[2]}`;
  }

  createNextReaderImageExtractorScript(readerPath) {
    return `(function () {
  if (window.__ntkWebtoonReaderExtractor) return;
  window.__ntkWebtoonReaderExtractor = true;
  var expectedPath = ${JSON.stringify(readerPath)};
  var finished = false;
  var timer = null;

  function respond(payload) {
    if (finished) return;
    finished = true;
    if (timer) window.clearInterval(timer);
    window.flutter_inappwebview.callHandler(
      "setResponse",
      JSON.stringify(payload),
    );
  }

  if (window.location.pathname !== expectedPath) {
    respond({ ok: false, error: "reader path mismatch" });
    return;
  }

  function collect() {
    var container = document.querySelector(".vw-imgs");
    if (!container || !container.children.length) return false;
    var nodes = Array.prototype.slice.call(
      container.querySelectorAll(".viewer-lazy-img"),
    );
    if (nodes.length !== container.children.length) return false;
    var seen = {};
    var images = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var url = node.currentSrc || node.getAttribute("src") || node.getAttribute("data-src") || "";
      if (!/^https?:\\/\\//i.test(url)) return false;
      if (!seen[url]) {
        seen[url] = true;
        images.push(url);
      }
    }
    if (!images.length) return false;
    respond({ ok: true, images: images });
    return true;
  }

  if (collect()) return;
  var attempts = 0;
  timer = window.setInterval(function () {
    attempts += 1;
    if (collect()) return;
    var error = document.querySelector(".vw-empty");
    if (error) {
      respond({ ok: false, error: (error.textContent || "reader error").trim() });
      return;
    }
    if (attempts >= 100) {
      respond({ ok: false, error: "timeout waiting for reader images" });
    }
  }, 200);
})();`;
  }

  parseNextWebviewImageResponse(payload, readerPath) {
    let parsed = payload;
    if (typeof payload === "string") {
      try {
        parsed = JSON.parse(payload);
      } catch (_) {
        throw new Error(
          `Next Webtoon reader invalid response parserFamily=next url=${readerPath}`,
        );
      }
    }

    if (parsed?.ok !== true || !Array.isArray(parsed?.images)) {
      throw new Error(
        `Next Webtoon reader invalid response parserFamily=next url=${readerPath}`,
      );
    }

    const images = [];
    const seen = new Set();
    for (const image of parsed.images) {
      if (typeof image !== "string" || !/^https?:\/\//i.test(image)) continue;
      if (seen.has(image)) continue;
      seen.add(image);
      images.push(image);
    }
    if (images.length === 0) {
      throw new Error(
        `Next Webtoon reader empty response parserFamily=next url=${readerPath}`,
      );
    }
    return images;
  }

  getUniqueTexts(elements) {
    const values = [];
    const seen = new Set();
    for (const element of elements) {
      const value = (element.text || "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      values.push(value);
    }
    return values;
  }

  parseNextDetailResponse(response, requestUrl, link) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Next Webtoon detail HTTP ${response.statusCode} parserFamily=next url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new Error(
        `Next Webtoon detail non-HTML response parserFamily=next url=${requestUrl}`,
      );
    }

    const document = new Document(response.body);
    if (document.select("section.hero-v2").length === 0) {
      throw new Error(
        `Next Webtoon detail structure error parserFamily=next url=${requestUrl} missing=section.hero-v2`,
      );
    }

    const name = (document.selectFirst("h1.hero-v2-title").text || "").trim();
    if (!name) {
      throw new Error(
        `Next Webtoon detail structure error parserFamily=next url=${requestUrl} missing=h1.hero-v2-title`,
      );
    }

    const cover = document.selectFirst(".hero-v2-thumb img");
    const image = cover.getSrc || cover.attr("src") || "";
    let description = (
      document.selectFirst("p.hero-v2-desc").text || ""
    ).trim();
    if (description === "등록된 작품 설명이 없습니다.") description = "";

    const authors = this.getUniqueTexts(
      document.select(".hero-v2-author a"),
    );
    const author = authors.join(", ");
    const genre = this.getUniqueTexts(
      document.select(".hero-v2-tags a.hero-v2-tag"),
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
  }

  parseNextEpisodeResponse(response, requestUrl, sourceWorkId) {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(
        `Next Webtoon episode HTTP ${response.statusCode} parserFamily=next url=${requestUrl}`,
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.headers?.["Content-Type"] ||
      "";
    if (contentType && !contentType.toLowerCase().includes("application/json")) {
      throw new Error(
        `Next Webtoon episode non-JSON response parserFamily=next url=${requestUrl}`,
      );
    }

    let payload;
    try {
      payload = JSON.parse(response.body);
    } catch (_) {
      throw new Error(
        `Next Webtoon episode JSON error parserFamily=next url=${requestUrl}`,
      );
    }

    if (
      payload?.ok !== true ||
      !Number.isInteger(payload?.total) ||
      payload.total < 0 ||
      !Array.isArray(payload?.episodes) ||
      payload.total !== payload.episodes.length
    ) {
      throw new Error(
        `Next Webtoon episode structure error parserFamily=next url=${requestUrl} invalid=total,episodes`,
      );
    }

    const chapters = [];
    const seen = new Set();
    for (const episode of payload.episodes) {
      const sourceEpisodeId = episode?.sourceEpisodeId;
      const validId =
        (typeof sourceEpisodeId === "number" &&
          Number.isFinite(sourceEpisodeId)) ||
        (typeof sourceEpisodeId === "string" &&
          sourceEpisodeId.trim().length > 0);
      if (!validId) {
        throw new Error(
          `Next Webtoon episode structure error parserFamily=next url=${requestUrl} missing=sourceEpisodeId`,
        );
      }

      const episodeId = String(sourceEpisodeId).trim();
      if (seen.has(episodeId)) {
        throw new Error(
          `Next Webtoon episode structure error parserFamily=next url=${requestUrl} duplicate=sourceEpisodeId`,
        );
      }
      seen.add(episodeId);

      let name = typeof episode?.title === "string" ? episode.title.trim() : "";
      if (!name && Number.isFinite(episode?.epNo)) {
        name = `${episode.epNo}화`;
      }
      if (!name) {
        throw new Error(
          `Next Webtoon episode structure error parserFamily=next url=${requestUrl} missing=title,epNo`,
        );
      }

      chapters.push({
        name,
        url: `/webtoon/${sourceWorkId}/${encodeURIComponent(episodeId)}`,
        scanlator: "",
      });
    }
    return chapters;
  }

  async fetchNextDetail(url) {
    const { link, sourceWorkId } = this.normalizeNextDetailLink(url);
    const detailUrl = `${this.getNextBaseUrl()}${link}`;
    const client = new Client();
    const detailResponse = await client.get(detailUrl, this.getHeaders());
    const detail = this.parseNextDetailResponse(
      detailResponse,
      detailUrl,
      link,
    );

    const episodeUrl = `${this.getNextBaseUrl()}/api/webtoon/${encodeURIComponent(sourceWorkId)}/episodes`;
    const episodeResponse = await client.get(episodeUrl, this.getHeaders());
    const chapters = this.parseNextEpisodeResponse(
      episodeResponse,
      episodeUrl,
      sourceWorkId,
    );
    return { ...detail, chapters };
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

  async getDetail(url) {
    if (this.getParserFamily() === "next") return this.fetchNextDetail(url);
    throw new Error("Legacy Webtoon detail is not implemented");
  }

  async getPageList(url) {
    if (this.getParserFamily() !== "next") {
      throw new Error("Legacy Webtoon reader is not implemented");
    }

    const readerPath = this.normalizeNextReaderLink(url);
    if (typeof evaluateJavascriptViaWebview !== "function") {
      throw new Error(
        `WebView bridge unavailable parserFamily=next url=${readerPath}`,
      );
    }

    let payload;
    try {
      payload = await evaluateJavascriptViaWebview(
        `${this.getNextBaseUrl()}${readerPath}`,
        this.getHeaders(),
        [this.createNextReaderImageExtractorScript(readerPath)],
      );
    } catch (_) {
      throw new Error(
        `Next Webtoon reader WebView failed parserFamily=next url=${readerPath}`,
      );
    }
    return this.parseNextWebviewImageResponse(payload, readerPath).map(
      (image) => ({ url: image, headers: this.getHeaders() }),
    );
  }

  async search(query, page, filters) {
    if (this.getParserFamily() === "next") {
      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        if (page > 1) return { list: [], hasNextPage: false };
        return this.fetchNextSearch(normalizedQuery);
      }
      return this.fetchNextFilters(page, filters);
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

  getNextFilterList() {
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
    const group = (type, name, values) => ({
      type_name: "GroupFilter",
      type,
      name,
      state: values.map(([value, optionName]) => ({
        type_name: "TriState",
        type: "genre",
        name: optionName,
        value: String(value),
        state: 0,
      })),
    });

    return [
      select("workType", "작품 구분", [
        ["전체", "all"],
        ["일반", "normal"],
        ["비엘", "bl"],
        ["성인", "adult"],
        ["완결", "completed"],
      ]),
      {
        type_name: "HeaderFilter",
        type: "genreHint",
        name: "장르: 체크=포함, 가로선=제외",
      },
      group("mainGenres", "주요 장르", NEXT_MAIN_GENRES),
      group("detailGenres", "상세 장르", NEXT_DETAIL_GENRES),
      select("platform", "플랫폼", NEXT_PLATFORMS),
      select("sort", "정렬", NEXT_SORTS),
    ];
  }

  getFilterList() {
    if (this.getParserFamily() === "next") return this.getNextFilterList();

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
