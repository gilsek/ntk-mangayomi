# Legacy Novel 0.302–0.305 Implementation Plan

**Goal:** Extend the independent Legacy-family `NTK Novel` source from the
published `0.301` list baseline through title search and filters, complete
detail/chapter loading, ten-thousand-chapter correctness and performance, and
the authenticated text reader.

**Execution policy:** Implement one public version at a time. Each version gets
failing tests, the smallest implementation, a full repository regression run,
metadata alignment, review, one meaningful commit, and a direct `master` push
before work starts on the next version.

## 1. Fixed provenance and safety boundaries

- The current baseline is commit `40e9db6`, `NTK Novel 0.301`.
- Historical Novel code may be read only from commit `b3d79a2` or earlier.
- The recently discarded Novel `0.305` lineage remains excluded from code,
  fixtures, expected values, and test oracles.
- `javascript/manga/src/ko/ntk.js` is an allowed read-only migration source
  because it is byte-identical to the `b3d79a2` version.
- Webtoon, Manhwa, and Anime parsers are not Novel fallbacks.
- The user's browser, real device, ADB state, and Mangayomi database are not
  operated by this plan.
- `node_modules/`, `pnpm-lock.yaml`, and `resource/` remain untouched.

## 2. Current Legacy contract observations

The following was observed anonymously from `https://newtoki1.org` on
2026-07-14. No tokens, cookies, payloads, or response bodies are retained.

### Search and filters

The Novel list form uses these query fields:

- title: `stx`
- author: `author`
- initial: `jaum`
- publication status: `pub`
- genre: `tag`
- platform: `plat`
- sort: `sst`
- fixed discriminator: `kind=novel`
- fixed direction: `sod=desc`
- page: `page`

Observed allowlists:

- initial: empty, `ㄱ`, `ㄴ`, `ㄷ`, `ㄹ`, `ㅁ`, `ㅂ`, `ㅅ`, `ㅇ`, `ㅈ`,
  `ㅊ`, `ㅋ`, `ㅌ`, `ㅍ`, `ㅎ`, `a-z`, `0-9`
- status: `all`, `ongoing`, `completed`
- genre: empty, `판타지`, `무협`, `19금`, `현대`, `로맨스`,
  `로맨스 판타지`, `BL`, `라노벨`, `기타`
- platform: empty, `user`, `novelpia`, `booktoki`, `munpia`, `joara`,
  `kakaopage`, `series`, `ridi`, `etc`
- sort: `as_update`, `as_new`, `as_bookmark`, `as_view`, `as_rating`,
  `as_episode`

The form requires at least two title characters. A non-empty trimmed title is
still the routing priority: a one-character title returns an empty page without
applying filters, while a title of two or more characters uses a fixed
all-status title search and ignores filter state.

### Detail and chapters

`/novel/60079` returned one HTML response of about 7 MB containing 9,772
`li.list-item` chapter rows for a work whose latest displayed number was
10,028. This proves both of the following:

- the complete Legacy chapter list is delivered in the detail HTML;
- chapter numbers are not a safe count or contiguous-index source.

Each observed row contains a numeric ownership-preserving link of the form
`/novel/{workId}/{episodeId}`, an `a.item-subject` title, and an optional
`.wr-date`. Detail metadata is exposed through Legacy `theme-detail-*` and
`view-img` markup. A missing cover is valid.

### Reader

`/novel/{workId}/{episodeId}` exposes
`script#theme-novel-viewer-data`. Observed field names include `novelId`,
`episodeId`, `token`, `paidGate`, `scopePath`, and `unlockApiPath`.

The allowed pre-split request sequence was executed anonymously against the
current reader and produced decrypted rendered HTML. This proves the endpoint
sequence remains compatible, but it does not prove the old QuickJS fallback is
safe. The old fallback decrypts AES-GCM without authenticating the tag and must
not be copied.

## 3. Version 0.302 — title search and filters

### Files

- Modify: `javascript/novel/src/ko/ntk_novel.js`
- Create: `tests/novel/search/legacy-title-search.test.js`
- Create: `tests/novel/filters/legacy-filter-model.test.js`
- Create: `tests/novel/filters/legacy-filter-request.test.js`
- Create: `tests/novel/filters/legacy-filter-response.test.js`
- Create sanitized fixtures under `tests/novel/fixtures/search/` and
  `tests/novel/fixtures/filters/`
- Modify: `tests/novel/index-entry.test.js`
- Modify: `tests/ntk.test.js`
- Modify: `index.json`
- Modify: `README.md`

### Test-first behavior

1. Freeze the filter order as author, initial, status, genre, platform, sort.
2. Freeze every observed label/value pair above.
3. Verify invalid filter indexes, values, and object shapes are omitted or use
   the documented default; they are never serialized from caller input.
4. Verify a trimmed title of two or more characters ignores all filters and
   sends `kind=novel`, `stx`, `pub=all`, `sst=as_update`, `sod=desc`, and page.
5. Verify an empty title serializes only allowlisted filter values.
6. Verify a one-character title does not request the server and does not fall
   through to filters.
7. Reuse the Novel list card parser only; do not introduce a shared cross-layer
   parser.
8. Determine the next page by an exact semantic match to the request contract,
   not by row count or a generic right-arrow link.
9. Keep HTTP failure, non-HTML response, missing structure, explicit empty
   state, and malformed selected cards distinct.

### Implementation boundary

Add a dedicated `NOVEL_SEARCH_FILTER_METHODS` region. Small pure filter
constructors and readers may be copied from the allowed historical source after
differential tests. Search and filter request construction must be current-site
specific.

### Release

- embedded version and `index.json`: `0.302`
- notes: Popular, Latest, title search, and filters implemented; detail,
  chapters, and reader not implemented
- commit: `feat: add legacy novel search filters`
- push: `origin/master`

## 4. Version 0.303 — detail and complete chapter list

### Files

- Modify: `javascript/novel/src/ko/ntk_novel.js`
- Create: `tests/novel/historical/pre-split-detail-utilities.test.js`
- Create: `tests/novel/detail/legacy-detail.test.js`
- Create: `tests/novel/chapters/legacy-complete-chapters.test.js`
- Create sanitized fixtures under `tests/novel/fixtures/detail/` and
  `tests/novel/fixtures/chapters/`
- Modify release metadata and README files

### Historical equivalence gate

Copy only the bounded pure helpers required by the Novel Legacy detail path:

- HTML entity decoding and text stripping
- attribute and match helpers
- status mapping
- Legacy detail metadata extraction
- Legacy chapter row extraction
- Korean short-date conversion

Before hardening, differential tests feed the same sanitized historical HTML to
the allowed old and new functions. Intentional current-contract differences are
then tested separately.

### Current-contract behavior

1. Normalize and validate only `/novel/{numericWorkId}` before requesting.
2. Require a successful HTML response and a non-empty Legacy detail title.
3. Return `name`, canonical `link`, optional `imageUrl`, optional description,
   author/artist, deduplicated genre array, status, and chapters.
4. Parse every selected chapter row; never silently filter a malformed row.
5. Accept only `/novel/{sameWorkId}/{numericEpisodeId}`.
6. Reject cross-work links, duplicate episode IDs, missing titles, malformed
   dates, and missing/truncated chapter structures as a whole-request failure.
7. Preserve server DOM order exactly.
8. Treat chapter numbers as display text only. Gaps and non-contiguous numbers
   are valid.
9. Preserve locked state in display metadata, but do not call any unlock or
   purchase endpoint.

### Release

- version: `0.303`
- notes: detail and complete single-response chapter lists implemented; large
  chapter performance qualification and reader still pending
- commit: `feat: add legacy novel detail chapters`
- push: `origin/master`

## 5. Version 0.304 — ten-thousand-chapter correctness and performance

### Files

- Modify only the Novel detail/chapter region when measurements justify it
- Create: `tests/novel/chapters/legacy-large-chapters.test.js`
- Create: `tests/novel/performance/legacy-chapter-benchmark.test.js`
- Create a test-only frozen `0.303` parser baseline if an optimized parser is
  introduced
- Modify release metadata and README files

### Qualification behavior

1. Generate 10,000 sanitized chapter rows in memory; do not commit a multi-MB
   fixture.
2. Verify exact count, first item, middle item, last item, and DOM order.
3. Verify gaps in displayed chapter numbers do not remove rows.
4. Verify duplicate IDs, invalid ownership, missing title/link, and a truncated
   closing structure fail explicitly.
5. Keep duplicate detection O(n) with a `Set`; do not use repeated array scans.
6. Compare the candidate parser with the frozen `0.303` baseline in the same
   process. Use relative comparison and operation/count evidence, not a brittle
   absolute millisecond deadline.
7. Do not add background crawling, extension-side permanent caching, or a
   Mangayomi client change.

If the `0.303` parser is already linear and the candidate does not improve it,
retain the smaller implementation and publish the verified large-list contract
without speculative optimization.

### Release

- version: `0.304`
- notes: complete chapter lists qualified for ten-thousand-row works; reader
  still pending
- commit: `perf: qualify large legacy novel chapters`
- push: `origin/master`

## 6. Version 0.305 — authenticated Novel text reader

### Files

- Modify: `javascript/novel/src/ko/ntk_novel.js`
- Extend the Novel VM loader with deterministic GET/POST mocks and injectable
  crypto/runtime capabilities
- Create: `tests/novel/historical/pre-split-reader-utilities.test.js`
- Create: `tests/novel/reader/legacy-reader-sequence.test.js`
- Create: `tests/novel/reader/legacy-reader-errors.test.js`
- Create: `tests/novel/reader/aes-gcm-auth.test.js`
- Create: `tests/novel/reader/render-content.test.js`
- Create sanitized fixtures under `tests/novel/fixtures/reader/`
- Modify release metadata and README files

### Pure utility equivalence

Differentially freeze the allowed old behavior for:

- response-header and cookie merging
- Base64URL encode/decode
- UTF-8 conversion
- HMAC-SHA256 proof vectors
- paragraph unshuffling
- plain-text escaping and line-break preservation

Do not copy the old response-body summaries, mixed image reader, browser key
registration, or unauthenticated AES-GCM fallback.

### Reader link and viewer-data validation

1. Accept only a relative or same-origin
   `/novel/{numericWorkId}/{numericEpisodeId}` link.
2. Validate `novelId`, `episodeId`, `token`, and `scopePath` without echoing
   their values on failure.
3. Require viewer ownership to match the normalized reader link.
4. If `paidGate` indicates locked content, return a stable locked-chapter error.
5. Never call `unlockApiPath`, purchase endpoints, or mutation endpoints.

### Verified request sequence

Use one persistent client and explicit cookie continuity:

1. GET the reader page.
2. POST `/api/ad/canary`.
3. POST `/api/ad/challenge` with `force=false`.
4. If supplied, POST the same-origin observation batch endpoint using only the
   required number of observed impression URLs.
5. POST `/api/nv-issue`.
6. Build an HMAC proof and POST `/api/novel-content`.
7. On a 403 with only the observed acknowledgement error codes, run one forced
   challenge and retry content once.
8. Reject every other error without retry loops.

### Authenticated decryption

1. Use WebCrypto AES-GCM when available.
2. For QuickJS, implement pure JavaScript AES-GCM with GHASH and constant-time
   tag comparison.
3. Validate against standard AES-GCM vectors and a deterministic payload vector
   matching the Novel key derivation.
4. Flip ciphertext and tag bits in tests and require rejection.
5. Never return plaintext before authentication succeeds.

### Rendering and sanitization

- `text`: escape content, preserve paragraph and line breaks.
- `text-shuffled`: validate the permutation, restore order, then render as
  escaped text.
- `html`: remove script/style/iframe/object/embed/form and similar active
  blocks, canonicalize a small allowlist of structural text tags without
  attributes, and preserve line breaks.
- unknown or malformed payload kinds fail safely.

Errors may contain the feature category, HTTP status, and stable server error
code. They may not contain cookies, session values, viewer tokens, nonces,
proofs, encrypted payloads, decrypted text, full URLs with credentials, or raw
response bodies.

### Release

- version: `0.305`
- notes: Legacy lists, search, filters, detail, ten-thousand-row chapter lists,
  and authenticated text reader implemented
- commit: `feat: add authenticated legacy novel reader`
- push: `origin/master`

## 7. Validation gate for every public version

Run the smallest stage tests first, then:

```powershell
npm test
node --check javascript/novel/src/ko/ntk_novel.js
git diff --check
```

Before committing:

- inspect `git status --short`;
- stage only planned project files;
- run `git diff --cached --check`;
- verify embedded Novel metadata exactly matches `index.json`;
- verify notes claim only implemented behavior;
- review error strings for credential or body exposure.

After pushing:

- verify `HEAD` equals `origin/master`;
- verify GitHub raw `index.json` and `ntk_novel.js` expose the intended version;
- update the existing Obsidian worknote session;
- do not claim real-device success until the user tests Mangayomi.
