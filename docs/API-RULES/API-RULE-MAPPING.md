# API Rule Mapping

**Document Hierarchy**:
[API Rules Index](../API-RULES.md) → [Flattening Patterns](API-FLATTENING.md) → [Conditions Reference](API-RULES-CONDITIONS.md) → **Rule Mapping**

**Purpose**: Traceability matrix connecting each rule to its flattening pattern(s), source condition(s), and implementation file(s). Use this to trace a behavior from high-level rule down to exact source code.

---

## Traceability Matrix

<!-- MAPPING:RULES -->

| Rule | Description | F## | C## | Implementation File |
|---|---|---|---|---|
| [Rule 1](../API-RULES.md#rule-1-category-name-matching) | Category Name Matching | [F01](API-FLATTENING.md#f01-basic-flattening-rules) | [C05](API-RULES-CONDITIONS.md#c05-filename-matches-container--category-level-flatten), [C09](API-RULES-CONDITIONS.md#c09-flatten-to-rootcategory), [C09b](API-RULES-CONDITIONS.md#c09b-traditional-namespace-preservation), [C13](API-RULES-CONDITIONS.md#c13-filename--folder-exact-match-flattening) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 2](../API-RULES.md#rule-2-single-function-file-promotion) | Single Function File Promotion | - | [C10](API-RULES-CONDITIONS.md#c10-single-file-function--folder-match), [C13](API-RULES-CONDITIONS.md#c13-filename--folder-exact-match-flattening) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 3](../API-RULES.md#rule-3-nested-category-mirroring) | Nested Category Mirroring | - | [C10](API-RULES-CONDITIONS.md#c10-single-file-function--folder-match) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 4](../API-RULES.md#rule-4-default-export-promotion) | Default Export Promotion | - | [C11](API-RULES-CONDITIONS.md#c11-default-export-flattening), [C17](API-RULES-CONDITIONS.md#c17-default-function-export-flattening) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 5](../API-RULES.md#rule-5-multi-default-export-coordination) | Multi-Default Export Coordination | - | [C02](API-RULES-CONDITIONS.md#c02-multi-default-context-with-default-export), [C03](API-RULES-CONDITIONS.md#c03-multi-default-context-without-default-export) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 6](../API-RULES.md#rule-6-self-referential-circular-reference-prevention) | Self-Referential / Circular Reference Prevention | - | [C01](API-RULES-CONDITIONS.md#c01-self-referential-check), [C09a](API-RULES-CONDITIONS.md#c09a-self-referential-non-function) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export) | Auto-Flattening - Single Named Export | [F03](API-FLATTENING.md#f03-auto-flatten-single-named-export) | [C04](API-RULES-CONDITIONS.md#c04-auto-flatten-single-named-export-matching-filename), [C08](API-RULES-CONDITIONS.md#c08-auto-flattening), [C12](API-RULES-CONDITIONS.md#c12-object-auto-flatten), [C18](API-RULES-CONDITIONS.md#c18-object-auto-flatten--final-check) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 8](../API-RULES.md#rule-8-object-namespace-default-flattening) | Object / Namespace Default Flattening | [F02](API-FLATTENING.md#f02-function-folder-matching), [F04](API-FLATTENING.md#f04-default-export-object-flattening), [F05](API-FLATTENING.md#f05-module-processing-pipeline) | [C11](API-RULES-CONDITIONS.md#c11-default-export-flattening), [C17](API-RULES-CONDITIONS.md#c17-default-function-export-flattening) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 9](../API-RULES.md#rule-9-function-name-preference) | Function Name Preference | - | [C15](API-RULES-CONDITIONS.md#c15-function-name-matches-folder), [C16](API-RULES-CONDITIONS.md#c16-function-name-preference) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 10](../API-RULES.md#rule-10-parent-level-promotion-generic-filenames) | Parent-Level Promotion - Generic Filenames | [F02](API-FLATTENING.md#f02-function-folder-matching) | [C14](API-RULES-CONDITIONS.md#c14-parent-level-flattening--generic-filenames) | `src/lib/helpers/api_builder/decisions.mjs` |
| [Rule 11](../API-RULES.md#rule-11-addapi-special-file-pattern) | AddApi Special File Pattern | [F06](API-FLATTENING.md#f06-addapi-special-file-pattern) | [C33](API-RULES-CONDITIONS.md#c33-addapi-special-file-detection) | `src/lib/helpers/api_builder/add_api.mjs` |
| [Rule 12](../API-RULES.md#rule-12-module-ownership-and-selective-api-overwriting) | Module Ownership and Selective API Overwriting | [F07](API-FLATTENING.md#f07-ownership-and-module-identity) | - | `src/lib/handlers/ownership.mjs` |
| [Rule 13](../API-RULES.md#rule-13-addapi-path-deduplication-flattening) | AddApi Path Deduplication Flattening *(New in v3)* | [F08](API-FLATTENING.md#f08-addapi-path-deduplication-flattening) | [C34](API-RULES-CONDITIONS.md#c34-addapi-path-deduplication) | `src/lib/handlers/api-manager.mjs` |

<!-- /MAPPING:RULES -->

---

## Inverse Index: Flattening Pattern → Rule

| Pattern | Rules | Conditions |
|---|---|---|
| [F01: Basic Flattening](API-FLATTENING.md#f01-basic-flattening-rules) | Rule 1, Rule 6 | C01, C05, C07 |
| [F02: Function Folder Matching](API-FLATTENING.md#f02-function-folder-matching) | Rule 8, Rule 10 | C10, C14, C15 |
| [F03: Auto-Flatten Single Named Export](API-FLATTENING.md#f03-auto-flatten-single-named-export) | Rule 7 | C04, C08 |
| [F04: Default Export Object Flattening](API-FLATTENING.md#f04-default-export-object-flattening) | Rule 4, Rule 8 | C11, C12 |
| [F05: Module Processing Pipeline](API-FLATTENING.md#f05-module-processing-pipeline) | Rule 1, Rule 5 | C08, C09, C09b |
| [F06: AddApi Special File Pattern](API-FLATTENING.md#f06-addapi-special-file-pattern) | Rule 11 | C33 |
| [F07: Ownership and Module Identity](API-FLATTENING.md#f07-ownership-and-module-identity) | Rule 12 | - |
| [F08: AddApi Path Deduplication](API-FLATTENING.md#f08-addapi-path-deduplication-flattening) | Rule 13 | C34 |

---

## Inverse Index: Condition → Rule

| Condition | Rules |
|---|---|
| [C01](API-RULES-CONDITIONS.md#c01-self-referential-check) | Rule 6 |
| [C02](API-RULES-CONDITIONS.md#c02-multi-default-context-with-default-export) | Rule 5 |
| [C03](API-RULES-CONDITIONS.md#c03-multi-default-context-without-default-export) | Rule 5 |
| [C04](API-RULES-CONDITIONS.md#c04-auto-flatten-single-named-export-matching-filename) | Rule 7 |
| [C05](API-RULES-CONDITIONS.md#c05-filename-matches-container--category-level-flatten) | Rule 1 |
| [C07](API-RULES-CONDITIONS.md#c07-default-fallback--preserve-as-namespace) | All (fallback) |
| [C08](API-RULES-CONDITIONS.md#c08-auto-flattening) | Rule 7 |
| [C09](API-RULES-CONDITIONS.md#c09-flatten-to-rootcategory) | Rule 1, Rule 5 |
| [C09a](API-RULES-CONDITIONS.md#c09a-self-referential-non-function) | Rule 6 |
| [C09b](API-RULES-CONDITIONS.md#c09b-traditional-namespace-preservation) | Rule 1 (fallback) |
| [C10](API-RULES-CONDITIONS.md#c10-single-file-function--folder-match) | Rule 2, Rule 3 |
| [C11](API-RULES-CONDITIONS.md#c11-default-export-flattening) | Rule 4, Rule 8 |
| [C12](API-RULES-CONDITIONS.md#c12-object-auto-flatten) | Rule 7, Rule 8 |
| [C13](API-RULES-CONDITIONS.md#c13-filename--folder-exact-match-flattening) | Rule 1, Rule 2 |
| [C14](API-RULES-CONDITIONS.md#c14-parent-level-flattening--generic-filenames) | Rule 10 |
| [C15](API-RULES-CONDITIONS.md#c15-function-name-matches-folder) | Rule 9 |
| [C16](API-RULES-CONDITIONS.md#c16-function-name-preference) | Rule 9 |
| [C17](API-RULES-CONDITIONS.md#c17-default-function-export-flattening) | Rule 4, Rule 8 |
| [C18](API-RULES-CONDITIONS.md#c18-object-auto-flatten--final-check) | Rule 7 |
| [C33](API-RULES-CONDITIONS.md#c33-addapi-special-file-detection) | Rule 11 |
| [C34](API-RULES-CONDITIONS.md#c34-addapi-path-deduplication) | Rule 13 |

---

## Implementation Files Reference

| File | Responsibilities | Rules |
|---|---|---|
| `src/lib/helpers/api_builder/decisions.mjs` | Core flattening decision logic - `getFlatteningDecision()`, `processModuleForAPI()`, `buildCategoryDecisions()` | Rules 1-10 |
| `src/lib/helpers/api_builder/add_api.mjs` | AddApi special file detection and module merging | Rule 11 |
| `src/lib/handlers/ownership.mjs` | Module ownership stack - tracks which module "owns" each API path; event-driven via `impl:created` / `impl:changed` lifecycle events | Rule 12 |
| `src/lib/handlers/api-manager.mjs` | AddApi path deduplication via `isDirectChild` guard in `addApiComponent()` | Rule 13 |

---

## Notes

### Rule 12 - No C## Condition

Rule 12 (Module Ownership) operates at the handler level, not the condition level. The ownership system is event-driven (`impl:created`, `impl:changed`) and does not participate in the `getFlatteningDecision()` / `buildCategoryDecisions()` decision pipeline. For this reason, Rule 12 has no associated C## entry - its implementation is entirely within `src/lib/handlers/ownership.mjs`.

### Rule 13 - New in v3

Rule 13 (AddApi Path Deduplication) does not exist in v2. The `isDirectChild` guard and the post-`buildAPI` hoisting logic in `addApiComponent()` were added as part of the v3 rewrite. See [F08](API-FLATTENING.md#f08-addapi-path-deduplication-flattening) and [C34](API-RULES-CONDITIONS.md#c34-addapi-path-deduplication) for full details.

### C11 / C17 - Dual-Rule Applicability

Conditions C11 and C17 contribute to both Rule 4 (Default Export Promotion) and Rule 8 (Object/Namespace Default Flattening). The same source condition fires in both single-file and multi-file directory contexts; the rule that applies depends on the surrounding directory structure and depth.

### C07 - Universal Fallback

C07 (the `else` branch of `getFlatteningDecision()`) is a fallback for all rules. It is not assigned to a specific rule because it only fires when no affirmative condition matches. It is included in the cross-reference index but excluded from the main traceability matrix.
