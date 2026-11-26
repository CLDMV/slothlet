/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventtarget-signal-edges.test.vitest.mjs
 *	@Date: 2026-11-25T01:44:19-08:00 (1795599859)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:15:11-08:00 (1795601711)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `addEventListener` with a `signal`, at the edges: an aborted signal for a listener already registered,
 * a signal that aborts after the patch was turned off, and a host `addEventListener` that takes a signal that is no
 * object.
 *
 * @description
 * A listener registered with a `signal` is taken off by the platform when the signal aborts; the patch ends the
 * listener's work then too. Checked against what the platform does without the patch:
 *
 * - registering a listener again with a signal that has already aborted changes nothing: the registration in place
 *   stays and the listener still runs;
 * - a signal that aborts after the patch was turned off still takes the listener off;
 * - a host whose `addEventListener` (installed before slothlet's patch, as a library would) ignores a `signal` that
 *   is no object registers the listener, and the patch does not listen to such a signal.
 * @module tests/vitests/suites/context/eventtarget-signal-edges
 */

import { describe, it, expect, afterEach } from "vitest";
import { enableEventTargetPatching, disableEventTargetPatching } from "#helpers/eventtarget-context";

afterEach(() => disableEventTargetPatching());

describe("Context > EventTarget signals > edges", () => {
	it("keeps a registration in place when the listener is registered again with an aborted signal", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		let seen = 0;
		const listener = () => seen++;
		target.addEventListener("x", listener);
		const aborted = new AbortController();
		aborted.abort();
		target.addEventListener("x", listener, { signal: aborted.signal });
		target.dispatchEvent(new Event("x"));
		expect(seen).toBe(1);
		target.removeEventListener("x", listener);
		target.dispatchEvent(new Event("x"));
		expect(seen).toBe(1);
	});

	it("takes the listener off when its signal aborts after the patch was turned off", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		let seen = 0;
		const controller = new AbortController();
		target.addEventListener("x", () => seen++, { signal: controller.signal });
		disableEventTargetPatching();
		controller.abort();
		target.dispatchEvent(new Event("x"));
		expect(seen).toBe(0);
	});

	it("registers through a host addEventListener that ignores a signal that is no object", () => {
		const native = EventTarget.prototype.addEventListener;
		const lenient = function addEventListener(type, listener, options) {
			if (options !== null && typeof options === "object" && options.signal !== undefined && typeof options.signal !== "object") {
				const rest = { ...options };
				delete rest.signal;
				return native.call(this, type, listener, rest);
			}
			return native.call(this, type, listener, options);
		};
		EventTarget.prototype.addEventListener = lenient;
		try {
			enableEventTargetPatching();
			const target = new EventTarget();
			let seen = 0;
			const listener = () => seen++;
			target.addEventListener("x", listener, { signal: 5 });
			target.dispatchEvent(new Event("x"));
			expect(seen).toBe(1);
			target.removeEventListener("x", listener, { signal: 5 });
			target.dispatchEvent(new Event("x"));
			expect(seen).toBe(1);
			disableEventTargetPatching();
			expect(EventTarget.prototype.addEventListener).toBe(lenient);
		} finally {
			EventTarget.prototype.addEventListener = native;
		}
	});
});
