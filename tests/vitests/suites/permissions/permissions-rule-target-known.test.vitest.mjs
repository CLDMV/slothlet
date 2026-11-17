/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-rule-target-known.test.vitest.mjs
 *	@Date: 2026-11-16T18:00:00-08:00 (1794880800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:00:00-08:00 (1794880800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A rule target in slothlet's own space (`slothlet.*`, `capability:*`) must name something that exists:
 * a pattern that matches no member of the fixed control tree, or a capability that is not built in, is refused with
 * `PERMISSION_RULE_UNKNOWN_TARGET`, from every place a rule is registered. Consumer api paths are not checked.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { SLOTHLET_TREE, SLOTHLET_TREE_DATA, namesSlothletMember } from "#helpers/slothlet-tree";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;
const FIX_RULE_MODULES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_rule_target_module");

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

describe("namesSlothletMember", () => {
	it.each([
		["slothlet.permissions.rules.add", true],
		["slothlet.pin.caller", true],
		["slothlet.hook.**", true],
		["slothlet.**", true],
		["slothlet.*", true],
		["slothlet.{pin,bind}", true],
		["slothlet.**:write", true],
		["slothlet.notThereYet:write", true],
		["slothlet.nope.**:before", false],
		["slothlet.warnings.get", true],
		["slothlet.env.HOME", true],
		["slothlet.diag.context.user", true],
		["slothlet.permissions.addRule", false],
		["slothlet.lockCaller", false],
		["slothlet.nope.**", false],
		["slothlet.metadata.setGlobal", false]
	])("%s → %s", (target, expected) => {
		expect(namesSlothletMember(target)).toBe(expected);
	});

	it("lists every data member inside the tree", () => {
		for (const member of SLOTHLET_TREE_DATA) expect(SLOTHLET_TREE).toContain(member);
	});
});

describe("the fixed tree matches a live instance", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("every member a full instance has is listed, and nothing else", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true, hook: { enabled: true }, permissions: { mode: "on" } });
		const found = new Set();
		const seen = new WeakSet();
		const walk = (value, path) => {
			if (value === null || (typeof value !== "object" && typeof value !== "function") || seen.has(value)) return;
			seen.add(value);
			for (const key of Reflect.ownKeys(value)) {
				if (typeof key !== "string") continue;
				if (typeof value === "function" && ["length", "name", "prototype"].includes(key)) continue;
				const member = `${path}.${key}`;
				found.add(member);
				if (SLOTHLET_TREE_DATA.includes(member)) continue;
				walk(value[key], member);
			}
		};
		walk(api.slothlet, "slothlet");
		expect([...found].sort()).toEqual([...SLOTHLET_TREE].sort());
	});
});

describe.each(getMatrixConfigs())("Permissions > rule targets in slothlet's own space > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rules.add refuses a slothlet target that names nothing, and a capability that is not built in", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		const add = (target) => () => api.slothlet.permissions.rules.add({ caller: "callers.**", target, effect: "deny" });
		expect(await codeOf(add("slothlet.permissions.addRule"))).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
		expect(await codeOf(add("slothlet.lockCaller"))).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
		expect(await codeOf(add("capability:shell"))).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
		expect(await codeOf(add("slothlet.permissions.rules.add"))).toBe("ok");
		expect(await codeOf(add("capability:code"))).toBe("ok");
		expect(await codeOf(add("payments.anything.at.all"))).toBe("ok");
	});

	it("names the target in the error and its message", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		let error;
		try {
			api.slothlet.permissions.rules.add({ caller: "**", target: "slothlet.permissions.addRule", effect: "deny" });
		} catch (thrown) {
			error = thrown;
		}
		expect(error.code).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
		expect(error.context.target).toBe("slothlet.permissions.addRule");
		expect(error.message).toContain("slothlet.permissions.addRule");
	});

	it("a config rule naming nothing in slothlet's space refuses the instance", async () => {
		const code = await codeOf(async () => {
			api = await slothlet({
				...config,
				base: BASE,
				permissions: { defaultPolicy: "allow", rules: [{ caller: "**", target: "slothlet.permissions.global.checkCall", effect: "deny" }] }
			});
		});
		expect(code).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
	});

	it("an api.add permissions rule naming nothing in slothlet's space is refused", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		const code = await codeOf(() =>
			api.slothlet.api.add("extra", { exports: { ping: () => "pong" } }, { permissions: { deny: ["slothlet.event.resolveLevel"] } })
		);
		expect(code).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
	});

	it("a module manifest rule naming nothing in slothlet's space refuses the mount", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		const code = await codeOf(() => api.slothlet.api.modules.add("@local/unknown-target", { discover: { scanRoot: FIX_RULE_MODULES } }));
		expect(code).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
	});

	it("a refused module mount leaves nothing mounted at the module's mount path (#872)", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		const add = () => api.slothlet.api.modules.add("@local/unknown-target", { discover: { scanRoot: FIX_RULE_MODULES } });
		expect(await codeOf(add)).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
		expect(api.plugins?.["unknown-target"]).toBeUndefined();
		expect(Object.keys(api.plugins ?? {})).not.toContain("unknown-target");
		// The mount can be tried again: nothing it left behind makes it collide with itself.
		expect(await codeOf(add)).toBe("PERMISSION_RULE_UNKNOWN_TARGET");
	});

	it("a module manifest rule naming a consumer path that does not exist is not refused", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		const code = await codeOf(() => api.slothlet.api.modules.add("@local/consumer-target", { discover: { scanRoot: FIX_RULE_MODULES } }));
		expect(code).toBe("ok");
		expect(api.plugins["consumer-target"].info.name()).toBe("@local/consumer-target");
	});

	it("a config rule or api.add rule naming a consumer path that does not exist is not refused", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "**", target: "no.such.module.**", effect: "deny" }] }
		});
		expect(
			await codeOf(() => api.slothlet.api.add("extra", { exports: { ping: () => "pong" } }, { permissions: { deny: ["nowhere.at.all"] } }))
		).toBe("ok");
	});

	it("event rules name events, not targets: an event named like a slothlet member is not refused", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: { default: "notify", rules: [{ caller: "**", event: "slothlet.nope.**", effect: "deny" }] }
			}
		});
		expect(api).toBeDefined();
	});
});
