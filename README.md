# NTK Mangayomi Extension

This workspace contains a JavaScript Mangayomi port of the Tachiyomi `Tachiyomi: NTK` extension.

## What is included

- `NTK Webtoon`
- `NTK Manga`
- Shared JavaScript implementation in `javascript/manga/src/ko/ntk.js`
- Mangayomi repository metadata in `index.json` and `repo.json`
- Local Node tests in `tests/ntk.test.js`

## Validation

Run:

```powershell
npm test
```

The tests verify:

- URL construction for both source variants.
- HTML detail parsing from selectors recovered from the APK.
- Chapter parsing.
- API list parsing for the live `works` response shape.
- Reader bootstrap token detection.
- Reader image API HMAC proof generation.
- Repository manifest consistency.

## Publishing for iPhone

Mangayomi needs `index.json` and `sourceCodeUrl` to be reachable over HTTP(S).
Before adding this repository on iPhone, publish the files somewhere reachable, then replace the placeholder `sourceCodeUrl` values in `index.json`:

```text
https://raw.githubusercontent.com/local/ntk-mangayomi/main/javascript/manga/src/ko/ntk.js
```

with the real raw URL.

## Current limitation

List, search, detail, chapter parsing, and native reader image loading are implemented for `NTK Webtoon`.
Reader image loading follows NTK's current `/api/nv-issue` session and HMAC proof flow and sends browser-like same-origin headers for the image API request.
Version `0.1.9` was verified in Mangayomi v0.7.80 against `https://newtoki1.org` with `NTK Webtoon`; the native reader displayed chapter images.

`NTK Manga` shares the same parser but uses the live Manatoki detail route `/manhwa/{sourceWorkId}`. The old `/manga/{sourceWorkId}` path returns a maintenance page on `newtoki1.org`; cached URLs from older extension versions are normalized to `/manhwa/{sourceWorkId}` before detail and reader requests.
