/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_array_members/list.mjs
 *	@Date: 2026-10-12T09:35:34-07:00 (1791822934)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T09:51:30-07:00 (1791823890)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an array default with an extra member, a read-only element and a getter.
 * @module api_smart_flatten_array_members.list
 */

const items = ["a", "b"];
items.label = "x";
Object.defineProperty(items, "1", { value: "b", writable: false, enumerable: true, configurable: false });
Object.defineProperty(items, "first", {
	get() {
		return this[0];
	},
	enumerable: true,
	configurable: true
});

export default items;
