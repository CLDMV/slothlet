/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-rule-ids-per-instance.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:07-08:00 (1794882607)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #822 — rule ids and the rule registration sequence belong to one instance. A second instance
 * built with the same config numbers its rules from the same start, not from where the first left off.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const RULE = { caller: "**", target: "math.**", effect: "allow" };

describe.each(["eager", "lazy"])("permission rule ids are per instance (#822) > %s", (mode) => {
	let a;
	let b;

	afterEach(async () => {
		if (a) await a.shutdown();
		if (b) await b.shutdown();
		a = b = null;
	});

	const make = () => slothlet({ base: TEST_DIRS.API_TEST, mode, permissions: { policy: "allow", rules: [RULE] } });

	it("a second instance numbers its rules from the same start as the first", async () => {
		a = await make();
		const firstA = a.slothlet.permissions.rules.add(RULE);
		const secondA = a.slothlet.permissions.rules.add(RULE);
		b = await make();
		const firstB = b.slothlet.permissions.rules.add(RULE);
		expect(firstB).toBe(firstA);
		expect(secondA).not.toBe(firstA);
	});

	it("rules added to one instance do not move the other instance's ids", async () => {
		a = await make();
		b = await make();
		const before = b.slothlet.permissions.rules.add(RULE);
		for (let i = 0; i < 5; i++) a.slothlet.permissions.rules.add(RULE);
		const after = b.slothlet.permissions.rules.add(RULE);
		expect(Number(after.split("-").pop())).toBe(Number(before.split("-").pop()) + 1);
	});
});
