# API Versioning Conditions (V##)

Versioned-mount conditions — how multiple versions of a module coexist at an api path and which one a caller observes.

- **Series**: `V##`
- **Rule**: [Rule 19 — Versioned Mounts](../API-RULES.md#rule-19-versioned-mounts)

---

## V01: Duplicate Version Registration Blocked

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: Registering a version tag that already exists at a logical path throws.

**Source(s)**: `src/lib/handlers/version-manager.mjs:170-175`

**Trigger**: `entry.versions.has(versionTag)`
**Result**: `throw VERSION_REGISTER_DUPLICATE`.

---

## V02: Versioned Mount Path = Version Tag as Atomic Segment

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: A versioned add prepends the version tag as its own path segment (not string-split), so a dotted tag like `2.3.0` stays atomic; a root-level versioned add is refused.

**Source(s)**: `src/lib/handlers/api-manager.mjs:1730-1759` (atomic segment) · `:1737-1745` (root refused)

**Trigger**: `versionConfig?.version != null`; `normalizedPath === ""` (root)
**Result**: `effectiveParts = [versionTag, ...parts]`; root versioned add → `throw API_PATH_REASON_VERSIONED_ROOT`.

---

## V03: Multi-Version Sibling Mount + Default Election

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: When 2+ discovered results share a package name in one `addModules()`, each mounts under its version segment and the highest semver is elected default for the plain (unversioned) path.

**Source(s)**: `src/lib/handlers/module-manager.mjs:413-414` (version prefix, `G7`) · `:505-533` (`#buildVersionConfigs` default election)

**Trigger**: `group.length >= 2` for a `packageName`
**Result**: `effectiveMountPath = ${version}.${path}`; `isDefault = version === pickHighestSemver(versions)`.

---

## V04: Default-Version Resolution

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: The version a plain path resolves to (absent a discriminator result): an explicit `isDefault` flag wins; otherwise the highest numeric tuple, ties broken toward non-prerelease.

**Source(s)**: `src/lib/handlers/version-manager.mjs:439-471` (`getDefaultVersion`) · `:402-421` (`setDefault` single-winner)

**Trigger**: default resolution requested
**Result**: returns the elected default tag; `setDefault` clears every other `isDefault` first.

---

## V05: Per-Access Version Dispatch

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: On each property access through a version dispatcher, the resolved version is: a forced ALS-context override first, else the discriminator result, else the default; an invalid/unregistered discriminator result falls back to the default.

**Source(s)**: `src/lib/handlers/version-manager.mjs:701-739` (`resolveVersion`) · `:508-522` (invalid → default)

**Trigger**: property access on a versioned path
**Result**: `versionedWrapper[prop]` for the resolved version.

---

## V06: Enumeration Union Across All Versions

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: `Object.keys()`/enumeration and `in` on a versioned path report the union of keys across every registered version, not just the active one.

**Source(s)**: `src/lib/handlers/version-manager.mjs:953-971` (`ownKeys`) · `:927-946` (`has`)

**Trigger**: `ownKeys`/`has` trap on a version dispatcher
**Result**: union of all versions' keys / `in` true if any version has it.

---

## V07: Unregister — Teardown vs Rebuild

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: Unregistering the last version tears down the dispatcher and deletes the api path; unregistering a non-last version rebuilds the dispatcher over the remaining versions.

**Source(s)**: `src/lib/handlers/version-manager.mjs:250-257`

**Trigger**: `entry.versions.size === 0` after removal
**Result**: `teardownDispatcher(logicalPath)` (delete) vs `updateDispatcher(logicalPath)` (keep/rebuild).

---

## V08: Versioned-Add Atomic Rollback

**Related Rule**: [Rule 19](../API-RULES.md#rule-19-versioned-mounts)
**Status**: ✅ Active

**Pattern**: If `registerVersion` throws after the tree/cache/ownership/history were already mutated, the just-mounted subtree is torn back out — a versioned add is all-or-nothing.

**Source(s)**: `src/lib/handlers/api-manager.mjs:2565-2587,2634-2676`

**Trigger**: `registerVersion` throws mid-add
**Result**: `_rollbackFailedVersionedAdd` scrubs history and removes the mounted subtree, then rethrows.

---

_Versioning family: V01–V08, all under Rule 19._
