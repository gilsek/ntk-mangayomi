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
Reader image loading is partially blocked by NTK's session proof flow.
The Tachiyomi APK handles this with an Android WebView that intercepts `/api/webtoon-images` or related API calls after ad/session acknowledgment.
This JavaScript port detects that state and returns a clear error instead of silently returning empty pages.
