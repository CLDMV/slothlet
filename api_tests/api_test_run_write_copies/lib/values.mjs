/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_run_write_copies/lib/values.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T00:00:00-08:00 (1795248000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The values the `data` module exports, made fresh on each call: the module's own set, and a plain-JS
 * twin of it that the tests run the same code on to get the expected answers.
 */
import { EventEmitter } from "node:events";

/**
 * A class whose instances the module exports.
 */
export class Box {
	constructor() {
		this.size = 1;
	}
	label() {
		return `box:${this.size}`;
	}
}

/**
 * Make a fresh set of the module's values.
 * @returns {object} The values.
 */
export function makeValues() {
	function fn(a, b) {
		return a + b;
	}
	fn.extra = "e";
	return {
		cfg: { n: 1, nested: { a: 1 }, list: [1, 2] },
		obj: {
			x: 7,
			method() {
				return this.x;
			},
			get twice() {
				return this.x * 2;
			},
			bump() {
				this.x++;
				return this.x;
			}
		},
		obj2: { a: 1 },
		list2: [1, 2],
		frozenCfg: Object.freeze({ a: 1 }),
		inst: new Box(),
		bus: new EventEmitter(),
		fn
	};
}

/**
 * What the module's own values hold, as plain data.
 * @param {object} values - The values.
 * @returns {object} Their state.
 */
export function stateOf(values) {
	return {
		cfg: JSON.stringify(values.cfg),
		cfgKeys: Object.keys(values.cfg).join(","),
		nestedKeys: Object.keys(values.cfg.nested).join(","),
		obj: JSON.stringify(values.obj),
		obj2Proto: Object.getPrototypeOf(values.obj2) === Object.prototype,
		list2: JSON.stringify(values.list2),
		instField: values.inst.field,
		instSize: values.inst.size,
		busFlag: values.bus.flag,
		fnExtra: values.fn.extra
	};
}
