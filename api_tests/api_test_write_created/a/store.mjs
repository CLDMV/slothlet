/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_write_created/a/store.mjs
 *	@Date: 2026-11-17T11:57:13-08:00 (1794945433)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:13-08:00 (1795869013)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The first module mounted at `p`: data the second module writes beneath, and a node it creates
 * members on.
 */

/**
 * An object member of the first module's data.
 * @type {{x: number, nested: {y: number}}}
 */
export const data = { x: 1, nested: { y: 2 } };

/**
 * Another object member of the first module's data, which no rule names.
 * @type {{z: number}}
 */
export const plain = { z: 1 };
