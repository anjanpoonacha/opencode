# Fork Commits on Top of `v1.18.31`

This is a fork of upstream `sst/opencode`. Remotes:

- `upstream` → `sst/opencode` (the source project)
- `origin` → `anomalyco/opencode`
- `fork` → `anjanpoonacha/opencode` (the publish target)

Current branch: `sync/v1.18.31`. There are **3 commits** on top of tag `v1.18.31`
(commit `014614d35b`, which is the direct parent of the first commit below).

```
0bdab98971  sync: merge upstream v1.18.31 with fork features
a3abe00851  fix(ci): pin bun to 1.3.14 to match local
73a07b41c0  release: v1.18.32 — fix bun 1.4.2 bundler crash, fix version string
```

> Note: `0bdab98971` is described as a "merge" but is a **single-parent squashed sync
> commit**, not a real git merge. Its parent is the `v1.18.31` tag exactly.

---

## Commit 1 — `0bdab98971` · sync: merge upstream v1.18.31 with fork features

Rebases the fork's custom features onto upstream `v1.18.31` and re-applies all
fork-only changes. Groups into four intents.

### 1a. TUI subagent chat fix — restore permissions/questions in child sessions

**File:** `packages/tui/src/routes/session/index.tsx`

**Intent:** When viewing a child (subagent) session, its own permission and question
prompts were being hidden because the code returned `[]` for any session with a
`parentID`. Users could not respond to prompts inside a subagent session.

**How:**
- `permissions()` / `questions()`: instead of returning `[]` for child sessions,
  return that session's own entries — `sync.data.permission[route.sessionID]` /
  `sync.data.question[route.sessionID]`. The parent branch still aggregates children.
- `visible()`: dropped the `!session()?.parentID` guard so the input area visibility
  is driven purely by whether there are pending permissions/questions, regardless of
  parent vs child.

### 1b. Sidebar hierarchy — collapsible subagent tree

**New files:**
- `packages/app/src/pages/layout/sidebar-tree-context.ts` — a Solid context
  (`SessionTreeContext` + `useSessionTree`) exposing `allSessions()`, `expanded(id)`,
  and `toggle(id)`, with a safe no-op default when no provider is present.
- `packages/app/src/pages/layout/use-expanded-sessions.ts` — `useExpandedSessions`
  hook managing per-workspace expand/collapse state.

**Changed files:** `helpers.ts`, `sidebar-items.tsx`, `sidebar-workspace.tsx`.

**Intent:** Render sessions as a collapsible tree so a parent session's subagent
(child) sessions nest beneath it, with per-session expand/collapse state persisted
per workspace.

**How:**
- `helpers.ts` adds:
  - `childMapByParent(sessions)` — builds `Map<parentID, childID[]>`.
  - `getChildSessions(sessions, parentID)` — non-archived children of a parent,
    sorted by a recency rule (`sortSessions`): sessions updated within the last
    minute sort to the top (by id), older ones by most-recent-updated.
  - `validateParentIDs(sessions)` — detects orphaned sessions whose `parentID`
    points at a missing session, logging a warning; returns `{ valid, orphaned }`.
  - `workspaceKey(directory)` — normalizes a directory into a stable key
    (backslash → slash, handles Windows drive roots `C:/` and `/`, strips trailing
    slashes). Replaces `pathKey` in `effectiveWorkspaceOrder`.
- `sidebar-items.tsx`:
  - `SessionTreeProvider` wires `useExpandedSessions` into `SessionTreeContext`.
  - `SessionItem` becomes recursive: it computes `childSessions`, `hasChildren`,
    and `expanded`; wraps the row in a `Collapsible`; shows a chevron trigger when
    there are children (and a spacer when none); and renders child `SessionItem`s
    inside `Collapsible.Content` indented with `pl-4`. The old `showChild`/`level`
    flag approach is replaced by real nesting.
- `sidebar-workspace.tsx`:
  - `WorkspaceSessionList` now takes `allSessions` and `directory` props and wraps
    its `<For>` of root sessions in `<SessionTreeProvider>`.
  - `SortableWorkspace` and `LocalWorkspace` pass `allSessions` (the full workspace
    session list) and `directory` down.
  - `active` workspace comparison switches from `pathKey` to `workspaceKey`.

### 1c. Sidebar expansion persistence

**File:** `packages/app/src/pages/layout/use-expanded-sessions.ts`

**Intent:** Remember which sessions a user expanded, scoped per workspace, surviving
reloads, with graceful behavior before persisted storage is ready.

**How:**
- Storage key is derived per directory: `workspace.<first12chars>.<checksum>.expanded-sessions`
  using `checksum` from `@opencode-ai/core/util/encode`.
- Uses `persisted(Persist.global("expanded-sessions", ["expanded-sessions.v1"]), …)`
  backed by a Solid store `Record<string, boolean>` keyed by `<prefix><sessionId>`.
- Before storage is `ready()`, it falls back to an in-memory `local` signal list, then
  `onMount` migrates those local expansions into the persisted store once (guarded by
  a `migrated` signal).

### 1d. Fork rebranding — installation & upgrade target

**File:** `packages/opencode/src/installation/index.ts`

**Intent:** Point version checks and self-upgrade at the fork's npm scope and GitHub
repo (`@anjanpoonacha/opencode`) instead of upstream.

**How:**
- Latest-version check also accepts `detectedMethod === "curl"`, and queries
  `@anjanpoonacha/opencode/latest` on the configured npm registry (instead of
  `opencode-ai/<channel>`).
- GitHub latest-release check hits `anjanpoonacha/opencode` (was `anomalyco/opencode`)
  and strips a `-anjan` suffix from the tag in addition to the leading `v`.
- `upgrade`: `curl` and `npm` cases now both run
  `npm install -g @anjanpoonacha/opencode@<target>`; `pnpm` and `bun` cases use the
  same scoped package. (The dedicated `upgradeCurl` path is removed.)

### 1e. Message page size caps removed

**Files:** `packages/app/src/context/server-session.ts`

**Intent:** Stop truncating initial message history in the web/app client.

**How:** `initialMessagePageSize` raised from `20` to `10000`. (The commit message
also notes upstream `v1.18.31` already removed the separate 100-message limit.)

### 1f. Fork-only CI, E2E tests, and publish script

**New workflow / script files:**
- `.github/workflows/publish-fork.yml` — on push to `release` branch: get version,
  build CLI (macOS ARM64), build desktop app, publish to npm, create a GitHub release.
- `.github/workflows/sync-upstream.yml` — scheduled (Sun & Wed 00:00 UTC) and manual:
  add `upstream` remote, detect upstream version, skip if already synced, sync, push a
  sync branch, open a PR.
- `scripts/publish-fork.ts` — packages the prebuilt `opencode-darwin-arm64` binary into
  a minimal `@anjanpoonacha/opencode` npm package (`os: darwin`, `cpu: arm64`) and runs
  `npm publish --access public`. Normalizes version (strips `v` and `-anjan`).

**New E2E / test harness files** (Playwright-style app E2E + unit tests):
- `packages/app/e2e/{actions,fixtures,selectors,utils}.ts`
- `packages/app/e2e/sidebar/{sidebar,session-expansion-persistence}.spec.ts`
- `packages/app/src/context/global-sync.test.ts`
- `packages/app/src/pages/layout/use-expanded-sessions.test.ts`
- `packages/app/src/testing/{model-selection,terminal}.ts`

**Intent:** Validate the new sidebar tree + expansion-persistence behavior and provide
a reusable app E2E harness, plus automate fork publishing and upstream syncing.

---

## Commit 2 — `a3abe00851` · fix(ci): pin bun to 1.3.14 to match local

**File:** `.github/workflows/publish-fork.yml`

**Intent:** Bun `1.4.2` (installed via `bun-version: latest`) produced a broken binary
due to a bundler regression. Pin CI to the locally-working Bun version.

**How:** Replace all three `bun-version: latest` entries (in the build-cli,
build-desktop, and publish-npm jobs) with `bun-version: 1.3.14`.

---

## Commit 3 — `73a07b41c0` · release: v1.18.32 — fix bundler crash & version string

**Files:** `.github/workflows/publish-fork.yml`, `packages/opencode/package.json`

**Intent:** Cut release `1.18.32` with a correct reported version. Previously the built
binary reported `0.0.0-release-*` because version/channel env vars weren't passed to the
build.

**How:**
- In the "Build CLI (macOS ARM64)" step, add `env:` with
  `OPENCODE_VERSION: ${{ needs.get-version.outputs.version }}` and
  `OPENCODE_CHANNEL: latest`, so the binary embeds the real version.
- Bump `packages/opencode/package.json` version `1.18.31` → `1.18.32`.

---

## Uncommitted — TUI: remove 100-message cap in sync store

> Working-tree change, not yet committed.

**File:** `packages/tui/src/context/sync.tsx`

**Intent:** The TUI dropped messages once a session exceeded 100, so long sessions
lost their earliest history in the terminal UI. Keep the full history.

**How:** Removed all three 100-message caps inside the `SyncProvider` sync store:
- Live `message.updated` handler no longer shifts out the oldest message (and its
  parts) when a session's message array grows past 100; that whole trim block is
  deleted.
- Initial session hydration fetch `sdk.client.session.messages({ sessionID, limit: 100 })`
  raised to `limit: 10000`.
- Hydration reconciliation no longer slices to the last 100: `removed` is now an empty
  array and `visible` is the full `infos` list. The downstream
  `for (const message of removed) delete draft.part[message.id]` cleanup loop is
  retained but now iterates nothing.

Server-side `limit` defaults elsewhere (`server-session.ts` `initialMessagePageSize`
was already raised to `10000` in commit `0bdab98971`, item 1e) are consistent with this.
