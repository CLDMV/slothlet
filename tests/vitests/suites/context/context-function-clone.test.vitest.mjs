/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-function-clone.test.vitest.mjs
 *	@Date: 2026-09-17 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-17 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #408 — run()/scope() clone the effective context with the function-tolerant
 * `utilities.deepClone`, not raw `structuredClone`.
 *
 * Raw `structuredClone` throws `DataCloneError` on ANY function / proxy / symbol anywhere in the
 * context. Because the base context is cloned on every run()/scope(), the mere presence of a live
 * reference (an rpc transport, a service handle) in the injected context broke EVERY run()/scope()
 * in the instance. deepClone keeps callables BY REFERENCE while still deep-cloning the surrounding
 * data — so a live transport rides `context`, while the nested-data isolation ("SECURITY FIX")
 * property is preserved: a nested data object is a distinct clone per scope, never shared by ref.
 */

import { describe, it, expect, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;

describe.each(getMatrixConfigs({}))("Context > function-tolerant clone (#408) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("run() with a live transport (object of methods) in the base context does not throw; methods survive by reference", async () => {
		const slothlet = (await import("@cldmv/slothlet")).default;
		const handlers = new Map();
		const transport = { on: (m, fn) => handlers.set(m, fn), request: () => 1, notify: () => {} };
		const baseData = { nested: { count: 0 } };
		api = await slothlet({ ...config, base: BASE, context: { transport, data: baseData } });

		let threw = null;
		let onIsFn = false;
		let onSameRef = false;
		let dataCloned = false;
		let dataIntact = false;
		try {
			await api.slothlet.run({}, async () => {
				const c = await api.slothlet.context.get();
				onIsFn = typeof c.transport.on === "function"; // before fix: "object" ({}) — silently broken
				onSameRef = c.transport.on === transport.on; // callable retained BY REFERENCE
				dataCloned = c.data !== baseData; // nested data is a distinct clone (security property)
				dataIntact = c.data.nested.count === 0; // …but the data itself is preserved
			});
		} catch (err) {
			threw = err; // before fix: DataCloneError "… could not be cloned"
		}
		expect(threw).toBe(null);
		expect(onIsFn).toBe(true);
		expect(onSameRef).toBe(true);
		expect(dataCloned).toBe(true);
		expect(dataIntact).toBe(true);
	});

	it("scope() with a live transport in the base context does not throw; methods survive by reference", async () => {
		const slothlet = (await import("@cldmv/slothlet")).default;
		const handlers = new Map();
		const transport = { on: (m, fn) => handlers.set(m, fn), request: () => 1 };
		api = await slothlet({ ...config, base: BASE, context: { transport } });

		let threw = null;
		let onSameRef = false;
		try {
			await api.slothlet.scope({
				context: {},
				fn: async () => {
					const c = await api.slothlet.context.get();
					onSameRef = c.transport.on === transport.on;
				}
			});
		} catch (err) {
			threw = err;
		}
		expect(threw).toBe(null);
		expect(onSameRef).toBe(true);
	});

	it("a bare function passed as a per-call context value is the SAME reference inside the scope", async () => {
		const slothlet = (await import("@cldmv/slothlet")).default;
		api = await slothlet({ ...config, base: BASE });

		const hook = (m, fn) => [m, fn];
		let threw = null;
		let sameRef = false;
		try {
			await api.slothlet.run({ hook }, async () => {
				const c = await api.slothlet.context.get();
				sameRef = c.hook === hook;
			});
		} catch (err) {
			threw = err;
		}
		expect(threw).toBe(null);
		expect(sameRef).toBe(true);
	});

	it("nested DATA objects stay isolated per scope (deep merge) — a distinct clone, not shared by reference", async () => {
		const slothlet = (await import("@cldmv/slothlet")).default;
		const baseData = { nested: { count: 0 } };
		const transport = { on: () => {} }; // forces the deepClone fallback path
		api = await slothlet({ ...config, base: BASE, context: { transport, data: baseData }, scope: { merge: "deep" } });

		let insideRef;
		let insideCount;
		await api.slothlet.run({ extra: { v: 1 } }, async () => {
			const c = await api.slothlet.context.get();
			insideRef = c.data;
			insideCount = c.data.nested.count;
		});
		expect(insideRef).not.toBe(baseData); // deep-cloned, not the base object by reference
		expect(insideCount).toBe(0); // data preserved through the clone
	});
});
