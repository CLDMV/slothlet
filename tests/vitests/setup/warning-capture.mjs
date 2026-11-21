/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/warning-capture.mjs
 *	@Date: 2026-11-16T18:00:00-08:00 (1794880800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:00:00-08:00 (1794880800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Capture the warnings slothlet prints while a function runs. A warning raised through an instance is
 * kept by that instance (`api.slothlet.warnings.get()`); one raised outside any instance (a locale that failed to load
 * through the i18n entry, a module-level notice) is only printed, so tests read it from the console.
 */

import { vi } from "vitest";
// Loading the errors module registers the process-level warning class with i18n; a suite that only imports `#i18n`
// would otherwise hold a failed locale load until something else loads it, and nothing would be printed.
import "#errors";

/**
 * Run `fn` and record every warning it prints. The process-level class prints every warning (#838).
 * @param {() => unknown} fn - The code to run (sync or async).
 * @returns {Promise<Array<{ code: string, message: string, details: object }>>} The printed warnings, in order.
 * @example
 * const warnings = await captureWarnings(() => setLanguage("zz"));
 * expect(warnings.map((w) => w.code)).toContain("WARNING_LANGUAGE_LOAD_FAILED");
 */
export async function captureWarnings(fn) {
	const printed = [];
	const spy = vi.spyOn(console, "warn").mockImplementation((...args) => {
		const head = typeof args[0] === "string" ? /^\n⚠️ {2}\[([A-Z0-9_]+)\] SlothletWarning\n([\s\S]*)$/.exec(args[0]) : null;
		if (head) printed.push({ code: head[1], message: head[2], details: {} });
		else if (args[0] === "Details:" && printed.length) printed[printed.length - 1].details = args[1];
	});
	try {
		await fn();
	} finally {
		spy.mockRestore();
	}
	return printed;
}
