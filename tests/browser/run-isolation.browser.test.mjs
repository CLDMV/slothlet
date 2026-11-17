/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/run-isolation.browser.test.mjs
 *	@Date: 2026-11-17T12:00:00-08:00 (1794945600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T12:00:00-08:00 (1794945600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Interleaved `context.run()` flows in a browser: a callback a flow registers through a boundary slothlet
 * patches (a timer, a microtask, an animation frame, a DOM event listener, an explicit `then` / `catch` / `finally`) runs
 * in that flow, whichever flow was opened last. A browser has no promise hooks, so the code after a bare `await` is not
 * covered here (documented in CONTEXT-PROPAGATION.md).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

/**
 * A promise and the function that settles it.
 * @returns {{promise: Promise<void>, release: function(): void, fail: function(*): void}} The gate.
 */
function gate() {
	let release;
	let fail;
	const promise = new Promise((resolve, reject) => {
		release = resolve;
		fail = reject;
	});
	return { promise, release, fail };
}

describe.each([undefined, "off", "on"])("interleaved context.run() flows in a browser > permissions %s", (mode) => {
	let api = null;

	beforeAll(async () => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
		api = await slothlet({
			base: BASE,
			loader: { platform: "browser", files: manifest, resolve: ({ path }) => new URL(path, BASE).href },
			mode: "eager",
			context: { tag: "base" },
			...(mode ? { permissions: { mode, policy: "allow" } } : {})
		});
	});

	afterAll(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Two `run()` flows that each read their context through a route, the second opened while the first waits.
	 * @param {function(function(): string, number): Promise<string>} later - Runs the read through the route in flow `index`.
	 * @param {function(): void} [pickUp] - Lets the waiting reads run.
	 * @returns {Promise<string[]>} The tags the flows read, in open order.
	 */
	const interleave = (later, pickUp) => {
		const read = () => api.slothlet.context.get().tag;
		const first = api.slothlet.context.run({ tag: "one" }, () => later(read, 0));
		const second = api.slothlet.context.run({ tag: "two" }, () => later(read, 1));
		pickUp?.();
		return Promise.all([first, second]);
	};

	it("a timer", async () => {
		expect(await interleave((read, index) => new Promise((resolve) => setTimeout(() => resolve(read()), index === 0 ? 5 : 25)))).toEqual([
			"one",
			"two"
		]);
	});

	it("queueMicrotask", async () => {
		expect(await interleave((read) => new Promise((resolve) => queueMicrotask(() => resolve(read()))))).toEqual(["one", "two"]);
	});

	it("requestAnimationFrame", async () => {
		expect(await interleave((read) => new Promise((resolve) => requestAnimationFrame(() => resolve(read()))))).toEqual(["one", "two"]);
	});

	it("a DOM event listener", async () => {
		const target = new EventTarget();
		const seen = interleave(
			(read, index) => new Promise((resolve) => target.addEventListener(`e${index}`, () => resolve(read()), { once: true })),
			() => {
				target.dispatchEvent(new Event("e0"));
				target.dispatchEvent(new Event("e1"));
			}
		);
		expect(await seen).toEqual(["one", "two"]);
	});

	it("then / catch / finally", async () => {
		const gates = [gate(), gate(), gate(), gate(), gate(), gate()];
		const seen = interleave(
			(read, index) =>
				Promise.all([
					gates[index].promise.then(read),
					gates[index + 2].promise.catch(read),
					new Promise((resolve) => gates[index + 4].promise.finally(() => resolve(read())))
				]).then(([a, b, c]) => (a === b && b === c ? a : `${a}/${b}/${c}`)),
			() => {
				gates[0].release();
				gates[1].release();
				gates[2].fail(new Error("x"));
				gates[3].fail(new Error("x"));
				gates[4].release();
				gates[5].release();
			}
		);
		expect(await seen).toEqual(["one", "two"]);
	});

	it("host code outside every run() sees the instance's own context", async () => {
		const hold = gate();
		const open = api.slothlet.context.run({ tag: "one" }, () => hold.promise);
		const tag = await new Promise((resolve) => setTimeout(() => resolve(api.slothlet.context.get().tag), 5));
		hold.release();
		await open;
		expect(tag).toBe("base");
	});
});
