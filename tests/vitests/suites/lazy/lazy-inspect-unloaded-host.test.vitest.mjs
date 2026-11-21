/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-inspect-unloaded-host.test.vitest.mjs
 *	@Date: 2026-11-16T00:22:10-08:00 (1794817330)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:33:45-08:00 (1794818025)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #824 — in lazy mode the host's `util.inspect` of a folder that has not loaded yet shows
 * `[Function: sub]`, the form a module's view of it shows, not `Proxy([Function: sub])`.
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import fsp from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import slothlet from "@cldmv/slothlet";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

let root;

beforeAll(async () => {
	root = await makeTestTmpDir("lazy-inspect-824");
	await fsp.mkdir(path.join(root, "sub"), { recursive: true });
	await fsp.writeFile(path.join(root, "sub", "a.mjs"), "export function one() { return 1; }\nexport function two() { return 2; }\n");
	await fsp.writeFile(path.join(root, "top.mjs"), "export function ping() { return 'pong'; }\n");
});

afterAll(async () => {
	if (root) await fsp.rm(root, { recursive: true, force: true });
});

describe.each(["async", "live"])("host util.inspect of an unloaded lazy folder (#824) > %s", (runtime) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("shows the node as a function, not as a Proxy", async () => {
		api = await slothlet({ base: root, mode: "lazy", runtime });
		const shown = util.inspect(api.sub);
		expect(shown).not.toContain("Proxy(");
		expect(shown).toBe("[Function: sub]");
	});

	it("shows its members once it has loaded", async () => {
		api = await slothlet({ base: root, mode: "lazy", runtime });
		await api.sub.a.one();
		expect(util.inspect(api.sub)).toContain("a:");
	});
});
