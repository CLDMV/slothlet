/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-leaf-function-handed-out.test.vitest.mjs
 *	@Date: 2026-11-11T22:59:51-08:00 (1794466791)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T02:01:01-08:00 (1794477661)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's exported function handed out as it is counts as a call of that function's api node: the
 * module running it has to be allowed to call the leaf, and it runs with the leaf's rights. A private function (one no
 * export names) lends nothing: it runs as its definer under whoever runs it.
 *
 * @description
 * Fixture `api_test_leaf_call`: `bag.viaLeaf` reads the vault. `sup` reaches it through its node (`self.bag.viaLeaf()`),
 * through the node handed out (`leafRef`), through the exported function handed out (`boundLeaf`), through the
 * exported function inside returned data (`inData`), and runs a private function `bag.closure` hands out.
 *
 * Expected values come from the rule (PERMISSIONS.md, "A call runs with the callee's rights"):
 *
 * | Rules                        | `node`   | `leafRef` | `boundLeaf` | `inData` | `closure` |
 * | ---------------------------- | -------- | --------- | ----------- | -------- | --------- |
 * | none                         | SECRET   | SECRET    | SECRET      | SECRET   | SECRET    |
 * | deny `sup.** → vault.**`     | SECRET   | SECRET    | SECRET      | SECRET   | DENIED    |
 * | deny `sup.** → bag.viaLeaf`  | DENIED   | (not pinned) | DENIED   | DENIED   | SECRET    |
 * | deny `bag.viaLeaf → vault.**`| DENIED   | DENIED    | DENIED      | DENIED   | SECRET    |
 *
 * `sup` denied the vault still gets the service's answer: it calls the service, and the service reads the vault.
 * Denied the service's function, it does not get it by being handed the function. `leafRef` under the third rule set
 * is left out: a node a module read carries that module as its reader (captured references), which is another rule.
 * @module tests/vitests/suites/permissions/permissions-leaf-function-handed-out
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_leaf_call");
const DENIED = "PERMISSION_DENIED";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Each rule set and what `sup.probe()` answers under it.
 * @type {Array<{label: string, rules: object[], expected: object}>}
 */
const RULE_SETS = [
	{
		label: "no rules",
		rules: [],
		expected: { node: "SECRET", leafRef: "SECRET", boundLeaf: "SECRET", inData: "SECRET", closure: "SECRET" }
	},
	{
		label: "sup denied the vault",
		rules: [{ caller: "sup.**", target: "vault.**", effect: "deny" }],
		expected: { node: "SECRET", leafRef: "SECRET", boundLeaf: "SECRET", inData: "SECRET", closure: DENIED }
	},
	{
		label: "sup denied the service's function",
		rules: [{ caller: "sup.**", target: "bag.viaLeaf", effect: "deny" }],
		expected: { node: DENIED, boundLeaf: DENIED, inData: DENIED, closure: "SECRET" }
	},
	{
		label: "the service's function denied the vault",
		rules: [{ caller: "bag.viaLeaf", target: "vault.**", effect: "deny" }],
		expected: { node: DENIED, leafRef: DENIED, boundLeaf: DENIED, inData: DENIED, closure: "SECRET" }
	}
];

describe.each(matrix)("a module's exported function handed out > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(RULE_SETS)("$label", async ({ rules, expected }) => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
		const got = await api.sup.probe();
		for (const [route, answer] of Object.entries(expected)) expect([route, got[route]]).toEqual([route, answer]);
	});

	it("the host runs each of them as it would the node", async () => {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", attribution, rules: [{ caller: "sup.**", target: "vault.**", effect: "deny" }] }
		});
		expect(await (await api.bag.boundLeaf())()).toBe("SECRET");
		expect(await (await api.bag.inData()).run()).toBe("SECRET");
		expect(await (await api.bag.closure())()).toBe("SECRET");
	});
});
