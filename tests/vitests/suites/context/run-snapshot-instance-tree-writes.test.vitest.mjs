/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-instance-tree-writes.test.vitest.mjs
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
 * @fileoverview Snapshot consistency across the instance's own tree changes: a run open while the host calls
 * `api.slothlet.api.add()`, `remove()`, `reload(path)` or `restart()` keeps reading the tree and the values it started
 * with.
 *
 * @description
 * The expected values are plain JavaScript's: what the same reads answer on a copy of the api taken when the run
 * started, plus what the run itself wrote. A module the host mounts after the start is not in that copy, one it removes
 * still is (and still answers calls), a member the host set before the start keeps the value it had then, and a value
 * the host changes after the start (before or after the tree change) reads as it was. A run opened after the change
 * reads the changed tree. A nested run reads as of its own start.
 *
 * Each case runs for `run.self()`, `scope({ self: true })` and `run()` (read through a module's `self`).
 *
 * Fixture (written at run time): `api/cfg/cfg.mjs` exports an object and a function; `api/probe/probe.mjs` reads and
 * writes through `self`; `extra/greet.mjs` is the module the host mounts.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-instance-tree-writes");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");

const PROBE_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
export function read() {
	return {
		top: self.top?.a,
		n: self.cfg.data.n,
		extra: "extra" in self,
		hi: typeof self.extra?.greet?.hi === "function" ? self.extra.greet.hi() : null,
		sub: "sub" in self.cfg,
		x: "x" in self.cfg,
		ping: self.cfg.ping()
	};
}
export function write(n) {
	self.top = { a: n };
	self.cfg.data.n = n;
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "cfg"), { recursive: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(
		path.join(BASE, "cfg", "cfg.mjs"),
		["export const data = { n: 1 };", "export function ping() {", "\treturn 1;", "}"].join("\n") + "\n"
	);
	writeFileSync(path.join(BASE, "probe", "probe.mjs"), PROBE_SOURCE);
	writeFileSync(path.join(EXTRA, "greet.mjs"), ["export function hi() {", '\treturn "hi";', "}"].join("\n") + "\n");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["off", "on"]) CONFIGS.push({ mode, runtime, permissions });

const KINDS = ["run.self", "scope", "run"];

/**
 * What a view reads: the same report the probe module makes through `self`.
 * @param {object} view - The run's view.
 * @returns {object} The report.
 */
const readView = (view) => ({
	top: view.top?.a,
	n: view.cfg.data.n,
	extra: "extra" in view,
	hi: typeof view.extra?.greet?.hi === "function" ? view.extra.greet.hi() : null,
	sub: "sub" in view.cfg,
	x: "x" in view.cfg,
	ping: view.cfg.ping()
});

/**
 * The report for a tree and values.
 * @param {object} values - The members that differ from the fixture as loaded.
 * @returns {object} The report.
 */
const report = (values) => ({ top: 1, n: 1, extra: false, hi: null, sub: false, x: false, ping: 1, ...values });

describe.each(CONFIGS)(
	"snapshot consistency across the instance's tree changes — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the fixture with every file loaded and a member the host set on the root.
		 * @returns {Promise<object>} The api.
		 */
		async function load() {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			await api.cfg.ping();
			await api.probe.read();
			api.top = { a: 1 };
			return api;
		}

		describe.each(KINDS)("%s", (kind) => {
			/**
			 * Open a run of this kind that reads once (after `before`, which writes in the run) and again once it is told to go on.
			 * @param {number|null} [write=null] - A value the run writes (the root's `top.a` and `cfg.data.n`) before its first read.
			 * @returns {function(): Promise<Array<object>>} Lets the run go on and settles with both reads.
			 */
			function openRun(write = null) {
				let go;
				const gate = new Promise((resolve) => {
					go = resolve;
				});
				let done;
				if (kind === "run") {
					done = api.slothlet.context.run({}, async () => {
						if (write !== null) await api.probe.write(write);
						const before = await api.probe.read();
						await gate;
						return [before, await api.probe.read()];
					});
				} else {
					const fn = async (view) => {
						if (write !== null) {
							view.top = { a: write };
							view.cfg.data.n = write;
						}
						const before = readView(view);
						await gate;
						return [before, readView(view)];
					};
					done = kind === "scope" ? api.slothlet.context.scope({ context: {}, self: true, fn }) : api.slothlet.context.run.self({}, fn);
				}
				return () => {
					go();
					return done;
				};
			}

			it("a host add() leaves the open run on the tree and the values it started with", async () => {
				await load();
				const finish = openRun();
				api.top = { a: 2 };
				api.cfg.data.n = 2;
				await api.slothlet.api.add("extra", EXTRA);
				api.top = { a: 3 };
				api.cfg.data.n = 3;
				expect(await finish()).toEqual([report({}), report({})]);
				expect(readView(api)).toEqual(report({ top: 3, n: 3, extra: true, hi: "hi" }));
			});

			it("a run opened after the add reads the added module", async () => {
				await load();
				await api.slothlet.api.add("extra", EXTRA);
				const finish = openRun();
				expect(await finish()).toEqual([report({ extra: true, hi: "hi" }), report({ extra: true, hi: "hi" })]);
			});

			it("an add() into a loaded namespace and a later host write to it do not reach the open run", async () => {
				await load();
				const finish = openRun();
				await api.slothlet.api.add("cfg.sub", EXTRA);
				api.cfg.x = 1;
				expect(await finish()).toEqual([report({}), report({})]);
				expect(readView(api)).toEqual(report({ sub: true, x: true }));
			});

			it("a host remove() leaves the removed module readable and callable in the open run", async () => {
				await load();
				await api.slothlet.api.add("extra", EXTRA);
				const finish = openRun();
				await api.slothlet.api.remove("extra");
				api.cfg.data.n = 4;
				expect(await finish()).toEqual([report({ extra: true, hi: "hi" }), report({ extra: true, hi: "hi" })]);
				expect(readView(api)).toEqual(report({ n: 4 }));
			});

			it("what the run writes stays in the run across a host add()", async () => {
				await load();
				const finish = openRun(9);
				api.top = { a: 2 };
				await api.slothlet.api.add("extra", EXTRA);
				api.cfg.data.n = 3;
				expect(await finish()).toEqual([report({ top: 9, n: 9 }), report({ top: 9, n: 9 })]);
				expect(readView(api)).toEqual(report({ top: 2, n: 3, extra: true, hi: "hi" }));
			});

			it("a host reload(path) leaves the open run on the values it started with", async () => {
				await load();
				const finish = openRun();
				api.top = { a: 2 };
				api.cfg.data.n = 2;
				await api.slothlet.api.reload("cfg");
				api.top = { a: 3 };
				expect(await finish()).toEqual([report({}), report({})]);
			});

			it("a host restart() leaves the open run on the tree and the values it started with", async () => {
				await load();
				const finish = openRun();
				api.top = { a: 2 };
				api.cfg.data.n = 2;
				await api.slothlet.restart();
				expect(await finish()).toEqual([report({}), report({})]);
				expect("top" in api).toBe(false);
			});
		});

		it("a nested run reads as of its own start across a host add()", async () => {
			await load();
			let go;
			const gate = new Promise((resolve) => {
				go = resolve;
			});
			let opened;
			const nestedOpen = new Promise((resolve) => {
				opened = resolve;
			});
			const done = api.slothlet.context.run.self({}, async (view) => {
				view.cfg.data.n = 3;
				const inner = api.slothlet.context.run.self({}, async (nested) => {
					const before = readView(nested);
					opened();
					await gate;
					return [before, readView(nested)];
				});
				await nestedOpen;
				view.top = { a: 4 };
				view.cfg.data.n = 4;
				await gate;
				const late = await api.slothlet.context.run.self({}, async (nested) => readView(nested));
				return { outer: readView(view), inner: await inner, late };
			});
			await nestedOpen;
			api.top = { a: 2 };
			api.cfg.data.n = 2;
			await api.slothlet.api.add("extra", EXTRA);
			api.cfg.data.n = 5;
			go();
			expect(await done).toEqual({
				outer: report({ top: 4, n: 4 }),
				inner: [report({ n: 3 }), report({ n: 3 })],
				late: report({ top: 4, n: 4 })
			});
		});
	}
);
