/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-stack-settings.test.vitest.mjs
 *	@Date: 2026-11-14T12:00:00-08:00 (1794686400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T12:00:00-08:00 (1794686400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a module does to the global `Error` and its stack settings does not change who an access is
 * attributed to.
 *
 * @description
 * Fixture `api_test_stack_settings`. `settler` is denied the vault, and only `good` may call `only`. Around each of
 * its reads `settler` puts one change in place and takes it back: another global `Error` (a function, a Proxy, a
 * subclass) with a formatter of its own, `prepareStackTrace` as an accessor on `Error` or on `Function.prototype`
 * (passing settler's frames over, reversing them, handing over stand-in call sites, answering differently between
 * reads, throwing), `stackTraceLimit` read-only or an accessor, a read-only `prepareStackTrace`, a replaced
 * `Error.captureStackTrace`. Its reads go every route (`routes.mjs`): its own call, after an await, its function run by
 * `good` or by the host, from a timer.
 *
 * Each answer is the one the same route gives with nothing changed, which is a refusal: settler's code is settler's
 * whoever runs it (PERMISSIONS.md, "Code a module hands out runs as its definer"). A change fixed in place (made
 * read-only and non-configurable) runs in a process of its own, as it cannot be taken back: every route is refused.
 * @module tests/vitests/suites/permissions/permissions-stack-settings
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { ROUTES } from "../../../../api_tests/api_test_stack_settings/routes.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_stack_settings");
const DENIED = "PERMISSION_DENIED";
/** `self` read with no call to tell whose it is (the host running settler's function under fast, capture off). */
const NO_CONTEXT = "RUNTIME_NO_ACTIVE_CONTEXT_SELF";

const CHANGES = [
	"globalFunction",
	"globalEmpty",
	"globalText",
	"globalProxy",
	"globalSubclass",
	"accessorOwnSites",
	"accessorReversed",
	"accessorIgnored",
	"accessorAlternating",
	"accessorStandIns",
	"inheritedAccessor",
	"accessorThrowing",
	"limitZero",
	"limitOne",
	"limitAccessor",
	"prepareReadOnly",
	"captureReplaced"
];
const FIXED = ["fixedLimit", "fixedPrepare", "fixedGlobal"];
const ROUTE_NAMES = Object.keys(ROUTES.runs);

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) => [true, false].map((capture) => ({ mode, runtime, attribution, capture })))
	)
);

/**
 * Run a route, reporting a refusal by its code.
 * @param {object} api - The instance.
 * @param {string} route - The route.
 * @param {string} change - The change.
 * @returns {Promise<unknown>} The answer.
 */
async function answer(api, route, change) {
	try {
		return await ROUTES.runs[route](api, change);
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

describe.each(matrix)(
	"stack settings a module changes > $mode / $runtime / $attribution / capture $capture",
	({ mode, runtime, attribution, capture }) => {
		let api;
		const unchanged = {};

		beforeAll(async () => {
			api = await slothlet({
				base: path.join(FIXTURE, "api"),
				mode,
				runtime,
				silent: true,
				permissions: { defaultPolicy: "allow", attribution, references: { capture }, rules: ROUTES.rules }
			});
			for (const route of ROUTE_NAMES) unchanged[route] = await answer(api, route, "none");
		});

		afterAll(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("every route is refused with nothing changed", () => {
			for (const route of ROUTE_NAMES) expect([DENIED, NO_CONTEXT], route).toContain(unchanged[route]);
			expect(unchanged.own).toBe(DENIED);
			expect(unchanged.handedToGood).toBe(DENIED);
			expect(unchanged.onlyThroughGood).toBe(DENIED);
		});

		it("good itself still reads the node only it may call", async () => {
			expect(await api.good.readOnly()).toBe("GOOD-ONLY");
		});

		describe.each(CHANGES)("%s", (change) => {
			it.each(ROUTE_NAMES)("%s answers as with nothing changed", async (route) => {
				expect(await answer(api, route, change)).toBe(unchanged[route]);
			});
		});
	}
);

/**
 * Run every route with one change in a child process.
 * @param {string[]} args - The change and the config.
 * @param {string[]} [nodeFlags=[]] - Extra flags for node.
 * @returns {object} The answers.
 */
function child(args, nodeFlags = []) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", ...nodeFlags, path.join(FIXTURE, "child.mjs"), ...args], {
		encoding: "utf8",
		timeout: 120_000
	});
	const line = result.stdout.split("\n").find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`child gave no result (status ${result.status}): ${result.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe.each(matrix.filter(({ mode, capture }) => mode === "eager" && capture))(
	"stack settings fixed in place > $runtime / $attribution",
	({ runtime, attribution }) => {
		it.each(FIXED)("%s: every route is refused", (change) => {
			const answers = child([change, "eager", runtime, attribution, "true"]);
			for (const route of ROUTE_NAMES) expect([DENIED, NO_CONTEXT], route).toContain(answers[route]);
		});

		it.each(["accessorOwnSites", "globalFunction"])("%s with source maps enabled answers as with nothing changed", (change) => {
			const unchanged = child(["none", "eager", runtime, attribution, "true"], ["--enable-source-maps"]);
			expect(child([change, "eager", runtime, attribution, "true"], ["--enable-source-maps"])).toEqual(unchanged);
		});
	}
);
