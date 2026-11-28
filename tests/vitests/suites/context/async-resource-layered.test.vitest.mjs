/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/async-resource-layered.test.vitest.mjs
 *	@Date: 2026-11-25T01:35:11-08:00 (1795599311)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:21-08:00 (1795869081)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `AsyncLocalStorage` / `AsyncResource` patch under another copy's, re-entered, and over stand-ins.
 *
 * @description
 * `helpers/async-resource-context` wraps `AsyncLocalStorage.snapshot()` and `.bind()` and replaces `AsyncResource`,
 * so what they run later runs as the caller that made them. The runtime decides who that caller is; here a stand-in
 * strategy (see `helpers/caller-pinning`) pins every scope callback, so each path can be driven directly:
 *
 * - two copies of the module, one disabled under the other: the lower one passes through, the upper one still pins,
 *   and turning both off puts Node's own functions back;
 * - a snapshot's function re-entered with the same callback while it runs;
 * - a snapshot taken through a function another library put in place of Node's, which can keep the runner it is
 *   handed: called with code slothlet never armed, the runner just calls it;
 * - a platform with no `node:async_hooks`, or one whose `async_hooks` lacks what is patched.
 * @module tests/vitests/suites/context/async-resource-layered
 */

import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import * as asyncHooks from "node:async_hooks";
import { pathToFileURL } from "node:url";
import { describe, it, expect, afterEach, vi } from "vitest";
import { setApiCallerPinner } from "#helpers/caller-pinning";
import { internalLibPath } from "../../setup/internal-resolve.mjs";
// Loaded first, so the files it imports are loaded once, unmocked: only the copies below are evaluated over stand-ins.
import "#helpers/async-resource-context";

let copies = 0;
const FILE = pathToFileURL(internalLibPath("helpers/async-resource-context.mjs")).href;

/**
 * A copy of the module of its own.
 * @returns {Promise<object>} The copy.
 */
const another = () => import(`${FILE}?copy=async-resource-${++copies}`);

/**
 * A copy of the module whose `process.getBuiltinModule("node:async_hooks")` answers `hooks`.
 * @param {*} hooks - The stand-in.
 * @returns {Promise<object>} The copy.
 */
async function copyOver(hooks) {
	vi.doMock("#helpers/intrinsics", async (importOriginal) => {
		const original = await importOriginal();
		return {
			...original,
			Processes: {
				...original.Processes,
				getBuiltinModule: (id) => (id === "node:async_hooks" ? hooks : original.Processes.getBuiltinModule(id))
			}
		};
	});
	try {
		return await another();
	} finally {
		vi.doUnmock("#helpers/intrinsics");
	}
}

/**
 * Pin every scope callback: the strategy's `scope` form hands back a function of its own that calls the callback.
 * @returns {{pins: number}} How many scope callbacks were pinned.
 */
function pinScopes() {
	const counts = { pins: 0 };
	const strategy = (callback) => callback;
	strategy.scope = (callback) => {
		counts.pins++;
		return function pinnedScope(...args) {
			return Reflect.apply(callback, this, args);
		};
	};
	setApiCallerPinner(strategy);
	return counts;
}

const NODE = {
	snapshot: AsyncLocalStorage.snapshot,
	bind: AsyncLocalStorage.bind,
	AsyncResource
};

let loaded = [];
afterEach(() => {
	for (const copy of loaded) copy.disableAsyncResourcePatching();
	loaded = [];
	setApiCallerPinner(null);
});

describe("Context > async resources > one copy disabled under another", () => {
	it("passes through in the lower copy, pins in the upper one, and puts Node's functions back", async () => {
		const lower = await another();
		const upper = await another();
		loaded = [lower, upper];
		lower.enableAsyncResourcePatching();
		upper.enableAsyncResourcePatching();
		lower.disableAsyncResourcePatching();
		const counts = pinScopes();

		const run = AsyncLocalStorage.snapshot();
		expect(run((a, b) => a + b, 1, 2)).toBe(3);
		const bound = AsyncLocalStorage.bind((value) => value * 2);
		expect(bound(4)).toBe(8);
		const Resource = asyncHooks.AsyncResource;
		const resource = new Resource("slothlet-test");
		expect(resource.runInAsyncScope((value) => value + 1, null, 1)).toBe(2);
		expect(resource).toBeInstanceOf(NODE.AsyncResource);
		const staticBound = Resource.bind(function named(value) {
			return value - 1;
		});
		expect(staticBound(3)).toBe(2);
		expect(counts.pins).toBeGreaterThan(0);
		resource.emitDestroy();

		upper.disableAsyncResourcePatching();
		// A second disable does nothing.
		upper.disableAsyncResourcePatching();
		loaded = [];
		expect(AsyncLocalStorage.snapshot).toBe(NODE.snapshot);
		expect(AsyncLocalStorage.bind).toBe(NODE.bind);
		expect(asyncHooks.AsyncResource).toBe(NODE.AsyncResource);
	});
});

describe("Context > async resources > a resource used after the patch is off", () => {
	it("runs what it is handed as Node's resource does", async () => {
		const copy = await another();
		loaded = [copy];
		copy.enableAsyncResourcePatching();
		pinScopes();
		const resource = new asyncHooks.AsyncResource("slothlet-test");
		copy.disableAsyncResourcePatching();
		loaded = [];
		expect(resource.runInAsyncScope((a, b) => a + b, null, 2, 3)).toBe(5);
		resource.emitDestroy();
	});
});

describe("Context > async resources > a snapshot's function", () => {
	it("runs a callback that re-enters it with itself, and returns what the innermost call returned", async () => {
		const copy = await another();
		loaded = [copy];
		copy.enableAsyncResourcePatching();
		pinScopes();
		const run = AsyncLocalStorage.snapshot();
		const depthFirst = (n) => (n > 0 ? run(depthFirst, n - 1) : "bottom");
		expect(run(depthFirst, 2)).toBe("bottom");
	});

	it("hands a runner that calls code slothlet never armed as it is", async () => {
		// Another library's snapshot, which keeps the function it is handed.
		let kept = null;
		const libraryRun = (fn, ...args) => {
			kept = fn;
			return Reflect.apply(fn, null, args);
		};
		AsyncLocalStorage.snapshot = () => libraryRun;
		try {
			const copy = await another();
			loaded = [copy];
			copy.enableAsyncResourcePatching();
			pinScopes();
			const run = AsyncLocalStorage.snapshot();
			expect(run((value) => value, 7)).toBe(7);
			expect(typeof kept).toBe("function");
			expect(kept((a, b) => a * b, null, [3, 4])).toBe(12);
			copy.disableAsyncResourcePatching();
			loaded = [];
		} finally {
			AsyncLocalStorage.snapshot = NODE.snapshot;
		}
	});
});

describe("Context > async resources > platforms that differ", () => {
	it("does nothing where there is no node:async_hooks", async () => {
		const copy = await copyOver(undefined);
		copy.enableAsyncResourcePatching();
		copy.enableAsyncResourcePatching();
		expect(AsyncLocalStorage.snapshot).toBe(NODE.snapshot);
		copy.disableAsyncResourcePatching();
	});

	it("keeps its own function where the host refuses the write, and patches a resource class with no runInAsyncScope", async () => {
		const snapshot =
			() =>
			(fn, ...args) =>
				fn(...args);
		const Storage = Object.freeze({ snapshot, bind: (fn) => fn });
		class Resource {
			constructor(type) {
				this.type = type;
			}
		}
		const hooks = { AsyncLocalStorage: Storage, AsyncResource: Resource };
		const copy = await copyOver(hooks);
		copy.enableAsyncResourcePatching();
		expect(Storage.snapshot).toBe(snapshot);
		expect(hooks.AsyncResource).not.toBe(Resource);
		const made = new hooks.AsyncResource("stand-in");
		expect(made.type).toBe("stand-in");
		expect(made).toBeInstanceOf(Resource);
		copy.disableAsyncResourcePatching();
		expect(hooks.AsyncResource).toBe(Resource);
	});

	it("patches only what async_hooks has", async () => {
		const hooks = { AsyncLocalStorage: {} };
		const copy = await copyOver(hooks);
		copy.enableAsyncResourcePatching();
		expect(hooks.AsyncResource).toBe(undefined);
		expect(Object.keys(hooks.AsyncLocalStorage)).toEqual([]);
		copy.disableAsyncResourcePatching();
	});
});
