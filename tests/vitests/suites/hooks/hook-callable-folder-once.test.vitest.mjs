/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-callable-folder-once.test.vitest.mjs
 *	@Date: 2026-11-13T21:30:00-08:00 (1794634200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:30:00-08:00 (1794634200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A hook on a callable folder fires once per call, loaded eagerly or lazily.
 *
 * Fixture `hook-callable-folder`: `e/e.mjs` (a default function) beside `e/y.mjs`, so `api.e()` calls the default
 * and `api.e.y.b()` the sibling. A lazy folder used to hold its own file's node inside its own, so one call ran the
 * hooks of both.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures/hook-callable-folder");

describe.each(getMatrixConfigs())("Hooks > a callable folder fires once per call > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["at the base", "e"],
		["mounted at zz", "zz.e"]
	])("fires the before and after hooks once %s, for the folder and for its sibling's function", async (_label, prefix) => {
		api = await slothlet({ ...config, dir: prefix === "e" ? FIXTURE : undefined, silent: true, hook: true });
		if (prefix !== "e") await api.slothlet.api.add("zz", FIXTURE);
		const seen = [];
		for (const hookPath of [prefix, `${prefix}.y.b`]) {
			api.slothlet.hook.on(`${hookPath}:before`, () => {
				seen.push(`before ${hookPath}`);
			});
			api.slothlet.hook.on(`${hookPath}:after`, () => {
				seen.push(`after ${hookPath}`);
			});
		}
		const node = prefix === "e" ? api.e : api.zz.e;
		await node;
		expect(await node()).toBe("e/e.mjs:default");
		expect(await node.y.b()).toBe("e/y.mjs:b");
		expect(seen).toEqual([`before ${prefix}`, `after ${prefix}`, `before ${prefix}.y.b`, `after ${prefix}.y.b`]);
	});
});
