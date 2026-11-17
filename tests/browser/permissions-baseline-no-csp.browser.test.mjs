/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/permissions-baseline-no-csp.browser.test.mjs
 *	@Date: 2026-11-16T03:00:00-08:00 (1794826800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:19-08:00 (1794874579)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The permission baseline in a real browser, with no Content Security Policy: `csp-eval`, `csp-blob-script` and
 * `csp-data-script` are tried for real (a `Function` built from a string, an import of a `blob:` and of a `data:`
 * module), and under "on" and "strict" the instance warns or refuses, or starts, as they find.
 */

import { describe, it, expect, afterEach } from "vitest";
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

const MET = false;
const IDS = ["csp-eval", "csp-blob-script", "csp-data-script"];

/**
 * Start an instance of the browser fixture with a permissions mode.
 * @param {string} mode - The permissions mode.
 * @returns {Promise<object>} The api.
 */
const boot = async (mode) => {
	const mod = await import("@cldmv/slothlet");
	const slothlet = mod.default ?? mod.slothlet;
	const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
	return slothlet({
		platform: "browser",
		base: BASE,
		manifest,
		resolveModuleSpecifier: ({ path }) => new URL(path, BASE).href,
		mode: "eager",
		permissions: { mode, defaultPolicy: "allow" }
	});
};

describe("permission baseline in a browser with no Content Security Policy", () => {
	let api = null;

	afterEach(async () => {
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.suppressConsole = false;
		SlothletWarning.captured.length = 0;
		await api?.shutdown?.();
		api = null;
	});

	it("tries each check for real", async () => {
		const { runBaseline } = await import("#helpers/permission-baseline");
		const { met, checks } = await runBaseline("browser");
		expect(checks.map((check) => [check.id, check.met])).toEqual(IDS.map((id) => [id, MET]));
		expect(met).toBe(MET);
		for (const check of checks) expect(check.reason === null).toBe(MET);
	});

	it("under on, starts and warns once for each check not met", async () => {
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.suppressConsole = true;
		api = await boot("on");
		const warned = SlothletWarning.captured.filter((warning) => warning.code === "WARNING_PERMISSION_BASELINE_UNMET");
		expect(warned.map((warning) => warning.context.check)).toEqual(MET ? [] : IDS);
		const report = api.slothlet.permissions.control.report();
		expect(report.mode).toBe("on");
		expect(report.baseline.met).toBe(MET);
	});

	it("under strict, " + (MET ? "starts" : "refuses to start, naming every check"), async () => {
		const started = await boot("strict").then(
			(value) => ((api = value), "started"),
			(error) => error
		);
		if (MET) {
			expect(started).toBe("started");
			expect(api.slothlet.permissions.control.report().mode).toBe("strict");
			expect(() => api.slothlet.permissions.control.disable()).toThrow(expect.objectContaining({ code: "PERMISSION_STRICT_FIXED" }));
		} else {
			expect(started?.code).toBe("PERMISSION_BASELINE_UNMET");
			for (const id of IDS) expect(started.message).toContain(id);
		}
	});
});
