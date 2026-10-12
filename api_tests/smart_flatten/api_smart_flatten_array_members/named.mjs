/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_array_members/named.mjs
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
 * @fileoverview Fixture (#585 review): a named array export with an extra member, beside another export.
 * @module api_smart_flatten_array_members.named
 */

const tags = ["t"];
tags.kind = "k";

export { tags };

export const other = 1;
