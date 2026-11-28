/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-reload-build-flow.test.vitest.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:38-08:00 (1795869158)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A full reload builds the instance's new copy as the first build did: a module's code that runs while the
 * build loads it (its top level, a Proxy's traps) is no module's call and has none of the host's standing, whichever
 * runtime carries the reload's build.
 *
 * @module tests/vitests/suites/permissions/permissions-reload-build-flow
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, apiPart } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND7;
const DIR5 = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND5;

/** Deny by default: no module may call the vault. */
const PERMISSIONS = { policy: "deny", rules: [{ caller: "**", target: "slothlet.**", effect: "allow" }] };

/** How code built as no module's is refused: as unattributable, or with no context to read `self` in. */
const BUILD_REFUSALS = new Set(["PERMISSION_DENIED", "CONTEXT_NOT_ACTIVE_SELF"]);

/**
 * Let calls left pending settle.
 * @returns {Promise<void>}
 */
const settle = async () => {
	for (let round = 0; round < 3; round++) await new Promise((resolve) => setTimeout(resolve, 10));
};

describe.each(getMatrixConfigs())("Permissions > a reload's build gives module code no host standing > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a module's top level is refused at its first build and again when a reload builds it", async () => {
		api = await slothlet({ ...config, base: apiPart(DIR), hook: true, permissions: PERMISSIONS });
		await api.slothlet.api.add("rebuilt", apiPart(DIR, "rebuilt"), { id: "rebuilt-mod" });
		await settle();
		const first = await api.rebuilt.probe.taken();
		await api.slothlet.reload();
		await settle();
		const again = await api.rebuilt.probe.taken();
		for (const answers of [first, again]) {
			expect(answers.length).toBeGreaterThan(0);
			for (const answer of answers) expect(BUILD_REFUSALS.has(answer)).toBe(true);
		}
	});

	it("a module's Proxy, read by the reload's build, runs its traps without the host's standing", async () => {
		api = await slothlet({ ...config, base: path.join(DIR5, "base"), hook: true, permissions: PERMISSIONS });
		await api.slothlet.api.add("supplier", path.join(DIR5, "supplier"), { id: "supplier-mod" });
		await api.supplier.trap.p;
		await api.supplier.trap.taken();
		await api.slothlet.reload();
		await api.vault.secret;
		await settle();
		const answers = await api.supplier.trap.taken();
		expect(answers.length).toBeGreaterThan(0);
		expect(answers.filter((answer) => answer === "s3cret")).toEqual([]);
	});
});
