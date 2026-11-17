/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/ownership-primitive-members.test.vitest.mjs
 *	@Date: 2026-11-17T00:00:00-08:00 (1794902400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T00:00:00-08:00 (1794902400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Ownership of primitive members (an exported string or number) when two modules are added at the same
 * path. A primitive export is the module's member exactly like an exported function, so the plain-JS answers apply:
 * the owner of a path is the module whose value is live there, `replace` leaves no owner behind for the members it
 * took off the api, and removing the module that took a path over reverts the path to the other module's value.
 * @module tests/vitests/suites/ownership/ownership-primitive-members
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { OwnershipManager } from "#handlers/ownership";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

/**
 * Minimal mock slothlet sufficient for OwnershipManager.
 * @returns {object} Mock slothlet object.
 */
function makeMock() {
	return { config: {}, debug: () => {}, SlothletError, SlothletWarning };
}

const A_SHARED = [
	'import { self } from "@cldmv/slothlet/runtime";',
	'export const version = "a";',
	"export const count = 1;",
	'export function who() { return "a"; }',
	"export function writeVersion(v) { self.p.shared.version = v; return self.p.shared.version; }"
].join("\n");

const B_SHARED = [
	'import { self } from "@cldmv/slothlet/runtime";',
	'export const version = "b";',
	'export function whoB() { return "b"; }',
	"export function writeVersionB(v) { self.p.shared.version = v; return self.p.shared.version; }"
].join("\n");

const CONFIGS = [
	{ name: "EAGER", config: { mode: "eager", runtime: "async" } },
	{ name: "EAGER_LIVE", config: { mode: "eager", runtime: "live" } },
	{ name: "LAZY", config: { mode: "lazy", runtime: "async" } },
	{ name: "LAZY_LIVE", config: { mode: "lazy", runtime: "live" } }
];

describe("OwnershipManager — primitive members are owned like any member", () => {
	it("a merge collision on a primitive keeps the existing module as the owner", () => {
		const ownership = new OwnershipManager(makeMock());
		ownership.register({ moduleID: "a", apiPath: "p.shared.version", value: "a", collisionMode: "merge" });
		ownership.register({ moduleID: "b", apiPath: "p.shared.version", value: "b", collisionMode: "merge" });

		expect(ownership.getCurrentOwner("p.shared.version").moduleID).toBe("a");
		expect(ownership.getCurrentValue("p.shared.version")).toBe("a");
		expect(ownership.getPathOwnership("p.shared.version")).toEqual(new Set(["a", "b"]));
	});

	it("a merge collision between a primitive and a function keeps whichever was there first", () => {
		const ownership = new OwnershipManager(makeMock());
		const fn = function () {};
		ownership.register({ moduleID: "a", apiPath: "x.first", value: 1, collisionMode: "merge" });
		ownership.register({ moduleID: "b", apiPath: "x.first", value: fn, collisionMode: "merge" });
		ownership.register({ moduleID: "a", apiPath: "x.second", value: fn, collisionMode: "merge" });
		ownership.register({ moduleID: "b", apiPath: "x.second", value: 2, collisionMode: "merge" });

		expect(ownership.getCurrentOwner("x.first").moduleID).toBe("a");
		expect(ownership.getCurrentOwner("x.second").moduleID).toBe("a");
	});

	it("a replace collision on a primitive makes the incoming module the owner", () => {
		const ownership = new OwnershipManager(makeMock());
		ownership.register({ moduleID: "a", apiPath: "p.shared.version", value: "a", collisionMode: "replace" });
		ownership.register({ moduleID: "b", apiPath: "p.shared.version", value: "b", collisionMode: "replace" });

		expect(ownership.getCurrentOwner("p.shared.version").moduleID).toBe("b");
	});

	it("registerSubtree records primitive members and claims them under replace", () => {
		const ownership = new OwnershipManager(makeMock());
		ownership.register({ moduleID: "b", apiPath: "p.shared.version", value: "b", collisionMode: "replace" });
		ownership.register({ moduleID: "a", apiPath: "p.shared.version", value: "a", collisionMode: "merge" });

		ownership.registerSubtree({ shared: { version: "b", size: 0, flag: false, none: null } }, "b", "p", { collisionMode: "replace" });

		expect(ownership.getCurrentOwner("p.shared.version").moduleID).toBe("b");
		expect(ownership.getCurrentOwner("p.shared.size").moduleID).toBe("b");
		expect(ownership.getCurrentOwner("p.shared.flag").moduleID).toBe("b");
		expect(ownership.getCurrentOwner("p.shared.none").moduleID).toBe("b");
	});
});

describe("api.add at a shared path — primitive members", () => {
	let tempBase;
	let baseDir;
	let aDir;
	let bDir;

	beforeAll(() => {
		tempBase = makeTestTmpDirSync("ownership-primitive");
		baseDir = join(tempBase, "base");
		aDir = join(tempBase, "A");
		bDir = join(tempBase, "B");
		mkdirSync(baseDir, { recursive: true });
		mkdirSync(aDir, { recursive: true });
		mkdirSync(bDir, { recursive: true });
		writeFileSync(join(baseDir, "ping.mjs"), "export function ping() { return 1; }");
		writeFileSync(join(aDir, "shared.mjs"), A_SHARED);
		writeFileSync(join(bDir, "shared.mjs"), B_SHARED);
	});

	afterAll(() => {
		rmSync(tempBase, { recursive: true, force: true });
	});

	/**
	 * Build an instance with A then B added at "p".
	 * @param {object} config - Matrix config.
	 * @param {string} mode - The api collision mode.
	 * @returns {Promise<{api: object, owner: function(string): (string|null)}>} The api and an owner lookup.
	 */
	async function setup(config, mode) {
		const api = await slothlet({
			...config,
			base: baseDir,
			permissions: { mode: "on" },
			api: { collision: { mode: { api: mode } } }
		});
		await api.slothlet.api.add("p", aDir, { id: "a" });
		await api.slothlet.api.add("p", bDir, { id: "b" });
		// Touch the namespace so a lazy mount has composed both modules before ownership is read.
		void Object.keys(api.p.shared);
		const ownership = resolveWrapper(api.ping).slothlet.handlers.ownership;
		const owner = (path) => ownership.getCurrentOwner(path)?.moduleID ?? null;
		return { api, owner };
	}

	for (const { name, config } of CONFIGS) {
		describe(name, () => {
			it("merge: the owner of a primitive is the module whose value is live", async () => {
				const { api, owner } = await setup(config, "merge");
				try {
					expect(api.p.shared.version).toBe("a");
					expect(owner("p.shared.version")).toBe("a");
					expect(owner("p.shared.count")).toBe("a");
					expect(owner("p.shared.who")).toBe("a");
					expect(owner("p.shared.whoB")).toBe("b");

					await api.slothlet.api.remove("b");
					expect(api.p.shared.version).toBe("a");
					expect(api.p.shared.count).toBe(1);
					expect(api.p.shared.whoB).toBeUndefined();
					expect(owner("p.shared.version")).toBe("a");
				} finally {
					await api.shutdown();
				}
			});

			it("replace: the members B took off the api have no owner, and B owns its primitive", async () => {
				const { api, owner } = await setup(config, "replace");
				try {
					expect(api.p.shared.version).toBe("b");
					expect(api.p.shared.count).toBeUndefined();
					expect(api.p.shared.who).toBeUndefined();
					expect(owner("p.shared.version")).toBe("b");
					expect(owner("p.shared.count")).toBeNull();
					expect(owner("p.shared.who")).toBeNull();
				} finally {
					await api.shutdown();
				}
			});

			it("replace: remove(b) reverts the primitive to A's value and restores A's members and owners", async () => {
				const { api, owner } = await setup(config, "replace");
				try {
					await api.slothlet.api.remove("b");
					expect(api.p.shared.version).toBe("a");
					expect(api.p.shared.count).toBe(1);
					expect(api.p.shared.who()).toBe("a");
					expect(owner("p.shared.version")).toBe("a");
					expect(owner("p.shared.count")).toBe("a");
					expect(owner("p.shared.who")).toBe("a");
				} finally {
					await api.shutdown();
				}
			});

			it("replace: remove(b) reverts a primitive B set at runtime to A's value", async () => {
				const { api } = await setup(config, "replace");
				try {
					expect(await api.p.shared.writeVersionB("fromB")).toBe("fromB");
					await api.slothlet.api.remove("b");
					expect(api.p.shared.version).toBe("a");
				} finally {
					await api.shutdown();
				}
			});
		});
	}
});
