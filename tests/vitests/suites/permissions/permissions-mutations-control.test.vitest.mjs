/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-mutations-control.test.vitest.mjs
 *	@Date: 2026-04-17 14:00:00 -07:00 (1776589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-17 19:53:05 -07:00 (1776480785)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

	it("should disable permissions.addRule when config.api.mutations.permissions is false", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
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
		try {
			api.slothlet.permissions.addRule({ caller: "untrusted.**", target: "**", effect: "deny" });
			expect.unreachable("Should have thrown INVALID_CONFIG_MUTATIONS_DISABLED");
		} catch (error) {
			expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
			expect(error.context?.operation).toBe("api.slothlet.permissions.addRule");
		}
	});

	it("should allow permissions.addRule when config.api.mutations.permissions is true", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
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
		const ruleId = api.slothlet.permissions.addRule({ caller: "untrusted.**", target: "**", effect: "deny" });
		expect(ruleId).toBeTypeOf("string");
	});

	it("should allow permissions.addRule by default (permissions mutations enabled)", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// Should work normally by default
		const ruleId = api.slothlet.permissions.addRule({ caller: "untrusted.**", target: "**", effect: "deny" });
		expect(ruleId).toBeTypeOf("string");
	});
});
