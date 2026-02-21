# Documentation Rewrite Status — V3

This file tracks the rewrite of all documentation from V2 to V3, and cross-references every V3 development document (found in `docs/v3/`) so that relevant context is incorporated during each rewrite.

---

## How to Process a Document

When rewriting a V2 or root-level doc for V3:

1. **Read the source doc** (`docs/v2/<NAME>.md` or the root file).
2. **Scan the V3 Reference Docs table below** for any entries attributed to this document (column: *Attributed To*). Read each one.
3. **Update the main doc** to reflect all V3 changes, additions, and removals. Write as a clean V3 document — no V2 comparisons or migration notes.
4. **Check for undocumented changes**: If a V3 behavioral change, new feature, or removal is discovered while rewriting that is **not already tracked in `docs/v3/changes/`**, create a new file in `docs/v3/changes/` to record it before finishing. This ensures a proper changelog can be generated later.
5. **Save the output** to `docs/<NAME>.md` (top-level, not in `v2/`). The V2 file remains as historical reference.
6. **Update the status** in the Rewrite Status table below (`⏳ In Progress` → `✅ Complete`) and fill in the *Output File* column if not already set.

---

## Rewrite Status

| Source | Output File | Status | Notes |
|---|---|---|---|
| `docs/v2/API-FLATTENING.md` | `docs/API-RULES/API-FLATTENING.md` | ✅ Complete | F01-F08; F08 new in v3 (path deduplication); updated decision tree Mermaid |
| `docs/v2/API-RULE-MAPPING.md` | `docs/API-RULES/API-RULE-MAPPING.md` | ✅ Complete | 13-rule traceability matrix; Rule 13 new in v3; impl file refs corrected for v3 |
| `docs/v2/API-RULES-CONDITIONS.md` | `docs/API-RULES/API-RULES-CONDITIONS.md` | ✅ Complete | C01-C18 updated; C06 deprecated noted; C33-C34 added (v3 AddApi cases); C33 source file ref corrected to `src/lib/processors/flatten.mjs` + `src/lib/builders/modes-processor.mjs` |
| `docs/v2/API-RULES.md` | `docs/API-RULES.md` | ✅ Complete | Index file; detail docs in `docs/API-RULES/`; Rule 12 updated (fully impl.); Rule 13 marked new in v3 |
| `docs/v2/CONTEXT-PROPAGATION.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Complete | v3 API: `api.slothlet.context.run/scope`; isolation modes (partial/full); deep-clone isolation fix; cross-instance behavior documented |
| `docs/v2/HOOKS.md` | `docs/HOOKS.md` | ✅ Complete | v3 API: `api.slothlet.hook.*`; `on(typePattern, handler, opts)`; filter object API for remove/enable/disable/list; brace expansion and negation patterns; sync-hook constraint; per-type context shapes; `hook:` config key corrected throughout (was `hooks:`) |
| `docs/v2/METADATA.md` | `docs/METADATA.md` | ✅ Complete | v3 dual-storage (WeakMap system + Map user); `api.slothlet.metadata.*` API (set/setGlobal/remove/setFor/removeFor); metadata priority model; reload-persistence; atomic reload-with-metadata; lifecycle enforcement |
| `docs/v2/MODULE-STRUCTURE.md` | `docs/MODULE-STRUCTURE.md` | ✅ Complete | CJS default export normalization noted; TypeScript section added; links updated to API-RULES/ subfolder |
| `docs/v2/PERFORMANCE.md` | `docs/PERFORMANCE.md` | ✅ Complete | New benchmarks (Linux/Node v24), v3.0.0 data |
| `docs/v2/SANITIZATION.md` | `docs/SANITIZATION.md` | ✅ Complete | Full v3 rewrite; change doc at `docs/v3/changes/sanitization.md` |
| `docs/v2/sanitization-options.json` | _(supplemental — no output file)_ | ✅ Reviewed | V2 API spec; `splitBehavior`, `v2Bugs`, `rulePrecedence` incorporated into `docs/v3/changes/sanitization.md` |
| _(new — no v2 equivalent)_ | `docs/CONFIGURATION.md` | ✅ Complete | New v3 doc; covers `runtime`, `apiDepth`, `api.mutations`, `debug`, `silent`, `diagnostics`, `api.slothlet.diag.*` namespace, `scope`, `tracking`, `backgroundMaterialize` |
| _(new — no v2 equivalent)_ | `docs/RELOAD.md` | ✅ Complete | New v3 doc; covers `api.slothlet.api.add/remove/reload`, eager vs lazy reload divergence, reference preservation, ESM/CJS cache busting, operation history replay, moduleID ownership, lifecycle events |
| _(new — no v2 equivalent)_ | `docs/I18N.md` | ✅ Complete | New v3 doc; covers `setLanguage`, `getLanguage`, `translate`/`t`, `initI18n`; auto-init on import; env-based language detection; language file format; `en-us` + `es-mx` |
| `docs/v2/root/AGENT-USAGE.md` | `AGENT-USAGE.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/BUGS.md` | `BUGS.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/CONTRIBUTING.md` | `CONTRIBUTING.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/README.md` | `README.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/SECURITY.md` | `SECURITY.md` (in-place) | ⬜ Not Started | |

---

## V3 Reference Docs

These files were produced during V3 development and contain raw context, decisions, investigations, and change records. When rewriting a doc, scan this list and read any entries that are attributed to it.

The *Attributed To* column should be filled in as each file is reviewed. Leave blank if a file is purely internal (test infra, investigation scratch, internal refactor tracking) with no public documentation impact.

### `docs/v3/changelog/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/changelog/v2.0.md` – `v2.12.md` (13 files) | structural | ✅ Reviewed — V2 release changelogs; historical record only; no v3 doc attribution needed |

---

### `docs/v2/` — Supplemental / Non-Markdown

| File | Attributed To | Notes |
|---|---|---|
| `docs/v2/sanitization-options.json` | `docs/SANITIZATION.md` | ✅ Reviewed — V2 machine-readable spec; moved from `docs/v2-sanitization-options.json` |

---

### `docs/v3/changes/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/changes/api-methods-and-config-options.md` | `docs/CONFIGURATION.md` | ✅ Processed — primary config reference source |
| `docs/v3/changes/background-materialize.md` | `docs/LIFECYCLE.md` | ✅ Processed |
| `docs/v3/changes/child-instance-context-isolation.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed |
| `docs/v3/changes/class-based-architecture-refactor-phase-3-documentation-tasks.md` | internal | ✅ Reviewed — architecture/refactor tracking only |
| `docs/v3/changes/hook-system.md` | `docs/HOOKS.md` | ✅ Processed |
| `docs/v3/changes/hot-reload-complete.md` | `docs/RELOAD.md` | ✅ Processed |
| `docs/v3/changes/LAZY-MODE-PROXY-GOTCHAS.md` | internal | ✅ Reviewed — gotchas captured in LIFECYCLE.md |
| `docs/v3/changes/metadata-path-api-and-reload-metadata.md` | `docs/METADATA.md` | ✅ Processed |
| `docs/v3/changes/metadata-system.md` | `docs/METADATA.md` | ✅ Processed |
| `docs/v3/changes/ownership-and-history-system.md` | internal | ✅ Reviewed — ownership system impl notes only |
| `docs/v3/changes/README.md` | structural | ✅ Reviewed — directory index only; no content to attribute |
| `docs/v3/changes/sanitization.md` | `docs/SANITIZATION.md` | ✅ Processed |
| `docs/v3/changes/typeof-always-function-lazy-mode.md` | `docs/LIFECYCLE.md` | ✅ Processed |
| `docs/v3/changes/type-property.md` | `docs/LIFECYCLE.md` | ✅ Processed |

### `docs/v3/features/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/features/collision-modes.md` | `docs/METADATA.md` + `docs/CONFIGURATION.md` | ✅ Processed |
| `docs/v3/features/lifecycle-events.md` | `docs/LIFECYCLE.md` | ✅ Processed |

### `docs/v3/old/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/old/BREAKING-CHANGES-V3.md` | `docs/I18N.md` + internal | ✅ Processed — i18n section attributed to `docs/I18N.md`; all other changes already incorporated into respective docs |
| `docs/v3/old/HOT-RELOAD-ARCHITECTURE.md` | `docs/RELOAD.md` | ✅ Processed |
| `docs/v3/old/HOT-RELOAD-FLATTENING-ISSUE.md` | `docs/RELOAD.md` | ✅ Processed — wrapper sync divergence now documented |
| `docs/v3/old/HOT-RELOAD-MERGE-DUPLICATION.md` | `docs/RELOAD.md` | ✅ Processed — merge/collision behavior documented |
| `docs/v3/old/INITIAL-VS-HOTRELOAD-PATHS.md` | `docs/RELOAD.md` | ✅ Processed — eager/lazy divergence section |
| `docs/v3/old/src3-README.md` | internal | ✅ Reviewed — early prototype; fully superseded |
| `docs/v3/old/UNIFIED-WRAPPER-IMPL.md` | internal | ✅ Reviewed — impl design notes only |
| `docs/v3/old/V2-V3-GAP-LIST.md` | internal | ✅ Reviewed — historical gap list; all gaps filled |
| `docs/v3/old/V3-API-STRUCTURE-ISSUES.md` | internal | ✅ Reviewed — all issues resolved |
| `docs/v3/old/V3-MIGRATION-STATUS.md` | `docs/CONFIGURATION.md` | ✅ Processed — revealed undocumented `diagnostics` config option |

### `docs/v3/todo/` (active)

| File | Attributed To | Notes |
|---|---|---|
| _(structural — all items moved to completed)_ | structural | ✅ Reviewed — placeholder row; active todo dir is empty |

### `docs/v3/todo/completed/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/todo/completed/allowMutation-config-option.md` | `docs/CONFIGURATION.md` | ✅ Processed — deprecated option mapped to `api.mutations` |
| `docs/v3/todo/completed/api-cache-lazy-mode-verification.md` | internal | ✅ Completed — tests exist in vitests/suites/lazy/ |
| `docs/v3/todo/completed/api-assignment-history-context.md` | internal | ✅ Reviewed — impl investigation only |
| `docs/v3/todo/completed/api-cache-system.md` | internal | ✅ Reviewed — impl design only |
| `docs/v3/todo/completed/architecture-context-instanceid-management.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed |
| `docs/v3/todo/completed/baseline-test-failures-2026-02-01.md` | internal | ✅ Reviewed — test infrastructure only |
| `docs/v3/todo/completed/baseline-test-failures-old.md` | internal | ✅ Reviewed — test infrastructure only |
| `docs/v3/todo/completed/cjs-default-exports.md` | `docs/MODULE-STRUCTURE.md` | ✅ Processed |
| `docs/v3/todo/completed/class-based-architecture-refactor.md` | internal | ✅ Reviewed — refactor tracking only |
| `docs/v3/todo/completed/class-instance-context-propagation.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed |
| `docs/v3/todo/completed/cleanup-allowAddApiOverwrite.md` | `docs/CONFIGURATION.md` | ✅ Processed — `allowAddApiOverwrite` removal documented |
| `docs/v3/todo/completed/collision-function-edge-case.md` | internal | ✅ Reviewed — edge case fixed in impl; no public API change |
| `docs/v3/todo/completed/console-log-migration-map.md` | internal | ✅ Reviewed — logging cleanup only |
| `docs/v3/todo/completed/context-get-cross-instance-behavior.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed (consolidated into fix-context-isolation-shallow-copy-bug.md) |
| `docs/v3/todo/completed/dev-environment-detection-error.md` | internal | ✅ Reviewed — env detection bug fix only |
| `docs/v3/todo/completed/eliminate-3-api-architecture.md` | internal | ✅ Reviewed — structural refactor only |
| `docs/v3/todo/completed/eventemitter-context-propagation.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed |
| `docs/v3/todo/completed/file-based-api-add.md` | `docs/METADATA.md` | ✅ Processed — array/file form of `api.slothlet.metadata.set` documented |
| `docs/v3/todo/completed/fix-context-isolation-shallow-copy-bug.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed |
| `docs/v3/todo/completed/hooks-system.md` | `docs/HOOKS.md` | ✅ Processed |
| `docs/v3/todo/completed/hot-reload-issues-checklist.md` | `docs/RELOAD.md` | ✅ Processed — issues all resolved; captured in reload doc |
| `docs/v3/todo/completed/hot-reload-system.md` | `docs/RELOAD.md` | ✅ Processed |
| `docs/v3/todo/completed/investigate-addapi-special-case.md` | `docs/API-RULES/` | ✅ Processed — investigation searched wrong dir; Rule 11/C33/F06 is implemented; source file refs corrected in all three API-RULES docs |
| `docs/v3/todo/completed/INVESTIGATION-2026-01-30-FINDINGS.md` | internal | ✅ Reviewed — internal investigation only |
| `docs/v3/todo/completed/INVESTIGATION-2026-01-30.md` | internal | ✅ Reviewed — internal investigation only |
| `docs/v3/todo/completed/lazy-materialization-tracking.md` | `docs/LIFECYCLE.md` | ✅ Processed |
| `docs/v3/todo/completed/LAZY-MODE-COLLISION-BUG.md` | internal | ✅ Reviewed — bug fix only |
| `docs/v3/todo/completed/lazy-mode-collision-replace-investigation.md` | internal | ✅ Reviewed — internal investigation only |
| `docs/v3/todo/completed/LAZY-MODE-MATERIALIZATION-TRACE.md` | internal | ✅ Reviewed — implementation trace only |
| `docs/v3/todo/completed/lazy-mode-remove-timing-issue.md` | internal | ✅ Reviewed — timing bug fix only |
| `docs/v3/todo/completed/metadata-tagging.md` | `docs/METADATA.md` | ✅ Processed |
| `docs/v3/todo/completed/naming-convention-cleanup.md` | internal | ✅ Reviewed — naming conventions only |
| `docs/v3/todo/completed/per-request-context-isolation.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed |
| `docs/v3/todo/completed/proxy-context-propagation.md` | `docs/CONTEXT-PROPAGATION.md` | ✅ Processed (solved by class instance wrapper) |
| `docs/v3/todo/completed/proxy-security-audit.md` | internal | ✅ Reviewed — security audit only |
| `docs/v3/todo/completed/README.md` | structural | ✅ Reviewed — directory index only; no content to attribute |
| `docs/v3/todo/completed/remove-allowMutation-implement-collision-config.md` | `docs/CONFIGURATION.md` | ✅ Processed — `allowMutation` removal and `api.collision` addition documented |
| `docs/v3/todo/completed/thoughts.md` | internal | ✅ Reviewed — design notes only |
| `docs/v3/todo/completed/tools-v3-compatibility.md` | internal | ✅ Reviewed — tools internal compat work only |
| `docs/v3/todo/completed/typescript-declarations.md` | `docs/MODULE-STRUCTURE.md` | ✅ Processed |
| `docs/v3/todo/completed/typescript-support.md` | `docs/MODULE-STRUCTURE.md` | ✅ Processed (TypeScript section) |
| `docs/v3/todo/completed/v2-feature-parity-checklist.md` | internal | ✅ Reviewed — all v2 features confirmed implemented; checklist complete |
| `docs/v3/todo/completed/V2-INFRASTRUCTURE-CLEANUP.md` | internal | ✅ Reviewed — v2 infra removal only |

### `docs/v3/todo/future/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/todo/future/lazy-mode-performance-optimization.md` | internal | Future work — no current public API impact |
