# Issue: Test Suite Restructure — Targeted Runs + Matrix Expandability

**Scope:** `tests/vitests/` — full vitest suite organization and config matrix
**Severity:** Low — infrastructure debt, not blocking
**Status:** Open — deferred for a dedicated test-refactor pass

---

## Background

Slothlet's vitest suite at [tests/vitests/suites/](tests/vitests/suites/) contains ~285 test files organized by subsystem (34 directories: `permissions/`, `metadata/`, `versioning/`, etc.). Tests that need slothlet's full init matrix iterate via `describe.each(getMatrixConfigs())` from [tests/vitests/setup/vitest-helper.mjs](tests/vitests/setup/vitest-helper.mjs).

The current matrix `CONFIG_SPACE` at [tests/vitests/setup/vitest-helper.mjs:71-86](tests/vitests/setup/vitest-helper.mjs#L71-L86) is:

```js
const CONFIG_SPACE = {
    mode: ["eager", "lazy"],
    runtime: ["async", "live"],
    // collision, allowApiOverwrite, apiDepth, allowMutation — commented out
    hook: [{ enabled: true }, { enabled: false }]
};
```

= **8 configs** per matrix-aware test. Total suite runtime is currently **~20-30 minutes**.

---

## The Problem

The current organization has two tensions that compound over time:

### 1. Matrix expandability vs. runtime

The matrix omits several init-time options that arguably warrant per-test coverage — most notably `collision: { initial, api }`. Each axis added multiplies the matrix:

| Adding... | Multiplier | New per-test config count | Estimated total runtime |
|---|---|---|---|
| Status quo | 1× | 8 | ~20-30 min |
| `collision` original 2 pairs (merge/merge + error/error) | 2× | 16 | ~40-60 min |
| `collision` all 6 modes paired | 6× | 48 | ~2-3 hr |
| Full collision cartesian (6 × 6) | 36× | 288 | unrunnable |

Beyond a doubling, the developer feedback loop breaks. With 20-30 min already on the wire, even a 2× expansion pushes past the patience threshold for local iteration.

### 2. No targeted-run granularity

The suite has no first-class way to ask "give me 100% coverage of one subsystem" or "run only the tests that exercise this file." vitest's `--changed` and file-pattern flags help, but the structure doesn't naturally expose:

- Per-file 100% coverage runs (for hard-to-cover branches)
- Per-subsystem coverage with isolated reporting
- Per-feature matrix coverage (e.g., "verify the metadata system under every collision mode" without re-running everything else)
- Dependency-aware partial runs (only re-run tests whose source dependencies changed)

The current pattern requires either running everything (slow) or manually navigating file paths and `vitest --run path/to/specific/file.test.vitest.mjs` (manual, easy to miss interactions).

---

## What a Restructure Would Look Like

Rough sketch — to be designed properly when this is picked up:

### A. Layered matrix

Split the matrix into tiers that callers explicitly opt into:

- **Smoke matrix** — 1-2 configs, runs in <5 min, used for fast iteration / PR pre-flight
- **Standard matrix** — current 8 configs, runs in ~20-30 min, used for full PR validation
- **Extended matrix** — adds `collision` + other init axes, runs in 1-2 hr, used for release validation / nightly CI
- **Full cartesian** — every meaningful axis, runs unbounded, used only for major-version validation

Tests would declare which tier(s) they belong in via a helper:

```js
describe.each(getMatrixConfigs({ tier: "smoke" }))(...)        // 1-2 configs
describe.each(getMatrixConfigs({ tier: "standard" }))(...)     // 8 configs (current default)
describe.each(getMatrixConfigs({ tier: "extended" }))(...)     // adds collision etc.
```

vitest scripts would expose runners for each tier (`pnpm test:smoke`, `pnpm test`, `pnpm test:extended`).

### B. Subsystem-targeted runners

Make per-subsystem coverage a first-class operation. Possibilities:

- `pnpm test:cov:permissions` → runs all `permissions/` tests with v8 coverage scoped to `src/lib/handlers/permission-manager.mjs`
- `pnpm test:cov:metadata` → similar for `src/lib/handlers/metadata.mjs`
- Per-file: `pnpm test:cov:file src/lib/handlers/permission-manager.mjs` → runs only tests that exercise that file, reports its coverage

This needs either a manifest (each subsystem declares its source files) or convention-driven inference (subsystem directory name maps to handler file name).

### C. Dependency-aware partial runs

Beyond vitest's `--changed`, build a real source-to-test dependency graph so a change to a single source file runs only the tests that exercise it. Tools like `vitest-related` exist; would need investigation.

### D. Parallel-friendly grouping

The matrix expansion problem partly comes from running serially within each test file. With smarter parallelism (per-config workers within a single test file, not just per-file), a 2× matrix expansion might cost <2× wall-clock if workers are available. Worth measuring before pursuing the layered-matrix path.

---

## Why This Is Deferred

The above is a substantial restructure — comparable in scope to a minor version of slothlet itself. Doing it correctly requires:

- Auditing which existing tests are matrix-aware and which aren't
- Defining the tier semantics so they're useful in practice (not just on paper)
- Migrating test files to declare their tier
- Building the per-subsystem coverage runners and validating they produce useful reports
- Wiring the new test scripts into CI without disrupting current developer workflow

In the meantime, the matrix stays at 8 configs. Init options not in the matrix continue to be tested in dedicated subsystem suites (e.g., `config/collision-config.test.vitest.mjs` for collision modes).

---

## When to Revisit

- When test runtime crosses 45 minutes for a standard run (whichever cause).
- When a new feature genuinely requires per-test matrix coverage of an axis the current matrix doesn't cover, and the dedicated-suite approach is provably inadequate.
- When CI feedback becomes a major contributor to PR cycle time.
- During a v4 planning window when restructure cost is amortized across other large changes.

---

## Related

- [test-coverage-audit-v3.md](../../reference/test-coverage-audit-v3.md) (local-only) — the audit that surfaced this. Section 3 discusses the matrix as it stands today.
- [.configs/vitest.config.mjs](.configs/vitest.config.mjs) — current vitest configuration.
- [tests/vitests/setup/vitest-helper.mjs](tests/vitests/setup/vitest-helper.mjs) — matrix definition and helper functions.
