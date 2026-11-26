/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/security/framework-member-names.test.vitest.mjs
 *	@Date: 2026-11-25T13:27:13-08:00 (1795642033)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:46:45-08:00 (1795643205)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Names that start with three or more underscores are the framework's, wherever a module supplies one.
 *
 * @description
 * By slothlet's naming convention `____x` names are the framework's private members and `___x` names its callables,
 * while `_` and `__` names belong to modules. An api node keeps its members as its own properties, beside the
 * framework's `___` / `____` members, so every name with that prefix is reserved, not only the ones listed by name.
 *
 * Fixture `api_test_framework_member_exports` (each folder below is a base; `lib/capture.mjs` beside them records
 * every call into the fixture's functions):
 * ```
 * export/probe/method.mjs   export function ___createChildWrapper, export const zeta
 * nested/probe/holder.mjs   export const box = { ___createChildWrapper() {}, zeta }
 * runtime/probe/writer.mjs  plant(name): self.probe.writer.target[name] = fn, then a new member
 * ```
 * - A top-level export with such a name is refused at load, as the listed names are.
 * - A member of an exported value with such a name is not adopted, so the node never holds it.
 * - A write of such a name through `self` is absorbed, as for the listed names, and so is a definition of it.
 * - An `api.add` mount path holding such a segment is refused.
 *
 * In every case the fixture's function is never called.
 *
 * @module tests/vitests/suites/security/framework-member-names
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const FIXTURE = new URL("../../../../api_tests/api_test_framework_member_exports/", import.meta.url).pathname;

describe.each(["eager", "lazy"])("Framework member names > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * A node, loaded first in lazy mode.
	 * @param {object} node - The node.
	 * @returns {Promise<object>} The node.
	 */
	const loaded = async (node) => (mode === "lazy" ? await node : node);

	it("refuses a top-level export with the prefix at load", async () => {
		await expect(async () => {
			api = await slothlet({ mode, base: `${FIXTURE}export`, silent: true });
			// Lazy loads the file at first touch; eager refuses at boot.
			await api.probe.method.zeta;
		}).rejects.toMatchObject({ code: "MODULE_RESERVED_EXPORT" });
	});

	it("does not adopt a nested member with the prefix", async () => {
		api = await slothlet({ mode, base: `${FIXTURE}nested` });
		const holder = await loaded(api.probe.holder);
		const box = await loaded(holder.box);

		expect(Object.keys(box)).toEqual(["zeta"]);
		expect(box.___createChildWrapper).toBeUndefined();
		expect(box.zeta.leaf).toBe(1);
		expect(await holder.calls()).toEqual([]);
	});

	it("absorbs a write of a name with the prefix through self", async () => {
		api = await slothlet({ mode, base: `${FIXTURE}runtime` });
		const writer = await loaded(api.probe.writer);

		expect(await writer.plant("___createChildWrapper")).toBe("assigned");
		const target = await loaded(writer.target);
		expect(Object.keys(target).sort()).toEqual(["first", "later"]);
		expect(target.___createChildWrapper).toBeUndefined();
		expect(await writer.calls()).toEqual([]);
	});

	it("absorbs a definition of a name with the prefix, and refuses one that would fix it", async () => {
		api = await slothlet({ mode, base: `${FIXTURE}runtime` });
		const writer = await loaded(api.probe.writer);
		const target = await loaded(writer.target);
		const keys = Object.keys(target).sort();

		expect(Reflect.defineProperty(target, "___createChildWrapper", { value: () => 1, configurable: true, writable: true })).toBe(true);
		expect(Reflect.defineProperty(target, "____state", { value: 1, enumerable: true })).toBe(true);
		// A definition that fixes the member could not be reported as made on a target that does not hold it.
		expect(Reflect.defineProperty(target, "___createChildWrapper", { value: 1, configurable: false })).toBe(false);
		expect(target.___createChildWrapper).toBeUndefined();
		expect(target.____state).toBeUndefined();
		expect(Object.keys(target).sort()).toEqual(keys);
		expect(await writer.calls()).toEqual([]);
	});

	it("refuses an api.add mount path with a segment carrying the prefix", async () => {
		api = await slothlet({ mode, base: `${FIXTURE}runtime` });

		await expect(api.slothlet.api.add("probe.___createChildWrapper", `${FIXTURE}nested/probe`)).rejects.toMatchObject({
			code: "API_PATH_INVALID"
		});
		await expect(api.slothlet.api.add("probe.____state", `${FIXTURE}nested/probe`)).rejects.toMatchObject({
			code: "API_PATH_INVALID"
		});
	});
});
