/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_import_compiled/api/importer/routes.mjs
 *	@Date: 2026-11-27T14:12:22-08:00 (1795817542)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T14:29:13-08:00 (1795818553)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const TARGET = new URL("../target/t.mjs", import.meta.url).href;
const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor;
const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () {}).constructor;
const LOADER = vm.constants?.USE_MAIN_CONTEXT_DEFAULT_LOADER;

/** The leaf file's `value`, read from what an import of it gave. */
const valueOf = (namespace) => namespace?.value ?? namespace?.default?.value;

/**
 * A comment ending the compiled text, so each call compiles text of its own: V8 reuses what it compiled for the same
 * text, importer included.
 */
const fresh = (tag) => `\n// ${String(tag ?? "")}`;

export async function fn(tag) {
	return valueOf(await new Function("u", "return import(u)" + fresh(tag))(TARGET));
}

export async function asyncFn(tag) {
	return valueOf(await new AsyncFunction("u", "return await import(u)" + fresh(tag))(TARGET));
}

export async function generatorFn(tag) {
	return valueOf(await new GeneratorFunction("u", "yield import(u)" + fresh(tag))(TARGET).next().value);
}

export async function asyncGeneratorFn(tag) {
	return valueOf((await new AsyncGeneratorFunction("u", "yield await import(u)" + fresh(tag))(TARGET).next()).value);
}

export async function indirectEval(tag) {
	return valueOf(await (0, eval)(`import(${JSON.stringify(TARGET)})` + fresh(tag)));
}

export async function runInThisContext(tag) {
	return valueOf(await vm.runInThisContext(`import(${JSON.stringify(TARGET)})` + fresh(tag), { importModuleDynamically: LOADER }));
}

export async function compileFunction(tag) {
	return valueOf(await vm.compileFunction("return import(u)" + fresh(tag), ["u"], { importModuleDynamically: LOADER })(TARGET));
}

export async function sourceTextModule(tag) {
	const module = new vm.SourceTextModule(`export const got = import(${JSON.stringify(TARGET)});` + fresh(tag), {
		importModuleDynamically: LOADER
	});
	await module.link(() => {
		throw new Error("no imports to link");
	});
	await module.evaluate();
	return valueOf(await module.namespace.got);
}

export async function timerString(tag) {
	return await new Promise((resolve, reject) => {
		globalThis.__slothletCompiledLeafImport = { resolve, reject, target: TARGET };
		setTimeout(
			"import(globalThis.__slothletCompiledLeafImport.target).then((m) => globalThis.__slothletCompiledLeafImport.resolve(m.value), globalThis.__slothletCompiledLeafImport.reject)" +
				fresh(tag),
			0
		);
	});
}

export async function compiledRequire(tag) {
	const require = createRequire(import.meta.url);
	return valueOf(new Function("r", "u", "return r(u)" + fresh(tag))(require, fileURLToPath(TARGET)));
}
