/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/wrapper-member-names.test.vitest.mjs
 *	@Date: 2026-11-25T14:25:56-08:00 (1795645556)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:07:36-08:00 (1795651656)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module member may take any name the wrapper's class chain carries without the framework's prefix,
 * and the wrapper keeps using its own state.
 *
 * @description
 * An api node keeps a module's members as its own properties. The wrapper's class chain also carries members without
 * the framework's `___` / `____` prefix (`slothlet`, `clock`, `instanceID`, `SlothletError`, `SlothletWarning`,
 * `createProxy`, `emitImplDiagnostic`, `emitImplCollision`, `_applyNewImpl`). Those are legal api names (a nested
 * `slothlet` member is one, #176), so a module's member of that name sits on the node, and the framework must never
 * look its own state up by one of them.
 *
 * Fixture `api_test_wrapper_member_names` (each folder below is a base; `lib/capture.mjs` beside them makes the
 * members and records every call into them, with whether it was handed something reaching the instance):
 * ```
 * top/probe/members.mjs     export const slothlet = fn, clock = fn, …; zeta; touch()
 * nested/probe/holder.mjs   export const box = { slothlet: fn, clock: fn, …, zeta }; touch()
 * runtime/probe/writer.mjs  plant(): self.probe.writer.target[name] = fn for every name, then a new member
 * ```
 * For each, in every mode, runtime and permission setting:
 * - working the node (reads, listing, writes and removals through `self`, an `api.add`) calls none of the members;
 * - each member reads as an ordinary member and answers its own value when called, by the host and by the module's own
 *   code through `self` (with permissions on, a `_` member is module-private, so only the latter);
 * - no call into a member is handed the instance or a wrapper's state.
 *
 * @module tests/vitests/suites/unified-wrapper/wrapper-member-names
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const FIXTURE = new URL("../../../../api_tests/api_test_wrapper_member_names/", import.meta.url).pathname;

const NAMES = [
	"slothlet",
	"SlothletError",
	"SlothletWarning",
	"clock",
	"instanceID",
	"createProxy",
	"emitImplDiagnostic",
	"emitImplCollision",
	"_applyNewImpl"
];

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const permissions of [false, true]) CONFIGS.push({ mode, runtime, permissions });
	}
}

describe.each(CONFIGS)("Wrapper member names > $mode / $runtime / permissions $permissions", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build an instance on one of the fixture's bases.
	 * @param {string} base - The base folder's name.
	 * @returns {Promise<object>} The api.
	 */
	const build = (base) => slothlet({ mode, runtime, base: `${FIXTURE}${base}`, silent: true, ...(permissions ? { permissions: {} } : {}) });

	/**
	 * A node, loaded first in lazy mode.
	 * @param {object} node - The node.
	 * @returns {Promise<object>} The node.
	 */
	const loaded = async (node) => (mode === "lazy" ? await node : node);

	/**
	 * The names the host's listing of a node shows: with permissions on, a `_` member is module-private and left out.
	 * @type {string[]}
	 */
	const hostListed = permissions ? NAMES.filter((name) => !name.startsWith("_")) : NAMES;

	/**
	 * Check a node holding every name: none was called while the node was worked, each reads as a member and answers its
	 * own value (to the host, and to the module's own code through `self`), and no call was handed the instance. With
	 * permissions on, a `_` member is module-private: the host is refused it, the module's own code reads it.
	 * @param {object} node - The node holding the members.
	 * @param {object} module - The node whose `calls` / `reset` / `callAll` read the record and call through `self`.
	 * @param {string} owner - The owner the fixture records.
	 * @returns {Promise<void>}
	 */
	async function expectOrdinaryMembers(node, module, owner) {
		expect(await module.calls()).toEqual([]);
		const hostNames = permissions ? NAMES.filter((name) => !name.startsWith("_")) : NAMES;
		expect(Object.keys(node)).toEqual(expect.arrayContaining(hostNames));
		for (const name of hostNames) {
			expect([name, name in node, typeof node[name]]).toEqual([name, true, "function"]);
		}
		for (const name of hostNames) {
			expect([name, await node[name]("arg")]).toEqual([name, `${owner}:${name}`]);
		}
		for (const name of NAMES) {
			if (!hostNames.includes(name)) await expect(async () => node[name]("arg")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
		}
		expect(await module.callAll()).toEqual(NAMES.map((name) => `${owner}:${name}`));
		expect(await module.calls()).toEqual([...hostNames, ...NAMES].map((name) => ({ at: `${owner}.${name}`, leaked: false })));
	}

	it("keeps top-level exports named like the wrapper's members as ordinary members", async () => {
		api = await build("top");
		const node = await loaded(api.probe.members);
		await node.reset();

		expect(await node.touch()).toBe(3);
		expect(node.zeta.leaf).toBe(1);
		await api.slothlet.api.add("extra", `${FIXTURE}nested/probe`);
		expect((await loaded(api.extra.holder)).box.zeta.leaf).toBe(1);
		await node.reset();
		expect(await node.touch()).toBe(3);

		await expectOrdinaryMembers(node, node, "top");
	});

	it("keeps members of an exported value named like the wrapper's members as ordinary members", async () => {
		api = await build("nested");
		const holder = await loaded(api.probe.holder);
		const box = await loaded(holder.box);
		await holder.reset();

		expect(await holder.touch()).toBe(3);
		expect(box.zeta.leaf).toBe(1);
		expect(Object.keys(box)).toEqual(expect.arrayContaining([...hostListed, "zeta"]));

		await expectOrdinaryMembers(box, holder, "nested");
	});

	it("keeps members written through self under those names as ordinary members", async () => {
		api = await build("runtime");
		const writer = await loaded(api.probe.writer);
		await writer.reset();

		expect(await writer.plant()).toBe("assigned:3");
		const target = await loaded(writer.target);
		expect(target.first.leaf).toBe(1);
		expect(target.later.nested.leaf).toBe(2);
		expect(Object.keys(target)).toEqual(expect.arrayContaining([...hostListed, "first", "later"]));

		await expectOrdinaryMembers(target, writer, "runtime");
	});
});
