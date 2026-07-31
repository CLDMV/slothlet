/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-self-outside-module.test.vitest.mjs
 *	@Date: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `self` belongs to an executing module, not to whoever imported the runtime.
 *
 * @description
 * `self` is the in-module view of the api, and what makes it safe is that every access is attributed
 * to the module making it. Code that is not a module has no such attribution — so if `self` resolved
 * for it, it would resolve as the host, which is exempt from the rules. Any script able to
 * `import { self } from "@cldmv/slothlet/runtime"` would then hold full authority over a running
 * instance, including `slothlet.permissions.control.disable()`, regardless of what the rules say.
 *
 * The async runtime refuses this for free: with no AsyncLocalStorage store there is nothing to read
 * through. The live runtime keeps its store in a field that stays populated for the instance's whole
 * lifetime, so a live instance alone was enough to make `self` resolve for anyone.
 *
 * Reaching the api from outside is what the bound `api` object returned by `slothlet()` is for, and
 * the last case pins that down — this narrows `self`, not host access.
 *
 * Enumeration is covered alongside the read because a proxy that refuses `get` but answers `ownKeys`,
 * `in`, or `getOwnPropertyDescriptor` still discloses the shape of the api to a caller with no
 * standing to see it — the same trap-by-trap inconsistency that made denied leaves enumerable.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > self outside a module > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("refuses to read through while no module is executing", async () => {
		api = await slothlet({ ...config, base: BASE });

		expect(() => self.db).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
	});

	it("refuses to reach the internal namespace, so the permission system cannot be turned off", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "callers.**", effect: "allow" }] }
		});

		// The worst version of the read above: `control.disable()` would drop enforcement wholesale.
		expect(() => self.slothlet).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
	});

	it("discloses no shape through enumeration, membership, or descriptors", async () => {
		api = await slothlet({ ...config, base: BASE });

		expect(Reflect.ownKeys(self)).toEqual([]);
		expect("db" in self).toBe(false);
		expect(Object.getOwnPropertyDescriptor(self, "db")).toBeUndefined();
		expect({ ...self }).toEqual({});
	});

	it("refuses to write through, so the api tree cannot be reshaped from outside", async () => {
		api = await slothlet({ ...config, base: BASE });

		// Writes through `self` claim ownership of the path they land on, which is attributed to the
		// writing module. With no module writing there is nobody to attribute it to.
		expect(() => {
			self.injected = () => "owned";
		}).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		expect(api.injected).toBeUndefined();
	});

	it("leaves the host's own route into the api untouched", async () => {
		api = await slothlet({ ...config, base: BASE });

		// `api` is the host's handle and carries the host's standing; only `self` is narrowed.
		expect(String(await api.callers.dataReader.readToken())).toContain("super-secret-token");
	});
});
