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
    .replace(/<!--[\s\S]*?-->/g, "")
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

function containerContents(html, tagName, className) {
  const tags = Array.from(
    html.matchAll(new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi")),
  );
  const startIndex = tags.findIndex(
    (match) => !match[0].startsWith("</") && hasClass(match[0], className),
  );
  if (startIndex < 0) return "";

  let depth = 0;
  for (let index = startIndex; index < tags.length; index += 1) {
    if (tags[index][0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(
          tags[startIndex].index + tags[startIndex][0].length,
          tags[index].index,
        );
      }
    } else {
      depth += 1;
    }
  }
  return "";
}

class TestElement {
  constructor(html = "", openTag = "") {
    this.html = html;
    this.openTag = openTag;
  }

  attr(name) {
    return readAttribute(this.openTag, name);
  }

  get getSrc() {
    return this.attr("src") || this.attr("data-src");
  }

  get text() {
    return stripTags(this.html);
  }
}

function elements(html, selector) {
  const results = [];
  let container = html;
  let tagName;
  let className;

  if (selector === "section.hero-v2") {
    tagName = "section";
    className = "hero-v2";
  } else if (selector === "h1.hero-v2-title") {
    tagName = "h1";
    className = "hero-v2-title";
  } else if (selector === "p.hero-v2-desc") {
    tagName = "p";
    className = "hero-v2-desc";
  } else if (selector === "span.pill-status") {
    tagName = "span";
    className = "pill-status";
  } else if (selector === ".hero-v2-thumb img") {
    container = containerContents(html, "div", "hero-v2-thumb");
    tagName = "img";
  } else if (selector === ".hero-v2-author a") {
    container = containerContents(html, "div", "hero-v2-author");
    tagName = "a";
  } else if (selector === ".hero-v2-tags a.hero-v2-tag") {
    container = containerContents(html, "div", "hero-v2-tags");
    tagName = "a";
    className = "hero-v2-tag";
  } else {
    return results;
  }

  const isVoid = tagName === "img";
  const pattern = isVoid
    ? new RegExp(`<${tagName}\\b[^>]*>`, "gi")
    : new RegExp(`(<${tagName}\\b[^>]*>)([\\s\\S]*?)<\\/${tagName}>`, "gi");
  for (const match of container.matchAll(pattern)) {
    const openTag = isVoid ? match[0] : match[1];
    if (className && !hasClass(openTag, className)) continue;
    results.push(new TestElement(match[0], openTag));
  }
  return results;
}

class DetailTestDocument {
  constructor(html) {
    this.html = html;
  }

  select(selector) {
    return elements(this.html, selector);
  }

  selectFirst(selector) {
    return this.select(selector)[0] ?? new TestElement();
  }
}

module.exports = { DetailTestDocument };
