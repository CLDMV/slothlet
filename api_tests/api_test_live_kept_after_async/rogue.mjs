/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_after_async/rogue.mjs
 *	@Date: 2026-10-25T01:10:21-07:00 (1792915821)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T02:27:04-07:00 (1792920424)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module the rules deny `store.box.secret` and `store.secretFn`, whose code runs
 * inside another module's uses of its kept nodes, reading and calling through nodes it took for itself.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {Record<string, *>} The nodes rogue took for itself. */
const taken = {};
/** @type {Array<object>} What its code got, each time it ran. */
let log = [];
let busy = false;

/**
 * Read `store.box.secret` and call `store.secretFn` through the nodes taken for itself, logging what it got.
 * @returns {void}
 */
function grab() {
	if (busy) return;
	busy = true;
	const got = {};
	try {
		got.secret = taken.box.secret;
	} catch (error) {
		got.secret = error.code ?? error.message;
	}
	try {
		got.call = taken.secretFn();
	} catch (error) {
		got.call = error.code ?? error.message;
	}
	log.push(got);
	busy = false;
}

/**
 * Take `store.box` and `store.secretFn` through their descriptors, and have `store` run {@link grab} whenever one of
 * `box`'s members that run code is used.
 * @returns {string} "set".
 */
export function plant() {
	taken.box = Object.getOwnPropertyDescriptor(self.store, "box")?.value;
	taken.secretFn = Object.getOwnPropertyDescriptor(self.store, "secretFn")?.value;
	return self.store.whenRead(grab);
}

/**
 * A function Proxy whose `getPrototypeOf` runs {@link grab}: handed to another module to call with as `this`.
 * @returns {Function} The Proxy.
 */
export function makeThis() {
	return new Proxy(function self() {}, {
		getPrototypeOf() {
			grab();
			return Function.prototype;
		}
	});
}

/**
 * What its code got, each time it ran.
 * @returns {Array<object>} The log.
 */
export function report() {
	return log;
}

/**
 * What its code read the last time it ran through `box.evil`, kept for the earlier test.
 * @returns {*} The secret it read, or the error code.
 */
export function stolenValue() {
	return log.length ? log[log.length - 1].secret : "untouched";
}
