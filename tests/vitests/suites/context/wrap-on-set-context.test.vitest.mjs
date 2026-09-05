/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/wrap-on-set-context.test.vitest.mjs
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
 * @fileoverview Writable `self.X = <object>` (wrap-on-set) gives the assigned object's methods
 * the same working `self`/context that `api.slothlet.api.add()` does (#329).
 *
 * @description
 * `docs/CONTEXT-PROPAGATION.md` states that assigning a function or object to an owned `self.X`
 * path applies "the same wrapper construction `api.slothlet.api.add()` uses." Previously the set
 * trap stored the assigned value RAW (a bare `defineProperty`), so an assigned object's methods
 * ran outside any context-preserving wrapper and a later `self.*` access threw
 * `RUNTIME_NO_ACTIVE_CONTEXT_SELF` — while the identical object mounted via `add()` worked. This
 * suite pins that both mounting mechanisms give the object's methods working cross-module `self`.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/** Sibling module reached via `self.other.pong()` from an assigned/added object's method. */
const OTHER = {
	exports: {
		/** @returns {string} A fixed marker so the caller can assert cross-module reach. */
		pong() {
			return "pong";
		}
	}
};

/** A module that grows its own namespace at runtime two ways: wrap-on-set and add(). */
const REGISTRY = {
	exports: {
		/**
		 * Grows the namespace via writable `self.X = <object>` (the #329 path).
		 * @param {string} key - Sub-key to create under `registry`.
		 * @returns {Promise<void>}
		 */
		async viaAssignment(key) {
			self.registry[key] = { ping: async () => self.other.pong() };
		},
		/**
		 * Grows the namespace via `add()` (the already-working control path).
		 * @param {string} key - Sub-key to create under `registry`.
		 * @returns {Promise<void>}
		 */
		async viaAdd(key) {
			await self.slothlet.api.add(`registry.${key}`, { exports: { ping: async () => self.other.pong() } });
		}
	}
};

describe.each(getMatrixConfigs({ runtime: "async" }))("Context > writable self.X wrap-on-set (#329) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("an object assigned via self.X = {…} gets methods with working self, like add() does", async () => {
		api = await slothlet({ ...config, base: BASE, api: { mutations: { add: true, remove: true, reload: true } } });
		await api.slothlet.api.add("other", OTHER);
		await api.slothlet.api.add("registry", REGISTRY);

		// Control: the add() path has always given the object's methods working self.
		await api.registry.viaAdd("b");
		expect(await api.registry.b.ping()).toBe("pong");

		// #329: the wrap-on-set path must now behave identically (previously threw
		// RUNTIME_NO_ACTIVE_CONTEXT_SELF because the assigned object was stored unwrapped).
		await api.registry.viaAssignment("a");
		expect(await api.registry.a.ping()).toBe("pong");
	});
});
