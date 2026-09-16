/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/routines.test.vitest.mjs
 *	@Date: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for issue #341 (stackable lifecycle routines), including the design
 * amendment documented at https://github.com/CLDMV/slothlet/issues/341#issuecomment-5586818260:
 * mount-relative name matching (bare / dotted / `recursive`), root-anchored (`^`) glob patterns,
 * the flat registration-order root cascade, per-path stacking, the `autoRoutines` v3-compat gate,
 * a throwing contributor's attributable error, double-registration dedup, and non-interference with
 * the legacy `collectLifecycleHooks` opt-in.
 * @module tests/vitests/suites/lifecycle/routines
 */

import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe.each(["eager", "lazy"])("routines (#341) — mode: %s", (mode) => {
	beforeEach(() => {
		globalThis.__slothletRoutineLog = [];
	});

	describe("bare mount-relative matching (default routines)", () => {
		it("mode: startup — the default `initialize` routine auto-runs once, as the final step of compose", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize"]);
				// Ordinary sibling leaves are unaffected.
				expect(await api.ping()).toBe("pong");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("two independently-mounted modules sharing a mount point both run their contribution, in mount order", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, stackRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				// Ordinary recursive-merge would have dropped auth2's contribution entirely (#341's
				// motivating problem) — the stacked callable must run BOTH, in mount order.
				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);

				// Each contributor's own unrelated sibling leaf is still independently reachable.
				expect(await api.auth.login()).toBe("login1");
				expect(await api.auth.logout()).toBe("logout1");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("rebuildStacks()'s own installed callable is never captured as a phantom ownership registration (#372/#373 review, suppressed finding)", async () => {
			// RoutineManager#rebuildStacks() installs its stacked callable directly onto the live tree
			// (`target[key] = ...`), guarding only its OWN raw capture via `recording = false` — the
			// generic ownership subscriber (src/slothlet.mjs) has no equivalent guard, so without one
			// the write is misattributed to whatever module owns the CONTAINER (e.g. the base module),
			// polluting the ownership stack with a phantom "the stacked callable is its own
			// contribution" entry on every rebuild — corrupting whichever module ownership later
			// considers the "current owner" for restore/removal purposes.
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, stackRoutines: true, silent: true });
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);
				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);

				const wrapper =
					resolveWrapper(api.auth) ||
					Object.values(api)
						.map((v) => resolveWrapper(v))
						.find(Boolean);
				const sl = wrapper.slothlet;
				const stack = sl.handlers.ownership.pathToModule.get("auth.initialize") || [];

				// Every entry must be a genuine module contribution — never the stacked callable itself.
				for (const entry of stack) {
					expect(typeof entry.value === "function" && entry.value.__slothletRoutineStack === true).toBe(false);
				}
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it('matches a bare routine name mounted via a root-level api.add("", folder) call (#366 review)', async () => {
			// addApiComponent records a root-level add's own module endpoint as effectivePath (""),
			// distinct from the initial base build's own "." — both mean the same thing (this
			// instance's own root) and #matches() must treat them identically.
			const api = await slothlet({
				base: TEST_DIRS.API_TEST_ROUTINES_ROOT_ADD_BASE,
				mode,
				routines: [{ name: "initialize", mode: "manual" }],
				silent: true
			});
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add("", TEST_DIRS.API_TEST_ROUTINES_ROOT_ADD, { moduleID: "root-add-mod" });

				expect(typeof api.initialize).toBe("function");
				await api.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["rootadd:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a bare name does NOT match a nested leaf one level below the mount's own top level", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES_NESTED, mode, autoRoutines: true, silent: true });
			try {
				// Only the mount's own top-level initialize.mjs counts — admin/initialize.mjs does not,
				// even though its final segment is also "initialize".
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:top:initialize"]);
				expect(await api.admin.initialize()).toBeUndefined(); // still directly callable, just not a routine contribution
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:top:initialize", "nested:admin:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("re-running api.slothlet.api.add() after initial compose re-derives the stack without re-firing startup", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, stackRoutines: true, silent: true });
			try {
				// Startup already fired during compose; mounting auth1/auth2 afterward must not re-fire it.
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				expect(globalThis.__slothletRoutineLog).toEqual([]);

				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);
				expect(globalThis.__slothletRoutineLog).toEqual([]);

				// But the late-mounted contributors are reachable via the (re-derived) stacked callable.
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a later mount at the same path that contributes nothing of its own does not double-register the earlier contributor", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // has its own "initialize"
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_MANUAL); // does NOT export "initialize"

				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("dotted mount-relative matching (recursive: false, default)", () => {
		it("a fixed relative path matches only that exact sub-path, not the mount's own top level", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
				mode,
				routines: [{ name: "admin.initialize", mode: "startup" }],
				autoRoutines: true,
				silent: true
			});
			try {
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:admin:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it.skipIf(mode !== "lazy")(
			"materializing a fixed relative path under one mount never force-materializes an unrelated mount's own untouched subdirectory (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					routines: [{ name: "admin.initialize", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet.api.add(["mountB"], TEST_DIRS.API_TEST_ROUTINES_SCOPED_OTHER);

					await api.slothlet["admin.initialize"]();
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// First-ever property access of mountB.nested anywhere in this test: reading it
					// even once earlier (e.g. a "before" assertion) would itself trigger this node's
					// own lazy "waiting proxy" materialization and contaminate the very thing being
					// checked.
					expect(resolveWrapper(api.mountB.nested).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);

		it("a dotted name containing a glob metacharacter still matches (and force-materializes) a nested contributor", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
				mode,
				routines: [{ name: "*.initialize", mode: "manual" }],
				silent: true
			});
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet["*.initialize"]();
				// "*.initialize" is a glob (not a fixed literal path) — a plain literal segment-by-
				// segment walk can't step into a wildcard segment, so this only passes in lazy mode if
				// #materializeFor's wildcard-aware walk (#materializeGlobPath) enumerates the mount's
				// top-level children and descends into the ones the "*" segment matches. The mount's
				// own top-level "initialize" (no dot) must NOT match — the pattern requires a literal
				// "." before "initialize".
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:admin:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it.skipIf(mode !== "lazy")(
			"a dotted name containing a single-level wildcard force-materializes only the matching branch, not an unrelated sibling subfolder (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					routines: [{ name: "admin.*", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet["admin.*"]();
					// "admin.other" also matches "admin.*" but returns a value rather than logging, so
					// only "admin.initialize"'s push shows up here.
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// First-ever touch of the unrelated "quiet" sibling subfolder anywhere in this
					// test — proves the wildcard walk enumerated only "admin" (the segment the pattern
					// actually names), never the mount's whole subtree.
					expect(resolveWrapper(api.quiet).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);

		it.skipIf(mode !== "lazy")(
			"a dotted name ending in ** force-materializes its own narrowed branch's entire subtree, never a sibling subtree (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					routines: [{ name: "admin.**", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet["admin.**"]();
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// "**" is unbounded, but only from where it's reached: it still narrows to "admin"
					// first via an ordinary literal step, so it correctly reaches arbitrary depth
					// WITHIN that branch...
					expect(resolveWrapper(api.admin.deep).____slothletInternal.state.materialized).toBe(true);

					// ...First-ever touch of the unrelated "quiet" sibling subfolder anywhere in this
					// test — proves "**" never re-walks from the mount's own root, only from "admin".
					expect(resolveWrapper(api.quiet).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);

		it.skipIf(mode !== "lazy")(
			"a brace-expanded dotted name only materializes its concrete alternatives, never an unrelated sibling (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					// "ghost" doesn't exist under this mount — must not error, just contribute nothing.
					routines: [{ name: "{admin,ghost}.*", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet["{admin,ghost}.*"]();
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// First-ever touch of the unrelated "quiet" sibling subfolder anywhere in this
					// test — proves brace expansion walked only its own concrete alternatives ("admin",
					// "ghost"), never fell back to the mount's whole subtree.
					expect(resolveWrapper(api.quiet).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);
	});

	describe("recursive mount-relative matching", () => {
		it("recursive: true finds the name at both the mount's own top level and nested within it", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
				mode,
				routines: [{ name: "initialize", mode: "startup", recursive: true }],
				autoRoutines: true,
				silent: true
			});
			try {
				expect(globalThis.__slothletRoutineLog).toContain("nested:top:initialize");
				expect(globalThis.__slothletRoutineLog).toContain("nested:admin:initialize");
				expect(globalThis.__slothletRoutineLog).toHaveLength(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("root-anchored (^) glob matching", () => {
		it("^ext.*.initialize matches every plugin's own initialize under ext, across separate mounts", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^ext.*.initialize", mode: "manual" }],
				silent: true
			});
			try {
				await api.slothlet.api.add(["ext", "pluginA"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["ext", "pluginB"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				globalThis.__slothletRoutineLog = [];
				// Non-bare routine names are reachable via bracket notation.
				await api.slothlet["^ext.*.initialize"]();
				expect(globalThis.__slothletRoutineLog).toContain("auth1:initialize");
				expect(globalThis.__slothletRoutineLog).toContain("auth2:initialize");
				expect(globalThis.__slothletRoutineLog).toHaveLength(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a skip-rejected add's raw-captured contribution does not run under stackRoutines — root-anchored matching bypasses ownership entirely (#372/#373)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^ext.*.initialize", mode: "manual" }],
				stackRoutines: true,
				collision: { api: "skip" },
				silent: true
			});
			try {
				await api.slothlet.api.add(["ext", "auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				// Rejected outright under skip — auth2's whole subtree, including its raw-captured
				// "initialize", must never run. A root-anchored (^) pattern matches by absolute
				// path alone (see #matches()) and never consults ownership/endpoint resolution, and
				// stackRoutines: true additionally skips the default current-owner filter — so this
				// is the one combination where a rejected candidate's raw entry could still surface.
				await api.slothlet.api.add(["ext", "auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				globalThis.__slothletRoutineLog = [];
				await api.slothlet["^ext.*.initialize"]();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("removing the CURRENT winner by its exact api path prunes its raw contribution too (#372 review)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^ext.*.initialize", mode: "manual" }],
				stackRoutines: true,
				silent: true
			});
			try {
				await api.slothlet.api.add(["ext", "auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // current winner
				await api.slothlet.api.add(["ext", "auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // merge-loser (default merge)

				globalThis.__slothletRoutineLog = [];
				await api.slothlet["^ext.*.initialize"]();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);

				// Single-argument remove(apiPath) — NOT the moduleID or scoped (moduleID, apiPath)
				// forms covered in routines-stack-flag.test.vitest.mjs — resolves "ext.auth.initialize"
				// to its current owner (auth1) and removes it directly. A root-anchored (^) cascade
				// reads RoutineManager.raw directly (runCascade(), not a stacked callable reinstalled
				// by rebuildStacks()), so it's unaffected by whatever the ownership "restore" wrote
				// onto the live tree — the one direct way to observe whether auth1's raw entry was
				// actually pruned by this removal, not merely shadowed on the live property.
				await api.slothlet.api.remove("ext.auth.initialize");

				globalThis.__slothletRoutineLog = [];
				await api.slothlet["^ext.*.initialize"]();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("flat registration-order cascade across distinct mount points", () => {
		it("the root cascade runs every mount's own contribution, not just one shared path", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, silent: true });
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				globalThis.__slothletRoutineLog = [];
				await api.slothlet.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize", "auth1:initialize", "auth2:initialize"]);

				// The bare top-level alias is the identical cascade.
				globalThis.__slothletRoutineLog = [];
				await api.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize", "auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("mode: shutdown", () => {
		it.each([
			["api.shutdown()", async (api) => api.shutdown()],
			["api.slothlet.shutdown()", async (api) => api.slothlet.shutdown()]
		])("%s runs every shutdown-mode contributor via the existing dispose path", async (____label, dispose) => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, stackRoutines: true, silent: true });
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

			globalThis.__slothletRoutineLog = [];
			await dispose(api);
			expect(globalThis.__slothletRoutineLog).toEqual(["auth1:shutdown", "auth2:shutdown"]);
		});
	});

	describe("mode: destroy", () => {
		it("api.destroy() runs every destroy-mode contributor, and shutdown-mode routines still run too (destroy() calls the root shutdown() internally)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [...slothlet.defaults.routines, "destroy:destroy"],
				autoRoutines: true,
				stackRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

			globalThis.__slothletRoutineLog = [];
			await api.destroy();

			expect(globalThis.__slothletRoutineLog).toContain("auth1:destroy");
			expect(globalThis.__slothletRoutineLog).toContain("auth2:destroy");
			// destroy() calls the root api.shutdown() as part of its own teardown — shutdown-mode
			// contributors run too, distinguishing "runs on destroy()" from "runs on destroy() only".
			expect(globalThis.__slothletRoutineLog).toContain("auth1:shutdown");
			expect(globalThis.__slothletRoutineLog).toContain("auth2:shutdown");
		});

		it("a plain api.shutdown() call does NOT run destroy-mode routines", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "destroy", mode: "destroy" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();
			expect(globalThis.__slothletRoutineLog).not.toContain("auth1:destroy");
		});

		it("a shutdown-mode routine failure during destroy() does not abort destroy()'s own teardown (api keys still cleared)", async () => {
			// destroy() calls api.shutdown() internally, and api.shutdown() can itself throw a
			// deferred ROUTINE_FAILED aggregate for a mode: "shutdown" routine — that throw must not
			// skip destroy()'s own isDestroyed/key-clearing/api-nulling cleanup below it.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "shutdown" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["bad"], TEST_DIRS.API_TEST_ROUTINES_BAD); // bad's "initialize" throws

			const keysBefore = Object.keys(api);
			expect(keysBefore.length).toBeGreaterThan(0);

			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.destroy()).rejects.toMatchObject({ code: "ROUTINE_FAILED" });
			});

			// Teardown must have completed despite the deferred rethrow.
			expect(Object.keys(api)).toHaveLength(0);
		});
	});

	describe("order: mount vs. depth", () => {
		// A mount path's OWN depth (segment count) drives "depth" order, independent of recursive
		// matching — mounting auth2 two segments deep (["auth", "admin"]) while auth1 mounts only one
		// segment deep (["billing"]) gives a clean, unambiguous contrast: mount order is simply
		// "whichever was add()-ed first" (auth1, then auth2), while depth order puts the
		// deeper-mounted auth2 first regardless of mount sequence.
		it('order: "depth" (the mode: "shutdown" default) runs the deeper-mounted contributor first, regardless of mount sequence', async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "shutdown", mode: "shutdown", order: "depth" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // mounted 1st, shallower (billing.shutdown)
			await api.slothlet.api.add(["auth", "admin"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // mounted 2nd, deeper (auth.admin.shutdown)

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();
			expect(globalThis.__slothletRoutineLog).toEqual(["auth2:shutdown", "auth1:shutdown"]);
		});

		it('order: "mount" runs contributors in mount sequence regardless of relative depth', async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "shutdown", mode: "shutdown", order: "mount" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // mounted 1st, shallower
			await api.slothlet.api.add(["auth", "admin"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // mounted 2nd, deeper

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();
			// Opposite order from the "depth" test above — same two contributors, same mount
			// sequence, only the routine's `order` differs.
			expect(globalThis.__slothletRoutineLog).toEqual(["auth1:shutdown", "auth2:shutdown"]);
		});

		it('mode: "startup" defaults to order: "mount" (registration order), not depth', async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "startup" }],
				autoRoutines: true,
				silent: true
			});
			try {
				// The startup cascade already ran once at compose end (root:initialize only, nothing
				// else mounted yet) — mount two contributors at different depths, then re-run the
				// cascade manually to observe order among them.
				await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // shallower
				await api.slothlet.api.add(["auth", "admin"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // deeper

				globalThis.__slothletRoutineLog = [];
				await api.slothlet.initialize();
				// root:initialize (the base compose's own contributor) first, then mount order
				// (auth1 before auth2, not depth order) — a "startup" routine defaults to "mount",
				// the opposite default from "shutdown".
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize", "auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("mode: manual", () => {
		it("never auto-runs at compose end or on dispose; only an explicit call runs it", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_MANUAL,
				mode,
				routines: ["launch"],
				autoRoutines: true,
				silent: true
			});
			try {
				expect(globalThis.__slothletRoutineLog).toEqual([]);
				await api.launch();
				expect(globalThis.__slothletRoutineLog).toEqual(["manual:launch"]);
			} finally {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.shutdown();
				// "launch" isn't a shutdown-mode routine — dispose must not have run it again.
				expect(globalThis.__slothletRoutineLog).toEqual([]);
			}
		});
	});

	describe("internal state hygiene", () => {
		it("reset() also clears the compiled-pattern cache, not just captured contributors", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^ext.*.initialize", mode: "manual" }],
				silent: true
			});
			try {
				await api.slothlet["^ext.*.initialize"](); // compiles + caches the "ext.*.initialize" pattern
				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;
				expect(routineManager.patternCache.size).toBe(1);

				routineManager.reset();
				expect(routineManager.patternCache.size).toBe(0);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("onImplCreated removes a stale raw contribution when the same path's impl later changes to a non-function", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^stale.initialize" }],
				silent: true
			});
			try {
				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;
				const hasEntry = () => routineManager.raw.some((e) => e.apiPath === "stale.initialize" && e.moduleID === "mod1");

				routineManager.onImplCreated({ apiPath: "stale.initialize", moduleID: "mod1", wrapper: { __impl: function initialize() {} } });
				expect(hasEntry()).toBe(true);

				// A later impl:changed for the SAME (apiPath, moduleID) whose impl is no longer a
				// function — e.g. a direct reassignment to a plain object — must drop the earlier
				// capture, not leave a stale function contribution a cascade could still invoke.
				routineManager.onImplCreated({ apiPath: "stale.initialize", moduleID: "mod1", wrapper: { __impl: {} } });
				expect(hasEntry()).toBe(false);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("error propagation (best-effort, aggregated)", () => {
		it("a throwing contributor does not block a LATER contributor from still running (best-effort, not fail-fast)", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, stackRoutines: true, silent: true });
			try {
				await api.slothlet.api.add(["ns"], TEST_DIRS.API_TEST_ROUTINES_GOOD); // runs, succeeds
				await api.slothlet.api.add(["ns"], TEST_DIRS.API_TEST_ROUTINES_BAD); // runs, throws
				await api.slothlet.api.add(["ns"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // must STILL run despite bad's failure

				globalThis.__slothletRoutineLog = [];
				await withSuppressedSlothletErrorOutput(async () => {
					await expect(api.ns.initialize()).rejects.toMatchObject({
						code: "ROUTINE_FAILED",
						name: "SlothletError",
						context: { apiPath: "ns.initialize", moduleID: expect.any(String), count: 1 }
					});
				});
				// "good" ran before the failure, and — the actual point of best-effort — "auth1" ran
				// AFTER it despite "bad" throwing in between. A fail-fast chain would have stopped
				// after "bad" and never reached "auth1:initialize" at all.
				expect(globalThis.__slothletRoutineLog).toEqual(["good", "auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("aggregates every failure across multiple failing contributors, not just the first", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, silent: true });
			try {
				await api.slothlet.api.add(["ns2"], TEST_DIRS.API_TEST_ROUTINES_BAD);
				await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_BAD);

				await withSuppressedSlothletErrorOutput(async () => {
					await expect(api.slothlet.initialize()).rejects.toMatchObject({
						code: "ROUTINE_FAILED",
						context: {
							count: 2,
							failures: [{ apiPath: "ns2.initialize" }, { apiPath: "billing.initialize" }]
						}
					});
				});
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("collectLifecycleHooks interaction", () => {
		it("collectLifecycleHooks: true does not double-invoke a routine-stack contributor sharing the shutdown name", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				collectLifecycleHooks: true,
				stackRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();

			// Each contributor must appear exactly once — collectLifecycleHooks' tree walk must skip the
			// branded stacked callable rather than invoking it a second time on top of the routine cascade.
			// collectLifecycleHooks: true also implies autoRoutines (deprecated alias) — see config.mjs.
			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "auth1:shutdown")).toHaveLength(1);
			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "auth2:shutdown")).toHaveLength(1);
		});

		it("recursive: true does not double-invoke either, even though collectLifecycleHooks' own walk finds the same literally-named leaves independently", async () => {
			// collectLifecycleHooks' walk is itself effectively "recursive, root-anchored, whole-tree"
			// for the literal name "shutdown" — this is the overlap case the non-recursive test above
			// does not exercise: a `recursive: true` mount-relative routine searches WITHIN one mount's
			// subtree, which is exactly where collectLifecycleHooks' own walk would also look.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "shutdown", mode: "shutdown", recursive: true }],
				collectLifecycleHooks: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_NESTED);

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();

			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "nested:top:shutdown")).toHaveLength(1);
			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "nested:admin:shutdown")).toHaveLength(1);
		});
	});

	describe("distinct routines sharing an exact composed apiPath (#366 review)", () => {
		it("does not cross-invoke a different routine's contributor that happens to compose to the same apiPath", async () => {
			// Root module has its OWN nested `auth/initialize.mjs` (relative to root's endpoint ".",
			// matched by the dotted "auth.initialize" routine). A separately-mounted module's own
			// top-level `initialize.mjs` (relative to ITS OWN "auth" mount endpoint, matched by the
			// bare "initialize" routine) composes to that SAME exact absolute apiPath. These are two
			// independently-configured routines, each intended to match a DIFFERENT module — the
			// callable installed at "auth.initialize" must invoke only the one routine it was actually
			// built for, not every raw entry that happens to share that apiPath.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_CROSSPATH_ROOT,
				mode,
				routines: [
					{ name: "auth.initialize", mode: "manual" },
					{ name: "initialize", mode: "manual" }
				],
				stackRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_CROSSPATH_MOUNTED);

			globalThis.__slothletRoutineLog = [];
			await api.auth.initialize();

			// Exactly one contributor ran — whichever routine's callable ended up installed at
			// "auth.initialize" (last-registered-routine-wins for the api slot) — never both.
			expect(globalThis.__slothletRoutineLog).toHaveLength(1);
			expect(["root-auth:initialize", "mounted-auth:initialize"]).toContain(globalThis.__slothletRoutineLog[0]);
		});
	});

	describe("reactive per-path stack self-heal without a further add()/reload()/cascade trigger (#362)", () => {
		it("a genuinely distinct late contributor, captured after an ordinary write already discarded the stack, still runs", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^auth.initialize", mode: "manual" }],
				stackRoutines: true,
				silent: true
			});
			try {
				// A real add() — its own rebuildStacks() trigger already wraps "auth.initialize" as a
				// (single-contributor) stacked callable; `runPath()` always re-reads `raw` fresh, so a
				// single contributor being wrapped or not is unobservable on its own.
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);

				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;

				// An ordinary write to the SAME property — not api.add()/reload()/a mode cascade —
				// replaces the live value with a bare function directly, discarding the stack wrapper
				// that was there. This is the actual mechanism #362 describes: whatever wrote the
				// property doesn't know or care that a routine stack was sitting there.
				globalThis.__slothletRoutineLog = [];
				api.auth.initialize = function postWrite() {
					(globalThis.__slothletRoutineLog ??= []).push("post-write:initialize");
				};
				expect(api.auth.initialize.__slothletRoutineStack).toBeFalsy();

				// A genuinely distinct contributor's own raw capture arriving late — #362's "a second
				// lazy mount whose own leaf stays untouched at api.add() time and only materializes
				// later" example, driven directly the same way the "internal state hygiene" tests
				// above exercise onImplCreated (a real second moduleID, not a re-touch of the one that
				// just wrote the property above). No add()/reload()/cascade follows this.
				const lateContributor = function lateContributor() {
					(globalThis.__slothletRoutineLog ??= []).push("late-contributor:initialize");
				};
				routineManager.onImplCreated({
					apiPath: "auth.initialize",
					moduleID: "late-second-module",
					wrapper: { __impl: lateContributor }
				});

				// The reactive self-heal runs asynchronously off the onImplCreated call above; give it
				// a tick to land.
				await new Promise((r) => setTimeout(r, 30));

				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);

				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["post-write:initialize", "late-contributor:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a lone contributor is left alone — no reactive rewrap when there is nothing to stack", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^auth.initialize", mode: "manual" }],
				stackRoutines: true,
				silent: true
			});
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);

				globalThis.__slothletRoutineLog = [];
				api.auth.initialize = function soleContributor() {
					(globalThis.__slothletRoutineLog ??= []).push("sole:initialize");
				};
				await new Promise((r) => setTimeout(r, 30));

				// Positive proof the `group.length < 2` skip was actually reached — not just that
				// nothing broke: the plain write is left completely untouched, never reactively
				// upgraded to a stacked callable.
				expect(api.auth.initialize.__slothletRoutineStack).toBeFalsy();

				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["sole:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("cascade forwards its arguments, unchanged, to every matching contributor tree-wide", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_CASCADE_ARGS,
				mode,
				routines: [{ name: "initialize", mode: "manual" }],
				silent: true
			});
			try {
				globalThis.__slothletRoutineCascadeArgsLog = [];
				await api.initialize("x", 42, { y: true });
				expect(globalThis.__slothletRoutineCascadeArgsLog).toEqual([["x", 42, { y: true }]]);

				globalThis.__slothletRoutineCascadeArgsLog = [];
				await api.slothlet.initialize("solo-arg");
				expect(globalThis.__slothletRoutineCascadeArgsLog).toEqual([["solo-arg"]]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a routine's own root-name slot reactively heals to the cascade, not a per-path stack, and still covers every other matching path tree-wide", async () => {
			// TEST_DIRS.API_TEST_ROUTINES has its own root-level initialize.mjs — its composed apiPath
			// IS the literal routine name "initialize", the exact root-cascade/per-path-stack slot
			// collision this fix resolves. Mounting AUTH1 separately gives the SAME routine a second,
			// ordinary (non-colliding) matching path elsewhere in the tree ("auth.initialize"), so the
			// test can prove the healed slot is a genuine tree-wide cascade, not just a per-path fix
			// scoped to the root.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "manual" }],
				silent: true
			});
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				expect(api.initialize.__slothletRoutineCascade).toBe(true);

				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;

				// An ordinary write clobbers the root slot exactly like the dedicated #362 test above —
				// except this slot is cascade-owned, not per-path-stack-owned.
				globalThis.__slothletRoutineLog = [];
				api.initialize = function postWrite() {
					(globalThis.__slothletRoutineLog ??= []).push("post-write:initialize");
				};
				expect(api.initialize.__slothletRoutineCascade).toBeFalsy();

				// Re-touch the SAME (apiPath, moduleID) pair that the root fixture itself already
				// registered — a genuine late re-fire of impl:changed for the root's own contributor,
				// not a fabricated new module.
				const rawEntry = routineManager.raw.find((e) => e.apiPath === "initialize");
				expect(rawEntry).toBeDefined();
				routineManager.onImplCreated({
					apiPath: "initialize",
					moduleID: rawEntry.moduleID,
					wrapper: { __impl: rawEntry.fn }
				});

				// The reactive self-heal is deferred via setImmediate (#362 review) — a macrotask
				// turn, well under this margin.
				await new Promise((r) => setTimeout(r, 30));

				expect(api.initialize.__slothletRoutineCascade).toBe(true);
				// The cascade also carries the generic routine-managed marker (both markers coexist —
				// see #buildCascadeCallable) — distinguishing it from a per-path stack is
				// __slothletRoutineCascade specifically, not the absence of __slothletRoutineStack.
				expect(api.initialize.__slothletRoutineStack).toBe(true);

				globalThis.__slothletRoutineLog = [];
				await api.initialize();
				// Healed to the CASCADE, not a per-path stack scoped to just the root — both the root's
				// own contributor AND the separately-mounted auth.initialize contributor ran.
				expect(globalThis.__slothletRoutineLog.sort()).toEqual(["auth1:initialize", "root:initialize"].sort());
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("last-registered-routine-wins precedence holds even when the REACTIVE patch (not a full rebuild) installs the stack", async () => {
			// Mirrors the existing "distinct routines sharing an exact composed apiPath (#366 review)"
			// scenario above, but forces the winning routine's stack to be installed reactively (via a
			// clobbering write + late re-capture) instead of by a full rebuildStacks() sweep, and
			// asserts the SAME deterministic winner (the LAST configured routine matching this path)
			// rather than whichever routine's reactive patch merely happened to fire first.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_CROSSPATH_ROOT,
				mode,
				routines: [
					{ name: "auth.initialize", mode: "manual" },
					{ name: "initialize", mode: "manual" }
				],
				stackRoutines: true,
				silent: true
			});
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_CROSSPATH_MOUNTED);

				// CROSSPATH_ROOT has no root-level sibling file next to its "auth" subdirectory (a
				// separate, pre-existing composition quirk unrelated to this fix — filed as a
				// candidate follow-up, not fixed here), so grab routineManager via a plain leaf
				// nested INSIDE "auth" instead of the usual root-level api.ping.
				const routineManager = resolveWrapper(api.auth.ping).slothlet.handlers.routineManager;

				// Clobber the shared slot with a plain write, then re-fire BOTH matching raw entries'
				// onImplCreated in turn (oldest first, same as their original registration order) —
				// each individually might otherwise "win" a naive first-reactive-writer-wins race; only
				// the LAST-configured routine ("initialize", registered after "auth.initialize" above)
				// must be the one left installed, matching rebuildStacks()'s own deterministic rule.
				globalThis.__slothletRoutineLog = [];
				api.auth.initialize = function postWrite() {
					(globalThis.__slothletRoutineLog ??= []).push("post-write:auth.initialize");
				};

				const entries = routineManager.raw.filter((e) => e.apiPath === "auth.initialize");
				expect(entries.length).toBe(2);
				for (const entry of entries) {
					routineManager.onImplCreated({ apiPath: entry.apiPath, moduleID: entry.moduleID, wrapper: { __impl: entry.fn } });
				}

				await new Promise((r) => setTimeout(r, 30));

				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);
				expect(api.auth.initialize.__slothletRoutineName).toBe("initialize");

				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toHaveLength(1);
				expect(["root-auth:initialize", "mounted-auth:initialize"]).toContain(globalThis.__slothletRoutineLog[0]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("the setImmediate deferral lets a slower real assignment land first instead of getting clobbered by the reactive patch", async () => {
			// Models the write-ordering race #362's follow-up review found: the framework's own
			// "real" assignment for a contribution can itself now be async end-to-end (#369) and can
			// resolve strictly AFTER the impl:created event that triggered this reactive patch. If the
			// patch ran on an immediate microtask chain instead of a macrotask boundary, its own write
			// could land BEFORE that slower real assignment, which would then silently clobber it.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^auth.initialize", mode: "manual" }],
				stackRoutines: true,
				silent: true
			});
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;

				globalThis.__slothletRoutineLog = [];
				const lateContributor = function lateContributor() {
					(globalThis.__slothletRoutineLog ??= []).push("late-contributor:initialize");
				};
				// Fire the raw capture (spawns the setImmediate-deferred reactive patch) BEFORE the
				// slower "real" assignment below — mirroring impl:created's own documented ordering
				// (it fires before the framework's real value lands on the tree).
				routineManager.onImplCreated({
					apiPath: "auth.initialize",
					moduleID: "late-second-module",
					wrapper: { __impl: lateContributor }
				});

				// A slower "real" assignment landing several microtask turns later, but still well
				// inside the setImmediate's macrotask boundary — the reactive patch must not have
				// already run and gotten clobbered by this.
				await Promise.resolve()
					.then(() => Promise.resolve())
					.then(() => Promise.resolve());
				api.auth.initialize = function delayedRealAssignment() {
					(globalThis.__slothletRoutineLog ??= []).push("delayed-real-assignment:initialize");
				};

				await new Promise((r) => setTimeout(r, 30));

				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);
				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["delayed-real-assignment:initialize", "late-contributor:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("does NOT reactively heal while a build is in progress — the build's own rebuildStacks() is authoritative (#362)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^auth.initialize", mode: "manual" }],
				stackRoutines: true,
				silent: true
			});
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;

				// Clobber the slot (as the tests above do), then — synchronously, before any queued
				// setImmediate patch can fire — pretend a build is in progress. The reactive patches
				// scheduled by both the clobber and the late contributor below must no-op: while a build
				// runs, that build's own terminal rebuildStacks() is authoritative, and a during-build
				// reactive write would be stored raw/untagged and could race the framework's own
				// not-yet-landed assignment.
				api.auth.initialize = function postWrite() {
					(globalThis.__slothletRoutineLog ??= []).push("post-write:initialize");
				};
				routineManager.slothlet.____buildDepth = 1;

				const lateContributor = function lateContributor() {
					(globalThis.__slothletRoutineLog ??= []).push("late-contributor:initialize");
				};
				routineManager.onImplCreated({ apiPath: "auth.initialize", moduleID: "gate-second-module", wrapper: { __impl: lateContributor } });
				await new Promise((r) => setTimeout(r, 30));

				// Gated: the slot is still the bare clobber write, NOT a healed stack.
				expect(api.auth.initialize.__slothletRoutineStack).toBeFalsy();

				// Build finished (depth back to 0): a fresh event now heals normally — proving the gate,
				// not a broken mechanism, was responsible for the no-op above.
				routineManager.slothlet.____buildDepth = 0;
				routineManager.onImplCreated({ apiPath: "auth.initialize", moduleID: "gate-second-module", wrapper: { __impl: lateContributor } });
				await new Promise((r) => setTimeout(r, 30));
				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});

/**
 * #393 — a routine contributor reaching a coordinator through AMBIENT `self.*` must resolve it under
 * the ROOT CASCADE, not only under a per-path call. The cascade is installed as a plain callable at
 * `api[name]` / `api.slothlet[name]`; before the fix it invoked its contributors with no active
 * extent, so `self.*` in a contributor threw RUNTIME_NO_ACTIVE_CONTEXT_SELF — while the identical
 * contributor called per-path (`api.<path>.<name>()`, which routes through the wrapped leaf's
 * `contextManager.runInContext`) resolved fine. runCascade now runs its loop inside the instance
 * extent, matching per-path behavior. These fixtures use ambient `self.coord.register(...)` (not the
 * global routine log the rest of this suite uses) precisely because only a live extent lets `self`
 * resolve — an entry in the log proves the extent was active.
 */
describe.each(["eager", "lazy"])("routine self.* context under the root cascade (#393) — mode: %s", (mode) => {
	beforeEach(() => {
		globalThis.__slothletSelfLog = [];
	});

	it("api.initialize() (root cascade) resolves a contributor's ambient self.* unwrapped", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
			mode,
			routines: [{ name: "initialize", mode: "manual", recursive: true }],
			stackRoutines: true,
			silent: true
		});
		try {
			await api.initialize();
			expect(await api.coord.getRegistered()).toContain("worker:init");
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("api.slothlet.initialize() (root cascade, other spelling) resolves ambient self.* unwrapped", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
			mode,
			routines: [{ name: "initialize", mode: "manual", recursive: true }],
			stackRoutines: true,
			silent: true
		});
		try {
			await api.slothlet.initialize();
			expect(await api.coord.getRegistered()).toContain("worker:init");
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("per-path api.worker.initialize() still resolves ambient self.* (regression guard)", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
			mode,
			routines: [{ name: "initialize", mode: "manual", recursive: true }],
			stackRoutines: true,
			silent: true
		});
		try {
			await api.worker.initialize();
			expect(await api.coord.getRegistered()).toEqual(["worker:init"]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("the root cascade forwards its arguments to each contributor (self.* + ctx)", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
			mode,
			routines: [{ name: "activate", mode: "manual", recursive: true }],
			stackRoutines: true,
			silent: true
		});
		try {
			await api.activate({ id: 7 });
			expect(await api.coord.getRegistered()).toContain("worker:activate:7");
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("a DEEP-merged contributor (api.add, nested path) resolves self.* under the cascade", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
			mode,
			routines: [{ name: "initialize", mode: "manual", recursive: true }],
			stackRoutines: true,
			silent: true
		});
		try {
			await api.slothlet.api.add([], TEST_DIRS.API_TEST_ROUTINES_SELF_DEEP, { moduleID: "self-deep" });
			await api.initialize();
			const log = await api.coord.getRegistered();
			expect(log).toContain("worker:init");
			expect(log).toContain("deep:init");
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("STACKED contributors at one shared path all resolve self.* under the cascade", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
			mode,
			routines: [{ name: "initialize", mode: "manual", recursive: true }],
			stackRoutines: true,
			silent: true
		});
		try {
			// Two independently-mounted contributors at the identical composed path self.svc.initialize
			// (mirrors the auth1/auth2 stacking pair) — with stackRoutines the cascade runs BOTH, and
			// each reaches the coordinator through ambient self.*.
			await api.slothlet.api.add(["svc"], TEST_DIRS.API_TEST_ROUTINES_SELF_PEER, { moduleID: "self-peer-1" });
			await api.slothlet.api.add(["svc"], TEST_DIRS.API_TEST_ROUTINES_SELF_PEER2, { moduleID: "self-peer-2" });
			await api.initialize();
			const log = await api.coord.getRegistered();
			expect(log).toContain("peer:init");
			expect(log).toContain("peer2:init");
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("an AUTO-FIRED startup routine resolves ambient self.* at compose end (autoRoutines)", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
			mode,
			autoRoutines: true,
			routines: [{ name: "initialize", mode: "startup", recursive: true }],
			stackRoutines: true,
			silent: true
		});
		try {
			// The startup cascade already fired as the final awaited step of compose.
			expect(await api.coord.getRegistered()).toContain("worker:init");
		} finally {
			await api.slothlet.shutdown();
		}
	});

	// The principle the extent placement encodes: a routine FANS OUT calls; it must not change their
	// semantics. Each contributor runs under its OWN caller identity — its self.*/permission checks
	// resolve against itself, never a shared/slot/instance identity. A and B both reach the IDENTICAL
	// target self.secret.read; the policy allows caller `a` and denies caller `b`, so A succeeding
	// while B is denied is only possible if each ran as itself — under both the root cascade and a
	// per-path call.
	describe("each contributor runs under its OWN caller identity (permissions)", () => {
		const mkApi = () =>
			slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_PERM,
				mode,
				permissions: { defaultPolicy: "deny", rules: [{ caller: "a**", target: "secret**", effect: "allow" }] },
				routines: [{ name: "initialize", mode: "manual", recursive: true }],
				stackRoutines: true,
				silent: true
			});

		// The denial can surface directly (PERMISSION_DENIED) or wrapped by runPath/runCascade
		// (ROUTINE_FAILED with the denial as `cause`); flatten both so the assertion is about WHETHER
		// B was denied, not about which layer reported it.
		const denialText = (err) => `${err?.code ?? ""} ${err?.message ?? ""} ${err?.cause?.code ?? ""} ${err?.cause?.message ?? ""}`;

		it("per-path: api.a.initialize() is allowed, api.b.initialize() is PERMISSION_DENIED", async () => {
			globalThis.__slothletPermLog = [];
			const api = await mkApi();
			try {
				expect(await api.a.initialize()).toBe("secret-value");
				let bErr;
				try {
					await api.b.initialize();
				} catch (err) {
					bErr = err;
				}
				// B is DENIED while A is ALLOWED at the identical target — each under its own caller
				// identity. The exact surface differs by mode: eager wraps B's PERMISSION_DENIED in
				// runPath's ROUTINE_FAILED (stack installed), lazy surfaces PERMISSION_DENIED directly —
				// so assert the denial signal regardless of wrapping.
				expect(bErr, "api.b.initialize() must be denied, not allowed").toBeTruthy();
				expect(denialText(bErr)).toMatch(/PERMISSION_DENIED/);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("root cascade: A succeeds under its own identity, B's denial aggregates as its own error", async () => {
			globalThis.__slothletPermLog = [];
			const api = await mkApi();
			try {
				let cascErr;
				try {
					await api.initialize();
				} catch (err) {
					cascErr = err;
				}
				// A ran and reached the gated target under identity `a`; B never did (denied before its log).
				expect(globalThis.__slothletPermLog).toContain("a:ok");
				expect(globalThis.__slothletPermLog).not.toContain("b:ok");
				// B's denial surfaces as a routine failure attributed to B, its own PERMISSION_DENIED as cause.
				expect(cascErr?.code).toBe("ROUTINE_FAILED");
				expect(cascErr.context.failures.some((f) => f.apiPath.startsWith("b"))).toBe(true);
				expect(denialText(cascErr)).toMatch(/PERMISSION_DENIED/);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
