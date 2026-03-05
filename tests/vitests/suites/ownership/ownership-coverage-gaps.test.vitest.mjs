/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/ownership-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 22:48:07 -08:00 (1772606887)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for uncovered OwnershipManager branches.
 *
 * @description
 * Covers:
 *   line 247  `getCurrentValue` — true branch of `if (!owner) return undefined`
 *             (owner is null/undefined → path was never registered)
 *   line 279  `getPathHistory` — false branch of `return this.pathToModule.get(apiPath) || []`
 *             (path not in map → `|| []` fallback returned)
 *
 * @module tests/vitests/suites/ownership/ownership-coverage-gaps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
import { OwnershipManager } from "@cldmv/slothlet/handlers/ownership";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Build a minimal mock slothlet for OwnershipManager construction.
 *
 * @returns {object} Minimal mock.
 *
 * @example
 * const o = new OwnershipManager(makeMock());
 */
function makeMock() {
	return {
		config: {},
		debug: () => {},
		SlothletError,
		SlothletWarning
	};
}

// ─── getCurrentValue — owner is null (line 247 true branch) ──────────────────

describe("OwnershipManager.getCurrentValue — returns undefined for unregistered path (line 247 true)", () => {
	it("returns undefined when the path was never registered (line 247 if(!owner) branch)", () => {
		const o = new OwnershipManager(makeMock());

		// pathToModule has no entry for this path → getCurrentOwner returns null
		// → line 247: if (!owner) return undefined → TRUE branch
		const result = o.getCurrentValue("never.registered.path");

		expect(result).toBeUndefined();
	});

	it("returns undefined for empty string path that was never registered", () => {
		const o = new OwnershipManager(makeMock());
		expect(o.getCurrentValue("")).toBeUndefined();
	});

	it("returns a non-undefined value for a registered path (confirms the false branch works)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = function myFn() {};

		o.register({ apiPath: "math.add", moduleID: "mod-test", value: fn, collisionMode: "merge", source: "initial" });

		// Should return the impl (non-undefined) for a registered path
		const result = o.getCurrentValue("math.add");
		expect(result).toBeDefined();
	});
});

// ─── getPathHistory — || [] fallback (line 279 false branch) ─────────────────

describe("OwnershipManager.getPathHistory — returns [] for unregistered path (line 279 alternate)", () => {
	it("returns [] when apiPath is not in pathToModule map (line 279 || [] branch)", () => {
		const o = new OwnershipManager(makeMock());

		// Nothing registered — pathToModule.get returns undefined → || [] fallback
		const result = o.getPathHistory("no.such.path");

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(0);
	});

	it("returns [] for any string path that was never registered", () => {
		const o = new OwnershipManager(makeMock());
		expect(o.getPathHistory("a.b.c")).toEqual([]);
	});

	it("returns a non-empty array for a path that was registered (confirms the truthy branch)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = function testFn() {};

		o.register({ apiPath: "math", moduleID: "mod-math", value: fn, collisionMode: "merge", source: "initial" });

		const history = o.getPathHistory("math");
		expect(history.length).toBeGreaterThan(0);
	});
});
// ─── register — collision "warn" with config.silent:true (line 78 false branch) ─

describe("OwnershipManager.register — warn collision with silent:true suppresses warning (line 78 false)", () => {
	it("returns null and emits no SlothletWarning when collision mode is warn and config.silent is true (line 78 false branch)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		// First registration — establishes ownership of "math" for mod-a
		o.register({ apiPath: "math", moduleID: "mod-a", value: fn, collisionMode: "merge", source: "initial" });

		// Second registration — different module, same path, warn mode, but silent:true
		// → conflict detected → collisionMode === "warn" → line 78: if (!config?.silent) { ... }
		// → config.silent = true → !true = false → warning body SKIPPED (false branch at line 78)
		// → returns null without emitting SlothletWarning
		const result = o.register({
			apiPath: "math",
			moduleID: "mod-b",
			value: fn,
			collisionMode: "warn",
			config: { silent: true },
			source: "initial"
		});

		expect(result).toBeNull();
	});

	it("still returns null when warn+silent on a new path (no pre-existing owner, but confirms silent flag path)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		// Register "db" for mod-a first
		o.register({ apiPath: "db", moduleID: "mod-a", value: fn, collisionMode: "merge", source: "initial" });

		// Register "db" for mod-b — warn + silent → null, no warning
		const warnResult = o.register({
			apiPath: "db",
			moduleID: "mod-b",
			value: fn,
			collisionMode: "warn",
			config: { silent: true },
			source: "initial"
		});

		expect(warnResult).toBeNull();
		// Owner unchanged — mod-a still owns "db"
		expect(o.getCurrentOwner("db").moduleID).toBe("mod-a");
	});
});

// ─── unregister — restore action when stack has remaining owner (line 164 branch) ─

describe("OwnershipManager.unregister — restore action when path has multiple owners (line 164 branch)", () => {
	it("reports rolledBack when removing one of two owners for the same path (line 164 restore branch)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		// Register mod-a on "math" — becomes first owner
		o.register({ apiPath: "math", moduleID: "mod-a", value: fn, collisionMode: "merge", source: "initial" });
		// Register mod-b on "math" with merge collision — pushes mod-b onto the stack
		o.register({ apiPath: "math", moduleID: "mod-b", value: fn, collisionMode: "merge", source: "initial" });

		// Stack is now [mod-a, mod-b] — two owners for "math"
		// Unregister mod-b → removePath("math", "mod-b") → stack becomes [mod-a]
		// → stack.length > 0 → action: "restore" → line 164: else if (result.action === "restore") { ... }
		const result = o.unregister("mod-b");

		expect(result.rolledBack).toHaveLength(1);
		expect(result.rolledBack[0].apiPath).toBe("math");
		expect(result.rolledBack[0].restoredTo).toBe("mod-a");
		expect(result.removed).toHaveLength(0);
	});

	it("confirms delete action (not restore) when only one owner exists (covers else path)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		o.register({ apiPath: "math", moduleID: "solo-mod", value: fn, collisionMode: "merge", source: "initial" });

		// Stack has only one entry → removing it empties the stack → action: "delete"
		const result = o.unregister("solo-mod");

		expect(result.removed).toHaveLength(1);
		expect(result.removed[0]).toBe("math");
		expect(result.rolledBack).toHaveLength(0);
	});
});

// ─── removePath — index === -1 when moduleID not in stack (line 198 true branch) ─

describe("OwnershipManager.removePath — returns none when moduleID not in path stack (line 198 true branch)", () => {
	it("returns action:'none' when the specified moduleID does not own the path (line 198 index === -1)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		// Register "math" under mod-a
		o.register({ apiPath: "math", moduleID: "mod-a", value: fn, collisionMode: "merge", source: "initial" });

		// removePath("math", "mod-b") — mod-b is NOT in the stack for "math"
		// → line 198: index = stack.findIndex(e => e.moduleID === "mod-b") = -1
		// → if (index === -1) return { action: "none", ... }  (line 198 true branch)
		const result = o.removePath("math", "mod-b");

		expect(result.action).toBe("none");
		expect(result.removedModuleId).toBeNull();
	});

	it("path remains unchanged after removePath with non-existent moduleID (line 198 guard works)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		o.register({ apiPath: "config", moduleID: "config-mod", value: fn, collisionMode: "merge", source: "initial" });

		// removePath with a completely different moduleID
		o.removePath("config", "ghost-mod");

		// config-mod still owns "config"
		expect(o.getCurrentOwner("config")?.moduleID).toBe("config-mod");
	});
});

// ─── L164: else if (result.action === "restore") in unregister ───────────────

describe("OwnershipManager.unregister — L164 restore action (rolledBack populated)", () => {
	it("unregistering top module when prior owner exists returns rolledBack entry (line 164)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		// Stack mod-a first, then mod-b on top with replace
		o.register({ apiPath: "tools.fmt", moduleID: "mod-a", value: fn, collisionMode: "merge", source: "initial" });
		o.register({ apiPath: "tools.fmt", moduleID: "mod-b", value: fn, collisionMode: "replace", source: "initial" });

		// Unregister mod-b (top of stack) → mod-a remains → action "restore" → line 164 fires
		const result = o.unregister("mod-b");

		expect(result.rolledBack).toHaveLength(1);
		expect(result.rolledBack[0].apiPath).toBe("tools.fmt");
		expect(result.rolledBack[0].restoredTo).toBe("mod-a");
		expect(result.removed).toHaveLength(0);
	});
});

// ─── L198: cond-expr FALSE — null moduleID uses stack[last] ──────────────────

describe("OwnershipManager.removePath — L198 cond-expr FALSE (null moduleID)", () => {
	it("passing null as moduleID removes the last stack entry (line 198 false branch)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		o.register({ apiPath: "data.store", moduleID: "mod-x", value: fn, collisionMode: "merge", source: "initial" });

		// null moduleID → ternary FALSE → index = stack.length - 1
		const result = o.removePath("data.store", null);

		expect(result.action).toBe("delete");
		expect(result.removedModuleId).toBe("mod-x");
	});
});

// ─── L204: if (removedModuleId && ...) FALSE — falsy moduleID skips cleanup ──

describe("OwnershipManager.removePath — L204 if FALSE (falsy removedModuleId)", () => {
	it("entry with empty moduleID skips moduleToPath cleanup (line 204 false branch)", () => {
		const o = new OwnershipManager(makeMock());

		// Bypass register() validation to inject an entry with falsy moduleID
		o.pathToModule.set("ghost.path", [{ moduleID: "", source: "test", timestamp: Date.now(), value: null, filePath: null }]);

		// removedModuleId = "" (falsy) → line 204 if is FALSE → no moduleToPath cleanup
		const result = o.removePath("ghost.path", "");

		expect(result.action).toBe("delete");
		expect(result.removedModuleId).toBe("");
	});
});

// ─── unregister — else if (result.action === "restore") at L164 ──────────────

describe("OwnershipManager.unregister — L164 else-if restore branch", () => {
        it("rolledBack is populated when unregistering a module that had a previous owner in the stack", () => {
                const o = new OwnershipManager(makeMock());
                const fn = function testFn() {};

                // Register path "api.math" with module A first
                o.register({ apiPath: "api.math", moduleID: "mod-a", value: fn, collisionMode: "replace", source: "initial" });
                // Register same path with module B — B goes on top, A is pushed down in the stack
                o.register({ apiPath: "api.math", moduleID: "mod-b", value: fn, collisionMode: "replace", source: "api" });

                // Unregister B: removePath("api.math", "mod-b") → stack still has A → action: "restore"
                // → else if (result.action === "restore") at L164 fires
                const result = o.unregister("mod-b");

                expect(Array.isArray(result.rolledBack)).toBe(true);
                expect(result.rolledBack.length).toBeGreaterThan(0);
                expect(result.rolledBack[0].apiPath).toBe("api.math");
                expect(result.rolledBack[0].restoredTo).toBe("mod-a");
                expect(result.removed).toHaveLength(0);
        });
});

// ─── L164 else-if FALSE arm: result.action === "none" (neither delete nor restore) ──

describe("OwnershipManager.unregister — L164 else-if FALSE branch (action is neither delete nor restore)", () => {
	it("unregister returns empty removed/rolledBack when removePath returns 'none' for a corrupted path (L164 false)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = () => {};

		// Register mod-a on "math" so moduleToPath maps mod-a → {"math"}
		o.register({ apiPath: "math", moduleID: "mod-a", value: fn, collisionMode: "merge", source: "initial" });

		// Manually remove mod-a from the pathToModule stack WITHOUT updating moduleToPath.
		// This creates an inconsistency: moduleToPath still says mod-a owns "math",
		// but pathToModule["math"]'s stack no longer contains mod-a.
		const stack = o.pathToModule.get("math");
		const idx = stack.findIndex((e) => e.moduleID === "mod-a");
		stack.splice(idx, 1); // Empties the stack but keeps the empty array entry

		// unregister("mod-a"):
		//   paths = moduleToPath.get("mod-a") → {"math"} (non-null, loop runs)
		//   removePath("math", "mod-a") → stack exists but mod-a not in it → action: "none"
		//   → if (action === "delete") FALSE
		//   → else if (action === "restore") FALSE ← L164 FALSE ARM TAKEN
		//   neither removed nor rolledBack is populated
		const result = o.unregister("mod-a");

		expect(result.removed).toHaveLength(0);
		expect(result.rolledBack).toHaveLength(0);
	});
});
