/**
 * @fileoverview An access made from deep inside Node's own code is still held to the code that started it: when the
 * frames nearest the access are only slothlet's and Node's own, the stack is read further out, and code that still
 * cannot be reached is refused rather than taken to be the running leaf's.
 *
 * @description
 * Fixture `api_test_deep_stack`. `bag` (denied the vault) hands `sup` (allowed) a function that has `util.inspect`
 * call the vault's node as a getter from the bottom of an object nested `depth` levels deep, so Node's own frames
 * (three or more per level) sit between the call and the bag's code. `sup.own` does the same inspection in `sup`'s own
 * code. The instances run with `permissions.references.capture: false`, so a node read out of `self` is attributed
 * where it is called, not where it was read.
 *
 * Expected values come from the rule (PERMISSIONS.md, the definer rule): code runs with the rights of the module that
 * wrote it and of whoever runs it, so the bag's function is refused the vault whoever runs it and however deep Node's
 * own code is between; `sup`'s own code is allowed. Past the depth slothlet reads, nothing says whose code it is, and
 * the access is refused for anyone.
 * @module tests/vitests/suites/permissions/permissions-deep-internal-stack
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_deep_stack");
const RULES = [{ caller: "bag.**", target: "vault.**", effect: "deny" }];

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

describe.each(matrix)("an access from deep inside Node's own code > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Build the instance.
	 * @returns {Promise<void>}
	 */
	async function open() {
		// `references.capture: false`: the vault's node read out of `self` carries no reader of its own, so the call is
		// attributed where it is made, from the stack.
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", attribution, rules: RULES, references: { capture: false } }
		});
		await api.vault;
		await api.bag;
		await api.sup;
	}

	it.each([1, 8, 40])("the bag's function is refused the vault when sup runs it, %i levels deep", async (depth) => {
		await open();
		expect(await api.sup.viaBag(depth)).toBe("THREW");
	});

	it.each([1, 8, 40])("the bag's own leaf is refused the vault, %i levels deep", async (depth) => {
		await open();
		expect(await api.bag.own(depth)).toBe("THREW");
	});

	it.each([1, 8, 40])("sup's own code reads the vault, %i levels deep", async (depth) => {
		await open();
		expect(await api.sup.own(depth)).toBe("SECRET");
	});

	it("past the depth the stack is read to, the access is refused for anyone", async () => {
		await open();
		expect(await api.sup.viaBag(400)).toBe("THREW");
		expect(await api.sup.own(400)).toBe("THREW");
	});
});
