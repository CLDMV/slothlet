/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/version-dispatcher-private-marker.test.vitest.mjs
 *	@Date: 2026-08-17 12:00:00 -07:00 (1786993200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-17 12:00:00 -07:00 (1786993200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Version-dispatcher marker under the module-private host gate (#283).
 *
 * @description
 * #269 made an `_`/`__`-prefixed member module-private — denied to an unidentified (host) caller
 * by default. A version dispatcher stamps slothlet's OWN reserved marker keys (`__isVersionDispatcher`,
 * `__logicalPath`) on its target; when that dispatcher collides with an existing module the framework
 * merges those keys onto the module's wrapper and then reads them back as the host (caller `null`).
 * Before the fix that read was denied — aborting composition of every version-dispatched field and
 * regressing 3.12.3 → 3.13.x. The fix exempts slothlet's OWN marker keys by OBJECT IDENTITY (a
 * module-private brand), never by name, so a consumer's identically-named private member stays denied.
 *
 * @module tests/vitests/suites/permissions/version-dispatcher-private-marker
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const VBASE = TEST_DIRS.API_TEST_VERSIONED;
const FIELD_BASE = `${VBASE}/field-base`; // a base module with a public terminal export `label`
const PRIVATE_BASE = new URL("../../../../api_tests/api_test_private", import.meta.url).pathname;

describe.each(["eager", "lazy"])("Permissions > version-dispatcher marker (#283) > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("version-dispatching a field that collides with an existing module composes without denying slothlet's own marker", async () => {
		api = await slothlet({ mode, base: TEST_DIRS.API_TEST, permissions: { defaultPolicy: "allow", rules: [] } });

		// A module already exists at advanced.activationEvents; version-dispatching the SAME path makes
		// slothlet merge the dispatcher (which carries __isVersionDispatcher/__logicalPath) into that
		// module's wrapper, then read the marker back as the host. Before the fix this threw
		// PERMISSION_DENIED at api.add time.
		await expect(api.slothlet.api.add(["advanced", "activationEvents"], FIELD_BASE, {}, {})).resolves.toBeDefined();
		await expect(
			api.slothlet.api.add(["advanced", "activationEvents"], `${VBASE}/v1`, {}, { version: "v1", default: true })
		).resolves.toBeDefined();
		await expect(api.slothlet.api.add(["advanced", "activationEvents"], `${VBASE}/v2`, {}, { version: "v2" })).resolves.toBeDefined();
	});

	it("keeps slothlet's own marker readable by the host but stays scoped to the marker keys", async () => {
		api = await slothlet({ mode, base: TEST_DIRS.API_TEST, permissions: { defaultPolicy: "allow", rules: [] } });
		await api.slothlet.api.add(["advanced", "activationEvents"], FIELD_BASE, {}, {});
		await api.slothlet.api.add(["advanced", "activationEvents"], `${VBASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add(["advanced", "activationEvents"], `${VBASE}/v2`, {}, { version: "v2" });

		const advanced = mode === "lazy" ? await api.advanced : api.advanced;
		const field = mode === "lazy" ? await advanced.activationEvents : advanced.activationEvents;
		// The consumer relies on this read returning true to detect a version-dispatched field — the
		// same behavior 3.12.3 had. It must NOT throw and must report the dispatcher.
		expect(field.__isVersionDispatcher).toBe(true);
		// The exemption is scoped to the marker keys, not the whole branded wrapper: a public terminal
		// member on that same branded wrapper is read through the normal gate (allowed because public).
		expect(field.label).toBe("base-field");
	});

	it("does not open an unrelated consumer module-private member to the host (#269 preserved)", async () => {
		// Scope guard: the exemption is for slothlet's OWN marker keys only. A genuine consumer
		// `__`-private member (billing.internals.__rate) must still be denied to the host by default.
		api = await slothlet({ mode, base: PRIVATE_BASE, permissions: { defaultPolicy: "allow", rules: [] } });
		let read;
		try {
			read = await api.billing.internals.__rate;
		} catch (e) {
			read = `THREW:${e.code}`;
		}
		expect(read).toBe("THREW:PERMISSION_DENIED");
	});
});
