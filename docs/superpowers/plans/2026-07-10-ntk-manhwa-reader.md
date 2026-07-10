# NTK Manhwa Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NTK manhwa chapters readable in Mangayomi's native reader and rename the source from `NTK Manga` to `NTK Manhwa`.

**Architecture:** Mangayomi will install extension-provided scripts at document start in its headless WebView while retaining the existing load-stop evaluation for compatibility. The NTK extension will intercept successful `/api/manhwa-images` fetch responses before the page consumes them, return the image list through `setResponse`, and keep DOM polling as a fallback.

**Tech Stack:** Flutter/Dart, flutter_inappwebview, JavaScript Mangayomi extensions, Node.js test runner.

## Global Constraints

- Keep existing Webtoon and Novel behavior unchanged.
- Preserve boolean and string WebView return values.
- Use source id `240710002` and rename only its display name.
- Publish the combined filter and manhwa reader update as extension version `0.3.0`.
- Validate on the patched Windows release before any IPA work.

---

### Task 1: Document-start WebView Scripts

**Files:**
- Create: `.ntk-analysis/mangayomi-upstream/lib/services/http/webview_scripts.dart`
- Modify: `.ntk-analysis/mangayomi-upstream/lib/services/http/m_client.dart`
- Test: `.ntk-analysis/mangayomi-upstream/test/services/http/webview_scripts_test.dart`

**Interfaces:**
- Produces: `List<UserScript> createDocumentStartScripts(List<String> scripts)`.
- Each returned script uses `UserScriptInjectionTime.atDocumentStart` in `ContentWorld.PAGE`.

- [ ] Write a test asserting script source, injection time, and content world.
- [ ] Run the test and confirm it fails because the helper is absent.
- [ ] Implement the helper and pass it to `HeadlessInAppWebView.initialUserScripts`.
- [ ] Keep `onLoadStop` evaluation so existing extensions remain compatible.
- [ ] Run targeted Flutter tests and static analysis.

### Task 2: Intercept NTK Image API Responses

**Files:**
- Modify: `javascript/manga/src/ko/ntk.js`
- Test: `tests/ntk.test.js`

**Interfaces:**
- `createWebviewImageExtractorScript()` returns a document-start-safe script.
- The script wraps `window.fetch`, clones matching `/api/manhwa-images` and `/api/webtoon-images` responses, parses JSON, and calls `setResponse` with `{ok:true, images:[...]}`.
- DOM polling remains active as a fallback.

- [ ] Add failing source-level tests for fetch interception, response cloning, image endpoints, and one-time installation.
- [ ] Run `node --test` and confirm the new test fails for the missing interceptor.
- [ ] Implement the minimal fetch interceptor and preserve the existing DOM collector.
- [ ] Prefer the WebView fallback error when it contains better diagnostics than the earlier direct API error.
- [ ] Run the full Node test suite.

### Task 3: Rename and Version the Source

**Files:**
- Modify: `javascript/manga/src/ko/ntk.js`
- Modify: `index.json`
- Test: `tests/ntk.test.js`

**Interfaces:**
- Source id `240710002` is named `NTK Manhwa` in both manifests.
- All three bundled sources use version `0.3.0` because they share one source file.
- Variant detection remains based on `additionalParams=source=manga`, not the display name.

- [ ] Change manifest expectations first and verify the test fails.
- [ ] Update embedded and repository metadata.
- [ ] Run the full Node test suite and manifest consistency tests.

### Task 4: Windows Build and Runtime Validation

**Files:**
- Build artifact: `.ntk-analysis/mangayomi-upstream/build/windows/x64/runner/Release/mangayomi.exe`

**Interfaces:**
- The patched client consumes the published `0.3.0` source.

- [ ] Run Flutter targeted tests and analysis.
- [ ] Build Windows release with NuGet available, `/utf-8`, and the existing bundle install prefix.
- [ ] Publish the extension branch and refresh the repository in Mangayomi.
- [ ] Verify a fresh NTK Manhwa chapter renders native-reader images.
- [ ] Verify fresh NTK Webtoon images, NTK Novel text, and representative filters.
- [ ] Record exact validation evidence and remaining limitations.
