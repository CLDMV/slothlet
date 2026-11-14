/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stack_settings/api/settler/settler.mjs
 *	@Date: 2026-11-14T12:00:00-08:00 (1794686400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T12:00:00-08:00 (1794686400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module denied the vault that changes the global `Error` or its stack settings around its own reads
 * of the vault (and of `only`), each change put back right after: `change(name)` installs one and returns what undoes it.
 * The `fixed` changes cannot be undone and are only used in a process of their own.
 * @module api_test_stack_settings.settler
 * @memberof module:api_test_stack_settings
 */
import { self } from "@cldmv/slothlet/runtime";

/** The realm's own `Error`, whatever the global holds. */
const RealmError = Object.getPrototypeOf(TypeError);
const GOOD = new URL("../good/good.mjs", import.meta.url).href;
const mine = (site) => String(site.getFileName?.() ?? "").includes("/settler/");
const ownSites = (hook) =>
	hook
		? (error, sites) =>
				hook(
					error,
					sites.filter((site) => !mine(site))
				)
		: undefined;

/**
 * Keep whatever is assigned to `prepareStackTrace` on `on`, and report `wrap` of it when read.
 * @param {function(Function|undefined): unknown} wrap - What the property reads as, from what was assigned.
 * @param {object} [on=RealmError] - Where the accessor goes.
 * @returns {{undo: function(): void, assigned: function(): (Function|undefined)}} Undo, and what was assigned.
 */
function keepAssigned(wrap, on = RealmError) {
	let hook;
	const own = Object.getOwnPropertyDescriptor(on, "prepareStackTrace");
	Object.defineProperty(on, "prepareStackTrace", {
		configurable: true,
		get: () => wrap(hook),
		set: (value) => {
			hook = value;
		}
	});
	return {
		undo: () => {
			if (own) Object.defineProperty(on, "prepareStackTrace", own);
			else delete on.prepareStackTrace;
		},
		assigned: () => hook
	};
}

/**
 * Put a stand-in on the global `Error`, made from what slothlet assigns to the realm's `prepareStackTrace`.
 * @param {function(function(): (Function|undefined)): unknown} make - Makes the stand-in.
 * @returns {function(): void} Undo.
 */
function standIn(make) {
	const kept = keepAssigned(() => undefined);
	const back = globalError(make(kept.assigned));
	return () => {
		back();
		kept.undo();
	};
}

/**
 * Put a value on the global `Error` for a while.
 * @param {unknown} value - The stand-in.
 * @returns {function(): void} Undo.
 */
function globalError(value) {
	const saved = Object.getOwnPropertyDescriptor(globalThis, "Error");
	Object.defineProperty(globalThis, "Error", { ...saved, value });
	return () => Object.defineProperty(globalThis, "Error", saved);
}

/**
 * Change `Error.stackTraceLimit` for a while.
 * @param {PropertyDescriptor} descriptor - The new property.
 * @returns {function(): void} Undo.
 */
function limit(descriptor) {
	const saved = Object.getOwnPropertyDescriptor(RealmError, "stackTraceLimit");
	Object.defineProperty(RealmError, "stackTraceLimit", { configurable: true, ...descriptor });
	return () => Object.defineProperty(RealmError, "stackTraceLimit", saved);
}

const CHANGES = {
	none: () => () => {},
	// The global `Error` replaced by a function whose own formatter passes this module's frames over.
	globalFunction: () =>
		standIn((assigned) => {
			const stand = function Error(...args) {
				return new RealmError(...args);
			};
			Object.defineProperty(stand, "prepareStackTrace", { get: () => ownSites(assigned()) });
			return stand;
		}),
	// The global `Error` replaced by one whose formatter returns nothing.
	globalEmpty() {
		const stand = function Error() {};
		stand.prepareStackTrace = () => "";
		return globalError(stand);
	},
	// The global `Error` replaced by one whose formatter names `good`'s file.
	globalText() {
		const stand = function Error() {};
		stand.prepareStackTrace = () => `Error\n    at readOnly (${GOOD}:3:14)`;
		return globalError(stand);
	},
	// The global `Error` replaced by a Proxy of the realm's.
	globalProxy: () =>
		standIn(
			(assigned) =>
				new Proxy(RealmError, {
					get: (target, key, receiver) => (key === "prepareStackTrace" ? ownSites(assigned()) : Reflect.get(target, key, receiver))
				})
		),
	// The global `Error` replaced by a subclass with a formatter of its own.
	globalSubclass: () =>
		standIn((assigned) => {
			class Stand extends RealmError {}
			Object.defineProperty(Stand, "prepareStackTrace", { get: () => ownSites(assigned()) });
			return Stand;
		}),
	// `prepareStackTrace` an accessor: what is assigned is kept, and reads as a formatter passing this module's frames over.
	accessorOwnSites: () => keepAssigned(ownSites).undo,
	// The same, reversing the frames.
	accessorReversed: () => keepAssigned((hook) => (hook ? (error, sites) => hook(error, [...sites].reverse()) : undefined)).undo,
	// The same, with an assignment that does nothing and a formatter that returns nothing.
	accessorIgnored: () => keepAssigned(() => () => "").undo,
	// The same, answering differently on every other read.
	accessorAlternating() {
		let reads = 0;
		return keepAssigned((hook) => (reads++ % 2 ? ownSites(hook) : hook)).undo;
	},
	// The same, handing the formatter stand-ins for this module's call sites that name `good`'s file.
	accessorStandIns() {
		const lying = (site) =>
			new Proxy(site, {
				get(target, key) {
					const value = Reflect.get(target, key);
					if (typeof value !== "function") return value;
					if (mine(target) && (key === "getFileName" || key === "getScriptNameOrSourceURL")) return () => GOOD;
					return value.bind(target);
				}
			});
		return keepAssigned((hook) => (hook ? (error, sites) => hook(error, sites.map(lying)) : undefined)).undo;
	},
	// `Error`'s own `prepareStackTrace` removed, and an accessor on `Function.prototype` in its place.
	inheritedAccessor() {
		const own = Object.getOwnPropertyDescriptor(RealmError, "prepareStackTrace");
		delete RealmError.prepareStackTrace;
		const { undo } = keepAssigned(ownSites, Function.prototype);
		return () => {
			undo();
			if (own) Object.defineProperty(RealmError, "prepareStackTrace", own);
		};
	},
	// A formatter that throws, read through an accessor.
	accessorThrowing() {
		return keepAssigned(() => () => {
			throw new RealmError("formatter");
		}).undo;
	},
	// `Error.stackTraceLimit` read-only at 0, read-only at 1, an accessor.
	limitZero: () => limit({ writable: false, value: 0 }),
	limitOne: () => limit({ writable: false, value: 1 }),
	limitAccessor: () => limit({ get: () => 2, set() {} }),
	// `prepareStackTrace` read-only.
	prepareReadOnly() {
		const own = Object.getOwnPropertyDescriptor(RealmError, "prepareStackTrace");
		Object.defineProperty(RealmError, "prepareStackTrace", { configurable: true, writable: false, value: () => "" });
		return () => Object.defineProperty(RealmError, "prepareStackTrace", own);
	},
	// `Error.captureStackTrace` replaced.
	captureReplaced() {
		const saved = RealmError.captureStackTrace;
		RealmError.captureStackTrace = (target) => {
			target.stack = "";
		};
		return () => {
			RealmError.captureStackTrace = saved;
		};
	},
	// Fixed in place: nothing puts these back.
	fixedLimit: () => (Object.defineProperty(RealmError, "stackTraceLimit", { configurable: false, writable: false, value: 0 }), () => {}),
	fixedPrepare: () => (
		Object.defineProperty(RealmError, "prepareStackTrace", { configurable: false, writable: false, value: () => "" }),
		() => {}
	),
	fixedGlobal() {
		const stand = function Error() {};
		stand.prepareStackTrace = () => `Error\n    at readOnly (${GOOD}:3:14)`;
		Object.defineProperty(globalThis, "Error", { configurable: false, writable: false, value: stand });
		return () => {};
	}
};

/**
 * Read a node, reporting a refusal by its code.
 * @param {"vault"|"only"} target - The node.
 * @returns {string} Its value, or the error's code.
 */
function attempt(target) {
	try {
		return target === "only" ? self.only.get() : self.vault.get();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

/**
 * Run `read` with one change in place.
 * @param {string} name - The change.
 * @param {function(): unknown} read - The read.
 * @returns {unknown} What it returns.
 */
function changed(name, read) {
	const undo = CHANGES[name]();
	try {
		return read();
	} finally {
		undo();
	}
}

/**
 * The names of the changes.
 * @returns {string[]} The names.
 */
export const changes = () => Object.keys(CHANGES);

/**
 * Put a change in place and leave it there (the `fixed` changes, which cannot be taken back).
 * @param {string} name - The change.
 * @returns {void}
 */
export function keep(name) {
	CHANGES[name]();
}

/**
 * Read the vault with a change in place.
 * @param {string} name - The change.
 * @returns {Promise<string>} The answer.
 */
export async function own(name) {
	return changed(name, () => attempt("vault"));
}

/**
 * Read the vault with a change in place, after an `await`.
 * @param {string} name - The change.
 * @returns {Promise<string>} The answer.
 */
export async function ownLater(name) {
	await null;
	return changed(name, () => attempt("vault"));
}

/**
 * A function that reads `target` with a change in place.
 * @param {string} name - The change.
 * @param {"vault"|"only"} [target="vault"] - The node.
 * @returns {function(): string} The function.
 */
export function give(name, target = "vault") {
	return () => changed(name, () => attempt(target));
}

/**
 * Read the vault with a change in place, from a timer.
 * @param {string} name - The change.
 * @returns {Promise<string>} The answer.
 */
export function timer(name) {
	return new Promise((resolve) => setTimeout(() => resolve(changed(name, () => attempt("vault"))), 1));
}
