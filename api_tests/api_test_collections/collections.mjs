/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collections/collections.mjs
 *	@Date: 2025-11-14 16:35:00 -08:00 (1762302900)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-14 16:35:00 -08:00 (1762302900)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test module containing Map and Set collections for proxy testing.
 * @module api_test_collections
 * @name api_test_collections
 * @alias @cldmv/slothlet/api_tests/api_test_collections
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
