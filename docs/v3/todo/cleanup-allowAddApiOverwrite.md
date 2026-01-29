# TODO: Remove `allowAddApiOverwrite` References

**Status:** 🔴 **Blocking v3 Release**  
**Priority:** High  
**Created:** 2026-01-28  

## Overview

The `allowAddApiOverwrite` configuration option has been **removed in v3** and replaced with the more comprehensive collision configuration system (`api.collision.api` modes). However, references to this deprecated option still exist throughout the codebase and need to be cleaned up before v3 release.

## Background

### v2 Configuration (Deprecated)
```javascript
{
  allowAddApiOverwrite: false  // Global toggle for api.add() overwrites
}
```

### v3 Configuration (Current)
```javascript
{
  api: {
    collision: {
      api: "skip" | "warn" | "replace" | "merge" | "merge-replace" | "error"
    }
  }
}
```

The v3 collision system provides much finer control over collision behavior with multiple modes, making the binary `allowAddApiOverwrite` toggle obsolete.

## Known References

### Test Files
- **`tests/vitests/suites/rules/rule-12-comprehensive.test.vitest.mjs`**
  - Line 101: `allowAddApiOverwrite` in test descriptions
  - Lines 166-172: Test case checking `allowAddApiOverwrite: false`
  - Lines 179-210: Multiple tests using `allowAddApiOverwrite: false` config
  - Lines 250-280: Additional lazy mode tests with this option

### Source Code
Search needed for:
- Configuration validation logic
- JSDoc comments referencing the old option
- Any backward compatibility transforms
- Error messages mentioning this option

## Required Actions

### 1. Update Test Suite (rule-12-comprehensive.test.vitest.mjs)
- [ ] Replace `allowAddApiOverwrite: false` with appropriate `api.collision.api` mode
  - For "block overwrites" behavior → use `api: { collision: { api: "skip" } }`
  - For "error on overwrites" behavior → use `api: { collision: { api: "error" } }`
- [ ] Update test descriptions to reference collision modes instead
- [ ] Verify test expectations align with collision mode behavior

### 2. Source Code Cleanup
- [ ] Search for all `allowAddApiOverwrite` references in `src/**`
- [ ] Remove any configuration validation for this option
- [ ] Update JSDoc comments that mention this option
- [ ] Remove any backward compatibility transforms

### 3. Documentation Updates
- [ ] Ensure migration guide explains the replacement
- [ ] Update API documentation to remove references
- [ ] Add to BREAKING-CHANGES-V3.md if not already documented

### 4. Error Messages
- [ ] Search for error messages that reference `allowAddApiOverwrite`
- [ ] Update to reference collision configuration instead

## Migration Example

### Before (v2)
```javascript
const api = await slothlet({
  dir: './api',
  allowAddApiOverwrite: false
});
```

### After (v3)
```javascript
const api = await slothlet({
  dir: './api',
  api: {
    collision: {
      api: "skip"  // or "error" for stricter behavior
    }
  }
});
```

## Testing Strategy

1. Run full test suite after each change
2. Verify collision mode tests still cover ownership behavior
3. Ensure no regression in ownership tracking functionality
4. Test backward compatibility warnings (if any transforms remain)

## Related Issues

- Collision config system: `api.collision.initial` and `api.collision.api`
- Ownership tracking with `moduleId` and `forceOverwrite`
- Hot reload functionality requirements

## Notes

- The ownership tracking system (`moduleId` and `forceOverwrite`) is **still valid** and should remain
- Only the `allowAddApiOverwrite` **configuration option** needs removal
- The underlying behavior (allowing/blocking overwrites) is now controlled by collision modes

---

**Completion Criteria:**
- ✅ Zero references to `allowAddApiOverwrite` in production code (`src/**`)
- ✅ Zero test failures after updates
- ✅ Documentation fully updated
- ✅ Migration path clearly documented
