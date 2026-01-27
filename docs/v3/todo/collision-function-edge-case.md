# Collision Edge Case: File Export as Function

## Scenario

When a file (e.g., `math.mjs`) collides with a folder (e.g., `math/`), the current behavior is:

- **Merge mode**: Folder's lazy proxy takes over the `api.math` position
- File's exports are attached to the lazy proxy during merge
- Lazy folder proxy materializes and includes both file and folder exports

## Edge Case: File Export is a Callable Function

**Current assumption**: File exports are always objects with named exports (e.g., `export const power = ...`)

**Unhandled edge case**: What if the file's default export is itself a callable function?

```javascript
// math.mjs (file)
export default function math(x, y) {
    return x + y;
}
math.power = (x, y) => x ** y;
math.sqrt = (x) => Math.sqrt(x);
```

In this case:
- The file export is a **callable function** with properties
- The folder also wants to be the `api.math` object
- Collision handling needs to decide: callable function or object namespace?

## Current Behavior

**Likely**: The lazy folder proxy (object) would overwrite the callable function from the file, losing the callable nature.

## Questions to Address

1. Should merge mode preserve the callable nature if the file export is a function?
2. Should the folder's lazy proxy become a callable proxy that also has folder methods?
3. Or should this scenario trigger a different collision warning?

## Testing Status

**No test coverage exists for this edge case.**

Recommended test scenario:
- Create `collision-callable/` test directory
- `math.mjs` - default export callable function with methods
- `math/` folder - contains additional module files
- Test all collision modes (merge, warn, replace) with callable file exports

## Priority

Low - unusual pattern, but should be documented and eventually tested.

## Related Files

- `src/lib/builders/api-assignment.mjs` - Collision handling logic
- `src/lib/modes/lazy.mjs` - Lazy proxy materialization
- `tests/vitests/suites/metadata/metadata-collision-modes.test.vitest.mjs` - Collision test suite
