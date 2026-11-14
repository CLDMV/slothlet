/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_imports/refused/held.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file importing one of slothlet's own files at its top: it does not load.
 * @module api_test_internal_imports.refused.held
 */
import { instanceImporters } from "@cldmv/slothlet/helpers/instance-imports";

/**
 * What the import gave.
 * @returns {string} The import's type.
 */
export const kind = () => typeof instanceImporters;
