# Legacy Novel Selective Port Design

**Status:** Approved design

**Goal:** Build an independent Mangayomi `NTK Novel` source for the Legacy
`newtoki{number}.org` family by selectively porting the working pre-split Novel
implementation, proving historical behavior first, and then adapting only the
parts that differ from the current site contract.

## 1. Provenance Boundary

The Webtoon Legacy/Next split starts at commit `52154c3` (`feat: add legacy
webtoon listing`). Commit `b3d79a2` is the last allowed pre-split reference.

Allowed historical inputs:

- `javascript/manga/src/ko/ntk.js` as it exists at `b3d79a2`
- the pre-split Novel tests in `tests/ntk.test.js`
- Novel-related commits from `8132997` through `b3d79a2`
- pre-split locally saved Novel HTML and EPUB analysis, when their provenance
  matches the behavior being tested

Explicitly excluded:

- the recently discarded Novel `0.305` implementation lineage
- APK-derived claims about Novel behavior; the inspected NTK v1.4.3 APK only
  proves Manga/Webtoon behavior
- Webtoon, Manhwa, or Anime parsers as Novel fallbacks

The current `ntk.js` is byte-identical to its `b3d79a2` version, so no Git
recovery is required. It remains a read-only migration source during this work.

## 2. Considered Approaches

### Whole-file copy and deletion

Copy all of `ntk.js`, then remove Webtoon and Manhwa code. This is initially
fast but preserves the shared variant dispatcher, mixed parser behavior, and
unsafe reader fallback. It makes it difficult to prove that unrelated behavior
was removed.

### Selective copy with differential tests — selected

Copy bounded Novel-relevant functions into a new source and run the same inputs
against the old and new implementations. Historical equivalence is established
before current-site changes are introduced. This is the chosen approach.

### Clean rewrite using old code only as documentation

This gives the cleanest implementation but discards behavior that was already
working and repeats previous investigation. It remains the fallback only for a
function whose dependencies cannot be separated safely.

## 3. Source and File Boundaries

New implementation:

- `javascript/novel/src/ko/ntk_novel.js`
- `tests/novel/helpers/`
- `tests/novel/lists/`
- `tests/novel/search/`
- `tests/novel/detail/`
- `tests/novel/chapters/`
- `tests/novel/reader/`
- fixed fixtures under `tests/novel/fixtures/`

The source file keeps independent regions for:

- core URL, response, encoding, and filter utilities
- Legacy list parsing
- Legacy title search and filters
- Legacy detail parsing
- Legacy chapter parsing
- Novel text reader transport, proof, decryption, and rendering

List, detail, chapter, and reader parsers do not call parsers belonging to the
other content layers. Only small pure utilities may be shared inside the Novel
source.

The old `ntk.js` is not deleted. Once `0.301` is released, only the public Novel
manifest entry moves to the new file and ID.

## 4. Port Classification

### Copy first and preserve behavior

- filter object constructors and filter value readers
- URL joining and encoding helpers that are independent of `VARIANTS`
- response-header and cookie merge helpers
- Base64URL and UTF-8 conversion helpers
- `unshuffleParagraphs`
- `escapeHtml`
- the text and `text-shuffled` branches of Novel body rendering
- HMAC proof generation, subject to reference-vector tests
- one persistent `Client` per extension instance

These functions receive differential tests before refactoring. Cleanup is only
allowed after equivalence is proven.

### Copy as a historical baseline, then harden

- the request order represented by the old `getHtmlContent()`
- viewer-data extraction
- canary, challenge, observation, session issue, and content requests
- Novel payload key derivation and AES-GCM decryption
- HTML payload rendering

The copied baseline is not automatically releasable. Current-site contract
tests must prove every required field and request. The old unauthenticated
`aesGcmCtrDecryptNoAuth` fallback cannot ship. Target runtimes must either use a
verified authenticated AES-GCM implementation or fail safely without returning
plaintext. HTML payloads must be sanitized before release.

No speculative session cache or automatic unlock is added during equivalence
work. Those behaviors require separate evidence from the current contract.

### Do not copy

- `mangayomiSources` entries for the three mixed content types
- `VARIANTS`, `parseAdditionalParams`, and mixed source dispatch
- `createNtkSource()` as a whole
- mixed list, detail, and chapter parsers
- image API and WebView reader code
- P-256 image-request signing code unless a current Novel endpoint proves it is
  required
- shared full-URL BaseURL preferences
- response summaries that can include response bodies or sensitive values

## 5. Historical Equivalence Gate

Before current-site adaptation:

1. Create a Novel-only VM loader without publishing the source.
2. Copy the approved function groups without behavioral cleanup.
3. Port the existing Novel fixtures and regression cases.
4. Add differential tests that feed the same input to old and new functions.
5. Require identical output for filters, URL encoding, paragraph order,
   escaping, line breaks, Base64URL decoding, and HMAC vectors.
6. Record every intentional difference before changing the implementation.

This gate does not modify `index.json` and has no public version number.

## 6. Functional Stages and Versions

### `0.301` — Source shell, Popular, and Latest

- New source ID: `260713003`
- `itemType: 2`
- `isManga: false`
- `isNsfw: true`
- `additionalParams: ""`
- numeric Legacy domain preference: `newtoki{number}.org`
- Popular: all statuses, view-descending order
- Latest: ongoing only, update-descending order
- Novel-only cards, covers, empty state, and pagination

The `index.json` entry moves from old ID `240710003` to the new source only when
this stage is installable and its tests pass.

### `0.302` — Title search and filters

- non-empty trimmed title always takes priority
- filters apply only when the title is empty
- status, initial character, platform, sort, genre, and author filters
- whitelist validation and deterministic query encoding

### `0.303` — Detail and complete chapter list

- title, cover, author, genre, status, and description
- only `/novel/{workId}/{episodeId}` chapter links
- complete chapter list from the single Legacy detail HTML response
- server DOM order preserved
- malformed, duplicate, truncated, or partial chapter data fails the request
  instead of returning a partial success

### `0.304` — Large-chapter correctness and performance

- generated 10,000-row fixtures
- missing chapter numbers remain valid
- duplicate IDs, invalid ownership, and truncated structures fail explicitly
- parsing stays linear in the number of rows
- performance is compared with the `0.303` baseline instead of using an
  arbitrary hard-coded deadline
- no extension-side background crawl, permanent cache, or client modification

### `0.305` — Novel text reader

- current viewer-data contract validation
- verified request sequence and cookie continuity
- HMAC proof and authenticated AES-GCM decryption
- text, shuffled-text, and sanitized HTML body rendering
- line-break and paragraph preservation
- locked chapters return a clear error and never purchase or unlock content
- error messages never expose cookies, tokens, sessions, proof values, payloads,
  or full response bodies

## 7. Response and Error Rules

- HTTP failure, wrong content type, missing structure, explicit empty state, and
  malformed items are distinct outcomes.
- A broken page is never converted to an empty successful result.
- A partially parsed chapter list is never returned as success.
- Error messages may contain the endpoint category, HTTP status, and a stable
  server error code. They may not contain volatile credentials or raw bodies.
- Unknown filter values fall back to the documented default and are not sent.
- Locked Novel content is read-only; no automatic purchase or unlock endpoint
  is called.

## 8. Test Strategy

Every stage follows:

1. write failing stage-specific tests
2. implement the smallest stage behavior
3. run the stage tests
4. run all repository tests
5. run `node --check` on the source
6. run `git diff --check`
7. verify embedded metadata and `index.json` equivalence
8. complete an independent code review
9. commit and push the stage to `master`
10. let the user validate the published source in Mangayomi

Tests use fixed sanitized fixtures and deterministic mock responses. Live
requests may be used to investigate a contract, but they are not the only
release gate and secrets are never written to fixtures or logs.

The assistant does not operate the user's real device, browser session, or ADB
environment without separate explicit permission.

## 9. Git and Release Policy

- No pull request is required; this repository's `master` is the release line.
- Each of `0.301` through `0.305` is a separate meaningful commit and push.
- A stage is not pushed until its validation and review gates pass.
- `index.json` and embedded metadata are updated together at each public stage.
- Notes describe only functions that actually work in that version.
- The old mixed source remains available until its other responsibilities are
  retired under separate approval.
- The discarded Novel `0.305` lineage is never cherry-picked, copied, or used as
  a test oracle.

## 10. Superseded Plan

`docs/superpowers/plans/2026-07-13-legacy-novel-agent-implementation.md` is not
execution-ready because it forbids copying the pre-split Novel implementation
and contains assumptions rejected during this design review. A new
implementation plan must replace it before code work begins.
