/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-lazy-held-writes.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:31-08:00 (1795869151)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A write through a reference to a node taken before its folder loaded is held to the same rules, and
 * has the same effect, as one made once it has (lazy == eager).
 *
 * @description
 * The host assigns data to a folder's namespace (`sub`) and to a function beside named exports (`sub.lay`) through a
 * reference it took before the folder loaded. The writer module then writes to those nodes through `self`, straight
 * and through references it took and held, waited for or not: assigned, defined and deleted members, members the host
 * wrote and new ones, with every module allowed everything (the nodes are not the writer's) and with a deny on writing
 * them. Each answer is the eager one.
 *
 * @module tests/vitests/suites/permissions/permissions-lazy-held-writes
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests");
const FIXTURE = path.join(ROOT, "api_test_node_set_prototype/host");
const WRITER = path.join(ROOT, "api_test_held_writes/writer");

const OPEN = [{ caller: "**", target: "**", effect: "allow" }];
const DENY_WRITE = [...OPEN, { caller: "writer.**", target: "sub.**:write", effect: "deny" }];

/**
 * The node at a dotted path of the api.
 * @param {object} api - The api.
 * @param {string} dotted - The path.
 * @returns {*} The node.
 */
const at = (api, dotted) => dotted.split(".").reduce((holder, key) => holder[key], api);

describe.each(getMatrixConfigs())("Permissions > writes through a held reference to a node, lazy == eager > $name", ({ config }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Build the instance with the writer module, nothing of `sub` loaded in lazy mode.
		 * @param {Array<object>} rules - The rules.
		 * @returns {Promise<object>} The api.
		 */
		const build = async (rules) => {
			if (api) await api.shutdown();
			api = await slothlet({ ...config, silent: true, base: FIXTURE, permissions: { policy: "deny", rules, caller: { attribution } } });
			await api.slothlet.api.add("writer", WRITER, { id: "writer" });
			return api;
		};

		describe.each(["sub", "sub.lay"])("%s", (node) => {
			it.each([true, false])("data the host wrote through a held reference stays the host's (awaited first: %s)", async (wait) => {
				await build(OPEN);
				const held = at(api, node);
				if (wait) await held;
				held.hostData = { a: 1 };
				await at(api, node);
				expect(Object.keys(at(api, node))).toContain("hostData");
				expect(await api.writer.w.write(node, "hostData")).toBe("LOOSE_SET_NOT_OWNED");
				expect(await api.writer.w.heldWrite(node, "hostData", "set", true)).toBe("LOOSE_SET_NOT_OWNED");
				expect(await api.writer.w.heldWrite(node, "hostData", "set", false)).toBe("LOOSE_SET_NOT_OWNED");
				expect(at(api, node).hostData).toEqual({ a: 1 });
			});

			it.each([
				["set", true],
				["set", false],
				["define", true],
				["define", false],
				["delete", true],
				["delete", false]
			])("a module's %s through a held reference (awaited first: %s) is refused as it is through self", async (how, wait) => {
				await build(OPEN);
				expect(await api.writer.w.heldWrite(node, "planted", how, wait)).toBe("LOOSE_SET_NOT_OWNED");
				await build(DENY_WRITE);
				expect(await api.writer.w.heldWrite(node, "planted", how, wait)).toBe("PERMISSION_DENIED");
				expect(Object.keys(await at(api, node))).not.toContain("planted");
			});
		});
	});
});
