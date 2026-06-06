/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_chainable/query.mjs
 *	@Date: 2026-05-31T08:04:06-07:00 (1780239846)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:17:43 -07:00 (1780546663)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Chainable query-builder fixture for #124 (async double-wrap blow-up).
 * @module api_chainable.query
 * @memberof module:api_chainable
 *
 * @description
 * Mirrors the fluent class-instance pattern (Kysely-style query builders) that triggered the
 * exponential wrap blow-up in async runtime: each builder method returns a NEW class instance,
 * so the runtime must wrap every returned instance to preserve context. `whoami()` reads the
 * slothlet context to prove propagation survives an arbitrarily long chain.
 */

import { context } from "@cldmv/slothlet/runtime";

class Chainable {
	constructor(ops = []) {
		this.ops = ops;
	}

	/**
	 * Append an operation and return a fresh chainable instance.
	 * @param {...*} args - Arbitrary clause arguments.
	 * @returns {Chainable} A new builder carrying the accumulated ops.
	 */
	where(...args) {
		return new Chainable([...this.ops, args]);
	}

	/**
	 * Read the active slothlet context, proving it propagates through the wrapped chain.
	 * @returns {*} The `userId` from the active context.
	 */
	whoami() {
		return context.userId;
	}

	/**
	 * Resolve the chain to the number of accumulated operations.
	 * @returns {Promise<number>} Count of chained operations.
	 */
	async execute() {
		return this.ops.length;
	}
}

/**
 * Factory returning a fresh chainable query builder.
 * @returns {Chainable} A new builder instance.
 */
export function query() {
	return new Chainable();
}
