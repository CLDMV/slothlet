/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_null_default/nnamed.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:02-08:00 (1795868942)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file whose default export is null, beside a named export.
 * @module api_test_null_default/nnamed
 */

export default null;

/**
 * @returns {string} Marker naming this named export.
 */
export const label = () => "nnamed.label";
