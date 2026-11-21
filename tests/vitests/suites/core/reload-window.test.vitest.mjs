/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/reload-window.test.vitest.mjs
 *	@Date: 2026-11-17T17:01:28-08:00 (1794963688)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T17:17:19-08:00 (1794964639)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview While a full reload builds its new copy, every call is answered by the copy the instance has, with the
 * permission rules, mode, policy and seal, the hooks and the metadata it has; at the swap everything moves to the new
 * copy at once (#899).
 *
 * Fixture (written at run time): `api/a/a.mjs` calls `b.secret()` through `self`, synchronously and after an `await`,
 * and its own `a.inner()`; `vault/secret.mjs`, mounted at `b` with `api.add()` (a module of its own), holds `secret()`;
 * `api/slow/slow.mjs` waits on `globalThis[HOLD]` while it loads, when that is set, so a test holds a reload in the
 * middle of building its new copy.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "reload-window");
const BASE = path.join(ROOT, "api");
const VAULT = path.join(ROOT, "vault");
const HOLD = Symbol.for("slothlet.test.reload-window.hold");

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
			"export function reloadIt() {",
			"\treturn self.slothlet.reload();",
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
			'const hold = globalThis[Symbol.for("slothlet.test.reload-window.hold")];',
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

describe.each([["async"], ["live"]])("calls while a reload builds its new copy — %s runtime", (runtime) => {
	/**
	 * Make an instance on the fixture, with `vault` mounted at `b`.
	 * @param {object} [config] - More config.
	 * @returns {Promise<object>} The api.
	 */
	async function make(config = {}) {
		const api = await slothlet({ base: BASE, runtime, silent: true, hook: { enabled: true }, ...config });
		await api.slothlet.api.add("b", VAULT, { id: "vault" });
		return api;
	}

	it("a rule added at runtime, the mode the host switched to and the seal hold for calls made while the reload builds", async () => {
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
			expect(api.slothlet.permissions.control.sealed).toBe(true);
			expect(await outcome(() => api.slothlet.permissions.rules.add({ caller: "a.**", target: "b.secret", effect: "allow" }))).toBe(
				"PERMISSION_SEALED"
			);

			hold.release();
			await hold.reloading;
			expect(await answers(api)).toEqual(before);
			expect(api.slothlet.permissions.control.mode()).toBe("on");
			expect(api.slothlet.permissions.control.sealed).toBe(true);
		} finally {
			hold?.release();
			await hold?.reloading.catch(() => {});
			await api.slothlet.shutdown();
		}
	});

	it("policy deny with the owner grant answers as before the reload, and a rule added while it builds carries over", async () => {
		const api = await make({ permissions: { mode: "on", policy: "deny", owner: true } });
		let hold = null;
		try {
			const denied = { host: "secret", sync: "PERMISSION_DENIED", async: "PERMISSION_DENIED", own: "inner" };
			const allowed = { host: "secret", sync: "secret", async: "secret", own: "inner" };
			expect(await answers(api)).toEqual(denied);
			const ruleId = api.slothlet.permissions.rules.add({ caller: "a.**", target: "b.secret", effect: "allow" });
			expect(await answers(api)).toEqual(allowed);

			hold = await holdReload(api);
			expect(await answers(api)).toEqual(allowed);
			// A change made while the reload builds is the instance's, and the new copy takes it.
			api.slothlet.permissions.rules.remove(ruleId);
			expect(await answers(api)).toEqual(denied);
			api.slothlet.permissions.rules.add({ caller: "a.secretLater", target: "b.secret", effect: "allow" });
			expect(await answers(api)).toEqual({ ...denied, async: "secret" });

			hold.release();
			await hold.reloading;
			expect(await answers(api)).toEqual({ ...denied, async: "secret" });
		} finally {
			hold?.release();
			await hold?.reloading.catch(() => {});
			await api.slothlet.shutdown();
		}
	});

	describe.each([["none"], ["off"], ["disabled"], ["on"]])("permissions %s", (mode) => {
		it("hooks registered before the reload fire, and metadata reads as before, for calls made while it builds", async () => {
			const api = await make(mode === "none" ? {} : { permissions: mode });
			let hold = null;
			try {
				const fired = [];
				api.slothlet.hook.on("a.inner:before", () => {
					fired.push("before");
				});
				api.slothlet.hook.on("a.inner:after", ({ result }) => `${result}!`);
				api.slothlet.metadata.set("a", { team: "core" });
				expect(api.a.innerVia()).toBe("inner!");
				expect(api.slothlet.metadata.get(api.a.inner).team).toBe("core");
				expect(fired).toEqual(["before"]);

				hold = await holdReload(api);
				expect(api.a.innerVia()).toBe("inner!");
				expect(await api.a.secretLater()).toBe("secret");
				expect(api.slothlet.metadata.get(api.a.inner).team).toBe("core");
				expect(fired).toEqual(["before", "before"]);
				// Registered while the reload builds: the instance's own, and the new copy takes it.
				api.slothlet.hook.on("b.secret:after", ({ result }) => `${result}?`);
				api.slothlet.metadata.set("b", { team: "vault" });
				expect(api.b.secret()).toBe("secret?");

				hold.release();
				await hold.reloading;
				expect(api.a.innerVia()).toBe("inner!");
				expect(fired).toEqual(["before", "before", "before"]);
				expect(api.b.secret()).toBe("secret?");
				expect(api.slothlet.metadata.get(api.a.inner).team).toBe("core");
				expect(api.slothlet.metadata.get(api.b.secret).team).toBe("vault");
			} finally {
				hold?.release();
				await hold?.reloading.catch(() => {});
				await api.slothlet.shutdown();
			}
		});
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
			expect(api.a.innerVia()).toBe("inner");

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

describe.each([["async"], ["live"]])("a reload a module asks for — %s runtime", (runtime) => {
	describe.each([["none"], ["off"], ["disabled"], ["on"]])("permissions %s", (mode) => {
		it("builds the new copy as the host, and the new copy answers", async () => {
			const permissions =
				mode === "none" ? {} : { permissions: { mode, rules: [{ caller: "a.**", target: "slothlet.reload", effect: "allow" }] } };
			const api = await slothlet({ base: BASE, runtime, silent: true, ...permissions });
			try {
				await api.slothlet.api.add("b", VAULT, { id: "vault" });
				const id = api.slothlet.instance.id;
				await api.a.reloadIt();
				expect(api.slothlet.instance.id).not.toBe(id);
				expect(api.a.innerVia()).toBe("inner");
				expect(api.b.secret()).toBe("secret");
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
