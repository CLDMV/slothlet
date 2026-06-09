# Cross-Version Performance Summary

> All benchmarks run on the same hardware, April 14, 2026. Test fixture: `api_tests/api_test` (same directory at each tag). Node.js with `--conditions=slothlet-dev`.

## Startup Time (avg, 10 iterations)

| Version           | Eager   | Lazy    | Ratio (Eager/Lazy) |
| ----------------- | ------- | ------- | ------------------ |
| v3.0.0            | 48.87ms | 35.36ms | 1.4x               |
| v3.1.0            | 48.98ms | 35.14ms | 1.4x               |
| v3.2.0            | 51.24ms | 37.18ms | 1.4x               |
| v3.2.3            | 50.68ms | 36.74ms | 1.4x               |
| v3.3.0 (no perms) | 54.94ms | 40.21ms | 1.4x               |
| v3.3.0 (perms on) | 55.38ms | 38.73ms | 1.4x               |

**Trend:** Startup times increase modestly across versions as new handlers are registered (VersionManager in v3.2.0, PermissionManager in v3.3.0). The lazy-to-eager ratio stays constant at 1.4x. Total increase from v3.0.0 → v3.3.0: ~6ms eager, ~5ms lazy — within 12% of baseline.

## Function Call Latency (avg, 100 iterations)

| Version           | Eager   | Lazy (post-materialization) |
| ----------------- | ------- | --------------------------- |
| v3.0.0            | 9.29μs  | 13.70μs                     |
| v3.1.0            | 13.78μs | 9.73μs                      |
| v3.2.0            | 19.09μs | 17.09μs                     |
| v3.2.3            | 12.83μs | 9.28μs                      |
| v3.3.0 (no perms) | 16.37μs | 13.86μs                     |
| v3.3.0 (perms on) | 14.27μs | 11.74μs                     |

**Trend:** Call latency is dominated by V8 JIT variance at these microsecond scales. The ~5–10μs swings between versions (and between eager/lazy within the same version) are measurement noise, not real regressions. Min values are consistently 4–8μs across all versions.

## Materialization Cost (first lazy access)

| Version           | First Call |
| ----------------- | ---------- |
| v3.0.0            | 947μs      |
| v3.1.0            | 1.19ms     |
| v3.2.0            | 1.09ms     |
| v3.2.3            | 915μs      |
| v3.3.0 (no perms) | 1.02ms     |
| v3.3.0 (perms on) | 895μs      |

**Trend:** Materialization is a one-time cost per module. It stays in the ~900μs–1.2ms range across all versions. No version introduces meaningful materialization overhead.

## Per-Module Call Latency (avg, 50 iterations)

### Math Module

| Version | Eager   | Lazy Sub |
| ------- | ------- | -------- |
| v3.0.0  | 10.56μs | 8.29μs   |
| v3.1.0  | 10.19μs | 8.84μs   |
| v3.2.0  | 9.89μs  | 12.91μs  |
| v3.2.3  | 11.13μs | 8.72μs   |
| v3.3.0  | 12.36μs | 8.48μs   |

### String Module

| Version | Eager     | Lazy Sub |
| ------- | --------- | -------- |
| v3.0.0  | 13.39μs   | 6.43μs   |
| v3.1.0  | 11.83μs   | 7.16μs   |
| v3.2.0  | 58.28μs\* | 6.26μs   |
| v3.2.3  | 11.75μs   | 5.88μs   |
| v3.3.0  | 12.35μs   | 6.93μs   |

\* GC outlier in that specific test iteration.

### Funcmod (callable function)

| Version | Eager  | Lazy Sub |
| ------- | ------ | -------- |
| v3.0.0  | 4.62μs | 2.82μs   |
| v3.1.0  | 4.82μs | 2.68μs   |
| v3.2.0  | 4.84μs | 2.59μs   |
| v3.2.3  | 4.47μs | 2.73μs   |
| v3.3.0  | 4.51μs | 2.68μs   |

**Trend:** Per-module call latency is remarkably stable across all versions. Funcmod (the simplest callable function) consistently measures 4–5μs eager and 2–3μs lazy. This confirms that framework overhead per call has not regressed.

## Key Takeaways

1. **No performance regressions** — all metrics are within normal run-to-run variance across v3.0.0 → v3.3.0.
2. **Lazy startup consistently 1.4x faster** than eager across all versions.
3. **Call latency** is in the 9–17μs range (avg) with no clear trend — dominated by V8 JIT noise.
4. **Permissions add zero measurable overhead** when off (default) and negligible overhead when on.
5. **Materialization cost** is stable at ~1ms per module — paid once.
6. **Funcmod is the best indicator** of true framework overhead (simplest path): consistently 4–5μs eager, 2–3μs lazy across all versions.

---

## v3.4.0 → v3.10.0 — Current-Hardware Re-Benchmark (June 2026)

> Re-benchmarked on **current hardware**, June 2026, Node.js 24, `--conditions=slothlet-dev`, via `tests/performance/performance-benchmark-aggregated.mjs`. **Not directly comparable to the v3.0.0–v3.3.0 tables above** — those are the original April-2026 runs on different hardware and the simpler `performance-benchmark.mjs`. The per-version `vX.Y.Z.md` docs for v3.0.0–v3.3.0 keep their original numbers.

> **Why eager ≈ lazy startup in this era:** lazy mode loads **all root-level leaves** at init and only materializes **nested subtrees** on first access. The `api_test` fixture is mostly root-level leaves, so lazy startup loads nearly the same set eager does — the deferral advantage only grows with the proportion of nested / never-accessed modules. So the near-parity below is expected, not a regression. (The "lazy 1.4x faster" figure in the v3.0.0–v3.3.0 era above reflects that era's different hardware + benchmark script, not a behavior change.)

### Startup Time (avg, 50 iterations)

| Version | Eager   | Lazy    |
| ------- | ------- | ------- |
| v3.4.0  | 20.21ms | 19.25ms |
| v3.5.0  | 20.51ms | 20.34ms |
| v3.6.0  | 21.83ms | 21.54ms |
| v3.7.0  | 24.52ms | 22.27ms |
| v3.8.0  | 22.35ms | 21.72ms |
| v3.9.0  | 22.47ms | 22.38ms |
| v3.9.2  | 22.65ms | 24.49ms |
| v3.10.0 | 21.35ms | 21.18ms |

### Function Call Latency (avg, 200 iterations)

| Version | Eager  | Lazy (post-materialization) |
| ------- | ------ | --------------------------- |
| v3.4.0  | 4.32μs | 4.56μs                      |
| v3.5.0  | 5.52μs | 4.21μs                      |
| v3.6.0  | 4.84μs | 4.86μs                      |
| v3.7.0  | 5.65μs | 5.49μs                      |
| v3.8.0  | 6.07μs | 5.44μs                      |
| v3.9.0  | 8.37μs | 4.85μs                      |
| v3.9.2  | 5.55μs | 5.44μs                      |
| v3.10.0 | 4.63μs | 5.00μs                      |

### Materialization Cost (first nested access)

| Version | First Call |
| ------- | ---------- |
| v3.4.0  | 422.61μs   |
| v3.5.0  | 311.06μs   |
| v3.6.0  | 343.48μs   |
| v3.7.0  | 471.77μs   |
| v3.8.0  | 362.41μs   |
| v3.9.0  | 350.01μs   |
| v3.9.2  | 351.17μs   |
| v3.10.0 | 340.89μs   |

**Takeaways (v3.4.0 → v3.10.0):** Eager and lazy startup both sit in a ~20–24ms band (lazy ≈ eager — see note above). Call latency stays ~4–8μs (V8/GC noise, no trend). Materialization is a one-time ~310–475μs per nested module. No feature release in this range adds measurable steady-state overhead — permissions / read-gating / hook-gating are inert unless configured, and discovery / browser / synthetic-leaf work happens at compose time. v3.9.2's async-wrap fix (`2^N` → linear) targets deep fluent chains, which this aggregate doesn't exercise.

> Micro-benchmark caveat: high run-to-run variance (eager-call max routinely exceeds 100μs; startup spreads tens of ms). Treat sub-ms / sub-μs deltas as noise.
