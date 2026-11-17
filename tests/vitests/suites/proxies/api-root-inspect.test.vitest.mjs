/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-root-inspect.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:19-08:00 (1794882619)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `util.inspect` shows the api root's members, as it shows a node's, and to a module only the members
 * the module may read.
 *
 * @description
 * Each of three roots (a folder of files, one whose root file's default export is a function, and one whose root file's
 * default export is an async function) is loaded as the api and mounted again at `zz`. The host inspects the root and
 * `zz`; an `inspector` module the rules deny `pnum` and `data` inspects the root through `self` and through
 * `self.slothlet.diag.getAPI()`; a denied primitive is left out, a file's namespace stays listed. The host's view shows what its listed members show as a plain object, a module's
 * shows exactly the members it lists, and a function root or function node starts with the function's form. Eager and lazy mode, the async and live runtime, both attributions,
 * and a frozen root.
 * @module tests/vitests/suites/proxies/api-root-inspect
 */

import { describe, it, expect, afterEach } from "vitest";
import util from "node:util";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_root_integrity");

const ROOTS = ["objroot", "fnroot", "asyncroot"];
const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** The form `util.inspect` gives each root's function. */
const LABEL = { objroot: null, fnroot: "[Function: root]", asyncroot: "[AsyncFunction: root]" };

/**
 * What a node or the root shows: its listed members as a plain object, after its function's form for a function.
 * @param {object} node - The node.
 * @param {string|null} label - The function's form, or null for an object.
 * @returns {string} The expected text.
 */
function expected(node, label) {
	const members = {};
	for (const key of Object.keys(node)) members[key] = node[key];
	const text = util.inspect(members, { depth: 0 });
	return label ? `${label} ${text}` : text;
}

describe.each(ROOTS)("util.inspect of the api root > %s", (root) => {
	describe.each(configs)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Build the instance, every member loaded.
		 * @returns {Promise<object>} The api.
		 */
		async function build() {
			api = await slothlet({
				base: join(FIXTURE, root),
				silent: true,
				diagnostics: true,
				mode,
				runtime,
				permissions: {
					policy: "allow",
					caller: {
						attribution
					},
					rules: [
						{ caller: "i.**", target: "pnum", effect: "deny" },
						{ caller: "i.**", target: "data", effect: "deny" }
					]
				}
			});
			await api.slothlet.api.add("zz", join(FIXTURE, root), { id: "zz" });
			await api.slothlet.api.add("i", join(FIXTURE, "inspector"), { id: "i" });
			for (const member of ["data", "pnum", "tool"]) {
				await api[member];
				await api.zz[member];
			}
			await api.i.show;
			return api;
		}

		it("shows the host the root's members, as a node shows its own", async () => {
			await build();
			expect(util.inspect(api, { depth: 0 })).toBe(expected(api, LABEL[root]));
			expect(util.inspect(api.zz, { depth: 0 })).toBe(expected(api.zz, LABEL[root]));
			expect(util.inspect(api, { depth: 0 })).toContain("pnum: 7");
		});

		it.each(["self", "api"])("shows a module, through %s, only the members it may read", async (via) => {
			await build();
			const { shown, keys } = api.i.show(via);
			expect(keys).not.toContain("pnum");
			// A file's namespace stays listed under a deny, as at any node (its members are what the rule holds).
			expect(keys).toContain("data");
			expect(keys).toContain("tool");
			// Every member the module lists is shown, and nothing else, after the function's form for a function root.
			const names = (text) => [...text.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]);
			expect(names(shown)).toEqual(keys);
			expect(shown.startsWith(LABEL[root] ? `${LABEL[root]} {` : "{")).toBe(true);
		});

		it("shows a frozen root's members", async () => {
			await build();
			Object.freeze(api);
			expect(util.inspect(api, { depth: 0 })).toBe(expected(api, LABEL[root]));
		});
	});
});
