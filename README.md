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

List, search, detail, and chapter parsing are implemented.
Reader image loading implements NTK's current `/api/nv-issue` session and HMAC proof flow for `/api/webtoon-images` and `/api/manhwa-images`.
Live verification still returns `fingerprint_required` outside a browser-like runtime, so the final reader path may need Mangayomi WebView/browser fingerprint support.
This JavaScript port reports that server response clearly instead of silently returning empty pages.
