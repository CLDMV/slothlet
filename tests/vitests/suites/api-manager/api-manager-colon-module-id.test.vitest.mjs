/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-colon-module-id.test.vitest.mjs
 *	@Date: 2026-08-24T00:00:00-08:00 (1756022400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-24T00:00:00-08:00 (1756022400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A moduleID containing a colon must round-trip through add/leaves/remove/reload (#303).
 *
 * @description
 * `:` was once slothlet's internal composite `moduleID:apiPath` separator, so a user-supplied moduleID
 * containing a colon (e.g. a `vine:abc` namespaced convention) used to be un-removable: removeApiComponent
 * split the argument on `:` and looked up only the first segment. The internal separator is now a reserved
 * multi-character token (`MODULE_ID_SEPARATOR`) that a moduleID may not contain, so `:` — and every other
 * character — is a free, fully round-trippable character in a module id.
 *
 * @module tests/vitests/suites/api-manager/api-manager-colon-module-id
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const EAGER_CONFIGS = [
	{ name: "eager/hooks-on", config: { mode: "eager", runtime: "async", hook: { enabled: true } } },
	{ name: "eager/hooks-off", config: { mode: "eager", runtime: "async", hook: { enabled: false } } }
];

// Every id here is an accepted moduleID that a consumer might use; the colon ones are the regression,
// the hyphen one is the control that always worked, and the multi-colon one guards the "split on the
// first colon" assumption specifically.
const COLON_IDS = ["vine:abc", "plugin:opensearch:v1"];
const CONTROL_ID = "vine-abc";

describe.each(EAGER_CONFIGS)("colon moduleID round-trips — $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it.each(COLON_IDS)("remove(id) removes a directory mount added under moduleID %s", async (moduleID) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		const id = await api.slothlet.api.add("shopfront", TEST_DIRS.API_TEST_MIXED, { moduleID });
		expect(id).toBe(moduleID); // add() hands back the exact id
		expect(api.shopfront).toBeDefined();

		// The exact id add() returned must remove the mount.
		const removed = await api.slothlet.api.remove(id);
		expect(removed).toBe(true);
		expect(api.shopfront).toBeUndefined();
	});

	it.each(COLON_IDS)("leaves(id) enumerates the owned paths for moduleID %s", async (moduleID) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("shopfront", TEST_DIRS.API_TEST_MIXED, { moduleID });

		// Resolution is by verbatim id — leaves must not throw API_LEAVES_UNKNOWN_MODULE and must
		// return this mount's owned callable paths (host tooling call).
		const paths = await api.slothlet.api.leaves(moduleID, { includePrivate: true });
		expect(Array.isArray(paths)).toBe(true);
		expect(paths.length).toBeGreaterThan(0);
		expect(paths.every((p) => p.startsWith("shopfront"))).toBe(true);
	});

	it.each(COLON_IDS)("reload(id) rebuilds a mount added under moduleID %s", async (moduleID) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("shopfront", TEST_DIRS.API_TEST_MIXED, { moduleID });
		expect(api.shopfront).toBeDefined();

		await expect(api.slothlet.api.reload(moduleID)).resolves.toBeUndefined();
		expect(api.shopfront).toBeDefined();
	});

	it("remove(id) removes a synthetic (in-memory) mount added under a colon moduleID", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		const id = await api.slothlet.api.add("synth", () => 1, { moduleID: "vine:xyz" });
		expect(id).toBe("vine:xyz");
		expect(typeof api.synth).toBe("function");

		expect(await api.slothlet.api.remove(id)).toBe(true);
		expect(api.synth).toBeUndefined();
	});

	it.each(COLON_IDS)("remove(id) still works after reload(id) for moduleID %s", async (moduleID) => {
		// Guards against reload re-attributing the mount's children under a colon-truncated base id,
		// which would leave remove() unable to find them afterward.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("shopfront", TEST_DIRS.API_TEST_MIXED, { moduleID });
		await api.slothlet.api.reload(moduleID);
		expect(api.shopfront).toBeDefined();

		expect(await api.slothlet.api.remove(moduleID)).toBe(true);
		expect(api.shopfront).toBeUndefined();
	});

	it("control: a hyphen moduleID still removes (no regression)", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		const id = await api.slothlet.api.add("shopfront", TEST_DIRS.API_TEST_MIXED, { moduleID: CONTROL_ID });
		expect(id).toBe(CONTROL_ID);
		expect(await api.slothlet.api.remove(id)).toBe(true);
		expect(api.shopfront).toBeUndefined();
	});

	it("remove('vine:abc') must NOT collide with a registered 'vine' module (no ':'-prefix truncation)", async () => {
		// Regression: resolving a moduleID must never truncate on ':' — removing an unregistered
		// "vine:abc" once matched the registered base "vine" and wrongly removed it.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("shopfront", TEST_DIRS.API_TEST_MIXED, { moduleID: "vine" });
		expect(api.shopfront).toBeDefined();

		expect(await api.slothlet.api.remove("vine:abc")).toBe(false);
		expect(api.shopfront).toBeDefined(); // the "vine" mount survives

		// And the real id still removes it.
		expect(await api.slothlet.api.remove("vine")).toBe(true);
		expect(api.shopfront).toBeUndefined();
	});

	it("rejects a moduleID containing the reserved internal separator", async () => {
		// The one token a module id may NOT contain — it is the delimiter slothlet joins the id and
		// apiPath with in the internal composite key, so allowing it would corrupt that key.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await expect(api.slothlet.api.add("blocked", TEST_DIRS.API_TEST_MIXED, { moduleID: `a${MODULE_ID_SEPARATOR}b` })).rejects.toMatchObject(
			{ code: "MODULE_ID_RESERVED_SEPARATOR" }
		);
		expect(api.blocked).toBeUndefined();
	});
});
