/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modes/preloaded-structure-validation.test.vitest.mjs
 *	@Date: 2026-06-06T00:00:00-08:00 (1780000000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-06 00:00:00 -08:00 (1780000000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for the preloadedStructure shape guard in eager/lazy buildAPI (#136 review).
 *
 * @description
 * `preloadedStructure` is an internal synthetic-build option (built only by Builder.buildAPI from
 * already-validated synthetic exports). The mode builders consume `structure.files` /
 * `structure.directories` directly, so a non-null value with the wrong shape would throw a confusing
 * TypeError deep in processFiles. Both modes now fail fast with a structured
 * INVALID_CONFIG_PRELOADED_STRUCTURE instead. This suite reaches that guard by instantiating the mode
 * classes with a minimal mock (the guard fires before any real slothlet wiring is needed).
 *
 * @module tests/vitests/suites/modes/preloaded-structure-validation.test.vitest
 */

import { describe, it, expect } from "vitest";
import { EagerMode } from "@cldmv/slothlet/modes/eager";
import { LazyMode } from "@cldmv/slothlet/modes/lazy";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Minimal mock satisfying ComponentBase getters plus the bits buildAPI touches before the guard
 * (builders/processors are destructured first; lazy logs a debug line). The guard throws before any
 * of these are actually used.
 * @type {object}
 */
const mockSlothlet = {
	config: {},
	debug: () => {},
	SlothletError,
	SlothletWarning,
	builders: {},
	processors: {}
};

const malformed = [
	["an empty object (no files/directories)", {}],
	["files present but directories missing", { files: [] }],
	["directories not an array", { files: [], directories: null }],
	["a string", "not-a-structure"],
	["a number", 42]
];

for (const [ModeName, Mode] of [
	["EagerMode", EagerMode],
	["LazyMode", LazyMode]
]) {
	describe(`${ModeName}.buildAPI - preloadedStructure shape validation (#136 review)`, () => {
		for (const [label, value] of malformed) {
			it(`rejects ${label} with INVALID_CONFIG_PRELOADED_STRUCTURE`, async () => {
				const mode = new Mode(mockSlothlet);
				await expect(mode.buildAPI({ dir: "/x", preloadedStructure: value })).rejects.toMatchObject({
					code: "INVALID_CONFIG_PRELOADED_STRUCTURE"
				});
			});
		}

		it("does not throw the validation error for a well-formed { files, directories }", async () => {
			// A valid shape passes the guard; the build then fails later for an unrelated reason (the mock
			// has no real processor), proving the guard's false branch is taken rather than the throw.
			const mode = new Mode(mockSlothlet);
			await expect(mode.buildAPI({ dir: "/x", preloadedStructure: { files: [], directories: [] } })).rejects.not.toMatchObject({
				code: "INVALID_CONFIG_PRELOADED_STRUCTURE"
			});
		});
	});
}
