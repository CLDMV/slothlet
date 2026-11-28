/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_run_write_copies/api/data/data.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:40-08:00 (1795868980)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module exporting plain objects, arrays, a frozen object, a class instance, an emitter and a function,
 * and a function reporting what its own values hold.
 */
import { makeValues, stateOf } from "../../lib/values.mjs";

const values = makeValues();

export const cfg = values.cfg;
export const obj = values.obj;
export const obj2 = values.obj2;
export const list2 = values.list2;
export const frozenCfg = values.frozenCfg;
export const inst = values.inst;
export const bus = values.bus;
export const fn = values.fn;

/**
 * What the module's own values hold now.
 * @returns {object} Their state.
 */
export function raw() {
	return stateOf(values);
}
