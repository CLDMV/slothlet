/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/reload-window-live-no-als.test.vitest.mjs
 *	@Date: 2026-11-22T23:26:42-08:00 (1795418802)
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
 * @fileoverview The live runtime keeps a full reload's build apart from the calls made while it runs with its own
 * flows, as it does a run's context and caller, so it needs no `AsyncLocalStorage` for it: with `AsyncLocalStorage` and
 * `AsyncResource` taken away from slothlet's platform layer (a browser), a host `reload()` opens the same window it
 * opens in Node. While the build runs every call, a `run()` open across the reload included, is answered by the copy the
 * instance has, with its permission rules, mode and seal; a second reload or a shutdown waits for the first; at the swap
 * everything moves to the new copy at once.
 *
 * Fixture (written at run time): `api/a/a.mjs` calls `b.secret()` through `self`; `vault/secret.mjs`, mounted at `b`
 * with `api.add()`, holds `secret()`; `api/slow/slow.mjs` waits on `globalThis[HOLD]` while it loads, when that is set,
 * so a test holds a reload in the middle of building its new copy.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";

vi.mock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), AsyncLocalStorage: null, AsyncResource: null }));

const ROOT = path.join(process.cwd(), "tmp", "reload-window-live-no-als");
const BASE = path.join(ROOT, "api");
const VAULT = path.join(ROOT, "vault");
const HOLD = Symbol.for("slothlet.test.reload-window-live-no-als.hold");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["a", "slow"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	mkdirSync(VAULT, { recursive: true });
	writeFileSync(
		path.join(BASE, "a", "a.mjs"),
		['import { self } from "@cldmv/slothlet/runtime";', "export function secretVia() {", "\treturn self.b.secret();", "}", ""].join("\n")
	);
	writeFileSync(path.join(VAULT, "secret.mjs"), 'export function secret() {\n\treturn "secret";\n}\n');
	writeFileSync(
		path.join(BASE, "slow", "slow.mjs"),
		[
			'const hold = globalThis[Symbol.for("slothlet.test.reload-window-live-no-als.hold")];',
			"if (hold) {",
			"\thold.entered();",
			"\tawait hold.promise;",
			"}",
			"export function ready() {",
			"\treturn true;",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[HOLD];
});

/**
 * A promise with its resolve function.
 * @returns {{promise: Promise<*>, release: Function}} The gate.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

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

/**
 * Start a reload and hold it while it loads `slow/slow.mjs`, so the new copy is half built.
 * @param {object} api - The instance's api.
 * @returns {Promise<{reloading: Promise<*>, release: Function}>} The reload under way and the function that lets it go on.
 */
async function holdReload(api) {
	const entered = gate();
	const held = gate();
	globalThis[HOLD] = { entered: entered.release, promise: held.promise };
	const reloading = api.slothlet.reload();
	reloading.catch(() => {});
	await entered.promise;
	return {
		reloading,
		release() {
			delete globalThis[HOLD];
			held.release();
		}
	};
}

// Eager mode: a lazy build loads no module, so nothing holds it half built.
describe("live runtime, no AsyncLocalStorage: a host reload() opens its window", () => {
	/**
	 * Make an instance on the fixture, with `vault` mounted at `b`.
	 * @param {object} [config] - More config.
	 * @returns {Promise<object>} The api.
	 */
	async function make(config = {}) {
		const api = await slothlet({ base: BASE, runtime: "live", silent: true, ...config });
		await api.slothlet.api.add("b", VAULT, { id: "vault" });
		return api;
	}

	it("with a run open, the seal and the rules hold for every call while the build runs", async () => {
		const api = await make({ permissions: { mode: "off" } });
		let hold = null;
		const step = gate();
		const entered = gate();
		let run = null;
		try {
			api.slothlet.permissions.control.mode("on");
			api.slothlet.permissions.rules.add({ caller: "a.**", target: "b.secret", effect: "deny" });
			api.slothlet.permissions.control.seal();
			run = api.slothlet.context.run({ user: "alice" }, async () => {
				const before = await outcome(() => api.a.secretVia());
				entered.release();
				await step.promise;
				return { before, after: await outcome(() => api.a.secretVia()) };
			});
			await entered.promise;

			hold = await holdReload(api);
			expect(api.slothlet.permissions.control.mode()).toBe("on");
			expect(api.slothlet.permissions.control.sealed).toBe(true);
			expect(await outcome(() => api.a.secretVia())).toBe("PERMISSION_DENIED");
			expect(await outcome(() => api.slothlet.permissions.rules.add({ caller: "a.**", target: "b.secret", effect: "allow" }))).toBe(
				"PERMISSION_SEALED"
			);
			step.release();
			expect(await run).toEqual({ before: "PERMISSION_DENIED", after: "PERMISSION_DENIED" });

			hold.release();
			await hold.reloading;
			expect(api.slothlet.permissions.control.sealed).toBe(true);
			expect(await outcome(() => api.a.secretVia())).toBe("PERMISSION_DENIED");
		} finally {
			step.release();
			await run?.catch(() => {});
			hold?.release();
			await hold?.reloading.catch(() => {});
			await api.slothlet.shutdown();
		}
	});

	it("a reload or shutdown asked for while a reload builds starts once it has finished", async () => {
		const api = await make({ permissions: { mode: "on" } });
		let hold = null;
		try {
			hold = await holdReload(api);
			const order = [];
			const second = api.slothlet.reload().then(() => order.push("second"));
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(order).toEqual([]);
			hold.release();
			await hold.reloading.then(() => order.push("first"));
			await second;
			expect(order).toEqual(["first", "second"]);
			expect(await api.a.secretVia()).toBe("secret");

			hold = await holdReload(api);
			let down = false;
			const shutdown = api.slothlet.shutdown().then(() => {
				down = true;
			});
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(down).toBe(false);
			hold.release();
			await hold.reloading;
			await shutdown;
			expect(down).toBe(true);
		} finally {
			hold?.release();
			await hold?.reloading.catch(() => {});
			await api.slothlet.shutdown();
		}
	});
});
