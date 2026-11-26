/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typegen/typegen-augment-option.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `generate()` refuses an `augment` option that is not a boolean.
 */
import { describe, it, expect } from "vitest";
import { generate } from "@cldmv/slothlet/typegen";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe("typegen > augment option", () => {
	it.each([["yes"], [1], [null], [{}]])("rejects augment %j with INVALID_CONFIG", async (augment) => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				generate({ base: "./api_tests/api_test_typescript_runtime", output: "tmp/never-written.d.ts", name: "X", augment })
			).rejects.toThrow(/INVALID_CONFIG/);
		});
	});
});
