/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/internal-exports.test.vitest.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794675600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Slothlet's internal exports answer slothlet's own files and the host only: code of a module that comes
 * to hold one (the host leaves it on `globalThis` or passes it in; in a browser, an import by its URL) is refused
 * whenever it uses it, however it calls it.
 *
 * @description
 * Fixture `api_test_internal_exports`. The host imports every export of slothlet's files that hands out a live internal
 * or changes slothlet's state (`table.mjs`), and leaves them on `globalThis`. The api file `held.mjs` uses each of them:
 * a function called, a class constructed, an object read. Three of them are also used every other way code can call a
 * function (`call`, `apply`, `bind`, `Reflect.apply`, as a built-in's callback, from a promise job, from `eval` and
 * `new Function`, handed to slothlet's own `context.run`, passed in as an argument). Every use is refused with
 * MODULE_INTERNAL_NOT_IMPORTABLE; the host's own use of each works, as do the host's calls through built-ins and through
 * slothlet's `context.run`. Each file's `internals` gave its bindings to slothlet's own files as they loaded, and
 * answers nobody after.
 *
 * Run in this process (vitest's runner) and in a child process under Node's own loader alone.
 *
 * @module tests/vitests/suites/isolation/internal-exports
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import {
	API_DIR,
	EXPORTS,
	SHAPES,
	SHAPE_KEYS,
	codeOf,
	collect,
	holdAll,
	hostUse
} from "../../../../api_tests/api_test_internal_exports/table.mjs";

const REFUSED = "MODULE_INTERNAL_NOT_IMPORTABLE";
const PROBE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_internal_exports/probe.mjs");

const MATRIX = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const permissions of ["off", "precise", "fast"])
			MATRIX.push({ name: `${mode}/${runtime} permissions ${permissions}`, mode, runtime, permissions });

/**
 * The options for one configuration.
 * @param {{mode: string, runtime: string, permissions: string}} config - The configuration.
 * @returns {object} The options.
 */
const options = ({ mode, runtime, permissions }) => ({
	base: API_DIR,
	mode,
	runtime,
	silent: true,
	...(permissions === "off" ? {} : { permissions: { defaultPolicy: "allow", attribution: permissions } })
});

/**
 * Every key the rows are expected to cover: each export, each file's `internals`, and the shape exports in each shape.
 * @param {Record<string, *>} held - The held exports.
 * @returns {Array<[string, string]>} `[key, shape]` pairs.
 */
const expectedKeys = (held) => [
	...Object.keys(held).map((key) => [key, "direct"]),
	...SHAPE_KEYS.flatMap((key) => SHAPES.map((shape) => [key, shape])),
	...SHAPE_KEYS.map((key) => [key, "argument"])
];

let held;

beforeAll(async () => {
	held = await holdAll();
});

describe("Isolation > slothlet's internal exports > the list", () => {
	it("holds every listed export, and no file exports the markers kept to slothlet's own files", async () => {
		for (const [specifier, names] of Object.entries(EXPORTS))
			for (const name of names) expect([specifier, name, held[`${specifier}:${name}`] === undefined]).toEqual([specifier, name, false]);
		const trustedRoot = await import("#handlers/trusted-root");
		expect(["TRUSTED_ROOT" in trustedRoot, "PROTECT_SENTINEL" in trustedRoot]).toEqual([false, false]);
	});
});

describe.each(MATRIX)("Isolation > slothlet's internal exports answer slothlet and the host only > $name", (config) => {
	let api;
	let rows;

	beforeAll(async () => {
		api = await slothlet(options(config));
		rows = await collect(api, held);
	}, 120000);

	afterAll(async () => {
		await api?.shutdown();
	});

	it("refuses a module's every use of every export", () => {
		expect(rows.map((row) => [row.key, row.shape])).toEqual(expectedKeys(held));
		expect(rows.map((row) => [row.key, row.shape, row.outcome])).toEqual(rows.map((row) => [row.key, row.shape, REFUSED]));
	});

	it("answers the host's use of every export, directly, through a built-in and through slothlet's context.run", async () => {
		expect(Object.entries(held).map(([key, value]) => [key, hostUse(value)])).toEqual(Object.keys(held).map((key) => [key, "used"]));
		const resolveWrapper = held["#handlers/unified-wrapper:resolveWrapper"];
		expect(resolveWrapper(api.held)).not.toBeNull();
		expect([api.held].map(resolveWrapper)[0]).toBe(resolveWrapper(api.held));
		expect(await api.slothlet.context.run({}, resolveWrapper, api.held)).toBe(resolveWrapper(api.held));
		const manager = held["#factories/context:getContextManager"](config.runtime);
		expect(manager).toBe(held[`#factories/context:${config.runtime === "live" ? "liveRuntime" : "asyncRuntime"}`]);
		expect(manager.instances.has(api.slothlet.instanceID)).toBe(true);
	});

	it("refuses a module the static functions of the wrapper class, held or imported by package path or by file URL", async () => {
		const key = "#handlers/unified-wrapper:UnifiedWrapper";
		const fileURL = new URL("../../../../src/lib/handlers/unified-wrapper.mjs", import.meta.url).href;
		for (const name of ["_recordSourceFile", "_extractFullImpl", "_memberNode", "_staysValue"]) {
			// The host reaches the function; it is slothlet's own (the builders call it).
			expect([name, typeof held[key][name]]).toEqual([name, "function"]);
			expect([name, "held", await api.held.useStatic(key, name)]).toEqual([name, "held", REFUSED]);
			expect([name, "package path", await api.held.importStatic("#handlers/unified-wrapper", "UnifiedWrapper", name)]).toEqual([
				name,
				"package path",
				REFUSED
			]);
			expect([name, "file URL", await api.held.importStatic(fileURL, "UnifiedWrapper", name)]).toEqual([name, "file URL", REFUSED]);
		}
	});

	it("gives no file's internal bindings to anyone once slothlet's own files have taken them", () => {
		for (const key of Object.keys(held).filter((key) => key.endsWith(":internals"))) {
			let outcome;
			try {
				held[key]("lib/builders/api_builder");
				outcome = "given";
			} catch (error) {
				outcome = codeOf(error);
			}
			expect([key, outcome]).toEqual([key, REFUSED]);
		}
	});
});

describe("Isolation > slothlet's internal exports answer slothlet and the host only > under Node's own loader", () => {
	it("refuses a module's every use in every mode and runtime, and answers the host's, as in this process", () => {
		const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions="));
		const result = spawnSync(process.execPath, [...conditions, PROBE], { encoding: "utf8", timeout: 240000 });
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		expect(Object.keys(out).sort()).toEqual(["eager/async", "eager/live", "host", "lazy/async", "lazy/live"]);
		for (const name of ["eager/async", "eager/live", "lazy/async", "lazy/live"]) {
			expect(out[name].map((row) => [name, row.key, row.shape])).toEqual(expectedKeys(held).map(([key, shape]) => [name, key, shape]));
			expect(out[name].map((row) => [name, row.key, row.shape, row.outcome])).toEqual(
				out[name].map((row) => [name, row.key, row.shape, REFUSED])
			);
		}
		expect(out.host.map((row) => [row.key, row.outcome])).toEqual(out.host.map((row) => [row.key, "used"]));
	});
});
