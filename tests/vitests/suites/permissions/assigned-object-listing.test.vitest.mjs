/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/assigned-object-listing.test.vitest.mjs
 *	@Date: 2026-11-16T01:29:19-08:00 (1794821359)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:32-08:00 (1794882572)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An object the host assigns to an api node is listed to a module as an object member of the module's data
 * is: left out when the module may read nothing beneath it, on a namespace as on a function node (#826).
 * @description
 * Plain JS lists every member; a module is listed what it may read. An object member the rules leave a module nothing
 * of is left out of `Object.keys`, `Reflect.ownKeys` and `for…in`, and one holding a leaf the module may read is listed.
 * A function node did this for an object the host assigned to it, while a file or folder namespace listed it anyway.
 * @module tests/vitests/suites/permissions/assigned-object-listing
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_node_set_prototype/host");
const LISTER = resolve("api_tests/api_test_closed_listing/lister");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const configs = MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime })));

/** The nodes the host assigns to: a file's namespace, a folder's namespace, a function, a function beside named exports. */
const PATHS = ["ev", "sub", "leaf.only", "sub.lay"];

describe.each(configs)("an object the host assigns to a node, listed by a module (#826) > $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Build the instance with the lister, under rules letting it read one leaf of `ownPartly` and of `ownDeep`.
	 * @param {string} path - The node assigned to.
	 * @returns {Promise<object>} The node.
	 */
	const build = async (path) => {
		const rules = [
			{ caller: "lister.**", target: `${path}.ownPartly.a`, effect: "allow" },
			{ caller: "lister.**", target: `${path}.ownDeep.open`, effect: "allow" }
		];
		api = await slothlet({ base: FIXTURE, silent: true, mode, runtime, permissions: { policy: "deny", rules } });
		await api.slothlet.api.add("lister", LISTER, { id: "lister" });
		await api.lister;
		const node = path.split(".").reduce((holder, key) => holder[key], api);
		await node;
		return node;
	};

	it.each(PATHS)("%s: an object the module may read nothing beneath is left out, one it may read a leaf of is listed", async (path) => {
		const node = await build(path);
		node.ownNothing = { a: 1 };
		node.ownPartly = { a: 1, b: 2 };
		const names = ["ownNothing", "ownPartly"];
		// Plain JS lists both; the module may read nothing beneath `ownNothing`.
		expect(await api.lister.listing(path, names)).toEqual({
			keys: ["ownPartly"],
			forIn: ["ownPartly"],
			ownKeys: ["ownPartly"],
			closed: [true, false, false]
		});
		// The host lists both.
		expect(Object.keys(node).filter((key) => names.includes(key))).toEqual(names);
	});

	it.each(PATHS)("%s: an object nested in an assigned object is listed by the same rule", async (path) => {
		const node = await build(path);
		node.ownDeep = { inner: { a: 1 }, open: 1 };
		expect(await api.lister.listing(`${path}.ownDeep`, ["inner", "open"])).toEqual({
			keys: ["open"],
			forIn: ["open"],
			ownKeys: ["open"],
			closed: [true, false, false]
		});
	});
});
