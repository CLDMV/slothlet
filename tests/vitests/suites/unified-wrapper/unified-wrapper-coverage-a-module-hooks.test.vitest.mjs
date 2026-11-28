/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-module-hooks.test.vitest.mjs
 *	@Date: 2026-11-25T01:35:07-08:00 (1795599307)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:12-08:00 (1795869192)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hooks a module registers through `self.slothlet.hook` work on the call's values as the hook docs say:
 * an `around` hook forwarding new arguments, changing the arguments in place before `next()`, awaiting an async
 * target's result and returning its own promise, and an `after` hook reading an async target's result — with the
 * permission system on and off.
 *
 * The fixture is written to `tmp/uwa-module-hooks` when the file runs.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "uwa-module-hooks");
const BASE = path.join(ROOT, "api");

const TARGET_SOURCE = `
export function add(a, b) {
	return a + b;
}
export async function slow(a) {
	return { n: a + 1 };
}
export function pair(item) {
	return [item.n, item.n];
}
`;

const HOOKER_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
export const seen = [];
export function install(kind) {
	if (kind === "forward") {
		// New arguments, built from the ones handed over.
		self.slothlet.hook.on("target.add:around", ({ args, next }) => next([args[0] * 10, args[1]]));
	} else if (kind === "inPlace") {
		self.slothlet.hook.on("target.add:around", ({ args, next }) => {
			args[0] = 100;
			return next();
		});
	} else if (kind === "afterReturn") {
		// A change in place the handler makes, with no next() call reaching it first, reaches the call once it returns.
		self.slothlet.hook.on("target.add:before", ({ args }) => {
			args[1] = 1000;
		});
	} else if (kind === "async") {
		self.slothlet.hook.on("target.slow:around", async ({ next }) => {
			const result = await next();
			return { n: result.n * 2 };
		}, { async: true });
	} else if (kind === "promise") {
		self.slothlet.hook.on("target.slow:around", ({ next }) => next().then((result) => ({ n: result.n + 100 })));
	} else if (kind === "after") {
		self.slothlet.hook.on("target.slow:after", ({ result }) => {
			seen.push(result.n);
		});
	} else if (kind === "objectArgs") {
		self.slothlet.hook.on("target.pair:around", ({ args, next }) => next([{ n: args[0].n + 1 }]));
	}
	return kind;
}
export function seenList() {
	return [...seen];
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["target", "hooker"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	writeFileSync(path.join(BASE, "target", "target.mjs"), TARGET_SOURCE);
	writeFileSync(path.join(BASE, "hooker", "hooker.mjs"), HOOKER_SOURCE);
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

describe.each(CONFIGS)("hooks a module registers — $mode / $runtime / permissions $permissions", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet?.shutdown();
		api = null;
	});

	/**
	 * Load the fixture and have the hooker install `kind`.
	 * @param {string} kind - Which hook.
	 * @returns {Promise<object>} The api.
	 */
	async function load(kind) {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			hook: { enabled: true },
			...(permissions === "on" ? { permissions: { rules: [{ caller: "hooker.**", target: "target.**:hook", effect: "allow" }] } } : {})
		});
		expect(await api.hooker.install(kind)).toBe(kind);
		return api;
	}

	it("an around hook forwarding new arguments", async () => {
		await load("forward");
		expect(await api.target.add(2, 3)).toBe(23);
	});

	it("an around hook changing the arguments in place before next()", async () => {
		await load("inPlace");
		expect(await api.target.add(2, 3)).toBe(103);
	});

	it("a before hook changing the arguments in place", async () => {
		await load("afterReturn");
		expect(await api.target.add(2, 3)).toBe(1002);
	});

	it("an async around hook awaiting an async target", async () => {
		await load("async");
		expect(await api.target.slow(1)).toEqual({ n: 4 });
	});

	it("an around hook returning the promise next() gave, changed", async () => {
		await load("promise");
		expect(await api.target.slow(1)).toEqual({ n: 102 });
	});

	it("an after hook reading an async target's result", async () => {
		await load("after");
		expect(await api.target.slow(4)).toEqual({ n: 5 });
		expect(await api.hooker.seenList()).toEqual([5]);
	});

	it("an around hook forwarding an object argument of its own", async () => {
		await load("objectArgs");
		expect(await api.target.pair({ n: 1 })).toEqual([2, 2]);
	});
});
