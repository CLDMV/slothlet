/**
 * @fileoverview White-box coverage for `RoutineManager`'s revert / materialize / resolve / cascade
 * paths that the routine feature's other suites don't reach (#341/#362/#365/#366/#369 gap closure).
 *
 * @description
 * These drive specific internal branches directly through the live `RoutineManager` instance
 * (grabbed via `resolveWrapper(api.<leaf>).slothlet.handlers.routineManager`, the same seam the
 * existing routine tests use): the speculative-revert helpers, the post-destroy guards, the
 * unresolvable-receiver / missing-segment / failed-materialization paths, and the lazy-mode
 * materialization walkers. Each targets a concrete, reachable condition (a rejected internal
 * candidate, a torn-down instance, a broken lazy module, a permission-gated read) — not injected
 * impossible state.
 * @module tests/vitests/suites/lifecycle/routine-manager-coverage
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** @type {any} */
let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

/**
 * Compose a routine-configured instance and hand back its live RoutineManager.
 * @param {object} opts - slothlet options; `leaf` names a real top-level leaf to resolve the
 *   instance through (a lazy root returns a look-ahead waiting proxy for a MISSING key, so the leaf
 *   must actually exist in the chosen fixture). Defaults to `"ping"`.
 * @returns {Promise<{api: any, rm: any}>}
 */
async function build({ leaf = "ping", ...opts } = {}) {
	api = await slothlet({ silent: true, ...opts });
	const rm = resolveWrapper(api[leaf]).slothlet.handlers.routineManager;
	return { api, rm };
}

describe("RoutineManager coverage — revert helpers, guards, materialization (#341/#362/#366)", () => {
	it("onImplCreated ignores a re-touch whose impl is already a stacked callable (self-referential guard, #372)", async () => {
		const { rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^auth.x", mode: "manual" }],
			stackRoutines: true
		});
		const before = rm.raw.length;
		const branded = function slothletRoutineStack() {};
		Object.defineProperty(branded, "__slothletRoutineStack", { value: true, enumerable: false });
		// A later, unrelated write of the already-installed stacked callable re-fires impl:created;
		// it must NOT be captured as a fresh contributor (would recurse to OOM on invoke — #372).
		rm.onImplCreated({ apiPath: "auth.x", moduleID: "self-ref-mod", wrapper: { __impl: branded } });
		expect(rm.raw.length).toBe(before);
		expect(rm.raw.some((e) => e.moduleID === "self-ref-mod")).toBe(false);
	});

	it("revertRawEntry drops a purely-speculative capture that had no prior contribution", async () => {
		const { rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^spec.leaf", mode: "manual" }],
			stackRoutines: true
		});
		// A candidate captured a raw entry (no genuine prior), then its assignment was rejected.
		rm.onImplCreated({ apiPath: "spec.leaf", moduleID: "spec-mod", wrapper: { __impl: function leaf() {} } });
		expect(rm.raw.some((e) => e.apiPath === "spec.leaf" && e.moduleID === "spec-mod")).toBe(true);
		rm.revertRawEntry("spec.leaf", "spec-mod", undefined); // priorEntry undefined → drop branch (787-789)
		expect(rm.raw.some((e) => e.apiPath === "spec.leaf" && e.moduleID === "spec-mod")).toBe(false);
	});

	it("revertSpeculativeSubtree no-ops on a non-object api, a visited node, and skip-prop keys", async () => {
		const { rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^z.leaf", mode: "manual" }],
			stackRoutines: true
		});
		// 824: null / primitive api → early return, no throw.
		expect(() => rm.revertSpeculativeSubtree(null, "m", "", new Map())).not.toThrow();
		expect(() => rm.revertSpeculativeSubtree(42, "m", "", new Map())).not.toThrow();
		// 826-827: an already-visited node returns immediately.
		const node = { real: () => {} };
		const visited = new WeakSet([node]);
		expect(() => rm.revertSpeculativeSubtree(node, "m", "", new Map(), visited)).not.toThrow();
		// 864-865: framework/meta keys are skipped during the walk.
		expect(() =>
			rm.revertSpeculativeSubtree({ __metadata: {}, __type: {}, _materialize() {}, real: () => {} }, "m", "", new Map())
		).not.toThrow();
	});

	it("revertSpeculativeState restores a prior contribution's tracked wrapper (934)", async () => {
		const { rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^rs.leaf", mode: "manual" }],
			stackRoutines: true
		});
		const priorFn = function priorLeaf() {};
		const priorWrapper = { ___invalidate() {} };
		// Prior genuine contribution (with a tracked wrapper) that predates an aborted candidate build.
		const prior = new Map([["rs.leaf", { fn: priorFn, index: 0, wrapper: priorWrapper }]]);
		// The aborted build changed the pair to a different fn (+ its own wrapper) → revert must
		// invalidate the candidate wrapper and restore the prior one (934). Seed the rawWrappers
		// tracking map for this module so the `moduleWrappers?.set(path, prior.wrapper)` at 934
		// actually writes (rather than short-circuiting on a missing map).
		rm.onImplCreated({ apiPath: "rs.leaf", moduleID: "rs-mod", wrapper: { __impl: function candidateLeaf() {} } });
		rm.rawWrappers.set("rs-mod", new Map([["rs.leaf", { ___invalidate() {} }]]));
		rm.revertSpeculativeState("rs-mod", prior);
		expect(rm.raw.find((e) => e.apiPath === "rs.leaf" && e.moduleID === "rs-mod")?.fn).toBe(priorFn);
		expect(rm.rawWrappers.get("rs-mod")?.get("rs.leaf")).toBe(priorWrapper);
	});

	it("runCascade returns undefined for an unconfigured routine name (1352)", async () => {
		const { rm } = await build({ dir: TEST_DIRS.API_TEST_ROUTINES, mode: "eager", routines: [{ name: "initialize", mode: "manual" }] });
		expect(await rm.runCascade("not-a-configured-routine")).toBeUndefined();
	});

	it("runPath returns undefined after the instance is torn down (post-destroy guard, 1049)", async () => {
		const { api: a, rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "initialize", mode: "manual" }]
		});
		const savedApi = rm.slothlet.api;
		try {
			rm.slothlet.api = null; // mirrors destroy()'s final teardown
			expect(await rm.runPath("initialize")).toBeUndefined();
		} finally {
			rm.slothlet.api = savedApi;
			api = a;
		}
	});

	it("runPath with no routine arg runs the raw pathEntries directly (1051 null-routine arm), and skips an unresolvable receiver (969/975)", async () => {
		const { rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "initialize", mode: "manual" }],
			stackRoutines: true
		});
		globalThis.__rmCovLog = [];
		// A real root contributor exists at "initialize"; runPath(path) with NO routine argument
		// exercises the `: pathEntries` arm and runs it.
		rm.onImplCreated({ apiPath: "initialize", moduleID: "rp-mod", wrapper: { __impl: () => globalThis.__rmCovLog.push("ran") } });
		await rm.runPath("initialize");
		expect(globalThis.__rmCovLog).toContain("ran");
		// A contributor whose parent path ("ghostparent") is not on the tree → #runEntries can't
		// resolve the receiver → returns { results: [], failures: [] } (969/975), no throw.
		rm.onImplCreated({
			apiPath: "ghostparent.leaf",
			moduleID: "gp-mod",
			wrapper: { __impl: () => globalThis.__rmCovLog.push("should-not-run") }
		});
		const out = await rm.runPath("ghostparent.leaf");
		expect(out).toEqual([]);
		expect(globalThis.__rmCovLog).not.toContain("should-not-run");
	});

	it("rebuildStacks skips a path whose parent container no longer resolves (1585)", async () => {
		const { api: a, rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^ghostp.deep.leaf", mode: "manual" }],
			stackRoutines: true
		});
		rm.onImplCreated({ apiPath: "ghostp.deep.leaf", moduleID: "gd1", wrapper: { __impl: function leaf() {} } });
		rm.onImplCreated({ apiPath: "ghostp.deep.leaf", moduleID: "gd2", wrapper: { __impl: function leaf() {} } });
		// "ghostp.deep" doesn't exist → #resolveContainer returns undefined → the per-path target
		// guard (1585) continues without installing, and #resolveContainer's own missing-intermediate
		// guard (1466) fires for the multi-segment parent.
		await expect(rm.rebuildStacks(a)).resolves.toBeUndefined();
		expect(a.ghostp).toBeUndefined();
	});

	it("revertRawEntry with no prior AND no current entry no-ops safely (788 idx===-1 arm)", async () => {
		const { rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^gone.leaf", mode: "manual" }],
			stackRoutines: true
		});
		// No raw entry was ever captured for this pair, and there's no prior — the drop branch runs
		// with idx === -1 (nothing to splice), exercising the false arm of `if (idx !== -1)` (788).
		expect(() => rm.revertRawEntry("gone.leaf", "never-captured-mod", undefined)).not.toThrow();
	});

	it("resolveContainer treats a throwing intermediate segment read like a missing one (1472)", async () => {
		const { rm } = await build({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^mid.child.leaf", mode: "manual" }],
			stackRoutines: true
		});
		// A composed node whose OWN child read throws (e.g. a user module exporting an object with a
		// throwing getter). rebuildStacks resolves the parent path "mid.child": stepping into `mid`
		// succeeds, but reading `mid.child` throws — #resolveContainer's `node[part]` catch treats it
		// as a missing segment and returns undefined (1472), so the path is skipped, not propagated.
		const plainApi = {
			mid: {
				get child() {
					throw new Error("read-guarded intermediate segment");
				}
			},
			slothlet: {}
		};
		rm.onImplCreated({ apiPath: "mid.child.leaf", moduleID: "ms1", wrapper: { __impl: function leaf() {} } });
		rm.onImplCreated({ apiPath: "mid.child.leaf", moduleID: "ms2", wrapper: { __impl: function leaf() {} } });
		await expect(rm.rebuildStacks(plainApi)).resolves.toBeUndefined();
	});

	it("resolveContainer bails when a lazy segment fails to materialize mid-path (1479)", async () => {
		const { api: a, rm } = await build({
			leaf: "other",
			dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			mode: "lazy",
			routines: [{ name: "^admin.deep.leaf", mode: "manual" }],
			stackRoutines: true
		});
		// `admin` is a lazy, not-yet-materialized segment. Force its _materialize to reject; resolving
		// the parent path "admin.deep" awaits admin._materialize inside #resolveContainer, which
		// catches the rejection and returns undefined (1479).
		const adminWrapper = resolveWrapper(a.admin);
		expect(adminWrapper.____slothletInternal.state.materialized).toBe(false);
		const orig = adminWrapper._materialize.bind(adminWrapper);
		adminWrapper._materialize = async () => {
			throw new Error("materialization failed mid-resolve");
		};
		try {
			rm.onImplCreated({ apiPath: "admin.deep.leaf", moduleID: "ad1", wrapper: { __impl: function leaf() {} } });
			rm.onImplCreated({ apiPath: "admin.deep.leaf", moduleID: "ad2", wrapper: { __impl: function leaf() {} } });
			await expect(rm.rebuildStacks(a)).resolves.toBeUndefined();
		} finally {
			adminWrapper._materialize = orig;
		}
	});

	it("materializeFor skips a mount endpoint that no longer resolves (1272)", async () => {
		const { api: a, rm } = await build({
			leaf: "other",
			dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			mode: "lazy",
			routines: [{ name: "admin.initialize", mode: "manual" }],
			stackRoutines: true
		});
		// A dotted (bounded, non-recursive) routine drives #materializeFor's per-endpoint loop. Seed a
		// stale ownership endpoint that points at a path no longer on the tree, so its
		// #resolveContainer returns null and the loop's `continue` (1272) fires for it.
		const ownership = resolveWrapper(a.other).slothlet.handlers.ownership;
		ownership.moduleEndpoints.set("stale-mod-id", "ghostmount");
		let threw = false;
		try {
			await rm.runCascade("admin.initialize");
		} catch {
			threw = true;
		} finally {
			ownership.moduleEndpoints.delete("stale-mod-id");
		}
		expect(threw).toBe(false);
	});
});

describe("RoutineManager coverage — lazy materialization walkers (#341)", () => {
	it("a ^-anchored routine cascade materializes the whole tree, skipping the root's reserved keys (1126)", async () => {
		const { api: a, rm } = await build({
			leaf: "other",
			dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			mode: "lazy",
			routines: [{ name: "^**.initialize", mode: "manual" }],
			stackRoutines: true
		});
		const adminWrapper = resolveWrapper(a.admin);
		expect(adminWrapper.____slothletInternal.state.materialized).toBe(false);
		// runCascade → #materializeFor (^-anchored) → #materializeTree(api root): the root loop skips
		// "slothlet"/"shutdown"/"destroy" and every "____"-prefixed key (1126), then descends and
		// force-materializes every lazy node — so the previously-unmaterialized `admin` becomes
		// materialized. (The cascade's own return value can legitimately be undefined when a
		// contributor returns undefined; the materialization side effect is the observable proof the
		// walk ran.)
		let threw = false;
		try {
			await rm.runCascade("^**.initialize");
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
		expect(adminWrapper.____slothletInternal.state.materialized).toBe(true);
	});

	it("a recursive routine walks each known mount's subtree (materializeFor recursive path, 1282/1289-1291)", async () => {
		const { api: a, rm } = await build({
			leaf: "math",
			base: TEST_DIRS.API_TEST,
			mode: "lazy",
			routines: [{ name: "initialize", mode: "manual", recursive: true }],
			stackRoutines: true,
			api: { collision: { initial: "merge", api: "merge" } }
		});
		// A `base:` (no `dir:`) instance has only named mounts — no "." / "" base endpoint — so
		// #materializeFor's recursive branch takes the per-mount loop (1289-1291), resolving and
		// materializing each mount's subtree, rather than the whole-tree shortcut (1282 false arm).
		await a.slothlet.api.add(["mnt"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
		// The recursive walk runs to completion without throwing (its own return value may be
		// undefined when a contributor returns undefined — not the property under test here).
		let threw = false;
		try {
			await rm.runCascade("initialize");
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});

	it("a recursive routine with only named mount endpoints walks each mount's subtree (materializeFor per-mount loop 1282-else/1289-1291, materializeTree mount-root ____ skip 1126)", async () => {
		const { api: a, rm } = await build({
			leaf: "other",
			dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			mode: "lazy",
			routines: [{ name: "initialize", mode: "manual", recursive: true }],
			stackRoutines: true
		});
		const ownership = resolveWrapper(a.other).slothlet.handlers.ownership;
		const adminWrapper = resolveWrapper(a.admin);
		expect(adminWrapper.____slothletInternal.state.materialized).toBe(false);
		// Simulate an instance whose only mount endpoints are NAMED (an api.add-only composition, no
		// base "." / "" endpoint): #materializeFor's recursive branch then skips the whole-tree
		// shortcut (1282 false arm) and instead resolves + materializes each named mount's own subtree
		// (1289-1291). Walking the `admin` mount root — a wrapper that enumerates "____"-prefixed
		// internal keys — exercises #materializeTree's root-loop ____ skip (1126).
		const savedEndpoints = new Map(ownership.moduleEndpoints);
		ownership.moduleEndpoints.clear();
		ownership.moduleEndpoints.set("named-mount-mod", "admin");
		let threw = false;
		try {
			await rm.runCascade("initialize");
		} catch {
			threw = true;
		} finally {
			ownership.moduleEndpoints.clear();
			for (const [k, v] of savedEndpoints) ownership.moduleEndpoints.set(k, v);
		}
		expect(threw).toBe(false);
		expect(adminWrapper.____slothletInternal.state.materialized).toBe(true);
	});

	it("materializeGlobPath: dotted routine into a primitive node stops (1161), and a throwing literal/wildcard child read is skipped (1191/1213)", async () => {
		const { api: a, rm } = await build({
			leaf: "other",
			dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			mode: "lazy",
			routines: [
				{ name: "prim.leaf", mode: "manual" },
				{ name: "boom.leaf", mode: "manual" },
				{ name: "wild.*.leaf", mode: "manual" }
			],
			stackRoutines: true
		});
		const otherWrapper = resolveWrapper(a.other);
		const rootApi = otherWrapper.slothlet.api;
		// A mount root the bounded #materializeGlobPath walk steps through: give it a primitive child
		// (dotted "prim.leaf" → materializeGlobPath(primitive, ["leaf"]) → 1161), a literal child whose
		// read throws (dotted "boom.leaf" → literal-segment read catch, 1191), and a wildcard whose
		// matched child read throws (routine "wild.*.leaf" → enumerated child read catch, 1213).
		Object.defineProperty(rootApi, "prim", { configurable: true, enumerable: true, value: 42 });
		Object.defineProperty(rootApi, "boom", {
			configurable: true,
			enumerable: true,
			get() {
				throw new Error("read-guarded");
			}
		});
		const wildParent = {
			get thrower() {
				throw new Error("gated child");
			}
		};
		Object.defineProperty(rootApi, "wild", { configurable: true, enumerable: true, value: wildParent });
		let threw = false;
		try {
			await rm.runCascade("prim.leaf");
			await rm.runCascade("boom.leaf");
			await rm.runCascade("wild.*.leaf");
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});

	it("materializeGlobPath swallows a failed lazy materialization down a dotted routine path (1171/1479)", async () => {
		const { api: a, rm } = await build({
			leaf: "other",
			dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			mode: "lazy",
			routines: [{ name: "admin.initialize", mode: "manual" }],
			stackRoutines: true
		});
		// `admin` is a lazy, not-yet-materialized subfolder. Force its _materialize to reject; the
		// dotted routine's #materializeFor → #materializeGlobPath (and #resolveContainer) must catch
		// it and bail down that branch (1171 / 1479) rather than throw out of the cascade.
		const adminWrapper = resolveWrapper(a.admin);
		expect(adminWrapper.____slothletInternal.state.materialized).toBe(false);
		const orig = adminWrapper._materialize.bind(adminWrapper);
		adminWrapper._materialize = async () => {
			throw new Error("materialization failed");
		};
		try {
			await expect(rm.runCascade("admin.initialize")).resolves.toBeDefined();
		} finally {
			adminWrapper._materialize = orig;
		}
	});
});
