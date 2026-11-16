/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vm_recompiled/reader/probe.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The reader for the recompiled-source tests, mounted as a module of its own. It may run the trusted modules'
 * `run` and nothing of the vault's, and compiles copies of the trusted modules' exact sources under their own file
 * names: `vm.compileFunction` and `Module#_compile` of the CommonJS file with a `require` it supplies, a fresh
 * `require` of that file, and a `vm.SourceTextModule` of the ES module where the engine has one. Each copy is the
 * reader's code, so what it does is held to the reader's rules wherever it runs.
 *
 * @module api_tests/api_test_vm_recompiled/reader/probe
 */

import vm from "node:vm";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as runtime from "@cldmv/slothlet/runtime";
import { peek } from "../shared/peek.mjs";

const { self } = runtime;

const CJS_PATH = fileURLToPath(new URL("../trusted/ops.cjs", import.meta.url));
const PARAMETERS = ["exports", "require", "module", "__filename", "__dirname"];

/**
 * Start a call and capture its outcome, whether it throws synchronously or rejects.
 * @param {function(): *} invoke - The call.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @private
 */
function attempt(invoke) {
	try {
		return Promise.resolve(invoke()).then(
			(value) => ({ ok: true, value }),
			(error) => ({ ok: false, code: error?.code ?? String(error) })
		);
	} catch (error) {
		return Promise.resolve({ ok: false, code: error?.code ?? String(error) });
	}
}

/**
 * The trusted ES module's URL as its own frames spell it, read while its frame is on the stack.
 * @returns {Promise<string>} The URL.
 * @private
 */
async function esmLocation() {
	return self.trustedesm.ops.run(() => {
		const limit = Error.stackTraceLimit;
		Error.stackTraceLimit = 200;
		const stack = new Error().stack;
		Error.stackTraceLimit = limit;
		for (const line of String(stack).split("\n")) {
			if (!line.includes("trustedesm/ops.mjs")) continue;
			const match = /\((.+):\d+:\d+\)\s*$/.exec(line) ?? /at (?:async )?(.+):\d+:\d+\s*$/.exec(line);
			if (match) return match[1];
		}
		throw new Error("the trusted module's frame is not on the stack");
	});
}

/**
 * A copy of a trusted module's exports, compiled from its exact source under its own file name.
 * @param {string} kind - How it is compiled: "compileFunction", "moduleCompile", "require" or "sourceTextModule".
 * @returns {Promise<object>} The copy's exports.
 * @private
 */
async function copyOf(kind) {
	const exports = await compile(kind);
	// The CommonJS copy takes the runtime with a dynamic import: let it settle.
	await new Promise((resolve) => setTimeout(resolve, 10));
	return exports;
}

/**
 * Compile a copy (see {@link copyOf}).
 * @param {string} kind - How it is compiled.
 * @returns {Promise<object>} The copy's exports.
 * @private
 */
async function compile(kind) {
	if (kind === "sourceTextModule") {
		const url = await esmLocation();
		const source = fs.readFileSync(fileURLToPath(url.split("?")[0]), "utf8");
		const copy = new vm.SourceTextModule(source, { identifier: url });
		await copy.link(() => {
			const names = Object.keys(runtime);
			return new vm.SyntheticModule(names, function () {
				for (const name of names) this.setExport(name, runtime[name]);
			});
		});
		await copy.evaluate();
		return copy.namespace;
	}
	if (kind === "import") {
		const url = await esmLocation();
		return import(`${url}${url.includes("?") ? "&" : "?"}copy=${Math.random()}`);
	}
	if (kind === "importPlain") {
		const url = await esmLocation();
		return import(`${url.split("?")[0]}?copy=${Math.random()}`);
	}
	const source = fs.readFileSync(CJS_PATH, "utf8");
	const require = createRequire(CJS_PATH);
	if (kind === "compileFunction") {
		const fn = vm.compileFunction(source, PARAMETERS, {
			filename: CJS_PATH,
			importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER
		});
		const module = { exports: {} };
		fn(module.exports, require, module, CJS_PATH, fileURLToPath(new URL("../trusted", import.meta.url)));
		return module.exports;
	}
	if (kind === "moduleCompile") {
		const module = new Module(CJS_PATH);
		module.filename = CJS_PATH;
		module.paths = Module._nodeModulePaths(CJS_PATH);
		module._compile(source, CJS_PATH);
		return module.exports;
	}
	if (kind === "require") {
		const fresh = createRequire(import.meta.url);
		delete fresh.cache[CJS_PATH];
		return fresh(CJS_PATH);
	}
	throw new Error(`unknown kind ${kind}`);
}

/**
 * Hand a copy's function to the trusted module's `run`, which calls it inside the trusted module's call.
 * @param {string} kind - How the copy is compiled.
 * @param {string} [name="read"] - The copy's function: "read" or "who".
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @public
 * @example
 * await api.reader.probe.handIn("compileFunction"); // { ok: false, code: "PERMISSION_DENIED" }
 */
export async function handIn(kind, name = "read") {
	const copy = await copyOf(kind);
	const target = kind === "sourceTextModule" || kind.startsWith("import") ? self.trustedesm.ops : self.trusted.ops;
	return attempt(() => target.run(copy[name]));
}

/**
 * Hand a copy's function out, for the host to run.
 * @param {string} kind - How the copy is compiled.
 * @param {string} [name="read"] - The copy's function: "read" or "who".
 * @returns {Promise<Function>} The function.
 * @public
 * @example
 * const fn = await api.reader.probe.give("compileFunction"); fn(); // throws PERMISSION_DENIED
 */
export async function give(kind, name = "read") {
	const copy = await copyOf(kind);
	return { fn: copy[name] };
}

/**
 * Run a copy's function in the reader's own call.
 * @param {string} kind - How the copy is compiled.
 * @param {string} [name="read"] - The copy's function.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @public
 * @example
 * await api.reader.probe.own("compileFunction"); // { ok: false, code: "PERMISSION_DENIED" }
 */
export async function own(kind, name = "read") {
	const copy = await copyOf(kind);
	return attempt(() => copy[name]());
}

/**
 * Leave a function compiled with `vm` on the global object, for the trusted modules to find and run. It calls the
 * vault's secret through the reader's own `self`, and names no module, so what it does is refused wherever it runs.
 * @param {string} name - The global's name.
 * @param {string} [body] - The function's body: an expression reading `self`.
 * @param {string} [filename="planted.js"] - The file name it is compiled under.
 * @returns {void}
 * @public
 * @example
 * api.reader.probe.plantGlobal("planted");
 */
export function plantGlobal(name, body = "self.vault.secret.secret()", filename = "planted.js") {
	globalThis[name] = vm.runInThisContext(`(self) => () => ${body}`, { filename })(self);
}

/**
 * Hand the trusted module's `run` a function compiled with `vm` under a file name given, which calls the vault's
 * secret through the reader's own `self`.
 * @param {string} filename - The file name it is compiled under.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @public
 * @example
 * await api.reader.probe.plantIn("planted.js"); // { ok: false, code: "PERMISSION_DENIED" }
 */
export async function plantIn(filename) {
	const fn = vm.runInThisContext("(self) => () => self.vault.secret.secret()", { filename })(self);
	return attempt(() => self.trusted.ops.run(fn));
}

/**
 * Import the trusted ES module's helper under the tags of a copy loaded for the trusted module's api file (`helpers:
 * "module"`), written out by this module, and hand its function out for the host to run.
 * @returns {Promise<{fn: Function}>} The function.
 * @public
 * @example
 * const { fn } = await api.reader.probe.helperCopy(); fn(); // throws PERMISSION_DENIED
 */
export async function helperCopy() {
	const url = await esmLocation();
	const [base, query = ""] = url.split("?");
	const params = new URLSearchParams(query);
	const helper = new URL("../shared/peek.mjs", base.startsWith("file:") ? base : `file://${base}`);
	const tags = new URLSearchParams({
		slothlet_instance: params.get("slothlet_instance"),
		slothlet_helpers: "module",
		slothlet_for: fileURLToPath(base.startsWith("file:") ? base : `file://${base}`),
		slothlet_mount: params.get("module") ?? ""
	});
	const spec = base.startsWith("file:") ? `${helper.href}?${tags}` : `${fileURLToPath(helper)}?${tags}`;
	const copy = await import(spec);
	return { fn: copy.peek };
}

/**
 * Hand out the helper this module and the trusted ES module both import, for the host to run.
 * @returns {{fn: Function}} The helper's function.
 * @public
 * @example
 * const { fn } = api.reader.probe.sharedHelper(); fn(); // throws PERMISSION_DENIED
 */
export function sharedHelper() {
	return { fn: peek };
}
