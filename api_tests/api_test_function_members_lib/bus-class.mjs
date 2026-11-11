/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members_lib/bus-class.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T00:00:00-08:00 (1793692800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — the emitter class of the callee's `bus` node, kept outside the api folder so the host, the
 * node's own module and a permitted module can each test the node against it.
 *
 * @module api_tests/api_test_function_members_lib/bus-class
 */

import { EventEmitter } from "node:events";

/**
 * An emitter class of the callee's.
 * @public
 */
export class Bus extends EventEmitter {
	/**
	 * A marker method.
	 * @returns {string} A marker.
	 */
	kind() {
		return "bus";
	}

	/**
	 * A getter on the prototype, counting its runs on `globalThis.__slothletBusInfoReads`.
	 * @returns {string} A marker.
	 */
	get info() {
		globalThis.__slothletBusInfoReads = (globalThis.__slothletBusInfoReads ?? 0) + 1;
		return "info";
	}
}
