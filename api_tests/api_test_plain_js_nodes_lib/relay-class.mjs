/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes_lib/relay-class.mjs
 *	@Date: 2026-11-05T09:30:22-08:00 (1793899822)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-07T00:48:53-08:00 (1794041333)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An emitter class kept outside the api folder, so a module can test the owner's emitter against the class
 * itself rather than through its node (#667).
 * @module api_test_plain_js_nodes_lib/relay-class
 */

import { EventEmitter } from "node:events";

/** An emitter class with a method of its own. */
export class Relay extends EventEmitter {
	/** @returns {string} Marker. */
	ping() {
		return "relay";
	}
}
