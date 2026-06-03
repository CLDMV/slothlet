/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-synthetic-leaf.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Synthetic / in-memory leaf support for `api.slothlet.api.add()` (#117).
 *
 * @description
 * `api.add(apiPath, value, options)` accepts inline content in place of a filesystem path:
 *   - a bare **function** → mounts as a single callable leaf at `apiPath`;
 *   - an **object** → its `exports` (or the object itself) supplies the `{ default?, ...named }`
 *     module, mounting multiple leaves inline.
 * No filesystem is touched; the value flows through the same flatten + wrap pipeline a file
 * produces (so `self`/`context`/hooks/permissions wrap identically), the moduleID is auto-generated
 * like a file-path add, and the original value is stored so `reload()` re-applies it (there is no
 * file to re-read) while preserving the wrapper reference. Works in eager and lazy mode.
 *
 * @module tests/vitests/suites/api-manager/api-manager-synthetic-leaf
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";

const DIR = join(process.cwd(), "tmp", "synthetic-leaf-tests");

describe.each([["eager"], ["lazy"]])("synthetic leaf via api.add (#117) — %s mode", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		rmSync(DIR, { recursive: true, force: true });
	});

	async function makeApi() {
		mkdirSync(DIR, { recursive: true });
		writeFileSync(join(DIR, "base.mjs"), `export function base() { return "base"; }\n`);
		return slothlet({ base: DIR, mode, api: { mutations: { add: true, remove: true, reload: true } } });
	}

	it("bare function mounts as a single callable leaf at the apiPath", async () => {
		api = await makeApi();
		const moduleID = await api.slothlet.api.add("synth.greet", (name) => `Hello, ${name}`);
		expect(typeof moduleID).toBe("string");
		expect(moduleID.length).toBeGreaterThan(0); // auto-generated, like a file-path add
		expect(typeof api.synth.greet).toBe("function");
		expect(await api.synth.greet("Nate")).toBe("Hello, Nate");
	});

	it("{ exports } with named exports mounts multiple inline leaves under the apiPath", async () => {
		api = await makeApi();
		await api.slothlet.api.add("tools", { exports: { ping: () => "pong", pong: () => "ping" } });
		expect(await api.tools.ping()).toBe("pong");
		expect(await api.tools.pong()).toBe("ping");
	});

	it("{ exports: { default } } mounts the default as a callable leaf", async () => {
		api = await makeApi();
		await api.slothlet.api.add("synth.echo", { exports: { default: (x) => x } });
		expect(await api.synth.echo(42)).toBe(42);
	});

	it("a plain object (no `exports` wrapper) is treated as the exports map", async () => {
		api = await makeApi();
		await api.slothlet.api.add("util", { upper: (s) => s.toUpperCase() });
		expect(await api.util.upper("hi")).toBe("HI");
	});

	it("rejects a bare function / default-only export at the API root (#136)", async () => {
		api = await makeApi();
		// A bare function (or a default-only export) has no name to land on at the root, so it would
		// flatten to a callable that mounts nothing yet still return a moduleID. Must throw, not no-op.
		await expect(api.slothlet.api.add("", (name) => `Hi ${name}`)).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("", { exports: { default: () => "x" } })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		// Nothing mounted at root beyond the base fixture (no stray success).
		expect(Object.keys(api).filter((k) => !k.startsWith("_"))).toContain("base");
	});

	it("rejects a malformed { exports } wrapper instead of mounting an 'exports' leaf (#136)", async () => {
		api = await makeApi();
		// A wrapper whose `exports` is not a { default?, ...named } map (null, a bare function, or an
		// array) is malformed. Previously these fell through to treating the OUTER object as the map
		// and silently mounted a leaf literally named "exports"; now they throw INVALID_CONFIG.
		await expect(api.slothlet.api.add("bad1", { exports: null })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("bad2", { exports: () => "x" })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("bad3", { exports: [] })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		// Nothing was mounted for the rejected paths (no stray "exports" leaf, no partial mount).
		expect(api.bad1).toBeUndefined();
		expect(api.bad2).toBeUndefined();
		expect(api.bad3).toBeUndefined();
	});

	it("reload(moduleID) re-applies the stored value and preserves the wrapper reference", async () => {
		api = await makeApi();
		const moduleID = await api.slothlet.api.add("synth.greet", (name) => `Hi ${name}`);
		const ref = api.synth.greet;
		expect(await api.synth.greet("A")).toBe("Hi A");

		await api.slothlet.api.reload(moduleID);

		expect(await api.synth.greet("B")).toBe("Hi B"); // still works (no file to re-read)
		expect(api.synth.greet).toBe(ref); // wrapper proxy reference preserved
	});

	it("reload re-applies a multi-export synthetic leaf", async () => {
		api = await makeApi();
		const moduleID = await api.slothlet.api.add("tools", { exports: { ping: () => "pong" } });
		await api.slothlet.api.reload(moduleID);
		expect(await api.tools.ping()).toBe("pong");
	});

	it("accepts a callable default + named exports (flattens exactly as a file would)", async () => {
		api = await makeApi();
		// No special-casing or rejection — synthetic exports flatten through the same pipeline a
		// file's exports do, so this is accepted and mounts (the resulting shape follows slothlet's
		// file flatten rules for a default + named combination).
		const moduleID = await api.slothlet.api.add("svc", { exports: { default: () => "call", info: () => "info" } });
		expect(typeof moduleID).toBe("string");
		expect(api.svc).toBeDefined();
	});

	it("{ exports: { default: object, ...named } } merges named onto the default object", async () => {
		api = await makeApi();
		const moduleID = await api.slothlet.api.add("cfg", { exports: { default: { a: 1 }, b: () => 2 } });
		expect(await api.cfg.a).toBe(1);
		expect(await api.cfg.b()).toBe(2);
		await api.slothlet.api.reload(moduleID);
		expect(await api.cfg.a).toBe(1);
		expect(await api.cfg.b()).toBe(2);
	});

	it("mounts synthetic exports at root (empty apiPath)", async () => {
		api = await makeApi();
		// Root mount: the exports land directly on the api root (like a root folder/file add),
		// not nested under a placeholder.
		await api.slothlet.api.add("", { exports: { rootping: () => "rp", rootpong: () => "rg" } });
		expect(await api.rootping()).toBe("rp");
		expect(await api.rootpong()).toBe("rg");
		expect(api.synthetic).toBeUndefined(); // no placeholder leak
	});

	it("reload re-applies a root synthetic leaf", async () => {
		api = await makeApi();
		const moduleID = await api.slothlet.api.add("", { exports: { rootping: () => "rp" } });
		await api.slothlet.api.reload(moduleID);
		expect(await api.rootping()).toBe("rp");
	});

	it("remove(moduleID) unmounts a synthetic leaf", async () => {
		api = await makeApi();
		const moduleID = await api.slothlet.api.add("synth.greet", () => "x");
		expect(typeof api.synth.greet).toBe("function");
		await api.slothlet.api.remove(moduleID);
		expect(api.synth?.greet).toBeUndefined();
	});
});
