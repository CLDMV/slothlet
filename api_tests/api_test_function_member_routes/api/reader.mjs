/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_member_routes/api/reader.mjs
 *	@Date: 2026-11-15T13:40:33-08:00 (1794778833)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:22-08:00 (1795536322)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that reads a function node's own data member by every route its function members offer.
 * @module api_test_function_member_routes.reader
 */
import { self } from "@cldmv/slothlet/runtime";
import { routes, instanceRoutes } from "../lib/routes.mjs";

/**
 * Read the `tag` member of the api root (`at` empty) or of the node at the dotted path `at`, by every route.
 * @function at
 * @memberof module:api_test_function_member_routes.reader
 * @param {string} at - `""` for the api root, or a dotted api path.
 * @returns {Record<string, string>} What each route answered.
 * @example
 * api.reader.at("zz"); // { direct: "TAG", constructor: "TAG", … }
 */
export function at(at) {
	return routes(at === "" ? self : at.split(".").reduce((node, key) => node[key], self));
}

/**
 * Read the class's `tag` through an instance a leaf of the class's module made and handed out.
 * @function made
 * @memberof module:api_test_function_member_routes.reader
 * @returns {Record<string, string>} What each route answered.
 * @example
 * api.reader.made(); // { constructor: "KTAG", … }
 */
export function made() {
	return instanceRoutes(self.cls.k.make());
}
