/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-run-closed-node.test.vitest.mjs
 *	@Date: 2026-11-25T02:02:27-08:00 (1795600947)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:03-08:00 (1795601583)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A run reads a node as it was when the run started: a node the host closes to extension after the start
 * is still open for the run, which can define, delete, write and close members of it through its own view, and none of
 * that reaches the instance.
 *
 * The fixture is written to `tmp/uwa-run-closed-node` when the file runs.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "uwa-run-closed-node");
const BASE = path.join(ROOT, "api");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "data"), { recursive: true });
	writeFileSync(path.join(BASE, "data", "data.mjs"), "export const box = { a: 1, c: 3 };\nexport function ping() {\n\treturn 1;\n}\n");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) CONFIGS.push({ mode, runtime });

describe.each(CONFIGS)("a run's view of a node closed after the run started — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet?.shutdown();
		api = null;
	});

	it("keeps the node open for the run, and the run's changes in the run", async () => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true });
		await api.data.box;
		let go;
		const gate = new Promise((resolve) => {
			go = resolve;
		});
		const done = api.slothlet.context.run.self({}, async (view) => {
			await gate;
			const box = view.data.box;
			return {
				define: Reflect.defineProperty(box, "b", { value: 2, configurable: true, enumerable: true, writable: true }),
				remove: Reflect.deleteProperty(box, "a"),
				write: Reflect.set(box, "c", 4),
				close: Reflect.preventExtensions(box),
				keys: Object.keys(box),
				values: [box.b, box.c],
				extensible: Object.isExtensible(box)
			};
		});
		Object.preventExtensions(api.data.box);
		go();
		expect(await done).toEqual({
			define: true,
			remove: true,
			write: true,
			close: true,
			keys: ["c", "b"],
			values: [2, 4],
			extensible: false
		});
		expect([Object.keys(api.data.box), api.data.box.c, Object.isExtensible(api.data.box)]).toEqual([["a", "c"], 3, false]);
	});
});
