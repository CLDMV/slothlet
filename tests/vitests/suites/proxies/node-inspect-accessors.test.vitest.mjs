/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/node-inspect-accessors.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:55-08:00 (1795869175)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `util.inspect` of a node holding accessors shows them as plain JS does (`[Getter]`, `[Setter]`,
 * `[Getter/Setter]`) and runs none of them, for the host and for a module.
 *
 * @description
 * `held.record` is an object with a data member, a getter, a setter and a getter/setter pair, each accessor counting
 * its runs. The expected text is `util.inspect` of the same object imported plainly. Eager and lazy mode, the async and
 * live runtime, permissions off and on.
 * @module tests/vitests/suites/proxies/node-inspect-accessors
 */

import { describe, it, expect, afterEach } from "vitest";
import util from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_inspect_accessors");

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => [false, true].map((permissions) => ({ mode, runtime, permissions })))
);

/**
 * The runs the fixture's accessors counted.
 * @returns {number} The count.
 */
const runs = () => globalThis.__inspectAccessorRuns ?? 0;

describe.each(configs)(
	"util.inspect of a node's accessors > $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Build the instance and load `held` and `viewer`.
		 * @returns {Promise<{expected: string}>} What plain JS shows of the same object.
		 */
		async function build() {
			const twin = await import(pathToFileURL(resolve(FIXTURE, "held.mjs")).href);
			api = await slothlet({
				base: FIXTURE,
				silent: true,
				mode,
				runtime,
				...(permissions ? { permissions: { policy: "allow" } } : {})
			});
			await api.held.record;
			await api.viewer;
			return { expected: util.inspect(twin.record) };
		}

		it("shows the host the accessors by their form, running none of them", async () => {
			const { expected } = await build();
			const before = runs();
			expect(util.inspect(api.held.record)).toBe(expected);
			expect(runs()).toBe(before);
		});

		it("shows a module the accessors by their form, running none of them", async () => {
			const { expected } = await build();
			const before = runs();
			expect(api.viewer.view()).toBe(expected);
			expect(runs()).toBe(before);
		});
	}
);
