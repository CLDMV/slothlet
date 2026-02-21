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
| `docs/v2/API-RULES-CONDITIONS.md` | `docs/API-RULES/API-RULES-CONDITIONS.md` | ✅ Complete | C01-C18 updated; C06 deprecated noted; C33-C34 added (v3 AddApi cases) |
| `docs/v2/API-RULES.md` | `docs/API-RULES.md` | ✅ Complete | Index file; detail docs in `docs/API-RULES/`; Rule 12 updated (fully impl.); Rule 13 marked new in v3 |
| `docs/v2/CONTEXT-PROPAGATION.md` | `docs/CONTEXT-PROPAGATION.md` | ⬜ Not Started | |
| `docs/v2/HOOKS.md` | `docs/HOOKS.md` | ⬜ Not Started | |
| `docs/v2/METADATA.md` | `docs/METADATA.md` | ⬜ Not Started | |
| `docs/v2/MODULE-STRUCTURE.md` | `docs/MODULE-STRUCTURE.md` | ⬜ Not Started | |
| `docs/v2/PERFORMANCE.md` | `docs/PERFORMANCE.md` | ✅ Complete | New benchmarks (Linux/Node v24), v3.0.0 data |
| `docs/v2/SANITIZATION.md` | `docs/SANITIZATION.md` | ✅ Complete | Full v3 rewrite; change doc at `docs/v3/changes/sanitization.md` |
| `docs/v2/sanitization-options.json` | _(supplemental — no output file)_ | ✅ Reviewed | V2 API spec; `splitBehavior`, `v2Bugs`, `rulePrecedence` incorporated into `docs/v3/changes/sanitization.md` |
| `docs/v2/root/AGENT-USAGE.md` | `AGENT-USAGE.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/BUGS.md` | `BUGS.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/CONTRIBUTING.md` | `CONTRIBUTING.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/README.md` | `README.md` (in-place) | ⬜ Not Started | |
| `docs/v2/root/SECURITY.md` | `SECURITY.md` (in-place) | ⬜ Not Started | |

---

## V3 Reference Docs

These files were produced during V3 development and contain raw context, decisions, investigations, and change records. When rewriting a doc, scan this list and read any entries that are attributed to it.

The *Attributed To* column should be filled in as each file is reviewed. Leave blank if a file is purely internal (test infra, investigation scratch, internal refactor tracking) with no public documentation impact.

### `docs/v2/` — Supplemental / Non-Markdown

| File | Attributed To | Notes |
|---|---|---|
| `docs/v2/sanitization-options.json` | `docs/SANITIZATION.md` | ✅ Reviewed — V2 machine-readable spec; moved from `docs/v2-sanitization-options.json` |

---

### `docs/v3/changes/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/changes/api-methods-and-config-options.md` | | |
| `docs/v3/changes/background-materialize.md` | | |
| `docs/v3/changes/child-instance-context-isolation.md` | | |
| `docs/v3/changes/class-based-architecture-refactor-phase-3-documentation-tasks.md` | | |
| `docs/v3/changes/hook-system.md` | | |
| `docs/v3/changes/hot-reload-complete.md` | | |
| `docs/v3/changes/LAZY-MODE-PROXY-GOTCHAS.md` | | |
| `docs/v3/changes/metadata-path-api-and-reload-metadata.md` | | |
| `docs/v3/changes/metadata-system.md` | | |
| `docs/v3/changes/ownership-and-history-system.md` | | |
| `docs/v3/changes/README.md` | | Meta — describes changes dir |
| `docs/v3/changes/sanitization.md` | `docs/SANITIZATION.md` | ✅ Processed |
| `docs/v3/changes/typeof-always-function-lazy-mode.md` | | |
| `docs/v3/changes/type-property.md` | | |

### `docs/v3/features/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/features/collision-modes.md` | | |
| `docs/v3/features/lifecycle-events.md` | | |

### `docs/v3/old/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/old/BREAKING-CHANGES-V3.md` | | High-value — covers multiple docs |
| `docs/v3/old/HOT-RELOAD-ARCHITECTURE.md` | | |
| `docs/v3/old/HOT-RELOAD-FLATTENING-ISSUE.md` | | |
| `docs/v3/old/HOT-RELOAD-MERGE-DUPLICATION.md` | | |
| `docs/v3/old/INITIAL-VS-HOTRELOAD-PATHS.md` | | |
| `docs/v3/old/src3-README.md` | | Early V3 README draft |
| `docs/v3/old/UNIFIED-WRAPPER-IMPL.md` | | |
| `docs/v3/old/V2-V3-GAP-LIST.md` | | High-value — covers multiple docs |
| `docs/v3/old/V3-API-STRUCTURE-ISSUES.md` | | |
| `docs/v3/old/V3-MIGRATION-STATUS.md` | | |

### `docs/v3/todo/` (active)

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/todo/api-cache-lazy-mode-verification.md` | | Still active/open |

### `docs/v3/todo/completed/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/todo/completed/allowMutation-config-option.md` | | |
| `docs/v3/todo/completed/api-assignment-history-context.md` | | |
| `docs/v3/todo/completed/api-cache-system.md` | | |
| `docs/v3/todo/completed/architecture-context-instanceid-management.md` | | |
| `docs/v3/todo/completed/baseline-test-failures-2026-02-01.md` | | Likely internal only |
| `docs/v3/todo/completed/baseline-test-failures-old.md` | | Likely internal only |
| `docs/v3/todo/completed/cjs-default-exports.md` | | |
| `docs/v3/todo/completed/class-based-architecture-refactor.md` | | |
| `docs/v3/todo/completed/class-instance-context-propagation.md` | | |
| `docs/v3/todo/completed/cleanup-allowAddApiOverwrite.md` | | |
| `docs/v3/todo/completed/collision-function-edge-case.md` | | |
| `docs/v3/todo/completed/console-log-migration-map.md` | | Likely internal only |
| `docs/v3/todo/completed/context-get-cross-instance-behavior.md` | | |
| `docs/v3/todo/completed/dev-environment-detection-error.md` | | |
| `docs/v3/todo/completed/eliminate-3-api-architecture.md` | | |
| `docs/v3/todo/completed/eventemitter-context-propagation.md` | | |
| `docs/v3/todo/completed/file-based-api-add.md` | | |
| `docs/v3/todo/completed/fix-context-isolation-shallow-copy-bug.md` | | |
| `docs/v3/todo/completed/hooks-system.md` | | |
| `docs/v3/todo/completed/hot-reload-issues-checklist.md` | | Likely internal only |
| `docs/v3/todo/completed/hot-reload-system.md` | | |
| `docs/v3/todo/completed/investigate-addapi-special-case.md` | | |
| `docs/v3/todo/completed/INVESTIGATION-2026-01-30-FINDINGS.md` | | Likely internal only |
| `docs/v3/todo/completed/INVESTIGATION-2026-01-30.md` | | Likely internal only |
| `docs/v3/todo/completed/lazy-materialization-tracking.md` | | |
| `docs/v3/todo/completed/LAZY-MODE-COLLISION-BUG.md` | | Likely internal only |
| `docs/v3/todo/completed/lazy-mode-collision-replace-investigation.md` | | Likely internal only |
| `docs/v3/todo/completed/LAZY-MODE-MATERIALIZATION-TRACE.md` | | Likely internal only |
| `docs/v3/todo/completed/lazy-mode-remove-timing-issue.md` | | |
| `docs/v3/todo/completed/metadata-tagging.md` | | |
| `docs/v3/todo/completed/naming-convention-cleanup.md` | | Likely internal only |
| `docs/v3/todo/completed/per-request-context-isolation.md` | | |
| `docs/v3/todo/completed/proxy-context-propagation.md` | | |
| `docs/v3/todo/completed/proxy-security-audit.md` | | |
| `docs/v3/todo/completed/README.md` | | Meta — describes completed dir |
| `docs/v3/todo/completed/remove-allowMutation-implement-collision-config.md` | | |
| `docs/v3/todo/completed/thoughts.md` | | Likely internal only |
| `docs/v3/todo/completed/tools-v3-compatibility.md` | | |
| `docs/v3/todo/completed/typescript-declarations.md` | | |
| `docs/v3/todo/completed/typescript-support.md` | | |
| `docs/v3/todo/completed/v2-feature-parity-checklist.md` | | High-value — covers multiple docs |
| `docs/v3/todo/completed/V2-INFRASTRUCTURE-CLEANUP.md` | | Likely internal only |

### `docs/v3/todo/future/`

| File | Attributed To | Notes |
|---|---|---|
| `docs/v3/todo/future/lazy-mode-performance-optimization.md` | | |
