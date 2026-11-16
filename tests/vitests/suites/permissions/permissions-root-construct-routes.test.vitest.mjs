/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-root-construct-routes.test.vitest.mjs
 *	@Date: 2026-11-15T17:22:11-08:00 (1794792131)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:56:45-08:00 (1794797805)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The routes that construct the api root through `self` (#803): `new self()` makes an instance of a
 * function root, so its `constructor` reads the root's own member under the reader's rules, as every other route does.
 *
 * @description
 * Fixture `api_test_function_member_routes` (see permissions-function-member-routes): `base/root.mjs` exports a
 * function with `root.tag = "TAG"`, and `base/reader.mjs`'s `at("")` runs `lib/routes.mjs` on `self`. That file skips
 * these routes for the root, as `self` was no constructor before #803. Expected values come from `routes()` run on the
 * plain function.
 * @module tests/vitests/suites/permissions/permissions-root-construct-routes
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import plainRoot from "../../../../api_tests/api_test_function_member_routes/base/root.mjs";
import { routes } from "../../../../api_tests/api_test_function_member_routes/lib/routes.mjs";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_function_member_routes/base");
const DENIED = "threw:PERMISSION_DENIED";
const CONSTRUCTING = ["instance", "instanceUsed", "instancePrototype"];

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

const DENY_TAG = [{ caller: "reader.**", target: "tag", effect: "deny" }];
const ALLOW_ALL = [{ caller: "reader.**", target: "**", effect: "allow" }];

const POLICIES = [
	{ label: "a deny rule on the member", permissions: (attribution) => ({ attribution, rules: DENY_TAG }), allowed: false },
	{
		label: "default deny, everything but the member allowed",
		permissions: (attribution) => ({ defaultPolicy: "deny", attribution, rules: [...ALLOW_ALL, ...DENY_TAG] }),
		allowed: false
	},
	{ label: "default allow, no rule", permissions: (attribution) => ({ attribution }), allowed: true },
	{
		label: "default deny, everything allowed",
		permissions: (attribution) => ({ defaultPolicy: "deny", attribution, rules: ALLOW_ALL }),
		allowed: true
	},
	{ label: "permissions off", permissions: () => undefined, allowed: true },
	{ label: "permissions disabled", permissions: () => ({ mode: "disabled" }), allowed: true }
];

const plain = routes(plainRoot);

describe.each(CONFIGS)("constructing the api root through self > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	describe.each(POLICIES)("$label", (policy) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: policy.permissions(attribution) });
		}, 60000);

		afterAll(async () => {
			await api?.shutdown?.();
			api = null;
		}, 60000);

		it.each(CONSTRUCTING)("%s answers as the direct read rules", async (route) => {
			const expected = policy.allowed || route === "instanceUsed" ? plain[route] : DENIED;
			expect((await api.reader.at(""))[route]).toBe(expected);
		});
	});
});
