# NTK Mangayomi Extension Design

## Goal

Convert the Tachiyomi NTK Android extension into a Mangayomi source extension usable on iPhone by reimplementing the source logic as JavaScript and publishing it through a local Mangayomi repository manifest.

## Source APK Findings

The inspected APK is `Tachiyomi: NTK` version `1.4.3`, package `eu.kanade.tachiyomi.extension.ko.ntk`.
Its manifest declares `tachiyomi.extension.class=.NTKFactory` and `tachiyomi.extension.nsfw=1`.
The factory creates two Tachiyomi sources:

- `NTK Webtoon`, backed by the `webtoon` kind.
- `NTK Manga`, backed by the `manhwa` kind.

The extension builds its active domain as `https://sbxh{number}.com`.
The APK currently defaults the domain number to `4` after migration logic, while current public reports indicate newer domains may use later numbers.
The Mangayomi implementation must keep this value configurable instead of hardcoding it as an immutable constant.

## Scope

Build a JavaScript Mangayomi extension repository with:

- A shared NTK implementation module.
- A first working `NTK Webtoon` source.
- A second `NTK Manga` source using the same shared implementation.
- A repository index file for adding the sources to Mangayomi.
- Node-based static checks for URL construction, JSON parsing, and HTML selector parsing.

This project does not convert the APK binary, run Android code on iOS, or depend on Tachiyomi runtime APIs.

## Architecture

The implementation will be plain JavaScript so Mangayomi can fetch and execute it on iPhone.
One source file will define a small NTK client factory that takes source-specific options such as name, id, kind, list endpoint, and route prefixes.
Two exported source objects will be generated from that factory.

The local repository will mirror Mangayomi extension repository conventions:

- `javascript/manga/src/ko/ntk.js` contains the source implementation.
- `index.json` lists both sources.
- `repo.json` identifies the repository.
- `tests/` contains local static tests that run without Mangayomi.

## Data Flow

### Popular and Latest Lists

`NTK Webtoon` uses `/api/works`.
`NTK Manga` uses `/api/manhwa-list`.
Requests include:

- `status=ongoing`
- `sort=views` for popular lists
- `page={page}`
- `pageSize=49`
- `withTotal=1`

The response parser must accept common shapes seen in API responses, including arrays at the root or under keys such as `data`, `works`, `items`, and `list`.

### Search

Search should call `/search` with `q={query}` and `kind={webtoon|manhwa}` when a query exists.
For filter-only browsing, it should call the API list endpoint with supported parameters such as `status`, `sort`, `cat`, `day`, or `tag` when available.
The first implementation will keep filters minimal and focus on query search plus popular/latest browsing.

### Details

Details are parsed from HTML using selectors recovered from the APK:

- Title: `h1.hero-v2-title`
- Author: `div.hero-v2-author a`
- Description: `p.hero-v2-desc`
- Thumbnail: `div.hero-v2-thumb img`
- Status: `span.pill-status`
- Genres: `a.hero-v2-tag`

Status text containing `연재중` maps to ongoing.
Status text containing `완결` maps to completed.

### Chapters

Chapters are parsed from HTML using selectors recovered from the APK:

- Row: `ul.ep-list-v2 > li.ep-row-v2`
- URL: `a.ep-row-v2-link[href]`
- Name: `div.ep-row-v2-title strong`
- Date: `span.ep-row-v2-date`
- Paid/locked marker: `span.ep-price-badge`

Locked rows are not removed, but their display name should make the lock visible when Mangayomi supports it.

### Pages

The APK requests page images through an API response containing an `images` array.
The JavaScript implementation must try the likely image API endpoint for the source kind and chapter path, then parse strings or objects containing `url`, `src`, `image`, or `imageUrl`.

If the response contains `ad_ack_required`, the source should throw a clear error explaining that the site session needs to be refreshed in a browser.
This is the main known iPhone risk because the Tachiyomi APK contains WebView-based session refresh logic that cannot be copied directly into a Mangayomi JavaScript source without verifying Mangayomi's WebView capabilities.

## Error Handling

Network and parsing errors should include the current source name and URL.
Empty image responses should throw `Failed to load images, please retry`.
Ad acknowledgment responses should throw `Ad acknowledgment required - open the site in a browser to refresh your session, then retry`.

## Validation

Local validation must prove:

- The repository JSON files are valid.
- Both source entries point to the local `ntk.js` source URL.
- URL builders produce the expected API URLs.
- HTML parsers extract details and chapters from sample markup.
- Page image parser handles string arrays, object arrays, and `ad_ack_required`.

Runtime validation in Mangayomi remains a manual device step because this workspace does not include a running Mangayomi app or iPhone simulator.

## Deliverables

- `javascript/manga/src/ko/ntk.js`
- `index.json`
- `repo.json`
- `tests/ntk.test.js`
- `package.json`
- `docs/superpowers/specs/2026-07-10-ntk-mangayomi-extension-design.md`
- `docs/superpowers/plans/2026-07-10-ntk-mangayomi-extension.md`
