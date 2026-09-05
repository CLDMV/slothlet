/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/class-instance-async-return.test.vitest.mjs
 *	@Date: 2026-09-04 12:00:00 -07:00 (1788469200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-04 12:00:00 -07:00 (1788469200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Class-instance context wrapping applies to an ASYNC leaf's resolved value (#328).
 *
 * @description
 * `AsyncContextManager.runInContext()` decided whether to apply class-instance context wrapping by
 * checking the *synchronous* return of `fn.apply(...)`. For an `async function` leaf that return is
 * always a pending `Promise` — and `Promise` is excluded from class-instance detection — so the wrap
 * never fired: `await api.mod.asyncFactory()` resolved to an UNWRAPPED instance, and a later method
 * on it that touches `self` threw `RUNTIME_NO_ACTIVE_CONTEXT_SELF`. The identical body worked when the
 * factory was synchronous. This suite pins that an async factory returning a class instance gets the
 * same context-preserving method wrapping as the sync factory does.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

// A minimal boot base; the factory / target modules are mounted inline via api.add().
const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/** A stateful instance whose method needs `self` on a LATER call — the #328 shape. */
class Widget {
	/**
	 * Reaches a sibling module through `self`; only works if the instance carries context.
	 * @returns {Promise<string>} The sibling's response.
	 */
	async ping() {
		return self.other.pong();
	}
}

/** Sibling module reached via `self.other.pong()` from a Widget method. */
const OTHER = {
	exports: {
		/**
		 * @returns {string} A fixed marker so the caller can assert cross-module reach.
		 */
		pong() {
			return "pong";
		}
	}
};

/** Factory module: an async and a sync leaf that both return the same `Widget`. */
const WIDGETS = {
	exports: {
		/**
		 * Async factory — any `await` before the return reproduces #328.
		 * @returns {Promise<Widget>} A fresh Widget.
		 */
		async create() {
			await Promise.resolve();
			return new Widget();
		},
		/**
		 * Synchronous twin — the already-working control path (matches the docs' own example).
		 * @returns {Widget} A fresh Widget.
		 */
		createSync() {
			return new Widget();
		}
	}
};

describe.each(getMatrixConfigs({ runtime: "async" }))("Context > async leaf class-instance wrap (#328) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("an ASYNC factory's returned class instance gets context-preserving methods", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.slothlet.api.add("other", OTHER);
		await api.slothlet.api.add("widget", WIDGETS);

		const w = await api.widget.create();
		// Pre-#328-fix this rejected with RUNTIME_NO_ACTIVE_CONTEXT_SELF (unwrapped instance).
		expect(await w.ping()).toBe("pong");
	});

	it("matches the already-working synchronous factory path", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.slothlet.api.add("other", OTHER);
		await api.slothlet.api.add("widget", WIDGETS);

		const w = api.widget.createSync();
		expect(await w.ping()).toBe("pong");
	});
});
