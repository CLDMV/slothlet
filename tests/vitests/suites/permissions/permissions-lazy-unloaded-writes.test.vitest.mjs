/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-lazy-unloaded-writes.test.vitest.mjs
 *	@Date: 2026-10-24T12:27:59-07:00 (1792870079)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T12:30:35-07:00 (1792870235)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A write reaching a node a lazy module has not loaded yet is held to the ownership rule (#625).
 *
 * In lazy mode, reading a member of a node that has not loaded hands back a stand-in for it until the module loads.
 * A change made through that stand-in — an assignment, a definition, a deletion, freezing it — is a write at the path
 * it stands for, judged as one: refused for a module that does not own the path, with nothing changed.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `holder/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const PROBE = "slothlet.test.i625.probe";

describe.each([{ runtime: "async" }, { runtime: "live" }])(
	"writes through a lazy module's unloaded node (#625) — lazy / $runtime",
	({ runtime }) => {
		let api;

		afterEach(async () => {
			delete globalThis[Symbol.for(PROBE)];
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			api = null;
		});

		it.each([
			["on", { permissions: {} }],
			["off", {}]
		])("refuses another module's change, and changes nothing (permissions %s)", async (_label, options) => {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode: "lazy", runtime, silent: true, ...options });
			await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
			globalThis[Symbol.for(PROBE)] = (self) => {
				/**
				 * Run `change`, reporting `"done"` or the error code it was refused with.
				 * @param {function(): *} change - The change.
				 * @returns {string} The outcome.
				 */
				const outcome = (change) => {
					try {
						change();
						return "done";
					} catch (error) {
						return error?.code ?? String(error);
					}
				};
				return {
					assign: outcome(() => {
						self.holder.deep.inner.planted = 1;
					}),
					define: outcome(() => Object.defineProperty(self.holder.deep.inner, "defined", { value: 1, configurable: true })),
					remove: outcome(() => {
						delete self.holder.deep.inner.leaf;
					}),
					freeze: outcome(() => Object.freeze(self.holder.deep.inner))
				};
			};
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			expect(report).toEqual({
				assign: "LOOSE_SET_NOT_OWNED",
				define: "LOOSE_SET_NOT_OWNED",
				remove: "LOOSE_SET_NOT_OWNED",
				freeze: "LOOSE_SET_NOT_OWNED"
			});
			const inner = await api.holder.deep.inner;
			expect(inner.planted).toBeUndefined();
			expect(Object.isFrozen(inner)).toBe(false);
		});
	}
);
