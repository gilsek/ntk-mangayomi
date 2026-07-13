const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function decodeText(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function parseCompoundSelector(selector) {
  const match = selector.match(/^([a-z][a-z0-9-]*)?((?:\.[a-z0-9_-]+)*)$/i);
  if (!match) throw new Error(`Unsupported test selector: ${selector}`);
  return {
    tag: match[1]?.toLowerCase() ?? "",
    classes: match[2].split(".").filter(Boolean),
  };
}

function parseSelector(selector) {
  const tokens = selector.match(/>|[^\s>]+/g) ?? [];
  const compounds = [];
  const combinators = [];
  for (const token of tokens) {
    if (token === ">") {
      combinators[compounds.length - 1] = ">";
    } else {
      if (compounds.length > 0 && !combinators[compounds.length - 1]) {
        combinators[compounds.length - 1] = " ";
      }
      compounds.push(parseCompoundSelector(token));
    }
  }
  return { compounds, combinators };
}

function matchesCompound(node, compound) {
  if (compound.tag && node.tag !== compound.tag) return false;
  const classes = new Set((node.attributes.class ?? "").split(/\s+/).filter(Boolean));
  return compound.classes.every((className) => classes.has(className));
}

function matchesSelector(node, parsed, index = parsed.compounds.length - 1) {
  if (index < 0 || !matchesCompound(node, parsed.compounds[index])) return false;
  if (index === 0) return true;

  if (parsed.combinators[index - 1] === ">") {
    return Boolean(node.parent && matchesSelector(node.parent, parsed, index - 1));
  }

  for (let parent = node.parent; parent; parent = parent.parent) {
    if (matchesSelector(parent, parsed, index - 1)) return true;
  }
  return false;
}

class TestElement {
  constructor(tag, attributes = {}, parent = null) {
    this.tag = tag;
    this.attributes = attributes;
    this.parent = parent;
    this.children = [];
  }

  attr(name) {
    return this.attributes[String(name).toLowerCase()] ?? "";
  }

  get text() {
    return decodeText(
      this.children
        .map((child) => (typeof child === "string" ? child : child.text))
        .join(" "),
    );
  }

  select(selector) {
    const parsed = parseSelector(selector);
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (typeof child === "string") continue;
        if (matchesSelector(child, parsed)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  selectFirst(selector) {
    return this.select(selector)[0] ?? null;
  }
}

class TestDocument extends TestElement {
  constructor(html) {
    super("#document");
    const stack = [this];
    const tokens = String(html).match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g) ?? [];

    for (const token of tokens) {
      if (token.startsWith("<!--") || token.startsWith("<!")) continue;
      if (!token.startsWith("<")) {
        stack.at(-1).children.push(token);
        continue;
      }
      if (token.startsWith("</")) {
        const closingTag = token.slice(2, -1).trim().toLowerCase();
        while (stack.length > 1) {
          const node = stack.pop();
          if (node.tag === closingTag) break;
        }
        continue;
      }

      const opening = token.match(/^<\s*([a-z][a-z0-9-]*)([\s\S]*?)\/?\s*>$/i);
      if (!opening) continue;
      const tag = opening[1].toLowerCase();
      const parent = stack.at(-1);
      const node = new TestElement(tag, parseAttributes(opening[2]), parent);
      parent.children.push(node);
      if (!token.endsWith("/>") && !VOID_TAGS.has(tag)) stack.push(node);
    }
  }
}

module.exports = { TestDocument };
