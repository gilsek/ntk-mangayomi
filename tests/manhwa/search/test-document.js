function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1]] = match[3];
  }
  return result;
}

function hasClass(elementAttributes, className) {
  return String(elementAttributes.class || "")
    .split(/\s+/)
    .includes(className);
}

function textContent(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

class EmptyElement {
  attr() {
    return "";
  }

  get getHref() {
    return "";
  }

  get getSrc() {
    return "";
  }

  get text() {
    return "";
  }

  select() {
    return [];
  }

  selectFirst() {
    return new EmptyElement();
  }
}

class TestElement {
  constructor(tag, elementAttributes, innerHtml = "") {
    this.tag = tag;
    this.attributes = elementAttributes;
    this.innerHtml = innerHtml;
  }

  attr(name) {
    return this.attributes[name] || "";
  }

  get getHref() {
    return this.attr("href");
  }

  get getSrc() {
    return this.attr("src");
  }

  get text() {
    return textContent(this.innerHtml);
  }

  select(selector) {
    if (selector === "p.subject") {
      const elements = [];
      for (const match of this.innerHtml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
        const elementAttributes = attributes(match[1]);
        if (hasClass(elementAttributes, "subject")) {
          elements.push(new TestElement("p", elementAttributes, match[2]));
        }
      }
      return elements;
    }

    if (selector === ".thumb img.search-thumb-img") {
      const elements = [];
      for (const match of this.innerHtml.matchAll(/<img\b([^>]*)>/gi)) {
        const elementAttributes = attributes(match[1]);
        if (hasClass(elementAttributes, "search-thumb-img")) {
          elements.push(new TestElement("img", elementAttributes));
        }
      }
      return elements;
    }

    return [];
  }

  selectFirst(selector) {
    return this.select(selector)[0] || new EmptyElement();
  }
}

class TestDocument {
  constructor(html) {
    this.html = String(html || "");
  }

  select(selector) {
    if (selector === ".ep-empty") {
      return /class\s*=\s*["'][^"']*\bep-empty\b/i.test(this.html)
        ? [new TestElement("div", { class: "ep-empty" })]
        : [];
    }

    if (selector === "div.search-results-grid") {
      return /<div\b[^>]*class\s*=\s*["'][^"']*\bsearch-results-grid\b/i.test(
        this.html,
      )
        ? [new TestElement("div", { class: "search-results-grid" })]
        : [];
    }

    if (selector === 'div.search-results-grid > a.card[href^="/manhwa/"]') {
      const cards = [];
      for (const match of this.html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const elementAttributes = attributes(match[1]);
        if (
          hasClass(elementAttributes, "card") &&
          String(elementAttributes.href || "").startsWith("/manhwa/")
        ) {
          cards.push(new TestElement("a", elementAttributes, match[2]));
        }
      }
      return cards;
    }

    return [];
  }

  selectFirst(selector) {
    return this.select(selector)[0] || new EmptyElement();
  }
}

module.exports = { TestDocument };
