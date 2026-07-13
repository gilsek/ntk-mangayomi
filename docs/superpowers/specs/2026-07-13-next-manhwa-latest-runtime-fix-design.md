# Next Manhwa Latest Runtime Fix Design

## Problem

`/manhwa/updates` returns 60 works, but `getLatestUpdates(1)` returns an empty list in Mangayomi. Mangayomi's JavaScript DOM bridge returns a truthy `Element` handle from `selectFirst()` even when no matching element exists. The extension currently treats that handle as proof that `div.board-empty > div.t` exists and returns before parsing cards.

The Node test DOM returns `null` for a missing `selectFirst()` match, so the existing test does not reproduce the client runtime contract.

## Scope

- Reproduce Mangayomi's truthy missing-element behavior in one Latest regression test.
- Replace Latest container, empty-marker, and grid presence checks with `select()` result-length checks.
- Preserve `/manhwa/updates`, the fixed one-page policy, card order, cover selection, and all other source behavior.
- Publish the patch as version `0.206` in both embedded metadata and `index.json`.
- Do not modify the Mangayomi client, Webtoon/Novel sources, dependencies, or reader behavior.

## Data Flow

1. Request `https://sbxh{number}.com/manhwa/updates`.
2. Require exactly one non-empty Latest container selection.
3. Return an empty result only when the empty-marker selection length is greater than zero.
4. Require a grid selection, then parse every `li.upd-card` in DOM order.

## Validation

- The new runtime-compatible test must fail before the source change by receiving zero works instead of 60.
- Latest focused tests, all Manhwa tests, and the full repository suite must pass after the fix.
- `node --check`, `git diff --check`, live `/manhwa/updates`, and GitHub raw `0.206` metadata must pass before completion.

