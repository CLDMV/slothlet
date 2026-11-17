/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/errors-v4-shape.test.vitest.mjs
 *	@Date: 2026-11-16T17:35:08-08:00 (1794879308)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:46-08:00 (1794882586)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The v4 shape of SlothletError and SlothletWarning: `(code, details, { cause })`, `details` in place of
 * `context`, no `originalError`, no construction flags, and a hint that is always a translated sentence.
 *
 * @description
 * - The hint is the cause's detected hint when there is a cause, else the code's own HINT_<code> when it has one, else
 *   none (#835: never English text passed in by a site).
 * - `toJSON()` reports the error's own hint (#831).
 * - `details` holds the details only: no `validationError` / `stub` flags (#836).
 * - Messages render a segments array joined with ".", `{name.N}` as one element and `{name|list}` as a list.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { translate } from "@cldmv/slothlet/i18n";
import { generate } from "@cldmv/slothlet/typegen";

describe("SlothletError v4 shape", () => {
	it("takes (code, details, { cause }) and exposes details, cause and no v3 channels", () => {
		const cause = new Error("disk on fire");
		const error = new SlothletError("MODULE_IMPORT_FAILED", { file: "./a.mjs" }, { cause });
		expect(error.code).toBe("MODULE_IMPORT_FAILED");
		expect(error.cause).toBe(cause);
		expect(error.details).toEqual({ file: "./a.mjs", error: "disk on fire" });
		expect(error.message).toContain("disk on fire");
		expect("context" in error).toBe(false);
		expect("originalError" in error).toBe(false);
	});

	it("treats a cause of 0, false or an empty string as a cause", () => {
		for (const cause of [0, false, ""]) {
			const error = new SlothletError("MODULE_IMPORT_FAILED", { file: "./a.mjs" }, { cause });
			expect(error.cause).toBe(cause);
			expect("error" in error.details).toBe(true);
		}
	});

	it("uses the code's own HINT_<code> when there is no cause", () => {
		const error = new SlothletError("INVALID_CONFIG", { option: "x", value: 1, expected: "a string" });
		expect(error.hint).toBe(translate("HINT_INVALID_CONFIG"));
	});

	it("has no hint when there is no cause and the code has no HINT_<code>", () => {
		const error = new SlothletError("INVALID_CONFIG_FILES_INVALID", { received: "a string" });
		expect(error.hint).toBeUndefined();
	});

	it("detects the hint from the cause when there is one", () => {
		const error = new SlothletError("MODULE_IMPORT_FAILED", { file: "./a.mjs" }, { cause: new Error("Cannot find module './a.mjs'") });
		expect(error.hint).toBe(translate("HINT_MODULE_NOT_FOUND"));
	});

	it("reports its own hint from toJSON (#831)", () => {
		const error = new SlothletError("INVALID_CONFIG", { option: "x", value: 1, expected: "a string" });
		expect(error.toJSON()).toEqual({ name: "SlothletError", code: "INVALID_CONFIG", message: error.message, hint: error.hint });
		expect(JSON.parse(JSON.stringify(error)).hint).toBe(translate("HINT_INVALID_CONFIG"));
	});

	it("keeps the construction flags out of the details of a config error (#836)", async () => {
		const error = await generate(null).catch((thrown) => thrown);
		expect(error.code).toBe("INVALID_CONFIG");
		expect("validationError" in error.details).toBe(false);
		expect("stub" in error.details).toBe(false);
		expect("hint" in error.details).toBe(false);
	});

	it("gives a translated hint where a site used to pass English text (#835)", async () => {
		const error = await generate({ base: "./api", output: 5, name: "Api" }).catch((thrown) => thrown);
		expect(error.code).toBe("INVALID_CONFIG");
		expect(error.hint).toBe(translate("HINT_INVALID_CONFIG"));
		expect(error.message).not.toMatch(/HINT_/);
	});

	it("labels the details 'Details:' in toString", () => {
		const error = new SlothletError("MODULE_IMPORT_FAILED", { file: "./a.mjs" }, { cause: new Error("x") });
		expect(error.toString()).toContain("Details:");
		expect(error.toString()).toContain("file: ./a.mjs");
	});
});

describe("SlothletWarning v4 shape", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("takes (code, details, { cause }) and prints its details under 'Details:'", () => {
		const Warning = SlothletWarning.forInstance();
		Warning.suppressConsole = false;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const cause = new Error("handler failed");
		const warning = new Warning("WARNING_LANGUAGE_LOAD_FAILED", { lang: "zz-zz" }, { cause });
		expect(warning.details).toEqual({ lang: "zz-zz" });
		expect(warning.cause).toBe(cause);
		expect("context" in warning).toBe(false);
		expect(warn.mock.calls.some((call) => call[0] === "Details:")).toBe(true);
		expect(warn.mock.calls.some((call) => call[0] === "Context:")).toBe(false);
	});
});

describe("message rendering of arrays", () => {
	it("joins a segments array with '.'", () => {
		expect(translate("CHAIN_NOT_CALLABLE", { path: ["math", "deep"], chain: ["add"] })).toContain("'math.deep.add'");
	});

	it("renders {name.N} as one element and {name|list} as a list", () => {
		const message = translate("WARNING_MULTIPLE_ROOT_CONTRIBUTORS", { contributors: ["alpha", "beta"] });
		expect(message).toContain("alpha, beta");
		expect(message).toContain("api.alpha()");
	});

	it("renders a placeholder with no value as empty", () => {
		expect(translate("CHAIN_NOT_CALLABLE", { path: ["math"] })).toContain("'math.'");
	});
});
