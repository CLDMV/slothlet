/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_plain_js/owner/owner.mjs
 *	@Date: 2026-11-11T23:30:00-08:00 (1794468600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:30:00-08:00 (1794468600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose data object other modules read and try to change through the api.
 * @module api_test_api_node_plain_js/owner
 */

/**
 * The owner's data object.
 * @type {{port: number, nested: {a: number}}}
 */
export const config = { port: 80, nested: { a: 1 } };

/**
 * What the owner's own `config` holds, as the owner reads it.
 * @returns {{port: number, nested: {a: number}, keys: string[]}} Its port, a copy of its nested object, and its keys.
 */
export const state = () => ({ port: config.port, nested: { ...config.nested }, keys: Object.keys(config) });

/**
 * Change the owner's own `config` from inside the owner.
 * @param {number} port - The new port.
 * @returns {void}
 */
export const setPort = (port) => {
	config.port = port;
};
