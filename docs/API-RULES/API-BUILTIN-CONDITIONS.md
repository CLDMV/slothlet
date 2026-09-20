# API Built-in & Reserved-Surface Conditions (B##)

Built-in-surface conditions — how slothlet protects reserved keys and shapes the framework's own `slothlet.*` control surface on the api.

- **Series**: `B##`
- **Rule**: [Rule 21 — Reserved Keys & Built-in Surface](../API-RULES.md#rule-21-reserved-keys--built-in-surface)
- Reserved-key protection at other layers is enforced by G08 (filename), G09 (mountPath), and the reserved-export throw in `loader.mjs` — all under Rule 21's umbrella.

---

## B01: Reserved Root Keys Protected

**Related Rule**: [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface)
**Status**: ✅ Active

**Pattern**: The root keys `slothlet`, `shutdown`, and `destroy` are framework-owned. A user's own `slothlet` export triggers a warning and is overwritten by the built-in namespace. A user's `shutdown`/`destroy` functions are **captured into `userHooks` and invoked** during lifecycle (so they are honored, not discarded) — hence no warning for those.

**Source(s)**: `src/lib/builders/api_builder.mjs:271-285` (`slothlet` warn + overwrite) · `:260-267,297-320` (shutdown/destroy captured → `userHooks`, called via `createShutdownFunction`/`createDestroyFunction`)

**Condition Check**:

```javascript
this.slothlet.userHooks = {
	shutdown: typeof userApi.shutdown === "function" ? userApi.shutdown : null,
	destroy: typeof userApi.destroy === "function" ? userApi.destroy : null
};
if (userApi.slothlet) {
	new this.SlothletWarning("WARNING_RESERVED_PROPERTY_CONFLICT", { properties: "slothlet" });
}
```

**Trigger**: a user export at `slothlet` / `shutdown` / `destroy`
**Result**: `slothlet` warned + replaced by the builtin; `shutdown`/`destroy` captured and wrapped so the user hook still runs at the right lifecycle point.
**Note**: the asymmetry is by design — `slothlet` is fully reserved (no user meaning), while `shutdown`/`destroy` are user-extensible hooks.

---

## B02: `slothlet.diag` Namespace Gated by `config.diagnostics`

**Related Rule**: [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface)
**Status**: ✅ Active

**Pattern**: The `slothlet.diag` diagnostics sub-namespace exists on the api only when diagnostics are enabled.

**Source(s)**: `src/lib/builders/api_builder.mjs:3144-3145`

**Trigger**: `config.diagnostics === true`
**Result**: `namespace.diag = { … }` added; otherwise `api.slothlet.diag` does not exist.

---

## B03: `api.add()` Locks Caller Collision Options

**Related Rule**: [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface)
**Status**: ✅ Active

**Pattern**: Per-call `collisionMode` / `mutateExisting` / `recordHistory` on `api.slothlet.api.add()` are stripped (with a warning) unless `api.mutations.allowCollisionOverride` is set; `forceOverwrite` / `moduleID` / `metadata` always pass through.

**Source(s)**: `src/lib/builders/api_builder.mjs:785-806` (lock) · `:807-813` (always-allowed)

**Trigger**: `!config.api?.mutations?.allowCollisionOverride` and a locked option is present
**Result**: `WARNING_API_ADD_OPTION_LOCKED`; the option is dropped and the mount uses the instance policy. (Shipped: [#419](https://github.com/CLDMV/slothlet/pull/419).)

---

## B04: `versioning.unregister` Unknown Tag → No-Op

**Related Rule**: [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface) (with [Rule 19](../API-RULES.md#rule-19-versioned-mounts))
**Status**: ✅ Active

**Pattern**: `slothlet.versioning.unregister()` for an unknown logical path or version tag returns `false` without touching the api tree; only a known tag proceeds to `removeApiComponent`.

**Source(s)**: `src/lib/builders/api_builder.mjs:2678-2690`

**Trigger**: `!info || !info.versions?.[versionTag]`
**Result**: `return false` — no removal.

---

_Built-in family: B01–B04, under Rule 21. Dead code not catalogued: `delete namespace.hooks` (api_builder.mjs:3139 — targets a never-set plural key; hooks are a v3 placeholder). The `slothlet.scope`/`run` vs `slothlet.context.scope`/`run` duplication and the `api.shutdown()` vs `slothlet.shutdown()` call-graph difference are documented in the built-in surface reference, not as leaf-generation conditions._
