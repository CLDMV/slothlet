/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-lazy-unloaded-writes.test.vitest.mjs
 *	@Date: 2026-10-24T12:27:59-07:00 (1792870079)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T02:52:49-07:00 (1793008369)
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
			["on", { permissions: {} }, "LOOSE_SET_NOT_OWNED"],
			["off", {}, "done"]
		])("holds another module's change to the same rule as a loaded node (permissions %s)", async (_label, options, expected) => {
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
			expect(report).toEqual({ assign: expected, define: expected, remove: expected, freeze: expected });
			// What lands through a node not loaded yet is #672: here only a refused change is checked to change nothing.
			if (expected !== "done") {
				const inner = await api.holder.deep.inner;
				expect(inner.planted).toBeUndefined();
				expect(Object.isFrozen(inner)).toBe(false);
			}
		});

		it.each([
			["on", { permissions: {} }],
			["off", {}]
		])("an unloaded node frozen by the host still answers for its prototype (permissions %s)", async (_label, options) => {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode: "lazy", runtime, silent: true, ...options });
			await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
			const inner = api.holder.deep.inner;
			Object.freeze(inner);
			expect(Object.isFrozen(inner)).toBe(true);
			expect(() => Object.getPrototypeOf(inner)).not.toThrow();
		});

		it.each([
			["on", { permissions: {} }, "LOOSE_SET_NOT_OWNED"],
			["off", {}, "done"]
		])("reads and writes through a version dispatcher as eager mode does (permissions %s)", async (_label, options, expected) => {
			globalThis[Symbol.for(PROBE)] = (self) => {
				/**
				 * Run `use`, reporting what it gave or the error code it threw. A node is reported as one whatever its
				 * `typeof`: a lazy node not loaded yet stands in as a function.
				 * @param {function(): *} use - The use.
				 * @returns {string} The outcome.
				 */
				const outcome = (use) => {
					try {
						const value = use();
						if (value === undefined) return "done";
						return typeof value === "object" || typeof value === "function" ? "node" : typeof value;
					} catch (error) {
						return error?.code ?? String(error);
					}
				};
				return {
					deep: outcome(() => self.holder.deep),
					inner: outcome(() => self.holder.deep.inner),
					leaf: outcome(() => self.holder.deep.inner.leaf),
					assign: outcome(() => {
						self.holder.deep.planted = 1;
					}),
					assignDeeper: outcome(() => {
						self.holder.deep.inner.planted = 1;
					}),
					define: outcome(() => {
						Object.defineProperty(self.holder.deep.inner, "defined", { value: 1, configurable: true });
					}),
					remove: outcome(() => {
						delete self.holder.deep.inner.leaf;
					})
				};
			};
			const reports = {};
			for (const mode of ["eager", "lazy"]) {
				api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
				await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" }, { version: "v1", default: true });
				await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
				reports[mode] = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
				await api.slothlet.shutdown();
				api = null;
			}
			expect(reports.lazy).toEqual(reports.eager);
			expect(reports.lazy.inner).not.toBe("done");
			expect(reports.lazy.assign).toBe(expected);
			expect(reports.lazy.assignDeeper).toBe(expected);
		});
	}
);
