# API Naming Conditions (N##)

Leaf-name derivation conditions — how a filename or export name becomes the api accessor key. These run during composition, after a file is included (`G##`) and as it is placed (`C##`).

- **Series**: `N##`
- **Rule**: [Rule 16 — Leaf Name Derivation (Sanitization)](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
- Function-name-over-filename preference is a separate, older decision — see [Rule 9](../API-RULES.md#rule-9-function-name-preference) / conditions C15–C16. Load/mount ordering (which affects collision precedence, not naming) is `O12` under [Rule 17](../API-RULES.md#rule-17-collision-resolution).

---

## N01: Base Name = Filename minus Extension

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: The raw name seed for a leaf is the filename with its extension stripped (before sanitization).

**Source(s)**: `src/lib/processors/loader.mjs:533` (`nameWithoutExt`) · `src/lib/helpers/generate-manifest.mjs:145-149` (browser `name` vs `fullName`)

**Trigger**: any included file
**Result**: `name = path.basename(entry.name, ext)` — fed to `sanitizePropertyName`.

---

## N02: All-Uppercase Preservation

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: A wholly-uppercase input (acronym like `IP`, `HTTP`) is preserved verbatim rather than camelCased.

**Source(s)**: `src/lib/helpers/sanitize.mjs:291-293` (whole-string) · `:123` (per-segment)

**Condition Check**:

```javascript
if (preserveAllUpper && isAllUpper) {
	return originalString;
}
```

**Trigger**: `preserveAllUpper && isAllUpper`
**Result**: input returned unchanged; segmentation/camelCasing skipped.
**Note**: unlike N03, this early return does not exclude hyphenated input — a bug for `FOO-BAR`-style names when `preserveAllUpper` is enabled, tracked in [#422](https://github.com/CLDMV/slothlet/issues/422).

---

## N03: All-Lowercase Preservation (no separators)

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: A wholly-lowercase input is preserved verbatim **only when it has no hyphen/separator**; a hyphenated lowercase name falls through to camelCasing.

**Source(s)**: `src/lib/helpers/sanitize.mjs:294-298`

**Condition Check**:

```javascript
if (preserveAllLower && isAllLower && !/-/.test(originalString)) {
	return originalString;
}
```

**Trigger**: `preserveAllLower && isAllLower && !/-/.test(originalString)`
**Result**: verbatim return; `foo-bar` instead proceeds to N04/N05 → `fooBar`.

---

## N04: Primary-Segment Split (hyphen / non-identifier, not underscore)

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: The name is split into camelCase "primary segments" at hyphens and non-identifier runs; underscores do **not** split here (see N07).

**Source(s)**: `src/lib/helpers/sanitize.mjs:302`

**Condition Check**:

```javascript
let primarySegments = originalString.split(/[-]+|[^A-Za-z0-9_$]+/).filter(Boolean);
```

**Trigger**: any name reaching segmentation
**Result**: `foo-bar` → `["foo","bar"]` (→ `fooBar`); `foo_bar` stays one segment (underscore preserved).

---

## N05: camelCase Join (first lower / subsequent titlecase)

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: Primary segments are joined camelCase — the first lowercased (when `lowerFirst`), each subsequent title-cased (unless a `lower` rule already applied to it).

**Source(s)**: `src/lib/helpers/sanitize.mjs:392-403`

**Trigger**: `idx === 0` → lower-first; else title-case unless `lowerRuleApplied[idx]`
**Result**: `auto-ip` → `autoIp`, `root-math` → `rootMath`.

---

## N06: Configured Naming-Rule Cascade

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: Per-segment, a configured rule cascade decides preservation/casing — in order: exact `leave`, case-insensitive `leaveInsensitive`, all-upper preserve, all-lower preserve, `upper`/`lower` glob-force, within-segment substring patterns, else default.

**Source(s)**: `src/lib/helpers/sanitize.mjs:108-166` (`#applySegmentRules`, locally numbered "Rule 1–7")

**Trigger**: per-segment pattern match against the configured `rules`
**Result**: segment forced to preserve / upper / lower / substring-replaced, or returned unchanged.

---

## N07: Underscore Preserved Literally within a Segment

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: Underscores inside a primary segment survive literally into the identifier — they are neither stripped nor treated as camelCase boundaries.

**Source(s)**: `src/lib/helpers/sanitize.mjs:320-370`

**Condition Check**:

```javascript
const parts = primarySeg.split(/(_+)/);
// odd index = separator run, kept verbatim; even index → #applySegmentRules
```

**Trigger**: `_` present within a primary segment
**Result**: `foo_bar` keeps its underscore.

---

## N08: Illegal-Character Handling

**Related Rule**: [Rule 16](../API-RULES.md#rule-16-leaf-name-derivation-sanitization)
**Status**: ✅ Active

**Pattern**: Non-identifier characters are normalized so the result is always a valid JS identifier: an all-illegal input becomes `_`, leading invalid characters are stripped, and any survivor is removed after the join.

**Source(s)**: `src/lib/helpers/sanitize.mjs:305,312` (empty → `_`) · `:308-311` (leading-invalid strip) · `:409-410` (final strip)

**Condition Check**:

```javascript
if (primarySegments.length === 0) return "_";
// … strip leading non-identifier chars from the first segment …
result = result.replace(/[^A-Za-z0-9_$]/g, ""); // final
```

**Trigger**: non-identifier characters present
**Result**: a valid JS identifier (worst case `_`).

---

_Naming family: N01–N08, all under Rule 16. Function-name preference stays C15/C16 (Rule 9). `shouldPreserveFunctionCase` (sanitize.mjs:437) is dead in `src` (test-only) — not catalogued._
