/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/reload-held-code.test.vitest.mjs
 *	@Date: 2026-11-22T08:39:44-08:00 (1795365584)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T09:55:18-08:00 (1795370118)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code made before a `reload()` / `restart()` and run after it acts on the rebuilt instance, with the
 * context it would have had: a host's `AsyncLocalStorage.snapshot()` or `AsyncResource` made in a run, or a snapshot a
 * module's call made there, reads the run's context; the same made outside any run, and a function a module returned
 * (called outside any run), read the instance's. Both runtimes, both modes, with the permission system absent, off and
 * on. After `shutdown()` a module's code reads no `self`.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose leaf answers the stamp `shared/stamp.mjs` took when the
 * instance's copy of it loaded (one copy per instance ID), and `probe/probe.mjs`, whose `read()` answers that stamp
 * through `self` with `context.who`, whose `snap()` takes a snapshot and hands out a function that reads the same inside
 * it, and whose `later()` hands out a function that reads the same wherever it is called.
 */
import path from "node:path";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "reload-held-code");
const BASE = path.join(ROOT, "api");
const STAMP = Symbol.for("slothlet.test.reload-held-code.stamp");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	mkdirSync(path.join(ROOT, "shared"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "shared", "stamp.mjs"),
		'export const stamp = globalThis[Symbol.for("slothlet.test.reload-held-code.stamp")];\n'
	);
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		'import { stamp } from "../../shared/stamp.mjs";\nexport function copyOf() {\n\treturn stamp;\n}\n'
	);
	writeFileSync(
		path.join(BASE, "probe", "probe.mjs"),
		[
			'import { AsyncLocalStorage } from "node:async_hooks";',
			'import { self, context } from "@cldmv/slothlet/runtime";',
			"export async function read() {",
			"\treturn { copy: await self.calls.copyOf(), who: context.who ?? null };",
			"}",
			"export function snap() {",
			"\tconst inside = AsyncLocalStorage.snapshot();",
			"\treturn () => inside(async () => ({ copy: await self.calls.copyOf(), who: context.who ?? null }));",
			"}",
			"export function later() {",
			"\treturn async () => ({ copy: await self.calls.copyOf(), who: context.who ?? null });",
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
 * Let a few macrotasks pass.
 * @returns {Promise<void>}
 */
async function idle() {
	for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Make a function that later runs code the way `kind` says.
 * @param {object} api - The api.
 * @param {string} kind - "snapshot", "resource", "module snapshot" or "module function".
 * @returns {Promise<function(): Promise<{copy: *, who: string|null}>>} The function.
 */
async function handOut(api, kind) {
	const body = async () => {
		const direct = await api.calls.copyOf();
		const read = await api.probe.read();
		return { copy: direct === read.copy ? direct : { direct, read: read.copy }, who: api.slothlet.context.get().who ?? null };
	};
	if (kind === "snapshot") {
		const inside = AsyncLocalStorage.snapshot();
		return () => inside(body);
	}
	if (kind === "resource") {
		const resource = new AsyncResource("reload-held-code");
		return () => resource.runInAsyncScope(body);
	}
	if (kind === "module snapshot") return api.probe.snap();
	return api.probe.later();
}

/**
 * Make the function (in a run, or outside any), reload or restart the instance with a new stamp, then call it outside
 * any run.
 * @param {object} options - What to do.
 * @param {string} options.runtime - "async" or "live".
 * @param {string} options.mode - "eager" or "lazy".
 * @param {string} options.permissions - "none", "off" or "on".
 * @param {string} options.operation - "reload" or "restart".
 * @param {string} options.kind - See {@link handOut}.
 * @param {boolean} options.inRun - Make it in a run (true) or outside any (false).
 * @returns {Promise<{copy: *, who: string|null}>} What the function answered, or the error code it threw as `copy`.
 */
async function scenario({ runtime, mode, permissions, operation, kind, inRun }) {
	globalThis[STAMP] = 1;
	const api = await slothlet({
		base: BASE,
		runtime,
		mode,
		silent: true,
		context: { who: "instance" },
		...(permissions === "none" ? {} : { permissions })
	});
	try {
		let handed = null;
		if (inRun) {
			await api.slothlet.context.run({ who: "run" }, async () => {
				handed = await handOut(api, kind);
			});
		} else handed = await handOut(api, kind);
		await idle();
		globalThis[STAMP] = 2;
		await api.slothlet[operation]();
		await idle();
		try {
			return await handed();
		} catch (error) {
			return { copy: error?.code ?? String(error), who: null };
		}
	} finally {
		await api.slothlet.shutdown();
	}
}

describe.each([["async"], ["live"]])("%s runtime: code made before a reload or restart, run after it", (runtime) => {
	describe.each([["reload"], ["restart"]])("%s()", (operation) => {
		describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
			describe.each([["none"], ["off"], ["on"]])("permissions %s", (permissions) => {
				// The modules a restart replaced are gone with the instance they were in: with the permission system on, the code
				// they made has no standing (docs/PERMISSIONS.md), so a snapshot their call took is left out there.
				const moduleSnapshot = operation === "restart" && permissions === "on" ? [] : [["module snapshot"]];
				it.each([["snapshot"], ["resource"], ...moduleSnapshot])(
					"a %s made in a run reads the run's context and the rebuilt tree",
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: true });
						expect(answer).toEqual({ copy: 2, who: "run" });
					}
				);
				it.each([["snapshot"], ["resource"], ...moduleSnapshot, ["module function"]])(
					"a %s made outside any run reads the instance's context and the rebuilt tree",
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: false });
						expect(answer).toEqual({ copy: 2, who: "instance" });
					}
				);
				it("a module function made in a run, called outside any run, reads the instance's context and the rebuilt tree", async () => {
					const answer = await scenario({ runtime, mode, permissions, operation, kind: "module function", inRun: true });
					expect(answer).toEqual({ copy: 2, who: "instance" });
				});
			});
		});
	});

	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		describe.each([["none"], ["off"], ["on"]])("permissions %s", (permissions) => {
			it("a module function called after shutdown() reads no self", async () => {
				globalThis[STAMP] = 1;
				const api = await slothlet({
					base: BASE,
					runtime,
					mode,
					silent: true,
					context: { who: "instance" },
					...(permissions === "none" ? {} : { permissions })
				});
				const later = await api.probe.later();
				expect(await later()).toEqual({ copy: 1, who: "instance" });
				await api.slothlet.shutdown();
				await expect(later()).rejects.toMatchObject({ code: "CONTEXT_NOT_ACTIVE_SELF" });
			});
		});
	});
});
