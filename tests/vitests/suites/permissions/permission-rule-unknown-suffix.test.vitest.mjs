/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permission-rule-unknown-suffix.test.vitest.mjs
 *	@Date: 2026-11-18T21:49:06-08:00 (1795067346)
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
 * @fileoverview A rule target's suffix names an access level or a hook type: a target ending in any other suffix is
 * refused with `PERMISSION_RULE_INVALID`, from every place a rule comes in.
 *
 * @description
 * The accepted suffixes are the levels `call`, `read`, `access`, `write` and `full`, and the hook types `before`,
 * `after`, `always`, `error`, `around` and `hook`. A target with no suffix, and a `capability:` target, take no suffix
 * check. A misspelt suffix (`secret.**:wirte`, `db.read:xyz`) is refused rather than kept as a rule on the literal
 * target, which would match no api path and silently not apply. Checked from the config's `permissions.rules`,
 * `rules.add`, a manifest's rules, the `permissions` option of `api.add`, and rules module code registers, in every
 * matrix config.
 *
 * Fixtures: `api_tests/api_test_rule_target_module/unknown-suffix` (a manifest declaring such a rule) and
 * `api_tests/api_test_rule_suffix/registrar` (a module registering rules for its own subtree).
 * @module tests/vitests/suites/permissions/permission-rule-unknown-suffix
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX_RULE_MODULES = path.resolve(HERE, "../../../../api_tests/api_test_rule_target_module");
const FIX_REGISTRAR = path.resolve(HERE, "../../../../api_tests/api_test_rule_suffix/registrar");

const UNKNOWN = ["secret.**:wirte", "db.read:xyz", "db.read:Write", "db.read:", "db.**:read:x"];
const KNOWN = [
	"db.read",
	"db.**",
	"capability:code",
	...["call", "read", "access", "write", "full"].map((level) => `db.**:${level}`),
	...["before", "after", "always", "error", "around", "hook"].map((type) => `db.read:${type}`)
];

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

describe.each(getMatrixConfigs())("Permissions > a rule target with an unknown suffix > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rules.add refuses it, and accepts every level, hook type and target with no suffix", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		const add = (target) => codeOf(() => api.slothlet.permissions.rules.add({ caller: "callers.**", target, effect: "deny" }));
		for (const target of UNKNOWN) expect({ target, code: await add(target) }).toEqual({ target, code: "PERMISSION_RULE_INVALID" });
		for (const target of KNOWN) expect({ target, code: await add(target) }).toEqual({ target, code: "ok" });
	});

	it("names the suffix in the error", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		let error;
		try {
			api.slothlet.permissions.rules.add({ caller: "**", target: "secret.**:wirte", effect: "deny" });
		} catch (thrown) {
			error = thrown;
		}
		expect(error.code).toBe("PERMISSION_RULE_INVALID");
		expect(error.details.received).toBe("wirte");
		expect(error.message).toContain("wirte");
	});

	it("a config rule with it refuses the instance", async () => {
		const code = await codeOf(async () => {
			api = await slothlet({
				...config,
				base: BASE,
				permissions: { policy: "allow", rules: [{ caller: "**", target: "secret.**:wirte", effect: "deny" }] }
			});
		});
		expect(code).toBe("PERMISSION_RULE_INVALID");
	});

	it("an api.add permissions rule with it is refused", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		const code = await codeOf(() =>
			api.slothlet.api.add("extra", { exports: { ping: () => "pong" } }, { permissions: { deny: ["extra.ping:xyz"] } })
		);
		expect(code).toBe("PERMISSION_RULE_INVALID");
		expect(
			await codeOf(() => api.slothlet.api.add("more", { exports: { ping: () => "pong" } }, { permissions: { deny: ["more.ping:write"] } }))
		).toBe("ok");
	});

	it("a module manifest rule with it refuses the mount", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		const code = await codeOf(() => api.slothlet.api.modules.add("@local/unknown-suffix", { discover: { root: FIX_RULE_MODULES } }));
		expect(code).toBe("PERMISSION_RULE_INVALID");
		expect(api.plugins?.["unknown-suffix"]).toBeUndefined();
	});

	it("a rule module code registers with it is refused", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { policy: "allow" } });
		await api.slothlet.api.add("registrar", FIX_REGISTRAR);
		expect(await api.registrar.add("registrar.secret:wirte")).toBe("PERMISSION_RULE_INVALID");
		expect(await api.registrar.add("registrar.secret:write")).toBe("ok");
	});

	it("event rules name events, not targets: an event name with a colon is not refused", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { policy: "allow", events: { policy: "notify", rules: [{ caller: "**", event: "orders:xyz", effect: "deny" }] } }
		});
		expect(api).toBeDefined();
	});
});
