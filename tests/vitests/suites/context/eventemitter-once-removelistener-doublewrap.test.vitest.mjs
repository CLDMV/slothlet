/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-once-removelistener-doublewrap.test.vitest.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 18:57:23 -07:00 (1779933443)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression tests for the once/removeListener double-wrap
 * interaction in `src/lib/helpers/eventemitter-context.mjs`.
 *
 * Root cause: `runtime_patchOnce` (and its prepend cousin) delegates the
 * actual attachment to the saved-original native `EventEmitter.prototype.once`.
 * Native `once` internally calls `this.on(event, _onceWrap(...))`. Because
 * `this.on` has been replaced on the prototype, that internal call routes
 * through the PATCHED `on` — which sees the `_onceWrap_output` (a fresh
 * function with no `_slothletOriginal` marker), wraps it AGAIN as L2, and
 * attaches L2 to the listener array via the saved-original `on`.
 *
 * The tracking map then has:
 *   (emitter, event, userFn)             → runtime_onceWrapper   (from once-patch)
 *   (emitter, event, _onceWrap_output)   → L2                    (from on-patch invoked inside native once)
 * Listener array: `[L2]`
 *
 * `removeListener(event, userFn)` resolves to `runtime_onceWrapper` and tries
 * to remove THAT from the listener array — but the array holds `L2`. Native
 * `removeListener` uses reference equality (and the `.listener` fallback);
 * `L2 !== runtime_onceWrapper`, and `L2.listener` is unset, so the removal
 * silently no-ops. The wrapped listener stays attached.
 *
 * Real-world impact (the originating report): `@redis/client`'s socket
 * layer uses `socket.once('timeout', fn) + socket.removeListener('timeout', fn)`
 * to install a transient connect-timeout listener. Under slothlet patching,
 * the `removeListener` no-ops, the lingering once-wrapper stays armed, and
 * the TCP idle timer fires ~5s after handshake → `socket.destroy` → reconnect
 * loop every 5–8s.
 *
 * Fix: implement once/prependOnceListener directly inside the patches without
 * delegating to native once. Attach via saved-original `on`/`prependListener`,
 * auto-cleanup via saved-original `removeListener`, and set the wrapper's
 * `.listener` property to the user fn to mirror Node's contract for libraries
 * that introspect `rawListeners()[i].listener`.
 *
 * Pre-fix expected failure shape: `once(fn)` + `removeListener(fn)` (BEFORE
 * emit) → `emit` still invokes `fn` and `listenerCount` returns 1, not 0.
 *
 * @module tests/vitests/suites/context/eventemitter-once-removelistener-doublewrap.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("EventEmitter — once+removeListener double-wrap regression", () => {
	let api;
	beforeAll(async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true
		});
	});
	afterAll(async () => {
		await api?.shutdown?.();
	});

	// ─── Core double-wrap regression (once + removeListener BEFORE emit) ───

	it("once(fn) + removeListener(fn) before emit → emit does NOT fire fn", () => {
		// Pre-fix: native `once` routes through patched `on`, which wraps the
		// internal _onceWrap_output a SECOND time (L2). The tracking map maps
		// userFn → runtime_onceWrapper, but the listener array holds L2.
		// removeListener(userFn) tries to remove runtime_onceWrapper from
		// the array; native ref-equality scan misses L2; no-op; emit fires fn.
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.once("e", fn);
		emitter.removeListener("e", fn);
		emitter.emit("e");

		expect(calls).toBe(0); // PRE-FIX FAILS: calls === 1 (the chain through L2 fires fn)
		expect(emitter.listenerCount("e")).toBe(0); // PRE-FIX FAILS: count === 1 (L2 still attached)
	});

	it("once(fn) + off(fn) before emit → emit does NOT fire fn (off is removeListener alias)", () => {
		// Same regression surface via the `off` alias.
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.once("e", fn);
		emitter.off("e", fn);
		emitter.emit("e");

		expect(calls).toBe(0);
		expect(emitter.listenerCount("e")).toBe(0);
	});

	it("prependOnceListener(fn) + removeListener(fn) before emit → emit does NOT fire fn", () => {
		// `runtime_patchPrependOnceListener` has the same delegation pattern
		// against the saved-original native `prependOnceListener` — same double-
		// wrap symptom, same fix.
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.prependOnceListener("e", fn);
		emitter.removeListener("e", fn);
		emitter.emit("e");

		expect(calls).toBe(0);
		expect(emitter.listenerCount("e")).toBe(0);
	});

	// ─── Node's `.listener` contract for library introspection ──────────────

	it("once(fn) wrapper exposes `.listener === fn` on rawListeners() — Node contract", () => {
		// Native EventEmitter sets the once-wrapper's `.listener = userFn`
		// so libraries (and Node's own removeListener .listener fallback path)
		// can introspect. Slothlet's wrapper must preserve this contract or
		// downstream library code (e.g. some HTTP / WebSocket clients) misses.
		const emitter = new EventEmitter();
		const fn = () => {};

		emitter.once("e", fn);
		const listeners = emitter.rawListeners("e");

		expect(listeners.length).toBe(1);
		expect(listeners[0].listener).toBe(fn);
	});

	it("prependOnceListener(fn) wrapper exposes `.listener === fn` — same contract as once", () => {
		const emitter = new EventEmitter();
		const fn = () => {};

		emitter.prependOnceListener("e", fn);
		const listeners = emitter.rawListeners("e");

		expect(listeners.length).toBe(1);
		expect(listeners[0].listener).toBe(fn);
	});

	// ─── Field-report shape: connect-timeout install/cancel pattern ─────────

	it("connect-timeout flap shape — once(timeout, fn) + removeListener after handshake leaves no listener", () => {
		// Reproduces the `@redis/client@5.12.1` socket.ts:221-244 pattern:
		// install a transient `timeout` listener via `once`, then remove it
		// once the handshake event fires. Pre-fix this loops forever because
		// the removeListener no-ops and the timer keeps re-arming the listener.
		const socket = new EventEmitter();
		let calls = 0;
		const onTimeout = () => {
			calls++;
		};

		// Install transient timeout listener
		socket.once("timeout", onTimeout);
		expect(socket.listenerCount("timeout")).toBe(1);

		// Handshake completes → remove the transient listener
		socket.removeListener("timeout", onTimeout);
		expect(socket.listenerCount("timeout")).toBe(0); // PRE-FIX: still 1

		// Idle TCP timer fires later → emit "timeout"
		socket.emit("timeout");
		expect(calls).toBe(0); // PRE-FIX: 1 (would destroy the socket and loop)
	});

	// ─── Sanity: once still fires when NOT explicitly removed ───────────────

	it("once(fn) without remove → emit fires fn exactly once and self-removes", () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.once("e", fn);
		emitter.emit("e");
		emitter.emit("e");
		emitter.emit("e");

		expect(calls).toBe(1);
		expect(emitter.listenerCount("e")).toBe(0);
	});

	it("prependOnceListener(fn) without remove → emit fires fn exactly once", () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.prependOnceListener("e", fn);
		emitter.emit("e");
		emitter.emit("e");

		expect(calls).toBe(1);
		expect(emitter.listenerCount("e")).toBe(0);
	});

	// ─── Combined: ensure the existing multi-register guard still holds ─────

	it("two once(fn) + two removeListener(fn) before emit → 0 listeners, 0 fires", () => {
		// Cross-check that the multi-register array tracking from #109 still
		// works in concert with the once-double-wrap fix.
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.once("e", fn);
		emitter.once("e", fn);
		expect(emitter.listenerCount("e")).toBe(2);

		emitter.removeListener("e", fn);
		emitter.removeListener("e", fn);
		expect(emitter.listenerCount("e")).toBe(0);

		emitter.emit("e");
		expect(calls).toBe(0);
	});
});
