/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-call-package-frame-depth.test.vitest.mjs
 *	@Date: 2026-11-15T08:00:00-08:00 (1794758400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:41-08:00 (1795536521)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Inside a call, an access made from more than 1024 frames of a package's or a host file's code is
 * refused, whatever node the code calls through: a node the module read and kept does not settle whose access it is.
 *
 * @description
 * Fixture `api_test_load_package_frame` (see permissions-load-package-frame): `api.runner.now(route, depth)` runs a
 * route's code inside the runner's call. A route `"own-<route>"` is the runner's own code, which reads `self.vault.get`
 * (so the runner keeps that node) and calls it from the bottom of `depth` frames of one package (`package`), two
 * packages (`two`) or a host file's function (`host`). Any other route is the bag's function doing the same.
 *
 * Expected values come from the package-frame rule (docs/PERMISSIONS.md): a package's or the host's code acts for the
 * code that called it, and when such frames go on past the 1024 frames read nothing says whose code called them, so the
 * access is refused for every rule set, as the live runtime and the async runtime with `references.capture` off already
 * answer. A kept node carries the identity of the module that read it as a floor, never as a substitute for a caller the
 * stack cannot name. The bag's function under `"precise"` is a stand-in whose record names its definer without reading
 * the stack, so it answers by the bag's rules (refused where the bag is denied).
 *
 * The in-process rows run under vitest, where the packages read as the host's files; the child-process rows run the
 * runner's own code under Node's own loader, where slothlet records which modules import each package.
 * @module tests/vitests/suites/permissions/permissions-call-package-frame-depth
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { walk } from "../../../../api_tests/api_test_load_package_frame/lib/host/walk.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const BASE = path.resolve(ROOT, "api_tests/api_test_load_package_frame/api");
const WALK = path.resolve(ROOT, "api_tests/api_test_load_package_frame/lib/host/walk.mjs");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";
const TOO_DEEP = 1100;

const MATRIX = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) => [true, false].map((capture) => ({ mode, runtime, attribution, capture })))
	)
);

const RULE_SETS = [
	{ label: "the bag denied", rules: [{ caller: "bag.**", target: "vault.**", effect: "deny" }], bag: DENIED },
	{ label: "the runner denied", rules: [{ caller: "runner.**", target: "vault.**", effect: "deny" }], bag: DENIED },
	{ label: "nothing denied", rules: [], bag: SECRET }
];

const OWN_ROUTES = ["own-package", "own-two", "own-host"];
const BAG_ROUTES = ["package", "two", "host"];

/**
 * What a route answers from 1100 frames deep, by the rule in the description.
 * @param {string} route - The route.
 * @param {string} attribution - `"precise"` or `"fast"`.
 * @param {{bag: string}} set - The rule set.
 * @returns {string} The expected answer.
 */
const expected = (route, attribution, set) => (!route.startsWith("own-") && attribution === "precise" ? set.bag : DENIED);

beforeAll(() => {
	globalThis.__loadPackageFrameWalk = walk;
});

afterAll(() => {
	delete globalThis.__loadPackageFrameWalk;
});

describe.each(MATRIX)(
	"an access past 1024 frames of package code inside a call > $mode / $runtime / $attribution / capture $capture",
	({ mode, runtime, attribution, capture }) => {
		describe.each(RULE_SETS)("$label", (set) => {
			let api;

			beforeAll(async () => {
				api = await slothlet({
					base: BASE,
					mode,
					runtime,
					silent: true,
					permissions: { policy: "allow", caller: { attribution, capture }, rules: set.rules }
				});
			}, 60000);

			afterAll(async () => {
				await api?.shutdown?.();
				api = null;
			}, 60000);

			it.each([...OWN_ROUTES, ...BAG_ROUTES].map((route) => ({ route, answer: expected(route, attribution, set) })))(
				"runner.now($route, 1100) answers $answer",
				async ({ route, answer }) => {
					expect(await api.runner.now(route, TOO_DEEP)).toBe(answer);
				},
				60000
			);

			it("the same code a few frames deep keeps its answer", async () => {
				expect(await api.runner.now("own-package", 5)).toBe(set.label === "the runner denied" ? DENIED : SECRET);
			}, 60000);
		});
	}
);

/**
 * Run the runner's own code from 1100 frames deep in a Node process of its own, for every config and rule set.
 * @returns {Record<string, string>} What each row gave, by config, rule set and route.
 */
function runChildRows() {
	const script = `
		import slothlet from "@cldmv/slothlet";
		import { walk } from ${JSON.stringify(WALK)};
		globalThis.__loadPackageFrameWalk = walk;
		const out = {};
		for (const { mode, runtime, attribution, capture } of ${JSON.stringify(MATRIX)})
			for (const { label, rules } of ${JSON.stringify(RULE_SETS)}) {
				const api = await slothlet({
					base: ${JSON.stringify(BASE)}, mode, runtime, silent: true,
					permissions: { policy: "allow", rules, caller: { attribution, capture } }
				});
				for (const route of ${JSON.stringify(OWN_ROUTES)})
					out[[mode, runtime, attribution, capture, label, route].join(" | ")] = await api.runner.now(route, ${TOO_DEEP});
				await api.shutdown();
			}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: ROOT,
		encoding: "utf8",
		timeout: 600000,
		maxBuffer: 64 * 1024 * 1024
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe("an access past 1024 frames of package code inside a call, under Node's own loader", () => {
	/** @type {Record<string, string>|null} */
	let answers = null;
	const read = () => (answers ??= runChildRows());

	describe.each(MATRIX)("$mode / $runtime / $attribution / capture $capture", ({ mode, runtime, attribution, capture }) => {
		describe.each(RULE_SETS)("$label", (set) => {
			it.each(OWN_ROUTES.map((route) => ({ route })))(
				"runner.now($route, 1100) answers PERMISSION_DENIED",
				({ route }) => {
					expect(read()[[mode, runtime, attribution, capture, set.label, route].join(" | ")]).toBe(DENIED);
				},
				600000
			);
		});
	});
});
