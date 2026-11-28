/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/shared-values.mjs
 *	@Date: 2026-10-30T12:52:45-07:00 (1793389965)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:10-08:00 (1794874570)
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
import {
	ArrayMethods,
	Arrays,
	Functions,
	listPush,
	Objects,
	Processes,
	Reflect,
	setFrom,
	SetMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

const IS_PROXY = Processes.getBuiltinModule?.("node:util")?.types?.isProxy ?? (() => false);

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
const LANGUAGE_PROTOTYPES = setFrom([Objects.prototype, Functions.prototype, Arrays.prototype]);

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
function recordSharedExports(value) {
	let budget = RECORD_BUDGET;
	const pending = [value];
	while (pending.length && budget > 0) {
		const member = ArrayMethods.pop(pending);
		if (member === null || (typeof member !== "object" && typeof member !== "function")) continue;
		if (WeakSetMethods.has(RECORDED, member) || SetMethods.has(LANGUAGE_PROTOTYPES, member) || IS_PROXY(member)) continue;
		WeakSetMethods.add(RECORDED, member);
		try {
			const keys = Reflect.ownKeys(member);
			budget -= keys.length;
			for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				const descriptor = Reflect.getOwnPropertyDescriptor(member, key);
				if (!descriptor) continue;
				if ("value" in descriptor) listPush(pending, descriptor.value);
				else listPush(pending, descriptor.get, descriptor.set);
			}
			listPush(pending, Reflect.getPrototypeOf(member));
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
	return WeakSetMethods.has(RECORDED, value);
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (
		!mayTakeInternals(consumer, [
			"lib/handlers/unified-wrapper",
			"lib/handlers/unified-wrapper/values",
			"lib/helpers/eventemitter-context",
			"lib/runtime/runtime"
		])
	)
		throw ownBindingsRefusal("lib/handlers/shared-values", import.meta.url);
	return { recordSharedExports };
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof recordSharedExports} */
const guarded_recordSharedExports = guardInternal(recordSharedExports, "recordSharedExports", import.meta.url);
export { guarded_recordSharedExports as recordSharedExports };
