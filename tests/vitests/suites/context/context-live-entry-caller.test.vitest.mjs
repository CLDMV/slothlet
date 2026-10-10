/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-entry-caller.test.vitest.mjs
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
 * @fileoverview A leaf entered after an overlapping call settled out of order sees the right caller (#591).
 *
 * @description
 * The live runtime restores its shared caller field in settle order, not entry order, so once two calls
 * overlap the field can name a call that has finished. A leaf entered from code that resumed after such
 * a settle must take its caller from the resolved identity (the one enforcement uses), not from that
 * field — otherwise `metadata.caller()` reports the wrong module (or none) and `lockCaller.caller` pins it.
 *
 * Sequence: the host calls `a.slow()` then `b.render()`; `a.slow` settles first, while `b.render` is
 * still suspended. `b.render` then resumes and calls `c.probe()` / `c.pinCaller()`.
 *
 * Fixture: `api_tests/api_test_live_caller_identity` (`a`, `b`, `c`).
 *
 * @module tests/vitests/suites/context/context-live-entry-caller
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, getBrowserMatrixConfigs, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../api_tests/api_test_live_caller_identity");

const PLATFORMS = [
	...getMatrixConfigs().map(({ name, config }) => ({ name: `node > ${name}`, config, browser: false })),
	...getBrowserMatrixConfigs().map(({ name, config }) => ({ name: `browser > ${name}`, config, browser: true }))
];

let MANIFEST;

beforeAll(async () => {
	MANIFEST = await getManifest(ROOT);
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

describe.each(PLATFORMS)("Live runtime > caller of a leaf entered after an out-of-order settle (#591) > $name", ({ config, browser }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Boot the fixture instance.
	 * @returns {Promise<object>} The api.
	 */
	async function boot() {
		const base = browser ? makeBrowserConfig(config, ROOT, MANIFEST) : { ...config, base: ROOT };
		api = await slothlet({ ...base, silent: true });
		return api;
	}

	it("metadata.caller() and lockCaller.caller name the resumed call, not the field an earlier settle restored", async () => {
		await boot();
		const [aGate, releaseA] = gate();
		const [bGate, releaseB] = gate();
		const a = api.a.slow(aGate); // enters first, settles first
		await turn();
		const b = api.b.render(bGate); // still suspended when a settles
		await turn();
		releaseA();
		expect(await a).toBe("a");
		releaseB();
		expect(await b).toEqual({ before: "b.render", after: "b.render", pinnedAfter: "b.render" });
	});

	it("control: with no overlapping call the caller is the same before and after the await", async () => {
		await boot();
		const [bGate, releaseB] = gate();
		const b = api.b.render(bGate);
		await turn();
		releaseB();
		expect(await b).toEqual({ before: "b.render", after: "b.render", pinnedAfter: "b.render" });
	});

	it("control: a leaf the host calls directly still has no module caller", async () => {
		await boot();
		expect(await api.c.probe()).toBe(null);
	});
});
