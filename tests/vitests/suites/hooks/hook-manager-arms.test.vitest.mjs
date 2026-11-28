/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/hooks/hook-manager-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:43:21-08:00 (1795599801)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:52-08:00 (1795869112)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview HookManager arms the hook suites do not reach: every write on a run's copy, hooks re-imported from a
 * snapshot that names no owner, a hook registered under a ceiling call with no path, the failure-record helpers
 * reading each fact once, the rejection-recording view of a hand-written thenable, a thenable whose `then` returns a
 * thenable, and an async around hook that answers without calling `next`.
 *
 * @module tests/vitests/suites/hooks/hook-manager-arms.test.vitest
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { HookManager, failureRecord, failureSource, rememberFailure, settleThenable } from "#handlers/hook-manager";
import { WRITE_TARGET } from "#helpers/flow-stores";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

/**
 * A slothlet stand-in for the HookManager.
 * @param {object} [extra] - Fields merged onto the mock.
 * @returns {object} Mock slothlet.
 * @example
 * const hm = new HookManager(makeMock());
 */
function makeMock(extra = {}) {
	return { config: { hook: { enabled: true } }, debug: vi.fn(), SlothletError, SlothletWarning, ...extra };
}

describe("HookManager writes on a run's copy", () => {
	it("remove / enable / disable / pattern filter / pin enforcement / import write the copy", () => {
		const mock = makeMock();
		const hm = new HookManager(mock);
		const copy = new HookManager(mock);
		copy.on("math.add:before", () => {}, { id: "h1" });
		mock[WRITE_TARGET] = (component) => (component === hm ? copy : component);

		hm.disable({ id: "h1" });
		expect(copy.list().registeredHooks.find((h) => h.id === "h1").enabled).toBe(false);
		hm.enable({ id: "h1" });
		expect(copy.list().registeredHooks.find((h) => h.id === "h1").enabled).toBe(true);

		hm.enablePattern("math.**");
		expect(copy.enabledPatterns.has("math.**")).toBe(true);
		expect(hm.enabledPatterns.has("math.**")).toBe(false);
		expect(hm.disablePattern("math.**")).toBe(0);
		expect(copy.enabledPatterns.has("math.**")).toBe(false);
		hm.enablePattern("x.**");
		hm.resetPatternFilter();
		expect(copy.enabledPatterns.size).toBe(0);

		expect(hm.setPinEnforced(true)).toBe(true);
		expect(copy.pinEnforced).toBe(true);

		hm.importHooks([{ typePattern: "math.sub:after", handler: () => {}, options: { id: "h2" }, enabled: true }]);
		expect(copy.list().registeredHooks.map((h) => h.id)).toContain("h2");

		expect(hm.remove({ id: "h1" })).toBe(1);
		expect(copy.list().registeredHooks.map((h) => h.id)).not.toContain("h1");
		mock[WRITE_TARGET] = undefined;
		expect(hm.list().registeredHooks).toEqual([]);
	});
});

describe("HookManager.importHooks — a snapshot that names no owner", () => {
	it("registers the hook with no owner and no ceiling", () => {
		const hm = new HookManager(makeMock());
		hm.importHooks([{ typePattern: "math.add:before", handler: () => {}, options: { id: "bare" }, enabled: false }]);
		const [hook] = hm.exportHooks();
		expect([hook.ownerPath, hook.ownerFilePath, hook.ownerCeilings, hook.enabled]).toEqual([null, null, [], false]);
	});
});

describe("HookManager.on — under a ceiling call with no path", () => {
	it("records the ceiling with null path and file", () => {
		const own = { ____slothletInternal: { apiPath: "mod.fn", filePath: "/mod.mjs" } };
		const hm = new HookManager(makeMock({ contextManager: { getCallerIdentity: () => ({ currentWrapper: own, ceiling: {} }) } }));
		hm.on("math.add:before", () => {}, { id: "c" });
		const [hook] = hm.exportHooks();
		expect([hook.ownerPath, hook.ownerCeilings]).toEqual(["mod.fn", [{ path: null, filePath: null }]]);
	});
});

describe("failure records", () => {
	it("reads no stack of a primitive and the class of an object once", () => {
		const runAs = vi.fn((reader, value) => reader(value));
		const record = failureRecord("plain", runAs);
		expect(record.stack()).toBeUndefined();
		class Custom extends Error {}
		const err = new Custom("x");
		expect(record.typeOf(err)).toBe("Custom");
		expect(record.typeOf(err)).toBe("Custom");
		expect(runAs.mock.calls.filter((c) => c[1] === err)).toHaveLength(1);
		expect(record.typeOf(5)).toBe("Number");
	});

	it("keeps no record for a primitive, and the first record kept for an error", () => {
		const runAs = (reader, value) => reader(value);
		const record = failureRecord("p", runAs);
		expect(rememberFailure("p", record)).toBe(record);
		const err = new Error("e");
		const first = failureRecord(err, runAs);
		expect(rememberFailure(err, first)).toBe(first);
		expect(rememberFailure(err, failureRecord(err, runAs))).toBe(first);
	});

	it("reads a source's stack once however often it is read", () => {
		const record = { stack: vi.fn(() => "STACK") };
		const source = failureSource({ type: "before" }, record);
		expect(source.stack).toBe("STACK");
		expect(source.stack).toBe("STACK");
		expect(record.stack).toHaveBeenCalledTimes(1);
	});
});

describe("settleThenable — a then that returns a thenable", () => {
	it("hands back what its then returned", async () => {
		const returned = { then: (resolve) => resolve("inner") };
		const thenable = {
			then(onFulfilled) {
				onFulfilled(1);
				return returned;
			}
		};
		const out = settleThenable(
			thenable,
			(v) => v + 1,
			() => {}
		);
		expect(out).toBe(returned);
	});

	it("hands back its own promise when then returns a primitive or a function", async () => {
		for (const result of [5, () => {}]) {
			const thenable = {
				then(onFulfilled) {
					onFulfilled(1);
					return result;
				}
			};
			const out = settleThenable(
				thenable,
				(v) => v + 1,
				() => {}
			);
			expect(out).not.toBe(result);
			await expect(out).resolves.toBe(2);
		}
	});
});

describe("HookManager.recordRejections — the view of a hand-written thenable", () => {
	it("hands out data members as they are and binds each method once", () => {
		const hm = new HookManager(makeMock());
		class Job {
			#id = 7;
			label = "job";
			then(resolve) {
				resolve(this.#id);
			}
			id() {
				return this.#id;
			}
		}
		const view = hm.recordRejections(
			new Job(),
			() => {},
			() => {}
		);
		expect(view.label).toBe("job");
		const id = view.id;
		expect(id()).toBe(7);
		expect(view.id).toBe(id);
	});
});

describe.each(getMatrixConfigs({ mode: "eager" }).slice(0, 2))("async around hook answering without next > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	it("answers the call with what the hook returned", async () => {
		api = await slothlet({
			...config,
			base: new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname,
			hook: { enabled: true }
		});
		await api.slothlet.api.add("svc", {
			async mulAsync(a, b) {
				await Promise.resolve();
				return a * b;
			}
		});
		api.slothlet.hook.on("svc.mulAsync:around", () => 42, { id: "short" });
		expect(await api.svc.mulAsync(2, 3)).toBe(42);
	});
});
