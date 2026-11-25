/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/restart-helper-code.test.vitest.mjs
 *	@Date: 2026-11-22T23:26:17-08:00 (1795418777)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T23:49:36-08:00 (1795420176)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code a helper file of the instance handed out before a host `restart()` (a function the helper made,
 * returned through a module's call) has no standing afterwards: with the permission system on, its reads of `self` are
 * refused with `PERMISSION_DENIED`, on both runtimes and in both modes, as docs/RELOAD.md says for code the replaced
 * modules handed out. With the permission system off it acts on the rebuilt instance.
 *
 * Fixture (written at run time): `api/calls/calls.mjs`, whose `copyOf()` answers the value `globalThis[STAMP]` held
 * when the file loaded; `api/probe/probe.mjs`, whose `helper()` returns what `lib/helper.mjs`'s `helperLater()` makes:
 * a function, written in the helper file, that calls `self.calls.copyOf()`.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "restart-helper-code");
const BASE = path.join(ROOT, "api");
const STAMP = Symbol.for("slothlet.test.restart-helper-code.stamp");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	mkdirSync(path.join(ROOT, "lib"), { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		[
			'const stamp = globalThis[Symbol.for("slothlet.test.restart-helper-code.stamp")];',
			"export function copyOf() {",
			"\treturn stamp;",
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(BASE, "probe", "probe.mjs"),
		['import { helperLater } from "../../lib/helper.mjs";', "export function helper() {", "\treturn helperLater();", "}", ""].join("\n")
	);
	writeFileSync(
		path.join(ROOT, "lib", "helper.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function helperLater() {",
			"\treturn async () => self.calls.copyOf();",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[STAMP];
});

/**
 * What a call answers: its value, or the code of the error it throws.
 * @param {Function} fn - The call.
 * @returns {Promise<*>} The value or the error code.
 */
async function outcome(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message);
	}
}

describe.each([["async"], ["live"]])("helper-file code handed out before a host restart() — %s runtime", (runtime) => {
	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		it("is refused with PERMISSION_DENIED with the permission system on", async () => {
			globalThis[STAMP] = 1;
			const api = await slothlet({ base: BASE, runtime, mode, silent: true, permissions: "on" });
			try {
				expect(await api.calls.copyOf()).toBe(1);
				const helper = await api.probe.helper();
				expect(await outcome(() => helper())).toBe(1);
				globalThis[STAMP] = 2;
				await api.slothlet.restart();
				expect(await outcome(() => helper())).toBe("PERMISSION_DENIED");
				expect(await api.calls.copyOf()).toBe(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("is refused with PERMISSION_DENIED before the rebuilt instance has loaded the module that handed it out", async () => {
			globalThis[STAMP] = 1;
			const api = await slothlet({ base: BASE, runtime, mode, silent: true, permissions: "on" });
			try {
				const helper = await api.probe.helper();
				globalThis[STAMP] = 2;
				await api.slothlet.restart();
				expect(await outcome(() => helper())).toBe("PERMISSION_DENIED");
				// The rebuilt instance loads `probe` now; the code made before the restart stays refused.
				const fresh = await api.probe.helper();
				expect(await outcome(() => fresh())).toBe(2);
				expect(await outcome(() => helper())).toBe("PERMISSION_DENIED");
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
