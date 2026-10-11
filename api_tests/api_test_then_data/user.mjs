/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_then_data/user.mjs
 *	@Date: 2026-10-11T14:30:00-07:00 (1791754200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T14:30:00-07:00 (1791754200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#580 review): a JSON Schema conditional, whose `then` holds data.
 * @module api_test_then_data.user
 */

export const schema = { if: { properties: { kind: { const: "a" } } }, then: { required: ["b"] }, else: { required: ["c"] } };
