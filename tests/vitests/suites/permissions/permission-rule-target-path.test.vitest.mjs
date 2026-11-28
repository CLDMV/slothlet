/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permission-rule-target-path.test.vitest.mjs
 *	@Date: 2026-11-22T23:21:56-08:00 (1795418516)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:18-08:00 (1795869138)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A rule target's path names an api path: one that holds a `:` of its own is refused with
 * `PERMISSION_RULE_INVALID`, and so is an `api.add` `permissions` option that is not `{ allow, deny }`.
 *
 * @description
 * Only the text after a target's last `:` is its suffix (a level or a hook type); what comes before it is the api path
 * pattern. An api path holds no `:`, so a target like `vault.secret:read:write` (path `vault.secret:read`), or `a:b:write`
 * would be kept as a rule that matches nothing and silently not apply. They are refused
 * from the config's rules and from `rules.add`. A `capability:` target keeps its own form. `api.add`'s `permissions`
 * option takes `{ allow: [...], deny: [...] }`; an array, a string, or an `allow` / `deny` that is not an array would be
 * ignored, so it is refused with `INVALID_ARGUMENT` before anything is mounted.
 *
 * Fixture: `api_tests/api_test_permissions` (the matrix's permission base).
 * @module tests/vitests/suites/permissions/permission-rule-target-path
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

const EMPTY_PATH = [":call", ":read", ":access", ":write", ":full", ":before", ":after", ":always", ":error", ":around", ":hook"];
const NO_PATH = ["vault.secret:read:write", "a:b:write", "a:b:before", "db.read:call:hook", ...EMPTY_PATH];
const KEPT = ["vault.secret:read", "db.**:write", "db.read:before", "**:hook", "db.read", "capability:code"];

/**
 * The code a call throws with, or "ok".
 * @param {() => unknown} fn - The call.
 * @returns {Promise<string>} The code.
 */
async function codeOf(fn) {
	try {
		await fn();
		return "ok";
	} catch (error) {
		return error.code;
	}
}

describe.each(getMatrixConfigs())("Permissions > a rule target whose path names no api path > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rules.add refuses it and keeps every target with a real path", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		const add = (target) => codeOf(() => api.slothlet.permissions.rules.add({ caller: "callers.**", target, effect: "deny" }));
		for (const target of NO_PATH) expect({ target, code: await add(target) }).toEqual({ target, code: "PERMISSION_RULE_INVALID" });
		for (const target of KEPT) expect({ target, code: await add(target) }).toEqual({ target, code: "ok" });
	});

	it.each(EMPTY_PATH)("rules.add refuses the empty-path target %s with PERMISSION_RULE_INVALID naming it", async (target) => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		let error;
		try {
			api.slothlet.permissions.rules.add({ caller: "**", target, effect: "deny" });
		} catch (thrown) {
			error = thrown;
		}
		expect(error.code).toBe("PERMISSION_RULE_INVALID");
		expect(error.details.received).toBe(target);
	});

	it.each(EMPTY_PATH)("a config rule with the empty-path target %s refuses the instance", async (target) => {
		const code = await codeOf(async () => {
			api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow", rules: [{ caller: "**", target, effect: "deny" }] } });
		});
		expect(code).toBe("PERMISSION_RULE_INVALID");
	});

	it("api.add's permissions option refuses an empty-path target", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		const code = await codeOf(() =>
			api.slothlet.api.add("emptyp", { exports: { ping: () => "pong" } }, { permissions: { deny: [":write"] } })
		);
		expect(code).toBe("PERMISSION_RULE_INVALID");
		expect(api.emptyp).toBeUndefined();
	});

	it.each(["deny", "allow"])(
		"a refused api.add (%s rule) leaves nothing mounted and the path can be added again with valid rules",
		async (effect) => {
			api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
			for (const target of [":before", "a:b:write"]) {
				expect(
					await codeOf(() =>
						api.slothlet.api.add("refused", { exports: { ping: () => "pong" } }, { permissions: { [effect]: ["ok.thing", target] } })
					)
				).toBe("PERMISSION_RULE_INVALID");
				expect(api.refused).toBeUndefined();
				expect(Object.keys(api)).not.toContain("refused");
			}
			expect(
				await codeOf(() =>
					api.slothlet.api.add("refused", { exports: { ping: () => "pong" } }, { permissions: { [effect]: ["refused.ping:write"] } })
				)
			).toBe("ok");
			expect(api.refused.ping()).toBe("pong");
		}
	);

	it("names the target in the error", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		let error;
		try {
			api.slothlet.permissions.rules.add({ caller: "**", target: "vault.secret:read:write", effect: "deny" });
		} catch (thrown) {
			error = thrown;
		}
		expect(error.code).toBe("PERMISSION_RULE_INVALID");
		expect(error.details.received).toBe("vault.secret:read:write");
	});

	it("a config rule with it refuses the instance", async () => {
		const code = await codeOf(async () => {
			api = await slothlet({
				...config,
				base: BASE,
				permissions: { policy: "allow", rules: [{ caller: "**", target: "a:b:write", effect: "deny" }] }
			});
		});
		expect(code).toBe("PERMISSION_RULE_INVALID");
	});

	it("api.add refuses a permissions option that is not { allow, deny }, mounting nothing", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		const content = () => ({ exports: { ping: () => "pong" } });
		const shapes = [
			[{ caller: "**", target: "extra.**", effect: "deny" }],
			"extra.**",
			{ deny: "extra.**" },
			{ allow: { target: "extra.**" } }
		];
		for (const [index, permissions] of shapes.entries()) {
			const at = `extra${index}`;
			expect({ at, code: await codeOf(() => api.slothlet.api.add(at, content(), { permissions })) }).toEqual({
				at,
				code: "INVALID_ARGUMENT"
			});
			expect(api[at]).toBeUndefined();
		}
		expect(await codeOf(() => api.slothlet.api.add("kept", content(), { permissions: { deny: ["kept.ping:write"] } }))).toBe("ok");
		expect(await codeOf(() => api.slothlet.api.add("none", content(), { permissions: {} }))).toBe("ok");
	});
});
