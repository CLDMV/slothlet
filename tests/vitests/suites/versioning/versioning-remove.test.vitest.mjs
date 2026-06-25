/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-remove.test.vitest.mjs
 *	@Date: 2026-04-01 22:43:03 -07:00 (1775108583)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-18 09:15:34 -0700 (1781799334)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Remove a version — verify dispatcher falls back to remaining version
 * after one is removed, and the removed versioned namespace is gone. Also covers the
 * versionKey TRUE arm of removeApiComponent's apiPath+moduleID delete branch
 * (api-manager L~2246-2250): removing a versioned module by its versioned API path
 * resolves to that module's moduleID, getVersionKeyForModule returns its version key,
 * and unregisterVersion clears the version registration.
 *
 * Note: the sibling hasDispatcher TRUE arm (L~2254-2256) is NOT reachable from this
 * branch via the public API — see the explanation on the arm-1 test below and the
 * handler-level coverage in api-manager-internal-guards (section 7).
 *
 * @module tests/vitests/suites/versioning/versioning-remove
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Remove > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("after removing v2, dispatcher falls back to v1 and api.v2.auth is gone", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versionDispatcher: () => null // always fall to default
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Both exist before removal
		expect(api.v1.auth).toBeDefined();
		expect(api.v2.auth).toBeDefined();
		expect(api.auth).toBeDefined();

		// Remove v2
		await api.slothlet.versioning.unregister("auth", "v2");

		// v2 namespace should be gone
		expect(api.v2).toBeUndefined();

		// v1 still exists
		expect(api.v1.auth).toBeDefined();

		// Dispatcher still exists and now defaults to v1
		expect(api.auth).toBeDefined();
		const result = api.unversionedCaller.callLogin("testUser");
		expect(result.version).toBe("v1");
	});

	it("version list reflects removal", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		expect(Object.keys(api.slothlet.versioning.list("auth").versions)).toHaveLength(2);

		await api.slothlet.versioning.unregister("auth", "v2");

		const info = api.slothlet.versioning.list("auth");
		expect(Object.keys(info.versions)).toHaveLength(1);
		expect(info.versions).toHaveProperty("v1");
		expect(info.versions).not.toHaveProperty("v2");
	});

	it("remove by versioned API path unregisters the version key (api-manager L~2246-2250, versionKey TRUE arm)", async () => {
		// Covers the versionKey TRUE arm of removeApiComponent's apiPath+moduleID delete branch.
		//
		// Routing: api.slothlet.api.remove("v1.auth") passes a dotted path that matches NO
		// registered moduleID prefix, so removeApiComponent resolves it through
		// ownership.getCurrentOwner("v1.auth") → owner.moduleID = the versioned module's id.
		// That sets BOTH apiPath ("v1.auth") and moduleID, so the apiPath+moduleID branch runs;
		// ownership returns action "delete"; getVersionKeyForModule(moduleID) returns
		// { logicalPath: "auth", versionTag: "v1" } (TRUE arm) → unregisterVersion("auth","v1").
		//
		// A custom moduleID ("authV1mod"/"authV2mod") is used so the id does NOT share the
		// logical-path prefix — otherwise api.remove("auth") would match the "auth_<hash>"
		// default moduleID and route through the moduleID-only branch instead (which is a
		// SEPARATE, already-covered version-cleanup block at L~2324-2329).
		//
		// Two versions are registered so that unregisterVersion REBUILDS the dispatcher (v2
		// remains) rather than tearing it down — this keeps the assertion focused on the
		// versionKey arm. The sibling hasDispatcher arm cannot co-fire here: normalizedPath is
		// "v1.auth", and the dispatcher lives at "auth", so hasDispatcher("v1.auth") is false.
		// (The hasDispatcher TRUE arm requires the path's owner to lack a version key while a
		// dispatcher is live at that exact path — an internal state no public removal produces,
		// because the dispatcher's synthetic moduleID is never registered in ownership and any
		// real version owner always has a version key. Covered at handler level instead.)
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, { moduleID: "authV1mod" }, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { moduleID: "authV2mod" }, { version: "v2" });

		// Before removal: both versioned namespaces and the dispatcher are live.
		expect(api.v1.auth).toBeDefined();
		expect(api.v2.auth).toBeDefined();
		expect(api.auth).toBeDefined();
		expect(Object.keys(api.slothlet.versioning.list("auth").versions)).toHaveLength(2);

		// Remove the v1 versioned module by its versioned API path → versionKey TRUE arm.
		const result = await api.slothlet.api.remove("v1.auth");
		expect(result).toBe(true);

		// v1 namespace gone; v2 survives; dispatcher rebuilt and still live (now defaults to v2).
		expect(api.v1).toBeUndefined();
		expect(api.v2.auth).toBeDefined();
		expect(api.auth).toBeDefined();

		// Version registry reflects the unregisterVersion call from the versionKey arm.
		const info = api.slothlet.versioning.list("auth");
		expect(Object.keys(info.versions)).toHaveLength(1);
		expect(info.versions).toHaveProperty("v2");
		expect(info.versions).not.toHaveProperty("v1");
		expect(info.default).toBe("v2");
	});
});
