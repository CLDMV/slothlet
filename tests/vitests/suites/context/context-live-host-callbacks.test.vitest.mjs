/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-host-callbacks.test.vitest.mjs
 *	@Date: 2026-10-09T21:00:00-07:00 (1791604800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T21:00:00-07:00 (1791604800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A host-registered deferred callback runs as the host for every instance it calls, and through its own awaits.
 *
 * @description
 * The live runtime pins a callback the host registers while a call is suspended so it runs as the host
 * (#595), rather than being attributed to whichever call is then the only one suspended. Two gaps:
 *
 * - The pin named only the store the registration happened to resolve to. A callback calling into a
 *   second instance, whose own lone suspended call could not see that pin, was attributed to it.
 * - The pin covered only the callback's synchronous prefix. After an `await` inside an async callback,
 *   the lone suspended call was again taken to be the caller.
 *
 * Fixtures: `api_tests/api_test_live_caller_identity` (`pane.hold` stays suspended, `c.probe` reports its
 * caller) and `api_tests/api_test_live_caller_identity_second` (`g.hold` stays suspended).
 *
 * @module tests/vitests/suites/context/context-live-host-callbacks
 */

import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, getBrowserMatrixConfigs, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../api_tests/api_test_live_caller_identity");
const SECOND = path.resolve(__dirname, "../../../../api_tests/api_test_live_caller_identity_second");

const PLATFORMS = [
	...getMatrixConfigs().map(({ name, config }) => ({ name: `node > ${name}`, config, browser: false })),
	...getBrowserMatrixConfigs().map(({ name, config }) => ({ name: `browser > ${name}`, config, browser: true }))
];

let MANIFEST;
let SECOND_MANIFEST;

beforeAll(async () => {
	MANIFEST = await getManifest(ROOT);
	SECOND_MANIFEST = await getManifest(SECOND);
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

/**
 * Run a callback from a timer the host registers now, and resolve with what it returns.
 * @param {Function} fn - The callback; may be async.
 * @returns {Promise<*>} Its result.
 */
const fromHostTimer = (fn) => new Promise((resolve, reject) => setTimeout(() => Promise.resolve(fn()).then(resolve, reject), 0));

describe.each(PLATFORMS)("Live runtime > a host-registered callback runs as the host > $name", ({ config, browser }) => {
	const instances = [];

	afterEach(async () => {
		while (instances.length) await instances.pop().shutdown();
	});

	/**
	 * Create an instance and track it for shutdown.
	 * @param {string} dir - Base folder.
	 * @param {object} manifest - Browser manifest for that folder.
	 * @returns {Promise<object>} The api.
	 */
	async function create(dir, manifest) {
		const base = browser ? makeBrowserConfig(config, dir, manifest) : { ...config, base: dir };
		const api = await slothlet({ ...base, silent: true });
		instances.push(api);
		return api;
	}

	/**
	 * Leave `pane.hold` suspended on `api`.
	 * @param {object} api - Instance api.
	 * @returns {Promise<Function>} Releases the suspended call and waits for it.
	 */
	async function suspendPane(api) {
		const [held, release] = gate();
		const [entered, markEntered] = gate();
		const pending = api.pane.hold(held, markEntered);
		await entered;
		await turn();
		return async () => {
			release();
			expect(await pending).toBe("held");
		};
	}

	/**
	 * Leave `g.hold` suspended on `api`.
	 * @param {object} api - Instance api of the second fixture.
	 * @returns {Promise<Function>} Releases the suspended call and waits for it.
	 */
	async function suspendG(api) {
		const [held, release] = gate();
		const pending = api.g.hold(held);
		await turn();
		return async () => {
			release();
			expect(await pending).toBe("g");
		};
	}

	it.each([
		["the other instance's call was entered last", true],
		["the called instance's call was entered last", false]
	])(
		"a host timer calling into one instance while another instance has a call suspended runs as the host (%s)",
		async (_label, otherLast) => {
			const api = await create(ROOT, MANIFEST);
			const second = await create(SECOND, SECOND_MANIFEST);
			const settle = [];
			if (otherLast) {
				settle.push(await suspendPane(api));
				settle.push(await suspendG(second));
			} else {
				settle.push(await suspendG(second));
				settle.push(await suspendPane(api));
			}
			expect(await fromHostTimer(() => api.c.probe())).toBe(null);
			for (const release of settle) await release();
		}
	);

	it("an async host timer still runs as the host after its own await", async () => {
		const api = await create(ROOT, MANIFEST);
		const settle = await suspendPane(api);
		const result = await fromHostTimer(async () => {
			await turn();
			return api.c.probe();
		});
		expect(result).toBe(null);
		await settle();
	});

	it("an async host promise reaction still runs as the host after its own await", async () => {
		const api = await create(ROOT, MANIFEST);
		const settle = await suspendPane(api);
		const result = await Promise.resolve().then(async () => {
			await turn();
			return api.c.probe();
		});
		expect(result).toBe(null);
		await settle();
	});

	it("an async host timer calling into another instance after its await runs as the host", async () => {
		const api = await create(ROOT, MANIFEST);
		const second = await create(SECOND, SECOND_MANIFEST);
		const settlePane = await suspendPane(api);
		const settleG = await suspendG(second);
		const result = await fromHostTimer(async () => {
			await turn();
			return api.c.probe();
		});
		expect(result).toBe(null);
		await settleG();
		await settlePane();
	});

	it.each([
		["synchronous", (api) => () => api.c.probe()],
		[
			"async, after its own await",
			(api) => async () => {
				await turn();
				return api.c.probe();
			}
		]
	])("a callback the host pins with lockCaller on one instance runs as the host in another (%s)", async (_label, body) => {
		const api = await create(ROOT, MANIFEST);
		const second = await create(SECOND, SECOND_MANIFEST);
		const settle = await suspendPane(api);
		const pinnedOnSecond = second.slothlet.lockCaller.caller(body(api));
		expect(await pinnedOnSecond()).toBe(null);
		await settle();
	});

	it.skipIf(browser)("a host timer whose callback returns another realm's promise runs as the host until it settles", async () => {
		const api = await create(ROOT, MANIFEST);
		const settle = await suspendPane(api);
		// A promise from a separate realm (an iframe, a vm context): its reaction runs unpinned, after
		// the callback returned, while `pane.hold` is still suspended.
		const foreignChain = vm.runInNewContext("(probe) => Promise.resolve().then(() => null).then(() => probe())");
		// The timer callback returns the foreign promise itself, and its reaction reports the caller.
		const result = await new Promise((resolve) => setTimeout(() => foreignChain(() => api.c.probe()).then(resolve), 0));
		expect(result).toBe(null);
		await settle();
	});

	it("control: the suspended call itself still resolves as its own caller after a host callback has run", async () => {
		const api = await create(ROOT, MANIFEST);
		const [gateB, releaseB] = gate();
		const pending = api.b.render(gateB);
		await turn();
		const hostTimer = fromHostTimer(async () => {
			await turn();
			return api.c.probe();
		});
		releaseB();
		expect(await pending).toEqual({ before: "b.render", after: "b.render", pinnedAfter: "b.render" });
		expect(await hostTimer).toBe(null);
	});
});
