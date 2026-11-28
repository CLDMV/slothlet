/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/setup/permissions-fast-package-frame.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:05-08:00 (1795869065)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared body of the permissions-fast-package-frame tests: a package's code between a module's code and the node it calls is attributed alike under both values
 * of `permissions.attribution`, with `references.capture` on and off.
 *
 * @description
 * Fixture `api_test_fast_package_frame`. `bag` hands out `() => descend(depth, self.vault.get)`, where `descend` is a
 * package both `bag` and `sup` import that calls its callback from `depth` frames of its own, and `() => self.vault.get()`
 * without the package. `sup` runs each of them after an `await`, and has the package call the vault for its own code.
 *
 * Expected values come from the definer rule (PERMISSIONS.md, "Code a module hands out runs as its definer"): the bag's
 * function runs as the bag with `sup` as its caller, and both have to be allowed; the package acts for the code that
 * called it, so it makes no difference whether it stands between that code and the node.
 *
 * | Rules                    | `sup` runs the bag's function (with or without the package) | `sup`'s own code through the package |
 * | ------------------------ | ------------------------------------------------------------ | ------------------------------------ |
 * | deny `bag.** → vault.**` | `PERMISSION_DENIED`                                          | `"SECRET"`                           |
 * | deny `sup.** → vault.**` | `PERMISSION_DENIED`                                          | `PERMISSION_DENIED`                  |
 * | nothing denied           | `"SECRET"`                                                   | `"SECRET"`                           |
 *
 * The cases are spread over the `suites/permissions/permissions-fast-package-frame-*.test.vitest.mjs` files by mode, runtime and
 * attribution (see the exported `describe…` function) so each file finishes in a few minutes; together they run every
 * case the single file ran.
 * @module tests/vitests/setup/permissions-fast-package-frame
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../api_tests/api_test_fast_package_frame/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) => [true, false].map((capture) => ({ mode, runtime, attribution, capture })))
	)
);

/** Depths short of, and past, the frames read first; all short of the 1024 read to. */
const DEPTHS = [5, 60, 600];

const RULE_SETS = [
	{ label: "the supplier bag denied", rules: [{ caller: "bag.**", target: "vault.**", effect: "deny" }], handed: DENIED, own: SECRET },
	{ label: "the runner sup denied", rules: [{ caller: "sup.**", target: "vault.**", effect: "deny" }], handed: DENIED, own: DENIED },
	{ label: "nothing denied", rules: [], handed: SECRET, own: SECRET }
];

/**
 * Register the fast-package-frame cases for the configs a test file runs.
 * @param {object} options - What to run.
 * @param {string[]} [options.modes=["eager", "lazy"]] - The modes.
 * @param {string[]} [options.runtimes=["async", "live"]] - The runtimes.
 * @param {string[]} [options.attributions=["precise", "fast"]] - The attributions.
 * @returns {void}
 * @example
 * describeFastPackageFrame({ modes: ["lazy"], runtimes: ["live"], attributions: ["fast"] });
 */
export function describeFastPackageFrame({
	modes = ["eager", "lazy"],
	runtimes = ["async", "live"],
	attributions = ["precise", "fast"]
} = {}) {
	const selected = matrix.filter(
		(config) => modes.includes(config.mode) && runtimes.includes(config.runtime) && attributions.includes(config.attribution)
	);
	describe.each(selected)(
		"a package between the code and the node > $mode / $runtime / $attribution / capture $capture",
		({ mode, runtime, attribution, capture }) => {
			let api;

			afterEach(async () => {
				await api?.shutdown?.();
				api = null;
			});

			describe.each(RULE_SETS)("$label", ({ rules, handed, own }) => {
				/**
				 * Build the instance.
				 * @returns {Promise<void>}
				 */
				async function open() {
					api = await slothlet({
						base: BASE,
						mode,
						runtime,
						silent: true,
						permissions: { policy: "allow", caller: { attribution, capture }, rules }
					});
				}

				it.each(DEPTHS)(`the bag's function through %i frames of the package answers ${handed}`, async (depth) => {
					await open();
					expect(await api.sup.runViaPackage(depth)).toBe(handed);
				});

				it(`the bag's function without the package answers ${handed}`, async () => {
					await open();
					expect(await api.sup.runDirect()).toBe(handed);
				});

				it.each(DEPTHS)(`sup's own code through %i frames of the package answers ${own}`, async (depth) => {
					await open();
					expect(await api.sup.own(depth)).toBe(own);
				});
			});
		}
	);
}
