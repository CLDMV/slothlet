/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-add-ownership-prefix.test.vitest.mjs
 *	@Date: 2026-08-08 22:30:00 -07:00 (1786253400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-09 00:49:04 -07:00 (1786261744)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `api.add(mountPath, dir)` ownership records must stay under the mount prefix.
 * @module tests/vitests/suites/api-manager/api-add-ownership-prefix
 *
 * @description
 * The ownership registry (`moduleToPath`) is the source of truth for `remove()`/`reload()` cleanup
 * and for enumeration. Several `ownership.register()` sites in the modes processor built the record
 * apiPath by hand instead of routing through the same `buildApiPath()` the sibling wrapper uses, so
 * when a folder was mounted at a prefix via `api.add("shop", dir)` the record dropped the prefix:
 * a top-level `single`/`pair`/`bag` and a nested `deep.inner.leaf` were registered at bare paths
 * that do not exist on the api. The api SURFACE was correct (the wrappers used the prefix); only the
 * records diverged, which mis-anchors moduleID cleanup and pollutes enumeration. These tests pin the
 * invariant: every path a mounted module owns is the mount itself or lives beneath it.
 */

// Match the other api-manager suites that reach an internal `#handlers/*` entrypoint: set the
// internal-test-mode flag before that import so this suite carries the same gate and never depends
// on another file having set it first under parallel runs.
process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";

const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;
/** A mount exercising every flatten shape: single-export file, multi-export file, object default,
 *  a nested namespace, and a doubly-nested namespace. */
const ADD_DIR = new URL("../../../../api_tests/api_test_add_prefix", import.meta.url).pathname;

/**
 * Read the owned-path set for a moduleID straight from the ownership registry.
 * @param {object} node - Any live api wrapper node (resolves the shared handlers).
 * @param {string} moduleID - The id returned by api.add.
 * @returns {string[]} Sorted owned paths.
 */
function ownedPaths(node, moduleID) {
	const ownership = resolveWrapper(node).slothlet.handlers.ownership;
	return [...(ownership.moduleToPath.get(moduleID) ?? [])].sort();
}

describe.each(["eager", "lazy"])("ApiManager > api.add ownership stays under the mount prefix > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("registers every owned path under the mount, never at a bare top-level path", async () => {
		api = await slothlet({ mode, base: BASE });
		const id = await api.slothlet.api.add("shop", ADD_DIR);

		const paths = ownedPaths(api.shop, id);
		// The invariant: no record escapes the mount. A prefix-less record (e.g. "single", "pair",
		// "bag", "deep.inner.leaf") is the bug — a path that is not on the api at all.
		const escaped = paths.filter((p) => p !== "shop" && !p.startsWith("shop."));
		expect(escaped, "no ownership record escapes the mount prefix").toEqual([]);
		// And the mount really did contribute leaves (guards against a vacuous pass).
		expect(paths).toContain("shop.single");
		expect(paths).toContain("shop.pair.first");
	});

	it("keeps a deep mount path under its full prefix", async () => {
		// A dotted mount must anchor every record under the whole path, not the last segment.
		api = await slothlet({ mode, base: BASE });
		const id = await api.slothlet.api.add("ext.alpha", ADD_DIR);

		const mount = "ext.alpha";
		// Allowed: the mount itself, anything beneath it, or an ANCESTOR namespace of the mount
		// (e.g. "ext" — the intermediate container the mount path creates). A leak is a leaf that
		// dropped the prefix ("single", "alpha.single"), which none of these arms admit.
		const escaped = ownedPaths(api.ext, id).filter((p) => p !== mount && !p.startsWith(`${mount}.`) && !mount.startsWith(`${p}.`));
		expect(escaped, "records anchor under the full dotted mount path").toEqual([]);
	});
});

describe("ApiManager > api.add ownership prefix — base load is unaffected", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("registers base-load paths bare, since there is no mount prefix", async () => {
		// The fix routes record paths through buildApiPath, which is a no-op when there is no prefix.
		// Loaded as the base, the same fixture must record bare paths exactly as before.
		api = await slothlet({ mode: "eager", base: ADD_DIR });
		const ownership = resolveWrapper(api.single).slothlet.handlers.ownership;
		const all = [...ownership.moduleToPath.values()].flatMap((set) => [...set]);
		expect(all, "base load records the file's own leaf, unprefixed").toContain("single");
		expect(all).toContain("nested.alpha");
		// No accidental prefixing at base load.
		expect(
			all.some((p) => p.startsWith("shop.") || p.startsWith("ext.")),
			"no phantom prefix at base load"
		).toBe(false);
	});
});
