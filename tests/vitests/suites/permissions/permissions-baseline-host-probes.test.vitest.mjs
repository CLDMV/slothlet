/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-baseline-host-probes.test.vitest.mjs
 *	@Date: 2026-11-25T01:20:35-08:00 (1795598435)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:11:58-08:00 (1795601518)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The permission baseline's own probes on hosts other than the one running the suite: a `Function` that
 * refuses code from strings, a host with no `Blob` or `URL.createObjectURL`, a Node older than 24 or no Node version at
 * all, no `node:async_hooks` to probe, no vite records registry, and no vitest worker global.
 *
 * @description
 * The module reads these facts once, as it loads, from `helpers/intrinsics` and `helpers/async-store-slot`. Each test
 * loads a fresh copy with one of them replaced and runs the checks with the default probes, then compares with what
 * the plain-JS facts give: a `Function` constructor that throws `EvalError` means code from strings is refused; no
 * `Blob` means a `blob:` script cannot be made, so it counts as refused; Node 22 is told to turn the frame on with
 * `--experimental-async-context-frame`.
 * @module tests/vitests/suites/permissions/permissions-baseline-host-probes
 */

import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Load a fresh `helpers/permission-baseline` with some of what `helpers/intrinsics` exports replaced.
 * @param {function(object): object} [patchIntrinsics] - Given the real exports, returns the replaced ones.
 * @param {object} [asyncSlot] - Exports of `helpers/async-store-slot` to replace.
 * @returns {Promise<object>} The module.
 */
async function loadWith(patchIntrinsics = () => ({}), asyncSlot = null) {
	vi.resetModules();
	vi.doMock("#helpers/intrinsics", async (importOriginal) => {
		const real = await importOriginal();
		return { ...real, ...patchIntrinsics(real) };
	});
	if (asyncSlot) {
		vi.doMock("#helpers/async-store-slot", async (importOriginal) => ({ ...(await importOriginal()), ...asyncSlot }));
	}
	return import("#helpers/permission-baseline");
}

/**
 * A `Function` constructor that refuses the baseline's probe the way a host refusing code from strings does.
 * @param {function(): Error} makeError - The error to throw.
 * @returns {Function} The constructor.
 */
const refusingFunction = (makeError) =>
	new Proxy(Function, {
		construct(target, args, newTarget) {
			if (args.length === 1 && args[0] === "return 1") throw makeError();
			return Reflect.construct(target, args, newTarget);
		}
	});

/**
 * A `process` whose Node version reads as `version`.
 * @param {string|undefined} version - The version, or undefined for none.
 * @returns {object} The process stand-in.
 */
const processAt = (version) =>
	new Proxy(process, {
		get(target, key) {
			if (key === "versions") return version === undefined ? {} : { ...target.versions, node: version };
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		}
	});

afterEach(() => {
	vi.doUnmock("#helpers/intrinsics");
	vi.doUnmock("#helpers/async-store-slot");
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("permission baseline > the browser checks with the default probes", () => {
	it("csp-eval is met when the Function constructor throws EvalError", async () => {
		const { runBaseline } = await loadWith(() => ({ NativeFunction: refusingFunction(() => new EvalError("refused")) }));
		const { checks } = await runBaseline("browser");
		expect(checks[0]).toEqual({ id: "csp-eval", met: true, reason: null });
	});

	it("csp-eval is met when the error is an EvalError from another realm (named, not an instance)", async () => {
		const { runBaseline } = await loadWith(() => ({
			NativeFunction: refusingFunction(() => Object.assign(new Error("refused"), { name: "EvalError" }))
		}));
		const { checks } = await runBaseline("browser");
		expect(checks[0]).toEqual({ id: "csp-eval", met: true, reason: null });
	});

	it("csp-eval is not met when the Function constructor throws something else", async () => {
		const { runBaseline } = await loadWith(() => ({ NativeFunction: refusingFunction(() => new TypeError("other")) }));
		const { checks } = await runBaseline("browser");
		expect(checks[0]).toEqual({ id: "csp-eval", met: false, reason: expect.any(String) });
	});

	it("csp-blob-script is met where the host has no Blob, since no blob: script can be made", async () => {
		const { runBaseline } = await loadWith(() => ({ Blob: undefined }));
		const { checks } = await runBaseline("browser");
		expect(checks[1]).toEqual({ id: "csp-blob-script", met: true, reason: null });
	});

	it("csp-blob-script is met where the host has no URL.createObjectURL", async () => {
		const { runBaseline } = await loadWith(() => ({ URLs: {} }));
		const { checks } = await runBaseline("browser");
		expect(checks[1]).toEqual({ id: "csp-blob-script", met: true, reason: null });
	});

	it("names csp-blob-script, with a reason, when a blob: script is allowed", async () => {
		const { runBaseline } = await loadWith();
		const out = await runBaseline("browser", {
			codeFromStringsRefused: () => true,
			importRefused: async (kind) => kind !== "blob",
			vitestWorker: null,
			viteRecords: () => 0
		});
		expect(out.met).toBe(false);
		expect(out.checks[1]).toEqual({ id: "csp-blob-script", met: false, reason: expect.any(String) });
		expect(out.checks[1].reason.length).toBeGreaterThan(0);
	});
});

describe("permission baseline > the Node checks on other hosts", () => {
	const frameOff = { asyncContextFrameOn: () => false, vitestWorker: null, viteRecords: () => 0 };

	it("on Node 22 the reason names --experimental-async-context-frame", async () => {
		const { runBaseline } = await loadWith(() => ({ NativeProcess: processAt("22.4.0") }));
		const { checks } = await runBaseline("node", frameOff);
		expect(checks).toEqual([
			{ id: "async-context-frame", met: false, reason: expect.stringContaining("--experimental-async-context-frame") }
		]);
	});

	it("on Node 24 the reason names --no-async-context-frame", async () => {
		const { runBaseline } = await loadWith(() => ({ NativeProcess: processAt("24.1.0") }));
		const { checks } = await runBaseline("node", frameOff);
		expect(checks[0].reason).toContain("--no-async-context-frame");
		expect(checks[0].reason).not.toContain("--experimental-async-context-frame");
	});

	it("with no Node version to read, the reason names --no-async-context-frame", async () => {
		const { runBaseline } = await loadWith(() => ({ NativeProcess: processAt(undefined) }));
		const { checks } = await runBaseline("node", frameOff);
		expect(checks[0].reason).toContain("--no-async-context-frame");
	});

	it("with no process at all, the reason names --no-async-context-frame", async () => {
		const { runBaseline } = await loadWith(() => ({ NativeProcess: undefined }));
		const { checks } = await runBaseline("node", frameOff);
		expect(checks[0].reason).toContain("--no-async-context-frame");
	});

	it("where there is no node:async_hooks to probe, async-context-frame is not a check", async () => {
		const { runBaseline } = await loadWith(undefined, { asyncStoreProbeAvailable: () => false });
		const { checks } = await runBaseline("node");
		expect(checks.map((entry) => entry.id)).not.toContain("async-context-frame");
	});

	it("with no vite records registry, vitest-plugin is not met", async () => {
		const key = Symbol.for("@cldmv/slothlet.viteLoadedBy");
		const had = Object.prototype.hasOwnProperty.call(globalThis, key);
		const saved = globalThis[key];
		const { runBaseline } = await loadWith();
		try {
			globalThis[key] = {};
			const { checks } = await runBaseline("node");
			expect(checks.find((entry) => entry.id === "vitest-plugin")).toEqual({ id: "vitest-plugin", met: false, reason: expect.any(String) });
		} finally {
			if (had) globalThis[key] = saved;
			else delete globalThis[key];
		}
	});

	it("outside vitest (no worker global as it loads), vitest-plugin is not a check", async () => {
		vi.resetModules();
		const mod = await import("#helpers/permission-baseline").then(async () => {
			vi.resetModules();
			vi.stubGlobal("__vitest_worker__", undefined);
			try {
				return await import("#helpers/permission-baseline");
			} finally {
				vi.unstubAllGlobals();
			}
		});
		const { checks } = await mod.runBaseline("node", undefined, "live");
		expect(checks).toEqual([]);
	});
});
