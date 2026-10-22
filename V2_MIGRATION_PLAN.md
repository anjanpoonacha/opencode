# Migration Plan: Fork Features → opencode v2

## Decisions (locked)

1. **Keep publishing the fork** to npm (`@anjanpoonacha/opencode`) → F5 + F6 in scope.
2. **TUI-only.** Drop web `app` and `desktop` → **F3 and F4 are out of scope.**
3. **Pin to `v2.1.3`.**

### Confirmed v2.1.3 reconnaissance

| Feature | v2.1.3 status | Action |
|---|---|---|
| **F1** subagent chat fix | **Present & needed.** Same `if (session()?.parentID) return []` pattern at `packages/tui/src/routes/session/index.tsx:203` (`permissions`) and `:207`; child sessions still return `[]`. Now uses `data.session.permission.list(sessionID)` API. | **Re-implement** |
| **F2** no 100-message cap | **Obsolete.** v2 rewrote the TUI message store; no 100-cap exists anywhere in `packages/tui/src/context/*` or `mini/*`. | **Drop (nothing to do)** |
| **F3** initial page-size cap | web/app only | **Out of scope** |
| **F4** sidebar subagent tree | web/app only | **Out of scope** |
| **F5** fork rebrand (install/upgrade) | install logic moved to `packages/cli/src/services/updater.ts`; CLI pkg is now `@opencode/cli` v2.1.3; `bin/` + `script/{build,publish}.ts` | **Re-implement** |
| **F6** fork CI/publish | v2 has its own `scripts/publish.ts`, `publish-homebrew.ts`, `publish-aur.ts`, `verify-artifact.ts`; fork workflows need porting | **Re-implement/adapt** |

**Net real work: F1 (small TUI patch) + F5/F6 (fork publish pipeline on v2's new layout).**
F2/F3/F4 require no work.

---

## Situation

- Current fork sits on `sync/v1.18.31` (tag `v1.18.31` + 3 commits + 1 uncommitted change).
- Upstream latest is **v2.1.3**. Between `v1.18.31` and `v2.1.3` there are **5002 commits** —
  v2.0 is a ground-up restructure, not an incremental release.
- Most files the fork touched are **gone or moved** in v2:

  | Fork-touched file (v1) | v2.1.3 status |
  |---|---|
  | `packages/tui/src/routes/session/index.tsx` | **exists** (heavily changed) |
  | `packages/tui/src/context/sync.tsx` | gone (context dir restructured) |
  | `packages/opencode/src/installation/index.ts` | gone (`opencode` pkg split into `cli`/`core`/…) |
  | `packages/app/src/context/server-session.ts` | gone |
  | `packages/app/src/pages/layout/*` (sidebar) | gone (`app/src` reorganized: `home/`, `session/`, `workspaces/`, …) |

**Conclusion:** `git cherry-pick` / `rebase` / `merge` are all infeasible. Migration is a
**feature re-implementation** onto v2's new structure, verified against the documented intent
in `FORK_COMMITS.md`. We do NOT replay git history.

## Features to migrate (what we care about)

From `FORK_COMMITS.md`, the fork-specific behavior (ignore CI/publish/rebrand unless wanted):

| # | Feature | v1 location | Keep? |
|---|---|---|---|
| F1 | **Subagent chat fix** — show a child session's own permissions/questions; don't hide input in child sessions | `tui/.../session/index.tsx` | **Yes** (core value) |
| F2 | **No 100-message cap** in TUI sync store (3 sites) | `tui/src/context/sync.tsx` | **Yes** |
| F3 | **No initial message page-size cap** (20→10000) | `app/.../server-session.ts` | Yes if web/app used |
| F4 | **Sidebar collapsible subagent tree** + per-workspace expansion persistence | `app/.../pages/layout/*` | Decide — large, web/app only |
| F5 | Fork rebrand (`@anjanpoonacha/opencode` install/upgrade target) | `opencode/.../installation` | Only if re-publishing fork |
| F6 | Fork CI: `publish-fork.yml`, `sync-upstream.yml`, `publish-fork.ts`, bun pin | `.github`, `scripts` | Only if re-publishing fork |

**Open question for you:** do you still publish the fork to npm (F5/F6), and do you still ship
the web `app`/`desktop` (F3/F4)? If the fork is TUI-only now, the real work is just **F1 + F2**.

## Where each feature likely lands in v2 (needs confirmation during impl)

- F1 → `packages/tui/src/routes/session/index.tsx` still exists and still references `parentID`;
  also check `packages/tui/src/routes/session/permission.tsx` and `.../component/session-frame.tsx`.
- F2 → TUI message store moved out of `context/sync.tsx`; candidates:
  `packages/tui/src/context/data.tsx`, `.../mini/stream-v2*.ts`. Find the message-trim/limit logic.
- F3/F4 → `packages/app/src/{session,workspaces,home}/` (layout dir is gone).
- F5 → installation logic now under `packages/cli` and/or `packages/core`.

## Execution plan using herdr worktrees

Rationale: keep the current `sync/v1.18.31` checkout untouched; do v2 work in an isolated
worktree with its own agent panes, visible and monitorable.

### Step 0 — fetch v2 refs (main repo, once)

```bash
git fetch upstream tag v2.1.3 --no-tags   # already done for planning
git fetch upstream                         # full, to get v2 branch history if needed
```

### Step 1 — create the migration worktree via herdr

```bash
herdr worktree create \
  --cwd "$PWD" \
  --branch migrate-v2 \
  --base v2.1.3 \
  --label migrate-v2 \
  --no-focus \
  --trust-repository
```

Read `.result` for the new workspace/pane IDs and the worktree path. This gives a clean
`migrate-v2` branch based on pristine v2.1.3, in its own workspace, without touching the
current pane's branch.

### Step 2 — bootstrap the worktree

In a pane in the new worktree workspace:

```bash
bun install
bun typecheck   # from the relevant package dir, establishes a green baseline
```

### Step 3 — F1: subagent chat fix (TUI)

File: `packages/tui/src/routes/session/index.tsx`. Re-implement the v1 intent on v2's
API. In v2, `permissions()` (line ~206) returns `[]` when `session()?.parentID` is set.
Change it to return the child session's own permissions, e.g.
`data.session.permission.list(route.sessionID) ?? []`, and remove the `parentID` guard
that suppresses the composer/input for child sessions (see also lines 1394, 1596–1597).

Use serena `find_symbol` / `get_symbols_overview` to confirm the exact v2 memos and the
`data.session.permission`/`form` API shape before editing. `bun typecheck` in
`packages/tui`. Commit: `fix(tui): show subagent session permissions and input`.

### Step 4 — F5: fork rebrand (install/upgrade)

File: `packages/cli/src/services/updater.ts` (+ `services/updater-action.ts`,
`update-preflight.tsx`). Point the npm package and GitHub release lookups at
`@anjanpoonacha/opencode` / `anjanpoonacha/opencode`, mirroring v1 item 1d. Confirm the
v2 CLI package name/bin in `packages/cli/package.json` (currently `@opencode/cli`) and
decide the published name. `bun typecheck` in `packages/cli`.
Commit: `chore(cli): point updater at fork package`.

### Step 5 — F6: fork publish pipeline

Port the fork's `.github/workflows/publish-fork.yml` + `sync-upstream.yml` and the
publish script onto v2's build system (v2 uses `packages/cli/script/{build,publish}.ts`
and root `scripts/publish*.ts`, not the old `scripts/publish-fork.ts`). Reuse v2's
`build`/`verify-artifact` steps; keep the bun version pinned (v1 F6 pinned 1.3.14 —
re-check what v2 needs). Adjust the npm scope and release repo. Commit:
`ci: fork publish + upstream sync workflows`.

### Step 6 — validate

- `bun typecheck` in `packages/tui` and `packages/cli`.
- Build the TUI/CLI locally; run it, open a session with a subagent, confirm F1: the
  child session shows its own permission/question prompts and the input is usable.
- Dry-run the publish workflow (or `npm publish --dry-run`) before a real release.

### Step 7 — finalize

- Branch `migrate-v2` (AGENTS.md: ≤3 words, no slashes).
- Open PR against the fork; cut the fork release via the F6 workflow.
- Update `FORK_COMMITS.md` with the v2 re-implementation locations; mark F2/F3/F4 retired.

## Implementation status

- **F1 — DONE** on `v2.1.3`. `packages/tui/src/routes/session/index.tsx`:
  - `permissions()` returns `data.session.permission.list(route.sessionID) ?? []` for child
    sessions (was `[]`).
  - `forms()` returns the child's own forms concatenated with global (was global-only).
  - v2 already renders the `Prompt` input in child sessions (`<Match when={!disabled()}>`,
    no `parentID` guard), so no input-visibility change was needed.
  - `tsc -b` clean; serena diagnostics clean. (Required `bun install` first.)

- **F5 / F6 — BLOCKED on a design decision.** v2's publish + update system is fundamentally
  different from v1's and cannot be ported 1:1:
  - **Updater** (`packages/cli/src/services/updater.ts`) does not hardcode a package name or
    a GitHub repo. It resolves the target package and version from opencode's **own update
    service**: `https://opencode.ai/update/api/<channel>/<artifact>/<distribution>`. The
    installed package name is auto-detected from the on-disk `package.json` and must match
    `^@opencode(?:-ai)?\/cli(?:-node)?$`. Version/channel/artifact are build-time injected
    globals (`OPENCODE_VERSION`, `OPENCODE_CHANNEL`, `OPENCODE_ARTIFACT`; see
    `packages/cli/src/version.ts`).
  - **Publish** (`packages/cli/script/publish.ts`) publishes *many* platform binary packages
    under the `@opencode/cli-*` prefix plus an aggregator `@opencode/cli` with
    `optionalDependencies`, and pushes release metadata to `UpdateArtifact` (the opencode.ai
    update service). It also drives Homebrew/AUR/WinGet publishers.
  - A fork cannot write to `opencode.ai/update/api`, so the v1-style self-upgrade cannot work
    unchanged. **Options for you to pick:**
    1. **No self-update.** Publish a renamed scoped package (e.g. `@anjanpoonacha/opencode`)
       for manual `npm i -g`, and disable/stub the updater (set channel to `local` or gate
       `inspect()` off). Smallest change; loses in-app upgrade.
    2. **Fork the update service too.** Stand up your own update endpoint and point the
       updater's base URL + package-name regex at your fork. Largest change.
    3. **Minimal binary package** like v1's old `scripts/publish-fork.ts`: build one
       darwin-arm64 binary, publish `@anjanpoonacha/opencode`, no auto-update. Re-create that
       script against v2's `packages/cli/script/build.ts` output.
  - Recommend **Option 1 or 3** given "TUI-only, keep publishing the fork." Tell me which and
    I'll implement it.

## Out of scope (confirmed)

- **F2** (100-message cap): obsolete — v2 has no such cap. Retire it; revert the
  uncommitted `sync.tsx` change on the v1 branch is unnecessary since that branch stays.
- **F3, F4** (web app/desktop sidebar + page size): dropped — TUI-only fork.
