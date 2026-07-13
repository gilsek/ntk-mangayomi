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
  "novel",
  "src",
  "ko",
  "ntk_novel.js",
);

class EmptyElement {
  attr() {
    return "";
  }

  get text() {
    return "";
  }

  select() {
    return [];
  }

  selectFirst() {
    return null;
  }
}

class EmptyDocument extends EmptyElement {}

function loadNovelSource({
  preferences = {},
  responses,
  DocumentClass = EmptyDocument,
  SetClass = Set,
} = {}) {
  assert.ok(fs.existsSync(sourcePath), "ntk_novel.js must exist");
  const requests = [];

  class TestClient {
    async get(url, headers = {}) {
      const request = { method: "GET", url, headers };
      requests.push(request);
      const index = requests.length - 1;

      if (typeof responses === "function") {
        return responses(url, headers, index, request);
      }
      if (Array.isArray(responses)) return responses[index];
      return {
        body: "",
        headers: { "content-type": "text/html; charset=utf-8" },
        statusCode: 200,
      };
    }
  }

  class TestPreferences {
    get(key) {
      return preferences[key] ?? "";
    }
  }

  let context;
  class TestProvider {
    get source() {
      return context.__sources[0];
    }
  }

  context = vm.createContext({
    Client: TestClient,
    Document: DocumentClass,
    MProvider: TestProvider,
    Set: SetClass,
    SharedPreferences: TestPreferences,
    console,
  });

  const code = fs.readFileSync(sourcePath, "utf8");
  vm.runInContext(
    `${code}\n;globalThis.__DefaultExtension = DefaultExtension; globalThis.__sources = mangayomiSources; globalThis.__novelTest = NOVEL_TEST_EXPORTS;`,
    context,
    { filename: sourcePath },
  );

  return {
    extension: new context.__DefaultExtension(),
    helpers: context.__novelTest,
    requests,
    sources: JSON.parse(JSON.stringify(context.__sources)),
  };
}

module.exports = { loadNovelSource };
