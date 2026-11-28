/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-caller-supplied-rule-ceiling.test.vitest.mjs
 *	@Date: 2026-11-25T01:46:21-08:00 (1795599981)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:22-08:00 (1795869142)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A rule added by code a module hands another module's call: the code manages only what every module
 * it acts for may manage (#597), the module that runs it included.
 *
 * @description
 * `adder` adds an allow rule on its own subtree. From its own code the rule is added. From code it hands `runner`,
 * which runs it inside `runner`'s call, the rule is refused: `runner` may not manage rules on `adder`'s subtree. Once
 * the host lets `runner` manage rules beyond its own subtree, the same code adds the rule. A rule on `runner`'s own
 * subtree from that code needs `adder` let manage rules beyond its own.
 *
 * Fixture: `api_tests/api_test_supplied_rule_ceiling` — `api/` (the base), `runner/` and `adder/`, each mounted with
 * `api.add()` as its own module.
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-rule-ceiling
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_supplied_rule_ceiling");
const RUNNER_MANAGES = { caller: "runner.**", target: "slothlet.permissions.rules.add", effect: "allow" };
const ADDER_MANAGES = { caller: "adder.**", target: "slothlet.permissions.rules.add", effect: "allow" };

describe.each([
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"]
])("a rule added by code handed to another module's call — %s / %s", (mode, runtime) => {
	let api = null;

	afterEach(async () => {
		await api?.slothlet?.shutdown();
		api = null;
	});

	/**
	 * Load the base and mount `runner` and `adder`.
	 * @param {object[]} rules - Host rules.
	 * @returns {Promise<object>} The api.
	 */
	async function load(rules) {
		api = await slothlet({
			base: path.join(FIXTURE, "api"),
			mode,
			runtime,
			silent: true,
			permissions: { mode: "on", policy: "allow", rules }
		});
		await api.slothlet.api.add("runner", path.join(FIXTURE, "runner"), { id: "runner" });
		await api.slothlet.api.add("adder", path.join(FIXTURE, "adder"), { id: "adder" });
		return api;
	}

	it("is added from the module's own code", async () => {
		await load([]);
		expect(await api.adder.ops.direct("adder.ops.x")).toMatch(/^perm-/);
	});

	it("is refused from code the module hands a module that may not manage it", async () => {
		await load([]);
		expect(await withSuppressedSlothletErrorOutputSync(() => api.adder.ops.viaRunner("adder.ops.x"))).toBe("PERMISSION_RULE_INVALID");
		expect(api.slothlet.permissions.global.rules.path("adder.ops.x").some((rule) => rule.caller === "adder.**")).toBe(false);
	});

	it("is added from that code once the host lets the other module manage rules beyond its own", async () => {
		await load([RUNNER_MANAGES]);
		expect(await api.adder.ops.viaRunner("adder.ops.x")).toMatch(/^perm-/);
		expect(api.slothlet.permissions.global.rules.path("adder.ops.x").some((rule) => rule.caller === "adder.**")).toBe(true);
	});

	it("on the other module's subtree is added once the host lets the module manage rules beyond its own", async () => {
		await load([]);
		expect(await withSuppressedSlothletErrorOutputSync(() => api.adder.ops.viaRunner("runner.ops.x"))).toBe("PERMISSION_RULE_INVALID");
		await api.slothlet.shutdown();
		await load([ADDER_MANAGES]);
		expect(await api.adder.ops.viaRunner("runner.ops.x")).toMatch(/^perm-/);
	});
});
