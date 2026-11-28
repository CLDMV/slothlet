/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/builders/api-builder-version-unreadable.test.vitest.mjs
 *	@Date: 2026-11-28T10:44:16-08:00 (1795891456)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T12:15:25-08:00 (1795896925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.version` when the package's own package.json can't be read.
 *
 * @description
 * api_builder.mjs reads the version from slothlet's package.json through the platform's `loadJson`, which answers
 * null when the file can't be read or parsed. Here `loadJson` stands in for that failure: the namespace then
 * reports "unknown", as a browser build does.
 *
 * @module tests/vitests/suites/builders/api-builder-version-unreadable
 */

import { describe, it, expect, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

vi.mock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), loadJson: () => null }));

describe("api_builder – version when package.json can't be read", () => {
	it('reports "unknown"', async () => {
		const api = await slothlet({ mode: "eager", runtime: "async", base: TEST_DIRS.API_TEST });
		try {
			expect(api.slothlet.version).toBe("unknown");
		} finally {
			await api.shutdown();
		}
	});
});
