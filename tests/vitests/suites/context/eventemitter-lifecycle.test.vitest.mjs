/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-lifecycle.test.vitest.mjs
 *	@Date: 2026-02-26T06:59:00-08:00 (1772117940)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:46 -08:00 (1772425306)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for EventEmitter lifecycle patches in eventemitter-context.mjs.
 *
 * @description
 * Tests the uncovered branches in eventemitter-context.mjs (lines 235-404):
 * - `runtime_patchOnce`: .once() fires only once and auto-cleans tracking
 * - `runtime_patchPrependListener`: .prependListener() adds at front of listener list
 * - `runtime_patchPrependOnceListener`: .prependOnceListener() - fires once at front
 * - `runtime_patchRemoveListener`: .removeListener() / .off() removes a specific listener
 * - `runtime_patchRemoveAllListeners`: .removeAllListeners(event) clears per-event tracking
 * - `runtime_patchRemoveAllListeners`: .removeAllListeners() clears all tracking (event===undefined path)
 *
 * These patches are installed globally on EventEmitter.prototype by slothlet's async
 * context manager. A slothlet instance with `runtime: "async"` must be created before
 * these code paths are reachable.
 *
 * Tests use the filtered BASIC_MATRIX (runtime: "async" only) since the patches are
 * only applied by the async context manager.
 *
 * @module tests/vitests/suites/context/eventemitter-lifecycle.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import { BASIC_MATRIX, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(BASIC_MATRIX)("EventEmitter Lifecycle Patches > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		// Creating a slothlet instance with async runtime installs the EventEmitter
		// prototype patches (once, prependListener, prependOnceListener,
		// removeListener, removeAllListeners). These patches apply globally across
		// all EventEmitter instances for the lifetime of the process.
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user" }
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	// ─── .once() ──────────────────────────────────────────────────────────────

	it("should fire a once-listener exactly once then stop", () => {
		const emitter = new EventEmitter();
		let count = 0;

		const handler = () => {
			count++;
		};

		emitter.once("ping", handler);
		emitter.emit("ping"); // count = 1
		emitter.emit("ping"); // handler is gone after first fire; count stays 1

		expect(count).toBe(1);
	});

	it("should support registering multiple once-listeners", () => {
		const emitter = new EventEmitter();
		const fired = [];

		emitter.once("evt", () => fired.push("a"));
		emitter.once("evt", () => fired.push("b"));

		emitter.emit("evt");
		emitter.emit("evt"); // Neither fires again

		expect(fired).toEqual(["a", "b"]);
	});

	// ─── .prependListener() ───────────────────────────────────────────────────

	it("should prepend a listener so it fires before previously registered listeners", () => {
		const emitter = new EventEmitter();
		const order = [];

		emitter.on("seq", () => order.push("second"));
		emitter.prependListener("seq", () => order.push("first"));

		emitter.emit("seq");

		expect(order).toEqual(["first", "second"]);
	});

	it("should fire a prepended listener on every subsequent emit", () => {
		const emitter = new EventEmitter();
		let count = 0;

		emitter.prependListener("tick", () => {
			count++;
		});

		emitter.emit("tick");
		emitter.emit("tick");
		emitter.emit("tick");

		expect(count).toBe(3);
	});

	// ─── .prependOnceListener() ───────────────────────────────────────────────

	it("should fire a prependOnceListener exactly once, before other listeners", () => {
		const emitter = new EventEmitter();
		const order = [];

		emitter.on("evt", () => order.push("normal"));
		emitter.prependOnceListener("evt", () => order.push("first-once"));

		emitter.emit("evt"); // fires first-once then normal
		emitter.emit("evt"); // only normal fires

		expect(order).toEqual(["first-once", "normal", "normal"]);
	});

	it("should support registering a prependOnceListener when emitter has no existing listeners", () => {
		const emitter = new EventEmitter();
		let count = 0;

		emitter.prependOnceListener("solo", () => {
			count++;
		});

		emitter.emit("solo");
		emitter.emit("solo"); // Should not fire again

		expect(count).toBe(1);
	});

	// ─── .removeListener() / .off() ───────────────────────────────────────────

	it("should remove a specific listener added via .on()", () => {
		const emitter = new EventEmitter();
		let count = 0;

		const handler = () => {
			count++;
		};

		emitter.on("btn", handler);
		emitter.emit("btn"); // count = 1

		emitter.removeListener("btn", handler);
		emitter.emit("btn"); // handler gone; count stays 1

		expect(count).toBe(1);
	});

	it("should remove a listener via the .off() alias", () => {
		const emitter = new EventEmitter();
		let count = 0;

		const handler = () => {
			count++;
		};

		emitter.on("btn", handler);
		emitter.emit("btn"); // count = 1

		emitter.off("btn", handler);
		emitter.emit("btn"); // handler gone; count stays 1

		expect(count).toBe(1);
	});

	it("should only remove the specified listener and leave others intact", () => {
		const emitter = new EventEmitter();
		const fired = [];

		const keepHandler = () => fired.push("keep");
		const removeHandler = () => fired.push("remove");

		emitter.on("evt", keepHandler);
		emitter.on("evt", removeHandler);

		emitter.emit("evt"); // both fire
		emitter.removeListener("evt", removeHandler);
		emitter.emit("evt"); // only keepHandler fires

		expect(fired).toEqual(["keep", "remove", "keep"]);
	});

	it("should be a no-op when removing a listener that was never registered", () => {
		const emitter = new EventEmitter();

		// Should not throw for a listener that isn't tracked
		const unregistered = () => {};
		expect(() => {
			emitter.removeListener("nonexistent", unregistered);
		}).not.toThrow();
	});

	// ─── .removeAllListeners(event) ───────────────────────────────────────────

	it("should remove all listeners for a specific event via removeAllListeners(event)", () => {
		const emitter = new EventEmitter();
		let countA = 0;
		let countB = 0;

		emitter.on("a", () => {
			countA++;
		});
		emitter.on("a", () => {
			countA++;
		});
		emitter.on("b", () => {
			countB++;
		});

		emitter.emit("a"); // countA = 2
		emitter.removeAllListeners("a");
		emitter.emit("a"); // no listeners; countA stays 2
		emitter.emit("b"); // countB = 1

		expect(countA).toBe(2);
		expect(countB).toBe(1);
	});

	it("should leave other events intact when removing all listeners for one event", () => {
		const emitter = new EventEmitter();
		const fired = [];

		emitter.on("keep", () => fired.push("keep"));
		emitter.on("remove", () => fired.push("remove"));

		emitter.removeAllListeners("remove");

		emitter.emit("keep");
		emitter.emit("remove"); // no listeners

		expect(fired).toEqual(["keep"]);
	});

	// ─── .removeAllListeners() (no args - event === undefined path) ───────────

	it("should not throw when calling removeAllListeners() without arguments", () => {
		const emitter = new EventEmitter();

		emitter.on("x", () => {});
		emitter.on("y", () => {});

		// This covers the `event === undefined` branch in runtime_patchRemoveAllListeners.
		// The call must not throw regardless of internal tracking state.
		expect(() => {
			emitter.removeAllListeners();
		}).not.toThrow();
	});

	it("should cover the removeAllListeners() no-tracking-data branch", () => {
		// A fresh emitter with no slothlet tracking at all
		const emitter = new EventEmitter();
		emitter.on("z", () => {});

		// Remove a specific event first so tracking is partially cleared
		emitter.removeAllListeners("z");

		// Then call without args - hits the branch where emitterTracking may be absent
		expect(() => {
			emitter.removeAllListeners();
		}).not.toThrow();
	});
});
