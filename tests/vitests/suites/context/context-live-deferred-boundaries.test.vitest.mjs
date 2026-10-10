/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-deferred-boundaries.test.vitest.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Deferred work from promise reactions and `on*` handlers runs as the module that registered it (#595).
 *
 * @description
 * With exactly one call suspended, the live runtime treats any code it cannot attribute as that call.
 * A fire-and-forget promise reaction, or an `on*` handler property a DOM-like object fires, was such
 * code: it ran with no identity of its own and was attributed to the suspended call. Both boundaries
 * now carry the registering module's identity, the way timers and `addEventListener` already did.
 *
 * Fixture: `api_tests/api_test_live_caller_identity` — `pane.hold` stays suspended; `other` registers
 * the deferred work, which calls `c.probe` and records who `c.probe` says called it.
 *
 * @module tests/vitests/suites/context/context-live-deferred-boundaries
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, getBrowserMatrixConfigs, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../api_tests/api_test_live_caller_identity");

const PLATFORMS = [
	...getMatrixConfigs().map(({ name, config }) => ({ name: `node > ${name}`, config, browser: false })),
	...getBrowserMatrixConfigs().map(({ name, config }) => ({ name: `browser > ${name}`, config, browser: true }))
];

/** Handler storage for the DOM-like element below. */
const handlers = new WeakMap();

/**
 * A DOM-like element: an `EventTarget` whose interface declares an `onclick` IDL accessor on its
 * prototype, fired synchronously by the host the way a platform dispatch would run it.
 */
class FakeElement extends EventTarget {
	/**
	 * Run the assigned handler.
	 * @returns {*} The handler's return value.
	 */
	fire() {
		return handlers.get(this)?.call(this, new Event("click"));
	}
}
Object.defineProperty(FakeElement.prototype, "onclick", {
	configurable: true,
	enumerable: true,
	get() {
		return handlers.get(this) ?? null;
	},
	set(value) {
		handlers.set(this, value);
	}
});

let MANIFEST;
let previousHTMLElement;

beforeAll(async () => {
	MANIFEST = await getManifest(ROOT);
	// Installed before any instance exists, as a browser's interfaces are, so the boundary patches see it.
	previousHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
	Object.defineProperty(globalThis, "HTMLElement", { value: FakeElement, writable: true, configurable: true });
});

afterAll(() => {
	if (previousHTMLElement) Object.defineProperty(globalThis, "HTMLElement", previousHTMLElement);
	else delete globalThis.HTMLElement;
});

/**
 * A promise and the function that releases it.
 * @returns {[Promise<void>, Function]} Gate and release.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => (release = resolve));
	return [promise, release];
}

/**
 * Let every pending microtask and one timer turn run.
 * @returns {Promise<void>} Resolves on the next macrotask.
 */
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

describe.each(PLATFORMS)(
	"Live runtime > deferred work is attributed to the module that registered it (#595) > $name",
	({ config, browser }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Boot the fixture instance and leave `pane.hold` suspended.
		 * @returns {Promise<Function>} Releases the suspended call and waits for it.
		 */
		async function bootWithSuspendedCall() {
			const base = browser ? makeBrowserConfig(config, ROOT, MANIFEST) : { ...config, base: ROOT };
			api = await slothlet({ ...base, silent: true });
			const [held, release] = gate();
			// Wait until the body is running: a lazy leaf enters only once its module has loaded.
			const [entered, markEntered] = gate();
			const pending = api.pane.hold(held, markEntered);
			await entered;
			await turn();
			return async () => {
				release();
				expect(await pending).toBe("held");
			};
		}

		it.each(["then", "catch", "finally", "thenable"])(
			"a fire-and-forget %s reaction runs as the module that registered it",
			async (kind) => {
				const settle = await bootWithSuspendedCall();
				expect(await api.other.kick(kind)).toBe(true);
				await turn();
				expect(await api.other.results()).toEqual(["other.kick"]);
				await settle();
			}
		);

		it("a reaction the host registers while a call is suspended is not pinned to that call", async () => {
			const base = browser ? makeBrowserConfig(config, ROOT, MANIFEST) : { ...config, base: ROOT };
			api = await slothlet({ ...base, silent: true });
			const [held, release] = gate();
			// Registered by the host while pane.hold is in flight; runs once it has settled.
			const after = api.pane.hold(held).then(() => api.c.probe());
			await turn();
			release();
			expect(await after).toBe(null);
		});

		it.each([
			["a timer", (fn) => new Promise((resolve) => setTimeout(() => resolve(fn()), 0))],
			["a promise reaction", (fn) => Promise.resolve().then(fn)]
		])("%s the host registers while a call is suspended runs as the host, not as that call", async (_label, schedule) => {
			const settle = await bootWithSuspendedCall();
			// Fires while pane.hold is still the only call in flight.
			expect(await schedule(() => api.c.probe())).toBe(null);
			await settle();
		});

		it("two concurrent calls of one leaf, each registering after its await, are both pinned to that leaf", async () => {
			const base = browser ? makeBrowserConfig(config, ROOT, MANIFEST) : { ...config, base: ROOT };
			api = await slothlet({ ...base, silent: true });
			const [firstGate, releaseFirst] = gate();
			const [secondGate, releaseSecond] = gate();
			const first = api.twin.twice(firstGate);
			const second = api.twin.twice(secondGate);
			await turn();
			// Both suspended in the same file under the same api path: the stack cannot say which is
			// running, but either way the registering module is twin.twice.
			releaseFirst();
			releaseSecond();
			const expected = { timer: "twin.twice", reaction: "twin.twice" };
			expect(await first).toEqual(expected);
			expect(await second).toEqual(expected);
		});

		// The element fires its handler synchronously from the host, which no AsyncLocalStorage context
		// spans: under the async runtime there is no caller there to carry, so this is live-only.
		it.runIf(config.runtime === "live")("an on* handler property a DOM-like object fires runs as the module that assigned it", async () => {
			const settle = await bootWithSuspendedCall();
			const element = new FakeElement();
			expect(await api.other.assign(element, "onclick")).toBe(true);
			await element.fire();
			await turn();
			expect(await api.other.results()).toEqual(["other.assign"]);
			await settle();
		});
	}
);
