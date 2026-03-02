/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/collections.mjs
 *	@Date: 2026-01-23T08:17:46-08:00 (1769185066)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:13 -08:00 (1772425273)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Collections object containing test Map and Set instances.
 * @alias module:api_test_collections.collections
 * @memberof module:api_test_collections
 */
export const collections =
	/** @lends collections */
	{
		/**
		 * Test Map with sample key-value pairs.
		 * @type {Map<string, string>}
		 */
		testMap: new Map([
			["key1", "value1"],
			["key2", "value2"],
			["key3", "value3"]
		]),

		/**
		 * Test Set with sample values.
		 * @type {Set<string>}
		 */
		testSet: new Set(["item1", "item2", "item3"]),

		/**
		 * Additional Map for nested testing.
		 * @type {Map<string, any>}
		 */
		nestedMap: new Map([
			["objects", { id: 1, name: "test" }],
			["arrays", [1, 2, 3]],
			["nested", new Map([["inner", "value"]])]
		]),

		/**
		 * Additional Set for nested testing.
		 * @type {Set<any>}
		 */
		nestedSet: new Set([{ id: 1, type: "object" }, [1, 2, 3], new Set(["inner1", "inner2"])])
	};

