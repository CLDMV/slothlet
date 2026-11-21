/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/callee/hub/hub.mjs
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
 * @fileoverview #632 — an emitter whose module exports its class by name as well as the instance.
 *
 * @module api_tests/api_test_function_members/callee/hub/hub
 */

import { EventEmitter } from "node:events";

/**
 * The emitter class, exported by name.
 * @public
 */
export class Hub extends EventEmitter {
	/**
	 * A marker method.
	 * @returns {string} A marker.
	 */
	kind() {
		return "hub";
	}

	/**
	 * A getter on the prototype, counting its runs on `globalThis.__slothletHubInfoReads`.
	 * @returns {string} A marker.
	 */
	get info() {
		globalThis.__slothletHubInfoReads = (globalThis.__slothletHubInfoReads ?? 0) + 1;
		return "hubinfo";
	}
}

/**
 * The module's emitter.
 * @type {Hub}
 * @public
 */
export default new Hub();
