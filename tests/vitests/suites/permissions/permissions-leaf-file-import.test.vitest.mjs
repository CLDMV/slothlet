/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-leaf-file-import.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T10:24:21-08:00 (1795544661)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file that loads a sibling leaf's file is refused: module code imports lib files, never a leaf
 * file, so the sibling's `require("./keeper.cjs")` or `import "./keeper.mjs"` fails with MODULE_LEAF_IMPORT_REFUSED.
 *
 * @description
 * Fixture `api_test_leaf_file_import_siblings`: each folder holds a `keeper` leaf and a sibling that requires or
 * imports `./keeper` while it loads, `alpha` before slothlet loads the keeper leaf, `zulu` after, CommonJS and ES
 * modules. Each folder is loaded as a base tree of its own and mounted on a tree that is clean; an eager load fails
 * with the sibling's MODULE_IMPORT_FAILED, the refusal as its cause, and a lazy one when the folder is built (a base
 * tree's root files as it builds). Fixture
 * `api_test_leaf_file_import` is a clean tree: its keeper leaves, which nothing imports, read the vault's secret as
 * themselves.
 *
 * @module tests/vitests/suites/permissions/permissions-leaf-file-import
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { apiPart, getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const CLEAN = apiPart(TEST_DIRS.API_TEST_LEAF_FILE_IMPORT);
const SIBLINGS = apiPart(TEST_DIRS.API_TEST_LEAF_FILE_IMPORT, "siblings");
const REFUSED = "MODULE_LEAF_IMPORT_REFUSED";

/** Each folder, its sibling and the file extension: `alpha` loads the keeper's file before slothlet loads the leaf, `zulu` after. */
const SHAPES = [
	["cjsearly", "alpha", "cjs"],
	["cjslate", "zulu", "cjs"],
	["esmearly", "alpha", "mjs"],
	["esmlate", "zulu", "mjs"]
];

/** Deny by default; the secret is the keeper leaves' alone. */
const RULES = [
	{ caller: "**.keeper.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "**", target: "slothlet.**", effect: "allow" }
];

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
 * The outcome of a step: its value, or the refusal in what it threw and the code it threw with.
 * @param {function(): *} fn - The step.
 * @returns {Promise<{value?: *, refused?: *, top?: string, code?: string}>} The outcome.
 */
async function outcome(fn) {
	try {
		return { value: await withSuppressedSlothletErrorOutput(fn) };
	} catch (error) {
		for (let at = error, depth = 0; at && depth < 10; at = at.cause, depth++)
			if (at?.code === REFUSED) return { refused: at, top: error.code };
		return { code: error?.code ?? String(error?.message ?? error) };
	}
}

/**
 * Whether a refusal names the sibling and the keeper's file.
 * @param {*} refused - The refusal.
 * @param {string} folder - The folder.
 * @param {string} sibling - The sibling.
 * @param {string} ext - The files' extension.
 * @returns {void}
 */
function expectNames(refused, folder, sibling, ext) {
	const message = String(refused.message).replace(/\\/g, "/");
	expect(message).toContain(`${folder}/${sibling}.${ext}`);
	expect(message).toContain(`${folder}/keeper.${ext}`);
}

describe.each(getMatrixConfigs())("Permissions > a sibling's load of a leaf's file is refused > $name", ({ config }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		const options = (base) => ({ ...config, base, permissions: { policy: "deny", rules: RULES, caller: { attribution } } });
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("a keeper leaf nothing imports is itself", async () => {
			api = await slothlet(options(CLEAN));
			for (const folder of ["cjs", "esm"]) {
				// The CommonJS keeper takes the runtime with a dynamic import: let it settle.
				await attempt(() => api[folder].keeper.who());
				await new Promise((resolve) => setTimeout(resolve, 20));
				expect(await attempt(() => api[folder].keeper.read())).toEqual(SECRET);
				expect(await attempt(() => api[folder].keeper.who())).toEqual({ ok: true, value: `${folder}.keeper.who` });
			}
		});

		describe.each(SHAPES)("%s (sibling %s)", (folder, sibling, ext) => {
			it("is refused in the base tree", async () => {
				// The two files sit at the tree's root, which a lazy tree loads as it builds too.
				const built = await outcome(async () => {
					api = await slothlet(options(path.join(SIBLINGS, folder)));
					return api[sibling].whoViaCopy();
				});
				expect(built.refused, "the build fails with the refusal as a cause").toBeTruthy();
				if (config.mode === "eager") expect(built.top).toBe("MODULE_IMPORT_FAILED");
				expectNames(built.refused, folder, sibling, ext);
			});

			it("is refused in an api.add() mount", async () => {
				api = await slothlet(options(CLEAN));
				const added = await outcome(async () => {
					await api.slothlet.api.add(folder, path.join(SIBLINGS, folder), { id: `${folder}-mod` });
					return api[folder][sibling].whoViaCopy();
				});
				expect(added.refused).toBeTruthy();
				expectNames(added.refused, folder, sibling, ext);
			});
		});
	});
});
