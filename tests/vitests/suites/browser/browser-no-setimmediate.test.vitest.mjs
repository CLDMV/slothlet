/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-no-setimmediate.test.vitest.mjs
 *	@Date: 2026-10-07T00:00:00-07:00 (1791356400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-07T00:00:00-07:00 (1791356400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Composing in a host without `setImmediate` (a browser, an Electron context-isolated
 * renderer) must not call it (#578).
 *
 * @description
 * The routine manager's `impl:created` subscriber deferred its reactive stack patch with a bare
 * `setImmediate`, which throws in a browser. Every function leaf then produced a
 * `WARNING_LIFECYCLE_HANDLER_ERROR`, and the reactive patch never ran. The warning also dropped
 * the handler's error, so the cause was invisible.
 *
 * Covers:
 * - `scheduleMacrotask` picks `setImmediate`, then `MessageChannel`, then `setTimeout`
 * - a browser-mode compose with `setImmediate` removed raises no lifecycle handler warnings
 * - a late routine contributor is still reactively patched into its stack without `setImmediate`
 * - `WARNING_LIFECYCLE_HANDLER_ERROR` carries the handler's error and the event's apiPath/moduleID
 *
 * @module tests/vitests/suites/browser/browser-no-setimmediate
 */

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
import { scheduleMacrotask } from "@cldmv/slothlet/helpers/platform";
import { Lifecycle } from "#handlers/lifecycle";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getBrowserMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const realSetTimeout = globalThis.setTimeout;

/**
 * Let deferred work run using only `setTimeout`, so draining never depends on `setImmediate`.
 * @returns {Promise<void>}
 */
const settle = async () => {
	for (let i = 0; i < 10; i++) await new Promise((r) => realSetTimeout(r, 5));
};

/**
 * Lifecycle handler warnings captured since the last clear.
 * @returns {SlothletWarning[]}
 */
const handlerWarnings = () => SlothletWarning.captured.filter((w) => w.code === "WARNING_LIFECYCLE_HANDLER_ERROR");

let manifest;
let api;

beforeAll(async () => {
	manifest = await generateManifest(TEST_DIRS.API_TEST_BROWSER);
});

afterEach(async () => {
	vi.unstubAllGlobals();
	if (api) await api.shutdown().catch(() => {});
	api = null;
	SlothletWarning.clearCaptured();
});

describe("scheduleMacrotask (#578)", () => {
	it("uses setImmediate when the host has it", async () => {
		const immediate = vi.fn((fn) => realSetTimeout(fn, 0));
		vi.stubGlobal("setImmediate", immediate);
		const ran = new Promise((resolve) => scheduleMacrotask(resolve));
		await ran;
		expect(immediate).toHaveBeenCalledTimes(1);
	});

	it("falls back to a MessageChannel post when setImmediate is absent", async () => {
		vi.stubGlobal("setImmediate", undefined);
		const timeout = vi.fn(realSetTimeout);
		vi.stubGlobal("setTimeout", timeout);
		const order = [];
		const ran = new Promise((resolve) =>
			scheduleMacrotask(() => {
				order.push("task");
				resolve();
			})
		);
		// A macrotask runs after the current microtasks drain.
		queueMicrotask(() => order.push("microtask"));
		await ran;
		expect(order).toEqual(["microtask", "task"]);
		expect(timeout).not.toHaveBeenCalled();
	});

	it("falls back to setTimeout when neither setImmediate nor MessageChannel exists", async () => {
		vi.stubGlobal("setImmediate", undefined);
		vi.stubGlobal("MessageChannel", undefined);
		const timeout = vi.fn(realSetTimeout);
		vi.stubGlobal("setTimeout", timeout);
		await new Promise((resolve) => scheduleMacrotask(resolve));
		expect(timeout).toHaveBeenCalledTimes(1);
		expect(timeout.mock.calls[0][1]).toBe(0);
	});
});

describe.each(getBrowserMatrixConfigs())("browser compose without setImmediate (#578) > $name", ({ config }) => {
	it("raises no WARNING_LIFECYCLE_HANDLER_ERROR for function leaves", async () => {
		SlothletWarning.clearCaptured();
		vi.stubGlobal("setImmediate", undefined);
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_BROWSER, manifest });
		// Touch the leaves so lazy mode materializes them and fires impl:created too.
		expect(await api.math.add(2, 3)).toBe(5);
		expect(await api.utils.format.upper("a")).toBe("A");
		await settle();
		expect(handlerWarnings()).toEqual([]);
	});
});

describe("reactive routine stack patch without setImmediate (#578)", () => {
	it("patches a late contributor into its stack", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			routines: [{ name: "^auth.initialize", mode: "manual" }],
			stackRoutines: true,
			silent: true
		});
		await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
		const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;

		globalThis.__slothletRoutineLog = [];
		api.auth.initialize = function postWrite() {
			(globalThis.__slothletRoutineLog ??= []).push("post-write:initialize");
		};
		expect(api.auth.initialize.__slothletRoutineStack).toBeFalsy();

		vi.stubGlobal("setImmediate", undefined);
		routineManager.onImplCreated({
			apiPath: "auth.initialize",
			moduleID: "late-second-module",
			wrapper: {
				__impl: function lateContributor() {
					(globalThis.__slothletRoutineLog ??= []).push("late-contributor:initialize");
				}
			}
		});
		await settle();
		vi.unstubAllGlobals();

		expect(api.auth.initialize.__slothletRoutineStack).toBe(true);
		globalThis.__slothletRoutineLog = [];
		await api.auth.initialize();
		expect(globalThis.__slothletRoutineLog).toEqual(["post-write:initialize", "late-contributor:initialize"]);
	});
});

describe("WARNING_LIFECYCLE_HANDLER_ERROR carries the handler's error (#578)", () => {
	/**
	 * Minimal slothlet stand-in for a bare Lifecycle.
	 * @returns {object}
	 */
	const makeMock = () => ({ config: { debug: {} }, debug: vi.fn(), SlothletWarning });

	it("attaches a synchronous handler's error as the cause, with apiPath and moduleID", async () => {
		SlothletWarning.clearCaptured();
		const lc = new Lifecycle(makeMock());
		const boom = new ReferenceError("setImmediate is not defined");
		lc.subscribeInternal("impl:created", () => {
			throw boom;
		});
		await lc.emitInternal("impl:created", { apiPath: "math.add", moduleID: "base", source: "test" });

		const [warning] = handlerWarnings();
		expect(warning.cause).toBe(boom);
		expect(warning.context).toMatchObject({ event: "impl:created", apiPath: "math.add", moduleID: "base" });
		expect(warning.message).toContain("math.add");
		expect(warning.message).toContain("base");
	});

	it("names only the event when the event is not about an api path", async () => {
		SlothletWarning.clearCaptured();
		const lc = new Lifecycle(makeMock());
		const boom = new Error("init handler failure");
		lc.on("init", () => {
			throw boom;
		});
		await lc.emit("init", { instanceID: "test-instance" });

		const [warning] = handlerWarnings();
		expect(warning.cause).toBe(boom);
		expect(warning.context).toEqual({ event: "init" });
		expect(warning.message).toContain("'init'");
	});

	it("stays quiet when the instance is silent", async () => {
		SlothletWarning.clearCaptured();
		const lc = new Lifecycle({ ...makeMock(), config: { debug: {}, silent: true } });
		lc.subscribeInternal("impl:created", () => {
			throw new Error("silenced");
		});
		await lc.emitInternal("impl:created", { apiPath: "math.add", moduleID: "base", source: "test" });
		expect(handlerWarnings()).toEqual([]);
	});

	it("attaches an async handler's rejection as the cause", async () => {
		SlothletWarning.clearCaptured();
		const lc = new Lifecycle(makeMock());
		const boom = new Error("async failure");
		lc.subscribeInternal("impl:created", async () => {
			throw boom;
		});
		await lc.emitInternal("impl:created", { apiPath: "math.add", moduleID: "base", source: "test" });

		const [warning] = handlerWarnings();
		expect(warning.cause).toBe(boom);
		expect(warning.context).toMatchObject({ event: "impl:created", apiPath: "math.add", moduleID: "base" });
	});

	it("prints the cause's stack when the warning reaches the console", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		SlothletWarning.suppressConsole = false;
		try {
			const boom = new Error("printed failure");
			const warning = new SlothletWarning("WARNING_LIFECYCLE_HANDLER_ERROR", { event: "impl:created" }, boom);
			expect(warning.cause).toBe(boom);
			const printed = warnSpy.mock.calls.flat().map(String).join("\n");
			expect(printed).toContain("printed failure");
			expect(printed).toContain(boom.stack.split("\n")[1].trim());
		} finally {
			SlothletWarning.suppressConsole = true;
			warnSpy.mockRestore();
		}
	});

	it("prints a thrown non-Error value as-is", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		SlothletWarning.suppressConsole = false;
		try {
			const warning = new SlothletWarning("WARNING_LIFECYCLE_HANDLER_ERROR", { event: "impl:created" }, "plain string throw");
			expect(warning.cause).toBe("plain string throw");
			expect(warnSpy).toHaveBeenCalledWith("Cause:", "plain string throw");
		} finally {
			SlothletWarning.suppressConsole = true;
			warnSpy.mockRestore();
		}
	});

	it("leaves cause undefined when no error is passed", () => {
		const warning = new SlothletWarning("WARNING_LIFECYCLE_HANDLER_ERROR", { event: "impl:created" });
		expect(warning.cause).toBeUndefined();
	});
});
