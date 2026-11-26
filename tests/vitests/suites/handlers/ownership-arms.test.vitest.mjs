/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/ownership-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:42:47-08:00 (1795599767)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:28:12-08:00 (1795602492)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview OwnershipManager arms the ownership suites do not reach: indexing exports of objects with
 * non-enumerable, throwing or changing members, argument guards of the index and origin readers, a merge in which a
 * primitive meets an object owner, a removal that leaves only shadowed entries, and restoring stacks for a path that
 * is gone.
 *
 * @module tests/vitests/suites/handlers/ownership-arms.test.vitest
 */

import { describe, it, expect } from "vitest";
import { OwnershipManager } from "#handlers/ownership";
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * A fresh ownership manager over a stand-in instance.
 * @returns {OwnershipManager} The manager.
 * @example
 * const own = makeOwn();
 */
function makeOwn() {
	return new OwnershipManager({ config: {}, debug: () => {}, SlothletError, SlothletWarning: class {}, handlers: {} });
}

describe("OwnershipManager.indexModuleExports — odd members", () => {
	it("skips a non-enumerable binding and one that throws when read", () => {
		const own = makeOwn();
		const fn = () => 1;
		const mod = { add: fn };
		Object.defineProperty(mod, "hidden", { value: () => 2, enumerable: false });
		Object.defineProperty(mod, "boom", {
			enumerable: true,
			get() {
				throw new Error("not yet initialized");
			}
		});
		expect(() => own.indexModuleExports("/abs/odd.mjs", mod)).not.toThrow();
		expect(own.resolveExportPath("/abs/odd.mjs", fn)).toEqual(["add"]);
	});

	it("reads nothing of a default member whose descriptor changes or throws between reads", () => {
		const own = makeOwn();
		const reads = new Map();
		const target = { swaps: 1, fails: 2 };
		const def = new Proxy(target, {
			getOwnPropertyDescriptor(t, key) {
				const n = (reads.get(key) ?? 0) + 1;
				reads.set(key, n);
				if (n === 1) return Reflect.getOwnPropertyDescriptor(t, key);
				if (key === "fails") throw new Error("descriptor refused");
				return { configurable: true, enumerable: true, get: () => 9 };
			}
		});
		expect(() => own.indexModuleExports("/abs/proxied.mjs", { default: def })).not.toThrow();
	});
});

describe("OwnershipManager — argument guards", () => {
	it("ignores an index request with no file or nothing indexable", () => {
		const own = makeOwn();
		own.indexModuleExports("", { a: () => {} });
		own.indexModuleExports("/abs/x.mjs", 5);
		expect(own.isCommonJSModule("")).toBe(false);
		expect(own.isCommonJSModule("/abs/x.mjs")).toBe(false);
	});

	it("answers null for an export path asked by a non-string file", () => {
		expect(makeOwn().resolveExportPathByKey(5, "k", 1)).toBeNull();
	});

	it("notes no clone of a value as itself or of a primitive", () => {
		const own = makeOwn();
		const obj = {};
		own.noteClone(obj, obj);
		own.noteClone(obj, 5);
		expect(own.cloneSources.has(obj)).toBe(false);
	});

	it("releases no mount of a module it never placed", () => {
		expect(makeOwn().releaseMount("nobody", "x")).toBe(0);
	});

	it("answers no owner for an empty or missing snapshot", () => {
		const own = makeOwn();
		expect(own.snapshotOwner([])).toBeUndefined();
		expect(own.snapshotOwner(undefined)).toBeUndefined();
	});
});

describe("OwnershipManager.refreshOrigin", () => {
	it("does nothing for a path with no stack", () => {
		const own = makeOwn();
		own.refreshOrigin("m", "nowhere", { filePath: "/f.mjs", exportPath: ["x"] });
		expect(own.getOrigin("nowhere")).toBeNull();
	});

	it("keeps the file when the new origin names none", () => {
		const own = makeOwn();
		own.register({ moduleID: "m", apiPath: "p", value: () => {}, filePath: "/orig.mjs", exportPath: ["a"] });
		own.refreshOrigin("m", "p", { exportPath: ["b"] });
		expect(own.getOrigin("p")).toEqual({ moduleID: "m", filePath: "/orig.mjs", exportPath: ["b"], members: null });
	});
});

describe("OwnershipManager.register — merge of a primitive into an object owner", () => {
	it("records the primitive as a merge loss; the object owner stands", () => {
		const own = makeOwn();
		own.register({ moduleID: "modA", apiPath: "p", value: { x: 1 } });
		const entry = own.register({ moduleID: "modB", apiPath: "p", value: 5, collisionMode: "merge" });
		expect(entry.isMergeLoss).toBe(true);
		expect(own.getCurrentOwner("p").moduleID).toBe("modA");
	});
});

describe("OwnershipManager.removePath — only shadowed entries left", () => {
	it("restores nothing", () => {
		const own = makeOwn();
		own.register({ moduleID: "modA", apiPath: "p", value: () => "a" });
		own.register({ moduleID: "modB", apiPath: "p", value: () => "b", collisionMode: "replace" });
		own.shadowSubtree("p", "modX");
		const result = own.removePath("p", "modB");
		expect(result).toMatchObject({ action: "none", removedModuleId: "modB", restoreModuleId: null });
	});
});

describe("OwnershipManager.restoreStacks — a path that is gone", () => {
	it("skips it", () => {
		const own = makeOwn();
		own.register({ moduleID: "modA", apiPath: "q", value: () => "a" });
		const snapshot = own.snapshotStacks("q");
		own.forgetPath("q");
		own.restoreStacks(snapshot, new Set());
		expect(own.getCurrentOwner("q")).toBeFalsy();
	});
});
