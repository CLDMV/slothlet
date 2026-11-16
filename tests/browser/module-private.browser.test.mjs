/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/module-private.browser.test.mjs
 *	@Date: 2026-11-15T19:04:00-08:00 (1794798240)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T19:13:34-08:00 (1794798814)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module-private `_`/`__` members in a real headless browser (#260).
 *
 * @description
 * With permissions on, a `_`/`__`-prefixed member is reachable through `self` by the files of the folder that exports
 * it and refused to every other module and, by default, to the host. The check compares the two files' folders; in a
 * browser the files are URLs, so these rows check that a same-folder read and an other-folder read answer as they do
 * under Node. Expected values come from the fixture files imported plainly in the page.
 *
 * @module tests/browser/module-private.browser
 */

import { describe, it, expect } from "vitest";

const FIXTURE = "api_tests/api_test_private";
const MANIFEST = {
	files: [],
	directories: [
		{
			name: "billing",
			path: "billing",
			children: {
				files: [
					{ path: "billing/internals.mjs", name: "internals", fullName: "internals.mjs" },
					{ path: "billing/quote.mjs", name: "quote", fullName: "quote.mjs" }
				],
				directories: []
			}
		},
		{
			name: "reporting",
			path: "reporting",
			children: { files: [{ path: "reporting/peek.mjs", name: "peek", fullName: "peek.mjs" }], directories: [] }
		}
	]
};

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * The fixture's served base URL, with a trailing slash.
 * @returns {string} The base URL.
 */
const baseUrl = () => new URL("/" + FIXTURE + "/", location.origin).href;

/**
 * Compose the fixture in browser mode.
 * @param {object} options - Mode, runtime and permissions.
 * @returns {Promise<object>} A bound browser-mode api.
 */
const build = async (options) => {
	const mod = await import("@cldmv/slothlet");
	const slothlet = mod.default ?? mod.slothlet;
	const BASE = baseUrl();
	return slothlet({
		platform: "browser",
		base: BASE,
		manifest: MANIFEST,
		resolveModuleSpecifier: ({ path }) => new URL(path, BASE).href,
		silent: true,
		...options
	});
};

/**
 * What a read gives, or the code it threw.
 * @param {function(): *} read - The read.
 * @returns {Promise<*>} The value, or `THREW:<code>`.
 */
const settled = async (read) => {
	try {
		return await read();
	} catch (error) {
		return `THREW:${error?.code ?? error}`;
	}
};

describe("module-private members in a real browser", () => {
	describe.each(configs)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
		it("a file of the same folder reads the private members through self", async () => {
			const internals = await import(/* @vite-ignore */ baseUrl() + "billing/internals.mjs?plain-twin");
			const api = await build({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, rules: [] } });
			try {
				expect(await settled(() => api.billing.quote.total(100))).toBe(100 * (1 + internals.__rate) + internals._fee);
			} finally {
				await api.shutdown();
			}
		});

		it("a file of another folder is refused the private member; the host is refused by default", async () => {
			const api = await build({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, rules: [] } });
			try {
				expect(await settled(() => api.reporting.peek.rate())).toEqual({ rate: undefined, error: "PERMISSION_DENIED" });
				expect(await settled(() => api.billing.internals.__rate)).toBe("THREW:PERMISSION_DENIED");
			} finally {
				await api.shutdown();
			}
		});

		it("an allow rule naming the private member still grants another folder nothing", async () => {
			const api = await build({
				mode,
				runtime,
				permissions: {
					defaultPolicy: "deny",
					attribution,
					rules: [
						{ caller: "**", target: "billing.internals.__rate", effect: "allow" },
						{ caller: "reporting.**", target: "billing.**", effect: "allow" }
					]
				}
			});
			try {
				expect(await settled(() => api.reporting.peek.rate())).toEqual({ rate: undefined, error: "PERMISSION_DENIED" });
			} finally {
				await api.shutdown();
			}
		});
	});

	it.each(["eager", "lazy"])("with no permissions config the private members are public (%s)", async (mode) => {
		const internals = await import(/* @vite-ignore */ baseUrl() + "billing/internals.mjs?plain-twin");
		const api = await build({ mode });
		try {
			expect(await settled(() => api.billing.internals.__rate)).toBe(internals.__rate);
			expect(await settled(() => api.reporting.peek.rate())).toEqual({ rate: internals.__rate, error: null });
		} finally {
			await api.shutdown();
		}
	});
});
