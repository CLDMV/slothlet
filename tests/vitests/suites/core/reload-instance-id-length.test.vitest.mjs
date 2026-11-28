/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/reload-instance-id-length.test.vitest.mjs
 *	@Date: 2026-11-17T14:41:12-08:00 (1794955272)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:39-08:00 (1795869099)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A reload's instance ID is the first ID plus one fresh `_reload_<time>_<random>` part, so it stays the
 * same length however many times the instance reloads. The ID names the TypeScript transform cache folder, so an ID
 * that grew on each reload made a TypeScript module fail to load after a handful of reloads.
 *
 * Fixture: `api_tests/api_test_typescript_runtime` (`foo.ts` → `foo.ping()`).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_typescript_runtime");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("reload instance ID length — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	it("keeps the ID bounded across 20 reloads of a TypeScript module", async () => {
		api = await slothlet({ base: BASE, mode, runtime, typescript: true, silent: true });
		const first = api.slothlet.instance.id;
		const seen = new Set([first]);
		for (let k = 0; k < 20; k++) {
			await api.slothlet.reload();
			const id = api.slothlet.instance.id;
			expect(id.startsWith(`${first}_reload_`)).toBe(true);
			expect(id.split("_reload_")).toHaveLength(2);
			expect(id.length).toBeLessThanOrEqual(first.length + 40);
			expect(seen.has(id)).toBe(false);
			seen.add(id);
			expect(api.foo.ping()).toBe("pong");
		}
	});
});
