/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-start-state.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A run reads the instance as of its start in what the instance changes after: an accessor the instance
 * deletes (on the api's root, on a node, on an object a file exports), the order of the root's members, and the
 * attributes of a closed class prototype once a call into its file saved it.
 *
 * @description
 * The expected values are plain JavaScript's: the same reads on the objects as they were when the run started.
 *
 * Fixture (written at run time): `cfg/cfg.mjs` exports an object with an accessor; `klass/klass.mjs` exports a class
 * whose prototype holds a non-configurable member and is closed to new members.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-start-state");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "cfg"), { recursive: true });
	mkdirSync(path.join(ROOT, "klass"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "cfg", "cfg.mjs"),
		[
			"export const data = { n: 1 };",
			'Object.defineProperty(data, "acc", { get() { return 7; }, enumerable: true, configurable: true });',
			"export function ping() {",
			"\treturn 1;",
			"}"
		].join("\n") + "\n"
	);
	writeFileSync(
		path.join(ROOT, "klass", "klass.mjs"),
		[
			"export class K {",
			"\tm() {",
			"\t\treturn 1;",
			"\t}",
			"}",
			'Object.defineProperty(K.prototype, "fixed", { value: 1, writable: false, configurable: false, enumerable: true });',
			"Object.preventExtensions(K.prototype);",
			"export function ping() {",
			"\treturn 1;",
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

describe.each(CONFIGS)(
	"a run reads the instance's state as of its start — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the fixture with both files loaded.
		 * @returns {Promise<object>} The api.
		 */
		async function load() {
			api = await slothlet({
				base: ROOT,
				mode,
				runtime,
				silent: true,
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			await api.cfg.ping();
			await api.klass.ping();
			return api;
		}

		/**
		 * Open a run that reads through its view once before and once after it is told to go on.
		 * @param {function(object): *} first - The first read.
		 * @param {function(object): *} second - The second read.
		 * @returns {function(): Promise<Array<*>>} Lets the run go on and settles with both reads.
		 */
		function openRun(first, second) {
			let go;
			const gate = new Promise((resolve) => {
				go = resolve;
			});
			const done = api.slothlet.context.run.self({}, async (view) => {
				const before = await first(view);
				await gate;
				return [before, await second(view)];
			});
			return () => {
				go();
				return done;
			};
		}

		/**
		 * What a read of an accessor member reports: its value, `in`, whether `Object.keys()` lists it, and its descriptor's kind.
		 * @param {object} holder - What holds it.
		 * @param {string} name - The member.
		 * @returns {Array<*>} The report.
		 */
		const accessorReport = (holder, name) => {
			const described = Object.getOwnPropertyDescriptor(holder, name);
			return [holder[name], name in holder, Object.keys(holder).includes(name), described === undefined ? "none" : typeof described.get];
		};
		const ACCESSOR_AT_START = [7, true, true, "function"];

		it("an accessor the instance deletes from the api's root after the start", async () => {
			await load();
			Object.defineProperty(api, "acc", { get: () => 7, enumerable: true, configurable: true });
			const read = (view) => accessorReport(view, "acc");
			const finish = openRun(read, read);
			delete api.acc;
			expect(await finish()).toEqual([ACCESSOR_AT_START, ACCESSOR_AT_START]);
			expect("acc" in api).toBe(false);
		});

		it("an accessor the instance deletes from a node after the start", async () => {
			await load();
			Object.defineProperty(api.cfg, "acc", { get: () => 7, enumerable: true, configurable: true });
			const read = (view) => accessorReport(view.cfg, "acc");
			const finish = openRun(read, read);
			delete api.cfg.acc;
			expect(await finish()).toEqual([ACCESSOR_AT_START, ACCESSOR_AT_START]);
			expect("acc" in api.cfg).toBe(false);
		});

		it("an accessor the instance deletes from an object a file exports after the start", async () => {
			await load();
			const read = (view) => accessorReport(view.cfg.data, "acc");
			const finish = openRun(read, read);
			delete api.cfg.data.acc;
			expect(await finish()).toEqual([ACCESSOR_AT_START, ACCESSOR_AT_START]);
			expect("acc" in api.cfg.data).toBe(false);
		});

		it("the root's members keep their order as of the start when the instance deletes and adds members", async () => {
			await load();
			api.one = 1;
			api.two = 2;
			const read = (view) => Object.keys(view);
			const finish = openRun(read, read);
			delete api.one;
			api.one = 1;
			api.three = 3;
			const [before, after] = await finish();
			expect(after).toEqual(before);
			expect(before.indexOf("one")).toBeLessThan(before.indexOf("two"));
			expect(Object.keys(api).indexOf("one")).toBeGreaterThan(Object.keys(api).indexOf("two"));
		});

		it("a closed class prototype refuses the same changes before and after a call into its file", async () => {
			await load();
			const read = (view) => {
				const prototype = view.klass.K.prototype;
				return [
					Reflect.defineProperty(prototype, "fixed", { value: 2 }),
					Reflect.set(prototype, "added", 1) && Object.prototype.hasOwnProperty.call(prototype, "added"),
					prototype.fixed
				];
			};
			const finish = openRun(read, async (view) => {
				await view.klass.ping();
				return read(view);
			});
			expect(await finish()).toEqual([
				[false, false, 1],
				[false, false, 1]
			]);
		});
	}
);
