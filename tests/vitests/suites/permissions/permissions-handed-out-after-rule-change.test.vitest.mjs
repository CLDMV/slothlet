/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-handed-out-after-rule-change.test.vitest.mjs
 *	@Date: 2026-11-12T22:55:00-08:00 (1794552900)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:23:40-08:00 (1794583420)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code a module was handed before the host changes the rules answers by the new rules the next time it
 * runs: a deny added refuses it, the deny removed lets it answer again, and an allow added under `defaultPolicy:
 * "deny"` opens it.
 *
 * @description
 * Fixture `api_test_leaf_call`: `bag.viaLeaf` reads the vault. `holder.keep()` takes, once, the node of `viaLeaf`
 * (`leafRef`), the exported function itself (`boundLeaf`), the exported function inside returned data (`inData`) and a
 * private function (`closure`); `holder.runKept()` runs each of them, and the node `self.bag.viaLeaf`, again. The host
 * adds and removes rules between runs with `api.slothlet.permissions.addRule` / `removeRule`.
 *
 * Expected values come from the rules as ruled (PERMISSIONS.md, "A call runs with the callee's rights", and the
 * per-view refusal memo cleared when rules change): an exported function handed out is a call of its node, so the
 * runner needs the call and the function runs with the leaf's rights; a private function runs as its definer and needs
 * the runner's rights too. Rules are read again after every change, so what a held value answers is what a fresh value
 * would answer under the same rules. `leafRef` is left out where the runner is denied the leaf itself: a node a module
 * read carries that module as its reader, which is another rule (see permissions-leaf-function-handed-out).
 * @module tests/vitests/suites/permissions/permissions-handed-out-after-rule-change
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_leaf_call");
const DENIED = "PERMISSION_DENIED";
const S = "SECRET";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

const ALL_SECRET = { node: S, leafRef: S, boundLeaf: S, inData: S, closure: S };

/**
 * Check the answers `holder.runKept()` gives against the expected ones; a route absent from `expected` is not pinned.
 * @param {object} got - What `runKept()` answered.
 * @param {object} expected - Expected answers by route.
 * @param {string} step - The step, for the message.
 * @returns {void}
 */
function expectAnswers(got, expected, step) {
	for (const [route, answer] of Object.entries(expected)) expect([step, route, got[route]]).toEqual([step, route, answer]);
}

describe.each(matrix)("handed-out code after a runtime rule change > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet?.shutdown?.();
		api = null;
	});

	/**
	 * Build the instance and let `holder` take the service's hand-outs.
	 * @param {"allow"|"deny"} defaultPolicy - The default policy.
	 * @param {object[]} [rules] - Rules given in the config.
	 * @returns {Promise<void>}
	 */
	async function load(defaultPolicy, rules = []) {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy, attribution, rules } });
		expect(await api.holder.keep()).toEqual(["leafRef", "boundLeaf", "inData", "closure"]);
	}

	it.each([
		{
			label: "a deny on the vault for the holder",
			rule: { caller: "holder.**", target: "vault.**", effect: "deny" },
			whileAdded: { node: S, leafRef: S, boundLeaf: S, inData: S, closure: DENIED }
		},
		{
			label: "a deny on the service's function for the holder",
			rule: { caller: "holder.**", target: "bag.viaLeaf", effect: "deny" },
			whileAdded: { node: DENIED, boundLeaf: DENIED, inData: DENIED, closure: S }
		},
		{
			label: "a deny on the vault for the service's function",
			rule: { caller: "bag.viaLeaf", target: "vault.**", effect: "deny" },
			whileAdded: { node: DENIED, leafRef: DENIED, boundLeaf: DENIED, inData: DENIED, closure: S }
		}
	])("$label added after the hand-out refuses, and removed answers again", async ({ rule, whileAdded }) => {
		await load("allow");
		expectAnswers(await api.holder.runKept(), ALL_SECRET, "before");
		const ruleId = api.slothlet.permissions.addRule(rule);
		expectAnswers(await api.holder.runKept(), whileAdded, "added");
		// A second run under the same rules answers the same.
		expectAnswers(await api.holder.runKept(), whileAdded, "added, again");
		expect(api.slothlet.permissions.removeRule(ruleId)).toBe(true);
		expectAnswers(await api.holder.runKept(), ALL_SECRET, "removed");
	});

	it('allows added after the hand-out under defaultPolicy "deny" open it, and removed close it again', async () => {
		// The holder may take the hand-outs and the service may read the vault; nothing else is allowed.
		await load("deny", [
			{ caller: "holder.**", target: "bag.{leafRef,boundLeaf,inData,closure}", effect: "allow" },
			{ caller: "bag.**", target: "vault.**", effect: "allow" }
		]);
		const closed = { node: DENIED, boundLeaf: DENIED, inData: DENIED, closure: DENIED };
		expectAnswers(await api.holder.runKept(), closed, "before");

		const leafId = api.slothlet.permissions.addRule({ caller: "holder.**", target: "bag.viaLeaf", effect: "allow" });
		const leafOpen = { node: S, leafRef: S, boundLeaf: S, inData: S, closure: DENIED };
		expectAnswers(await api.holder.runKept(), leafOpen, "service allowed");

		const vaultId = api.slothlet.permissions.addRule({ caller: "holder.**", target: "vault.**", effect: "allow" });
		expectAnswers(await api.holder.runKept(), ALL_SECRET, "service and vault allowed");

		expect(api.slothlet.permissions.removeRule(vaultId)).toBe(true);
		expectAnswers(await api.holder.runKept(), leafOpen, "vault allow removed");

		expect(api.slothlet.permissions.removeRule(leafId)).toBe(true);
		expectAnswers(await api.holder.runKept(), closed, "both removed");
	});

	it("a rule added while the system is off answers once it is switched on, and switching it off again lifts it", async () => {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			permissions: { mode: "off", defaultPolicy: "allow", attribution, rules: [] }
		});
		expect(await api.holder.keep()).toEqual(["leafRef", "boundLeaf", "inData", "closure"]);
		api.slothlet.permissions.addRule({ caller: "holder.**", target: "vault.**", effect: "deny" });
		expectAnswers(await api.holder.runKept(), ALL_SECRET, "off");
		api.slothlet.permissions.control.enable();
		expectAnswers(await api.holder.runKept(), { node: S, leafRef: S, boundLeaf: S, inData: S, closure: DENIED }, "on");
		api.slothlet.permissions.control.disable();
		expectAnswers(await api.holder.runKept(), ALL_SECRET, "off again");
	});
});
