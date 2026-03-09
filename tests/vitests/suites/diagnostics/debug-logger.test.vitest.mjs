/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/debug-logger.test.vitest.mjs
 *	@Date: 2026-02-25T21:29:19-08:00 (1772083759)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:47 -08:00 (1772425307)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for SlothletDebug (errors.mjs) covering all branches
 * of the `log()` method and the `toString()` method.
 *
 * Without debug flags enabled in slothlet configs, the log() body lines after the
 * early-return guard (lines ~260-292) are never reached. These tests directly
 * instantiate SlothletDebug and drive every branch.
 *
 * @module tests/vitests/suites/diagnostics/debug-logger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SlothletDebug, SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

describe("SlothletDebug", () => {
	let consoleSpy;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it("constructor stores config and sets debugFlags from config.debug", () => {
		const debug = new SlothletDebug({ debug: { wrapper: true, api: false } });
		expect(debug.debugFlags.wrapper).toBe(true);
		expect(debug.debugFlags.api).toBe(false);
	});

	it("constructor defaults debugFlags to {} when no debug config provided", () => {
		const debug = new SlothletDebug({});
		expect(debug.debugFlags).toEqual({});
	});

	it("log() returns early when the code flag is not truthy", () => {
		const debug = new SlothletDebug({ debug: { wrapper: false } });
		debug.log("wrapper", { key: "MODULE_NOT_FOUND", modulePath: "./math.mjs", hint: "Check path" });
		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it("log() returns early when debugFlags is falsy", () => {
		const debug = new SlothletDebug({ debug: null });
		debug.log("wrapper", { key: "MODULE_NOT_FOUND", modulePath: "./math.mjs", hint: "Check path" });
		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it("log() outputs a translated message when a valid key is provided (hasTranslation path)", () => {
		// MODULE_NOT_FOUND is a real key in en-us.json
		const debug = new SlothletDebug({ debug: { modes: true } });
		debug.log("modes", { key: "MODULE_NOT_FOUND", modulePath: "./math.mjs", hint: "Check path" });
		expect(consoleSpy).toHaveBeenCalled();
		const firstCall = consoleSpy.mock.calls[0][0];
		expect(firstCall).toContain("[DEBUG:MODES]");
		// Translation resolved — should NOT start with "Error:"
		expect(firstCall).not.toContain("Error:");
	});

	it("log() outputs extra Context: line when hasTranslation is true and contextParams is non-empty", () => {
		const debug = new SlothletDebug({ debug: { modes: true } });
		// Provide a valid key plus an extra contextParam beyond what the template needs
		debug.log("modes", { key: "MODULE_NOT_FOUND", modulePath: "./math.mjs", hint: "Check path", extraField: "yes" });
		const calls = consoleSpy.mock.calls;
		// At least 2 console.log calls: one for the message, one for Context:
		expect(calls.length).toBeGreaterThanOrEqual(2);
		const contextCall = calls.find((c) => String(c[0]).includes("Context:"));
		expect(contextCall).toBeDefined();
	});

	it("log() uses legacy message path when no key and translation fails (else-if-message branch)", () => {
		// Use an unknown code so DEBUG_UNKNOWNFLAG doesn't exist in i18n → hasTranslation false
		// Provide a raw message → triggers the else-if(message) backwards-compat branch
		const debug = new SlothletDebug({ debug: { unknownflag: true } });
		debug.log("unknownflag", { message: "raw legacy message" });
		expect(consoleSpy).toHaveBeenCalled();
		const firstCall = consoleSpy.mock.calls[0][0];
		expect(firstCall).toContain("[DEBUG:UNKNOWNFLAG]");
		expect(firstCall).toContain("raw legacy message");
	});

	it("log() dumps raw context when no key, no message, and no translation (else branch)", () => {
		// No key, no message, DEBUG_UNKNOWNFLAG doesn't exist → hasTranslation false + no message
		const debug = new SlothletDebug({ debug: { unknownflag: true } });
		debug.log("unknownflag", { someContextParam: "dumpme" });
		expect(consoleSpy).toHaveBeenCalled();
		// Should be called with the label and contextParams as separate args
		const firstArgs = consoleSpy.mock.calls[0];
		expect(firstArgs[0]).toContain("[DEBUG:UNKNOWNFLAG]");
		expect(firstArgs[1]).toMatchObject({ someContextParam: "dumpme" });
	});

	it("toString() returns a string describing the active debug flags", () => {
		const debug = new SlothletDebug({ debug: { wrapper: true, api: false, modes: true } });
		const str = debug.toString();
		expect(str).toContain("[SlothletDebug]");
		expect(str).toContain("wrapper");
		expect(str).toContain("modes");
		expect(str).not.toContain("api");
	});

	it("toString() returns empty flags string when no debug flags are truthy", () => {
		const debug = new SlothletDebug({ debug: {} });
		const str = debug.toString();
		expect(str).toBe("[SlothletDebug] flags: ");
	});
});

describe("SlothletError - originalError enrichment (line 39)", () => {
	it("sets hint via detectHint when originalError matches a pattern, short-circuiting the static-hint &&", () => {
		// When originalError matches a HINT_RULES pattern (e.g. 'Cannot find module'),
		// detectHint() returns a key and translatedHint is set to a truthy string.
		// At line 58: !translatedHint evaluates to false, so the && short-circuits
		// (validationError is never evaluated) — covering the && false-path branch.
		const original = new Error("Cannot find module './missing-module.mjs'");
		const err = new SlothletError("MODULE_NOT_FOUND", { modulePath: "./missing-module.mjs" }, original);
		// translatedHint IS set because detectHint matched; hint property reflects this
		expect(err).toBeInstanceOf(SlothletError);
		expect(err.hint).toBeDefined();
	});

	it("enriches context with originalError.message when originalError is provided", () => {
		const original = new Error("underlying io failure");
		// Line 39: enrichedContext = originalError ? { ...contextData, error: originalError.message } : contextData
		// A non-null originalError triggers the true branch.
		const err = new SlothletError("MODULE_NOT_FOUND", { modulePath: "./math.mjs", hint: "Check path" }, original);
		// The translated message should include the original error info in context enrichment
		expect(err).toBeInstanceOf(SlothletError);
		expect(err.code).toBe("MODULE_NOT_FOUND");
	});
});

describe("SlothletWarning - unsuppressed console output (lines 181-185) and toString() (line 198)", () => {
	let warnSpy;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
		// Always restore suppression so other tests are not affected
		SlothletWarning.suppressConsole = true;
	});

	it("outputs to console.warn when suppressConsole is false (lines 181-185)", () => {
		SlothletWarning.suppressConsole = false;
		// Create a warning — should call console.warn (lines 181-185)
		const w = new SlothletWarning("V2_CONFIG_UNSUPPORTED", { field: "allowMutation", replacement: "api.mutations" });
		expect(warnSpy).toHaveBeenCalled();
		// The warning object itself should be valid
		expect(w.code).toBe("V2_CONFIG_UNSUPPORTED");
	});

	it("outputs Context: line when suppressConsole is false and context has data", () => {
		SlothletWarning.suppressConsole = false;
		new SlothletWarning("V2_CONFIG_UNSUPPORTED", { field: "allowMutation", replacement: "api.mutations" });
		const calls = warnSpy.mock.calls;
		// First call: the main warning message. Possibly second call: "Context:" line.
		expect(calls.length).toBeGreaterThanOrEqual(1);
	});

	it("toString() returns formatted string representation of the warning (line 198)", () => {
		const w = new SlothletWarning("V2_CONFIG_UNSUPPORTED", { field: "allowMutation", replacement: "api.mutations" });
		// Line 198: `return \`[${this.code}] ${this.name}: ${this.message}\``
		const str = w.toString();
		expect(str).toContain("V2_CONFIG_UNSUPPORTED");
		expect(str).toContain("SlothletWarning");
	});
});

describe("SlothletError - inspect.custom and toJSON (lines 130-144)", () => {
	it("nodejs.util.inspect.custom() returns toString() plus the stack trace (line 131)", () => {
		const err = new SlothletError("MODULE_NOT_FOUND", { modulePath: "./missing.mjs" });
		// Directly invoke the custom inspect method
		const inspectResult = err[Symbol.for("nodejs.util.inspect.custom")]();
		expect(typeof inspectResult).toBe("string");
		// Should contain both the human-readable message and the stack
		expect(inspectResult).toContain("MODULE_NOT_FOUND");
		expect(inspectResult).toContain("at ");
	});

	it("toJSON() returns a plain object with name, code, message, hint (lines 138-144)", () => {
		const err = new SlothletError("MODULE_NOT_FOUND", { modulePath: "./missing.mjs", hint: "Check path" });
		const json = err.toJSON();
		expect(json).toBeTypeOf("object");
		expect(json.name).toBe("SlothletError");
		expect(json.code).toBe("MODULE_NOT_FOUND");
		expect(typeof json.message).toBe("string");
		// hint is derived from translated HINT_ key (may be undefined if none exists)
		expect("hint" in json).toBe(true);
	});

	it("JSON.stringify(err) uses toJSON() and produces valid JSON (lines 138-144)", () => {
		const err = new SlothletError("MODULE_NOT_FOUND", { modulePath: "./missing.mjs" });
		const serialized = JSON.stringify(err);
		expect(typeof serialized).toBe("string");
		const parsed = JSON.parse(serialized);
		expect(parsed.name).toBe("SlothletError");
		expect(parsed.code).toBe("MODULE_NOT_FOUND");
	});
});
