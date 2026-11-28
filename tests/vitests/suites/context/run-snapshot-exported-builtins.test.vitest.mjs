/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/run-snapshot-exported-builtins.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:32-08:00 (1795869092)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A built-in data object a file exports (a `Map`, `Set`, `Date`, typed array, `ArrayBuffer` or
 * `DataView`), as its default export or by name, reads in a run as it was when the run started, when the file's own code
 * or the host changes it after the start, in eager and lazy mode, with either runtime and permissions off or on.
 *
 * @description
 * The expected values are plain JavaScript's: a run reads the value as of its start, and the instance reads it as
 * changed once the run has closed.
 *
 * Fixture (written at run time): one folder per kind and export shape, each with a `change()` export that changes the
 * value through the file's own variable, and `probe/probe.mjs`, which reads a value through its `self` and reports it
 * as plain data.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-exported-builtins");

/**
 * Each kind: how the file makes the value and changes it, the host's change through the node's own method (for a
 * default export), and the value as plain data before and after a change.
 * @type {Array<{kind: string, make: string, change: string, hostChange: ((value: *) => *)|null, before: *, after: *}>}
 */
const KINDS = [
	{
		kind: "map",
		make: 'new Map([["k", 1]])',
		change: 'value.set("k", 2);',
		hostChange: (value) => value.set("k", 2),
		before: [["k", 1]],
		after: [["k", 2]]
	},
	{
		kind: "set",
		make: "new Set([1])",
		change: "value.add(2);",
		hostChange: (value) => value.add(2),
		before: [1],
		after: [1, 2]
	},
	{
		kind: "date",
		make: "new Date(1000)",
		change: "value.setTime(2000);",
		hostChange: (value) => value.setTime(2000),
		before: 1000,
		after: 2000
	},
	{
		kind: "typed",
		make: "new Uint8Array([1, 2])",
		change: "value[0] = 9;",
		hostChange: (value) => value.fill(9, 0, 1),
		before: [1, 2],
		after: [9, 2]
	},
	{
		kind: "buffer",
		make: "new Uint8Array([1, 2]).buffer",
		change: "new Uint8Array(value)[0] = 9;",
		hostChange: null,
		before: [1, 2],
		after: [9, 2]
	},
	{
		kind: "dataview",
		make: "new DataView(new Uint8Array([1, 2]).buffer)",
		change: "value.setUint8(0, 9);",
		hostChange: (value) => value.setUint8(0, 9),
		before: [1, 2],
		after: [9, 2]
	}
];

/** The export shapes: the value as the file's default export, or exported by name as `value`. @type {string[]} */
const SHAPES = ["default", "named"];

/**
 * The folder (and file name) of a kind in an export shape.
 * @param {string} kind - The kind.
 * @param {string} shape - The export shape.
 * @returns {string} The name.
 */
const folderOf = (kind, shape) => `${shape}${kind}`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const { kind, make, change } of KINDS) {
		for (const shape of SHAPES) {
			const name = folderOf(kind, shape);
			mkdirSync(path.join(ROOT, name), { recursive: true });
			const exported = shape === "default" ? "export default value;" : "export { value };";
			writeFileSync(
				path.join(ROOT, name, `${name}.mjs`),
				[`const value = ${make};`, exported, "export function change() {", `\t${change}`, "\treturn true;", "}"].join("\n") + "\n"
			);
		}
	}
	mkdirSync(path.join(ROOT, "probe"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "probe", "probe.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"const PLAIN = {",
			"\tmap: (value) => [...value.entries()],",
			"\tset: (value) => [...value.values()],",
			"\tdate: (value) => value.getTime(),",
			"\ttyped: (value) => [value[0], value[1]],",
			"\tbuffer: (value) => [...new Uint8Array(value.slice(0))],",
			"\tdataview: (value) => [value.getUint8(0), value.getUint8(1)]",
			"};",
			"export function read(kind, name, shape) {",
			'\treturn PLAIN[kind](shape === "default" ? self[name] : self[name].value);',
			"}"
		].join("\n") + "\n"
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["off", "on"]) CONFIGS.push({ mode, runtime, permissions });

const CASES = [];
for (const entry of KINDS) for (const shape of SHAPES) CASES.push({ ...entry, shape });

/**
 * Open a run that reads one value through the probe once told to.
 * @param {object} api - The api.
 * @param {object} kase - The kind and shape read.
 * @returns {{read: function(): Promise<*>}} The run.
 */
function openRun(api, kase) {
	let go;
	const gate = new Promise((resolve) => {
		go = resolve;
	});
	const done = api.slothlet.context.run({}, async () => {
		await gate;
		return api.probe.read(kase.kind, folderOf(kase.kind, kase.shape), kase.shape);
	});
	return {
		read: () => {
			go();
			return done;
		}
	};
}

describe.each(CONFIGS)(
	"an exported built-in reads in a run as of its start — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the fixture with the case's file and the probe loaded, and the value read once by the host and the probe.
		 * @param {object} kase - The kind and shape.
		 * @returns {Promise<object>} The api.
		 */
		async function load(kase) {
			api = await slothlet({
				base: ROOT,
				mode,
				runtime,
				silent: true,
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			const name = folderOf(kase.kind, kase.shape);
			await api[name].change;
			if (kase.shape === "named") await api[name].value;
			await api.probe.read;
			expect(await api.probe.read(kase.kind, name, kase.shape)).toEqual(kase.before);
			return api;
		}

		it.each(CASES)("$kind as the $shape export, changed by the file's code after the start", async (kase) => {
			await load(kase);
			const run = openRun(api, kase);
			expect(await api[folderOf(kase.kind, kase.shape)].change()).toBe(true);
			expect(await run.read()).toEqual(kase.before);
			expect(await api.probe.read(kase.kind, folderOf(kase.kind, kase.shape), kase.shape)).toEqual(kase.after);
		});

		it.each(CASES.filter((kase) => kase.shape === "default" && kase.hostChange !== null))(
			"$kind as the default export, changed by the host through the node's own method after the start",
			async (kase) => {
				await load(kase);
				const run = openRun(api, kase);
				kase.hostChange(api[folderOf(kase.kind, kase.shape)]);
				expect(await run.read()).toEqual(kase.before);
				expect(await api.probe.read(kase.kind, folderOf(kase.kind, kase.shape), kase.shape)).toEqual(kase.after);
			}
		);
	}
);
