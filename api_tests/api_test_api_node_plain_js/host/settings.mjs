/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_plain_js/host/settings.mjs
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
 * @fileoverview An object default export beside named exports that read it.
 * @module api_test_api_node_plain_js/settings
 */

const settings = { port: 80, nested: { a: 1 } };

export default settings;

/**
 * The port the module's own default object holds.
 * @returns {number} `settings.port`.
 */
export const readPort = () => settings.port;

/**
 * A member of the module's own `settings.nested`.
 * @param {string} key - The member's key.
 * @returns {*} `settings.nested[key]`.
 */
export const readNested = (key) => settings.nested[key];

/**
 * The keys the module's own default object holds.
 * @returns {string[]} `Object.keys(settings)`.
 */
export const ownKeys = () => Object.keys(settings);
