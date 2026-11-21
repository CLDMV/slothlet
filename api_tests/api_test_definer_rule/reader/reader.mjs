/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_definer_rule/reader/reader.mjs
 *	@Date: 2026-11-08T19:11:03-08:00 (1794193863)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T19:17:27-08:00 (1794194247)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the definer rule (#726): runs a function the supplier kept in `shared`.
 * @module api_test_definer_rule.reader
 */
import { self } from "@cldmv/slothlet/runtime";

export async function run() {
	const r = {};
	try {
		const fn = await self.shared.take();
		r.takePlain = typeof fn;
		r.E = await fn();
	} catch (e) {
		r.E = e?.code ?? String(e);
	}
	return r;
}
