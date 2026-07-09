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

## Install on iPhone

Add this single repository URL in Mangayomi's extension repository settings:

```text
https://raw.githubusercontent.com/gilsek/ntk-mangayomi/master/index.json
```

It exposes all three sources: `NTK Webtoon`, `NTK Manga`, and `NTK Novel`.

## Reader support

`NTK Manga` normalizes legacy `/manga/...` entries to the live `/manhwa/...` route and uses the NTK image API's browser-session proof flow. It includes a pure JavaScript P-256 signing fallback for Mangayomi's QuickJS runtime, which does not provide WebCrypto.

`NTK Novel` loads and decrypts novel content in the Mangayomi reader. Its Base64URL and AES-GCM fallback code does not depend on Node or browser-only globals.
