/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_import_compiled/api/importer/routes.mjs
 *	@Date: 2026-11-27T14:54:14-08:00 (1795820054)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T14:57:30-08:00 (1795820250)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Compiles code from a string by each route the language and Node offer. The compiled code imports or requires one of
// slothlet's own files (`internal`), or a leaf file (`leaf`). The `run*` routes call the compiled code here; the `give*`
// routes return it uncalled, for the host to call.
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const TARGETS = {
	// A file of slothlet's own code, by its URL and by one of slothlet's `#imports` specifiers.
	internal: new URL("../../../../src/lib/helpers/flow-stores.mjs", import.meta.url).href,
	internalSpecifier: "#handlers/unified-wrapper",
	leaf: new URL("../target/t.mjs", import.meta.url).href
};
const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor;
const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () {}).constructor;
const LOADER = vm.constants?.USE_MAIN_CONTEXT_DEFAULT_LOADER;

/** A comment ending the compiled text, so each call compiles text of its own (V8 reuses what it compiled, importer included). */
const fresh = (tag) => `\n// ${String(tag ?? "")}`;
const quoted = (target) => JSON.stringify(TARGETS[target]);

/**
 * Each route: compiles code and says how it is called (see `INVOKE`): `call` for a function returning a promise of what
 * the import gave, `generator` and `asyncGenerator` for a generator function yielding it.
 */
const COMPILE = {
	fn: (target, tag) => ["call", new Function(`return import(${quoted(target)})` + fresh(tag))],
	asyncFn: (target, tag) => ["call", new AsyncFunction(`return await import(${quoted(target)})` + fresh(tag))],
	generatorFn: (target, tag) => ["generator", new GeneratorFunction(`yield import(${quoted(target)})` + fresh(tag))],
	asyncGeneratorFn: (target, tag) => ["asyncGenerator", new AsyncGeneratorFunction(`yield await import(${quoted(target)})` + fresh(tag))],
	indirectEval: (target, tag) => ["call", (0, eval)(`(() => import(${quoted(target)}))` + fresh(tag))],
	runInThisContext: (target, tag) => [
		"call",
		vm.runInThisContext(`(() => import(${quoted(target)}))` + fresh(tag), { importModuleDynamically: LOADER })
	],
	compileFunction: (target, tag) => [
		"call",
		vm.compileFunction(`return import(${quoted(target)})` + fresh(tag), [], { importModuleDynamically: LOADER })
	],
	// `vm` code compiled under the name of a file that is not there.
	namedScript: (target, tag) => [
		"call",
		vm.runInThisContext(`(() => import(${quoted(target)}))` + fresh(tag), {
			filename: fileURLToPath(new URL("../../lib/absent.mjs", import.meta.url)),
			importModuleDynamically: LOADER
		})
	],
	// Code compiled by code the module compiled: an indirect eval run inside a function the module built with `new Function`.
	nestedEval: (target, tag) => [
		"call",
		new Function(`return (0, eval)(${JSON.stringify(`(() => import(${quoted(target)}))` + fresh(tag))})`)()
	],
	// Code naming a host file as its source, by a `sourceURL` comment.
	namedSource: (target, tag) => [
		"call",
		new Function(
			`return import(${quoted(target)})` + fresh(tag) + `\n//# sourceURL=${fileURLToPath(new URL("../../lib/probe.mjs", import.meta.url))}`
		)
	],
	// A require made inside the compiled code, from the module's own URL.
	compiledRequire: (target, tag) => {
		const file = TARGETS[target].startsWith("file:") ? fileURLToPath(TARGETS[target]) : TARGETS[target];
		const source = `return Promise.resolve(process.getBuiltinModule("node:module").createRequire(${JSON.stringify(import.meta.url)})(${JSON.stringify(file)}))`;
		return ["call", new Function(source + fresh(tag))];
	}
};

/** How compiled code of each kind is called, to the promise of what its import gave. */
const INVOKE = {
	call: (fn) => fn(),
	generator: (fn) => fn().next().value,
	asyncGenerator: async (fn) => (await fn().next()).value
};

/** What an import gave: `"loaded"` for slothlet's file, the leaf file's `value`. */
const read = (target, namespace) =>
	target === "leaf" ? (namespace?.value ?? namespace?.default?.value) : namespace ? "loaded" : namespace;

export async function run(route, target, tag) {
	const [kind, fn] = COMPILE[route](target, `run ${tag}`);
	return read(target, await INVOKE[kind](fn));
}

/** The compiled code, uncalled, with how it is called. */
export function give(route, target, tag) {
	const [kind, fn] = COMPILE[route](target, `give ${tag}`);
	return { kind, fn };
}
