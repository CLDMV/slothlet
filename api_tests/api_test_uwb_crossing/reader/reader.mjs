/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_crossing/reader/reader.mjs
 *	@Date: 2026-11-25T01:26:37-08:00 (1795598797)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:01-08:00 (1795869001)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that uses another module's values through `self`.
 */
import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run `fn`, answering what it returned or the error it threw as `"<name>: <message>"`.
 * @param {function(): *} fn - What to run.
 * @returns {*} The result or the error's text.
 */
function attempt(fn) {
	try {
		return fn();
	} catch (error) {
		return error?.code ? `${error.name}: ${error.code}` : `${error?.name}`;
	}
}

/**
 * Construct the owner's class without its argument.
 * @returns {string} The error's text.
 */
export function constructBad() {
	const Cls = self.owner.strict();
	return attempt(() => new Cls());
}

/**
 * Step the owner's failing async generator.
 * @returns {Promise<string>} The rejection's text.
 */
export async function stepFailing() {
	try {
		await self.owner.failing().next();
		return "resolved";
	} catch (error) {
		return `${error?.name}: ${error?.message}`;
	}
}

/**
 * Change the owner's object every way.
 * @returns {object} What each change did.
 */
export function changeObject() {
	const target = self.owner.withAccessor();
	const mine = () => "mine";
	const out = {};
	out.deleteAccessor = attempt(() => delete target.computed);
	out.storeOwn = attempt(() => {
		target.slot = mine;
		target.slot = () => "again";
		return target.slot();
	});
	out.defineAccessor = attempt(() => {
		Object.defineProperty(target, "made", { get: () => 7, set: () => {}, configurable: true, enumerable: true });
		return target.made;
	});
	out.sameProto = attempt(() => Object.setPrototypeOf(target, Object.getPrototypeOf(target)) === target);
	return out;
}

/**
 * Use the owner's closed and frozen objects.
 * @returns {object} What each use gave.
 */
export function useClosed() {
	const target = self.owner.closed();
	const out = {};
	out.keysBefore = Reflect.ownKeys(target);
	out.deleted = delete target.b;
	out.keysAfter = Reflect.ownKeys(target);
	out.a = target.a;
	const frozen = self.owner.frozen();
	out.frozenProto = Object.getPrototypeOf(frozen) === Object.prototype;
	out.frozenIsFrozen = Object.isFrozen(frozen);
	out.frozenProtoAgain = Object.getPrototypeOf(frozen) === Object.prototype;
	out.setOther = attempt(() => Object.setPrototypeOf(frozen, null));
	out.inspectOther = attempt(() => {
		const hook = frozen[util.inspect.custom];
		return typeof hook === "function" ? hook.call({ other: true }, 2, {}) : "no hook";
	});
	return out;
}

/**
 * Close the owner's function to new members.
 * @returns {string} What happened.
 */
export function closeFunction() {
	const f = self.owner.fn();
	return attempt(() => String(Object.isExtensible(Object.preventExtensions(f))));
}
