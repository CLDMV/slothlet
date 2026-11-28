/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-config-validation.test.vitest.mjs
 *	@Date: 2026-04-14T17:20:42-07:00 (1776212442)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:23-08:00 (1795869143)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Config Validation > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("invalid defaultPolicy value is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "invalid",
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid defaultPolicy");
		} catch (err) {
			expect(err.message).toBeDefined();
		}
	});

	it("permissions config with non-array rules is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					rules: "not-an-array"
				}
			});
			expect.unreachable("Should have thrown for non-array rules");
		} catch (err) {
			expect(err.message).toBeDefined();
		}
	});

	it("permissions config with invalid audit value is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					audit: "invalid-value",
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid audit");
		} catch (err) {
			expect(err.message).toBeDefined();
		}
	});

	it("permissions config with non-boolean gating.read is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					gating: {
						read: "yes"
					},
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid readGating");
		} catch (err) {
			expect(err.message).toMatch(/INVALID_CONFIG|readGating/);
		}
	});

	it("permissions config with non-boolean caller.anonymous is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					caller: {
						anonymous: "yes"
					},
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid failOpenOnAbsentCaller");
		} catch (err) {
			expect(err.message).toMatch(/INVALID_CONFIG|failOpenOnAbsentCaller/);
		}
	});

	it("permissions config with non-boolean caller.capture is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					rules: [],
					caller: {
						capture: "yes"
					}
				}
			});
			expect.unreachable("Should have thrown for invalid references.capture");
		} catch (err) {
			expect(err.message).toMatch(/INVALID_CONFIG|references\.capture/);
		}
	});

	it("permissions config with a non-object caller block is rejected", async () => {
		// Rejected rather than ignored: a dropped option reads as "the default is in effect" while the
		// author believes they changed it, which for a security default is the expensive direction.
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					caller: 42,
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid references block");
		} catch (err) {
			expect(err.message).toMatch(/INVALID_CONFIG|references/);
		}
	});

	it("permissions config with an array caller block is rejected", async () => {
		// `typeof [] === "object"`, so an array slips past a bare typeof check and every option inside
		// it reads as unset — the author believes capture is off while the secure default is silently in
		// effect. Same rejection the manifest and lifecycle blocks already apply to arrays.
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					caller: [{ capture: false }],
					rules: []
				}
			});
			expect.unreachable("boot accepted an array for the block under test");
		} catch (err) {
			expect(String(err.code ?? "")).toBe("INVALID_CONFIG");
		}
	});

	it("permissions config with no defaultPolicy defaults to allow", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				rules: []
			}
		});
		expect(api).toBeDefined();
	});

	it("permissions config with a non-object events block is rejected", async () => {
		// #407 event-rule block: rejected the same way the manifest/lifecycle/references blocks are —
		// a primitive silently drops every option inside it (default level, rules) rather than erroring.
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					events: 42,
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid events block");
		} catch (err) {
			expect(String(err.code ?? "")).toBe("INVALID_CONFIG");
			expect(err.message).toMatch(/INVALID_CONFIG|events/);
		}
	});

	it("permissions config with an array events block is rejected", async () => {
		// `typeof [] === "object"`, so an array must be rejected explicitly — same array rejection the
		// references block gets, applied to the events block.
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					events: [{ default: "allow" }],
					rules: []
				}
			});
			expect.unreachable("boot accepted an array for the events block");
		} catch (err) {
			expect(String(err.code ?? "")).toBe("INVALID_CONFIG");
		}
	});

	it("permissions config with an invalid events.policy value is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					events: { policy: "bogus" },
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid events.default");
		} catch (err) {
			expect(String(err.code ?? "")).toBe("INVALID_CONFIG");
			expect(err.message).toMatch(/INVALID_CONFIG|events\.default/);
		}
	});

	it("permissions config with non-array events.rules is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				base: `${BASE}/callers`,
				permissions: {
					policy: "deny",
					events: { rules: "not-an-array" },
					rules: []
				}
			});
			expect.unreachable("Should have thrown for non-array events.rules");
		} catch (err) {
			expect(String(err.code ?? "")).toBe("INVALID_CONFIG");
			expect(err.message).toMatch(/INVALID_CONFIG|events\.rules/);
		}
	});
});
