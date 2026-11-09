/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_listener_results/sub/sub.mjs
 *	@Date: 2026-11-08T15:47:43-08:00 (1794181663)
 *	@Author: Shinrai
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:44:35-08:00 (1794185075)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A subscriber the rules refuse the vault. Each listener shape returns a value carrying the
 * subscriber's own code; that code must run as the subscriber, never as whoever emitted the event.
 */

import { self } from "@cldmv/slothlet/runtime";

const seen = [];

/**
 * Read the vault and record what came back. In lazy mode the read is a promise, so the outcome is
 * recorded once it settles; `drain()` waits for every outcome.
 * @param {string} tag - Which listener shape read it.
 * @returns {void}
 */
function attempt(tag) {
	const outcome = (async () => {
		try {
			return { tag, value: await self.vault.secret() };
		} catch (error) {
			return { tag, value: `threw ${error?.code ?? error?.message}` };
		}
	})();
	seen.push(outcome);
}

const SHAPES = {
	/** Returns an object whose `then` is a getter. */
	thenGetter: () => ({
		get then() {
			attempt("thenGetter");
			return undefined;
		}
	}),
	/** Returns a thenable whose `then` runs the subscriber's code. */
	thenMethod: () => ({
		then(resolve) {
			attempt("thenMethod");
			resolve();
		}
	}),
	/** Returns a thenable with a `catch` method carrying the subscriber's code. */
	catchMethod: () => ({
		then(resolve) {
			resolve();
		},
		catch() {
			attempt("catchMethod");
			return this;
		}
	}),
	/** Returns a thenable that resolves to another value carrying a `then` getter. */
	nestedThen: () => ({
		then(resolve) {
			resolve({
				get then() {
					attempt("nestedThen");
					return undefined;
				}
			});
		}
	}),
	/** An async listener resolving to a value carrying a `then` getter. */
	asyncResolvesThenGetter: async () => ({
		get then() {
			attempt("asyncResolvesThenGetter");
			return undefined;
		}
	}),
	/** An async listener: its body after an await runs as the subscriber. */
	asyncBody: async () => {
		await null;
		attempt("asyncBody");
	}
};

/**
 * Subscribe one listener shape to an event.
 * @param {string} eventName - Event to subscribe to.
 * @param {keyof typeof SHAPES} shape - Which listener shape.
 * @returns {string} The subscription's listener id.
 */
export function listen(eventName, shape) {
	return self.slothlet.event.on(eventName, SHAPES[shape]).id;
}

/**
 * Return and clear what the listeners recorded.
 * @returns {Promise<Array<{ tag: string, value: string }>>} Recorded reads.
 */
export async function drain() {
	const out = await Promise.all(seen);
	seen.length = 0;
	return out;
}
