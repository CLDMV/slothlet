/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/leaf-file-import.browser.test.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:59-08:00 (1794882539)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, an api file that imports a sibling leaf's file itself loads a module of the file other
 * than the one slothlet built the leaf from, and that module's code is never the leaf's.
 *
 * @description
 * Fixture `api_test_leaf_file_import_browser`: `early/alpha.mjs` imports `./keeper.mjs` before slothlet loads the
 * `keeper` leaf, `late/zulu.mjs` after; only the keepers may read the vault's secret. The sibling's import resolves to
 * the file's plain URL, while slothlet imports the leaf under its instance and mount tags, so the two are told apart.
 * Inside the sibling's call the copy runs as the sibling's call, as a helper file of the module's folder does. Run by the
 * page, it is held to the sibling's leaf where a `"precise"` stand-in records it; elsewhere nothing in a browser says which
 * api file imported it (there is no import record), so it is refused.
 * @module tests/browser/leaf-file-import
 */

import { describe, it, expect } from "vitest";
import { leafCopyManifest, leafCopyRel } from "virtual:browser-fixture-manifest";

const BASE = new URL("/" + leafCopyRel + "/", location.origin).href;

/** Deny by default; the secret is the keeper leaves' alone. */
const RULES = [
	{ caller: "**.keeper.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "**", target: "slothlet.**", effect: "allow" }
];

/** The siblings may read the secret too. */
const SIBLINGS_ALLOWED = [
	{ caller: "**.alpha.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**.zulu.**", target: "vault.secret.secret", effect: "allow" }
];

/**
 * Capture a call's outcome.
 * @param {function(): *} invoke - The call.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 */
async function attempt(invoke) {
	try {
		return { ok: true, value: await invoke() };
	} catch (error) {
		return { ok: false, code: error?.code ?? String(error) };
	}
}

const DENIED = { ok: false, code: "PERMISSION_DENIED" };
const SECRET = { ok: true, value: "s3cret" };

describe.each(["eager", "lazy"].flatMap((mode) => ["precise", "fast"].map((attribution) => ({ mode, attribution }))))(
	"browser: a sibling's import of a leaf's file > $mode / $attribution",
	({ mode, attribution }) => {
		/**
		 * Boot the fixture.
		 * @param {Array<object>} rules - The permission rules.
		 * @returns {Promise<object>} The api.
		 */
		const boot = async (rules) => {
			const mod = await import("@cldmv/slothlet");
			const slothlet = mod.default ?? mod.slothlet;
			return slothlet({
				base: BASE,
				loader: {
					platform: "browser",
					files: leafCopyManifest,
					resolve: ({ path }) => new URL(path, BASE).href
				},
				mode,
				silent: true,
				permissions: { policy: "deny", rules, caller: { attribution } }
			});
		};

		describe.each([
			["early", "alpha"],
			["late", "zulu"]
		])("%s (sibling %s)", (folder, sibling) => {
			it("the keeper leaf is itself, and the sibling's copy is another module", async () => {
				const api = await boot(RULES);
				try {
					expect(await attempt(() => api[folder].keeper.read())).toEqual(SECRET);
					expect(await attempt(() => api[folder].keeper.who())).toEqual({ ok: true, value: `${folder}.keeper.who` });
					expect(await api[folder][sibling].sameAs(api[folder].keeper.read)).toBe(false);
				} finally {
					await api.shutdown();
				}
			});

			it("inside the sibling's call, the copy runs as the sibling", async () => {
				const api = await boot(RULES);
				try {
					expect(await attempt(() => api[folder][sibling].whoViaCopy())).toEqual({ ok: true, value: `${folder}.${sibling}.whoViaCopy` });
					expect(await attempt(() => api[folder][sibling].viaCopy())).toEqual(DENIED);
				} finally {
					await api.shutdown();
				}
				const allowed = await boot([...RULES, ...SIBLINGS_ALLOWED]);
				try {
					expect(await attempt(() => allowed[folder][sibling].viaCopy())).toEqual(SECRET);
				} finally {
					await allowed.shutdown();
				}
			});

			it("run by the page, the copy is never the keeper's", async () => {
				const api = await boot(RULES);
				try {
					const fn = await api[folder][sibling].give();
					expect(await attempt(() => fn())).toEqual(DENIED);
					const nested = await api[folder][sibling].giveNested();
					expect(await attempt(() => nested.fn())).toEqual(DENIED);
				} finally {
					await api.shutdown();
				}
			});

			it("run by the page, the copy is held to the sibling where a stand-in names it, and refused elsewhere", async () => {
				const api = await boot([...RULES, ...SIBLINGS_ALLOWED]);
				try {
					// "precise": the stand-in records the sibling's leaf that handed the function out. Without one ("fast", or
					// a function nested in data) nothing in a browser names the api file that imported the copy.
					const fn = await api[folder][sibling].give();
					expect(await attempt(() => fn())).toEqual(attribution === "precise" ? SECRET : DENIED);
					const nested = await api[folder][sibling].giveNested();
					expect(await attempt(() => nested.fn())).toEqual(DENIED);
				} finally {
					await api.shutdown();
				}
			});
		});
	}
);
