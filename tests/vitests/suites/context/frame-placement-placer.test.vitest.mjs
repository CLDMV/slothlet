/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/frame-placement-placer.test.vitest.mjs
 *	@Date: 2026-11-25T01:44:47-08:00 (1795599887)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:10:30-08:00 (1795601430)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The frame placer on its own, with calls a test describes: calls whose recorded files coincide, a call
 * with no string path, and a frame carrying an instance's tag but no mount's.
 *
 * @description
 * A call is filed once under each of its keys, even when its real path is also one of its recorded locations. A frame
 * carrying an instance's tag but no mount's runs in the copy a raw `import` of the file loads, so the calls of a mount
 * are not placed on it by their file; it is placed by who imports the file instead (#597).
 *
 * @module tests/vitests/suites/context/frame-placement-placer
 */

import { describe, it, expect } from "vitest";
import { createFramePlacer } from "#handlers/frame-placement";

const FILE = "/srv/app/api/a.mjs";

/**
 * A call at a file, as the placer is handed one.
 * @param {object} fields - What differs from the defaults.
 * @returns {object} The call.
 */
const call = (fields) => ({
	currentWrapper: {},
	family: "fp-fam",
	comparablePath: FILE,
	realComparablePath: null,
	locations: null,
	moduleID: null,
	...fields
});

describe("frame placer > calls a test describes", () => {
	it("files a call once under a real path it also records as a location, and one with no string path by its text", () => {
		const real = call({ realComparablePath: "/real/a.mjs", locations: new Set(["/real/a.mjs"]) });
		const pathless = call({ comparablePath: null, family: "fp-other" });
		const { place } = createFramePlacer([real, pathless]);
		const placement = place({ path: "/real/a.mjs", line: "at f (/real/a.mjs:1:1)", evaluated: false, hash: null, key: null });
		expect(placement.byFile).toBe(true);
		expect(Array.from(placement.matches)).toEqual([real]);
	});

	it("places a frame carrying an instance's tag but no mount's by who imports the file, not by a mount's file", () => {
		const mounted = call({ family: "fp-tagged", moduleID: "mount" });
		const placement = createFramePlacer([mounted]).place({
			path: FILE,
			line: `at f (file://${FILE}?slothlet_instance=fp-tagged:1:1)`,
			evaluated: false,
			hash: null,
			key: null
		});
		expect(placement.byFile).toBe(false);
		expect(Array.from(placement.matches)).toEqual([mounted]);
	});
});
