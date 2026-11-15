/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_exports/api/held.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794675600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file that holds slothlet's internal exports the host left on `globalThis` (or passed in), and
 * uses each one the ways code can: called directly, through `Function.prototype.call`/`apply`/`bind`, `Reflect.apply`,
 * as a callback of a built-in (`Array.prototype.map`), from a promise job, from `eval` and `new Function`, and handed to
 * slothlet's own `context.run` to call.
 * @module api_test_internal_exports.held
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Where the host leaves the exports.
 * @type {symbol}
 */
const KEY = Symbol.for("@cldmv/slothlet.test.internalExports");

/**
 * The code an attempt failed with.
 * @param {*} error - What was thrown.
 * @returns {string} The code.
 */
const codeOf = (error) => error?.code ?? /^\[([A-Z_]+)\]/.exec(String(error?.message))?.[1] ?? error?.name ?? String(error);

/**
 * Use a value once: call a function, read a member of an object.
 * @param {*} value - The value.
 * @returns {*} What using it gives.
 */
const touch = (value) => (typeof value === "function" ? value() : value.anything);

/**
 * What an attempt gives: `"used"` when it ran, else the code it failed with.
 * @param {function(): *} attempt - The attempt.
 * @returns {Promise<string>} The outcome.
 */
async function outcome(attempt) {
	try {
		await attempt();
		return "used";
	} catch (error) {
		return codeOf(error);
	}
}

/**
 * Use one held export in one way.
 * @param {string} key - The export, as the host keyed it.
 * @param {string} [shape="direct"] - How to use it.
 * @returns {Promise<string>} The outcome.
 */
export async function use(key, shape = "direct") {
	const value = globalThis[KEY][key];
	switch (shape) {
		case "call":
			return outcome(() => Reflect.apply(Function.prototype.call, value, [null]));
		case "apply":
			return outcome(() => Reflect.apply(Function.prototype.apply, value, [null, []]));
		case "bind":
			return outcome(() => Reflect.apply(Function.prototype.bind, value, [null])());
		case "reflect":
			return outcome(() => Reflect.apply(value, null, []));
		case "map":
			return outcome(() => [undefined].map(value));
		case "then":
			return outcome(() => Promise.resolve().then(value));
		case "eval":
			return outcome(() => eval("value()"));
		case "function":
			return outcome(() => new Function("value", "return value()")(value));
		case "run":
			return outcome(() => self.slothlet.context.run({}, value));
		default:
			return outcome(() => touch(value));
	}
}

/**
 * Use an export the host passed in as an argument.
 * @param {*} value - The export.
 * @returns {Promise<string>} The outcome.
 */
export async function useArgument(value) {
	return outcome(() => touch(value));
}

/**
 * Call a static function of a held export (a class), as module code holding the export would.
 * @function useStatic
 * @memberof module:api_test_internal_exports.held
 * @param {string} key - The held export's key.
 * @param {string} name - The static function's name.
 * @returns {Promise<string>} `"used"`, or the code the call failed with.
 * @example
 * await api.held.useStatic("#handlers/unified-wrapper:UnifiedWrapper", "_extractFullImpl"); // "MODULE_INTERNAL_NOT_IMPORTABLE"
 */
export async function useStatic(key, name) {
	return outcome(() => globalThis[KEY][key][name]({}, "/nowhere/file.mjs"));
}

/**
 * Import one of slothlet's own files from this api file and call a static function of a class it exports.
 * @function importStatic
 * @memberof module:api_test_internal_exports.held
 * @param {string} specifier - The file: a package import, or a file URL.
 * @param {string} exportName - The class's export name.
 * @param {string} name - The static function's name.
 * @returns {Promise<string>} `"used"`, or the code the import or the call failed with.
 * @example
 * await api.held.importStatic("#handlers/unified-wrapper", "UnifiedWrapper", "_recordSourceFile"); // "MODULE_INTERNAL_NOT_IMPORTABLE"
 */
export async function importStatic(specifier, exportName, name) {
	return outcome(async () => (await import(specifier))[exportName][name]({}, "/nowhere/file.mjs"));
}
