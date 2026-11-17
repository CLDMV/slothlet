/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-leaf-file-import.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:58-08:00 (1794882598)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file that loads a sibling leaf's file itself loads a helper file of its own: what that load
 * evaluates is held to the api file that loaded it, as a helper file's code is, while slothlet's own load of the file
 * stays the leaf.
 *
 * @description
 * Each folder holds a `keeper` leaf that may read the vault's secret and a sibling that requires or imports
 * `./keeper` itself while it loads: `alpha` before slothlet loads the keeper leaf, `zulu` after. CommonJS and ES
 * module folders, mounted and in the base tree. Both orders give the same answer, whether the instance loads helper files once or once per importing api file (`helpers: "module"`): the sibling's copy of the file is a
 * helper the sibling imports, so its code reaches the secret only when the sibling may, inside the sibling's call and
 * when the host runs a function the sibling handed out. The keeper leaf itself is unaffected.
 *
 * @module tests/vitests/suites/permissions/permissions-leaf-file-import
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_LEAF_FILE_IMPORT;

/** The mounted folders; the base tree holds the vault and the same four shapes under a `b` prefix. */
const MOUNTS = ["cjsearly", "cjslate", "esmearly", "esmlate"];

/** Each folder and its sibling: `alpha` loads the keeper's file before slothlet loads the leaf, `zulu` after. */
const SHAPES = [
	["cjsearly", "alpha"],
	["cjslate", "zulu"],
	["esmearly", "alpha"],
	["esmlate", "zulu"],
	["bcjsearly", "alpha"],
	["bcjslate", "zulu"],
	["besmearly", "alpha"],
	["besmlate", "zulu"]
];

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

const DENIED = { ok: false, code: "PERMISSION_DENIED" };
const SECRET = { ok: true, value: "s3cret" };

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

/**
 * Build the base tree and mount the folders.
 * @param {object} config - The matrix configuration.
 * @param {string} attribution - The attribution mode.
 * @param {Array<object>} rules - The permission rules.
 * @param {string} [helpers] - The `helpers` option, when one is given.
 * @returns {Promise<object>} The api.
 */
async function build(config, attribution, rules, helpers) {
	const api = await slothlet({
		...config,
		...(helpers ? { helpers } : {}),
		base: path.join(DIR, "base"),
		permissions: { policy: "deny", rules, caller: { attribution } }
	});
	for (const mount of MOUNTS) await api.slothlet.api.add(mount, path.join(DIR, mount), { moduleID: `${mount}-mod` });
	// The CommonJS files take the runtime with a dynamic import: let it settle.
	await new Promise((resolve) => setTimeout(resolve, 20));
	return api;
}

describe.each(getMatrixConfigs())("Permissions > a sibling's load of a leaf's file is a helper of the sibling > $name", ({ config }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		describe.each([undefined, "module"])("helpers %s", (helpers) => {
			describe("only the keepers may read the secret", () => {
				let api;

				beforeAll(async () => {
					api = await build(config, attribution, RULES, helpers);
				});

				afterAll(async () => {
					await api?.shutdown();
				});

				describe.each(SHAPES)("%s (sibling %s)", (folder, sibling) => {
					it("the keeper leaf is itself", async () => {
						expect(await attempt(() => api[folder].keeper.read())).toEqual(SECRET);
						expect(await attempt(() => api[folder].keeper.who())).toEqual({ ok: true, value: `${folder}.keeper.who` });
					});

					it("the sibling's copy of the file is not the leaf's module", async () => {
						expect(await api[folder][sibling].sameAs(api[folder].keeper.read)).toBe(false);
					});

					it("inside the sibling's call, the copy runs as the sibling", async () => {
						expect(await attempt(() => api[folder][sibling].whoViaCopy())).toEqual({ ok: true, value: `${folder}.${sibling}.whoViaCopy` });
						expect(await withSuppressedSlothletErrorOutput(() => attempt(() => api[folder][sibling].viaCopy()))).toEqual(DENIED);
					});

					it("run by the host, the copy is held to the sibling that loaded it", async () => {
						const fn = await api[folder][sibling].give();
						expect(await withSuppressedSlothletErrorOutput(() => attempt(() => fn()))).toEqual(DENIED);
						const nested = await api[folder][sibling].giveNested();
						expect(await withSuppressedSlothletErrorOutput(() => attempt(() => nested.fn()))).toEqual(DENIED);
					});
				});
			});

			describe("the siblings may read the secret too", () => {
				let api;

				beforeAll(async () => {
					api = await build(config, attribution, [...RULES, ...SIBLINGS_ALLOWED], helpers);
				});

				afterAll(async () => {
					await api?.shutdown();
				});

				describe.each(SHAPES)("%s (sibling %s)", (folder, sibling) => {
					it("inside the sibling's call, the copy reaches what the sibling may", async () => {
						expect(await attempt(() => api[folder][sibling].viaCopy())).toEqual(SECRET);
					});

					it("run by the host, the copy reaches what the sibling may", async () => {
						const fn = await api[folder][sibling].give();
						expect(await attempt(() => fn())).toEqual(SECRET);
						const nested = await api[folder][sibling].giveNested();
						expect(await attempt(() => nested.fn())).toEqual(SECRET);
					});
				});
			});

			describe("two running instances load the same CommonJS files", () => {
				let keepersOnly;
				let siblingsToo;

				beforeAll(async () => {
					keepersOnly = await build(config, attribution, RULES, helpers);
					siblingsToo = await build(config, attribution, [...RULES, ...SIBLINGS_ALLOWED], helpers);
				});

				afterAll(async () => {
					await keepersOnly?.shutdown();
					await siblingsToo?.shutdown();
				});

				describe.each(SHAPES.filter(([folder]) => folder.includes("cjs")))("%s (sibling %s)", (folder, sibling) => {
					it("a copy the host runs is never the keeper's, whichever instance's it is", async () => {
						// Nothing on the stack names the instance (#735): a function handed out as it is runs under the record the
						// stand-in keeps ("precise") or not at all; one nested in data runs nowhere.
						const fn = await keepersOnly[folder][sibling].give();
						const nested = await keepersOnly[folder][sibling].giveNested();
						const direct = await withSuppressedSlothletErrorOutput(() => attempt(() => fn()));
						expect(direct).toEqual(attribution === "precise" ? DENIED : { ok: false, code: expect.any(String) });
						expect((await withSuppressedSlothletErrorOutput(() => attempt(() => nested.fn()))).ok).toBe(false);
						const allowedFn = await siblingsToo[folder][sibling].give();
						if (attribution === "precise") expect(await attempt(() => allowedFn())).toEqual(SECRET);
					});

					it("each instance's keeper leaf is itself", async () => {
						expect(await attempt(() => keepersOnly[folder].keeper.read())).toEqual(SECRET);
						expect(await attempt(() => siblingsToo[folder].keeper.read())).toEqual(SECRET);
					});
				});
			});
		});
	});
});
