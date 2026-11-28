/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/reload-window-no-als.test.vitest.mjs
 *	@Date: 2026-11-17T17:10:02-08:00 (1794964202)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:40-08:00 (1795869100)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A host with no AsyncLocalStorage (a browser) cannot keep a reload's build apart from the calls made
 * while it runs, so those calls reach the new copy's components: the new components take the permission rules, mode and
 * policy, the hooks and the metadata the instance has before any module of the new copy loads (#899). Run here with
 * `AsyncLocalStorage` taken away from slothlet's platform layer, on the live runtime.
 *
 * Fixture (written at run time): `api/a/a.mjs` calls `b.secret()` through `self`, synchronously and after an `await`,
 * and its own `a.inner()`; `vault/secret.mjs`, mounted at `b` with `api.add()` (a module of its own), holds `secret()`;
 * `api/slow/slow.mjs` waits on `globalThis[HOLD]` while it loads, when that is set, so a test holds a reload in the
 * middle of building its new copy.
 *
 * A `run()` opened before the reload keeps the copy the instance had before it once the reload is done; while the
 * reload builds, its calls reach the new components as everyone's do.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";

vi.mock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), AsyncLocalStorage: null }));

const ROOT = path.join(process.cwd(), "tmp", "reload-window-no-als");
const BASE = path.join(ROOT, "api");
const VAULT = path.join(ROOT, "vault");
const HOLD = Symbol.for("slothlet.test.reload-window-no-als.hold");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["a", "slow"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	mkdirSync(VAULT, { recursive: true });
	writeFileSync(
		path.join(BASE, "a", "a.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function secretVia() {",
			"\treturn self.b.secret();",
			"}",
			"export async function secretLater() {",
			"\tawait null;",
			"\treturn self.b.secret();",
			"}",
			"export function inner() {",
			'\treturn "inner";',
			"}",
			"export function innerVia() {",
			"\treturn self.a.inner();",
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(VAULT, "secret.mjs"), 'export function secret() {\n\treturn "secret";\n}\n');
	writeFileSync(
		path.join(BASE, "slow", "slow.mjs"),
		[
			'const hold = globalThis[Symbol.for("slothlet.test.reload-window-no-als.hold")];',
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
 * The answers the permission system gives: the host calling `b.secret()`, module `a` calling it through `self`
 * synchronously and after an `await`, and `a` calling its own `a.inner()`.
 * @param {object} api - The instance's api.
 * @returns {Promise<object>} The answers.
 */
async function answers(api) {
	return {
		host: await outcome(() => api.b.secret()),
		sync: await outcome(() => api.a.secretVia()),
		async: await outcome(() => api.a.secretLater()),
		own: await outcome(() => api.a.innerVia())
	};
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
	// Let the reload go on if an assertion fails, so shutdown does not wait on it forever.
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

describe("calls while a reload builds its new copy — no AsyncLocalStorage", () => {
	/**
	 * Make an instance on the fixture, with `vault` mounted at `b`.
	 * @param {object} [config] - More config.
	 * @returns {Promise<object>} The api.
	 */
	async function make(config = {}) {
		const api = await slothlet({ base: BASE, runtime: "live", silent: true, hook: { enabled: true }, ...config });
		await api.slothlet.api.add("b", VAULT, { id: "vault" });
		return api;
	}

	it("a rule added at runtime and the mode the host switched to hold for calls made while the reload builds", async () => {
		const api = await make({ permissions: { mode: "off" } });
		let hold = null;
		try {
			api.slothlet.permissions.control.mode("on");
			api.slothlet.permissions.rules.add({ caller: "a.**", target: "b.secret", effect: "deny" });
			api.slothlet.permissions.control.seal();
			const before = await answers(api);
			expect(before).toEqual({ host: "secret", sync: "PERMISSION_DENIED", async: "PERMISSION_DENIED", own: "inner" });

			hold = await holdReload(api);
			expect(await answers(api)).toEqual(before);
			expect(api.slothlet.permissions.control.mode()).toBe("on");

			hold.release();
			await hold.reloading;
			expect(await answers(api)).toEqual(before);
			expect(api.slothlet.permissions.control.sealed).toBe(true);
		} finally {
			hold?.release();
			await hold?.reloading.catch(() => {});
			await api.slothlet.shutdown();
		}
	});

	it("policy deny with the owner grant and a runtime allow rule answer as before the reload", async () => {
		const api = await make({ permissions: { mode: "on", policy: "deny", owner: true } });
		let hold = null;
		try {
			api.slothlet.permissions.rules.add({ caller: "a.secretLater", target: "b.secret", effect: "allow" });
			const before = await answers(api);
			expect(before).toEqual({ host: "secret", sync: "PERMISSION_DENIED", async: "secret", own: "inner" });
			hold = await holdReload(api);
			expect(await answers(api)).toEqual(before);
			hold.release();
			await hold.reloading;
			expect(await answers(api)).toEqual(before);
		} finally {
			hold?.release();
			await hold?.reloading.catch(() => {});
			await api.slothlet.shutdown();
		}
	});

	it("hooks registered before the reload fire, and metadata reads as before, for calls made while it builds", async () => {
		const api = await make({ permissions: "on" });
		let hold = null;
		try {
			const fired = [];
			api.slothlet.hook.on("a.inner:before", () => {
				fired.push("before");
			});
			api.slothlet.hook.on("a.inner:after", ({ result }) => `${result}!`);
			api.slothlet.metadata.set("a", { team: "core" });
			expect(api.a.innerVia()).toBe("inner!");

			hold = await holdReload(api);
			expect(api.a.innerVia()).toBe("inner!");
			expect(api.slothlet.metadata.get(api.a.inner).team).toBe("core");
			expect(fired).toEqual(["before", "before"]);

			hold.release();
			await hold.reloading;
			expect(api.a.innerVia()).toBe("inner!");
			expect(fired).toEqual(["before", "before", "before"]);
			expect(api.slothlet.metadata.get(api.a.inner).team).toBe("core");
		} finally {
			hold?.release();
			await hold?.reloading.catch(() => {});
			await api.slothlet.shutdown();
		}
	});

	it("a run opened before the reload keeps the copy it had once the reload is done, while the instance moves on", async () => {
		const api = await make({ permissions: { mode: "on" } });
		try {
			const ruleId = api.slothlet.permissions.rules.add({ caller: "a.**", target: "b.secret", effect: "deny" });
			const entered = gate();
			const step = gate();
			const run = api.slothlet.context.run({ user: "alice" }, async () => {
				const before = await outcome(() => api.a.secretVia());
				entered.release();
				await step.promise;
				const after = await outcome(() => api.a.secretVia());
				await null;
				return { before, after, afterAwait: await outcome(() => api.a.secretLater()) };
			});
			await entered.promise;
			await api.slothlet.reload();
			api.slothlet.permissions.rules.remove(ruleId);
			expect(await outcome(() => api.a.secretVia())).toBe("secret");
			step.release();
			expect(await run).toEqual({ before: "PERMISSION_DENIED", after: "PERMISSION_DENIED", afterAwait: "PERMISSION_DENIED" });
			expect(await outcome(() => api.a.secretVia())).toBe("secret");
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
