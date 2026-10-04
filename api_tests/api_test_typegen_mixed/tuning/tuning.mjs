/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/tuning/tuning.mjs
 *	@Date: 2026-09-28T05:49:33-07:00 (1790599773)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:47-07:00 (1791090887)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Self-named file in a folder with a sibling file: its named exports — including a
 * primitive — merge into the folder namespace alongside the sibling's (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.tuning
 */

/**
 * Scale a value by the tuning step.
 * @param {number} value - Value to scale.
 * @returns {number} The scaled value.
 */
export function tune(value) {
	return value * TUNE_STEP;
}

/** Tuning step size. */
export const TUNE_STEP = 5;
