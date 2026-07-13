# Next Manhwa Latest Runtime Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Next Manhwa Latest return the 60 live works under Mangayomi's truthy missing-element DOM semantics and publish version 0.206.

**Architecture:** Add a test-only DOM adapter that preserves the current parser fixture while matching Mangayomi's `selectFirst()` behavior. In production, use `select()` arrays for presence checks so existence is determined by match count rather than JavaScript object truthiness.

**Tech Stack:** JavaScript, Node.js `node:test`, Mangayomi JavaScript extension API

## Global Constraints

- Modify only the Next Manhwa Latest parser, its tests, version metadata, and this task's documents.
- Do not change Webtoon, Novel, reader, filters, detail, episode, or client code.
- Final published version is `0.206`.
- No new dependencies.

---

### Task 1: Reproduce and fix Mangayomi Latest DOM semantics

**Files:**
- Modify: `tests/manhwa/lists/next-latest.test.js`
- Modify: `javascript/manga/src/ko/ntk_manhwa.js:223-281`
- Modify: `tests/manhwa/index-entry.test.js`
- Modify: `index.json`

**Interfaces:**
- Consumes: `Document.select(selector): Element[]`, `Element.select(selector): Element[]`, `getLatestUpdates(page): Promise<{list, hasNextPage}>`
- Produces: `getLatestUpdates(1)` returning the 60 live-shaped works when no empty marker exists

- [ ] **Step 1: Write the failing runtime-compatible test**

Add a test adapter whose missing `selectFirst()` result remains a truthy object with empty text/attributes and empty selections. Run the existing 60-card fixture through this adapter and assert `result.list.length === 60`.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `pnpm exec node --test tests/manhwa/lists/next-latest.test.js`

Expected: FAIL because `getLatestUpdates(1)` returns an empty list before parsing cards.

- [ ] **Step 3: Implement count-based presence checks**

Use `document.select("main.container.manhwa-updates")`, `container.select("div.board-empty > div.t")`, and `container.select("ul.upd-grid")`. Reject missing or duplicate structural containers, return empty only for a non-empty empty-marker selection, and parse the first validated grid.

- [ ] **Step 4: Publish version 0.206**

Change the embedded `mangayomiSources` version and the matching `index.json` entry from `0.205` to `0.206`; update only the corresponding version assertions.

- [ ] **Step 5: Verify GREEN and regressions**

Run:

```powershell
pnpm exec node --test tests/manhwa/lists/next-latest.test.js
pnpm exec node --test 'tests/manhwa/**/*.test.js'
pnpm test
node --check javascript/manga/src/ko/ntk_manhwa.js
git diff --check
```

Expected: all commands exit 0 with zero test failures.

- [ ] **Step 6: Commit and deploy**

Commit only the planned files with `fix: parse manhwa latest in client runtime`, push `master`, then confirm GitHub raw metadata returns version `0.206`.

