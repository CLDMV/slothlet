/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/reload-failed-context.test.vitest.mjs
 *	@Date: 2026-11-17T16:20:23-08:00 (1794961223)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T16:27:24-08:00 (1794961644)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A reload that fails leaves no context store behind. A reload moves the instance to a new ID and sets up
 * that ID's context before any module loads, so after a reload that fails while loading, the instance runs in the new
 * ID's context and the one it ran in before goes. A reload that fails before the new context exists keeps the instance
 * in the old one until a reload succeeds or the instance shuts down. Either way, `run()` stores made before the failure
 * follow the instance, and after any number of failed reloads, a good reload and `shutdown()` the context managers hold
 * what they held before the instance was made.
 *
 * Fixture (written at run time): `ok/ok.mjs` (`ok.who()` → the run's `user`) and `bad/bad.mjs`, which throws on load
 * while `globalThis[FAIL]` is set.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { asyncContextManager, jobHookCount } from "#handlers/context-async";
import { liveContextManager } from "#handlers/context-live";

const ROOT = path.join(process.cwd(), "tmp", "reload-failed-context");
const FAIL = Symbol.for("slothlet.test.reload-failed-context.fail");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "api", "ok"), { recursive: true });
	mkdirSync(path.join(ROOT, "api", "bad"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "api", "ok", "ok.mjs"),
		['import { context } from "@cldmv/slothlet/runtime";', "export function who() {", "\treturn context.user ?? null;", "}", ""].join("\n")
	);
	writeFileSync(
		path.join(ROOT, "api", "bad", "bad.mjs"),
		[
			'if (globalThis[Symbol.for("slothlet.test.reload-failed-context.fail")]) throw new Error("bad.mjs refuses to load");',
			"export function ping() {",
			'\treturn "pong";',
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[FAIL];
});

describe.each([
	["async", asyncContextManager],
	["live", liveContextManager]
])("reload that fails — %s runtime", (runtime, manager) => {
	let api;
	let storesBefore;
	let hooksBefore;

	/**
	 * Make the instance, noting what the managers held before it.
	 * @returns {Promise<void>}
	 */
	async function make() {
		storesBefore = manager.instances.size;
		hooksBefore = jobHookCount();
		api = await slothlet({ base: path.join(ROOT, "api"), runtime, silent: true });
	}

	/**
	 * Run `fn` with `manager.initialize` throwing on its next call, as a reload that fails before the new ID's context
	 * is set up does.
	 * @param {Function} fn - What to run.
	 * @returns {Promise<void>}
	 */
	async function failingInitialize(fn) {
		manager.initialize = function initialize() {
			delete manager.initialize;
			throw new Error("initialize refused");
		};
		try {
			await fn();
		} finally {
			delete manager.initialize;
		}
	}

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it("three reloads failing while loading, then a good one: one store again, and none after shutdown", async () => {
		await make();
		expect(manager.instances.size).toBe(storesBefore + 1);
		globalThis[FAIL] = true;
		for (let k = 0; k < 3; k++) {
			await expect(api.slothlet.reload()).rejects.toThrow();
			expect(manager.instances.size).toBe(storesBefore + 1);
			expect(manager.instances.has(api.slothlet.instance.id)).toBe(true);
		}
		delete globalThis[FAIL];
		await api.slothlet.reload();
		expect(manager.instances.size).toBe(storesBefore + 1);
		expect(api.bad.ping()).toBe("pong");
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});

	it("a run() store made before failed reloads follows the instance to each new ID", async () => {
		await make();
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => {
			const who = [api.ok.who()];
			globalThis[FAIL] = true;
			for (let k = 0; k < 2; k++) {
				await expect(api.slothlet.reload()).rejects.toThrow();
				who.push(api.ok.who());
			}
			delete globalThis[FAIL];
			await api.slothlet.reload();
			who.push(api.ok.who());
			return who;
		});
		expect(seen).toEqual(["alice", "alice", "alice", "alice"]);
		expect(manager.instances.size).toBe(storesBefore + 1);
	});

	it("a reload failing before the new context exists keeps the old one until a good reload replaces it", async () => {
		await make();
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => {
			const first = api.slothlet.instance.id;
			await failingInitialize(() => expect(api.slothlet.reload()).rejects.toThrow("initialize refused"));
			const kept = manager.instances.has(first);
			await api.slothlet.reload();
			return { kept, after: api.ok.who(), gone: !manager.instances.has(first) };
		});
		expect(seen).toEqual({ kept: true, after: "alice", gone: true });
		expect(manager.instances.size).toBe(storesBefore + 1);
	});

	it("a reload failing before the new context exists, then one failing while loading: the first context goes", async () => {
		await make();
		const first = api.slothlet.instance.id;
		await failingInitialize(() => expect(api.slothlet.reload()).rejects.toThrow("initialize refused"));
		globalThis[FAIL] = true;
		await expect(api.slothlet.reload()).rejects.toThrow();
		expect(manager.instances.has(first)).toBe(false);
		expect(manager.instances.size).toBe(storesBefore + 1);
	});

	it("a reload failing before the new context exists, then shutdown: no store is left", async () => {
		await make();
		await failingInitialize(() => expect(api.slothlet.reload()).rejects.toThrow("initialize refused"));
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});

	it("a reload failing before it switches IDs keeps the instance on its ID and context", async () => {
		// Its own fixture folder: the entry below can never be deleted, so a reload of any instance on this folder fails
		// as it clears the CommonJS cache, before it switches IDs.
		const base = path.join(ROOT, `early-${runtime}`, "api");
		mkdirSync(path.join(base, "ok"), { recursive: true });
		writeFileSync(
			path.join(base, "ok", "ok.mjs"),
			'import { context } from "@cldmv/slothlet/runtime";\nexport const who = () => context.user ?? null;\n'
		);
		storesBefore = manager.instances.size;
		hooksBefore = jobHookCount();
		api = await slothlet({ base, runtime, silent: true });
		const require = createRequire(import.meta.url);
		Object.defineProperty(require.cache, path.join(base, "stuck.cjs"), { value: {}, enumerable: true, configurable: false });
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => {
			const first = api.slothlet.instance.id;
			await expect(api.slothlet.reload()).rejects.toThrow(TypeError);
			return { same: api.slothlet.instance.id === first, who: api.ok.who() };
		});
		expect(seen).toEqual({ same: true, who: "alice" });
		expect(manager.instances.size).toBe(storesBefore + 1);
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});
});
