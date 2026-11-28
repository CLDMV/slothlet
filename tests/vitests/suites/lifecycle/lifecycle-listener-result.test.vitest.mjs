/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lifecycle/lifecycle-listener-result.test.vitest.mjs
 *	@Date: 2026-11-16T01:33:20-08:00 (1794821600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:03-08:00 (1795869123)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a lifecycle subscriber returns is settled as the subscriber, as an event listener's is: a `then`
 * it carries (a getter, a thenable's method) is read and called once, inside the subscriber's own call, and no other
 * member of it (a `catch` method) is called. The emitting flow, a module's or the host's, never runs the subscriber's
 * code.
 *
 * Rules: everything allowed except `sub.** → vault.**`, so the subscriber's code is refused the vault.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, "../../../../api_tests/api_test_lifecycle_results");
const EXTRA = path.join(BASE, "extra-src");
const REFUSED = "threw PERMISSION_DENIED";
const PERMISSIONS = { policy: "allow", rules: [{ caller: "sub.**", target: "vault.**", effect: "deny" }] };
const SHAPES = ["thenGetter", "thenMethod", "catchMethod", "asyncBody"];

describe.each(getMatrixConfigs())("Lifecycle > a subscriber's result is settled as the subscriber > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Build the api, subscribe the shape, count the events, and mount a folder.
	 * @param {string} shape - The subscriber's shape.
	 * @param {boolean} byModule - Whether a module mounts it (otherwise the host).
	 * @returns {Promise<{records: Array<object>, events: number}>} What the subscriber recorded, and how many events fired.
	 */
	async function run(shape, byModule) {
		api = await slothlet({ ...config, base: BASE, permissions: PERMISSIONS, silent: true });
		let events = 0;
		api.slothlet.lifecycle.on("impl:created", () => {
			events++;
		});
		await api.sub.listen("impl:created", shape);
		// Counted from here: a lazy tree emits for the subscriber's own node as it loads.
		events = 0;
		if (byModule) await api.app.mount("extra", EXTRA);
		else await api.slothlet.api.add("extra", EXTRA);
		// A lazy tree emits as its nodes load, after the mount resolves. Poll until events have arrived and then stopped
		// coming, so the results are drained once, after the last of them (a drain clears what arrives while it runs).
		let lastSeen = -1;
		let steady = 0;
		await vi.waitFor(
			() => {
				steady = events > 0 && events === lastSeen ? steady + 1 : 0;
				lastSeen = events;
				expect(steady).toBeGreaterThanOrEqual(10);
			},
			{ timeout: 10000, interval: 25 }
		);
		return { records: await api.sub.drain(), events };
	}

	it.each(SHAPES)("%s: mounted by a module, the result is settled once per event, as the subscriber", async (shape) => {
		const { records, events } = await run(shape, true);
		expect(events).toBeGreaterThan(0);
		expect(records).toEqual(shape === "catchMethod" ? [] : Array.from({ length: events }, () => ({ tag: shape, value: REFUSED })));
	});

	it.each(SHAPES)("%s: mounted by the host, the result is settled once per event, as the subscriber", async (shape) => {
		const { records, events } = await run(shape, false);
		expect(events).toBeGreaterThan(0);
		expect(records).toEqual(shape === "catchMethod" ? [] : Array.from({ length: events }, () => ({ tag: shape, value: REFUSED })));
	});
});
