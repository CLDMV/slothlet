/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/method-options-unknown-key.test.vitest.mjs
 *	@Date: 2026-11-16T19:29:30-08:00 (1794886170)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T19:29:30-08:00 (1794886170)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The options object of every `api.slothlet.*` method (and `generate()` from `@cldmv/slothlet/typegen`) is
 * checked against the method's own schema: a key the method does not take, a v3 option name or a typo, is refused with
 * INVALID_CONFIG_UNKNOWN_KEY naming the method as `where`. The v4 option names take effect.
 * @module tests/vitests/suites/config/method-options-unknown-key
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { generate } from "@cldmv/slothlet/typegen";
import { METHOD_OPTION_SCHEMAS } from "#helpers/config-schema";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;
const ADD_DIR = TEST_DIRS.API_TEST_MIXED;

/**
 * Run `fn` and return what it threw (or rejected with).
 * @param {function(): *} fn - The call.
 * @returns {Promise<*>} The error, or undefined.
 */
async function caught(fn) {
	try {
		await withSuppressedSlothletErrorOutput(fn);
	} catch (error) {
		return error;
	}
	return undefined;
}

describe.each(["eager", "lazy"])("method options > unknown keys (%s)", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const boot = async (extra = {}) => {
		api = await slothlet({ base: BASE, mode, silent: true, hook: true, api: { mutations: { reload: true } }, ...extra });
		return api;
	};

	it.each([
		["api.add", "collisionMode", (a) => a.slothlet.api.add("ext", ADD_DIR, { collisionMode: "merge" }), "slothlet.api.add"],
		[
			"api.add (nested)",
			"collision.force2",
			(a) => a.slothlet.api.add("ext", ADD_DIR, { collision: { force2: true } }),
			"slothlet.api.add"
		],
		[
			"api.add (inline siblings)",
			"moduleID",
			(a) => a.slothlet.api.add("ext", { exports: { x: () => 1 }, moduleID: "m" }),
			"slothlet.api.add"
		],
		["api.add (version)", "version.version", (a) => a.slothlet.api.add("ext", ADD_DIR, { version: { version: "v1" } }), "slothlet.api.add"],
		["api.leaves", "includePrivate", (a) => a.slothlet.api.leaves(".", { includePrivate: true }), "slothlet.api.leaves"],
		["api.reload", "keep", (a) => a.slothlet.api.reload(".", { keep: true }), "slothlet.api.reload"],
		["api.modules.discover", "scanRoot", (a) => a.slothlet.api.modules.discover({ scanRoot: "." }), "slothlet.api.modules.discover"],
		[
			"api.modules.addModules",
			"onFailure",
			(a) => a.slothlet.api.modules.addModules([], { onFailure: "throw" }),
			"slothlet.api.modules.addModules"
		],
		[
			"api.modules.addDiscovered",
			"scanRoot",
			(a) => a.slothlet.api.modules.addDiscovered({ scanRoot: "." }),
			"slothlet.api.modules.addDiscovered"
		],
		["reload", "keepInstanceID", (a) => a.slothlet.reload({ keepInstanceID: true }), "slothlet.reload"],
		["hook.on", "lockCaller", (a) => a.slothlet.hook.on("math.*:before", () => {}, { lockCaller: false }), "slothlet.hook.on"],
		[
			"hook.on (versioning)",
			"versioning.versioned",
			(a) => a.slothlet.hook.on("math.*:before", () => {}, { versioning: { versioned: true } }),
			"slothlet.hook.on"
		],
		["hook.list", "kind", (a) => a.slothlet.hook.list({ kind: "before" }), "slothlet.hook.list"],
		[
			"permissions.principal.register",
			"maxAge",
			(a) => a.slothlet.permissions.principal.register("roles", { key: () => 1, resolve: () => 1, maxAge: 5 }),
			"slothlet.permissions.principal.register"
		],
		["event.on", "priority", (a) => a.slothlet.event.on("x", () => {}, { priority: 1 }), "slothlet.event.on"],
		["context.scope", "ctx", (a) => a.slothlet.context.scope({ context: {}, fn: () => 1, ctx: {} }), "slothlet.context.scope"]
	])("%s refuses %s", async (_label, key, call, where) => {
		const instance = await boot();
		const error = await caught(() => call(instance));
		expect(error?.code).toBe("INVALID_CONFIG_UNKNOWN_KEY");
		expect(error.context).toMatchObject({ where, key });
	});

	it("api.add refuses a fourth argument", async () => {
		const instance = await boot();
		const error = await caught(() => instance.slothlet.api.add("ext", ADD_DIR, {}, { version: "v1" }));
		expect(error?.code).toBe("INVALID_ARGUMENT");
	});

	it("api.add takes id, collision (or its mode as a string) and version", async () => {
		const instance = await boot({ api: { collision: { override: true }, mutations: { reload: true } } });
		expect(await instance.slothlet.api.add("ext", ADD_DIR, { id: "ext-mod", collision: "merge" })).toBe("ext-mod");
		expect(await instance.slothlet.api.add("ver", ADD_DIR, { id: "ver-v1", version: { tag: "v1", default: true } })).toBe("ver-v1");
		expect(instance.slothlet.versioning.list("ver")?.default).toBe("v1");
	});

	it('reload takes instance: "keep" | "new" and refuses any other value', async () => {
		const instance = await boot();
		await instance.slothlet.reload({ instance: "keep" });
		await instance.slothlet.reload({ instance: "new" });
		const error = await caught(() => instance.slothlet.reload({ instance: "same" }));
		expect(error?.code).toBe("INVALID_ARGUMENT");
	});
});

describe("generate() options", () => {
	it("refuses a key generate() does not take", async () => {
		const error = await caught(() => generate({ dir: "./api", output: "./x.d.ts", name: "X" }));
		expect(error?.code).toBe("INVALID_CONFIG_UNKNOWN_KEY");
		expect(error.context).toMatchObject({ where: "typegen.generate", key: "dir" });
	});
});

describe("METHOD_OPTION_SCHEMAS", () => {
	it("is frozen at every level", () => {
		expect(Object.isFrozen(METHOD_OPTION_SCHEMAS)).toBe(true);
		expect(Object.isFrozen(METHOD_OPTION_SCHEMAS["slothlet.api.add"].collision)).toBe(true);
		expect(Object.isFrozen(METHOD_OPTION_SCHEMAS["slothlet.api.modules.addDiscovered"].discover)).toBe(true);
	});
});
