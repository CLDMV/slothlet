/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-basics.test.vitest.mjs
 *	@Date: 2026-04-01 22:41:24 -07:00 (1775108484)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:48 -07:00 (1775108928)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Versioning basics — verify versioned namespaces and dispatcher creation.
 *
 * After registering v1 and v2 of the same logical path "auth":
 * - api.v1.auth and api.v2.auth should exist and be callable
 * - api.auth dispatcher should exist
 *
 * @module tests/vitests/suites/versioning/versioning-basics
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Basics > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("mounts versioned namespaces and creates dispatcher", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Direct versioned namespaces must exist
		expect(api.v1).toBeDefined();
		expect(api.v2).toBeDefined();
		expect(api.v1.auth).toBeDefined();
		expect(api.v2.auth).toBeDefined();

		// Both versioned auth.login functions should be callable
		const r1 = api.v1.auth.login("alice");
		const r2 = api.v2.auth.login("alice", "secret");
		expect(r1.version).toBe("v1");
		expect(r2.version).toBe("v2");

		// Dispatcher must be present at logical path
		expect(api.auth).toBeDefined();
		expect(api.auth.__isCallable).toBe(false);
		expect(api.auth.__apiPath).toBe("auth");
	});

	it("versioned namespace functions return correct shapes", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		const logout1 = api.v1.auth.logout();
		const logout2 = api.v2.auth.logout();
		expect(logout1.version).toBe("v1");
		expect(logout2.version).toBe("v2");

		const user1 = api.v1.auth.createUser({ name: "alice" });
		const user2 = api.v2.auth.createUser({ name: "alice" }, { role: "admin" });
		expect(user1.version).toBe("v1");
		expect(user2.version).toBe("v2");
		expect(user2.options).toEqual({ role: "admin" });
	});
});
