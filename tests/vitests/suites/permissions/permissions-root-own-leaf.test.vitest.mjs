/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-root-own-leaf.test.vitest.mjs
 *	@Date: 2026-11-15T16:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T16:00:00-08:00 (1794787200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root function's own code runs as the api root's leaf, as a function node's code runs as its
 * node: its `self` reads are its own, whoever calls it.
 *
 * @description
 * Fixture `api_test_root_own_leaf` (two copies: `plain`, and `withleaf`, whose root file also exports `other`):
 * ```
 * root.mjs    export default function root() → self.vault.get(), or "threw:<code>"
 * vault.mjs   get() → "SECRET"
 * reader.mjs  callRoot() → self.call(null); direct() → self.vault.get()
 * ```
 * The api root's path is `""`: no rule names it on its own, a caller pattern `**` matches it, and `defaultPolicy`
 * decides otherwise. So the root's read of the vault follows the rules for `""` alone, whether the host or a module
 * calls it: a deny for the reader does not reach it, an allow for the reader does not lift it. A module calling the root
 * still has to be allowed the call. With the permission system off or disabled every read answers.
 * @module tests/vitests/suites/permissions/permissions-root-own-leaf
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_root_own_leaf");
const DENIED = "threw:PERMISSION_DENIED";
const SECRET = "SECRET";

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

const POLICIES = [
	{ label: "default allow, no rule", permissions: { rules: [] }, host: SECRET, callRoot: SECRET, direct: SECRET },
	{
		label: "every caller denied the vault",
		permissions: { rules: [{ caller: "**", target: "vault.**", effect: "deny" }] },
		host: DENIED,
		callRoot: DENIED,
		direct: DENIED
	},
	{
		label: "the reader denied the vault",
		permissions: { rules: [{ caller: "reader.**", target: "vault.**", effect: "deny" }] },
		host: SECRET,
		callRoot: SECRET,
		direct: DENIED
	},
	{
		label: "default deny, the reader allowed everything",
		permissions: { defaultPolicy: "deny", rules: [{ caller: "reader.**", target: "**", effect: "allow" }] },
		host: DENIED,
		callRoot: DENIED,
		direct: SECRET
	},
	{
		label: "default deny, every caller allowed everything",
		permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "**", effect: "allow" }] },
		host: SECRET,
		callRoot: SECRET,
		direct: SECRET
	},
	{
		label: "the reader refused the call of the root",
		permissions: {
			rules: [
				{ caller: "reader.**", target: "**", effect: "deny" },
				{ caller: "reader.**", target: "vault.**", effect: "allow" }
			]
		},
		host: SECRET,
		callRoot: DENIED,
		direct: SECRET
	},
	{ label: "permissions off", permissions: undefined, host: SECRET, callRoot: SECRET, direct: SECRET },
	{ label: "permissions disabled", permissions: { mode: "disabled" }, host: SECRET, callRoot: SECRET, direct: SECRET }
];

describe.each(CONFIGS)("the api root function runs as the api root > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	describe.each(["plain", "withleaf"])("root file %s", (folder) => {
		describe.each(POLICIES)("$label", (policy) => {
			let api;

			beforeAll(async () => {
				const permissions = policy.permissions === undefined ? undefined : { attribution, ...policy.permissions };
				api = await slothlet({ base: path.join(FIXTURE, folder), mode, runtime, silent: true, permissions });
			}, 60000);

			afterAll(async () => {
				await api?.shutdown?.();
				api = null;
			}, 60000);

			it("the host calling the root: the root reads as itself", async () => {
				expect(await api()).toBe(policy.host);
			});

			it("a module calling the root: the root reads as itself, once the call is allowed", async () => {
				expect(await api.reader.callRoot()).toBe(policy.callRoot);
			});

			it("the module's own read follows its own rules", async () => {
				expect(await api.reader.direct()).toBe(policy.direct);
			});
		});
	});
});
