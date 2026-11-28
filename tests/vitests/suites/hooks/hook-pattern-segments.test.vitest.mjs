/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/hooks/hook-pattern-segments.test.vitest.mjs
 *	@Date: 2026-11-25T09:00:00-08:00 (1795626000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:53-08:00 (1795869113)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hook patterns naming a segment no api path can hold (`__proto__`, `constructor`, `prototype`) are
 * refused wherever a pattern is taken, and ordinary names such as `toString` and `valueOf` still work.
 *
 * @description
 * Covers `hook.on`, a pattern given through `options.pattern`, `remove`, `enable`, `disable`, `list`,
 * `hook.pattern.enable` / `disable`, the configured `hook.pattern`, and the same calls made from module code.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const DIR = join(process.cwd(), "tmp", "hook-pattern-segments-fixture");

const REFUSED = [
	["__proto__:before", "__proto__"],
	["db.constructor:before", "constructor"],
	["x.prototype.y:after", "prototype"],
	["*.constructor:before", "constructor"],
	["**.prototype:around", "prototype"],
	["{a,constructor}.x:before", "constructor"],
	["!*.__proto__:before", "__proto__"]
];
const BARE = ["__proto__", "db.constructor", "x.prototype.y", "*.constructor", "{a,constructor}.x", "!*.__proto__"];

beforeAll(() => {
	mkdirSync(join(DIR, "util"), { recursive: true });
	writeFileSync(join(DIR, "util", "toString.mjs"), `export function toString() { return "ts"; }\n`);
	writeFileSync(join(DIR, "util", "valueOf.mjs"), `export function valueOf() { return "vo"; }\n`);
	writeFileSync(
		join(DIR, "mod.mjs"),
		`import { self } from "@cldmv/slothlet/runtime";
export function on(typePattern) { return self.slothlet.hook.on(typePattern, () => {}); }
export function act(verb, arg) { return self.slothlet.hook[verb](arg); }
export function patternAct(verb, arg) { return self.slothlet.hook.pattern[verb](arg); }
`
	);
});

afterAll(() => {
	rmSync(DIR, { recursive: true, force: true });
});

const refused = (fn, segment) => {
	let error;
	try {
		fn();
	} catch (err) {
		error = err;
	}
	expect(error?.code).toBe("API_PATH_INVALID");
	expect(error.details.segment).toBe(segment);
};

describe.each(getMatrixConfigs())("hook patterns naming a segment no api path can hold > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const start = async (extra = {}) => {
		api = await slothlet({ ...config, base: DIR, silent: true, hook: true, ...extra });
	};

	it.each(REFUSED)("hook.on(%j) throws and registers nothing", async (typePattern, segment) => {
		await start();
		refused(() => api.slothlet.hook.on(typePattern, () => {}), segment);
		expect(api.slothlet.hook.list().registeredHooks).toEqual([]);
	});

	it("a pattern given through options.pattern is refused too", async () => {
		await start();
		refused(() => api.slothlet.hook.on("util.toString:before", () => {}, { pattern: "util.constructor" }), "constructor");
		expect(api.slothlet.hook.list().registeredHooks).toEqual([]);
	});

	it.each(BARE)("remove, enable, disable and list refuse the pattern %j", async (pattern) => {
		await start();
		const segment = ["__proto__", "constructor", "prototype"].find((s) => pattern.includes(s));
		refused(() => api.slothlet.hook.remove({ pattern }), segment);
		refused(() => api.slothlet.hook.enable({ pattern }), segment);
		refused(() => api.slothlet.hook.disable({ pattern }), segment);
		refused(() => api.slothlet.hook.enable(pattern), segment);
		refused(() => api.slothlet.hook.disable(pattern), segment);
		refused(() => api.slothlet.hook.list({ pattern }), segment);
		refused(() => api.slothlet.hook.list(pattern), segment);
		refused(() => api.slothlet.hook.off({ pattern }), segment);
		refused(() => api.slothlet.hook.pattern.enable(pattern), segment);
		refused(() => api.slothlet.hook.pattern.disable(pattern), segment);
	});

	it("a configured hook.pattern naming such a segment is refused at startup", async () => {
		await expect(
			slothlet({ ...config, base: DIR, silent: true, hook: { enabled: true, pattern: "db.constructor" } })
		).rejects.toMatchObject({
			code: "API_PATH_INVALID"
		});
	});

	it("a version-dispatched registration is refused before any member registers", async () => {
		await start();
		refused(() => api.slothlet.hook.on("util.constructor:before", () => {}, { versioning: { enabled: true } }), "constructor");
		expect(api.slothlet.hook.list().registeredHooks).toEqual([]);
	});

	it("module code is refused the same way", async () => {
		await start();
		refused(() => api.mod.on("util.constructor:before"), "constructor");
		refused(() => api.mod.on("*.__proto__:after"), "__proto__");
		refused(() => api.mod.act("remove", { pattern: "x.prototype" }), "prototype");
		refused(() => api.mod.act("list", { pattern: "x.prototype" }), "prototype");
		refused(() => api.mod.act("enable", { pattern: "x.prototype" }), "prototype");
		refused(() => api.mod.act("disable", { pattern: "x.prototype" }), "prototype");
		refused(() => api.mod.patternAct("enable", "x.prototype"), "prototype");
		refused(() => api.mod.patternAct("disable", "x.prototype"), "prototype");
		expect(api.slothlet.hook.list().registeredHooks).toEqual([]);
	});

	it.each(["toString", "valueOf"])("a pattern on a leaf named %s registers, lists, fires and removes", async (name) => {
		await start();
		const seen = [];
		const id = api.slothlet.hook.on(`util.${name}:before`, () => {
			seen.push(name);
		});
		expect(api.slothlet.hook.list({ pattern: `util.${name}` }).registeredHooks.map((h) => h.id)).toEqual([id]);
		expect(await api.util[name]()).toBe(name === "toString" ? "ts" : "vo");
		expect(seen).toEqual([name]);
		expect(api.slothlet.hook.disable({ pattern: `util.${name}` })).toBe(1);
		expect(api.slothlet.hook.enable({ pattern: `util.${name}` })).toBe(1);
		expect(api.slothlet.hook.remove({ pattern: `util.${name}` })).toBe(1);
		expect(api.slothlet.hook.list().registeredHooks).toEqual([]);
	});

	it("module code can still register a pattern on a toString leaf", async () => {
		await start();
		const id = api.mod.on("util.toString:before");
		expect(api.slothlet.hook.list({ id }).registeredHooks).toHaveLength(1);
	});

	it("a global path filter on a toString leaf is accepted", async () => {
		await start();
		expect(api.slothlet.hook.pattern.enable("util.toString")).toBe(1);
		expect(api.slothlet.hook.pattern.disable("util.toString")).toBe(0);
	});
});
