// helpers.mjs
import vm from "node:vm";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEsmModuleFallback } from "./slothlet_esm.mjs";

/* ------------------------------------------------------------------ */
/* Shared utils (no VM required)                                      */
/* ------------------------------------------------------------------ */

export function normalizeContext(ctx) {
	if (ctx == null) return {};
	if (isPlainObject(ctx)) return { ...ctx };
	if (!Array.isArray(ctx)) {
		const named = guessName(ctx);
		return named ? { [named]: ctx, context: ctx } : { context: ctx };
	}
	const out = {};
	for (const item of ctx) {
		if (Array.isArray(item) && item.length === 2 && typeof item[0] === "string") {
			out[item[0]] = item[1];
			continue;
		}
		if (isPlainObject(item) && "name" in item && "value" in item) {
			out[item.name] = item.value;
			continue;
		}
		if (typeof item === "function" && item.name) {
			out[item.name] = item;
			continue;
		}
		throw new Error("Context array items must be [name,value], {name,value}, or a named function");
	}
	return out;
}

export function installGlobalsInCurrentRealm(contextMap) {
	globalThis.context = Object.freeze({ ...contextMap });
	for (const k of Object.keys(contextMap)) globalThis[k] = contextMap[k];
}

export function extendSelfWithReference(self, reference) {
	if (reference && typeof reference === "object") {
		for (const k of Object.keys(reference)) {
			if (!(k in self)) {
				try {
					self[k] = reference[k];
				} catch {}
			}
		}
	}
}

export function installPortalForSelf() {
	function get(o, p) {
		let x = o;
		for (const k of p) {
			if (!x) {
				// console.debug(`[portal.get] Missing key '${k}' in path`, p, 'Current object:', x);
				return undefined;
			}
			// console.debug(`[portal.get] At key '${k}', available keys:`, Object.keys(x));
			x = x[k];
		}
		return x;
	}
	globalThis._portal = {
		call(path, args) {
			// console.debug(`[portal.call] RAW path:`, path, 'length:', path.length);
			const obj = get(globalThis.self, path.slice(0, -1));
			const fn = obj ? obj[path[path.length - 1]] : undefined;
			// console.debug(`[portal.call] path:`, path, 'obj:', obj, 'fn:', fn);
			if (typeof fn !== "function") {
				// console.error(`[portal.call] ERROR: Resolved value is not a function. path:`, path, 'obj:', obj, 'fn:', fn);
				throw new TypeError("Resolved value is not a function");
			}
			return fn.apply(obj, args);
		},
		batch(ops) {
			return ops.map((op) => this.call(op.path, op.args || []));
		}
	};
}

export function asUrl(p) {
	return p && p.startsWith && p.startsWith("file:") ? p : pathToFileURL(path.resolve(String(p))).href;
}

export function isPlainObject(o) {
	return !!o && typeof o === "object" && (o.constructor === Object || Object.getPrototypeOf(o) === null);
}

export function guessName(v) {
	if (typeof v === "function" && v.name) return v.name;
	if (isPlainObject(v) && v.constructor && v.constructor.name && v.constructor.name !== "Object") {
		const n = v.constructor.name;
		return n[0].toLowerCase() + n.slice(1);
	}
	return null;
}

/* ------------------------------------------------------------------ */
/* VM-specific helpers                                                */
/* ------------------------------------------------------------------ */

export const HAS_STM = typeof vm.SourceTextModule === "function";

export function makeNodeishContext() {
	const sandbox = {
		console,
		process,
		Buffer,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		setImmediate,
		clearImmediate,
		queueMicrotask,
		TextEncoder,
		TextDecoder,
		URL,
		URLSearchParams,
		AbortController,
		AbortSignal,
		performance,
		Function
	};
	const context = vm.createContext(sandbox);
	context.globalThis = context;
	context.global = context;
	return context;
}

/**
 * Loads a module into a VM context, supporting ESM (mjs), CJS (cjs), or auto-detection.
 * @param {object} context - The VM context.
 * @param {string} fileUrl - The file URL to load.
 * @param {string} [mode='auto'] - 'auto', 'mjs', or 'cjs'.
 * @returns {Promise<object>} Module namespace or SourceTextModule.
 */
export async function loadEsmInVm2(context, fileUrl, mode = "auto") {
	console.debug(`[loadEsmInVm] fileUrl: ${fileUrl}, mode: ${mode}`);
	// detectedMode is set below
	const code = await fs.readFile(fileURLToPath(fileUrl), "utf8");
	let detectedMode = mode;
	console.debug(`[loadEsmInVm] detectedMode: ${detectedMode} for fileUrl: ${fileUrl}`);
	if (mode === "auto") {
		const ext = path.extname(fileURLToPath(fileUrl)).toLowerCase();
		if (ext === ".mjs") detectedMode = "mjs";
		else if (ext === ".cjs") detectedMode = "cjs";
		else if (ext === ".js") {
			if (/\bimport\b/.test(code)) detectedMode = "mjs";
			else if (/\brequire\b/.test(code)) detectedMode = "cjs";
			else detectedMode = "cjs"; // default to cjs for .js
		} else {
			detectedMode = "cjs";
		}
	}

	if (detectedMode === "cjs") {
		// Only allow CJS for top-level entry, not for linker/dynamic import
		// If called from linker/dynamic import, throw error
		// If this is a relative import (linker/dynamic), throw error
		if (mode === "cjs" || (fileUrl.endsWith(".cjs") && mode === "auto")) {
			console.debug(`[loadEsmInVm] Loading as CJS: ${fileUrl}`);
			// Only allow for top-level entry
			if (arguments.callee.caller && arguments.callee.caller.name === "loadEsmInVm") {
				throw new Error("CJS modules are not supported for linker/dynamic import. Only ESM (.mjs) modules are allowed.");
			}
			console.debug(
				`[loadEsmInVm] Returning CJS namespace for ${fileUrl}:`,
				namespace,
				"type:",
				typeof namespace,
				"constructor:",
				namespace?.constructor?.name
			);
			console.debug(
				`[loadEsmInVm] [RETURN]`,
				{ namespace },
				"type:",
				typeof { namespace },
				"constructor:",
				{ namespace }?.constructor?.name
			);
			if (!context.require) {
				context.require = require;
			}
			const script = new vm.Script(code, { filename: fileUrl });
			script.runInContext(context);
			const namespace = {};
			for (const k of Object.keys(context)) {
				if (k !== "globalThis" && k !== "global") {
					namespace[k] = context[k];
				}
			}
			console.debug(`[loadEsmInVm] Returning CJS namespace for ${fileUrl}:`, namespace, "type:", typeof namespace);
			return { namespace };
		} else {
			console.error(`[loadEsmInVm] CJS not allowed for linker/dynamic import: ${fileUrl}`);
			throw new Error("CJS modules are not supported in linker/dynamic import. Only ESM (.mjs) modules are allowed.");
		}
	}
	if (detectedMode === "mjs") {
		console.debug(`[loadEsmInVm] Loading as ESM: ${fileUrl}`);
		if (HAS_STM) {
			const mod = new vm.SourceTextModule(code, {
				context,
				identifier: fileUrl,
				initializeImportMeta(m) {
					m.url = fileUrl;
				}
				// ,
				// async importModuleDynamically(specifier, referrer, importAttributes) {
				// 	console.log(specifier); // 'foo.json'
				// 	console.log(referrer); // The compiled script
				// 	console.log(importAttributes); // { type: 'json' }
				// 	const m = new SyntheticModule(["bar"], () => {});
				// 	await m.link(() => {});
				// 	m.setExport("bar", { hello: "world" });
				// 	return m;
				// }
				// importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER
				// importModuleDynamically: async (spec, ref) => {
				// 	console.debug("[dynamic import] spec:", spec, "ref.identifier:", ref.identifier);
				// 	const isRel = spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("file:");
				// 	if (!isRel) {
				// 		// Use export * from 'pkg' for package/builtin imports
				// 		const exportCode = `export * from '${spec}';`;
				// 		const exportMod = new vm.SourceTextModule(exportCode, { context });
				// 		await exportMod.link(() => {});
				// 		await exportMod.evaluate();
				// 		console.debug("[dynamic import] returning SourceTextModule for package/builtin:", exportMod, "status:", exportMod.status);
				// 		return exportMod;
				// 	}
				// 	const childUrl = new URL(spec, ref.identifier).href;
				// 	console.debug("[dynamic import] resolved childUrl:", childUrl);
				// 	const child = await loadEsmInVm(context, childUrl, "mjs");
				// 	console.debug(
				// 		"[dynamic import] child module:",
				// 		child,
				// 		"type:",
				// 		typeof child,
				// 		"instanceof SourceTextModule:",
				// 		child instanceof vm.SourceTextModule
				// 	);
				// 	if (child instanceof vm.SourceTextModule) {
				// 		if (child.status !== "evaluated") {
				// 			await child.evaluate();
				// 		}
				// 		console.debug("[dynamic import] returning child SourceTextModule:", child, "status:", child.status);
				// 		return child;
				// 	}
				// 	console.error("[dynamic import] ERROR: Dynamic import did not return a SourceTextModule:", child);
				// 	throw new Error("Dynamic import did not return a SourceTextModule");
				// }
			});
			/* 
			await mod.link(async (specifier, referencingModule) => {
				console.debug("[linker] specifier:", specifier, "referencingModule.identifier:", referencingModule.identifier);
				const isRel = specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:");
				if (!isRel) {
					const exportCode = `export * from '${specifier}';`;
					const exportMod = new vm.SourceTextModule(exportCode, { context });
					await exportMod.link(() => {});
					await exportMod.evaluate();
					console.debug(
						"[linker] returning SourceTextModule for package/builtin:",
						exportMod,
						"status:",
						exportMod.status,
						"constructor:",
						exportMod.constructor.name
					);
					return exportMod;
				}
				const childUrl = new URL(specifier, referencingModule.identifier).href;
				console.debug("[linker] resolved childUrl:", childUrl);
				const child = await loadEsmInVm(context, childUrl, "mjs");
				console.debug(
					"[linker] child module:",
					child,
					"type:",
					typeof child,
					"constructor:",
					child?.constructor?.name,
					"instanceof SourceTextModule:",
					child instanceof vm.SourceTextModule
				);
				if (child instanceof vm.SourceTextModule) {
					if (child.status !== "evaluated") {
						await child.evaluate();
					}
					console.debug(
						"[linker] returning child SourceTextModule:",
						child,
						"status:",
						child.status,
						"constructor:",
						child.constructor.name
					);
					return child;
				}
				console.error("[linker] ERROR: Linker did not return a SourceTextModule:", child);
				throw new Error("Linker did not return a SourceTextModule");
			});
			 */
			await mod.evaluate();
			console.debug("[loadEsmInVm] returning top-level SourceTextModule:", mod, "status:", mod.status);
			console.debug(`[loadEsmInVm] Returning SourceTextModule for ${fileUrl}:`, mod);
			return mod;
		} else {
			// const ns = new vm.Script(code, {
			// 	filename: fileUrl,
			// 	importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER
			// });
			// const ns = await loadEsmModuleFallback(context, fileUrl);
			return ns;
			// Stub: ESM not supported in VM, return error or placeholder
			throw new Error("ESM (import/export) not supported in VM context without vm.SourceTextModule. Custom parser not implemented yet.");
		}
	}

	console.error(`[loadEsmInVm] [RETURN] ERROR: Unknown module mode: ${detectedMode}`);
	throw new Error(`Unknown module mode: ${detectedMode}`);
}

const MODULE_CACHE = Symbol.for("slothlet.vm.moduleCache");
export async function loadEsmInVm(context, fileUrl) {
	if (!HAS_STM) {
		throw new Error("vm.SourceTextModule not available; cannot load ESM inside vm context");
	}
	// Per-context cache: reuse the same Module instance for the same URL
	const cache = (context[MODULE_CACHE] ||= new Map());
	if (cache.has(fileUrl)) return cache.get(fileUrl);

	const code = await fs.readFile(fileURLToPath(fileUrl), "utf8");

	// Linker for *static* imports
	const link = async (specifier, referencingModule) => {
		const isRel = specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/") || specifier.startsWith("file:");

		if (isRel) {
			const childUrl = new URL(specifier, referencingModule.identifier).href;
			return await loadEsmInVm(context, childUrl); // <- MUST return a vm.Module
		}

		// Bare or node: specifiers -> delegate to Node and wrap namespace as SyntheticModule
		const ns = await import(specifier);
		const sm = new vm.SyntheticModule(
			Object.keys(ns),
			function init() {
				for (const k of Object.keys(ns)) this.setExport(k, ns[k]);
			},
			{ context }
		);
		// SyntheticModule doesn’t require link(); it’s already “linked”
		return sm; // <- also a vm.Module
	};

	// Handler for *dynamic* imports (import())
	const importModuleDynamically = async (specifier, referencingModule) => {
		const child = await link(specifier, referencingModule);
		// For dynamic import, the child must be evaluated before being returned
		await child.evaluate();
		return child;
	};

	const mod = new vm.SourceTextModule(code, {
		context,
		identifier: fileUrl,
		initializeImportMeta(meta) {
			meta.url = fileUrl;
		},
		importModuleDynamically
	});

	cache.set(fileUrl, mod);
	await mod.link(link); // <- real linker that returns Modules

	// await mod.evaluate();
	return mod;
}

export function installContextGlobalsVM(context, userContext) {
	const map = normalizeContext(userContext);
	context.__ctx = map;
	vm.runInContext(
		`
            globalThis.context = Object.freeze({ ...__ctx });
            for (const k of Object.keys(__ctx)) { globalThis[k] = __ctx[k]; }
        `,
		context,
		{ filename: "slothlet_helpers-installContextGlobalsVM.mjs" }
	);
	delete context.__ctx;
}

export async function bootSlothletVM(context, entryUrl, loadConfig, ctxRef) {
	const mod = await loadEsmInVm(context, entryUrl);
	await mod.evaluate(); // evaluate only the top-level after linking
	console.log(mod.namespace);
	console.log("mod.namespace?.slothlet", mod.namespace?.slothlet);
	console.log("mod.namespace?.default", mod.namespace?.default);
	console.log(entryUrl);
	let sloth = mod.namespace?.slothlet;
	if (!sloth && mod.namespace?.default) {
		// If default export is an object with slothlet property, use it
		if (mod.namespace.default.slothlet) {
			sloth = mod.namespace.default.slothlet;
		} else {
			// If default export is the slothlet object itself
			sloth = mod.namespace.default;
		}
	}
	if (!sloth) throw new Error("Entry did not export `slothlet`");
	context.__slothlet = sloth;
	context.__loadConfig = loadConfig;
	context.__ctxRef = ctxRef;
	vm.runInContext(
		`
			globalThis.slothletReady = global.slothletReady = new Promise(async (resolve) => {
				globalThis.slothlet = global.slothlet = __slothlet;
				const ret = await globalThis.slothlet.load(__loadConfig, __ctxRef);
				globalThis.self = global.self = ret;
				const ref = __ctxRef?.reference;
				if (ref && typeof ref === 'object') {
					for (const k of Object.keys(ref)) if (!(k in globalThis.self)) {
						try { globalThis.self[k] = global.self[k] = ref[k]; } catch {}
					}
				}
				function get(o,p){ return p.reduce((x,k)=>x[k], o); }
				globalThis._portal = global._portal = {
					call(path, args){
						const obj = get(globalThis.self || global.self, path.slice(0,-1));
						const fn  = obj[path[path.length-1]];
						return fn.apply(obj, args);
					},
					batch(ops){ return ops.map(op => this.call(op.path, op.args || [])); }
				};
				resolve();
			});
		`,
		context,
		{ filename: "slothlet_helpers-bootSlothletVM.mjs" }
	);
	delete context.__slothlet;
	delete context.__loadConfig;
	delete context.__ctxRef;
}

// --- Callback marshalling for Worker/Fork IPC ---

export function marshalArgsReplaceFunctions(value, registerCb) {
	function walk(v) {
		if (typeof v === "function") {
			const id = registerCb(v);
			return { __cb: id }; // token
		}
		if (!v || typeof v !== "object") return v;
		if (Array.isArray(v)) return v.map(walk);
		const out = {};
		for (const k of Object.keys(v)) out[k] = walk(v[k]);
		return out;
	}
	return walk(value);
}

export function reviveArgsReplaceTokens(value, invokeCb) {
	function walk(v) {
		if (v && typeof v === "object" && typeof v.__cb === "number") {
			const id = v.__cb;
			return (...args) => invokeCb(id, args);
		}
		if (!v || typeof v !== "object") return v;
		if (Array.isArray(v)) return v.map(walk);
		const out = {};
		for (const k of Object.keys(v)) out[k] = walk(v[k]);
		return out;
	}
	return walk(value);
}

export function containsFunction(value) {
	if (typeof value === "function") return true;
	if (!value || typeof value !== "object") return false;
	if (Array.isArray(value)) return value.some(containsFunction);
	return Object.values(value).some(containsFunction);
}
