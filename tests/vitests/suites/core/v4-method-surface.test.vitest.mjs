/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/v4-method-surface.test.vitest.mjs
 *	@Date: 2026-11-16T18:00:00-08:00 (1794880800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:43-08:00 (1795869103)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The v4 control-method shapes that are more than a rename: `modules.add` telling its own discover results
 * from options, per-instance `warnings`, error details and audit payloads naming a method as path segments, and the
 * `reload({ instance })` option.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_NPM = path.resolve(__dirname, "../../../../api_tests/api_test_modules_npm");

/** @type {any} */
let api;

afterEach(async () => {
	if (api) await api.shutdown().catch(() => {});
	api = null;
});

/**
 * The error a call throws.
 * @param {() => unknown} fn - The call.
 * @returns {Promise<any>} The error, or null.
 */
async function errorOf(fn) {
	try {
		await fn();
		return null;
	} catch (error) {
		return error;
	}
}

describe("modules.add tells its own discover results from options", () => {
	const boot = async (mutations) =>
		(api = await slothlet({
			base: TEST_DIRS.API_TEST,
			silent: true,
			api: { collision: { mode: { initial: "merge", api: "merge" } }, ...(mutations ? { mutations } : {}) }
		}));

	it("mounts a result discover() returned", async () => {
		await boot();
		const [result] = await api.slothlet.api.modules.discover({ root: FIX_NPM, prefix: "packrat-extension-" });
		const mounted = await api.slothlet.api.modules.add(result);
		expect(mounted).toBeTruthy();
		expect(api.slothlet.api.modules.stale()).toEqual([]);
	});

	it("never mounts an object it did not return, even one shaped like a result", async () => {
		await boot();
		const [result] = await api.slothlet.api.modules.discover({ root: FIX_NPM, prefix: "packrat-extension-" });
		const error = await withSuppressedSlothletErrorOutput(() => errorOf(() => api.slothlet.api.modules.add([{ ...result }])));
		expect(error.code).toBe("INVALID_ARGUMENT");
	});

	it("runs discover, sort and mount for options alone", async () => {
		await boot();
		const out = await api.slothlet.api.modules.add({
			discover: { root: FIX_NPM, prefix: "packrat-extension-" },
			failure: "best-effort"
		});
		expect(out.mounted.length).toBeGreaterThan(0);
	});

	it("refuses an options object followed by options", async () => {
		await boot();
		const error = await errorOf(() => api.slothlet.api.modules.add({ discover: {} }, { failure: "throw" }));
		expect(error.code).toBe("INVALID_ARGUMENT");
	});

	it("names the method as path segments when mutations are off, and joined in the message", async () => {
		await boot({ add: false });
		const error = await withSuppressedSlothletErrorOutput(() => errorOf(() => api.slothlet.api.modules.add("x")));
		expect(error.code).toBe("API_MUTATION_DISABLED");
		expect(error.details.operation).toEqual(["slothlet", "api", "modules", "add"]);
		expect(error.message).toContain("slothlet.api.modules.add");
	});
});

describe("warnings are kept per instance at api.slothlet.warnings", () => {
	it("get() returns a copy and clear() empties the list", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true });
		// A per-call collision mode the instance locks raises WARNING_COLLISION_OPTION_LOCKED.
		await api.slothlet.api.add("extra", { exports: { ping: () => "pong" } }, { collision: { mode: "replace" } });
		const first = api.slothlet.warnings.get();
		expect(first.length).toBeGreaterThan(0);
		first.length = 0;
		expect(api.slothlet.warnings.get().length).toBeGreaterThan(0);
		api.slothlet.warnings.clear();
		expect(api.slothlet.warnings.get()).toEqual([]);
	});

	it("is the host's by default: modules are refused it while permissions are on", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, permissions: { mode: "on", policy: "allow" } });
		expect(api.slothlet.permissions.global.check.access("math.add", "slothlet.warnings.get")).toBe(false);
		expect(api.slothlet.permissions.global.check.access("math.add", "slothlet.bind")).toBe(true);
	});
});

describe("check.call audits with via as the method path", () => {
	it("permission:denied carries via as segments", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			permissions: { mode: "on", policy: "allow", rules: [{ caller: "math.**", target: "string.**", effect: "deny" }] }
		});
		const seen = [];
		api.slothlet.lifecycle.on("permission:denied", (data) => seen.push(data));
		expect(await api.slothlet.permissions.global.check.call("math.add", "string.upper", [])).toBe(false);
		expect(seen.at(-1)?.via).toEqual(["slothlet", "permissions", "global", "check", "call"]);
	});
});

describe("reload({ instance })", () => {
	it('keeps the instance id with "keep", makes a new one by default, refuses anything else', async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST });
		const before = api.slothlet.instance.id;
		await api.slothlet.reload({ instance: "keep" });
		expect(api.slothlet.instance.id).toBe(before);
		await api.slothlet.reload();
		expect(api.slothlet.instance.id).not.toBe(before);
		const error = await errorOf(() => api.slothlet.reload({ instance: "same" }));
		expect(error.code).toBe("INVALID_ARGUMENT");
	});
});
