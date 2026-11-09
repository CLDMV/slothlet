/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_definer_rule/bag/bag.mjs
 *	@Date: 2026-11-08T19:11:03-08:00 (1794193863)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T19:17:26-08:00 (1794194246)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the definer rule (#726): code `bag` hands out and code handed into `bag`'s calls. Rules allow
 * `bag.**` to read the vault; nothing allows `supplier` or `reader` to.
 * @module api_test_definer_rule.bag
 */
import { self } from "@cldmv/slothlet/runtime";

/** A closure: its definer is `bag.make`. */
export const make = () => () => self.vault.get();
/** A function inside returned data: its definer is `bag.box`. */
export const box = () => ({ run: () => self.vault.get() });
/** Converts what it is handed, running the caller's `toString`. */
export const echo = (v) => String(v);
/** Runs the callback it is handed. */
export const call = (fn) => fn();
/** Hands back what it is handed. */
export const same = (v) => v;
/** A class instance whose method reads the vault. */
export const inst = () =>
	new (class Client {
		run() {
			return self.vault.get();
		}
	})();
/** The same closure every time. */
const kept = () => self.vault.get();
export const keptFn = () => kept;
/** A closure built by the `Function` constructor: its frames are evaluated code, which names no file. */
export const evaled = () => new Function("api", "return () => api.vault.get();")(self);
/** Bag's code running a function bag made, by a local call. */
export async function own() {
	const f = make();
	return await f();
}
/** Bag's code running a function bag made, fetched through `self`. */
export async function ownViaSelf() {
	const f = await self.bag.make();
	return await f();
}
/** Bag's code running a function the supplier defined, fetched from `shared`: its definer is the supplier. */
export async function runKept() {
	const fn = await self.shared.take();
	return await fn();
}
