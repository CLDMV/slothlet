/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/apipath-matches-surface.test.vitest.mjs
 *	@Date: 2026-07-28 12:00:00 -07:00 (1785265200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-28 12:00:00 -07:00 (1785265200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";
import path from "node:path";

const API_TEST = TEST_DIRS.API_TEST;
const FLATTEN_ROOT = path.join(path.dirname(API_TEST), "smart_flatten");

/**
 * A wrapper's `apiPath` is its identity: permissions, hooks, ownership, path metadata and
 * versioning all key off it. So it has to name the path the wrapper is actually reachable at.
 *
 * It used to be derived independently of the surface and drift from it in two directions.
 * Nested directories inherited the unchanged prefix, so anything below depth 1 was pathed from
 * its own name alone — `deep.folder.config.get` became `folder.config.get`, and `deep.folder`
 * and `deep2.folder` collapsed onto one `folder`, making two distinct namespaces
 * indistinguishable to every one of those subsystems. In the other direction, a level that
 * smart-flattening removed from the surface still contributed its segment, so a mount produced
 * leaves at paths no caller could reach.
 *
 * Rather than pin the handful of paths that happened to be wrong, this walks the whole surface
 * and asserts the invariant directly, so any future divergence surfaces wherever it appears.
 *
 * @param {object} node - Node to walk.
 * @param {string} surface - Dotted position `node` is reachable at.
 * @param {Set<object>} seen - Cycle guard.
 * @param {string[]} out - Collected `surface != apiPath` mismatches.
 * @returns {void}
 */
const collectMismatches = (node, surface, seen, out) => {
	if (node === null || (typeof node !== "object" && typeof node !== "function")) return;
	if (seen.has(node)) return;
	seen.add(node);

	const declared = node.__apiPath;
	if (typeof declared === "string" && surface && declared !== surface) {
		out.push(`${surface} != ${declared}`);
	}
	for (const key of Object.keys(node)) {
		if (key.startsWith("_") || key === "slothlet" || key === "shutdown" || key === "destroy") continue;
		let child;
		try {
			child = node[key];
		} catch {
			continue;
		}
		collectMismatches(child, surface ? `${surface}.${key}` : key, seen, out);
	}
};

/**
 * @param {object} api - Bound api.
 * @returns {string[]} Every wrapper whose declared path disagrees with its surface position.
 */
const mismatches = (api) => {
	const out = [];
	collectMismatches(api, "", new Set(), out);
	return out;
};

describe.each(getMatrixConfigs())("Smart Flattening > apiPath matches surface > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("base composition: every wrapper's apiPath is its surface position, at any depth", async () => {
		api = await slothlet({ ...config, base: API_TEST });

		// Touch the deep namespaces so lazy wrappers materialize before the walk — an
		// unmaterialized subtree would otherwise pass by simply not being there.
		await api.deep.folder.config.get();
		await api.deep2.folder.math.add(1, 2);
		await api.advanced.nest2.alpha.hello();

		expect(mismatches(api)).toEqual([]);
	});

	it("sibling namespaces sharing a child name stay distinguishable", async () => {
		api = await slothlet({ ...config, base: API_TEST });

		await api.deep.folder.config.get();
		await api.deep2.folder.math.add(1, 2);

		// Both are named `folder`. If the path dropped the parent segment they would collapse
		// onto one identity, and a rule or hook targeting one would silently govern the other.
		expect(api.deep.folder.__apiPath).toBe("deep.folder");
		expect(api.deep2.folder.__apiPath).toBe("deep2.folder");
	});

	it("api.add mount whose folder repeats the mount's last segment", async () => {
		// Mounted at `config` over a folder holding `config/config.mjs`, so Rule 13 collapses the
		// duplicate level off the surface. Uses the permissions fixture as the base purely because
		// `api_test` already exposes a top-level `config`, which would collide with the mount.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_PERMISSIONS });
		await api.slothlet.api.add("config", path.join(FLATTEN_ROOT, "api_smart_flatten_folder_config"));

		// The inner `config/` level is flattened off the surface, so it must not appear in a path.
		void (await api.config.getNestedConfig());
		expect(api.config.getNestedConfig.__apiPath).toBe("config.getNestedConfig");
		expect(mismatches(api)).toEqual([]);
	});

	it("single-file api.add exposes the file's exports at the mount path, and paths follow", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_PERMISSIONS });
		await api.slothlet.api.add(["exts", "zeta"], path.join(FLATTEN_ROOT, "api_smart_flatten_folder_config", "main.mjs"));

		// The filename level is unwrapped by the mount, so it is not part of any path either.
		void (await api.exts.zeta.getRootInfo());
		expect(api.exts.zeta.getRootInfo.__apiPath).toBe("exts.zeta.getRootInfo");
	});
});
