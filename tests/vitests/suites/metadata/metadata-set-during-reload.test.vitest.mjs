/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/metadata/metadata-set-during-reload.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:06-08:00 (1795869126)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Metadata written while a full reload builds is in the new copy after the swap.
 *
 * @description
 * A full `reload()` answers every call from the copy the instance has until the swap, and a change a call makes
 * meanwhile (`metadata.set()`, `metadata.global()`, `metadata.remove()`) is made to the instance; the new copy takes
 * it at the swap (docs/RELOAD.md). The expected values are what a plain object would hold after the same writes in
 * the same order: a write that returned is kept, a key removed stays removed.
 *
 * Fixture (written at run time): `api/calls/calls.mjs` is a base leaf; `add/gate.mjs` is added at `extra` (`api.extra.gate`) and, on its
 * next load, waits on a gate the test opens, so the reload's replay of that add holds the reload open.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "metadata-set-during-reload");
const BASE = path.join(ROOT, "api");
const ADD = path.join(ROOT, "add");
const GATE = "__slothletMetadataReloadGate";

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(ADD, { recursive: true });
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), `export function ping() {\n\treturn "pong";\n}\n`);
	writeFileSync(
		path.join(ADD, "gate.mjs"),
		`const gate = globalThis.${GATE};\nif (gate) {\n\tgate.started();\n\tawait gate.wait;\n}\nexport function hi() {\n\treturn "hi";\n}\n`
	);
});

afterAll(() => {
	delete globalThis[GATE];
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["none", "on"]) CONFIGS.push({ mode, runtime, permissions });

/**
 * A gate the added module waits on while it loads.
 * @returns {{started: Promise<void>, open: function(): void}} The gate.
 */
function closeGate() {
	let started;
	let open;
	const gate = {
		started: new Promise((resolve) => {
			started = resolve;
		}),
		open: () => open()
	};
	globalThis[GATE] = {
		started: () => started(),
		wait: new Promise((resolve) => {
			open = resolve;
		})
	};
	return gate;
}

describe.each(CONFIGS)(
	"metadata written while a reload builds — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			delete globalThis[GATE];
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the instance, add the gated module, run `before`, start a reload and wait until its replay of that add is
		 * loading.
		 * @param {function(object): (void|Promise<void>)} [before] - Writes made before the reload.
		 * @returns {Promise<{finish: function(): Promise<void>}>} Opens the gate and waits for the reload.
		 */
		async function loadAndStartReload(before = () => {}) {
			delete globalThis[GATE];
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			await api.slothlet.api.add("extra", ADD);
			expect(api.extra.gate.hi()).toBe("hi");
			await before(api);
			const gate = closeGate();
			const reloading = api.slothlet.reload();
			await gate.started;
			return {
				finish: async () => {
					gate.open();
					await reloading;
				}
			};
		}

		it("a path set() made while the reload builds is in the new copy", async () => {
			const reload = await loadAndStartReload();
			api.slothlet.metadata.set("calls", { during: "yes" });
			await reload.finish();
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ during: "yes" });
			expect(api.slothlet.metadata.get("calls")).toMatchObject({ during: "yes" });
		});

		it("keys set before the reload stay, and global, path and node writes made while it builds all land", async () => {
			const reload = await loadAndStartReload((api) => {
				api.slothlet.metadata.set("calls", { before: "yes", changed: "old", gone: "soon" });
				api.slothlet.metadata.global("g0", "yes");
			});
			api.slothlet.metadata.set("calls", "changed", "new");
			api.slothlet.metadata.remove("calls", "gone");
			api.slothlet.metadata.global("g1", "yes");
			api.slothlet.metadata.set(api.calls.ping, "own", "yes");
			api.slothlet.metadata.set("extra", { during: "extra" });
			await reload.finish();
			const meta = api.slothlet.metadata.get(api.calls.ping);
			expect(meta).toMatchObject({ before: "yes", changed: "new", g0: "yes", g1: "yes", own: "yes" });
			expect(meta).not.toHaveProperty("gone");
			expect(api.slothlet.metadata.get(api.extra.gate.hi)).toMatchObject({ during: "extra", g0: "yes", g1: "yes" });
			expect(api.extra.gate.hi()).toBe("hi");
		});

		it("a set and then a remove of the same key while the reload builds leaves the key removed", async () => {
			const reload = await loadAndStartReload();
			api.slothlet.metadata.set("calls", "flip", "on");
			api.slothlet.metadata.remove("calls", "flip");
			api.slothlet.metadata.set(api.calls.ping, "ownFlip", "on");
			api.slothlet.metadata.remove(api.calls.ping, "ownFlip");
			await reload.finish();
			const meta = api.slothlet.metadata.get(api.calls.ping);
			expect(meta).not.toHaveProperty("flip");
			expect(meta).not.toHaveProperty("ownFlip");
		});

		it("a remove of everything on a path while the reload builds, then a set, leaves only the set key", async () => {
			const reload = await loadAndStartReload((api) => api.slothlet.metadata.set("calls", { a: 1, b: 2 }));
			api.slothlet.metadata.remove("calls");
			api.slothlet.metadata.set("calls", "c", 3);
			await reload.finish();
			const meta = api.slothlet.metadata.get("calls");
			expect(meta).toMatchObject({ c: 3 });
			expect(meta).not.toHaveProperty("a");
			expect(meta).not.toHaveProperty("b");
		});

		it("removes by key list, by nested key and of a whole path while the reload builds stay removed", async () => {
			const reload = await loadAndStartReload((api) => {
				api.slothlet.metadata.set("calls", { a: 1, b: 2, keep: 3, nested: { x: 1, y: 2 } });
				api.slothlet.metadata.set("extra", { gone: 1 });
				api.slothlet.metadata.set(api.calls.ping, { own: 1, ownNested: { x: 1, y: 2 } });
			});
			api.slothlet.metadata.remove("calls", ["a", "b"]);
			api.slothlet.metadata.remove(api.calls.ping, { ownNested: ["x"] });
			api.slothlet.metadata.remove(api.calls.ping, ["own"]);
			api.slothlet.metadata.remove("extra");
			await reload.finish();
			const meta = api.slothlet.metadata.get(api.calls.ping);
			expect(meta).toMatchObject({ keep: 3, nested: { x: 1, y: 2 }, ownNested: { y: 2 } });
			expect(meta).not.toHaveProperty("a");
			expect(meta).not.toHaveProperty("b");
			expect(meta).not.toHaveProperty("own");
			expect(meta.ownNested).not.toHaveProperty("x");
			expect(api.slothlet.metadata.get(api.extra.gate.hi)).not.toHaveProperty("gone");
		});

		it("a remove() of a module while the reload builds takes its path metadata with it", async () => {
			const reload = await loadAndStartReload((api) => api.slothlet.metadata.set("extra", { gone: 1 }));
			const removing = api.slothlet.api.remove("extra");
			await reload.finish();
			await removing;
			expect(api.extra).toBeUndefined();
			expect(api.slothlet.metadata.get("extra")).not.toHaveProperty("gone");
		});

		it("a reload after that one keeps what the first carried", async () => {
			const reload = await loadAndStartReload();
			api.slothlet.metadata.set("calls", { during: "yes" });
			await reload.finish();
			delete globalThis[GATE];
			await api.slothlet.reload();
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ during: "yes" });
		});
	}
);
