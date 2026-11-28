/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/run-snapshot-run-tree-writes.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:33-08:00 (1795869093)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Snapshot consistency across the run's own tree changes: a run that calls `api.slothlet.api.add()` or
 * `remove()` itself gets a tree of its own, and keeps reading every other value as of its start.
 *
 * @description
 * The expected values are plain JavaScript's: what the same reads answer on a copy of the api taken when the run
 * started, plus what the run itself changed (the module it mounted or removed, the members it wrote). A value the host
 * changes before the run's own change or after it reads as it was when the run started, and nothing the run writes
 * (into a module's object, onto the root, into the module it mounted) reaches the instance. A run opened inside reads as
 * of its own start.
 *
 * Each case runs for `run.self()`, `scope({ self: true })` and `run()` (read through a module's `self`).
 *
 * Fixture (written at run time): `api/cfg/cfg.mjs` exports an object and a function; `api/store/store.mjs` exports a
 * `Map`, an array and a function that changes its own object; `api/probe/probe.mjs` reads, writes and changes the tree
 * through `self`; `extra/greet.mjs` is the module the run mounts.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-run-tree-writes");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");

const PROBE_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
export function read() {
	return {
		top: self.top?.a,
		n: self.cfg.data.n,
		deep: self.cfg.data.inner.k,
		extra: "extra" in self,
		hi: typeof self.extra?.greet?.hi === "function" ? self.extra.greet.hi() : null,
		flag: self.extra?.greet?.flag,
		ping: self.cfg.ping()
	};
}
export function write(n) {
	self.top = { a: n };
	self.cfg.data.n = n;
	self.cfg.data.inner.k = n;
}
export function writeMount(n) {
	self.extra.greet.flag = n;
}
export async function add(where) {
	await self.slothlet.api.add("extra", where);
}
export async function remove() {
	await self.slothlet.api.remove("extra");
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "cfg"), { recursive: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(
		path.join(BASE, "cfg", "cfg.mjs"),
		["export const data = { n: 1, inner: { k: 1 } };", "export function ping() {", "\treturn 1;", "}"].join("\n") + "\n"
	);
	writeFileSync(path.join(BASE, "probe", "probe.mjs"), PROBE_SOURCE);
	mkdirSync(path.join(BASE, "store"), { recursive: true });
	writeFileSync(
		path.join(BASE, "store", "store.mjs"),
		[
			"export const state = { n: 1 };",
			'export const map = new Map([["a", 1]]);',
			"export const list = [1];",
			"export function setN(n) {",
			"\tstate.n = n;",
			"}"
		].join("\n") + "\n"
	);
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
 * @param {object} view - The run's view, or the api.
 * @returns {object} The report.
 */
const readView = (view) => ({
	top: view.top?.a,
	n: view.cfg.data.n,
	deep: view.cfg.data.inner.k,
	extra: "extra" in view,
	hi: typeof view.extra?.greet?.hi === "function" ? view.extra.greet.hi() : null,
	flag: view.extra?.greet?.flag,
	ping: view.cfg.ping()
});

/**
 * The report for a tree and values.
 * @param {object} values - The members that differ from the fixture as loaded.
 * @returns {object} The report.
 */
const report = (values) => ({ top: 1, n: 1, deep: 1, extra: false, hi: null, flag: undefined, ping: 1, ...values });

/**
 * A gate the test opens.
 * @returns {{wait: Promise<void>, open: function(): void}} The gate.
 */
const gate = () => {
	let open;
	const wait = new Promise((resolve) => {
		open = resolve;
	});
	return { wait, open };
};

describe.each(CONFIGS)(
	"snapshot consistency across the run's own tree changes — $mode / $runtime / permissions $permissions",
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
			 * Open a run of this kind. It waits for the first gate, then runs `steps` (its own tree change and writes) and
			 * reads; it waits for the second gate and reads again.
			 * @param {object} steps - What the run does after the first gate.
			 * @param {"add"|"remove"|null} [steps.change] - The tree change the run makes.
			 * @param {number|null} [steps.write] - A value the run writes (the root's `top.a`, `cfg.data.n`, `cfg.data.inner.k`).
			 * @param {number|null} [steps.mount] - A value the run writes into the module it mounted.
			 * @returns {{first: function(): void, finish: function(): Promise<Array<object>>, changed: Promise<void>}} Controls.
			 */
			function openRun({ change = null, write = null, mount = null }) {
				const first = gate();
				const second = gate();
				const changed = gate();
				let done;
				if (kind === "run") {
					done = api.slothlet.context.run({}, async () => {
						await first.wait;
						if (change === "add") await api.probe.add(EXTRA);
						if (change === "remove") await api.probe.remove();
						if (write !== null) await api.probe.write(write);
						if (mount !== null) await api.probe.writeMount(mount);
						const before = await api.probe.read();
						changed.open();
						await second.wait;
						return [before, await api.probe.read()];
					});
				} else {
					const fn = async (view) => {
						await first.wait;
						if (change === "add") await view.slothlet.api.add("extra", EXTRA);
						if (change === "remove") await view.slothlet.api.remove("extra");
						if (write !== null) {
							view.top = { a: write };
							view.cfg.data.n = write;
							view.cfg.data.inner.k = write;
						}
						if (mount !== null) view.extra.greet.flag = mount;
						const before = readView(view);
						changed.open();
						await second.wait;
						return [before, readView(view)];
					};
					done = kind === "scope" ? api.slothlet.context.scope({ context: {}, self: true, fn }) : api.slothlet.context.run.self({}, fn);
				}
				return {
					first: first.open,
					changed: changed.wait,
					finish: () => {
						second.open();
						return done;
					}
				};
			}

			/**
			 * Change every value the report reads on the instance.
			 * @param {number} n - The value.
			 * @returns {void}
			 */
			const hostWrites = (n) => {
				api.top = { a: n };
				api.cfg.data.n = n;
				api.cfg.data.inner.k = n;
			};

			it("the run's own add() keeps what the host changed before it as of the run's start", async () => {
				await load();
				const run = openRun({ change: "add" });
				hostWrites(2);
				run.first();
				await run.changed;
				const expected = report({ extra: true, hi: "hi" });
				expect(await run.finish()).toEqual([expected, expected]);
				expect(readView(api)).toEqual(report({ top: 2, n: 2, deep: 2 }));
			});

			it("what the host changes after the run's own add() does not reach the run", async () => {
				await load();
				const run = openRun({ change: "add" });
				run.first();
				await run.changed;
				hostWrites(5);
				const expected = report({ extra: true, hi: "hi" });
				expect(await run.finish()).toEqual([expected, expected]);
				expect(readView(api)).toEqual(report({ top: 5, n: 5, deep: 5 }));
			});

			it("what the run writes after its own add() stays in the run", async () => {
				await load();
				const run = openRun({ change: "add", write: 9, mount: 7 });
				hostWrites(2);
				run.first();
				await run.changed;
				hostWrites(3);
				const expected = report({ top: 9, n: 9, deep: 9, extra: true, hi: "hi", flag: 7 });
				expect(await run.finish()).toEqual([expected, expected]);
				expect(readView(api)).toEqual(report({ top: 3, n: 3, deep: 3 }));
			});

			it("the run's own remove() keeps every other value as of the run's start", async () => {
				await load();
				await api.slothlet.api.add("extra", EXTRA);
				const run = openRun({ change: "remove" });
				hostWrites(2);
				run.first();
				await run.changed;
				hostWrites(5);
				expect(await run.finish()).toEqual([report({}), report({})]);
				expect(readView(api)).toEqual(report({ top: 5, n: 5, deep: 5, extra: true, hi: "hi" }));
			});
		});

		it("a run opened after the outer run's own add() reads as of its own start", async () => {
			await load();
			const first = gate();
			const opened = gate();
			const last = gate();
			const done = api.slothlet.context.run.self({}, async (view) => {
				await first.wait;
				await view.slothlet.api.add("extra", EXTRA);
				view.cfg.data.n = 7;
				const inner = api.slothlet.context.run.self({}, async (nested) => {
					const before = readView(nested);
					opened.open();
					await last.wait;
					return [before, readView(nested)];
				});
				await opened.wait;
				view.cfg.data.n = 8;
				view.cfg.data.inner.k = 8;
				await last.wait;
				return { outer: readView(view), inner: await inner };
			});
			hostWrites(2);
			first.open();
			await opened.wait;
			hostWrites(5);
			last.open();
			const nestedSees = report({ n: 7, extra: true, hi: "hi" });
			expect(await done).toEqual({
				outer: report({ n: 8, deep: 8, extra: true, hi: "hi" }),
				inner: [nestedSees, nestedSees]
			});
			expect(readView(api)).toEqual(report({ top: 5, n: 5, deep: 5 }));

			/**
			 * Change every value the report reads on the instance.
			 * @param {number} n - The value.
			 * @returns {void}
			 */
			function hostWrites(n) {
				api.top = { a: n };
				api.cfg.data.n = n;
				api.cfg.data.inner.k = n;
			}
		});

		/**
		 * What a view reads of the store module.
		 * @param {object} view - The run's view, or the api.
		 * @returns {object} The report.
		 */
		const readStore = (view) => ({ n: view.store.state.n, a: view.store.map.get("a"), list: [...view.store.list], extra: "extra" in view });

		/**
		 * Change the store module on the instance: through the module's own code, the `Map` and the array.
		 * @param {number} n - The value.
		 * @returns {Promise<void>}
		 */
		const hostStore = async (n) => {
			await api.store.setN(n);
			api.store.map.set("a", n);
			api.store.list.push(n);
		};

		it("a built-in, an array and what the module's own code changes read as of the run's start across its own add()", async () => {
			await load();
			await api.store.setN(1);
			const first = gate();
			const added = gate();
			const last = gate();
			const done = api.slothlet.context.run.self({}, async (view) => {
				await first.wait;
				await view.slothlet.api.add("extra", EXTRA);
				const before = readStore(view);
				added.open();
				await last.wait;
				const after = readStore(view);
				view.store.map.set("a", 9);
				view.store.list.push(9);
				return [before, after, readStore(view)];
			});
			await hostStore(2);
			first.open();
			await added.wait;
			await hostStore(5);
			last.open();
			expect(await done).toEqual([
				{ n: 1, a: 1, list: [1], extra: true },
				{ n: 1, a: 1, list: [1], extra: true },
				{ n: 1, a: 9, list: [1, 9], extra: true }
			]);
			expect(readStore(api)).toEqual({ n: 5, a: 5, list: [1, 2, 5], extra: false });
		});

		it("a run opened before the outer run's own add() does not see it, nor what the outer run writes after", async () => {
			await load();
			const opened = gate();
			const last = gate();
			const done = api.slothlet.context.run.self({}, async (view) => {
				const inner = api.slothlet.context.run.self({}, async (nested) => {
					const before = readView(nested);
					opened.open();
					await last.wait;
					return [before, readView(nested)];
				});
				await opened.wait;
				await view.slothlet.api.add("extra", EXTRA);
				view.cfg.data.n = 6;
				view.top = { a: 6 };
				last.open();
				return { outer: readView(view), inner: await inner };
			});
			expect(await done).toEqual({ outer: report({ top: 6, n: 6, extra: true, hi: "hi" }), inner: [report({}), report({})] });
			expect(readView(api)).toEqual(report({}));
		});

		it("a reload() in the run after its own add() rebuilds the run's copy from disk and leaves the instance as it is", async () => {
			await load();
			const first = gate();
			const reloaded = gate();
			const last = gate();
			const done = api.slothlet.context.run.self({}, async (view) => {
				await first.wait;
				await view.slothlet.api.add("extra", EXTRA);
				view.cfg.data.n = 9;
				await view.slothlet.reload();
				// A lazy tree rebuilt from disk loads its files again on first use.
				await view.cfg.ping();
				const before = { n: view.cfg.data.n, hi: await view.extra.greet.hi() };
				reloaded.open();
				await last.wait;
				return [before, { n: view.cfg.data.n, hi: await view.extra.greet.hi() }];
			});
			api.cfg.data.n = 2;
			first.open();
			await reloaded.wait;
			api.cfg.data.n = 5;
			last.open();
			expect(await done).toEqual([
				{ n: 1, hi: "hi" },
				{ n: 1, hi: "hi" }
			]);
			expect(readView(api)).toEqual(report({ n: 5 }));
		});

		it("a restart() in the run after its own add() starts the run's copy over and leaves the instance as it is", async () => {
			await load();
			const first = gate();
			const done = api.slothlet.context.run.self({}, async (view) => {
				await first.wait;
				await view.slothlet.api.add("extra", EXTRA);
				await view.slothlet.restart();
				// A lazy tree rebuilt from the config loads its files again on first use.
				await view.cfg.ping();
				return readView(view);
			});
			api.cfg.data.n = 2;
			first.open();
			const seen = await done;
			expect(seen).toEqual(report({ top: undefined }));
			expect(readView(api)).toEqual(report({ n: 2 }));
		});
	}
);
