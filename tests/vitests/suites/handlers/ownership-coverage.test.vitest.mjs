/**
 * @fileoverview White-box coverage for OwnershipManager's collision-conflict handling and the
 * speculative-revert / snapshot-restore methods (#366/#372 hardening).
 *
 * @description
 * These are all public methods exercised in isolation on a standalone OwnershipManager (the same
 * direct-instantiation pattern the routine-manager-revert suite uses), driving each collision mode
 * and each revert/restore branch with crafted inputs — no live composed api needed.
 * @module tests/vitests/suites/handlers/ownership-coverage
 */

import { describe, it, expect } from "vitest";
import { OwnershipManager } from "#handlers/ownership";
import { SlothletError } from "@cldmv/slothlet/errors";

/** Minimal slothlet mock — mirrors routine-manager-revert.test.mjs's makeMock(). */
function makeOwn() {
	let warnings = 0;
	const mock = {
		config: {},
		debug: () => {},
		SlothletError,
		SlothletWarning: class {
			constructor() {
				mock.__warnings++;
			}
		},
		__warnings: 0,
		handlers: {}
	};
	mock.__warnings = 0;
	void warnings;
	return new OwnershipManager(mock);
}

describe("OwnershipManager — collision-conflict handling in register() (#366)", () => {
	it("skip mode: a conflicting registration is skipped silently and the first owner stands", () => {
		const own = makeOwn();
		const a = own.register({ moduleID: "modA", apiPath: "p", value: () => "a", collisionMode: "error" });
		expect(a).not.toBeNull();
		const b = own.register({ moduleID: "modB", apiPath: "p", value: () => "b", collisionMode: "skip" });
		expect(b).toBeNull();
		expect(own.getCurrentOwner("p").moduleID).toBe("modA");
	});

	it("warn mode (non-silent): emits a warning and skips the conflicting registration", () => {
		const own = makeOwn();
		own.register({ moduleID: "modA", apiPath: "p", value: () => "a", collisionMode: "error" });
		const before = own.slothlet.__warnings;
		const b = own.register({ moduleID: "modB", apiPath: "p", value: () => "b", collisionMode: "warn", config: { silent: false } });
		expect(b).toBeNull();
		expect(own.slothlet.__warnings).toBe(before + 1);
		expect(own.getCurrentOwner("p").moduleID).toBe("modA");
	});

	it("warn mode (silent): skips the conflicting registration without emitting a warning", () => {
		const own = makeOwn();
		own.register({ moduleID: "modA", apiPath: "p", value: () => "a", collisionMode: "error" });
		const before = own.slothlet.__warnings;
		const b = own.register({ moduleID: "modB", apiPath: "p", value: () => "b", collisionMode: "warn", config: { silent: true } });
		expect(b).toBeNull();
		expect(own.slothlet.__warnings).toBe(before);
	});

	it("error mode: a conflicting registration throws OWNERSHIP_CONFLICT", () => {
		const own = makeOwn();
		own.register({ moduleID: "modA", apiPath: "p", value: () => "a", collisionMode: "error" });
		expect(() => own.register({ moduleID: "modB", apiPath: "p", value: () => "b", collisionMode: "error" })).toThrow(/OWNERSHIP_CONFLICT/);
	});
});

describe("OwnershipManager — snapshot / restore of a single module's entries (#372)", () => {
	it("snapshotModuleEntries captures a registered module's entries; restoreEntry undoes a later overwrite", () => {
		const own = makeOwn();
		own.register({ moduleID: "mod", apiPath: "thing", value: "v1", source: "core", collisionMode: "error", filePath: "/a.mjs" });
		const snap = own.snapshotModuleEntries("mod");
		expect(snap.get("thing")).toMatchObject({ value: "v1", source: "core", filePath: "/a.mjs" });

		// A later re-registration (merge) overwrites the entry's value in place.
		own.register({ moduleID: "mod", apiPath: "thing", value: "v2", collisionMode: "merge" });
		expect(own.getCurrentValue("thing")).toBe("v2");

		own.restoreEntry("mod", "thing", snap.get("thing"));
		expect(own.getCurrentValue("thing")).toBe("v1");
	});

	it("restoreEntry is a no-op when the (apiPath, moduleID) pair has no entry", () => {
		const own = makeOwn();
		// No registration for this pair — the find() returns undefined and restoreEntry returns early.
		expect(() => own.restoreEntry("ghost", "nope", { value: 1, filePath: null, source: "core", isMergeLoss: false })).not.toThrow();
		expect(own.getCurrentOwner("nope")).toBeNull();
	});
});

describe("OwnershipManager — revertSpeculativeSubtree (#372/#373)", () => {
	it("no-ops for a non-walkable api value (null / primitive)", () => {
		const own = makeOwn();
		expect(() => own.revertSpeculativeSubtree(null, "mod", "", new Map())).not.toThrow();
		expect(() => own.revertSpeculativeSubtree(42, "mod", "", new Map())).not.toThrow();
	});

	it("stops on a circular reference instead of recursing forever", () => {
		const own = makeOwn();
		const node = { child: {} };
		node.child.loop = node; // circular
		expect(() => own.revertSpeculativeSubtree(node, "mod", "root", new Map())).not.toThrow();
	});

	it("restores a path present in priorEntries and removes one that is not, skipping internal keys", () => {
		const own = makeOwn();
		// Establish a genuine prior entry at "root.kept", plus a speculative one at "root.dropped".
		own.register({ moduleID: "mod", apiPath: "root.kept", value: "orig", collisionMode: "error" });
		const prior = own.snapshotModuleEntries("mod");
		own.register({ moduleID: "mod", apiPath: "root.kept", value: "spec", collisionMode: "merge" });
		own.register({ moduleID: "mod", apiPath: "root.dropped", value: "spec2", collisionMode: "merge" });
		expect(own.getCurrentValue("root.kept")).toBe("spec");
		expect(own.getCurrentOwner("root.dropped")).not.toBeNull();

		// Walk a candidate tree that has both children plus an internal key that must be skipped.
		const tree = { kept: () => {}, dropped: () => {}, __metadata: { anything: true } };
		own.revertSpeculativeSubtree(tree, "mod", "root", prior);

		expect(own.getCurrentValue("root.kept")).toBe("orig"); // restored from prior
		expect(own.getCurrentOwner("root.dropped")).toBeNull(); // dropped (absent from prior)
	});

	it("with an empty root path, skips the level-revert and derives child paths from the bare key", () => {
		const own = makeOwn();
		own.register({ moduleID: "mod", apiPath: "leaf", value: "spec", collisionMode: "merge" });
		expect(own.getCurrentOwner("leaf")).not.toBeNull();
		// path === "" → the `if (path)` level-revert is skipped and childPath uses the bare key ("leaf").
		own.revertSpeculativeSubtree({ leaf: () => {} }, "mod", "", new Map());
		expect(own.getCurrentOwner("leaf")).toBeNull();
	});
});

describe("OwnershipManager — revertSpeculativeState (#372)", () => {
	it("restores prior-present paths and drops the rest, driven by current ownership state", () => {
		const own = makeOwn();
		own.register({ moduleID: "mod", apiPath: "kept", value: "orig", collisionMode: "error" });
		const prior = own.snapshotModuleEntries("mod");
		own.register({ moduleID: "mod", apiPath: "kept", value: "spec", collisionMode: "merge" });
		own.register({ moduleID: "mod", apiPath: "dropped", value: "spec2", collisionMode: "merge" });

		own.revertSpeculativeState("mod", prior);

		expect(own.getCurrentValue("kept")).toBe("orig"); // restored
		expect(own.getCurrentOwner("dropped")).toBeNull(); // dropped
	});
});
