/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-listener-semantics.test.vitest.mjs
 *	@Date: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Ordinary EventEmitter semantics must survive slothlet's listener wrapping.
 *
 * @description
 * Slothlet patches `EventEmitter.prototype` and wraps listeners registered inside an api context so
 * they can still reach `self` and `context` when the event fires later. Every wrap is a chance to
 * change something a caller depends on but nobody asserts: `this`, argument passthrough, return
 * values, the identity and type of a thrown error, firing order, `once` semantics, removal by
 * original reference, and re-entrant emits.
 *
 * The existing EventEmitter suites cover wrapper *bookkeeping* — how many wrappers exist, and that
 * emitters do not cross-fire. This one covers the *contract of calling a listener*, which is what a
 * change to the wrapper is most likely to break silently. Error identity in particular: the
 * re-entry path can wrap a throw as `CONTEXT_EXECUTION_FAILED`, which would rewrite errors an
 * `error` handler is meant to receive.
 *
 * Everything here is behaviour that holds independently of slothlet, so it is a regression net
 * rather than a description of slothlet's own features.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("EventEmitter listener semantics > $name", ({ config }) => {
	let api;

	beforeEach(async () => {
		// Instantiating slothlet installs the prototype patches; the emitters below are created while
		// an instance is live, which is the case the wrapping applies to.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, context: { user: "test-user" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("passes every argument through unchanged, including undefined and objects", async () => {
		const emitter = new EventEmitter();
		const seen = [];
		const payload = { nested: { deep: 1 } };
		emitter.on("evt", (...args) => seen.push(args));

		emitter.emit("evt", 1, "two", undefined, null, payload);

		expect(seen).toHaveLength(1);
		expect(seen[0]).toHaveLength(5);
		expect(seen[0][2]).toBeUndefined();
		expect(seen[0][3]).toBeNull();
		// Same reference, not a clone.
		expect(seen[0][4]).toBe(payload);
	});

	it("calls the listener with the emitter as `this`", async () => {
		const emitter = new EventEmitter();
		let observed = null;
		emitter.on("evt", function () {
			observed = this;
		});

		emitter.emit("evt");

		expect(observed).toBe(emitter);
	});

	it("propagates a listener's throw unchanged — same instance, message and type", async () => {
		const emitter = new EventEmitter();
		const thrown = new TypeError("listener blew up");
		emitter.on("evt", () => {
			throw thrown;
		});

		let caught = null;
		try {
			emitter.emit("evt");
		} catch (err) {
			caught = err;
		}

		// Identity, not just shape: re-wrapping would preserve neither.
		expect(caught).toBe(thrown);
		expect(caught).toBeInstanceOf(TypeError);
		expect(caught.message).toBe("listener blew up");
	});

	it("delivers a plain Error to an `error` handler rather than a substitute", async () => {
		const emitter = new EventEmitter();
		const failure = new Error("boom");
		const received = [];
		emitter.on("error", (err) => received.push(err));

		emitter.emit("error", failure);

		expect(received).toEqual([failure]);
	});

	it("fires multiple listeners in registration order", async () => {
		const emitter = new EventEmitter();
		const order = [];
		emitter.on("evt", () => order.push("first"));
		emitter.on("evt", () => order.push("second"));
		emitter.prependListener("evt", () => order.push("prepended"));

		emitter.emit("evt");

		expect(order).toEqual(["prepended", "first", "second"]);
	});

	it("honours once(): fires exactly once across repeated emits", async () => {
		const emitter = new EventEmitter();
		let calls = 0;
		emitter.once("evt", () => calls++);

		emitter.emit("evt");
		emitter.emit("evt");
		emitter.emit("evt");

		expect(calls).toBe(1);
		expect(emitter.listenerCount("evt")).toBe(0);
	});

	it("removes a listener by its original reference", async () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const listener = () => calls++;
		emitter.on("evt", listener);
		emitter.emit("evt");

		emitter.removeListener("evt", listener);
		emitter.emit("evt");

		expect(calls).toBe(1);
		expect(emitter.listenerCount("evt")).toBe(0);
	});

	it("supports a re-entrant emit from inside a listener", async () => {
		const emitter = new EventEmitter();
		const order = [];
		emitter.on("outer", () => {
			order.push("outer");
			emitter.emit("inner");
			order.push("outer-done");
		});
		emitter.on("inner", () => order.push("inner"));

		emitter.emit("outer");

		expect(order).toEqual(["outer", "inner", "outer-done"]);
	});

	it("reports emit() truthiness by whether a listener was present", async () => {
		const emitter = new EventEmitter();
		expect(emitter.emit("nobody")).toBe(false);
		emitter.on("somebody", () => {});
		expect(emitter.emit("somebody")).toBe(true);
	});

	it("runs an async listener to completion, and its rejection is the listener's own", async () => {
		const emitter = new EventEmitter();
		const failure = new Error("async boom");
		let settled = null;
		let rejected = null;

		emitter.on("ok", async () => {
			await null;
			settled = "done";
		});
		emitter.on("bad", async () => {
			await null;
			throw failure;
		});

		emitter.emit("ok");
		// Capture the listener's own promise so the rejection can be inspected rather than escaping.
		const [handler] = emitter.listeners("bad");
		await Promise.resolve(handler()).catch((err) => {
			rejected = err;
		});

		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(settled).toBe("done");
		expect(rejected).toBe(failure);
	});

	it("keeps listeners of separate emitters independent", async () => {
		const first = new EventEmitter();
		const second = new EventEmitter();
		const hits = [];
		first.on("evt", () => hits.push("first"));
		second.on("evt", () => hits.push("second"));

		first.emit("evt");

		expect(hits).toEqual(["first"]);
	});
});
