/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_then_data/rpc.mjs
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
 * @fileoverview Fixture: an RPC-style Proxy answering a function for every name, as a plain file default.
 * @module api_test_then_data.rpc
 */

export default new Proxy({}, { get: (_target, key) => (typeof key === "string" ? () => "rpc:" + key : undefined) });
