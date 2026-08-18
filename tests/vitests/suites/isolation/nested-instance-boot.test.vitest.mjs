/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/nested-instance-boot.test.vitest.mjs
 *	@Date: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression tests for #290 — booting a nested slothlet instance from inside a leaf
 * of a permissioned outer instance. The nested instance is a separate `slothlet()` with its own
 * (here absent → disabled, or its own default-deny) permission config, yet its own construction was
 * enforced against the OUTER instance's ambient caller because the live/async context managers are
 * singletons shared across instances. Per the documented Multi-Instance Isolation contract
 * (PERMISSIONS.md), an instance's own boot must never be enforced against another instance's caller.
 * @module tests/vitests/suites/isolation/nested-instance-boot.test.vitest
 * @memberof tests.vitests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const ALL_CONFIGS = getMatrixConfigs({});

describe.each(ALL_CONFIGS)("Nested instance boot inside a permissioned leaf > Config: '$name'", ({ config }) => {
	let slothlet;
	let instances = [];

	beforeEach(async () => {
		slothlet = (await import("@cldmv/slothlet")).default;
		instances = [];
	});

	afterEach(async () => {
		for (const instance of instances) {
			if (instance) await instance.shutdown();
		}
		instances = [];
	});

	it("boots an unpermissioned nested instance inside a permissioned outer leaf", async () => {
		const api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST_NESTED_ISOLATION,
			permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "root.**", effect: "allow" }] }
		});
		instances.push(api);

		await expect(api.root.boot(config.runtime)).resolves.toEqual({ booted: true, probe: true });
	});

	it("boots a default-deny nested instance inside a permissioned outer leaf", async () => {
		const api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST_NESTED_ISOLATION,
			permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "root.**", effect: "allow" }] }
		});
		instances.push(api);

		await expect(api.root.bootDeny(config.runtime)).resolves.toEqual({ booted: true, probe: true });
	});
});
