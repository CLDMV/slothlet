/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_code_strings/lib/routes.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:46-08:00 (1795868866)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every route from a string to code the tests try, by name. Imported by the modules and run by the host
 * alike, so each runs as whoever calls it: the file is a helper, not an api file.
 *
 * @module api_tests/api_test_code_strings/routes
 */

/**
 * The routes. Each takes Node's `vm` and `Module` and the calling file's path, and returns what the compiled code gave.
 * @type {Record<string, function({vm: object, Module: Function, file: string}): *>}
 * @public
 */
export const routes = {
	Function: () => Function("return 7")(),
	newFunction: () => new Function("return 7")(),
	functionConstructor: () => function () {}.constructor("return 7")(),
	functionPrototypeConstructor: () => Function.prototype.constructor("return 7")(),
	asyncFunction: () => (async () => {}).constructor("return 7")(),
	generatorFunction: () =>
		Object.getPrototypeOf(function* () {})
			.constructor("yield 7")()
			.next().value,
	asyncGeneratorFunction: async () =>
		(
			await Object.getPrototypeOf(async function* () {})
				.constructor("yield 7")()
				.next()
		).value,
	reflectConstruct: () => Reflect.construct(Function, ["return 7"])(),
	subclass: () => new (class extends Function {})("return 7")(),
	bound: () => Function.bind(null, "return 7")()(),
	runInThisContext: ({ vm }) => vm.runInThisContext("7"),
	runInNewContext: ({ vm }) => vm.runInNewContext("7"),
	runInContext: ({ vm }) => vm.runInContext("7", vm.createContext({})),
	compileFunction: ({ vm }) => vm.compileFunction("return 7")(),
	script: ({ vm }) => new vm.Script("7").runInThisContext(),
	createScript: ({ vm }) => vm.createScript("7").runInThisContext(),
	moduleCompile: ({ Module, file }) => {
		const module = new Module(file);
		module._compile("module.exports = 7;", file);
		return module.exports;
	},
	// Node's binding compiles strings itself; calling it takes arguments that differ between Node versions (and aborts
	// the process on a mismatch), so taking the binding is the step under test.
	binding: () => typeof process.binding("contextify").ContextifyScript,
	registerHooks: ({ Module }) => {
		const hooks = Module.registerHooks({ resolve: (specifier, context, nextResolve) => nextResolve(specifier, context) });
		hooks.deregister();
		return 7;
	},
	register: ({ Module }) => {
		Module.register("data:text/javascript,export async function resolve(s, c, n) { return n(s, c); }");
		return 7;
	},
	dataImport: async () => (await import("data:text/javascript,export default 7")).default,
	stringTimeout: () =>
		new Promise((resolve, reject) => {
			globalThis.__slothletCodeStringsTimer = resolve;
			try {
				setTimeout("globalThis.__slothletCodeStringsTimer(7)", 0);
			} catch (error) {
				reject(error);
			}
		}),
	stringInterval: () =>
		new Promise((resolve, reject) => {
			try {
				const id = setInterval("globalThis.__slothletCodeStringsTimer(7)", 0);
				globalThis.__slothletCodeStringsTimer = (value) => {
					clearInterval(id);
					resolve(value);
				};
			} catch (error) {
				reject(error);
			}
		})
};
