/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/lifecycle-subscribe-false.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Covers Lifecycle.subscribe unsubscribe closure false branch (line 69).
 *
 * @description
 * The returned unsubscribe closure has:
 *   ```
 *   const handlers = this.subscribers.get(event);
 *   if (handlers) {   ← line 69 — false branch: handlers is undefined
 *       handlers.delete(handler);
 *   }
 *   ```
 * The FALSE branch fires when the entire event entry has been removed from
 * `this.subscribers` (the Map) before the unsubscribe closure is called.
 * Since `this.subscribers` is a public property, we can delete the event entry
 * directly between subscribe and unsubscribe calls.
 *
 * @module tests/vitests/suites/lifecycle/lifecycle-subscribe-false
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, vi } from "vitest";
import { Lifecycle } from "@cldmv/slothlet/handlers/lifecycle";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Build a minimal mock slothlet for Lifecycle construction.
 *
 * @returns {object} Minimal mock.
 *
 * @example
 * const mock = makeMock();
 * const lc = new Lifecycle(mock);
 */
function makeMock() {
	return {
		config: {},
		debug: () => {},
		SlothletError,
		SlothletWarning
	};
}

// ─── subscribe — unsubscribe closure with deleted event (line 69 false branch) ─

describe("Lifecycle.subscribe — unsubscribe after event Map entry deleted (line 69 false)", () => {
	it("does not throw when subscribers Map entry is deleted before unsubscribe", () => {
		const lc = new Lifecycle(makeMock());
		const handler = vi.fn();

		const unsub = lc.subscribe("impl:created", handler);

		// Delete the entire event entry from the public subscribers Map.
		// Now this.subscribers.get("impl:created") returns undefined (falsy).
		lc.subscribers.delete("impl:created");

		// Calling unsub with handlers = undefined → if (handlers) is false → line 69 false branch
		expect(() => unsub()).not.toThrow();
	});

	it("returns without error when multiple events are registered but target event is deleted", () => {
		const lc = new Lifecycle(makeMock());
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		lc.subscribe("impl:changed", handler2);
		const unsub1 = lc.subscribe("impl:created", handler1);

		// Only delete the impl:created entry
		lc.subscribers.delete("impl:created");

		// unsub1 → impl:created not in Map → handlers = undefined → false branch
		expect(() => unsub1()).not.toThrow();

		// impl:changed is still intact
		expect(lc.subscribers.has("impl:changed")).toBe(true);
	});
});
