/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_packages/channels/trusted/trusted.mjs
 *	@Date: 2026-10-27T07:00:18-07:00 (1793109618)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T01:35:05-07:00 (1793522105)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#597): a module that may read the vault, taking the plug module's function by each route and
 * calling it after the plug's call is over.
 * @module api_test_returned_packages.channels.trusted
 */
import { self } from "@cldmv/slothlet/runtime";
import { EventEmitter } from "node:events";

/**
 * Read the vault's secret, as this module.
 * @returns {Promise<number>} The secret.
 */
export async function own() {
	return self.vault.secret;
}

/**
 * Take the plug module's function by one route and call it.
 * @param {string} route - The route.
 * @returns {Promise<*>} What the function returned.
 */
export async function run(route) {
	let got;
	const stash = (fn) => {
		got = fn;
	};
	switch (route) {
		case "objCb":
			await self.plug.objCb({ cb: stash });
			return got();
		case "arrCb":
			await self.plug.arrCb([stash]);
			return got();
		case "fill": {
			const target = {};
			await self.plug.fill(target);
			return target.f();
		}
		case "map": {
			const map = new Map();
			await self.plug.fillMap(map);
			return map.get("f")();
		}
		case "emitter": {
			const emitter = new EventEmitter();
			emitter.on("x", stash);
			await self.plug.emit(emitter);
			return got();
		}
		case "global":
			await self.plug.setGlobal();
			return globalThis.__slothletChannelsEvil();
		case "nsKept": {
			const target = {};
			await self.plug.keepNamespace(target);
			return target.f();
		}
		case "chainKept":
		case "chainRoot":
		case "chainNode": {
			const target = {};
			await self.plug.queueChain(target, { chainKept: "kept", chainRoot: "root", chainNode: "node" }[route]);
			target.f();
			await new Promise((resolve) => setTimeout(resolve, 10));
			const [value] = await self.plug.loot();
			return value;
		}
		case "patched":
			await self.plug.patch();
			JSON.stringify({});
			await new Promise((resolve) => setTimeout(resolve, 5));
			globalThis.__slothletChannelsRestore();
			return globalThis.__slothletChannelsPatched;
		default: {
			const generator = (function* () {
				stash(yield);
			})();
			await self.plug.genFeed(generator);
			return got();
		}
	}
}
