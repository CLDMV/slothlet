/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-lazy-cjs-folder-load.test.vitest.mjs
 *	@Date: 2026-11-15T10:00:00-08:00 (1794765600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T10:00:00-08:00 (1794765600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a CommonJS api file inside a folder starts at its top level runs as the file's module, in lazy mode
 * as in eager mode and as the same file at the api root (#777).
 *
 * @description
 * Fixture `api_test_lazy_cjs_folder_load`:
 * ```
 * crunner/crunner.cjs   starts a job queue when it loads; later() runs its own code calling the vault from that queue,
 *                       now() runs it inside the call. Two exports, so the folder it is named like takes both.
 * croot.cjs             the same file at the api root
 * mrunner/mrunner.mjs   the same as an ES module in a folder
 * vault/vault.mjs       get() → "SECRET"
 * ```
 * Expected values come from the rule for code a file starts while it loads (docs/PERMISSIONS.md): it runs as the file's
 * module, so it answers what the same code answers inside a call (`now`): "SECRET" with nothing denied, and
 * `PERMISSION_DENIED` when the running file's module is denied the vault.
 * @module tests/vitests/suites/permissions/permissions-lazy-cjs-folder-load
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve("api_tests/api_test_lazy_cjs_folder_load");

const MATRIX = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

const RUNNERS = ["crunner", "croot", "mrunner"];

const RULE_SETS = [
	{ label: "nothing denied", rules: [], answer: "SECRET" },
	{
		label: "the running files' modules denied",
		rules: RUNNERS.map((module) => ({ caller: `${module}.**`, target: "vault.**", effect: "deny" })),
		answer: "PERMISSION_DENIED"
	}
];

describe.each(MATRIX)("code a file's load started, in a folder > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe.each(RULE_SETS)("$label", ({ rules, answer }) => {
		it.each(RUNNERS)("%s answers from its load's queue as inside a call", async (runner) => {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
			await api.vault;
			await api[runner];
			expect(await api[runner].now()).toBe(answer);
			expect(await api[runner].later()).toBe(answer);
		});
	});
});
