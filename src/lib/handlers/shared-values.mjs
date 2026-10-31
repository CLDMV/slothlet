/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/shared-values.mjs
 *	@Date: 2026-10-30T12:52:45-07:00 (1793389965)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T23:03:45-07:00 (1793426625)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Values made by no module (#597): a `node:` built-in's exports and slothlet's runtime, recorded by
 * slothlet itself as it loads them. A module handing one on hands out the value itself, not a stand-in that runs as
 * the module. A package's exports are never recorded: anyone can put code under `node_modules`.
 *
 * The record is this file's own and is reached only through the functions here, which modules cannot import (the
 * file sits under `#handlers`).
 * @module @cldmv/slothlet/handlers/shared-values
 * @internal
 */

/**
 * Node's Proxy test, or none outside Node: a Proxy is never recorded, so recording runs none of its traps.
 * @type {function(*): boolean}
 * @private
 */
const IS_PROXY = globalThis.process?.getBuiltinModule?.("node:util")?.types?.isProxy ?? (() => false);

/**
 * How many own properties, across everything a value reaches, are read when it is recorded; past that the rest is not
 * recorded, which only keeps what it reaches a module's.
 * @type {number}
 * @private
 */
const RECORD_BUDGET = 20000;

/**
 * The realm's own prototypes, where recording stops: what every object reaches is the language's.
 * @type {Set<object>}
 * @private
 */
const LANGUAGE_PROTOTYPES = new Set([Object.prototype, Function.prototype, Array.prototype]);

/**
 * The values recorded.
 * @type {WeakSet<object>}
 * @private
 */
const RECORDED = new WeakSet();

/**
 * Record a value made by no module, and everything it reaches through own members, accessors and prototypes, read by
 * descriptor so no getter runs, up to {@link RECORD_BUDGET} properties. A Proxy is passed over, and the language's own
 * prototypes end the walk.
 * @param {*} value - The value.
 * @returns {void}
 * @internal
 * @example
 * recordSharedExports(globalThis.process.getBuiltinModule("node:events"));
 */
export function recordSharedExports(value) {
	let budget = RECORD_BUDGET;
	const pending = [value];
	while (pending.length && budget > 0) {
		const member = pending.pop();
		if (member === null || (typeof member !== "object" && typeof member !== "function")) continue;
		if (RECORDED.has(member) || LANGUAGE_PROTOTYPES.has(member) || IS_PROXY(member)) continue;
		RECORDED.add(member);
		try {
			const keys = Reflect.ownKeys(member);
			budget -= keys.length;
			for (const key of keys) {
				const descriptor = Reflect.getOwnPropertyDescriptor(member, key);
				if (!descriptor) continue;
				if ("value" in descriptor) pending.push(descriptor.value);
				else pending.push(descriptor.get, descriptor.set);
			}
			pending.push(Reflect.getPrototypeOf(member));
		} catch {
			// What refuses to be described records nothing of what it holds.
		}
	}
}

/**
 * Whether a value was recorded as made by no module (see {@link recordSharedExports}).
 * @param {*} value - Candidate value.
 * @returns {boolean} True when recorded.
 * @internal
 * @example
 * isSharedExport(EventEmitter); // true
 */
export function isSharedExport(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	return RECORDED.has(value);
}
