/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-multi-instance-tagged-compile.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:54-08:00 (1795536534)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Two instances with the permission system on, each judging only the compiles tagged as its own.
 *
 * @description
 * Each instance loads a module file under its own `?slothlet_instance=<id>` tag, and the hooks that check compiles are
 * shared by the process. A compile tagged with another instance's id is that instance's to judge while it is up with its
 * own check registered, so two instances loading the same file at once both load it. A module's own code compiling under
 * a name tagged with another instance's id, an unknown id, or the id of an instance that has shut down is refused as
 * any other compile of its own is.
 *
 * @module tests/vitests/suites/permissions/permissions-multi-instance-tagged-compile
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const HERE = fileURLToPath(import.meta.url);
const CODER = path.resolve(path.dirname(HERE), "../../../../api_tests/api_test_code_strings_coder/api");
const OWN = pathToFileURL(path.join(CODER, "probe.mjs")).href;
const ROUTES = ["compileFunction", "runInThisContext", "script", "moduleCompile"];
const OPEN = { caller: "**", target: "**", effect: "allow" };
const PERMISSIONS = { policy: "deny", rules: [OPEN] };
const REFUSED = { ok: false, code: "PERMISSION_CAPABILITY_REFUSED" };

describe.each(getMatrixConfigs())("Permissions > Multi-Instance > tagged compiles > $name", ({ config }) => {
	const instances = [];

	/**
	 * Create an instance and track it for shutdown.
	 * @param {object} options - Options beyond the matrix config.
	 * @returns {Promise<object>} The api.
	 */
	async function create(options) {
		const api = await slothlet({ ...config, silent: true, ...options });
		instances.push(api);
		return api;
	}

	afterEach(async () => {
		for (const api of instances) await api?.slothlet?.shutdown?.();
		instances.length = 0;
	});

	it("two instances loading the same file at once both load it", async () => {
		const options = { base: TEST_DIRS.API_TEST_PERMISSIONS, permissions: { policy: "allow", rules: [] } };
		const [apiA, apiB] = await Promise.all([create(options), create(options)]);
		const results = await Promise.allSettled([
			(async () => apiA.callers.untrustedCaller.callAdmin())(),
			(async () => apiB.callers.untrustedCaller.callAdmin())()
		]);
		const expected = { ok: true, module: "admin", action: "create", name: "hacker" };
		expect(results).toEqual([
			{ status: "fulfilled", value: expected },
			{ status: "fulfilled", value: expected }
		]);
	});

	it.each(ROUTES)("refuses module code compiling under a name tagged with another instance's id (%s)", async (route) => {
		const apiA = await create({ base: CODER, permissions: PERMISSIONS });
		const apiB = await create({ base: CODER, permissions: PERMISSIONS });
		const otherID = apiB.slothlet.instance.id;
		expect(otherID).not.toBe(apiA.slothlet.instance.id);
		expect(await apiA.probe.compileUnder(route, `${OWN}?slothlet_instance=${otherID}`)).toMatchObject(REFUSED);
	});

	it.each(ROUTES)("refuses module code compiling under a name tagged with an unknown instance id (%s)", async (route) => {
		const apiA = await create({ base: CODER, permissions: PERMISSIONS });
		expect(await apiA.probe.compileUnder(route, `${OWN}?slothlet_instance=no-such-instance`)).toMatchObject(REFUSED);
	});

	it.each(ROUTES)("refuses module code compiling under a name tagged with a shut-down instance's id (%s)", async (route) => {
		const finished = await slothlet({ ...config, silent: true, base: CODER, permissions: PERMISSIONS });
		const finishedID = finished.slothlet.instance.id;
		await finished.slothlet.shutdown();
		const apiA = await create({ base: CODER, permissions: PERMISSIONS });
		expect(apiA.slothlet.instance.id).not.toBe(finishedID);
		expect(await apiA.probe.compileUnder(route, `${OWN}?slothlet_instance=${finishedID}`)).toMatchObject(REFUSED);
	});
});
