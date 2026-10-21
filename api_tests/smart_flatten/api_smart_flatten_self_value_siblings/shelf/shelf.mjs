/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_self_value_siblings/shelf/shelf.mjs
 *	@Date: 2026-10-11T20:14:14-07:00 (1791774854)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:03:20-07:00 (1791781400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named file whose default is a Map, beside a sibling. The Map
 * is recorded on `globalThis` so a test can check the build never wrote to it.
 * @module api_smart_flatten_self_value_siblings.shelf.shelf
 */

const shelf = new Map([["a", 1]]);
(globalThis.__slothletSelfValueSiblings ??= {}).shelf = shelf;

export default shelf;
