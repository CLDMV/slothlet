/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/impl-collision-event.test.vitest.mjs
 *	@Date: 2026-09-21 08:57:29 -07:00 (1790006249)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-21 09:01:26 -07:00 (1790006486)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Public `impl:collision` lifecycle event (#441).
 *
 * @description
 * Verifies the collision-resolution event fired when composing a module into a namespace another
 * module already composed. Unlike `impl:created` (which fires post-placement for the WINNER only),
 * `impl:collision` fires for the collision itself and carries both writers, so a consumer can see a
 * silently dropped or shadowed leaf regardless of nesting.
 *
 * Scenario: package A owns `shared.*`; package B is composed into the same root via
 * `api.slothlet.api.add()`. B's `shared.alpha` collides with A's (dropped under merge); B's
 * `shared.util` namespace merges with A's; B's `shared.beta` is unique (no collision).
 *
 * @module tests/vitests/suites/lifecycle/impl-collision-event
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "../../../../api_tests/api_test_collision_events");
const PKG_A = path.join(FIXTURES, "pkg_a");
const PKG_B = path.join(FIXTURES, "pkg_b");
const COLLISIONS = path.resolve(__dirname, "../../../../api_tests/api_test_collisions");

/** @type {any} */ let api;

afterEach(async () => {
	if (api?.shutdown) await api.shutdown().catch(() => {});
	api = null;
});

/** Compose pkg_a, subscribe, add pkg_b under `mode`, and return the collision events. */
async function composeAndAdd({ mode, apiMode = "merge", addOpts = { collisionMode: "merge" } }) {
	const events = [];
	api = await slothlet({ base: PKG_A, mode, collision: { initial: "merge", api: apiMode }, silent: true });
	api.slothlet.lifecycle.on("impl:collision", (d) => events.push(d));
	await api.slothlet.api.add("", PKG_B, { moduleID: "pkgB", ...addOpts });
	// Force lazy materialization of the composed surface so every resolved leaf is realized.
	const shared = await api.shared;
	void shared?.alpha;
	void shared?.beta;
	const util = await shared?.util;
	void util?.format;
	void util?.parse;
	return events;
}

const byPath = (events, apiPath) => events.filter((e) => e.apiPath === apiPath);

describe("impl:collision — dropped value leaf (merge)", () => {
	for (const mode of ["eager", "lazy"]) {
		it(`fires once for a leaf both modules define (${mode})`, async () => {
			const events = await composeAndAdd({ mode });
			const dropped = byPath(events, "shared.alpha");
			expect(dropped.length).toBe(1);
			expect(dropped[0]).toMatchObject({
				apiPath: "shared.alpha",
				resolution: "dropped",
				incoming: "pkgB",
				kind: "value",
				collisionMode: "merge"
			});
			// owner is the retained (first) writer — a real module id, distinct from the incoming one.
			expect(typeof dropped[0].owner).toBe("string");
			expect(dropped[0].owner).not.toBe("pkgB");
		});

		it(`does NOT fire for a leaf unique to the incoming module (${mode})`, async () => {
			const events = await composeAndAdd({ mode });
			expect(byPath(events, "shared.beta")).toHaveLength(0);
		});
	}
});

describe("impl:collision — merged namespace", () => {
	for (const mode of ["eager", "lazy"]) {
		it(`reports a namespace both modules contribute as merged, not dropped (${mode})`, async () => {
			const events = await composeAndAdd({ mode });
			const merged = byPath(events, "shared.util");
			expect(merged.length).toBe(1);
			expect(merged[0]).toMatchObject({
				resolution: "merged",
				incoming: "pkgB",
				kind: "namespace",
				collisionMode: "merge"
			});
		});
	}

	it("reports a nested leaf collision inside a merged namespace as dropped (eager)", async () => {
		const events = await composeAndAdd({ mode: "eager" });
		const nested = byPath(events, "shared.util.format");
		expect(nested.length).toBe(1);
		expect(nested[0]).toMatchObject({ resolution: "dropped", kind: "value", incoming: "pkgB" });
	});
});

describe("impl:collision — replaced", () => {
	it("fires when an incoming module replaces an occupied slot, tagging value vs namespace", async () => {
		const events = await composeAndAdd({ mode: "eager", apiMode: "replace", addOpts: { collisionMode: "replace" } });

		// A callable leaf slot (`shared`) is replaced as a value.
		const replacedLeaf = byPath(events, "shared");
		expect(replacedLeaf.length).toBe(1);
		expect(replacedLeaf[0]).toMatchObject({
			resolution: "replaced",
			incoming: "pkgB",
			kind: "value",
			collisionMode: "replace"
		});
		expect(typeof replacedLeaf[0].owner).toBe("string");
		expect(replacedLeaf[0].owner).not.toBe("pkgB");

		// A plain namespace slot (`data`) is replaced as a namespace.
		const replacedNs = byPath(events, "data");
		expect(replacedNs.length).toBe(1);
		expect(replacedNs[0]).toMatchObject({ resolution: "replaced", kind: "namespace", incoming: "pkgB" });
	});
});

describe("impl:collision — folded self-named namespace (the invisible case)", () => {
	it("announces a member dropped when a self-named folder folds off-slot (lazy)", async () => {
		const events = [];
		api = await slothlet({
			base: COLLISIONS,
			mode: "lazy",
			collision: { initial: "merge" },
			silent: true,
			lifecycle: { "impl:collision": (d) => events.push(d) }
		});
		// Drive the folded collision settle: touch the self-named callable folders and their members.
		await api.pair;
		JSON.stringify(await api.pair?.frog);
		JSON.stringify(await api.pair?.crog);
		// A folded member the survivor already owns is dropped — impl:created never announced it.
		const folded = events.filter((e) => e.resolution === "dropped" && e.apiPath.startsWith("pair."));
		expect(folded.length).toBeGreaterThan(0);
		for (const e of folded) {
			expect(e).toMatchObject({ resolution: "dropped", kind: "value", collisionMode: "merge" });
			expect(typeof e.owner).toBe("string");
		}
	});
});

describe("impl:collision — payload shape", () => {
	it("carries apiPath, resolution, incoming, owner, kind, collisionMode", async () => {
		const events = await composeAndAdd({ mode: "eager" });
		expect(events.length).toBeGreaterThan(0);
		for (const e of events) {
			expect(Object.keys(e).sort()).toEqual(["apiPath", "collisionMode", "incoming", "kind", "owner", "resolution"]);
			expect(["dropped", "replaced", "merged", "stacked"]).toContain(e.resolution);
			expect(["value", "namespace"]).toContain(e.kind);
		}
	});
});
