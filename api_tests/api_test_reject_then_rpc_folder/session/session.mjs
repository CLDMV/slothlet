/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_rpc_folder/session/session.mjs
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
 * @fileoverview Fixture (#580 review): an RPC-style Proxy as a folder's same-named default, which a lazy load would await.
 * @module api_test_reject_then_rpc_folder.session
 */

export default new Proxy({}, { get: (_target, key) => (typeof key === "string" ? () => "rpc:" + key : undefined) });
