# Collision Modes

**Version:** 3.x  
**Feature:** Unified Collision Configuration

## Overview

Slothlet uses a collision mode system to control what happens when two sources try to occupy the same API path. There are **6 modes** and **2 contexts** where they apply.

## Configuration

```js
// String shorthand - applies to both contexts
await slothlet({ dir: "./api", collision: "merge" });

// Per-context object
await slothlet({
  dir: "./api",
  api: {
    collision: {
      initial: "merge",       // During load()
      api: "merge-replace"    // During api.add()
    }
  }
});
```

- Mode strings are **case-insensitive** (`"MERGE"` → `"merge"`).
- Invalid mode strings **default to `"merge"`**.

## Contexts

### `collision.initial` - During `load()`

Controls what happens when two sources collide during the initial module load. The most common scenario is a **file and folder sharing the same name** (e.g., `math.mjs` and `math/`), but the system is order-based - it's always **first loaded vs. second loaded**, not file-specific.

Files are processed before directories, so in a file-folder collision the file is "first" and the folder is "second".

### `collision.api` - During `api.add()`

Controls what happens when a newly-added module collides with existing API paths. This mode governs **both**:

1. Building the added module's internal API cache (file-folder collisions within that module)
2. Merging the built cache onto the public API (key-level collisions with existing paths)

The existing API is "first" and the newly-added module is "second".

## Modes

### `merge` (default)

Both sources are merged into the result. **First loaded wins** on conflicting keys. Non-conflicting keys from both sources are added.

| | Conflicting Key | Non-Conflicting Key |
|---|---|---|
| **First** | ✅ Kept | ✅ Kept |
| **Second** | ❌ Discarded | ✅ Added |

**Example:** `math.mjs` exports `add(a,b) => a+b+1000` and `collisionVersion`. `math/math.mjs` exports `add(a,b) => a+b`, `multiply`, `divide`.

- `math.add(2,3)` → `1005` (file's version - first loaded wins)
- `math.collisionVersion` → `"collision-math-file"` (from file - non-conflicting, kept)
- `math.multiply(2,3)` → `6` (from folder - non-conflicting, added)

### `merge-replace`

Both sources are merged into the result. **Second loaded wins** on conflicting keys (replaces first). Non-conflicting keys from both sources are added.

| | Conflicting Key | Non-Conflicting Key |
|---|---|---|
| **First** | ❌ Replaced | ✅ Kept |
| **Second** | ✅ Wins | ✅ Added |

**Example:** Same `math.mjs` + `math/math.mjs` scenario:

- `math.add(2,3)` → `5` (folder's version - second replaces first)
- `math.collisionVersion` → `"collision-math-file"` (from file - non-conflicting, still kept)
- `math.multiply(2,3)` → `6` (from folder - non-conflicting, added)

### `replace`

Second loaded **completely replaces** first. Only one source survives - the last one to load. No merging occurs.

| | All Keys |
|---|---|
| **First** | ❌ Gone |
| **Second** | ✅ Only source |

**Example:** Only folder exports (`add`, `multiply`, `divide`) survive. File exports (`collisionVersion`) are gone.

### `skip`

First loaded is **kept entirely**. Second is **silently discarded**. No merging occurs.

| | All Keys |
|---|---|
| **First** | ✅ Only source |
| **Second** | ❌ Discarded |

**Example:** Only file exports (`add` returning 1005, `collisionVersion`) survive. Folder exports (`multiply`, `divide`) are never added.

### `warn`

Identical to `merge`, but logs a console warning when a collision is detected.

### `error`

Throws a `SlothletError` when a collision is detected. No assignment occurs.

## File-Folder Collision Processing Order

During `processFiles`, the system processes entries in this order:

1. **Files** in the directory are loaded first (always eagerly, even in lazy mode for root-level files)
2. **Directories** are processed second (eagerly or as lazy wrappers depending on mode)

When a file and folder share the same name (e.g., `math.mjs` + `math/`), the file's wrapper is created first at `api.math`. When the folder is then processed, it triggers collision detection with the configured mode.

## Test Fixtures

### `api_test/` - Primary collision test directory

| Source | Exports | `add(2,3)` returns |
|---|---|---|
| `math.mjs` (file) | `add`, `collisionVersion` | `1005` |
| `math/math.mjs` (folder) | `add`, `multiply`, `divide` | `5` |

File and folder share the `add` key - used to verify which source wins per mode.

### `api_test_collisions/` - Secondary collision test directory

| Source | Exports | Unique keys |
|---|---|---|
| `math.mjs` (file) | `power`, `sqrt`, `modulo`, `collisionVersion` | `power`, `sqrt`, `modulo` |
| `math/math.mjs` (folder) | `add`, `multiply`, `divide` | `add`, `multiply`, `divide` |

File and folder have **zero overlapping keys** - useful for testing that non-conflicting keys from both sources appear in merge modes and only one source survives in replace/skip modes.

## `collision.api` Behavior Summary

| Mode | Existing API | New Module | Result |
|---|---|---|---|
| `merge` | Preserved entirely | New keys added, conflicts discarded | Both coexist, existing wins conflicts |
| `merge-replace` | Non-conflicting preserved | New keys added, conflicts replace existing | Both coexist, new wins conflicts |
| `replace` | Completely replaced | Takes over the path | Only new module |
| `skip` | Preserved entirely | Silently ignored | Only existing |
| `warn` | Same as `merge` | Same as `merge` + warning | Same as `merge` |
| `error` | Preserved (error thrown) | Not applied | Throws |
