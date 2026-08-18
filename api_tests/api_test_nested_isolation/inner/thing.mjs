/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_isolation/inner/thing.mjs
 *	@Date: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Leaf of the INNER (nested) api used by the nested-instance-boot isolation
 * fixture. The nested instance is booted from inside a leaf of the permissioned outer
 * instance (see ../outer/root.mjs); this leaf just gives the nested tree a terminal member.
 * @module api_test_nested_isolation.inner.thing
 * @memberof module:api_test_nested_isolation
 */

/**
 * Terminal member of the nested api.
 * @returns {boolean} Always true.
 */
export function isAiPdf() {
	return true;
}
