const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "javascript",
  "manga",
  "src",
  "ko",
  "ntk_webtoon.js",
);

function readAttribute(openTag, name) {
  const match = openTag.match(
    new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? match[1] ?? match[2] ?? "" : "";
}

function hasClass(openTag, className) {
  return readAttribute(openTag, "class")
    .split(/\s+/)
    .includes(className);
}

function stripTags(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function matchingElements(html, selector) {
  const results = [];

  if (
    selector === "a.rank-v2-champion" ||
    selector === "a.rank-v2-runner" ||
    selector === "a.rank-v2-row"
  ) {
    const className = selector.slice(2);
    for (const match of html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
      if (hasClass(match[1], className)) {
        results.push(new TestElement(match[0], match[1]));
      }
    }
  } else if (selector === 'a[href^="/webtoon/"]') {
    for (const match of html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
      if (readAttribute(match[1], "href").startsWith("/webtoon/")) {
        results.push(new TestElement(match[0], match[1]));
      }
    }
  } else if (selector === "span.title.white") {
    for (const match of html.matchAll(/(<span\b[^>]*>)([\s\S]*?)<\/span>/gi)) {
      if (hasClass(match[1], "title") && hasClass(match[1], "white")) {
        results.push(new TestElement(match[0], match[1]));
      }
    }
  } else if (selector === "img.theme-thumb-img") {
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      if (hasClass(match[0], "theme-thumb-img")) {
        results.push(new TestElement(match[0], match[0]));
      }
    }
  } else if (selector === "div.list-platform[title]") {
    for (const match of html.matchAll(/<div\b[^>]*>/gi)) {
      if (
        hasClass(match[0], "list-platform") &&
        readAttribute(match[0], "title")
      ) {
        results.push(new TestElement(match[0], match[0]));
      }
    }
  } else if (selector === "div.list-date") {
    for (const match of html.matchAll(
      /(<div\b[^>]*class=["'][^"']*list-date[^"']*["'][^>]*>)([\s\S]*?)<\/div>/gi,
    )) {
      if (hasClass(match[1], "list-date")) {
        results.push(new TestElement(match[0], match[1]));
      }
    }
  } else if (selector === "h2") {
    for (const match of html.matchAll(/(<h2\b[^>]*>)([\s\S]*?)<\/h2>/gi)) {
      results.push(new TestElement(match[0], match[1]));
    }
  } else if (selector === ".rank-v2-runner-body > strong") {
    const body = html.match(
      /<span\b[^>]*class=["'][^"']*rank-v2-runner-body[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    if (body) {
      for (const match of body[1].matchAll(
        /(<strong\b[^>]*>)([\s\S]*?)<\/strong>/gi,
      )) {
        results.push(new TestElement(match[0], match[1]));
      }
    }
  } else if (selector === ".rank-v2-row-title > strong") {
    const title = html.match(
      /<div\b[^>]*class=["'][^"']*rank-v2-row-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    if (title) {
      for (const match of title[1].matchAll(
        /(<strong\b[^>]*>)([\s\S]*?)<\/strong>/gi,
      )) {
        results.push(new TestElement(match[0], match[1]));
      }
    }
  } else if (selector === ".rank-v2-cover img") {
    const cover = html.match(
      /<div\b[^>]*class=["'][^"']*rank-v2-cover[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    if (cover) {
      for (const match of cover[1].matchAll(/<img\b[^>]*>/gi)) {
        results.push(new TestElement(match[0], match[0]));
      }
    }
  }

  return results;
}

class TestElement {
  constructor(html = "", openTag = "") {
    this.html = html;
    this.openTag = openTag;
  }

  attr(name) {
    return readAttribute(this.openTag, name);
  }

  get getHref() {
    return this.attr("href");
  }

  get getSrc() {
    return this.attr("src") || this.attr("data-src");
  }

  get text() {
    return stripTags(this.html);
  }

  select(selector) {
    return matchingElements(this.html, selector);
  }

  selectFirst(selector) {
    return this.select(selector)[0] ?? new TestElement();
  }
}

class TestDocument {
  constructor(html) {
    this.html = html;
  }

  select(selector) {
    if (selector === ".rank-v2-page") {
      return Array.from(this.html.matchAll(/<[^>]+>/gi))
        .filter((match) => hasClass(match[0], "rank-v2-page"))
        .map((match) => new TestElement(match[0], match[0]));
    }

    if (selector === "#webtoon-list-all > li") {
      const container = this.html.match(
        /<(ul|div)\b[^>]*id=["']webtoon-list-all["'][^>]*>([\s\S]*?)<\/\1>/i,
      );
      if (!container) return [];
      return Array.from(
        container[2].matchAll(/(<li\b[^>]*>)([\s\S]*?)<\/li>/gi),
        (match) => new TestElement(match[0], match[1]),
      );
    }

    if (selector === "div.wr-none") {
      return Array.from(this.html.matchAll(/<div\b[^>]*>/gi))
        .filter((match) => hasClass(match[0], "wr-none"))
        .map((match) => new TestElement(match[0], match[0]));
    }

    if (selector === "ul.pagination-desktop a") {
      const pagination = this.html.match(
        /<ul\b[^>]*class=["'][^"']*pagination-desktop[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i,
      );
      if (!pagination) return [];
      return Array.from(
        pagination[1].matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi),
        (match) => new TestElement(match[0], match[1]),
      );
    }

    if (selector === "ul.pagination-desktop li.active a") {
      const active = this.html.match(
        /<ul\b[^>]*pagination-desktop[^>]*>[\s\S]*?<li\b[^>]*class=["'][^"']*active[^"']*["'][^>]*>\s*(<a\b[^>]*>[\s\S]*?<\/a>)/i,
      );
      if (!active) return [];
      const anchor = active[1].match(/(<a\b[^>]*>)([\s\S]*?)<\/a>/i);
      return anchor ? [new TestElement(anchor[0], anchor[1])] : [];
    }

    return matchingElements(this.html, selector);
  }

  selectFirst(selector) {
    return this.select(selector)[0] ?? new TestElement();
  }
}

function loadWebtoonSource({
  body = '<div class="wr-none">등록된 작품이 없습니다.</div>',
  preferences = {},
  statusCode = 200,
  headers = { "content-type": "text/html; charset=utf-8" },
} = {}) {
  assert.ok(
    fs.existsSync(sourcePath),
    "ntk_webtoon.js must exist before the source contract can pass",
  );

  const requests = [];

  class TestClient {
    async get(url, requestHeaders = {}) {
      requests.push({ url, headers: requestHeaders });
      return { body, headers, statusCode };
    }
  }

  class TestPreferences {
    get(key) {
      return preferences[key] ?? "";
    }
  }

  class TestProvider {
    get source() {
      return context.__sources[0];
    }
  }

  const context = vm.createContext({
    Client: TestClient,
    Document: TestDocument,
    MProvider: TestProvider,
    SharedPreferences: TestPreferences,
    console,
  });

  const code = fs.readFileSync(sourcePath, "utf8");
  vm.runInContext(
    `${code}\n;globalThis.__DefaultExtension = DefaultExtension; globalThis.__sources = mangayomiSources;`,
    context,
    { filename: sourcePath },
  );

  return {
    extension: new context.__DefaultExtension(),
    requests,
    sources: JSON.parse(JSON.stringify(context.__sources)),
  };
}

module.exports = { loadWebtoonSource };
