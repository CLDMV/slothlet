# API Rule Mapping

**Document Hierarchy**: [API Rules Index](../API-RULES.md) → [Flattening Patterns](API-FLATTENING.md) → [Conditions Reference](API-RULES-CONDITIONS.md) → **Rule Mapping**

**Purpose**: Traceability matrix connecting each rule to its flattening pattern(s), source condition(s), and implementation file(s). Use this to trace a behavior from high-level rule down to exact source code. Conditions span families: `C##` (flatten/placement), `G##` (discovery), `N##` (naming), `O##` (collision/ownership), `M##` (mutation), `V##` (versioning), `T##` (routines), `B##` (built-in) — see the per-family condition documents under `docs/API-RULES/`.

---

## Traceability Matrix

<!-- MAPPING:RULES -->

| Rule                                                                              | Description                                      | F##           | C##                                                             | Implementation File                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------ | ------------- | --------------------------------------------------------------- | -------------------------------------- |
| [Rule 1](../API-RULES.md#rule-1-filename-matches-container-flattening)            | Filename Matches Container Flattening            | F01           | C05, C09, C09b, C13                                             | `src/lib/processors/flatten.mjs`       |
| [Rule 2](../API-RULES.md#rule-2-single-function-file-promotion)                   | Single Function File Promotion                   | -             | C07, C10, C13                                                   | `src/lib/processors/flatten.mjs`       |
| [Rule 3](../API-RULES.md#rule-3-no-empty-leaves)                                  | No Empty Leaves                                  | -             | G06, M04, M05                                                   | `src/lib/processors/loader.mjs`        |
| [Rule 4](../API-RULES.md#rule-4-default-export-promotion)                         | Default Export Promotion                         | F04           | C11, C17                                                        | `src/lib/processors/flatten.mjs`       |
| [Rule 5](../API-RULES.md#rule-5-multiple-module-default-export-handling)          | Multiple Module Default Export Handling          | -             | C02, C03                                                        | `src/lib/processors/flatten.mjs`       |
| [Rule 6](../API-RULES.md#rule-6-self-referential--circular-reference-prevention)  | Self-Referential / Circular Reference Prevention | -             | C01, C09a                                                       | `src/lib/processors/flatten.mjs`       |
| [Rule 7](../API-RULES.md#rule-7-auto-flattening--single-named-export)             | Auto-Flattening – Single Named Export            | F02, F03      | C04, C08, C12, C18                                              | `src/lib/processors/flatten.mjs`       |
| [Rule 8](../API-RULES.md#rule-8-object--namespace-default-flattening)             | Object / Namespace Default Flattening            | F02, F04, F05 | C11, C17                                                        | `src/lib/processors/flatten.mjs`       |
| [Rule 9](../API-RULES.md#rule-9-function-name-preference)                         | Function Name Preference                         | -             | C15, C16                                                        | `src/lib/processors/flatten.mjs`       |
| [Rule 10](../API-RULES.md#rule-10-generic-filename-parent-level-promotion)        | Generic Filename Parent-Level Promotion          | F02           | C14                                                             | `src/lib/processors/flatten.mjs`       |
| [Rule 11](../API-RULES.md#rule-11-addapi-special-file-pattern)                    | AddApi Special File Pattern                      | F06           | C33                                                             | `src/lib/processors/flatten.mjs`       |
| [Rule 12](../API-RULES.md#rule-12-module-ownership-and-selective-api-overwriting) | Module Ownership and Selective API Overwriting   | F07           | O14, O15                                                        | `src/lib/handlers/ownership.mjs`       |
| [Rule 13](../API-RULES.md#rule-13-addapi-path-deduplication-flattening)           | AddApi Path Deduplication Flattening             | F08           | C34                                                             | `src/lib/handlers/api-manager.mjs`     |
| [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion)                  | API Directory Scan & Inclusion                   | -             | G01, G02, G03, G04, G05, G06, G07, G08                          | `src/lib/processors/loader.mjs`        |
| [Rule 15](../API-RULES.md#rule-15-external-module-discovery)                      | External Module Discovery                        | -             | G09, G10, G11, G12, G13, G14                                    | `src/lib/helpers/module-discovery.mjs` |
| [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)              | Leaf Name Derivation (Sanitization)              | -             | N01, N02, N03, N04, N05, N06, N07, N08                          | `src/lib/helpers/sanitize.mjs`         |
| [Rule 17](../API-RULES.md#rule-17-collision-resolution)                           | Collision Resolution                             | -             | O01, O02, O03, O04, O05, O06, O07, O08, O09, O10, O11, O12, O13 | `src/lib/handlers/ownership.mjs`       |
| [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)                           | Dynamic API Mutation                             | -             | M01, M02, M03, M04, M05, M06, M07, M08, M09                     | `src/lib/handlers/api-manager.mjs`     |
| [Rule 19](../API-RULES.md#rule-19-versioned-mounts)                               | Versioned Mounts                                 | -             | V01, V02, V03, V04, V05, V06, V07, V08                          | `src/lib/handlers/version-manager.mjs` |
| [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)                   | Stackable Routines & Cascades                    | -             | T01, T02, T03, T04, T05, T06, T07, T08, T09, T10                | `src/lib/handlers/routine-manager.mjs` |
| [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface)                | Reserved Keys & Built-in Surface                 | -             | B01, B02, B03, B04                                              | `src/lib/builders/api_builder.mjs`     |

<!-- /MAPPING:RULES -->

> **Invariants** (enforced by `tests/vitests/suites/rules/rule-coverage.test.vitest.mjs`): every condition ties to ≥1 rule; every F## ties to ≥1 rule; every rule has ≥1 condition **or** F##. Rules 3, 14–21 have no `C##` (their conditions are in the `G/N/O/M/V/T/B` series); Rule 12 is satisfied by F07 + the `O##` ownership conditions.

---

## Inverse Index: Flattening Pattern → Rule

| Pattern                                                                                         | Rules                   | Conditions          |
| ----------------------------------------------------------------------------------------------- | ----------------------- | ------------------- |
| [F01: Basic Flattening](API-FLATTENING.md#f01-basic-flattening-rules)                           | Rule 1, Rule 2          | C05, C09, C09b, C13 |
| [F02: Function Folder Matching](API-FLATTENING.md#f02-function-folder-matching)                 | Rule 7, Rule 8, Rule 10 | C12, C14            |
| [F03: Auto-Flatten Single Named Export](API-FLATTENING.md#f03-auto-flatten-single-named-export) | Rule 7                  | C04, C08            |
| [F04: Default Export Object Flattening](API-FLATTENING.md#f04-default-export-object-flattening) | Rule 4, Rule 8          | C11, C17            |
| [F05: Module Processing Pipeline](API-FLATTENING.md#f05-module-processing-pipeline)             | Rule 5, Rule 8          | C02, C03            |
| [F06: AddApi Special File Pattern](API-FLATTENING.md#f06-addapi-special-file-pattern)           | Rule 11                 | C33                 |
| [F07: Ownership and Module Identity](API-FLATTENING.md#f07-ownership-and-module-identity)       | Rule 12                 | O14, O15            |
| [F08: AddApi Path Deduplication](API-FLATTENING.md#f08-addapi-path-deduplication-flattening)    | Rule 13                 | C34                 |

---

## Inverse Index: Condition → Rule (`C##` flatten series)

| Condition                                                                             | Rules             |
| ------------------------------------------------------------------------------------- | ----------------- |
| [C01](API-RULES-CONDITIONS.md#c01-self-referential-check)                             | Rule 6            |
| [C02](API-RULES-CONDITIONS.md#c02-multi-default-context-with-default-export)          | Rule 5            |
| [C03](API-RULES-CONDITIONS.md#c03-multi-default-context-without-default-export)       | Rule 5            |
| [C04](API-RULES-CONDITIONS.md#c04-auto-flatten-single-named-export-matching-filename) | Rule 7            |
| [C05](API-RULES-CONDITIONS.md#c05-filename-matches-container--category-level-flatten) | Rule 1            |
| [C07](API-RULES-CONDITIONS.md#c07-default-fallback--preserve-as-namespace)            | Rule 2 (fallback) |
| [C08](API-RULES-CONDITIONS.md#c08-auto-flattening)                                    | Rule 7            |
| [C09](API-RULES-CONDITIONS.md#c09-flatten-to-rootcategory)                            | Rule 1            |
| [C09a](API-RULES-CONDITIONS.md#c09a-self-referential-non-function)                    | Rule 6            |
| [C09b](API-RULES-CONDITIONS.md#c09b-traditional-namespace-preservation)               | Rule 1            |
| [C10](API-RULES-CONDITIONS.md#c10-single-file-function--folder-match)                 | Rule 2            |
| [C11](API-RULES-CONDITIONS.md#c11-default-export-flattening)                          | Rule 4, Rule 8    |
| [C12](API-RULES-CONDITIONS.md#c12-object-auto-flatten)                                | Rule 7            |
| [C13](API-RULES-CONDITIONS.md#c13-filename--folder-exact-match-flattening)            | Rule 1, Rule 2    |
| [C14](API-RULES-CONDITIONS.md#c14-parent-level-flattening--generic-filenames)         | Rule 10           |
| [C15](API-RULES-CONDITIONS.md#c15-function-name-matches-folder)                       | Rule 9            |
| [C16](API-RULES-CONDITIONS.md#c16-function-name-preference)                           | Rule 9            |
| [C17](API-RULES-CONDITIONS.md#c17-default-function-export-flattening)                 | Rule 4, Rule 8    |
| [C18](API-RULES-CONDITIONS.md#c18-object-auto-flatten--final-check)                   | Rule 7            |
| [C33](API-RULES-CONDITIONS.md#c33-addapi-special-file-detection)                      | Rule 11           |
| [C34](API-RULES-CONDITIONS.md#c34-addapi-path-deduplication)                          | Rule 13           |

Non-`C##` series (`G/N/O/M/V/T/B`) tie to their rules directly in the traceability matrix above and are documented in their per-family condition files.

---

## Implementation Files Reference

| File                                   | Responsibilities                                                                                                | Rules       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| `src/lib/processors/flatten.mjs`       | Core flattening decision logic - `getFlatteningDecision()`, `processModuleForAPI()`, `buildCategoryDecisions()` | Rules 1-11  |
| `src/lib/processors/loader.mjs`        | API directory scan & inclusion (extension/hidden/depth/reserved gating, empty-folder skip)                      | Rules 3, 14 |
| `src/lib/helpers/module-discovery.mjs` | External-module discovery (validity, dedupe, mode detect, content filter)                                       | Rule 15     |
| `src/lib/helpers/sanitize.mjs`         | Leaf-name derivation / sanitization                                                                             | Rule 16     |
| `src/lib/handlers/ownership.mjs`       | Module ownership stack + collision resolution (`impl:created`/`impl:changed`)                                   | Rules 12,17 |
| `src/lib/builders/api-assignment.mjs`  | Collision-mode value execution / merge                                                                          | Rule 17     |
| `src/lib/handlers/api-manager.mjs`     | Dynamic add/remove/reload/mount, AddApi path dedup, versioned-add rollback                                      | Rules 13,18 |
| `src/lib/handlers/version-manager.mjs` | Versioned mounts (dispatch, default resolution)                                                                 | Rule 19     |
| `src/lib/handlers/routine-manager.mjs` | Stackable routines & cascades                                                                                   | Rule 20     |
| `src/lib/builders/api_builder.mjs`     | Reserved keys & the `slothlet.*` built-in surface                                                               | Rule 21     |

---

## Notes

### Rules without a `C##` condition

Rules **3, 14, 15, 16, 17, 18, 19, 20, 21** carry conditions in the non-`C##` series (`G/N/O/M/V/T/B`), not in the flatten `C##` series. Rule **12** (ownership) has no flatten condition either — it is satisfied by `F07` plus the `O##` ownership conditions (O14/O15). These are the rules the coverage test allows to have an empty `C##` set; every other rule must map at least one `C##`.

### Rule 3 - No Empty Leaves spans families

Rule 3 is realized at three layers: `G06` (empty folder, discovery), `M04`/`M05` (empty add + empty-ancestor prune, mutation), and the empty-value leaf placement in `modes-processor.mjs`. It therefore has no single `C##` and no `F##`.

### C11 / C17 - Dual-Rule Applicability

Conditions C11 and C17 contribute to both Rule 4 (Default Export Promotion) and Rule 8 (Object/Namespace Default Flattening). The same source condition fires in both single-file and multi-file directory contexts; the rule that applies depends on the surrounding directory structure and depth.

### C07 - Fallback

C07 (the `else` branch of `getFlatteningDecision()`) is Rule 2's preserve-as-namespace fallback; it only fires when no affirmative condition matches. It is a known code marker that the coverage test treats as a permitted orphan alongside C06.

### C06 - Deliberately Not Implemented

C06 is retained in the conditions reference as a deliberately-unimplemented placeholder so its number is not reused; it has no active code path and is a permitted orphan in the coverage test.
