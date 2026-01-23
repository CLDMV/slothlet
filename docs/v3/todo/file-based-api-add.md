# File-Based api.add() Feature

## Current Limitation

Currently, `api.slothlet.api.add()` only accepts directory paths and loads all modules from that directory. There is no way to add a single file module to the API dynamically.

## Proposed Feature

Add support for file-based `api.add()` to allow adding individual module files to the API at runtime.

### Use Cases

1. **Selective module loading**: Load only specific modules without needing to organize them into separate directories
2. **Dynamic single-file plugins**: Add single-file plugins or extensions without directory structure requirements
3. **Testing**: Easier to test collision scenarios with individual files
4. **Runtime module injection**: Inject specific module files based on runtime conditions

### API Design

```javascript
// Current (directory-based)
await api.slothlet.api.add("namespace", "./path/to/directory");

// Proposed (file-based)
await api.slothlet.api.add("namespace", "./path/to/module.mjs");
await api.slothlet.api.add("namespace", "./path/to/module.cjs");

// Auto-detect based on path
if (path.endsWith('.mjs') || path.endsWith('.cjs') || path.endsWith('.js')) {
    // Load as single file
} else {
    // Load as directory (current behavior)
}
```

### Implementation Considerations

1. **Path Detection**: Check if path is a file or directory using `fs.stat()`
2. **Module Loading**: Use existing module loading logic but skip directory traversal
3. **Namespace Assignment**: File should be loaded into the specified namespace
4. **Collision Handling**: Should respect `collision.addApi` configuration
5. **Ownership**: Register ownership for the loaded module
6. **Error Handling**: Clear errors for missing files vs missing directories

### Priority

Medium - Not blocking but would improve API flexibility and testing capabilities.

### Related Issues

- Tests in `tests/vitests/suites/config/collision-config.test.vitest.mjs` currently attempt file-based loading but fail with `INVALID_CONFIG_DIR_INVALID` error
- Collision testing would be simpler with file-based loading
