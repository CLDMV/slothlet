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

// Unique per test-run dir so parallel vitest files (and crashed prior runs) never collide on a
// shared on-disk path — matches the repo convention (process.pid + Date.now()).
const DIR = join(process.cwd(), "tmp", `synthetic-leaf-tests-${process.pid}-${Date.now()}`);

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

	it("rejects a malformed { exports } wrapper instead of mounting an 'exports' leaf (#136)", async () => {
		api = await makeApi();
		// A wrapper whose `exports` is not a { default?, ...named } map (null, a bare function, or an
		// array) is malformed. Previously these fell through to treating the OUTER object as the map
		// and silently mounted a leaf literally named "exports"; now they throw INVALID_CONFIG.
		await expect(api.slothlet.api.add("bad1", { exports: null })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("bad2", { exports: () => "x" })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("bad3", { exports: [] })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		// A class instance (Map/Date/…) is not a plain { default?, ...named } map either (#136).
		await expect(api.slothlet.api.add("bad4", { exports: new Map() })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		// Nothing was mounted for the rejected paths (no stray "exports" leaf, no partial mount).
		expect(api.bad1).toBeUndefined();
		expect(api.bad2).toBeUndefined();
		expect(api.bad3).toBeUndefined();
		expect(api.bad4).toBeUndefined();
	});

	it("rejects a non-plain object input (class instance) instead of mounting an empty leaf (#136)", async () => {
		api = await makeApi();
		// A non-array, non-null object that is NOT a plain object (Date/Map/Buffer/TypedArray/class
		// instance) is not a valid { default?, ...named } export map; it previously flowed into the
		// flatten pipeline and produced an empty/odd mount. Now it throws INVALID_CONFIG.
		await expect(api.slothlet.api.add("d", new Date())).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("m", new Map([["a", 1]]))).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		expect(api.d).toBeUndefined();
		expect(api.m).toBeUndefined();
	});

	it("rejects an options-shaped object passed as the 2nd arg instead of mounting option keys (#136)", async () => {
		api = await makeApi();
		// api.add(path, options) is a common slip — the options bag lands in the folderPath slot. When
		// no options are supplied separately and every key is a known option name with no callable leaf,
		// reject rather than silently mounting "moduleID"/"forceOverwrite" as API leaves.
		await expect(api.slothlet.api.add("oops", { moduleID: "x" })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("oops", { moduleID: "x", forceOverwrite: true })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		expect(api.oops).toBeUndefined();
		// Not a false positive: a real export map whose key happens to match an option name but holds a
		// callable leaf still mounts (the call-site mistake never carries functions).
		await api.slothlet.api.add("real", { metadata: () => "m" });
		expect(await api.real.metadata()).toBe("m");
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

	it("a named function at root mounts under its own name; the api root stays an object (#136)", async () => {
		api = await makeApi();
		// At root there is no path segment, so the function's own name is the mount key (api.greet).
		// slothlet does NOT make the api root itself callable — typeof api stays "object".
		await api.slothlet.api.add("", function greet(n) {
			return `Hi ${n}`;
		});
		expect(typeof api).toBe("object");
		expect(typeof api.greet).toBe("function");
		expect(await api.greet("Nate")).toBe("Hi Nate");
	});

	it("{ default: namedFn } at root mounts under the function's name (#136)", async () => {
		api = await makeApi();
		await api.slothlet.api.add("", {
			exports: {
				default: function root() {
					return "R";
				}
			}
		});
		expect(await api.root()).toBe("R");
	});

	it("{ default: namedFn, ...named } at root mounts the default under its name + named exports by key (#136)", async () => {
		api = await makeApi();
		await api.slothlet.api.add("", {
			exports: {
				default: function greet(n) {
					return `Hi ${n}`;
				},
				info: () => "info"
			}
		});
		expect(await api.greet("x")).toBe("Hi x");
		expect(await api.info()).toBe("info");
	});

	it("{ default: object } at root spreads the object's properties onto the root (#136)", async () => {
		api = await makeApi();
		// A non-function default is a namespace, not a callable — its own properties spread onto the
		// root (api.<key>), the same way they'd populate a named mount point.
		await api.slothlet.api.add("", { exports: { default: { a: 1 } } });
		expect(await api.a).toBe(1);
		expect(typeof api).toBe("object");
	});

	it("rejects a root mount that contributes no keys instead of a silent no-op (#136)", async () => {
		api = await makeApi();
		// An empty export map (or a callable default with no named exports) flattens to a value with no
		// enumerable keys, so a root merge would assign nothing while still caching a moduleID. Reject.
		await expect(api.slothlet.api.add("", { exports: {} })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(api.slothlet.api.add("", {})).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		// Root is unchanged — the base leaf is still the only top-level mount.
		expect(Object.keys(api).filter((k) => !k.startsWith("_"))).toContain("base");
	});

	it("rejects a root default function whose name collides with a named export of the same key (#136)", async () => {
		api = await makeApi();
		// At root the default re-keys to its function name; if a named export already claims that key
		// the spread would silently overwrite one with the other. Reject the ambiguous mount instead.
		await expect(
			api.slothlet.api.add("", {
				exports: {
					default: function greet() {
						return "default";
					},
					greet: () => "named"
				}
			})
		).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		expect(api.greet).toBeUndefined();
	});

	it("rejects an unnamed function default at root — no name to mount under (#136)", async () => {
		api = await makeApi();
		// A *function* default has no key at root, so its own name is the mount key — anonymous ones
		// (incl. an arrow whose name is only the inferred "default") must throw, not silently no-op.
		await expect(api.slothlet.api.add("", (n) => `Hi ${n}`)).rejects.toMatchObject({ code: "INVALID_CONFIG" }); // anonymous fn
		await expect(api.slothlet.api.add("", { exports: { default: () => "x" } })).rejects.toMatchObject({ code: "INVALID_CONFIG" }); // arrow → name "default"
		// Root is unchanged (no stray no-op success).
		expect(Object.keys(api).filter((k) => !k.startsWith("_"))).toContain("base");
	});

	it("remove(moduleID) unmounts a synthetic leaf", async () => {
		api = await makeApi();
		const moduleID = await api.slothlet.api.add("synth.greet", () => "x");
		expect(typeof api.synth.greet).toBe("function");
		await api.slothlet.api.remove(moduleID);
		expect(api.synth?.greet).toBeUndefined();
	});
});
