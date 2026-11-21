/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-root-inspect-framework.test.vitest.mjs
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
 * @fileoverview A module's `util.inspect(self)` shows the framework's members of the root as plain JS shows an object's:
 * `slothlet: [Object]` and each function by its own form (`[AsyncFunction: shutdown]`), unquoted, as the host sees them.
 *
 * @description
 * The expected line of each framework member (`slothlet`, `shutdown`, `destroy`, `initialize`) is the host's line for
 * it in `util.inspect(api)`, which is what plain JS gives the same values. At depth 0 and depth 2 (where the namespace
 * shows its own members). Eager and lazy mode, the async and live runtime, permissions off and on.
 * @module tests/vitests/suites/proxies/api-root-inspect-framework
 */

import { describe, it, expect, afterEach } from "vitest";
import util from "node:util";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_slothlet_namespace_view");
const FRAMEWORK = ["slothlet", "shutdown", "destroy", "initialize"];

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => [false, true].map((permissions) => ({ mode, runtime, permissions })))
);

/**
 * The line `util.inspect` (`compact: false`, depth 0) gives a top-level member.
 * @param {string} text - The text.
 * @param {string} key - The member.
 * @returns {string|undefined} The line, without its indentation and trailing comma.
 */
const line = (text, key) => text.match(new RegExp(`^ {2}${key}: (.*?),?$`, "m"))?.[1];

describe.each(configs)(
	"util.inspect(self) shows the framework's root members > $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("as plain JS shows them, the same as the host sees them", async () => {
			api = await slothlet({
				base: FIXTURE,
				silent: true,
				mode,
				runtime,
				...(permissions ? { permissions: { policy: "allow" } } : {})
			});
			await api.reader;
			const host = util.inspect(api, { depth: 0, compact: false });
			const shown = api.reader.shown("self", { depth: 0, compact: false });
			for (const key of FRAMEWORK) {
				expect(line(host, key), key).toBeDefined();
				expect(line(shown, key), key).toBe(line(host, key));
			}
		});

		it("shows the namespace's members, as the namespace shows them, one level down", async () => {
			api = await slothlet({
				base: FIXTURE,
				silent: true,
				mode,
				runtime,
				...(permissions ? { permissions: { policy: "allow" } } : {})
			});
			await api.reader;
			const shown = api.reader.shown("self", { depth: 2 });
			expect(shown).toContain(api.reader.shown("slothlet", { depth: 1 }).split("\n")[1].trim());
		});
	}
);
