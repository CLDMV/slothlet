/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-live-delegation.test.vitest.mjs
 *	@Date: 2026-09-07T00:00:49-07:00 (1788764449)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-07 08:25:58 -07:00 (1788794758)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression coverage for #340 — wrap-on-set (`self.X = obj`) must delegate
 * live to the assigned object instead of eagerly cloning/snapshotting it, and must not
 * exclude EventEmitter-derived instances from `self`-context access.
 *
 * Covers the acceptance criteria from the issue body's "End-to-end verification" section:
 *  - two-way live binding for a plain object assigned via wrap-on-set (raw write visible
 *    through the wrapper, wrapper write visible on the raw object)
 *  - the same, two levels of nesting deep
 *  - read-level permission gating still enforced on the live-delegated path
 *  - an EventEmitter-derived instance assigned via wrap-on-set gets real `self`-context
 *    access on its own methods instead of throwing RUNTIME_NO_ACTIVE_CONTEXT_SELF
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe("UnifiedWrapper > wrap-on-set live delegation (#340)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("raw mutation of the assigned object is visible through the wrapper", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		expect(await api.mod.readXY()).toBe(1);

		obj.y = 2;
		expect(await api.mod.readXY()).toBe(2);
	});

	it("a wrapper write reaches the original raw object", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		api.mod.x.y = 5;

		expect(obj.y).toBe(5);
		expect(await api.mod.readXY()).toBe(5);
	});

	it("stays live two levels deep", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		expect(await api.mod.readNestedZ()).toBe(1);

		obj.nested.z = 6;
		expect(await api.mod.readNestedZ()).toBe(6);

		api.mod.x.nested.z = 9;
		expect(obj.nested.z).toBe(9);
	});

	it("read-level permission gating still applies to a wrap-on-set-grafted property", async () => {
		api = await slothlet({
			base: BASE,
			mode: "eager",
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.untrustedCaller.**", target: "mod.**", effect: "deny" }]
			}
		});

		await api.mod.assignX();

		// External read (no caller context) is exempt from gating.
		expect(await api.mod.readXY()).toBe(1);

		// A caller explicitly denied against mod.** is refused, even on the live-delegated path.
		try {
			await api.callers.untrustedCaller.callModReadXY();
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("an EventEmitter-derived instance assigned via wrap-on-set resolves self in its own methods", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		await api.mod.assignDriver();
		await expect(api.mod.driverDoWork()).resolves.toBe("mod-label");
	});

	it("still behaves as a real EventEmitter (on/emit) after wrap-on-set", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const driver = await api.mod.assignDriver();
		let fired = false;
		driver.on("ping", () => {
			fired = true;
		});
		driver.emit("ping");
		expect(fired).toBe(true);
	});
});
