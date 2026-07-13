# Next Webtoon Latest 및 제목 검색 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NTK Webtoon Source `260713001`에 독립된 Next Latest HTML 파서와 Webtoon 전용 제목 검색 파서를 추가하고 버전을 `0.102`로 배포한다.

**Architecture:** Latest는 `/ing?page=N`, 검색은 `/search?q=...&field=title&match=contains`의 서버 HTML을 각각 전용 함수로 처리한다. Popular, Latest, 검색과 Legacy는 dispatcher에서만 만나며 카드 선택자와 오류 fallback을 공유하지 않는다. 검색은 통합 결과에서 `/webtoon/` 카드만 남기고 첫 페이지만 요청한다.

**Tech Stack:** Mangayomi JavaScript extension API, Node.js `node:test`, VM 기반 최소 HTML harness, pnpm, Git.

## Global Constraints

- 기본 Next 도메인은 숫자 설정 `9`로 만든 `https://sbxh9.com`이다.
- Source ID는 `260713001`, 버전은 정확히 `0.102`, `isNsfw`는 `true`다.
- Next Latest, Next 검색, Next Popular과 Legacy 파서는 선택자와 카드 파싱 함수를 공유하지 않는다.
- Next 필터, 작품 상세, 회차와 이미지는 이 계획에서 구현하지 않는다.
- 로컬 `resource/`와 과거 `ntk.js`를 구현 입력으로 사용하지 않는다.
- 새 의존성을 추가하지 않는다.
- 사용자가 만든 미추적 `resource/`, `node_modules/`, `pnpm-lock.yaml`을 스테이징하거나 삭제하지 않는다.

---

## 파일 구조

- Create `tests/webtoon/fixtures/next-latest-page.html`: Next Latest 일반 페이지 최소 fixture.
- Create `tests/webtoon/fixtures/next-latest-last-page.html`: Next Latest 마지막 페이지 최소 fixture.
- Create `tests/webtoon/fixtures/next-latest-empty-page.html`: Next Latest 범위 밖 중앙 정렬 빈 결과 fixture.
- Create `tests/webtoon/fixtures/next-search-title.html`: Webtoon과 다른 종류가 섞인 검색 최소 fixture.
- Create `tests/webtoon/next-latest-request.test.js`: Latest URL, 탭 노출과 요청 경계.
- Create `tests/webtoon/next-latest-parser.test.js`: Latest 카드, 페이지와 오류 계약.
- Create `tests/webtoon/next-search-request.test.js`: 검색 URL, 빈 검색어와 2페이지 경계.
- Create `tests/webtoon/next-search-parser.test.js`: 통합 검색에서 Webtoon 분리와 오류 계약.
- Modify `tests/webtoon/helpers/load-webtoon-source.js`: 위 fixture에 필요한 선택자만 테스트 DOM에 추가.
- Modify `javascript/manga/src/ko/ntk_webtoon.js`: Next Latest와 검색 전용 요청·파서·dispatcher 구현.
- Modify `tests/webtoon/next-popular-request.test.js`: 미구현 오류 기대를 제거하고 필터만 미구현 상태로 검증.
- Modify `tests/webtoon/index-entry.test.js`: `0.102`와 notes 계약 검증.
- Modify `tests/ntk.test.js`: 저장소 manifest 기대 버전을 `0.102`로 변경.
- Modify `index.json`: Webtoon `0.102`와 구현 범위 notes 반영.
- Modify `docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md`: Latest·검색 완료 체크포인트 기록.

---

### Task 1: Next Latest 요청과 파서

**Files:**
- Create: `tests/webtoon/fixtures/next-latest-page.html`
- Create: `tests/webtoon/fixtures/next-latest-last-page.html`
- Create: `tests/webtoon/fixtures/next-latest-empty-page.html`
- Create: `tests/webtoon/next-latest-request.test.js`
- Create: `tests/webtoon/next-latest-parser.test.js`
- Modify: `tests/webtoon/helpers/load-webtoon-source.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`
- Modify: `tests/webtoon/next-popular-request.test.js`

**Interfaces:**
- Consumes: `getNextBaseUrl()`, `getHeaders()`, `toAbsoluteUrl(value)`.
- Produces: `buildNextLatestUrl(page)`, `parseNextLatestCard(element, requestUrl)`, `hasNextLatestPage(document)`, `parseNextLatestResponse(response, requestUrl)`, `fetchNextLatest(page)`, Next 분기가 추가된 `getLatestUpdates(page)`.

- [ ] **Step 1: 최소 Latest fixture와 harness 선택자를 추가한다**

`next-latest-page.html`에는 다음 형태의 카드 두 개와 enabled 다음 버튼을 둔다.

```html
<main class="container">
  <div class="card-grid">
    <a class="card" href="/webtoon/850661">
      <div class="thumb">
        <img src="https://apihost.store/platforms/naver.png" class="platform-icon" alt="">
        <img src="https://cdn.example/850661.jpg" alt="뻐꾸기는 운다">
      </div>
      <div class="info"><p class="subject">뻐꾸기는 운다</p></div>
    </a>
    <a class="card" href="/webtoon/u-no-cover">
      <div class="thumb"><img src="/platforms/etc.png" class="platform-icon" alt=""></div>
      <div class="info"><p class="subject">표지 없는 최신작</p></div>
    </a>
  </div>
  <nav class="pager"><span class="pager-num is-active">1</span><button aria-label="다음 10페이지">›</button></nav>
</main>
```

`next-latest-last-page.html`에는 정상 카드 한 개, pager 밖의 enabled Daum 플랫폼 버튼과 `<nav class="pager">` 안의 `<button aria-label="다음 10페이지" disabled>`를 둔다. `next-latest-empty-page.html`에는 `main.container`의 직접 자식 `<div style="padding:60px 0;text-align:center;color:var(--muted)">결과가 없습니다</div>`와 disabled pager를 둔다.

`matchingElements`와 `TestDocument.select`에 정확히 다음 선택자만 지원한다.

```js
"div.card-grid > a.card[href^=\"/webtoon/\"]"
"p.subject"
".thumb img:not(.platform-icon)"
"div.card-grid"
".ep-empty"
"main.container > div[style*=\"text-align:center\"]"
"nav.pager button[aria-label^=\"다음\"]:not([disabled])"
```

카드 컨테이너 안의 직접 자식 `a.card`를 DOM 순서로 반환하고, 표지 선택자는 `platform-icon` 클래스가 없는 `img`만 반환한다. 버튼 선택자는 `nav.pager` 안에서 `aria-label`이 `다음`으로 시작하고 `disabled` 속성이 없는 태그만 반환한다. 중앙 정렬 빈 표식은 `main.container`의 직접 자식 div로 제한한다.

- [ ] **Step 2: Latest 실패 테스트를 작성한다**

`next-latest-request.test.js`에 다음 계약을 작성한다.

```js
test("exposes Latest for the Next family", () => {
  const { extension } = loadWebtoonSource();
  assert.equal(extension.supportsLatest, true);
});

test("requests the numbered Next latest page", async () => {
  const { extension, requests } = loadWebtoonSource({ body: fixture });
  await extension.getLatestUpdates(2);
  const url = new URL(requests[0].url);
  assert.equal(url.origin, "https://sbxh9.com");
  assert.equal(url.pathname, "/ing");
  assert.equal(url.searchParams.get("page"), "2");
});
```

`next-latest-parser.test.js`에는 다음을 각각 독립 테스트로 작성한다.

```js
test("parses Next latest cards without using the platform icon", async () => {
  const result = plain(await loadWebtoonSource({ body: pageFixture }).extension.getLatestUpdates(1));
  assert.deepEqual(result, {
    list: [
      { name: "뻐꾸기는 운다", link: "/webtoon/850661", imageUrl: "https://cdn.example/850661.jpg" },
      { name: "표지 없는 최신작", link: "/webtoon/u-no-cover", imageUrl: "" },
    ],
    hasNextPage: true,
  });
});
```

추가 테스트는 pager 밖의 enabled Daum 플랫폼 버튼과 disabled 다음 버튼 조합의 `false`, `.ep-empty` 및 중앙 정렬 `결과가 없습니다`의 정상 빈 결과, `card-grid` 누락, 카드 제목 누락, 유효한 `/webtoon/` 카드가 없는 Latest 구조, HTTP 403과 JSON Content-Type 오류를 검증한다.

- [ ] **Step 3: Latest RED를 확인한다**

Run:

```powershell
node --test tests/webtoon/next-latest-request.test.js tests/webtoon/next-latest-parser.test.js
```

Expected: `supportsLatest`가 `false`이고 `getLatestUpdates`가 `Next Webtoon latest is not implemented`를 던져 실패한다. Harness 문법 오류나 fixture 읽기 오류로 실패하면 테스트를 고친 뒤 같은 기능 부재 실패를 다시 확인한다.

- [ ] **Step 4: Next Latest 최소 구현을 추가한다**

`ntk_webtoon.js`에 다음 dispatcher와 URL을 추가한다.

```js
get supportsLatest() {
  return true;
}

buildNextLatestUrl(page) {
  return `${this.getNextBaseUrl()}/ing?page=${encodeURIComponent(String(page))}`;
}

async getLatestUpdates(page) {
  if (this.getParserFamily() === "next") return this.fetchNextLatest(page);
  return this.fetchLegacyList({ mode: "latest", page });
}
```

`parseNextLatestCard`는 `p.subject`, 카드 루트 `href`, `.thumb img:not(.platform-icon)`을 사용해 `{ name, link, imageUrl }`을 반환한다. `hasNextLatestPage`는 enabled 다음 버튼의 존재 여부만 반환한다.

`parseNextLatestResponse`는 HTTP와 HTML Content-Type을 검증한 뒤 다음 순서로 처리한다.

```js
const document = new Document(response.body);
if (document.select(".ep-empty").length > 0) {
  return { list: [], hasNextPage: false };
}
const centeredEmpty = document.select('main.container > div[style*="text-align:center"]');
if (centeredEmpty.length > 0 && (centeredEmpty[0].text || "").trim() === "결과가 없습니다") {
  return { list: [], hasNextPage: false };
}
if (document.select("div.card-grid").length === 0) {
  throw new Error(`Next Webtoon latest structure error parserFamily=next url=${requestUrl} missing=div.card-grid,.ep-empty,centered empty marker`);
}
const cards = document.select('div.card-grid > a.card[href^="/webtoon/"]');
if (cards.length === 0) {
  throw new Error(`Next Webtoon latest structure error parserFamily=next url=${requestUrl} missing=latest cards`);
}
return {
  list: cards.map((element) => this.parseNextLatestCard(element, requestUrl)),
  hasNextPage: this.hasNextLatestPage(document),
};
```

`fetchNextLatest(page)`는 URL을 만들고 `Client.get` 후 위 파서만 호출한다.

`next-popular-request.test.js`의 미구현 기능 테스트는 Next 필터가 여전히 `[]`인지만 검증하도록 바꾸고 Latest·검색 오류 기대는 각 전용 테스트로 이동한다.

- [ ] **Step 5: Latest GREEN과 Webtoon 회귀 테스트를 확인한다**

Run:

```powershell
node --test tests/webtoon/next-latest-request.test.js tests/webtoon/next-latest-parser.test.js
node --test tests/webtoon/*.test.js
git diff --check
```

Expected: 새 Latest 테스트와 기존 Webtoon 테스트가 모두 통과하고 `git diff --check`가 exit 0이다.

- [ ] **Step 6: Latest 단위를 커밋한다**

```powershell
git add -- javascript/manga/src/ko/ntk_webtoon.js tests/webtoon/helpers/load-webtoon-source.js tests/webtoon/fixtures/next-latest-page.html tests/webtoon/fixtures/next-latest-last-page.html tests/webtoon/fixtures/next-latest-empty-page.html tests/webtoon/next-latest-request.test.js tests/webtoon/next-latest-parser.test.js tests/webtoon/next-popular-request.test.js
git commit -m "feat: add next webtoon latest"
```

---

### Task 2: Next 제목 검색

**Files:**
- Create: `tests/webtoon/fixtures/next-search-title.html`
- Create: `tests/webtoon/next-search-request.test.js`
- Create: `tests/webtoon/next-search-parser.test.js`
- Modify: `tests/webtoon/helpers/load-webtoon-source.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`

**Interfaces:**
- Consumes: `getNextBaseUrl()`, `getHeaders()`, `toAbsoluteUrl(value)`.
- Produces: `buildNextSearchUrl(query)`, `parseNextSearchCard(element, requestUrl)`, `parseNextSearchResponse(response, requestUrl)`, `fetchNextSearch(query)`, Next 분기가 추가된 `search(query, page, filters)`.

- [ ] **Step 1: 혼합 검색 fixture와 harness 선택자를 추가한다**

`next-search-title.html`의 `div.card-grid.search-results-grid` 안에 다음 순서로 카드를 둔다.

```html
<a class="card" href="/manhwa/8893"><div class="info"><p class="subject">만화 결과</p></div></a>
<a class="card" href="/webtoon/850661"><div class="thumb"><img class="platform-icon" src="/naver.png"><img class="search-thumb-img" src="/covers/850661.jpg"></div><div class="info"><p class="subject">뻐꾸기는 운다</p></div></a>
<a class="card" href="/novel/123"><div class="info"><p class="subject">소설 결과</p></div></a>
<a class="card" href="/webtoon/u-no-cover"><div class="info"><p class="subject">웹툰 표지 없음</p></div></a>
<a class="card" href="/anime/3217"><div class="info"><p class="subject">애니 결과</p></div></a>
```

Harness에 다음 선택자를 추가한다.

```js
"div.search-results-grid"
"div.search-results-grid > a.card[href^=\"/webtoon/\"]"
```

검색 카드 선택자는 다른 종류 링크를 반환하지 않는다. 카드 내부 `p.subject`와 `.thumb img:not(.platform-icon)`은 Task 1 지원을 재사용하되 제품 파서 함수는 공유하지 않는다.

- [ ] **Step 2: 검색 실패 테스트를 작성한다**

`next-search-request.test.js`:

```js
test("requests a contains title search on the Next site", async () => {
  const { extension, requests } = loadWebtoonSource({ body: fixture });
  await extension.search(" 뻐꾸기 ", 1, []);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("q"), "뻐꾸기");
  assert.equal(url.searchParams.get("field"), "title");
  assert.equal(url.searchParams.get("match"), "contains");
});

test("does not request an empty title or a second search page", async () => {
  for (const [query, page] of [["   ", 1], ["뻐꾸기", 2]]) {
    const { extension, requests } = loadWebtoonSource();
    assert.deepEqual(plain(await extension.search(query, page, [])), { list: [], hasNextPage: false });
    assert.equal(requests.length, 0);
  }
});
```

`next-search-parser.test.js`는 혼합 fixture에서 Webtoon 두 개만 DOM 순서로 반환하고 `hasNextPage=false`인지 검증한다. 추가 테스트는 검색 컨테이너가 있으나 Webtoon 카드가 없는 정상 빈 결과, `.ep-empty` 정상 빈 결과, 컨테이너 누락, 선택된 Webtoon 카드의 제목 누락, HTTP 403과 JSON Content-Type을 각각 검증한다. `/webtoon/` 형태가 아닌 링크는 다른 콘텐츠와 동일하게 선택 단계에서 제외한다.

- [ ] **Step 3: 검색 RED를 확인한다**

Run:

```powershell
node --test tests/webtoon/next-search-request.test.js tests/webtoon/next-search-parser.test.js
```

Expected: `Next Webtoon search is not implemented` 오류로 실패한다.

- [ ] **Step 4: Next 검색 최소 구현을 추가한다**

```js
buildNextSearchUrl(query) {
  const parameters = [];
  this.appendParameter(parameters, "q", query.trim());
  this.appendParameter(parameters, "field", "title");
  this.appendParameter(parameters, "match", "contains");
  return `${this.getNextBaseUrl()}/search?${parameters.join("&")}`;
}

async search(query, page, filters) {
  if (this.getParserFamily() === "next") {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || page > 1) return { list: [], hasNextPage: false };
    return this.fetchNextSearch(normalizedQuery);
  }
  // 기존 Legacy 한 글자 및 fetchLegacyList 동작을 그대로 유지한다.
}
```

`parseNextSearchCard`는 `p.subject`, 루트 `href`, `.thumb img:not(.platform-icon)`으로 독립 파싱한다.

`parseNextSearchResponse`는 HTTP와 HTML을 검증한 뒤 `.ep-empty`면 정상 빈 목록을 반환한다. `div.search-results-grid`가 없으면 구조 오류를 던진다. 컨테이너가 있으면 `div.search-results-grid > a.card[href^="/webtoon/"]`만 파싱하며 0개여도 정상 빈 Webtoon 결과로 반환한다. `hasNextPage`는 항상 `false`다.

- [ ] **Step 5: 검색 GREEN과 Webtoon 회귀 테스트를 확인한다**

```powershell
node --test tests/webtoon/next-search-request.test.js tests/webtoon/next-search-parser.test.js
node --test tests/webtoon/*.test.js
git diff --check
```

Expected: 새 검색 테스트와 기존 Webtoon 테스트가 모두 통과한다.

- [ ] **Step 6: 검색 단위를 커밋한다**

```powershell
git add -- javascript/manga/src/ko/ntk_webtoon.js tests/webtoon/helpers/load-webtoon-source.js tests/webtoon/fixtures/next-search-title.html tests/webtoon/next-search-request.test.js tests/webtoon/next-search-parser.test.js
git commit -m "feat: add next webtoon title search"
```

---

### Task 3: `0.102` 메타데이터와 로드맵

**Files:**
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`
- Modify: `index.json`
- Modify: `tests/webtoon/index-entry.test.js`
- Modify: `tests/webtoon/next-popular-request.test.js`
- Modify: `tests/ntk.test.js`
- Modify: `docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md`

**Interfaces:**
- Consumes: 구현된 Next Popular, Latest와 검색 동작.
- Produces: 원격 저장소와 내장 source가 일치하는 `0.102` manifest 및 다음 작업 기준.

- [ ] **Step 1: 메타데이터 실패 테스트를 먼저 바꾼다**

`index-entry.test.js`와 `next-popular-request.test.js`에서 Webtoon 버전 기대를 `0.102`로 바꾼다. notes는 다음 의미를 검증한다.

```js
assert.match(webtoon.notes, /Popular.*Latest.*title search/i);
assert.match(webtoon.notes, /filters.*detail.*reader.*not implemented/i);
```

`tests/ntk.test.js`의 manifest 버전 배열 첫 값을 `0.102`로 바꾼다.

- [ ] **Step 2: 메타데이터 RED를 확인한다**

```powershell
node --test tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/ntk.test.js
```

Expected: 실제 manifest가 아직 `0.101`이고 notes가 Popular-only이므로 실패한다.

- [ ] **Step 3: 내장 source와 index를 `0.102`로 맞춘다**

두 위치에 정확히 다음 값을 사용한다.

```js
version: "0.102",
notes: "Next Popular, Latest, and title search preview; filters, detail, and reader are not implemented.",
```

`index.json`은 같은 문자열을 JSON 필드로 기록한다. Manhwa와 Novel 엔트리는 수정하지 않는다.

- [ ] **Step 4: 로드맵 체크포인트를 기록한다**

로드맵의 현재 체크포인트 뒤에 다음 사실을 추가한다.

- `0.102`에 Next Latest `/ing?page=N`과 제목 검색을 구현했다.
- 검색은 통합 결과에서 Webtoon만 반환하며 한 페이지만 요청한다.
- 다음 구현 단계는 Next 전체 필터 계약 직접 추출이다.
- 상세·회차·이미지는 필터 검증 뒤 별도 계약으로 진행한다.

- [ ] **Step 5: 메타데이터 GREEN을 확인하고 커밋한다**

```powershell
node --test tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/ntk.test.js
git diff --check
git add -- index.json javascript/manga/src/ko/ntk_webtoon.js tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/ntk.test.js docs/superpowers/plans/2026-07-13-ntk-mangayomi-development-roadmap.md
git commit -m "chore: release next webtoon 0.102"
```

---

### Task 4: 전체 및 실사이트 검증과 게시

**Files:**
- Verify only: 저장소 전체 tracked files

**Interfaces:**
- Consumes: Tasks 1~3의 커밋.
- Produces: 검증된 feature 브랜치와 Mangayomi에서 새로고침 가능한 원격 `master`.

- [ ] **Step 1: 전체 테스트를 새로 실행한다**

```powershell
pnpm test
git diff --check
git status --short
```

Expected: 전체 테스트 0 failures. `git status`에는 기존 미추적 `node_modules/`, `pnpm-lock.yaml`만 남고 tracked 변경은 없다.

- [ ] **Step 2: 실사이트 Latest smoke test를 수행한다**

브라우저형 UA와 `Referer: https://sbxh9.com/`로 다음을 메모리에서만 요청한다.

```text
https://sbxh9.com/ing?page=1
https://sbxh9.com/ing?page=2
https://sbxh9.com/ing?page=182
https://sbxh9.com/ing?page=183
```

Expected: HTTP 200과 HTML Content-Type, 1·2페이지 42개, 서로 다른 첫 작품, 182페이지 1개 이상과 pager의 disabled 다음 버튼, 183페이지는 중앙 정렬 `결과가 없습니다` 표식.

- [ ] **Step 3: 실사이트 검색 smoke test를 수행한다**

```text
https://sbxh9.com/search?q=%EB%BB%90%EA%BE%B8%EA%B8%B0&field=title&match=contains
https://sbxh9.com/search?q=%EC%97%86%EB%8A%94%EC%A0%9C%EB%AA%A9_codex_260713&field=title&match=contains
```

Expected: 첫 요청은 `/webtoon/` 결과가 1개 이상, 두 번째 요청은 `.ep-empty`와 0개 Webtoon 결과다.

- [ ] **Step 4: feature 브랜치 상태를 검토한다**

```powershell
git log --oneline master..HEAD
git diff --stat master...HEAD
git status --short
```

Expected: 설계, Latest, 검색과 `0.102` 커밋만 포함되고 사용자 미추적 파일은 스테이징되지 않았다.

- [ ] **Step 5: 승인된 master 게시 흐름을 수행한다**

메인 작업공간에서 사용자 미추적 파일을 보존한 채 fast-forward만 허용한다.

```powershell
git merge --ff-only codex/next-webtoon-latest-search
pnpm test
git fetch origin master
git rev-list --left-right --count origin/master...master
git push origin master
```

Expected: 병합 후 테스트 0 failures, fetch 직후 원격 뒤처짐 0, push 성공. 원격 변경 때문에 fast-forward가 불가능하면 push하지 않고 상태를 보고한다.

- [ ] **Step 6: raw GitHub 배포물을 확인한다**

다음 raw URL을 cache-busting query와 함께 요청한다.

```text
https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/index.json
https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/javascript/manga/src/ko/ntk_webtoon.js
```

Expected: ID `260713001`, 버전 `0.102`, Base URL `https://sbxh9.com`, Latest `/ing`, 검색 `/search`, `field=title`, `match=contains`가 존재한다.

- [ ] **Step 7: 수동 테스트 범위를 인계한다**

Mangayomi 저장소 URL은 다음을 그대로 사용한다.

```text
https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/index.json
```

사용자 확인 항목은 Latest 탭 노출, 1·2페이지 이동, 한글 제목 일부 검색, 다른 콘텐츠 종류 미노출과 빈 검색 결과다. 이 확인 전에는 필터 구현으로 넘어가지 않는다.

### Task 5: Mangayomi 섬네일 선택자 호환성 수정 (`0.103`)

**Files:**
- Modify: `tests/webtoon/helpers/load-webtoon-source.js`
- Modify: `tests/webtoon/next-latest-parser.test.js`
- Modify: `tests/webtoon/next-search-parser.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`
- Modify: `index.json`
- Modify: `tests/webtoon/index-entry.test.js`
- Modify: `tests/webtoon/next-popular-request.test.js`
- Modify: `tests/ntk.test.js`

**Interfaces:**
- Consumes: 기존 `parseNextLatestCard`와 `parseNextSearchCard`의 `{ name, link, imageUrl }` 반환 계약.
- Produces: Mangayomi 런타임에서 플랫폼 로고를 표지로 선택하지 않는 `0.103` source와 index.

- [ ] **Step 1: 실제 런타임 불일치를 재현하는 실패 테스트를 만든다**

테스트 DOM 하네스에서 `.thumb img:not(.platform-icon)`을 Mangayomi 런타임처럼 첫 이미지로 처리하고, `.thumb img` 및 `.thumb img.search-thumb-img`를 지원한다. 기존 Latest와 검색 fixture는 플랫폼 로고가 표지보다 먼저 나오므로 현재 제품 코드의 `imageUrl` 검증이 플랫폼 로고 URL을 받아 실패해야 한다.

- [ ] **Step 2: Latest와 검색 집중 테스트의 RED를 확인한다**

```powershell
node --test tests/webtoon/next-latest-parser.test.js tests/webtoon/next-search-parser.test.js
```

Expected: Latest와 검색의 표지 URL assertion이 실제 표지 대신 플랫폼 로고를 받아 실패한다.

- [ ] **Step 3: 두 파서를 독립적으로 최소 수정한다**

Latest는 `.thumb img`를 순회하면서 `class` 토큰에 `platform-icon`이 없는 첫 이미지를 선택한다. 검색은 사이트가 제공하는 `.thumb img.search-thumb-img`를 직접 선택한다. 두 카드 파서 사이에 공통 파서를 새로 만들지 않는다.

- [ ] **Step 4: `0.103` 메타데이터와 회귀 검증을 갱신한다**

내장 source, `index.json`, manifest 기대값을 모두 `0.103`으로 맞춘 뒤 집중 테스트, Webtoon 전체 테스트, `pnpm test`, `git diff --check`를 실행한다.

- [ ] **Step 5: 검증된 변경을 게시한다**

추적 대상 파일만 커밋하고 `master`에 fast-forward 병합한 뒤 전체 테스트를 다시 실행한다. 원격 `master`를 fetch해 분기 여부를 확인하고 push 후 raw `index.json`이 `0.103`을 반환하는지 확인한다.
