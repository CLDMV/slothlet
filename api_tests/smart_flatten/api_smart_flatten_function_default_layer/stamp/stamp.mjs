/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_function_default_layer/stamp/stamp.mjs
 *	@Date: 2026-10-11T23:00:00-07:00 (1791790800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T23:00:00-07:00 (1791790800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named file whose default function shares member names (`prototype`, `name`, `length`) with its named exports, beside a sibling file.
 * @module api_smart_flatten_function_default_layer.stamp.stamp
 */

/**
 * @param {number} x - Any value.
 * @returns {string} Marker naming this default and its argument.
 */
export default function stamp(x) {
	return "stamp:" + x;
}

/** Named export sharing a name with the default function's own `prototype`. */
export const prototype = "stamp.prototype";

/** Named export sharing a name with the default function's own `name`. */
export const name = "stamp.name";

/** Named export sharing a name with the default function's own `length`. */
export const length = 9;
