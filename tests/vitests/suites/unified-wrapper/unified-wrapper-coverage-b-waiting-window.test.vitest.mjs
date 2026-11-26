/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-waiting-window.test.vitest.mjs
 *	@Date: 2026-11-25T01:26:57-08:00 (1795598817)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:49:51-08:00 (1795600191)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Stand-ins taken before a lazy folder loads read what the folder holds while its load is finishing.
 *
 * @description
 * Fixture `api_test_uwb_waiting_window`:
 * ```
 * tool/tool.mjs   default function tool() -> "tool"      (the folder's own function)
 * tool/name.mjs   default { label }                      (a member named like a function's own `name`)
 * tool/dev.mjs    default Proxy over { inner: { z } }     (a module whose value is its own Proxy)
 * tool/info.mjs   default { nested: { leaf }, count: 3 }
 * holder.mjs      keepInfo() -> self.tool.info
 * ```
 * The `name` member makes the folder's loader hand its value over before the load returns, so there is a moment where
 * the folder holds its value but has not finished loading. A stand-in read then answers what plain JS answers for the
 * same path: the module's value, a member, a primitive, or `undefined` for a member it does not hold.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-b-waiting-window
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";

const BASE = new URL("../../../../api_tests/api_test_uwb_waiting_window", import.meta.url).pathname;

/**
 * Load the node and run `read` at the moment it holds its value but has not finished loading: right after the loader
 * hands the value over, before the load returns. The hand-over is watched on this one wrapper instance only.
 * @param {object} node - A lazy node.
 * @param {function(): *} read - The reads to make then.
 * @returns {Promise<*>} What `read` returned.
 */
async function inLoadWindow(node, read) {
	const wrapper = resolveWrapper(node);
	const apply = wrapper._applyNewImpl;
	let result;
	let seen = false;
	wrapper._applyNewImpl = function (...args) {
		const applied = Reflect.apply(apply, this, args);
		if (!seen && !this.____slothletInternal.state.materialized) {
			seen = true;
			result = read();
		}
		return applied;
	};
	try {
		await wrapper.___materialize();
	} finally {
		delete wrapper._applyNewImpl;
	}
	if (!seen) throw new Error("the load finished without a window");
	return result;
}

describe.each([
	["permissions on", { permissions: { policy: "allow" } }],
	["permissions off", {}]
])("lazy folder load window (%s)", (_label, options) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("stand-ins read the folder's members as plain JS does", async () => {
		api = await slothlet({ mode: "lazy", base: BASE, silent: true, ...options });
		// The holder is loaded first, so its call hands back the stand-in itself rather than a promise of it.
		await resolveWrapper(api.holder).___materialize();
		const inner = api.tool.dev.inner;
		const nested = api.tool.info.nested;
		const missing = api.tool.missing.q;
		const info = api.tool.info;
		const kept = api.holder.keepInfo();
		const read = await inLoadWindow(api.tool, () => ({
			z: inner.z,
			leaf: nested.leaf,
			missing: missing.q,
			count: info.count,
			nope: info.nope,
			keptCount: kept.count
		}));
		expect(read).toEqual({
			z: "tool.dev.inner.z",
			leaf: "tool.info.nested.leaf",
			missing: undefined,
			count: 3,
			nope: undefined,
			keptCount: 3
		});
	});

	it("the folder reads as plain JS once loaded", async () => {
		api = await slothlet({ mode: "lazy", base: BASE, silent: true, ...options });
		expect(api.tool.name).toBeDefined();
		await resolveWrapper(api.tool).___materialize();
		expect(api.tool()).toBe("tool");
		expect(api.tool.name.label).toBe("tool.name.label");
		expect(api.tool.dev.inner.z).toBe("tool.dev.inner.z");
		expect(api.tool.info.count).toBe(3);
	});
});
