/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-table-edges.test.vitest.mjs
 *	@Date: 2026-11-25T01:27:54-08:00 (1795598874)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:30-08:00 (1795600290)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The EventEmitter patch when the emitter's listener table was edited by hand, and under a second copy.
 *
 * @description
 * Node keeps an emitter's listeners in `emitter._events`, which code can edit directly. A tracked listener the table
 * no longer holds is removed as tracked: `removeListener` takes the wrapper off (a no-op for Node) and drops the
 * tracking, as without slothlet the call removes nothing. Shutdown's cleanup puts the original listeners back into the
 * table where it still holds the wrappers, and leaves an entry it does not recognise as it is.
 *
 * A copy of the patch disabled while another copy's patch sits over it passes `once`, `prependListener` and
 * `prependOnceListener` straight through, so the other copy still sees each registration once.
 * @module tests/vitests/suites/context/eventemitter-table-edges
 */

import { EventEmitter } from "node:events";
import { pathToFileURL } from "node:url";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
	enableEventEmitterPatching,
	disableEventEmitterPatching,
	setApiContextChecker,
	cleanupEventEmitterResources
} from "#helpers/eventemitter-context";
import { internalLibPath } from "../../setup/internal-resolve.mjs";

describe("Context > EventEmitter > a listener table edited by hand", () => {
	beforeAll(() => enableEventEmitterPatching());
	afterAll(() => disableEventEmitterPatching());

	it("removes a tracked listener the table no longer holds without throwing, and the rest still run", () => {
		const emitter = new EventEmitter();
		const seen = [];
		const a = () => seen.push("a");
		const b = () => seen.push("b");
		emitter.on("x", a);
		emitter.on("x", a);
		emitter.on("y", b);
		const table = emitter._events.x;
		// Edited by hand: the "x" entry is gone.
		delete emitter._events.x;
		expect(() => emitter.removeListener("x", a)).not.toThrow();
		expect(() => emitter.removeListener("x", a)).not.toThrow();
		expect(Array.isArray(table)).toBe(true);
		emitter.emit("x");
		emitter.emit("y");
		expect(seen).toEqual(["b"]);
		emitter.removeListener("y", b);
		expect(emitter.listenerCount("y")).toBe(0);
	});

	it("removes as tracked when the table holds another function, or no object, for the event", () => {
		const emitter = new EventEmitter();
		const a = () => {};
		const other = () => {};
		emitter.on("x", a);
		emitter._events.x = other;
		emitter.removeListener("x", a);
		// Node removes nothing that is not `a`.
		expect(emitter._events.x).toBe(other);

		const second = new EventEmitter();
		second.on("x", a);
		second._events.x = 5;
		expect(() => second.removeListener("x", a)).not.toThrow();
		expect(second._events.x).toBe(5);

		const third = new EventEmitter();
		third.on("x", a);
		third._events = undefined;
		expect(() => third.removeListener("x", a)).not.toThrow();
	});

	it("removes the listener itself when the table's last entry for it is the listener, not a wrapper", () => {
		const emitter = new EventEmitter();
		const a = () => {};
		emitter.on("x", a);
		const wrapper = emitter._events.x;
		// Added straight into the table, past the patch.
		emitter._events.x = [wrapper, a];
		emitter.removeListener("x", a);
		// Node takes off the last entry that is `a`: the one added by hand.
		expect(emitter._events.x).toBe(wrapper);
	});

	it("removes as tracked when the array holds neither the listener nor a wrapper of it", () => {
		const emitter = new EventEmitter();
		const a = () => {};
		const other = () => {};
		emitter.on("x", a);
		emitter._events.x = [other, other];
		emitter.removeListener("x", a);
		expect(emitter._events.x).toEqual([other, other]);
	});
});

describe("Context > EventEmitter > cleanup of a table edited by hand", () => {
	beforeAll(() => enableEventEmitterPatching());
	afterAll(() => {
		setApiContextChecker(null);
		disableEventEmitterPatching();
	});

	it("puts originals back where the table holds the wrappers and leaves other entries as they are", () => {
		setApiContextChecker(() => true);
		const emitter = new EventEmitter();
		const a = () => {};
		const b = () => {};
		const c = () => {};
		const stranger = () => {};
		emitter.on("x", a);
		emitter.on("y", b);
		emitter.on("y", stranger);
		emitter.on("z", c);
		setApiContextChecker(null);
		// "y" holds a function slothlet never saw next to its wrapper; "z" no longer holds anything.
		emitter._events.y = [stranger, emitter._events.y[0]];
		emitter._events.z = undefined;
		cleanupEventEmitterResources();
		expect(emitter._events.x).toBe(a);
		expect(emitter._events.y).toEqual([stranger, b]);
		expect(emitter._events.z).toBe(undefined);
	});
});

describe("Context > EventEmitter > a copy disabled under another copy's patch", () => {
	const self = { enableEventEmitterPatching, disableEventEmitterPatching };
	let copies = 0;
	let loaded = [];
	afterEach(() => {
		for (const copy of loaded) copy.disableEventEmitterPatching();
		loaded = [];
	});

	/**
	 * Another copy of the module.
	 * @returns {Promise<object>} The copy.
	 */
	const another = () => import(`${pathToFileURL(internalLibPath("helpers/eventemitter-context.mjs")).href}?copy=table-edges-${++copies}`);

	/**
	 * Enable `lower`, then `upper` over it, disable `lower`, and register through every method.
	 * @param {object} lower - The copy disabled under the other.
	 * @param {object} upper - The copy left on top.
	 * @returns {void}
	 */
	function underAnother(lower, upper) {
		loaded = [lower, upper];
		const original = {
			once: EventEmitter.prototype.once,
			prependListener: EventEmitter.prototype.prependListener,
			prependOnceListener: EventEmitter.prototype.prependOnceListener
		};
		lower.enableEventEmitterPatching();
		upper.enableEventEmitterPatching();
		lower.disableEventEmitterPatching();

		const emitter = new EventEmitter();
		const seen = [];
		emitter.once("x", () => seen.push("once"));
		emitter.prependListener("x", () => seen.push("prepend"));
		emitter.prependOnceListener("x", () => seen.push("prependOnce"));
		emitter.emit("x");
		emitter.emit("x");
		expect(seen).toEqual(["prependOnce", "prepend", "once", "prepend"]);

		// A `once` listener read back with rawListeners() is the upper copy's one-shot wrapper: registered again, it is
		// passed through to the lower copy's method, which attaches it as given. As with Node's own one-shot wrapper, the
		// listener runs once in all, however often the wrapper is registered or called.
		const source = new EventEmitter();
		source.once("y", () => seen.push("raw"));
		const raw = source.rawListeners("y")[0];
		const target = new EventEmitter();
		target.once("z", raw);
		target.prependListener("z", raw);
		target.prependOnceListener("z", raw);
		seen.length = 0;
		target.emit("z");
		expect(seen).toEqual(["raw"]);
		target.emit("z");
		expect(seen).toEqual(["raw"]);
		expect(source.listenerCount("y")).toBe(0);

		upper.disableEventEmitterPatching();
		expect(EventEmitter.prototype.once).toBe(original.once);
		expect(EventEmitter.prototype.prependListener).toBe(original.prependListener);
		expect(EventEmitter.prototype.prependOnceListener).toBe(original.prependOnceListener);
	}

	it("passes registrations through this copy disabled under another, and each listener runs as registered", async () => {
		underAnother(self, await another());
	});

	it("passes registrations through another copy disabled under this one", async () => {
		underAnother(await another(), self);
	});
});
