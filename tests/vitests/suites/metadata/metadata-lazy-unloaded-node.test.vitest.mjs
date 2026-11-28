/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/metadata/metadata-lazy-unloaded-node.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:05-08:00 (1795869125)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node has one metadata entry whether or not it has loaded (#918).
 *
 * @description
 * In lazy mode `api.calls.ping` read before `calls` has loaded is a stand-in for the node. Metadata set, read or removed
 * through it is the node's own, the same entry the node has once it loads, as in eager mode: nothing of it lands on the
 * folder `calls` or on a sibling. The expected values are eager mode's, for every case, with no reload, after one, and
 * inside a `run()`.
 *
 * The same holds for a member another module mounts under `calls` with `api.add()` while `calls` has not loaded, from a
 * folder or an inline object: the member is the adding module's node, and its metadata, set through it before or after
 * it is first called, stays its own and lands on neither `calls` nor a sibling. (The add loads `calls` before it places
 * the member, so no stand-in of `calls` names a member of another module.)
 *
 * Fixture (written at run time): `api/calls/calls.mjs` with the leaves `ping` and `other`, and `extra/tools.mjs` with the
 * leaves `hello` and `bye` for the add.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "metadata-lazy-unloaded-node");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		`export function ping() {\n\treturn "pong";\n}\nexport function other() {\n\treturn "other";\n}\n`
	);
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(
		path.join(EXTRA, "tools.mjs"),
		`export function hello() {\n\treturn "hi";\n}\nexport function bye() {\n\treturn "bye";\n}\n`
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["none", "on"]) CONFIGS.push({ mode, runtime, permissions });

describe.each(CONFIGS)(
	"metadata of a node before and after it loads — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Make the instance.
		 * @returns {Promise<object>} The api.
		 */
		async function make() {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			return api;
		}

		/**
		 * In lazy mode, check that `calls` has not loaded yet, so the case runs against the stand-in it is about.
		 * @returns {void}
		 */
		function expectUnloaded() {
			if (mode === "lazy") expect(api.slothlet.node(api.calls.ping).materialized).toBe(false);
		}

		it("metadata set before the node loads is the node's own once it has loaded", async () => {
			await make();
			expectUnloaded();
			api.slothlet.metadata.set(api.calls.ping, { own: 1 });
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ own: 1 });
			expect(await api.calls.ping()).toBe("pong");
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ own: 1 });
			expect(api.slothlet.metadata.get(api.calls.other)).not.toHaveProperty("own");
			expect(api.slothlet.metadata.get("calls")).not.toHaveProperty("own");
			expect(api.slothlet.metadata.get("calls.ping")).toMatchObject({ own: 1 });
		});

		it("metadata set before the node loads is removed by the node after it loads", async () => {
			await make();
			expectUnloaded();
			api.slothlet.metadata.set(api.calls.ping, { own: 1, all: 2 });
			expect(await api.calls.ping()).toBe("pong");
			api.slothlet.metadata.remove(api.calls.ping, "own");
			const meta = api.slothlet.metadata.get(api.calls.ping);
			expect(meta).not.toHaveProperty("own");
			expect(meta).toMatchObject({ all: 2 });
			api.slothlet.metadata.remove(api.calls.ping);
			expect(api.slothlet.metadata.get(api.calls.ping)).not.toHaveProperty("all");
		});

		it("a reference held from before the load reads, sets and removes the node's own metadata after it", async () => {
			await make();
			const held = api.calls.ping;
			expectUnloaded();
			expect(await api.calls.ping()).toBe("pong");
			api.slothlet.metadata.set(api.calls.ping, { own: 1 });
			expect(api.slothlet.metadata.get(held)).toMatchObject({ own: 1 });
			api.slothlet.metadata.set(held, { more: 2 });
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ own: 1, more: 2 });
			api.slothlet.metadata.remove(held, "own");
			expect(api.slothlet.metadata.get(api.calls.ping)).not.toHaveProperty("own");
			expect(api.slothlet.metadata.get(api.calls.other)).not.toHaveProperty("more");
		});

		it("a read before the node loads sees the metadata set on its path", async () => {
			await make();
			expectUnloaded();
			api.slothlet.metadata.set("calls.ping", { onPath: 1 });
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ onPath: 1 });
			expect(await api.calls.ping()).toBe("pong");
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ onPath: 1 });
		});

		it("after a reload, a read before the node loads again sees the node's metadata, and a remove by node takes it", async () => {
			await make();
			expect(await api.calls.ping()).toBe("pong");
			api.slothlet.metadata.set(api.calls.ping, { own: 1 });
			await api.slothlet.reload();
			expectUnloaded();
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ own: 1 });
			expect(api.slothlet.metadata.get(api.calls.other)).not.toHaveProperty("own");
			api.slothlet.metadata.remove(api.calls.ping, "own");
			expect(api.slothlet.metadata.get(api.calls.ping)).not.toHaveProperty("own");
			expect(await api.calls.ping()).toBe("pong");
			expect(api.slothlet.metadata.get(api.calls.ping)).not.toHaveProperty("own");
		});

		it("after a reload, metadata set before the node loads again is the node's own", async () => {
			await make();
			expect(await api.calls.ping()).toBe("pong");
			await api.slothlet.reload();
			expectUnloaded();
			api.slothlet.metadata.set(api.calls.ping, { own: 1 });
			expect(await api.calls.ping()).toBe("pong");
			expect(api.slothlet.metadata.get(api.calls.ping)).toMatchObject({ own: 1 });
			expect(api.slothlet.metadata.get("calls")).not.toHaveProperty("own");
			api.slothlet.metadata.remove(api.calls.ping, "own");
			expect(api.slothlet.metadata.get(api.calls.ping)).not.toHaveProperty("own");
		});

		it("inside a run, the node's metadata is one entry before and after it loads, and stays in the run", async () => {
			await make();
			api.slothlet.metadata.set(api.calls.ping, { host: 1 });
			expectUnloaded();
			const seen = await api.slothlet.context.run({ user: "r" }, async () => {
				const start = api.slothlet.metadata.get(api.calls.ping);
				api.slothlet.metadata.set(api.calls.ping, { own: 1 });
				const unloaded = api.slothlet.metadata.get(api.calls.ping);
				const folder = api.slothlet.metadata.get("calls");
				expect(await api.calls.ping()).toBe("pong");
				const loaded = api.slothlet.metadata.get(api.calls.ping);
				api.slothlet.metadata.remove(api.calls.ping, "host");
				const removed = api.slothlet.metadata.get(api.calls.ping);
				return { start, unloaded, folder, loaded, removed };
			});
			expect(seen.start).toMatchObject({ host: 1 });
			expect(seen.unloaded).toMatchObject({ host: 1, own: 1 });
			expect(seen.folder).not.toHaveProperty("own");
			expect(seen.loaded).toMatchObject({ host: 1, own: 1 });
			expect(seen.removed).toMatchObject({ own: 1 });
			expect(seen.removed).not.toHaveProperty("host");
			// The run's writes stay in the run.
			const outside = api.slothlet.metadata.get(api.calls.ping);
			expect(outside).toMatchObject({ host: 1 });
			expect(outside).not.toHaveProperty("own");
		});
	}
);

/**
 * The members an add mounts under `calls`: how to mount them, the path of one member, how to read it and its sibling, and
 * what calling it returns.
 */
const ADDED = [
	{
		source: "folder",
		mount: (api) => api.slothlet.api.add("calls.extra", EXTRA),
		path: "calls.extra.tools.hello",
		member: (api) => api.calls.extra.tools.hello,
		sibling: (api) => api.calls.extra.tools.bye,
		result: "hi"
	},
	{
		source: "inline object",
		mount: (api) =>
			api.slothlet.api.add("calls.inline", {
				greet() {
					return "hey";
				},
				wave() {
					return "wave";
				}
			}),
		path: "calls.inline.greet",
		member: (api) => api.calls.inline.greet,
		sibling: (api) => api.calls.inline.wave,
		result: "hey"
	}
];

const ADDED_CONFIGS = [];
for (const added of ADDED) for (const config of CONFIGS) ADDED_CONFIGS.push({ ...config, added, source: added.source });

describe.each(ADDED_CONFIGS)(
	"metadata of a member an add mounts under a lazy folder not loaded yet — $source / $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions, added }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Make the instance and mount the added member while `calls` has not loaded.
		 * @returns {Promise<object>} The api.
		 */
		async function make() {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			if (mode === "lazy") expect(api.slothlet.node(api.calls.ping).materialized).toBe(false);
			await added.mount(api);
			return api;
		}

		it("metadata set on the member before its first call is its own after it", async () => {
			await make();
			api.slothlet.metadata.set(added.member(api), { own: 1 });
			expect(api.slothlet.metadata.get(added.member(api))).toMatchObject({ own: 1 });
			expect(await added.member(api)()).toBe(added.result);
			expect(api.slothlet.metadata.get(added.member(api))).toMatchObject({ own: 1 });
			expect(api.slothlet.metadata.get(added.path)).toMatchObject({ own: 1 });
			expect(api.slothlet.metadata.get(added.sibling(api))).not.toHaveProperty("own");
			expect(api.slothlet.metadata.get(api.calls.ping)).not.toHaveProperty("own");
			expect(api.slothlet.metadata.get("calls")).not.toHaveProperty("own");
		});

		it("metadata set on the member before its first call is removed by it after it", async () => {
			await make();
			api.slothlet.metadata.set(added.member(api), { own: 1, all: 2 });
			expect(await added.member(api)()).toBe(added.result);
			api.slothlet.metadata.remove(added.member(api), "own");
			const meta = api.slothlet.metadata.get(added.member(api));
			expect(meta).not.toHaveProperty("own");
			expect(meta).toMatchObject({ all: 2 });
			api.slothlet.metadata.remove(added.member(api));
			expect(api.slothlet.metadata.get(added.member(api))).not.toHaveProperty("all");
		});

		it("a reference held from before the first call sets and removes the member's own metadata after it", async () => {
			await make();
			const held = added.member(api);
			api.slothlet.metadata.set(held, { early: 1 });
			expect(await added.member(api)()).toBe(added.result);
			api.slothlet.metadata.set(added.member(api), { late: 2 });
			expect(api.slothlet.metadata.get(held)).toMatchObject({ early: 1, late: 2 });
			api.slothlet.metadata.remove(held, "late");
			expect(api.slothlet.metadata.get(added.member(api))).not.toHaveProperty("late");
			expect(api.slothlet.metadata.get(added.member(api))).toMatchObject({ early: 1 });
		});

		it("a read before the first call sees the metadata set on the member's path", async () => {
			await make();
			api.slothlet.metadata.set(added.path, { onPath: 1 });
			expect(api.slothlet.metadata.get(added.member(api))).toMatchObject({ onPath: 1 });
			expect(await added.member(api)()).toBe(added.result);
			expect(api.slothlet.metadata.get(added.member(api))).toMatchObject({ onPath: 1 });
		});
	}
);
