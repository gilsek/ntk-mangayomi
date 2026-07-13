# NTK Mangayomi Extension

This workspace contains a JavaScript Mangayomi port of the Tachiyomi `Tachiyomi: NTK` extension.

## What is included

- `NTK Webtoon`
- `NTK Manhwa`
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

It exposes all three sources: `NTK Webtoon`, `NTK Manhwa`, and `NTK Novel`.

Mangayomi keeps manga and novel repository lists separately. Add the same URL
in both lists to make all three entries available.

## Reader support

`NTK Manhwa` normalizes legacy `/manga/...` entries to the live `/manhwa/...` route and uses the NTK image API's browser-session proof flow. It includes a pure JavaScript P-256 signing fallback for Mangayomi's QuickJS runtime, which does not provide WebCrypto.

For native manga-image rendering, use a Mangayomi build that returns WebView
script payloads to JavaScript extensions. The companion source patch is
available at [gilsek/mangayomi:codex/ntk-webview-payload](https://github.com/gilsek/mangayomi/tree/codex/ntk-webview-payload).
It changes only the WebView result bridge; it does not modify NTK's page or
security scripts. A standard 0.7.80 build discards those payloads and cannot
complete this reader fallback.

`NTK Novel` 0.305 is the independent Legacy rebuild. Popular shows all works
ordered by views, Latest shows ongoing works ordered by updates, and title
search plus the observed Legacy Novel filters are available. Work details and
complete chapter lists are loaded from one Legacy detail response. The chapter
parser is qualified with generated 10,000-row lists and keeps linear duplicate
checks. The authenticated text reader keeps one cookie-aware request sequence,
verifies AES-GCM tags in both WebCrypto and pure JavaScript environments, and
sanitizes rendered text or HTML. It does not call unlock or purchase endpoints.
