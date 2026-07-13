# NTK Webtoon 0.107 final fix report

## Outcome

All requested final-review findings were addressed in the Next Webtoon reader and both Webtoon metadata records. `appMinVerReq` remains `0.5.0`.

## Changes

- Added one-observation image-list stabilization to the generated reader extractor script. It keeps the 200 ms poll interval, requires one identical follow-up observation, resets the candidate when the list changes or becomes invalid, and retains the 100-poll/20-second timeout.
- Hardened reader-link normalization to accept only relative links or absolute links on the configured Next origin. Invalid and cross-origin links now use a fixed error that does not include the supplied URL, query, or fragment.
- Converted WebView evaluation rejections to a fixed reader-path-scoped error without including the original rejection message.
- Documented in both source and repository metadata that the reader requires modified Mangayomi with the WebView payload-preservation patch. The minimum app version was not changed.
- Added VM execution coverage for partial-to-complete stabilization, immediately complete images, interval cleanup, and single response behavior.
- Added coverage for secret-bearing invalid links, cross-origin rejection, secret-bearing WebView rejection, same-origin absolute links, and object WebView payloads.

## TDD evidence

The new reader and metadata tests were run before production changes. Seven tests failed for the expected missing behaviors: extractor stabilization/interval creation, safe invalid-link errors, safe WebView rejection conversion, and the two metadata notes assertions. After the minimal implementation changes, the same 23 targeted tests passed.

## Validation

- Targeted reader and metadata tests: 23 passed, 0 failed.
- All Webtoon tests: 93 passed, 0 failed.
- `git diff --check`: passed (line-ending conversion warnings only; no whitespace errors).

## Scope

Changed only the Next Webtoon source, its index metadata, the related reader/metadata tests, and this report. Existing untracked `node_modules/`, `pnpm-lock.yaml`, and `resource/` were not modified or staged.

## Second critical fix: explicit viewer DOM completion

The public Next viewer bundle contract was rechecked. The reader renders `.vw-imgs` only after leaving loading/failure state with a non-empty page list, and each page maps to exactly one direct child. A child with `e.src` renders `.viewer-lazy-img`; otherwise it remains a placeholder.

The extractor no longer guesses completion from repeated identical URL lists. It now returns immediately only when `.vw-imgs` has at least one direct child and the number of `.viewer-lazy-img` nodes inside that container exactly matches the direct-child count. It continues waiting when the container is absent, counts differ, or any node lacks a valid HTTP(S) URL. DOM order, URL validation, deduplication, explicit viewer-error handling, the 200 ms poll, and the 100-poll/20-second timeout remain intact.

The VM tests were changed first and three tests failed against the stabilization implementation for the expected reasons: a newly complete DOM still waited for another observation, an initially complete DOM did not return immediately, and incomplete/invalid states did not transition according to the explicit container contract. After the implementation change, targeted reader and metadata tests passed 23/23, all Webtoon tests passed 93/93, and `git diff --check` passed with line-ending conversion warnings only.

The reader design and implementation plan now record the `.vw-imgs` direct-child completion signal, safe relative/same-origin URL contract, sanitized WebView rejection behavior, and modified Mangayomi WebView payload-preservation patch requirement.
