# Next Webtoon Reader Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next Webtoon 회차의 이미지 API 응답을 DOM 렌더링 전에 추출해 첫 화면 대기 시간을 줄인다.

**Architecture:** 기존 `createNextReaderImageExtractorScript()` 안에 문서 시작용 광고 확인 신호와 `fetch` 응답 관찰기를 추가한다. API 빠른 경로는 기존 `respond()`를 재사용하며, 실패하거나 적용되지 않으면 현재 DOM 수집기가 그대로 동작한다.

**Tech Stack:** Mangayomi JavaScript source API, Flutter InAppWebView JavaScript bridge, Node.js `node:test`/`vm`.

## Global Constraints

- 릴리스 버전은 `0.109`다.
- 실제 이미지 파일은 Mangayomi 리더가 페이지별로 요청한다.
- 직접 세션/proof 생성이나 직접 이미지 API 호출을 추가하지 않는다.
- 기존 DOM 완전성 조건과 20초 timeout을 유지한다.
- Legacy Webtoon, Manhwa, Novel, Anime 코드는 변경하지 않는다.
- 새 패키지 의존성을 추가하지 않는다.

---

### Task 1: API fast-path contract

**Files:**
- Modify: `tests/webtoon/next-reader.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`

**Interfaces:**
- Consumes: `createNextReaderImageExtractorScript(readerPath)` and `window.fetch`.
- Produces: `{ok: true, images: string[]}` through `window.flutter_inappwebview.callHandler("setResponse", payload)`.

- [ ] **Step 1: Write failing extractor tests**

Add VM tests that provide a fake `fetch`, `CustomEvent`, `dispatchEvent`, and response `clone().text()`. Assert that `/api/webtoon-images` with `{images:[{src:"https://cdn/1.webp"}]}` responds before an interval tick, while unrelated or malformed responses leave the DOM fallback active. Assert the current path is stored in `window.__ntk_ad_ack_scope` and announced with `ntk-ad-ack-ready`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/webtoon/next-reader.test.js`

Expected: the new tests fail because the extractor does not wrap `fetch` or signal ad acknowledgement.

- [ ] **Step 3: Implement the minimal fast path**

Inside the existing extractor, add a `signalAdAck()` helper and wrap `window.fetch`. Clone only matching image API responses, normalize string entries or `entry.src`, preserve order, remove duplicates, and call the existing `respond()` only for a non-empty valid list. Keep the current `collect()` and timer unchanged as fallback.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/webtoon/next-reader.test.js`

Expected: all reader tests pass.

- [ ] **Step 5: Remove repeated page header lookup**

In `getPageList()`, calculate `const headers = this.getHeaders()` once after payload validation and reuse that object for every returned page.

- [ ] **Step 6: Run Webtoon regression tests**

Run: `node --test tests/webtoon/*.test.js`

Expected: all Webtoon tests pass.

### Task 2: Release metadata 0.109

**Files:**
- Modify: `tests/webtoon/index-entry.test.js`
- Modify: `tests/webtoon/next-popular-request.test.js`
- Modify: `tests/ntk.test.js`
- Modify: `javascript/manga/src/ko/ntk_webtoon.js`
- Modify: `index.json`

**Interfaces:**
- Consumes: completed fast-path reader.
- Produces: repository and embedded metadata at version `0.109`.

- [ ] **Step 1: Change metadata assertions first**

Update the three version expectations from `0.108` to `0.109` and require notes to mention the API-intercept reader fast path.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/webtoon/index-entry.test.js tests/webtoon/next-popular-request.test.js tests/ntk.test.js`

Expected: metadata tests fail against `0.108`.

- [ ] **Step 3: Update source and index metadata**

Set both metadata copies to `0.109` and describe the Next reader API fast path with DOM fallback without changing source ID or `appMinVerReq`.

- [ ] **Step 4: Verify GREEN**

Run the selected metadata command again and expect all tests to pass.

### Task 3: Final verification and publication

**Files:**
- Verify: all tracked files

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: a tested `master` release through the existing raw GitHub URLs.

- [ ] **Step 1: Run complete validation**

Run: `pnpm test`

Expected: every test passes without uncaught warnings.

- [ ] **Step 2: Check diff integrity**

Run: `git diff --check` and inspect `git status --short` without touching the pre-existing `node_modules/`, `pnpm-lock.yaml`, or `resource/` entries.

- [ ] **Step 3: Commit and push master**

Commit the focused reader/release changes with a short purpose-specific message and run `git push origin master` without force.

- [ ] **Step 4: Verify publication**

Confirm the raw `index.json` and `ntk_webtoon.js` both return HTTP 200 and contain version `0.109`.

- [ ] **Step 5: Device validation**

Refresh the source in Mangayomi and compare first-open latency on Windows and iPhone. Confirm page count/order and a second chapter transition.
