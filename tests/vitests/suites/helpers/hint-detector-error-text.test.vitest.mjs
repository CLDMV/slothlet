/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/hint-detector-error-text.test.vitest.mjs
 *	@Date: 2026-11-16T17:00:55-08:00 (1794877255)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:48-08:00 (1795869108)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The text the hint detector matches for a thrown value, rendered as a SlothletError renders it: an
 * error's own message, a string as itself, any other value by its own data, never through code the value carries.
 */
import { describe, it, expect } from "vitest";
import { detectHint } from "#helpers/hint-detector";

describe("HintDetector.detectHint — the text of a thrown value", () => {
	it("does not call a toString an error carries", () => {
		const error = new Error("");
		let called = false;
		error.toString = () => {
			called = true;
			return "Cannot find module 'missing'";
		};
		expect(detectHint(error, "SOME_CODE")).toBe("HINT_SOME_CODE");
		expect(called).toBe(false);
	});

	it("matches a thrown string as it is", () => {
		expect(detectHint("Cannot find module 'x'", "SOME_CODE")).toBe("HINT_MODULE_NOT_FOUND");
	});

	it("never calls a toString a thrown plain object carries", () => {
		let called = false;
		const thrown = {
			toString() {
				called = true;
				return "Cannot find module 'missing'";
			}
		};
		expect(detectHint(thrown, "SOME_CODE")).toBe("HINT_SOME_CODE");
		expect(called).toBe(false);
	});

	it("matches a thrown plain object by its own data", () => {
		expect(detectHint({ reason: "Cannot find module 'x'" }, "SOME_CODE")).toBe("HINT_MODULE_NOT_FOUND");
	});

	it("still matches an error's own message first", () => {
		expect(detectHint(new TypeError("Cannot find module 'x'"), "SOME_CODE")).toBe("HINT_MODULE_NOT_FOUND");
	});
});
