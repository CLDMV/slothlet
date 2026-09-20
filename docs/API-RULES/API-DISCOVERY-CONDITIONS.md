# API Discovery Conditions (G##)

Discovery/inclusion conditions — the decisions that determine **which files, folders, and packages become part of the api**, before any flattening or placement runs. These sit ahead of the flatten pipeline (`C##`) and feed it the module set.

- **Series**: `G##` (the code already tags several of these `G3`/`G6`/`G7` in `module-discovery.mjs` / `module-manifest-validator.mjs`).
- **Rules**: [Rule 14 — API Directory Scan & Inclusion](../API-RULES.md#rule-14-api-directory-scan--inclusion) (G01–G08) and [Rule 15 — External Module Discovery](../API-RULES.md#rule-15-external-module-discovery) (G09–G14). G06 also serves [Rule 3 — No Empty Leaves](../API-RULES.md#rule-3-no-empty-leaves).
- **Dedup**: a condition realized at more than one site (disk scan, browser manifest, build-time generator) is ONE `G##` with multiple `Source` lines.

---

## G01: Loadable-Extension Gate

**Related Rule**: [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion)
**Status**: ✅ Active

**Pattern**: Only files whose extension is in the active allowlist become leaves; any other file type is invisible to the api (no error).

**Source(s)**:

- `src/lib/processors/loader.mjs:521-522` — disk scan (`.mjs`/`.cjs`/`.js`, plus `.ts`/`.mts` when TypeScript is enabled)
- `src/lib/processors/loader.mjs:682,692` — browser-manifest read (`.mjs`/`.cjs`/`.js` only)
- `src/lib/helpers/generate-manifest.mjs:110,176` — build-time generator (`LOADABLE_EXTENSIONS`)

**Condition Check**:

```javascript
const ext = path.extname(entry.name);
if (extensions.includes(ext)) {
	/* … include … */
} // disk
// browser: const ALLOWED_EXTS = [".mjs", ".cjs", ".js"]; if (!ALLOWED_EXTS.includes(ext)) continue;
```

**Trigger**: `extensions.includes(ext)` (disk) / `ALLOWED_EXTS.includes(ext)` (browser)
**Result**: file pushed to `structure.files` only when its extension is allowed; otherwise skipped silently.
**Note**: the browser path excludes `.ts` on purpose — TypeScript must be built for the browser (it is optional for Node). The generator listing `.ts` in `LOADABLE_EXTENSIONS` is a known minor over-inclusion (tracked in [#423](https://github.com/CLDMV/slothlet/issues/423)).

---

## G02: Hidden Folder Exclusion (dot / `__` prefix)

**Related Rule**: [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion)
**Status**: ✅ Active

**Pattern**: A folder whose name starts with `.` or `__` is skipped, unless the deprecated `scanHiddenFolders` opt-out is set.

**Source(s)**: `src/lib/processors/loader.mjs:491-495` · `src/lib/helpers/generate-manifest.mjs:116,173` (build, no opt-out)

**Condition Check**:

```javascript
if (!scanHiddenFolders && hasHiddenPrefix(entry.name)) { continue; }
```

**Trigger**: `!scanHiddenFolders && hasHiddenPrefix(entry.name)`
**Result**: `continue` — the folder (and its subtree) never becomes a namespace.

---

## G03: Hidden File Exclusion (dot / `__` prefix)

**Related Rule**: [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion)
**Status**: ✅ Active

**Pattern**: A file whose name starts with `.` or `__` is skipped unconditionally — unlike folders (G02), there is no `scanHiddenFolders` opt-out for files.

**Source(s)**: `src/lib/processors/loader.mjs:523-526` · `src/lib/helpers/generate-manifest.mjs:116` (build)

**Condition Check**:

```javascript
if (hasHiddenPrefix(entry.name)) { continue; }
```

**Trigger**: `hasHiddenPrefix(entry.name)`
**Result**: `continue` — the file never becomes a leaf.

---

## G04: Consumer `hidden` Glob Exclusion

**Related Rule**: [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion)
**Status**: ✅ Active

**Pattern**: Entries whose dotted api path matches a consumer-supplied `hidden` glob are excluded.

**Source(s)**: `src/lib/processors/loader.mjs:496-498` (folder — full api-relative path) · `src/lib/processors/loader.mjs:544-546` (file — extension-stripped api-relative path)

**Condition Check**:

```javascript
if (hiddenMatcher && hiddenMatcher(apiRel(fullPath))) { continue; }              // folder
if (hiddenMatcher && hiddenMatcher(apiRel(path.join(dir, nameWithoutExt)))) { continue; } // file
```

**Trigger**: `hiddenMatcher(apiRel(...))` returns true
**Result**: `continue` — matched folder/file excluded from `structure`.
**Note**: not applied in browser-manifest mode at runtime — see [#423](https://github.com/CLDMV/slothlet/issues/423).

---

## G05: `fileFilter` Single-File Gate

**Related Rule**: [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion)
**Status**: ✅ Active

**Pattern**: When a `fileFilter` is active (e.g. a single-file `api.add`), all subdirectory traversal is suppressed and non-matching files are dropped.

**Source(s)**: `src/lib/processors/loader.mjs:487-489` (dirs) · `src/lib/processors/loader.mjs:529-531` (files)

**Condition Check**:

```javascript
if (entry.isDirectory()) { if (fileFilter) { continue; } /* … */ }   // no subdirs in single-file mode
if (fileFilter && !fileFilter(entry.name)) { continue; }              // non-matching file
```

**Trigger**: `fileFilter` truthy (dirs) / `fileFilter && !fileFilter(entry.name)` (files)
**Result**: only the filtered file(s) at the current level become leaves; no nested namespaces are produced.

---

## G06: Empty Container Produces No Leaf

**Related Rule**: [Rule 3 — No Empty Leaves](../API-RULES.md#rule-3-no-empty-leaves) (also [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion))
**Status**: ✅ Active

**Pattern**: A folder that yields no files and no kept subfolders does not create a leaf or namespace.

**Source(s)**: `src/lib/processors/loader.mjs:510-513` (#156, disk) · `src/lib/helpers/generate-manifest.mjs:181-193` (build-time prune)

**Condition Check**:

```javascript
// #156: a folder that yields no files and no kept subfolders must not create a leaf.
if (subStructure.files.length === 0 && subStructure.directories.length === 0) { continue; }
```

**Trigger**: `subStructure.files.length === 0 && subStructure.directories.length === 0`
**Result**: `continue` — no `structure.directories` entry is pushed.
**Rule tie**: realizes **Rule 3 "No Empty Leaves"** at the discovery layer; companion conditions are the empty-add no-op (M-series, [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)) and the empty-value leaf (C-series/placement). The browser-manifest reader does not re-prune at read time (it relies on the build-time prune above) — see [#423](https://github.com/CLDMV/slothlet/issues/423).

---

## G07: Depth / Non-Recursive Truncation

**Related Rule**: [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion)
**Status**: ✅ Active

**Pattern**: Subdirectories beyond `apiDepth`/`maxDepth`, or all subdirectories when `recursive` is false, are silently dropped (no truncation notice).

**Source(s)**: `src/lib/processors/loader.mjs:500-519`

**Condition Check**:

```javascript
if (recursive && currentDepth < maxDepth) {
	const subStructure = await this.scanDirectory(fullPath, {/* … */});
	// …
	structure.directories.push({ path: fullPath, name: entry.name, children: subStructure });
}
// no `else` — beyond the limit, the subtree is never pushed
```

**Trigger**: `!(recursive && currentDepth < maxDepth)`
**Result**: the entire subtree below the limit never appears in the api. Not honored in browser-manifest mode — see [#423](https://github.com/CLDMV/slothlet/issues/423).

---

## G08: Reserved-Filename Rejection

**Related Rule**: [Rule 14](../API-RULES.md#rule-14-api-directory-scan--inclusion) (shares reserved-key protection with [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface))
**Status**: ✅ Active

**Pattern**: A module file named for a framework-reserved key aborts the scan. Checked **last**, after every exclusion (so a `hidden`/filtered reserved-named file that never composes does not trip it).

**Source(s)**: `src/lib/processors/loader.mjs:553-555` (#260) · `src/lib/processors/loader.mjs:706-708` (browser mirror)

**Condition Check**:

```javascript
if (isFrameworkReservedKey(nameWithoutExt)) {
	throw new this.SlothletError("MODULE_RESERVED_FILENAME", { file: entry.name, dir }, null, { validationError: true });
}
```

**Trigger**: `isFrameworkReservedKey(nameWithoutExt)`
**Result**: `throw MODULE_RESERVED_FILENAME` — the scan fails.

---

## G09: Reserved MountPath-Root Rejection

**Related Rule**: [Rule 15](../API-RULES.md#rule-15-external-module-discovery) (shares reserved-key protection with [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface))
**Status**: ✅ Active

**Pattern**: An external module whose top-level mount segment is a reserved root is rejected outright, so a plugin can never shadow `slothlet` / `shutdown` / `destroy`.

**Source(s)**: `src/lib/helpers/module-manifest-validator.mjs:51,189-201` (tagged `G3`)

**Condition Check**:

```javascript
const RESERVED_MOUNTPATH_ROOTS = Object.freeze(new Set(["slothlet", "shutdown", "destroy"]));
if (RESERVED_MOUNTPATH_ROOTS.has(mountPathSegments[0])) {
	throw new SlothletError("MODULE_RESERVED_MOUNTPATH" /* … */);
}
```

**Trigger**: `RESERVED_MOUNTPATH_ROOTS.has(mountPathSegments[0])`
**Result**: `throw MODULE_RESERVED_MOUNTPATH` — the module never mounts.

---

## G10: External-Module Validity Gate

**Related Rule**: [Rule 15](../API-RULES.md#rule-15-external-module-discovery)
**Status**: ✅ Active

**Pattern**: A discovery candidate without a usable `package.json` (string `name` + `version`) or without a resolvable manifest / dotted subkey is silently skipped — it is not a slothlet module.

**Source(s)**: `src/lib/helpers/module-discovery.mjs:139-144` (package.json) · `src/lib/helpers/module-discovery.mjs:146-148` + `503-518` (manifest / subkey)

**Condition Check**:

```javascript
if (!pkg || typeof pkg.name !== "string" || typeof pkg.version !== "string") { continue; }
const manifestRaw = await loadManifestRaw(manifestPath, manifestSource, pkg.name);
if (manifestRaw === undefined) continue; // file or subkey missing → not a module
```

**Trigger**: invalid `package.json`, or `manifestRaw === undefined`
**Result**: `continue` — candidate excluded, no error.

---

## G11: Real-Path Dedupe & Duplicate `name@version`

**Related Rule**: [Rule 15](../API-RULES.md#rule-15-external-module-discovery)
**Status**: ✅ Active

**Pattern**: Candidates that resolve to the same real path dedupe (first wins); two **different** real paths carrying the same `name@version` abort discovery.

**Source(s)**: `src/lib/helpers/module-discovery.mjs:128-137` (realpath-fail skip + dedupe) · `src/lib/helpers/module-discovery.mjs:172-196` (duplicate `name@version`, tagged `G7`)

**Condition Check**:

```javascript
try { realPath = await fsp.realpath(candidate.path); } catch { continue; } // broken symlink → skip
if (seenRealPaths.has(realPath)) continue;                                  // dedupe, first wins
// …
if (realPathByNameVersion.has(nameVersionKey) && otherRealPath !== realPath) {
  throw new SlothletError("MODULE_DUPLICATE_NAME_VERSION_MISMATCH", /* … */);
}
```

**Trigger**: `seenRealPaths.has(realPath)` (skip) / same `name@version` at a different real path (throw)
**Result**: `continue` (dedupe) or `throw MODULE_DUPLICATE_NAME_VERSION_MISMATCH`.

---

## G12: Content-Filter Veto

**Related Rule**: [Rule 15](../API-RULES.md#rule-15-external-module-discovery)
**Status**: ✅ Active

**Pattern**: A consumer content-filter can reject an otherwise valid, unique module after manifest validation.

**Source(s)**: `src/lib/helpers/module-discovery.mjs:168-170`

**Condition Check**:

```javascript
if (typeof filterFn === "function" && !filterFn(normalized, pkg.name)) { continue; }
```

**Trigger**: `filterFn` present and returns falsy
**Result**: `continue` — module excluded despite being structurally valid.

---

## G13: ScanRoot Mode Auto-Detect (npm vs folder)

**Related Rule**: [Rule 15](../API-RULES.md#rule-15-external-module-discovery)
**Status**: ✅ Active

**Pattern**: Each scan root is classified npm-mode (has `node_modules/`) or folder-mode, selecting mutually exclusive candidate universes.

**Source(s)**: `src/lib/helpers/module-discovery.mjs:274-283` (tagged `G6`); enumerate pre-skips `296-330` (npm) / `340-358` (folder)

**Condition Check**:

```javascript
const stat = await fsp.stat(path.join(root, "node_modules"));
if (stat.isDirectory()) return "npm";
// … else "folder"
```

**Trigger**: `node_modules/` exists under the root → `"npm"`, else `"folder"`
**Result**: npm-mode surfaces only `node_modules/*` and `node_modules/@scope/*`; folder-mode surfaces immediate subfolders.

---

## G14: CJS Interop Export Shaping

**Related Rule**: [Rule 15](../API-RULES.md#rule-15-external-module-discovery)
**Status**: ✅ Active

**Pattern**: `.cjs` (and CJS-interop) modules surface exports asymmetrically: named exports are promoted only when `module.exports` is an object; a callable/primitive CJS export yields only `default`; a Node ESM-interop double-wrap is unwrapped; a module with no default gets no `default` key at all.

**Source(s)**: `src/lib/processors/loader.mjs:154-156` (`.cjs` route) · `368-378` (named-export promotion iff object) · `807-809` (no default → no key) · `812-824` (exclude `default`/`module.exports`; reserved-name throw) · `826-844` (double-wrap unwrap heuristic)

**Trigger / Result**: several sub-branches (see sources) — together they determine which exports exist to become leaves for a CJS-interop module.

---

_Discovery family: G01–G14. Multi-site conditions: G01 (×3), G02/G03/G04/G05/G06/G08 (×2). Schema/field-remap micro-decisions (`module-discovery.mjs:151` `S1`, `:154` `S2`) are folded into G10 as manifest-normalization steps._
