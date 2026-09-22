/**
 * @fileoverview Routine per-entity controls (#400) — `cascade: false` suppresses the root run-all
 * `api.<name>()` cascade, and every stacked routine path exposes `.for(moduleID)` (invoke exactly
 * one co-owner, in its own extent/identity, args passed straight through) and `.contributors` (the
 * moduleIDs present at that path). Built for a per-entity lifecycle: a namespace co-owned by several
 * first-class packages where the host must activate exactly one contributor at a time, never a
 * run-all. Composes with stackable routines (#341) and the routine cascade surface (#399).
 * @module tests/vitests/suites/lifecycle/routines-cascade-for
 */

import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe.each(["eager", "lazy"])("routines #400 — cascade:false + .for(key) + .contributors — mode: %s", (mode) => {
	beforeEach(() => {
		globalThis.__slothletRoutineLog = [];
		globalThis.__slothletSelfLog = [];
	});

	describe("cascade: false suppresses the root run-all cascade", () => {
		it("a nested-only routine gets NO root api.<name> cascade (the per-entity case)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
				mode,
				routines: [{ name: "activate", mode: "manual", cascade: false, recursive: true }],
				stackRoutines: true,
				silent: true
			});
			try {
				// No root run-all: "activate" is only ever a nested contribution (worker.activate), and
				// cascade:false means slothlet never grafts a run-all callable at the root.
				expect(api.activate).toBeUndefined();
				// The per-path callable is still there — that's what carries .for/.contributors.
				expect(typeof api.worker.activate).toBe("function");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("cascade defaults to true — the root cascade is created as before", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "manual" }],
				silent: true
			});
			try {
				expect(typeof api.initialize).toBe("function");
				expect(api.initialize.__slothletRoutineCascade).toBe(true);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("cascade:false leaves a same-named root contributor as its own leaf, not a run-all cascade", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "manual", cascade: false }],
				stackRoutines: true,
				silent: true
			});
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				// The base's own root "initialize" leaf stays at api.initialize — it is NOT replaced by a
				// run-all cascade, so calling it runs only itself, not every matching contribution.
				expect(api.initialize.__slothletRoutineCascade).toBeUndefined();
				globalThis.__slothletRoutineLog = [];
				await api.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe(".contributors + .for(key) on a co-owned path", () => {
		it("lists the co-owners and invokes exactly one by moduleID, its args passed through", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "manual", cascade: false }],
				stackRoutines: true,
				silent: true
			});
			try {
				const id1 = await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				const id2 = await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				// Both co-owners are discoverable, in registration order.
				expect(api.auth.initialize.contributors).toEqual([id1, id2]);

				// .for(key) runs ONLY that one contributor.
				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize.for(id1)();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);

				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize.for(id2)();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth2:initialize"]);

				// The plain stacked call still runs every contributor (stackRoutines behavior is unchanged).
				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it(".for(key) forwards positional args and runs in the contributor's own extent (ambient self.* resolves)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
				mode,
				routines: [{ name: "activate", mode: "manual", cascade: false, recursive: true }],
				stackRoutines: true,
				silent: true
			});
			try {
				const contributors = api.worker.activate.contributors;
				expect(contributors.length).toBe(1);

				// worker.activate(ctx) reaches ambient `self.coord.register(...)` — only a live extent lets
				// `self` resolve, so a registered tag proves .for ran the contributor in its own extent AND
				// forwarded the positional `ctx` argument straight through.
				await api.worker.activate.for(contributors[0])({ id: 7 });
				expect(await api.coord.getRegistered()).toContain("worker:activate:7");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it(".for(key) throws INVALID_ARGUMENT for a moduleID that doesn't contribute here", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "manual", cascade: false }],
				stackRoutines: true,
				silent: true
			});
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				await withSuppressedSlothletErrorOutput(async () => {
					await expect(api.auth.initialize.for("no-such-module")()).rejects.toMatchObject({
						code: "INVALID_ARGUMENT"
					});
				});
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe(".for(key) selects a specific contributor regardless of the stackRoutines owner-filter", () => {
		it("runs a co-owner that a plain call would drop (stackRoutines default false)", async () => {
			// stackRoutines is NOT enabled here: a plain call runs only the path's current owner, but
			// .for(key) can still address either co-owner by moduleID — selecting one is the whole point.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "manual", cascade: false }],
				silent: true
			});
			try {
				const id1 = await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				const id2 = await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				// Both are still discoverable — .contributors enumerates every contribution, not just the owner.
				expect(api.auth.initialize.contributors).toEqual([id1, id2]);

				// The non-owner contributor still runs when addressed directly.
				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize.for(id2)();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("#443 — the selector surface survives a getOwnPropertyDescriptor probe through the wrapper", () => {
		// A nested routine slot (worker.activate) is reached through the composed unified-wrapper proxy.
		// #400 defined `.for`/`.contributors`/the `__slothletRoutine*` markers with bare Object.defineProperty,
		// so they defaulted to NON-configurable — and the wrapper's getOwnPropertyDescriptor trap relayed that
		// for a property the proxy target does not carry as own+non-configurable, tripping the ES Proxy
		// invariant ("trap reported non-configurability … which is either non-existent or configurable in the
		// proxy target"). A plain `.for` get slipped past it (which is why a compose-time typeof check passed),
		// but any getOwnPropertyDescriptor read of the slot — as a re-materialized tree hits on the deferred
		// call — threw. The descriptors are now configurable, so the invariant imposes no constraint.
		it("reading a routine slot's descriptors through the wrapper does not throw the proxy invariant", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_SELF,
				mode,
				routines: [{ name: "activate", mode: "manual", cascade: false, recursive: true }],
				stackRoutines: true,
				silent: true
			});
			try {
				const slot = api.worker.activate; // the stacked callable, reached through the composed proxy

				// The invariant-tripping reads: getOwnPropertyDescriptor for each property #400 defined.
				const forDesc = Object.getOwnPropertyDescriptor(slot, "for");
				expect(forDesc).toBeDefined();
				expect(forDesc.configurable).toBe(true);
				expect(forDesc.enumerable).toBe(false);
				expect(typeof forDesc.value).toBe("function");

				const contribDesc = Object.getOwnPropertyDescriptor(slot, "contributors");
				expect(contribDesc).toBeDefined();
				expect(contribDesc.configurable).toBe(true);
				expect(contribDesc.enumerable).toBe(false);

				// The `__slothletRoutine*` markers are not framework-reserved, so they reach the impl branch
				// of the trap too — they must be configurable for the same reason.
				const markerDesc = Object.getOwnPropertyDescriptor(slot, "__slothletRoutineStack");
				expect(markerDesc).toBeDefined();
				expect(markerDesc.configurable).toBe(true);

				// Object.getOwnPropertyDescriptors sweeps every own key at once — the shape a serializer or a
				// structured-clone-style walk takes — and must not throw on any of them either.
				expect(() => Object.getOwnPropertyDescriptors(slot)).not.toThrow();

				// And the selector still works after being probed.
				const contributors = slot.contributors;
				expect(contributors.length).toBe(1);
				globalThis.__slothletSelfLog = [];
				await slot.for(contributors[0])({ id: 43 });
				expect(await api.coord.getRegistered()).toContain("worker:activate:43");
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});

describe("routines #400 — config validation", () => {
	it("rejects a non-boolean cascade with INVALID_CONFIG", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, routines: [{ name: "initialize", cascade: "yes" }], silent: true })
			).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		});
	});

	it("accepts cascade only via the object form (string shorthand always defaults it to true)", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			routines: ["initialize:manual"],
			silent: true
		});
		try {
			// String shorthand → cascade defaults to true → the root cascade exists.
			expect(api.initialize.__slothletRoutineCascade).toBe(true);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
