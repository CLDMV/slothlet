/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-dispatcher-set.test.vitest.mjs
 *	@Date: 2026-04-12 00:00:00 -07:00 (1776808800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-12 00:00:00 -07:00 (1776808800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Dispatcher proxy set trap — regression tests for the missing `set`
 * trap on the version dispatcher proxy.
 *
 * Bug: without a `set` trap, the dispatcher's `getOwnPropertyDescriptor` trap
 * returns `{ writable: false }` for all unknown properties. V8's default `[[Set]]`
 * path consults GOPD on the receiver and refuses the write with
 * "Cannot redefine property: <prop>", even on the first assignment.
 *
 * Fix: the `set` trap delegates via `Reflect.set(vw, prop, value, vw)` to the
 * real versioned wrapper's own `setTrap`, which performs the correct
 * delete → `defineProperty(configurable: true)` cycle.
 *
 * @module tests/vitests/suites/versioning/versioning-dispatcher-set
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

/** Helper: one versioned path "auth" registered as v1 (default). */
async function makeApi(config) {
	const api = await slothlet({ ...config, dir: `${BASE}/callers` });
	await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
	return api;
}

describe.each(getMatrixConfigs())("Versioning > Dispatcher set trap > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("plain assignment to a dispatcher path does not throw", async () => {
		api = await makeApi(config);
		expect(() => {
			api.auth.runtimeProp = "hello";
		}).not.toThrow();
	});

	it("assigned value is readable back through the dispatcher", async () => {
		api = await makeApi(config);
		api.auth.runtimeProp = "hello";
		expect(api.auth.runtimeProp).toBe("hello");
	});

	it("value is stored on the versioned wrapper, not the dispatcher target", async () => {
		api = await makeApi(config);
		api.auth.runtimeProp = "from-dispatcher";
		// The real versioned path must also see the value
		expect(api.v1.auth.runtimeProp).toBe("from-dispatcher");
	});

	it("assignment can be repeated without throwing (reassignment cycle)", async () => {
		api = await makeApi(config);
		expect(() => {
			api.auth.runtimeProp = "first";
			api.auth.runtimeProp = "second";
			api.auth.runtimeProp = "third";
		}).not.toThrow();
		expect(api.auth.runtimeProp).toBe("third");
	});

	it("multiple distinct properties can be assigned", async () => {
		api = await makeApi(config);
		api.auth.clientA = "a";
		api.auth.clientB = "b";
		api.auth.clientC = 42;
		expect(api.auth.clientA).toBe("a");
		expect(api.auth.clientB).toBe("b");
		expect(api.auth.clientC).toBe(42);
	});

	it("assignment routes to the active default version when two versions exist", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });
		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		api.auth.sharedClient = "shared";

		// v1 is the default — prop must be visible on v1.auth
		expect(api.v1.auth.sharedClient).toBe("shared");
		// v2.auth should NOT have it (different wrapper)
		expect(api.v2.auth.sharedClient).toBeUndefined();
	});
});
