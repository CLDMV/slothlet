/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/warning-capture.mjs
 *	@Date: 2026-11-16T17:41:29-08:00 (1794879689)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T17:41:29-08:00 (1794879689)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Test helpers for SlothletWarning. A warning raised through an instance is read from
 * `api.slothlet.warnings.get()`; one raised outside any instance (module-level code, a component built on a mock)
 * is only printed, so these helpers read it from the console, or hand a mock its own recording warning class.
 * @module tests/vitests/setup/warning-capture
 */

import { vi } from "vitest";
import { SlothletWarning } from "@cldmv/slothlet/errors";

const HEADLINE = /^\n⚠️ {2}\[([^\]]+)\] (\w+)\n([\s\S]*)$/;

/**
 * Collect the warnings printed while `fn` runs. Console output is let through to a spy (and kept off the real
 * console) for the duration, then the process-level `suppressConsole` setting is restored.
 * @param {Function} fn - Code to run; may return a promise.
 * @returns {Promise<Array<{code: string, name: string, message: string, context: object, cause: *}>>|Array<{code: string, name: string, message: string, context: object, cause: *}>}
 *   The printed warnings, oldest first (a promise when `fn` returns one). `cause` is what was printed for it: an
 *   error's stack, or the value itself.
 * @example
 * const warnings = await printedWarnings(() => initI18n({ language: "xx-yy" }));
 * expect(warnings.map((w) => w.code)).toContain("WARNING_LANGUAGE_LOAD_FAILED");
 */
export function printedWarnings(fn) {
	const prior = SlothletWarning.suppressConsole;
	SlothletWarning.suppressConsole = false;
	const seen = [];
	const spy = vi.spyOn(console, "warn").mockImplementation((first, second) => {
		const match = typeof first === "string" ? HEADLINE.exec(first) : null;
		if (match) {
			seen.push({ code: match[1], name: match[2], message: match[3], context: {}, cause: undefined });
			return;
		}
		const last = seen[seen.length - 1];
		if (!last) return;
		if (first === "Context:") last.context = second;
		else if (first === "Cause:") last.cause = second;
	});
	const done = () => {
		spy.mockRestore();
		SlothletWarning.suppressConsole = prior;
	};
	let result;
	try {
		result = fn();
	} catch (error) {
		done();
		throw error;
	}
	if (result && typeof result.then === "function") {
		return Promise.resolve(result).then(
			() => {
				done();
				return seen;
			},
			(error) => {
				done();
				throw error;
			}
		);
	}
	done();
	return seen;
}

/**
 * A warning class that records every warning made with it, for a component built on a mock slothlet.
 * @returns {{SlothletWarning: Function, records: SlothletWarning[]}} The class and its list.
 * @example
 * const { SlothletWarning: Warning, records } = recordingWarningClass();
 * const lc = new Lifecycle({ config: { debug: {} }, debug: vi.fn(), SlothletWarning: Warning });
 */
export function recordingWarningClass() {
	const records = [];
	return { SlothletWarning: SlothletWarning.forInstance(records), records };
}
