/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/instance-imports-two-copies.test.vitest.mjs
 *	@Date: 2026-11-12T23:30:56-08:00 (1794555056)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:49:22-08:00 (1794635362)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Two copies of slothlet's instance-imports module in one process: the first keeps what every instance
 * records, and the second works through it.
 *
 * @description
 * This suite's own copy of `@cldmv/slothlet/helpers/instance-imports` is the one slothlet runs on, evaluated first.
 * A second copy of the same module is loaded by Node itself, through a CommonJS file's `import()`. The module's
 * contract for that case: the copy that loaded first keeps every instance's record; the other copy claims instance
 * IDs there, loads files through the handle it was given, reads the first copy's read-only views, and has the first
 * copy register the hooks. Neither copy can load a file under an ID the other holds, or release it.
 *
 * @module tests/vitests/suites/helpers/instance-imports-two-copies
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import nodeModule, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import * as first from "@cldmv/slothlet/helpers/instance-imports";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "../../../../api_tests/api_test_helper_copies/api");
/** Import a module with Node's own loader: the function is a CommonJS file's. */
const nativeImport = createRequire(import.meta.url)(path.join(HERE, "../runtime/fixtures/native-import.cjs"));

describe("Helpers > instance-imports > two copies of the module in one process", () => {
	let second;
	let api;
	let root;

	beforeAll(async () => {
		// The first copy keeps the record from here on: an instance is built before the second copy loads.
		api = await slothlet({ base: DIR, silent: true });
		for (const file of ["one", "two", "three", "four"]) await api[file].bumpCjs();
		second = await nativeImport("@cldmv/slothlet/helpers/instance-imports");
		root = await makeTestTmpDir("instance-imports-two-copies");
		fs.writeFileSync(path.join(root, "package.json"), "{}");
		fs.writeFileSync(path.join(root, "helper.cjs"), "let n = 0; exports.bump = () => ++n;");
		fs.writeFileSync(path.join(root, "leaf.cjs"), "const h = require('./helper.cjs'); module.exports = { bump: () => h.bump() };");
	});

	afterAll(async () => {
		await api?.shutdown();
		await fsp.rm(root, { recursive: true, force: true });
	});

	it("is a second module, not the first", () => {
		expect(second.requireInInstance).toBeTypeOf("function");
		expect(second.requireInInstance).not.toBe(first.requireInInstance);
	});

	it("reads the record the first copy keeps", () => {
		const instanceID = api.slothlet.instanceID;
		expect(first.instanceCommonJSFiles(instanceID).length).toBeGreaterThan(0);
		expect([...second.instanceCommonJSFiles(instanceID)].sort()).toEqual([...first.instanceCommonJSFiles(instanceID)].sort());
		expect(second.instanceCommonJSVersion(instanceID)).toEqual(first.instanceCommonJSVersion(instanceID));
		expect(second.instanceImporters(instanceID)).toBe(first.instanceImporters(instanceID));
		expect(second.instanceImporters("no-such-instance")).toBe(null);
	});

	it("cannot claim, load under or release the ID of an instance the first copy's slothlet built", () => {
		const instanceID = api.slothlet.instanceID;
		const before = [...first.instanceCommonJSFiles(instanceID)].sort();
		expect(second.claimInstanceScope(instanceID)).toBe(null);
		expect(first.claimInstanceScope(instanceID)).toBe(null);
		expect(() => second.requireInInstance(path.join(root, "leaf.cjs"), instanceID, { fresh: true })).toThrow(TypeError);
		expect(() => first.requireInInstance(path.join(root, "leaf.cjs"), instanceID, { fresh: true })).toThrow(TypeError);
		second.releaseInstanceScope(instanceID);
		first.releaseInstanceScope(instanceID);
		expect([...first.instanceCommonJSFiles(instanceID)].sort()).toEqual(before);
	});

	it("loads files through the first copy's state under an ID the second copy claimed", () => {
		const leaf = path.join(root, "leaf.cjs");
		const helper = path.join(root, "helper.cjs");
		const loaded = second.requireInInstance(leaf, "two-copies-b", { fresh: true });
		// One helper copy per instance ID, as with one copy of the module.
		expect([loaded.bump(), second.requireInInstance(leaf, "two-copies-b", { fresh: true }).bump()]).toEqual([1, 2]);
		expect([...first.instanceCommonJSFiles("two-copies-b")].sort()).toEqual([helper, leaf].sort());
		// The record of who requires the helper is the first copy's, and reads the same from both.
		expect(first.instanceImporters("two-copies-b").get(helper.replace(/\\/g, "/"))).toEqual(new Set([leaf.replace(/\\/g, "/")]));
		// The ID is the second copy's: the first can neither claim it nor load under it.
		expect(first.claimInstanceScope("two-copies-b")).toBe(null);
		expect(() => first.requireInInstance(leaf, "two-copies-b", { fresh: true })).toThrow(TypeError);
		first.releaseInstanceScope("two-copies-b");
		expect(first.instanceCommonJSFiles("two-copies-b").length).toBe(2);
		second.releaseInstanceScope("two-copies-b");
		expect(first.instanceCommonJSFiles("two-copies-b")).toEqual([]);
		expect(first.instanceImporters("two-copies-b")).toBe(null);
	});

	it("gives a handle that stops working once released", () => {
		const handle = second.claimInstanceScope("two-copies-c");
		expect(Object.isFrozen(handle)).toBe(true);
		expect(handle.require(path.join(root, "leaf.cjs"), { fresh: true }).bump()).toBe(1);
		handle.release();
		expect(() => handle.require(path.join(root, "leaf.cjs"), { fresh: true })).toThrow(TypeError);
		// Released, the ID can be claimed again, and starts empty.
		const again = first.claimInstanceScope("two-copies-c");
		expect(again).not.toBe(null);
		expect(first.instanceCommonJSFiles("two-copies-c")).toEqual([]);
		again.release();
	});

	it("has the first copy register the hooks, once", async () => {
		expect(second.installInstanceImportHooks(nodeModule)).toBe(true);
		expect(first.installInstanceImportHooks(nodeModule)).toBe(true);
		// Helper files are still one copy per instance: the first instance's CommonJS helper has counted four times.
		const other = await slothlet({ base: DIR, silent: true });
		try {
			expect([await api.three.bumpCjs(), await other.three.bumpCjs()]).toEqual([5, 1]);
			expect([await api.one.bump(), await other.one.bump()]).toEqual([1, 1]);
		} finally {
			await other.shutdown();
		}
	});

	it("shares one frozen object between the copies, with no collection on it", () => {
		const shared = globalThis[Symbol.for("@cldmv/slothlet.instanceImports")];
		expect(Object.isFrozen(shared)).toBe(true);
		for (const member of ["scopes", "copies", "leaves", "active", "graphs", "requireESM", "requireFromModule"])
			expect(member in shared).toBe(false);
		for (const value of Object.values(shared)) expect(value instanceof Map || value instanceof Set).toBe(false);
		expect(() => shared.redeem("not-a-ticket")).toThrow(TypeError);
		expect(() => shared.requireCJS(path.join(root, "helper.cjs"), api.slothlet.instanceID)).toThrow(TypeError);
	});
});

describe("Helpers > instance-imports > an instance ID something else holds", () => {
	it("refuses to load an instance's files under it", async () => {
		const api = await slothlet({ base: DIR, silent: true });
		const instanceID = api.slothlet.instanceID;
		// A full reload gives the instance a new ID, made from the old one and the time: claimed here first, for every
		// millisecond of the next minute (slothlet reads the time with the Date.now it loaded with, so it cannot be faked).
		const start = Date.now();
		const taken = [];
		for (let time = start; time < start + 60000; time++) taken.push(first.claimInstanceScope(`${instanceID}_reload_${time}`));
		try {
			expect(taken.every((handle) => handle !== null)).toBe(true);
			await expect(api.slothlet.reload()).rejects.toMatchObject({ code: "INSTANCE_ID_IN_USE" });
		} finally {
			for (const handle of taken) handle?.release();
			await api.shutdown().catch(() => {});
		}
	});
});
