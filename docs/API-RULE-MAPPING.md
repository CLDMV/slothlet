# Slothlet Rule Mapping Reference

**Complete Traceability Matrix: Rule # ↔ F## ↔ C##**

- **Version**: 1.0
- **Date**: January 17, 2026
- **Purpose**: Machine-readable mapping table for automated validation of rule coverage in codebase
- **Status**: ✅ **ACTIVE** - Used by vitest test suite to verify rule implementation

---

## Purpose

This document provides a **parseable mapping table** that connects:
- **Rule #** (1-12): High-level API behavior rules from [API-RULES.md](API-RULES.md)
- **F##** (F01-F07): User-facing flattening patterns from [API-FLATTENING.md](API-FLATTENING.md)
- **C##** (C01-C18): Low-level code conditions from [API-RULES-CONDITIONS.md](API-RULES-CONDITIONS.md)

The test suite `tests/vitests/rule-coverage.test.mjs` uses this mapping to ensure:
1. All C## conditions are implemented in `src3/lib/helpers/flatten.mjs`
2. All C## conditions reference their parent F## pattern
3. All C## conditions reference their parent Rule #
4. Documentation stays in sync with implementation

---

## Comment Format Standard

All C## conditions in code MUST follow this exact format for automated validation:

### Format Pattern
```javascript
// Rule X (FXX, FYY) - CZZ: Description
// OR (if no F## pattern):
// Rule X - CZZ: Description
```

### Examples
```javascript
// Rule 1 (F01) - C05: Filename matches container
// Rule 7 (F02, F03) - C04: Auto-flatten single named export
// Rule 3 - C10: Single-file function folder match
```

### Multi-Rule Conditions
Some conditions (like C09b, C16) are used by multiple rules. Each occurrence should document ALL applicable rules:

```javascript
// Rule 1 (F01), Rule 2 - C09b: Traditional namespace preservation
// Rule 4, Rule 9 - C16: Function name preference
```

---

## Mapping Table

| Rule # | F##           | C##                          | Rule Name                                      | Implementation File |
|--------|---------------|------------------------------|------------------------------------------------|---------------------|
| 1      | F01           | C05, C09, C09b, C13          | Filename Matches Container Flattening          | flatten.mjs         |
| 2      | -             | C06, C07, C09b               | Named-Only Export Collection                   | flatten.mjs         |
| 3      | -             | C10                          | Empty Module Handling                          | flatten.mjs         |
| 4      | -             | C16                          | Named Export with Function Name Preservation   | flatten.mjs         |
| 5      | -             | C02, C03                     | Multiple Module Default Export Handling        | flatten.mjs         |
| 6      | -             | C01, C09a                    | Multiple Module Mixed Exports                  | flatten.mjs         |
| 7      | F02, F03      | C04, C08, C12, C18           | Single Module Named Export Flattening          | flatten.mjs         |
| 8      | F02, F04, F05 | C11, C17                     | Single Module Default Export Promotion         | flatten.mjs         |
| 9      | -             | C15, C16                     | Function Name Preference Over Sanitization     | flatten.mjs         |
| 10     | F02           | C14                          | Generic Filename Parent-Level Promotion        | flatten.mjs         |
| 11     | F06           | -                            | AddApi Special File Pattern                    | modes.mjs (runtime) |
| 12     | F07           | -                            | Module Ownership and Selective API Overwriting | ownership.mjs (runtime) |

**Note**: **C06 is intentionally not implemented** (architectural decision). The original concept was "auto-flatten single file directories" but this was rejected because it reduces API path flexibility. It exists as a placeholder in the C01-C18 sequence to maintain consistent numbering. Users should use other rules (like C05 filename matching) if they want flattening.

---

## Rule Categories

### Flattening Rules (Have F## Patterns)
- **Rule 1** (F01): Folder/file name matching
- **Rule 7** (F02, F03): Single module named export flattening
- **Rule 8** (F02, F04, F05): Single module default export promotion
- **Rule 10** (F02): Generic filename promotion
- **Rule 11** (F06): AddApi special file pattern
- **Rule 12** (F07): AddApi root-level file matching

### Non-Flattening Rules (No F## Pattern)
- **Rule 2**: Named-only export collection
- **Rule 3**: Empty module handling
- **Rule 4**: Function name preservation
- **Rule 5**: Multiple module default exports
- **Rule 6**: Multiple module mixed exports
- **Rule 9**: Function name preference

---

## Condition Details

### C## Conditions by Category

#### Core Flattening Decisions (C01-C07)
- **C01**: Self-referential check - preserve namespace
- **C02**: Multi-default with default export - preserve namespace
- **C03**: Multi-default without default - flatten
- **C04**: Auto-flatten single named export matching filename
- **C05**: Filename matches container - flatten to category
- **C06**: Single file context (DEPRECATED)
- **C07**: Default fallback - preserve as namespace

#### Module Processing (C08-C09b)
- **C08**: Auto-flattening processing
- **C09**: Flatten to root/category processing
- **C09a**: Self-referential non-function
- **C09b**: Traditional namespace preservation

#### Category-Level Flattening (C10-C18)
- **C10**: Single-file function folder match
- **C11**: Default export flattening
- **C12**: Object auto-flatten
- **C13**: Filename-folder exact match flattening
- **C14**: Parent-level flattening (generic filenames)
- **C15**: Function name matches folder
- **C16**: Function name preference
- **C17**: Default function export flattening
- **C18**: Object auto-flatten (final check)

---

## Test Suite Usage

The vitest test `tests/vitests/rule-coverage.test.mjs` parses this table to:

1. **Extract expected conditions**: Read C## column for each rule
2. **Scan implementation**: Search `src3/lib/helpers/flatten.mjs` for condition comments
3. **Verify presence**: Ensure each C## appears with proper Rule # and F## references
4. **Report gaps**: Fail test if any condition missing or improperly documented

### Expected Comment Format in Code

```javascript
// Rule 1 (F01) - C05: Filename matches container - flatten to category
if (moduleName === categoryName) {
  return {
    flattenToCategory: true,
    reason: "Filename matches category name"
  };
}
```

### Test Assertions

```javascript
// Example assertion pattern
test("C05 is documented with Rule 1 and F01", () => {
  const code = readFileSync("src3/lib/helpers/flatten.mjs", "utf-8");
  expect(code).toMatch(/Rule 1.*F01.*C05/);
  expect(code).toMatch(/C05.*Filename matches container/);
});
```

---

## Maintenance Guidelines

When adding new rules:

1. **Update this table** with new Rule #, F## (if flattening), and C## (if code condition)
2. **Update implementation** in `src3/lib/helpers/flatten.mjs` with proper comments
3. **Run test suite**: `npm run test:unit` to verify coverage
4. **Update docs**: Sync API-RULES.md, API-FLATTENING.md, and API-RULES-CONDITIONS.md

When modifying existing rules:

1. **Check mapping table** to find all affected C## conditions
2. **Update implementation** with new logic
3. **Update comments** to match new behavior
4. **Run tests** to ensure coverage maintained
5. **Update all three docs** if behavior changes

---

## Related Documentation

- **[API-FLATTENING.md](API-FLATTENING.md)**: User guide with F## patterns
- **[API-RULES.md](API-RULES.md)**: Maintainer guide with Rule # behaviors
- **[API-RULES-CONDITIONS.md](API-RULES-CONDITIONS.md)**: Developer guide with C## conditions
- **Implementation**: `src3/lib/helpers/flatten.mjs`
- **Test Suite**: `tests/vitests/rule-coverage.test.mjs`
