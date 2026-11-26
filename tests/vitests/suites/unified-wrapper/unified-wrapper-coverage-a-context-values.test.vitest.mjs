/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-context-values.test.vitest.mjs
 *	@Date: 2026-11-25T01:54:11-08:00 (1795600451)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:00-08:00 (1795601580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Objects stored in the runtime `context` inside a run read as plain JS has them, whoever stored them: an
 * object the host passed to the run, the same object a module stores again under another key, an object a module
 * stores, and one the host's own code stores from inside the run — read by another module.
 *
 * The `ctxa` (base) and `ctxb` modules are written to `tmp/uwa-context-values` when the file runs.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { context } from "@cldmv/slothlet/runtime";

const ROOT = path.join(process.cwd(), "tmp", "uwa-context-values");
const BASE = path.join(ROOT, "base");
const OTHER = path.join(ROOT, "other");

const CTXA_SOURCE = `
import { context } from "@cldmv/slothlet/runtime";
export function store() {
	context.item = { n: 1 };
	return true;
}
export function storeHostAgain() {
	context.again = context.hostObj;
	return context.again === context.hostObj;
}
`;

const CTXB_SOURCE = `
import { context } from "@cldmv/slothlet/runtime";
export function read() {
	return {
		host: context.hostObj.n,
		again: context.again.n,
		item: context.item.n,
		fromHostCode: context.fromHostCode?.n
	};
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "ctxa"), { recursive: true });
	mkdirSync(OTHER, { recursive: true });
	writeFileSync(path.join(BASE, "ctxa", "ctxa.mjs"), CTXA_SOURCE);
	writeFileSync(path.join(OTHER, "ctxb.mjs"), CTXB_SOURCE);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const permissions of ["on", "off"])
	for (const [mode, runtime] of [
		["eager", "async"],
		["lazy", "live"]
	])
		CONFIGS.push({ mode, runtime, permissions });

describe.each(CONFIGS)("objects stored in the context — $mode / $runtime / permissions $permissions", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet?.shutdown();
		api = null;
	});

	it("reads what the host and each module stored as plain JS has it", async () => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(permissions === "on" ? { permissions: {} } : {}) });
		await api.slothlet.api.add("ctxb", OTHER, { id: "ctxb" });
		const hostObj = { n: 5 };
		const read = await api.slothlet.context.run({ hostObj }, async () => {
			expect(await api.ctxa.storeHostAgain()).toBe(true);
			expect(await api.ctxa.store()).toBe(true);
			context.fromHostCode = { n: 9 };
			return api.ctxb.read();
		});
		expect(read).toEqual({ host: 5, again: 5, item: 1, fromHostCode: 9 });
	});
});
