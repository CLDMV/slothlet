/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/versioning/version-manager-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:38:51-08:00 (1795599531)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:15-08:00 (1795869195)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview VersionManager arms the integration suites do not reach: carrying state between managers whose
 * registries differ, a write on a run's copy, the caller object without a metadata handler, nested versioned
 * paths sharing a tag, and a dispatcher mount that fails after the path was torn down.
 *
 * @module tests/vitests/suites/versioning/version-manager-arms.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { VersionManager } from "#handlers/version-manager";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";
import { WRITE_TARGET } from "#helpers/flow-stores";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * A slothlet stand-in whose api manager records writes.
 * @param {object} [apiManager] - Api manager override.
 * @returns {object} Mock slothlet.
 * @example
 * const s = makeSlothlet();
 */
function makeSlothlet(apiManager) {
	return {
		SlothletError,
		SlothletWarning,
		instanceID: "vm-arms",
		config: { silent: true },
		debug: () => {},
		api: {},
		boundApi: {},
		handlers: {
			apiManager: apiManager ?? { setValueAtPath: vi.fn(async () => {}), deletePath: vi.fn(async () => {}) }
		}
	};
}

describe("VersionManager.carryState", () => {
	it("ignores something that is no manager, and itself", async () => {
		const vm = new VersionManager(makeSlothlet());
		await vm.registerVersion("auth", "v1", "m1", {}, true);
		expect(() => vm.carryState({})).not.toThrow();
		expect(() => vm.carryState(vm)).not.toThrow();
		expect(vm.getDefaultVersion("auth")).toBe("v1");
	});

	it("takes the default and metadata only for the versions both managers registered", async () => {
		const from = new VersionManager(makeSlothlet());
		await from.registerVersion("auth", "v1", "f1", { note: "from" }, false);
		await from.registerVersion("auth", "v2", "f2", {}, true);
		const to = new VersionManager(makeSlothlet());
		await to.registerVersion("auth", "v1", "t1", {}, true);
		await to.registerVersion("auth", "v3", "t3", {}, false);
		await to.registerVersion("other", "v1", "t9", {}, true);
		to.carryState(from);
		// v1 takes from's flags and metadata; v3 and `other` are not in from and keep theirs.
		expect(to.getVersionMetadata("t1")).toMatchObject({ note: "from", version: "v1", path: ["auth"] });
		expect(to.getDefaultVersion("other")).toBe("v1");
		expect(to.getVersionMetadata("t3")).toMatchObject({ version: "v3" });
	});
});

describe("VersionManager.setVersionMetadataByPath on a run's copy", () => {
	it("writes the copy the write target names", async () => {
		const slothlet = makeSlothlet();
		const vm = new VersionManager(slothlet);
		const copy = new VersionManager(slothlet);
		await vm.registerVersion("auth", "v1", "m1", {}, true);
		await copy.registerVersion("auth", "v1", "m1", {}, true);
		slothlet[WRITE_TARGET] = (component) => (component === vm ? copy : component);
		vm.setVersionMetadataByPath("auth", "v1", { stable: true });
		slothlet[WRITE_TARGET] = undefined;
		expect(copy.getVersionMetadataByPath("auth", "v1")).toMatchObject({ stable: true });
		expect(vm.getVersionMetadataByPath("auth", "v1")).not.toHaveProperty("stable");
	});
});

describe("VersionManager.buildCallerArg without a metadata handler", () => {
	it("takes the module from a composite module id", () => {
		const vm = new VersionManager(makeSlothlet());
		const caller = { ____slothletInternal: { moduleID: `base${MODULE_ID_SEPARATOR}math/add`, apiPath: "math.add" } };
		expect(vm.buildCallerArg(caller)).toEqual({ path: ["math", "add"], module: "base", metadata: {}, version: null });
	});

	it("takes a plain module id as it is, and none when the caller has no id", () => {
		const vm = new VersionManager(makeSlothlet());
		expect(vm.buildCallerArg({ ____slothletInternal: { moduleID: "plain", apiPath: "x" } }).module).toBe("plain");
		expect(vm.buildCallerArg({ ____slothletInternal: { apiPath: "x" } }).module).toBeNull();
		// A caller with no api path has no path segments.
		expect(vm.buildCallerArg({ ____slothletInternal: { moduleID: "plain" } }).path).toEqual([]);
	});
});

describe("VersionManager.pathSegments", () => {
	it("answers no segments for an empty or non-string path", () => {
		const vm = new VersionManager(makeSlothlet());
		expect(vm.pathSegments("")).toEqual([]);
		expect(vm.pathSegments(5)).toEqual([]);
	});

	it("keeps the tag whole under the longest versioned path that matches", async () => {
		const vm = new VersionManager(makeSlothlet());
		await vm.registerVersion("auth", "2.3.0", "a", {}, true);
		await vm.registerVersion("auth.admin", "2.3.0", "b", {}, true);
		expect(vm.pathSegments("2.3.0.auth.admin.login")).toEqual(["2.3.0", "auth", "admin", "login"]);
		expect(vm.pathSegments("2.3.0.auth.login")).toEqual(["2.3.0", "auth", "login"]);
	});
});

describe("VersionManager dispatcher mount failures", () => {
	it("takes back what a failed mount wrote, even when that removal fails", async () => {
		const boom = new Error("mount failed");
		const apiManager = {
			setValueAtPath: vi.fn(async (root) => {
				if (root === slothlet.boundApi) throw boom;
			}),
			deletePath: vi.fn(async () => {
				throw new Error("delete failed");
			})
		};
		const slothlet = makeSlothlet(apiManager);
		const vm = new VersionManager(slothlet);
		await expect(vm.registerVersion("auth", "v1", "m1", {}, true)).rejects.toBe(boom);
		expect(apiManager.deletePath).toHaveBeenCalledWith(slothlet.api, ["auth"]);
		expect(vm.hasDispatcher("auth")).toBe(false);
	});

	it("leaves the path's newer state alone when a mount fails after the path was torn down", async () => {
		let failMount;
		const apiManager = {
			setValueAtPath: vi.fn(
				() =>
					new Promise((_resolve, reject) => {
						failMount = reject;
					})
			),
			deletePath: vi.fn(async () => {})
		};
		const vm = new VersionManager(makeSlothlet(apiManager));
		const mounting = vm.registerVersion("auth", "v1", "m1", {}, true);
		// The mount is in flight; the only version goes away and the path is torn down.
		vm.unregisterVersion("auth", "v1");
		const boom = new Error("late failure");
		failMount(boom);
		await expect(mounting).rejects.toBe(boom);
		expect(vm.hasDispatcher("auth")).toBe(false);
	});
});
