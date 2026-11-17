/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-mutations-control.test.vitest.mjs
 *	@Date: 2026-04-17T14:00:00-07:00 (1776459600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:18-07:00 (1791090918)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > mutations control > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("should disable permissions.rules.add when config.api.mutations.permissions is false", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow"
			},
			api: {
				mutations: {
					permissions: false
				}
			}
		});

		// Should throw INVALID_CONFIG_MUTATIONS_DISABLED when trying to add a rule
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				api.slothlet.permissions.rules.add({ caller: "untrusted.**", target: "**", effect: "deny" });
				expect.unreachable("Should have thrown INVALID_CONFIG_MUTATIONS_DISABLED");
			} catch (error) {
				expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
				expect(error.context?.operation).toEqual(["slothlet", "permissions", "rules", "add"]);
			}
		});
	});

	it("should allow permissions.rules.add when config.api.mutations.permissions is true", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow"
			},
			api: {
				mutations: {
					permissions: true
				}
			}
		});

		// Should work normally when permissions mutations are enabled
		const ruleId = api.slothlet.permissions.rules.add({ caller: "untrusted.**", target: "**", effect: "deny" });
		expect(ruleId).toBeTypeOf("string");
	});

	it("should allow permissions.rules.add by default (permissions mutations enabled)", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// Should work normally by default
		const ruleId = api.slothlet.permissions.rules.add({ caller: "untrusted.**", target: "**", effect: "deny" });
		expect(ruleId).toBeTypeOf("string");
	});

	it("should throw INVALID_CONFIG_MUTATIONS_DISABLED when rules.remove is called and mutations.permissions is false", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow"
			},
			api: {
				mutations: {
					permissions: false
				}
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				api.slothlet.permissions.rules.remove("any-rule-id");
				expect.unreachable("Should have thrown INVALID_CONFIG_MUTATIONS_DISABLED");
			} catch (error) {
				expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
				expect(error.context?.operation).toEqual(["slothlet", "permissions", "rules", "remove"]);
			}
		});
	});
});
