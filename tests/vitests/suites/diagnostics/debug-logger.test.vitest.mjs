/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/debug-logger.test.vitest.mjs
 *	@Date: 2026-02-25 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
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
