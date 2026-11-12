/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-resumed-call-runs-code.test.vitest.mjs
 *	@Date: 2026-11-11T22:41:29-08:00 (1794465689)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T02:01:06-08:00 (1794477666)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A call that picks up again after an `await` and runs another module's function directly is checked
 * the same way in both runtimes and under both values of `permissions.attribution`: the function runs as its definer,
 * with the call that runs it as its caller, and both have to be allowed.
 *
 * @description
 * Fixture `api_test_resumed_runs_code`: `bag.make` returns a function that reads the vault; `sup` awaits it and runs
 * it in the exported function, in an unnamed function nested in it, and from a promise callback.
 *
 * Expected values come from the definer rule (PERMISSIONS.md, "Code a module hands out runs as its definer"):
 *
 * | Rules                         | Definer `bag.make` | Caller `sup.*` | Answer              |
 * | ----------------------------- | ------------------ | -------------- | ------------------- |
 * | deny `sup` (the module path)  | allowed            | allowed        | `"SECRET"`          |
 * | deny `bag.** → vault.**`      | denied             | allowed        | `PERMISSION_DENIED` |
 * | deny `sup.** → vault.**`      | allowed            | denied         | `PERMISSION_DENIED` |
 *
 * The first row is the one the live runtime refused under `"fast"`: the bag's frame, which no waiting call accounts
 * for, made the whole access unplaceable.
 * @module tests/vitests/suites/permissions/permissions-resumed-call-runs-code
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_resumed_runs_code");
const DENIED = "PERMISSION_DENIED";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Each rule set and what every route answers under it.
 * @type {Array<{label: string, rules: object[], expected: string, own: string}>}
 */
const RULE_SETS = [
	{
		label: "only the module path sup denied",
		rules: [{ caller: "sup", target: "vault.**", effect: "deny" }],
		expected: "SECRET",
		own: "SECRET"
	},
	{ label: "the definer denied", rules: [{ caller: "bag.**", target: "vault.**", effect: "deny" }], expected: DENIED, own: "SECRET" },
	{ label: "the caller denied", rules: [{ caller: "sup.**", target: "vault.**", effect: "deny" }], expected: DENIED, own: DENIED }
];

describe.each(matrix)(
	"a resumed call running another module's function > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		describe.each(RULE_SETS)("$label", ({ rules, expected, own }) => {
			/**
			 * Build the instance.
			 * @returns {Promise<void>}
			 */
			async function open() {
				api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
			}

			it.each(["inExport", "inNested", "inThen"])(`sup.%s answers ${expected}`, async (route) => {
				await open();
				expect(await api.sup[route]()).toBe(expected);
			});

			it(`sup's own code after an await answers ${own}`, async () => {
				await open();
				expect(await api.sup.own()).toBe(own);
			});

			it("with other calls of sup waiting too, no route answers more than the rules allow", async () => {
				await open();
				const [nested, exported, then] = await Promise.all([api.sup.inNested(), api.sup.inExport(), api.sup.inThen()]);
				// The exported function names its call when it picks up again, and a promise callback carries the call that
				// made it. An unnamed function nested in the export does neither: the async runtime's store still says which
				// call it is, and the live runtime, which reads the stack, cannot tell it from the other waiting calls of
				// its file and refuses (PERMISSIONS.md: narrowing that ends with several calls left fails closed).
				expect([exported, then]).toEqual([expected, expected]);
				expect(nested).toBe(runtime === "live" ? DENIED : expected);
			});
		});
	}
);
