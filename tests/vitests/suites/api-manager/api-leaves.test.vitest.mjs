/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-leaves.test.vitest.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-08 18:01:02 -07:00 (1786237262)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `api.slothlet.api.leaves()` — enumerate the api leaves a module owns (#247).
 *
 * @description
 * Slothlet records ownership per path at load time (`moduleID` → owned paths, with the registered
 * value), but exposed no inverse query: given a module, list the leaf paths it owns. Consumers fell
 * back to recursively walking the live api object — which under-reports unmaterialized lazy
 * subtrees, and is caller-sensitive now that enumeration redacts under permission rules (#244).
 *
 * `leaves()` reads the loader's own records instead. It accepts the `moduleID` an `api.add()`
 * returned OR an api path (the mount endpoint, or any owned path — resolved to its owning module),
 * with `"."`/`""` addressing the base load. Under lazy it settles the owned subtree first, so the
 * records are complete for unmaterialized modules. The default return is the FLATTENED CALLABLE
 * paths — the form a caller invokes and the one-stub-per-callable contract; `{ details: true }`
 * returns every owned path tagged `function` / `namespace` / `data`. Called on the host's bound
 * handle it is unaffected by permission rules, matching the host carve-out for the bound api.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/** A mount with a callable, a nested callable, and a data leaf — one of each kind. */
const SHOP = {
	exports: {
		/**
		 * Top-level callable leaf.
		 * @param {number} a - Left operand.
		 * @param {number} b - Right operand.
		 * @returns {number} Product.
		 */
		mul(a, b) {
			return a * b;
		},
		ns: {
			/**
			 * Nested callable leaf.
			 * @param {number} x - Value.
			 * @returns {number} Same value.
			 */
			deep(x) {
				return x;
			}
		},
		limit: 42
	}
};

/** A real directory tree 15 levels deep — deeper than any fixed traversal cutoff. */
const DEEP_DIR = new URL("../../../../api_tests/api_test_deep_tree", import.meta.url).pathname;
/** Fixture carrying module-private members (`billing.internals.__rate`, `_fee`, `_scale`). */
const PRIVATE_DIR = new URL("../../../../api_tests/api_test_private", import.meta.url).pathname;
/** Dotted path of that tree's only callable, relative to its mount point. */
const DEEP_PATH = `deep.${Array.from({ length: 15 }, (_, i) => `l${i + 1}`).join(".")}.tip`;

describe.each(["eager", "lazy"])("ApiManager > api.leaves (#247) > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("lists the callable leaf paths for a moduleID returned by api.add", async () => {
		api = await slothlet({ mode, base: BASE });
		const moduleID = await api.slothlet.api.add("shop", SHOP);

		expect(await api.slothlet.api.leaves(moduleID)).toEqual(["shop.mul", "shop.ns.deep"]);
	});

	it("accepts the mount endpoint as an alternative key", async () => {
		api = await slothlet({ mode, base: BASE });
		await api.slothlet.api.add("shop", SHOP);

		expect(await api.slothlet.api.leaves("shop")).toEqual(["shop.mul", "shop.ns.deep"]);
	});

	it("resolves any owned path to its owning module", async () => {
		api = await slothlet({ mode, base: BASE });
		await api.slothlet.api.add("shop", SHOP);

		// An interior path is a valid handle on the module that owns it — the enumeration is always
		// module-scoped, matching how remove()/reload() resolve path keys.
		expect(await api.slothlet.api.leaves("shop.ns")).toEqual(["shop.mul", "shop.ns.deep"]);
	});

	it("distinguishes callable, namespace, and data paths under details", async () => {
		api = await slothlet({ mode, base: BASE });
		await api.slothlet.api.add("shop", SHOP);

		const detailed = await api.slothlet.api.leaves("shop", { details: true });
		expect(detailed).toEqual([
			{ path: "shop", kind: "namespace" },
			{ path: "shop.limit", kind: "data" },
			{ path: "shop.mul", kind: "function" },
			{ path: "shop.ns", kind: "namespace" },
			{ path: "shop.ns.deep", kind: "function" }
		]);
	});

	it("throws a named error for an unknown key", async () => {
		api = await slothlet({ mode, base: BASE });

		await expect(api.slothlet.api.leaves("no.such.module")).rejects.toThrow(/API_LEAVES_UNKNOWN_MODULE/);
	});

	it("rejects a non-string key with INVALID_ARGUMENT", async () => {
		api = await slothlet({ mode, base: BASE });

		await expect(api.slothlet.api.leaves(42)).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("enumerates a tree deeper than any fixed traversal cutoff", async () => {
		api = await slothlet({ mode, base: BASE });
		const moduleID = await api.slothlet.api.add("deep", DEEP_DIR);

		// apiDepth is unbounded by default, so a hard-coded settle depth would return a silently
		// incomplete answer here rather than failing — the worst shape for an enumeration API.
		// Under lazy this only holds because settle() walks the whole subtree, not a fixed prefix.
		expect(await api.slothlet.api.leaves(moduleID)).toContain(DEEP_PATH);
	});

	it("rejects a malformed option bag with INVALID_ARGUMENT, not a raw TypeError", async () => {
		api = await slothlet({ mode, base: BASE });
		const moduleID = await api.slothlet.api.add("shop", SHOP);

		// A wrong-shaped bag gets a named, translated refusal — not a bare TypeError raised from
		// inside the framework on the first property read.
		await expect(api.slothlet.api.leaves(moduleID, "details")).rejects.toThrow(/INVALID_ARGUMENT/);
		await expect(api.slothlet.api.leaves(moduleID, [])).rejects.toThrow(/INVALID_ARGUMENT/);
		await expect(api.slothlet.api.leaves(moduleID, { details: "yes" })).rejects.toThrow(/INVALID_ARGUMENT/);

		// `null` is the ordinary "no options" idiom and normalizes to the default, as it does on the
		// other option bags (PermissionManager.checkAccess); so do omitted and explicit undefined.
		const baseline = await api.slothlet.api.leaves(moduleID);
		expect(await api.slothlet.api.leaves(moduleID, null)).toEqual(baseline);
		expect(await api.slothlet.api.leaves(moduleID, undefined)).toEqual(baseline);
	});
});

describe("ApiManager > api.leaves lazy completeness and host exemption (#247)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("enumerates a lazy base load completely without prior access", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });

		// Nothing has been touched: the recursive-walk workaround would see only namespace shells
		// here. leaves() settles the subtree itself and reads the loader's records.
		const callable = await api.slothlet.api.leaves(".");
		expect(callable).toContain("consumer.readViaSelf");

		const detailed = await api.slothlet.api.leaves(".", { details: true });
		const byPath = Object.fromEntries(detailed.map((d) => [d.path, d.kind]));
		expect(byPath["mod.plain"], "data leaf recorded").toBe("data");
		expect(byPath["mod.__priv"], "underscore exports are members too").toBe("data");
		expect(byPath["mod"], "module namespace").toBe("namespace");
		// The injected control tree is not a module contribution.
		expect(
			detailed.some((d) => d.path === "slothlet" || d.path.startsWith("slothlet.")),
			"no builtins"
		).toBe(false);
		expect(byPath["shutdown"], "no lifecycle builtins").toBeUndefined();
	});

	it("resolves an endpoint to its CURRENT owner, not the first mount registered there", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });
		await api.slothlet.api.add("shop", SHOP);
		const second = await api.slothlet.api.add("shop", {
			exports: {
				/**
				 * Leaf only the second mount owns.
				 * @returns {number} Marker.
				 */
				later() {
					return 2;
				}
			}
		});

		// Both mounts are live at the same endpoint. remove()/reload() resolve "shop" to the current
		// owner; scanning the endpoint map instead answers with whichever was registered first.
		expect(await api.slothlet.api.leaves("shop")).toEqual(await api.slothlet.api.leaves(second));
	});

	it("refuses with the named error when the module is removed mid-settle", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });
		const moduleID = await api.slothlet.api.add("deep", DEEP_DIR);

		// leaves() awaits materialization of the whole subtree; the instance stays live across that
		// await, so a concurrent removal is reachable. The records it reads afterwards are gone —
		// that must surface as this method's own error, not a TypeError from inside the framework.
		const pending = api.slothlet.api.leaves(moduleID);
		await api.slothlet.api.remove(moduleID);
		await expect(pending).rejects.toThrow(/API_LEAVES_UNKNOWN_MODULE/);
	});

	it("terminates on a cycle introduced at runtime", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });
		const moduleID = await api.slothlet.api.add("cyc", {
			exports: {
				nested: {
					/**
					 * The module's only callable.
					 * @returns {number} Marker.
					 */
					leaf() {
						return 1;
					}
				}
			}
		});

		// settle() walks the LIVE api object, and the live object is not guaranteed to be a tree:
		// a member can be pointed back at an ancestor at runtime. Without a visited set this walk
		// never ends — which is why the depth cap it replaced could not simply be deleted.
		api.cyc.loop = api.cyc;
		expect(api.cyc.loop, "the cycle is real, not a copy").toBe(api.cyc);

		expect(await api.slothlet.api.leaves(moduleID)).toEqual(["cyc.nested.leaf"]);
	});

	it("settles a runtime-grafted chain deeper than the JS call stack", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });
		const moduleID = await api.slothlet.api.add("chained", {
			exports: {
				nested: {
					/**
					 * The module's only callable.
					 * @returns {number} Marker.
					 */
					leaf() {
						return 1;
					}
				}
			}
		});

		// The live object's depth is as caller-controlled as its shape: a runtime assignment can
		// graft an arbitrarily deep object chain onto an owned subtree. The unbounded-depth
		// contract that removed the traversal cap has to hold here too — a recursive walk turns
		// "deep but finite" into a call-stack overflow before a single record is read.
		let chain = {};
		for (let i = 0; i < 200000; i++) chain = { next: chain };
		api.chained.graft = chain;

		expect(await api.slothlet.api.leaves(moduleID)).toEqual(["chained.nested.leaf"]);
	});

	it("redacts module-private members the caller could not read", async () => {
		api = await slothlet({ mode: "eager", base: PRIVATE_DIR, permissions: { defaultPolicy: "allow", rules: [] } });

		// The composed surface already redacts these from the host's `Object.keys`; enumeration is
		// the same disclosure and now answers the same way.
		const paths = (await api.slothlet.api.leaves(".", { details: true })).map((d) => d.path);
		expect(paths, "no private member of billing/ is disclosed").toEqual(paths.filter((p) => !/\.__?[a-z]/i.test(p)));
		expect(paths, "public members are untouched").toContain("billing.internals.currency");
	});

	it("returns the unredacted list under includePrivate for the host", async () => {
		api = await slothlet({ mode: "eager", base: PRIVATE_DIR, permissions: { defaultPolicy: "allow", rules: [] } });

		// The tooling case this method exists for: the host asking for the complete picture.
		const paths = (await api.slothlet.api.leaves(".", { details: true, includePrivate: true })).map((d) => d.path);
		expect(paths).toContain("billing.internals.__rate");
		expect(paths).toContain("billing.internals._fee");
	});

	it("lists privates unchanged when permissions are not configured", async () => {
		api = await slothlet({ mode: "eager", base: PRIVATE_DIR });

		// Nothing is private without a permissions config, so nothing is filtered — the answer is
		// exactly what it was before privacy existed.
		const paths = (await api.slothlet.api.leaves(".", { details: true })).map((d) => d.path);
		expect(paths).toContain("billing.internals.__rate");
	});

	it("hides another module's privates from a MODULE caller", async () => {
		api = await slothlet({ mode: "eager", base: PRIVATE_DIR, permissions: { defaultPolicy: "allow", rules: [] } });

		// Called from inside introspect/, so the caller is a module rather than the host. Reaching
		// slothlet.api.leaves is permitted; that says nothing about billing/'s private members.
		const seen = await api.introspect.list.paths({ details: false });
		expect(seen.error).toBeNull();
		expect(
			seen.paths.some((p) => /\.__?[a-z]/i.test(p)),
			"no other module's private is disclosed"
		).toBe(false);
	});

	it("refuses includePrivate to a MODULE caller", async () => {
		api = await slothlet({ mode: "eager", base: PRIVATE_DIR, permissions: { defaultPolicy: "allow", rules: [] } });

		// The unredacted list is a host capability. Allowing a module to ask for it would let it
		// self-grant exactly what the redaction above withholds.
		const seen = await api.introspect.list.paths({ includePrivate: true });
		expect(seen.paths).toBeNull();
		expect(seen.error).toBe("PERMISSION_DENIED");
	});

	it("redacts a private member of an INLINE mount, which has no source file", async () => {
		api = await slothlet({ mode: "eager", base: PRIVATE_DIR, permissions: { defaultPolicy: "allow", rules: [] } });
		await api.slothlet.api.add("inline", { exports: { __secret: 1, open: 2 } });

		// An object mount registers with filePath null, so the same-module comparison has nothing to
		// match on — the member is private and reachable by no one but its own (absent) directory.
		const paths = (await api.slothlet.api.leaves("inline", { details: true })).map((d) => d.path);
		expect(paths).toContain("inline.open");
		expect(paths, "no source file must not mean no privacy").not.toContain("inline.__secret");
	});

	it("rejects a non-boolean includePrivate", async () => {
		api = await slothlet({ mode: "eager", base: PRIVATE_DIR });

		await expect(api.slothlet.api.leaves(".", { includePrivate: "yes" })).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("is unaffected by permission rules on the host's bound handle", async () => {
		api = await slothlet({ mode: "eager", base: BASE, permissions: { defaultPolicy: "deny", rules: [] } });
		await api.slothlet.api.add("shop", SHOP);

		// Enumeration under a caller identity now redacts (#244 shipped) — the host's bound handle
		// is the documented carve-out, and leaves() reads records rather than gated traps anyway.
		expect(await api.slothlet.api.leaves("shop")).toEqual(["shop.mul", "shop.ns.deep"]);
	});
});
