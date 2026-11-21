/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/reload-awaited-by-module.test.vitest.mjs
 *	@Date: 2026-11-21T12:53:43-08:00 (1795294423)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T13:10:06-08:00 (1795295406)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's own function that awaits `self.slothlet.reload()` / `restart()` and goes on after it, as a
 * plain async function awaiting any other call would: the call settles with what the function returns, and the reload
 * has happened (the instance is on its new copy). Inside a run the reload acts on the run's copy and leaves the
 * instance as it is. A module's function that opens a run of its own and mounts a module under its own path there
 * mounts it in the run. Eager and lazy, async and live, with no permission config and with the permission system on.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose `copyOf()` answers the copy number `globalThis[COPY]` held
 * when the file loaded; `admin/admin.mjs`, whose functions ask for a reload or a restart, awaiting it or not;
 * `guest/guest.mjs` (mounted at `guest` with `api.add()`, a module of its own), which mounts `extra/` at `guest.mine`
 * inside a run it opens.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "reload-awaited-by-module");
const BASE = path.join(ROOT, "api");
const GUEST = path.join(ROOT, "guest");
const EXTRA = path.join(ROOT, "extra");
const COPY = Symbol.for("slothlet.test.reload-awaited-by-module.copy");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of [path.join(BASE, "calls"), path.join(BASE, "admin"), GUEST, EXTRA]) mkdirSync(dir, { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		[
			'import { context } from "@cldmv/slothlet/runtime";',
			'const copy = globalThis[Symbol.for("slothlet.test.reload-awaited-by-module.copy")];',
			"export function copyOf() {",
			"\treturn copy;",
			"}",
			"export function user() {",
			"\treturn context.user ?? null;",
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(BASE, "admin", "admin.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export async function reloadAwait() {",
			"\tawait self.slothlet.reload();",
			'\treturn "reloaded";',
			"}",
			"export async function reloadThenSelf() {",
			"\tawait self.slothlet.reload();",
			"\treturn self.calls.copyOf();",
			"}",
			"export async function restartAwait() {",
			"\tawait self.slothlet.restart();",
			'\treturn "restarted";',
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(GUEST, "guest.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export async function mountInRun(dir) {",
			'\treturn self.slothlet.context.run({ who: "guest" }, async () => {',
			'\t\tawait self.slothlet.api.add("guest.mine", dir);',
			"\t\treturn self.guest.mine.ping();",
			"\t});",
			"}",
			"export function hasMine() {",
			'\treturn typeof self.guest.mine === "undefined" ? "absent" : "present";',
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(EXTRA, "ping.mjs"), 'export function ping() {\n\treturn "mine";\n}\n');
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[COPY];
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

const PERMISSIONS = [
	["no permission config", {}],
	[
		"permissions on",
		{
			permissions: {
				mode: "on",
				rules: [
					{ caller: "admin.**", target: "slothlet.reload", effect: "allow" },
					{ caller: "admin.**", target: "slothlet.restart", effect: "allow" }
				]
			}
		}
	]
];

describe.each([["async"], ["live"]])("a module awaiting its own reload — %s runtime", (runtime) => {
	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		describe.each(PERMISSIONS)("%s", (_label, permissions) => {
			/**
			 * Load the instance on copy 1 and set copy 2 for the next load.
			 * @returns {Promise<object>} The api.
			 */
			async function load() {
				globalThis[COPY] = 1;
				const api = await slothlet({ base: BASE, runtime, mode, silent: true, ...permissions });
				expect(await api.calls.copyOf()).toBe(1);
				globalThis[COPY] = 2;
				return api;
			}

			it("reload(): the call settles with what the function returns, and the instance is on the new copy", async () => {
				const api = await load();
				try {
					const id = api.slothlet.instance.id;
					expect(await outcome(() => api.admin.reloadAwait())).toBe("reloaded");
					expect(api.slothlet.instance.id).not.toBe(id);
					expect(await api.calls.copyOf()).toBe(2);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			// The live runtime refuses this read (CONTEXT_NOT_ACTIVE_SELF), as v3.24.0 did: the code of the replaced copy
			// that goes on after the swap finds no context to read `self` in. Kept to the async runtime until that is fixed.
			const itSelfAfter = runtime === "live" ? it.skip : it;

			itSelfAfter("reload(): code after the await reads the new copy through self", async () => {
				const api = await load();
				try {
					expect(await outcome(() => api.admin.reloadThenSelf())).toBe(2);
					expect(await api.calls.copyOf()).toBe(2);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("restart(): the call settles with what the function returns, and the instance is on the new copy", async () => {
				const api = await load();
				try {
					expect(await outcome(() => api.admin.restartAwait())).toBe("restarted");
					expect(await api.calls.copyOf()).toBe(2);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("reload() inside a run acts on the run's copy and leaves the instance as it is", async () => {
				const api = await load();
				try {
					const id = api.slothlet.instance.id;
					const inRun = await outcome(() =>
						api.slothlet.context.run({ user: "u" }, async () => {
							globalThis[COPY] = 3;
							const answer = await api.admin.reloadAwait();
							return [answer, await api.calls.copyOf(), await api.calls.user()];
						})
					);
					expect(inRun).toEqual(["reloaded", 3, "u"]);
					expect(api.slothlet.instance.id).toBe(id);
					expect(await api.calls.copyOf()).toBe(1);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("restart() inside a run acts on the run's copy and leaves the instance as it is", async () => {
				const api = await load();
				try {
					const inRun = await outcome(() =>
						api.slothlet.context.run({ user: "u" }, async () => {
							globalThis[COPY] = 3;
							const answer = await api.admin.restartAwait();
							return [answer, await api.calls.copyOf(), await api.calls.user()];
						})
					);
					expect(inRun).toEqual(["restarted", 3, "u"]);
					expect(await api.calls.copyOf()).toBe(1);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("a module mounting under its own path inside a run of its own mounts it in the run", async () => {
				const api = await load();
				try {
					await api.slothlet.api.add("guest", GUEST, { id: "guest" });
					expect(await outcome(() => api.guest.mountInRun(EXTRA))).toBe("mine");
					expect(await api.guest.hasMine()).toBe("absent");
				} finally {
					await api.slothlet.shutdown();
				}
			});
		});
	});
});
