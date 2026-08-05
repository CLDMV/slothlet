/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-leaves.test.vitest.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-04 12:00:00 -07:00 (1785870000)
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

	it("is unaffected by permission rules on the host's bound handle", async () => {
		api = await slothlet({ mode: "eager", base: BASE, permissions: { defaultPolicy: "deny", rules: [] } });
		await api.slothlet.api.add("shop", SHOP);

		// Enumeration under a caller identity now redacts (#244 shipped) — the host's bound handle
		// is the documented carve-out, and leaves() reads records rather than gated traps anyway.
		expect(await api.slothlet.api.leaves("shop")).toEqual(["shop.mul", "shop.ns.deep"]);
	});
});
