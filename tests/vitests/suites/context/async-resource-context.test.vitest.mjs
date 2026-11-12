/**
 * @fileoverview The live runtime's patch of `AsyncLocalStorage.snapshot()`, `AsyncLocalStorage.bind()` and
 * `AsyncResource`: installed while an instance on the live runtime is up, removed when the last one shuts down, and
 * transparent to code that uses them.
 *
 * @description
 * What the patch is for (code they run carries the module that made them) is asserted in
 * `permissions-load-identity.test.vitest.mjs`, whose live rows it changed. This file asserts the mechanism: each
 * expected value is what Node's own classes do, which a plain call of the same expression gives before any instance
 * exists and after the last one has shut down.
 * @module tests/vitests/suites/context/async-resource-context
 */

import { describe, it, expect } from "vitest";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import asyncHooks from "node:async_hooks";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * What a set of uses of the three answers: each expression's result, so the patched and unpatched forms can be
 * compared.
 * @returns {object} The answers.
 */
function uses() {
	const storage = new AsyncLocalStorage();
	const snapshot = storage.run("kept", () => AsyncLocalStorage.snapshot());
	const boundRead = storage.run("bound", () => AsyncLocalStorage.bind(() => storage.getStore()));
	const resource = storage.run("resource", () => new asyncHooks.AsyncResource("slothlet-test"));
	const receiver = { tag: "receiver" };
	/** A subclass, as a pool or a queue makes. */
	class Job extends asyncHooks.AsyncResource {
		/** @param {string} label - A label. */
		constructor(label) {
			super("slothlet-test-job");
			this.label = label;
		}
	}
	const job = storage.run("job", () => new Job("j1"));
	return {
		snapshotStore: snapshot(() => storage.getStore()),
		snapshotArgs: snapshot((a, b) => [a, b], 1, 2),
		snapshotNotFunctionThrows: (() => {
			try {
				snapshot(5);
				return false;
			} catch {
				return true;
			}
		})(),
		boundStore: boundRead(),
		resourceStore: resource.runInAsyncScope(() => storage.getStore()),
		resourceThis: resource.runInAsyncScope(
			function (a, b) {
				return [this.tag, a, b];
			},
			receiver,
			1,
			2
		),
		resourceBind: resource.bind(function (a) {
			return [this?.tag ?? null, a, storage.getStore()];
		}, receiver)("x"),
		staticBind: storage.run("static", () => asyncHooks.AsyncResource.bind((a) => [a, storage.getStore()]))("y"),
		jobStore: job.runInAsyncScope(() => storage.getStore()),
		jobLabel: job.label,
		jobIsResource: job instanceof asyncHooks.AsyncResource,
		jobIsOriginal: job instanceof AsyncResource,
		resourceIsResource: resource instanceof asyncHooks.AsyncResource,
		resourceIsOriginal: resource instanceof AsyncResource,
		originalIsResource: new AsyncResource("slothlet-test-original") instanceof asyncHooks.AsyncResource,
		asyncId: typeof resource.asyncId(),
		className: asyncHooks.AsyncResource.name,
		throws: (() => {
			try {
				resource.runInAsyncScope(() => {
					throw new RangeError("from the callback");
				});
				return null;
			} catch (error) {
				return error.name;
			}
		})()
	};
}

describe("the live runtime's AsyncLocalStorage / AsyncResource patch", () => {
	it("is installed while a live instance is up, answers as Node's own classes do, and is removed with the last one", async () => {
		const originalResource = asyncHooks.AsyncResource;
		const originalSnapshot = AsyncLocalStorage.snapshot;
		const originalBind = AsyncLocalStorage.bind;
		const plain = uses();

		const first = await slothlet({ base: TEST_DIRS.API_TEST, runtime: "live", silent: true });
		const second = await slothlet({ base: TEST_DIRS.API_TEST, runtime: "live", silent: true });
		try {
			expect(asyncHooks.AsyncResource).not.toBe(originalResource);
			expect(AsyncLocalStorage.snapshot).not.toBe(originalSnapshot);
			expect(AsyncLocalStorage.bind).not.toBe(originalBind);
			expect(uses()).toEqual(plain);
			// Installed once: a second instance puts nothing over the first one's.
			const installed = asyncHooks.AsyncResource;
			await first.shutdown();
			expect(asyncHooks.AsyncResource).toBe(installed);
			expect(uses()).toEqual(plain);
		} finally {
			await second.shutdown();
		}
		expect(asyncHooks.AsyncResource).toBe(originalResource);
		expect(AsyncLocalStorage.snapshot).toBe(originalSnapshot);
		expect(AsyncLocalStorage.bind).toBe(originalBind);
		expect(uses()).toEqual(plain);
	});

	it("is not installed for an instance on the async runtime, whose store Node's async context carries by itself", async () => {
		const originalResource = asyncHooks.AsyncResource;
		const originalSnapshot = AsyncLocalStorage.snapshot;
		const api = await slothlet({ base: TEST_DIRS.API_TEST, runtime: "async", silent: true });
		try {
			expect(asyncHooks.AsyncResource).toBe(originalResource);
			expect(AsyncLocalStorage.snapshot).toBe(originalSnapshot);
		} finally {
			await api.shutdown();
		}
	});
});
