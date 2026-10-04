/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-remove-frozen-export.test.vitest.mjs
 *	@Date: 2026-09-27T21:37:01-07:00 (1790570221)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:20-07:00 (1791091700)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression (#485): removing a module whose export tree contains a frozen plain object
 * (the common idiom for an exported constant table) must not mutate that object. `deletePath()` fell
 * through to a native `delete` on the consumer's own object, which throws in strict mode when the object
 * is frozen — aborting the removal partway and leaving stale leaves on the api plus an invalidated
 * function leaf that a re-add of the same moduleID did not restore.
 *
 * @module tests/vitests/suites/api-manager/api-manager-remove-frozen-export
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

/**
 * Write a fixture module, creating its folder.
 * @param {string} dir - Folder to write into.
 * @param {string} name - File name.
 * @param {string} code - Module source.
 * @returns {Promise<void>}
 */
async function writeModule(dir, name, code) {
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), code);
}

// The module keeps a handle on its own frozen objects so the test can prove they were left untouched.
const FROZEN_ERRORS = `
const CODES = Object.freeze({ NOT_FOUND: "not-found", CONFLICT: "conflict" });
export const errors = Object.freeze({ CODES, isStoreError: (err) => !!err });
globalThis.__slothletFrozenProbe ??= [];
globalThis.__slothletFrozenProbe.push({ CODES, errors });
`;

const SEALED = `
export const limits = Object.seal({ max: 10, min: 1 });
export const fixed = {};
Object.defineProperty(fixed, "answer", { value: 42, enumerable: true, configurable: false });
`;

describe.each([{ mode: "eager" }, { mode: "lazy" }])("api-manager — remove a module exporting frozen objects ($mode)", ({ mode }) => {
	let api;
	const dirs = [];

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown().catch(() => {});
		api = null;
		delete globalThis.__slothletFrozenProbe;
		for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
	});

	it("removes a frozen nested plain-object export without throwing or mutating it", async () => {
		const root = await makeTestTmpDir(`remove-frozen-${mode}`);
		dirs.push(root);
		const store = join(root, "store");
		await writeModule(store, "errors.mjs", FROZEN_ERRORS);

		api = await slothlet({ mode, silent: true });
		await api.slothlet.api.add(["store"], store, { moduleID: "m" });
		expect(api.store.errors.CODES.NOT_FOUND).toBe("not-found");
		expect(await api.store.errors.isStoreError(new Error("x"))).toBe(true);

		await expect(api.slothlet.api.remove("m")).resolves.not.toThrow();

		// The whole module is detached — nothing stale stays reachable.
		expect(api.store).toBeUndefined();

		// The module's own frozen objects are untouched.
		for (const { CODES, errors } of globalThis.__slothletFrozenProbe) {
			expect(CODES).toEqual({ NOT_FOUND: "not-found", CONFLICT: "conflict" });
			expect(Object.isFrozen(CODES)).toBe(true);
			expect(typeof errors.isStoreError).toBe("function");
		}

		// Re-adding the same moduleID restores a fully working module.
		await api.slothlet.api.add(["store"], store, { moduleID: "m" });
		expect(api.store.errors.CODES.NOT_FOUND).toBe("not-found");
		expect(api.store.errors.CODES.CONFLICT).toBe("conflict");
		expect(await api.store.errors.isStoreError(new Error("x"))).toBe(true);
	});

	it("removes sealed and non-configurable exports", async () => {
		const root = await makeTestTmpDir(`remove-sealed-${mode}`);
		dirs.push(root);
		const cfg = join(root, "cfg");
		await writeModule(cfg, "values.mjs", SEALED);

		api = await slothlet({ mode, silent: true });
		await api.slothlet.api.add(["cfg"], cfg, { moduleID: "sealed" });
		expect(api.cfg.values.limits.max).toBe(10);
		expect(api.cfg.values.fixed.answer).toBe(42);

		await expect(api.slothlet.api.remove("sealed")).resolves.not.toThrow();
		expect(api.cfg).toBeUndefined();
	});

	it("a user `delete` through the wrapper behaves like the underlying object", async () => {
		const root = await makeTestTmpDir(`delete-frozen-${mode}`);
		dirs.push(root);
		const store = join(root, "store");
		await writeModule(store, "errors.mjs", FROZEN_ERRORS);
		await writeModule(store, "table.mjs", `export const table = { a: 1, b: 2 };`);

		api = await slothlet({ mode, silent: true });
		await api.slothlet.api.add(["store"], store, { moduleID: "m" });

		// Frozen: the same strict-mode TypeError a direct delete on the frozen object throws, value kept.
		const codes = api.store.errors.CODES;
		expect(() => {
			"use strict";
			delete codes.NOT_FOUND;
		}).toThrow(TypeError);
		expect(api.store.errors.CODES.NOT_FOUND).toBe("not-found");

		// Mutable: the delete goes through.
		const table = api.store.table;
		expect(table.a).toBe(1);
		delete table.a;
		expect(table.a).toBeUndefined();
		expect(table.b).toBe(2);
	});

	it("keeps sibling modules when a frozen-export module is removed", async () => {
		const root = await makeTestTmpDir(`remove-frozen-sib-${mode}`);
		dirs.push(root);
		const store = join(root, "store");
		const other = join(root, "other");
		await writeModule(store, "errors.mjs", FROZEN_ERRORS);
		await writeModule(other, "ping.mjs", "export function ping() { return 'pong'; }");

		api = await slothlet({ mode, silent: true });
		await api.slothlet.api.add(["store"], store, { moduleID: "m" });
		await api.slothlet.api.add(["other"], other, { moduleID: "o" });

		await api.slothlet.api.remove("m");
		expect(api.store).toBeUndefined();
		expect(await api.other.ping()).toBe("pong");
	});
});
