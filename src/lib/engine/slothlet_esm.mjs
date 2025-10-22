/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/engine/slothlet_esm.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 06:58:47 -07:00 (1761141527)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "module";
const builtins = new Set(builtinModules);

/**
 * Minimal custom ESM loader for VM context fallback when SourceTextModule is unavailable.
 * Parses import/export statements, loads dependencies recursively, and evaluates code in context.
 * Limitations: Only supports static imports/exports, no top-level await, no dynamic import, no advanced ESM features.
 * @param {object} context - The VM context.
 * @param {string} fileUrl - The file URL to load.
 * @param {Set<string>} [visited] - Tracks loaded modules to prevent cycles.
 * @returns {Promise<object>} Module namespace object.
 * @example
 * const ns = await loadEsmModuleFallback(context, 'file:///path/to/mod.mjs');
 */
export async function loadEsmModuleFallback(context, fileUrl, visited = new Set()) {
	// Inject fileURLToPath from node:url if not present
	if (typeof context.fileURLToPath !== "function") {
		const { fileURLToPath } = await import("node:url");
		context.fileURLToPath = fileURLToPath;
	}
	// Inject a native import function for dynamic imports
	context.import = async (specifier) => import(specifier);
	// Only process file: URLs
	let specToCheck = fileUrl;
	if (specToCheck.startsWith("node:")) specToCheck = specToCheck.slice(5);
	if (!fileUrl.startsWith("file:")) {
		if (builtins.has(specToCheck) || /^[\w@][\w\-/]*$/.test(specToCheck)) {
			return await import(fileUrl);
		}
		throw new Error(`Unsupported import specifier: ${fileUrl}`);
	}
	if (visited.has(fileUrl)) return context[fileUrl];
	visited.add(fileUrl);
	let code = await fs.readFile(fileURLToPath(fileUrl), "utf8");
	// Find all comment ranges to ignore imports/exports in comments
	const commentRanges = [];
	const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
	const lineCommentRegex = /(^|[^:])\/\/.*$/gm;
	let blockMatch;
	while ((blockMatch = blockCommentRegex.exec(code))) {
		commentRanges.push([blockMatch.index, blockCommentRegex.lastIndex]);
	}
	let lineMatch;
	while ((lineMatch = lineCommentRegex.exec(code))) {
		let start = lineMatch.index + (lineMatch[1] ? lineMatch[1].length : 0);
		let end = code.indexOf("\n", lineMatch.index);
		if (end === -1) end = code.length;
		commentRanges.push([start, end]);
	}
	function inComment(idx) {
		return commentRanges.some(([start, end]) => idx >= start && idx < end);
	}
	// Find static imports not in comments
	const importRegex = /import\s+(?:([\w{}*, ]+)\s+from\s+)?["'](.+?)["'];?/g;
	let match;
	const imports = [];
	while ((match = importRegex.exec(code))) {
		if (!inComment(match.index)) {
			imports.push({ spec: match[2], names: match[1] });
		}
	}
	// Inject imported symbols into context
	for (const imp of imports) {
		if (!imp.names) continue; // skip bare imports
		let mod;
		// Determine if relative import
		if (imp.spec.startsWith("./") || imp.spec.startsWith("../")) {
			const resolvedUrl = new URL(imp.spec, fileUrl).href;
			mod = await loadEsmModuleFallback(context, resolvedUrl, visited);
		} else {
			mod = await import(imp.spec);
		}
		// Handle different import syntaxes
		const importStr = imp.names.trim();
		if (importStr.startsWith("* as ")) {
			// import * as ns from 'mod';
			const nsName = importStr.slice(5).trim();
			context[nsName] = mod;
		} else if (importStr.startsWith("{")) {
			// import { a, b as c } from 'mod';
			let fields = importStr
				.slice(1, -1)
				.split(",")
				.map((f) => f.trim())
				.filter(Boolean);
			for (let field of fields) {
				let [orig, alias] = field.split(" as ").map((x) => x.trim());
				context[alias || orig] = mod[orig];
			}
		} else if (importStr) {
			// import defaultExport from 'mod';
			// or: import defaultExport, { a, b as c } from 'mod';
			let parts = importStr
				.split(/,(.+)/)
				.map((s) => s.trim())
				.filter(Boolean);
			if (parts.length) {
				const defaultName = parts[0];
				context[defaultName] = mod.default || mod[defaultName];
				if (parts[1] && parts[1].startsWith("{")) {
					let fields = parts[1]
						.slice(1, -1)
						.split(",")
						.map((f) => f.trim())
						.filter(Boolean);
					for (let field of fields) {
						let [orig, alias] = field.split(" as ").map((x) => x.trim());
						context[alias || orig] = mod[orig];
					}
				}
			}
		}
	}
	const dependencies = {};
	for (const imp of imports) {
		let specToCheck = imp.spec;
		if (specToCheck.startsWith("node:")) specToCheck = specToCheck.slice(5);
		if (builtins.has(specToCheck) || /^[\w@][\w\-/]*$/.test(specToCheck)) {
			dependencies[imp.spec] = await import(imp.spec);
		} else if (imp.spec.startsWith("file:")) {
			const childUrl = new URL(imp.spec, fileUrl).href;
			dependencies[imp.spec] = await loadEsmModuleFallback(context, childUrl, visited);
		} else {
			// Try to resolve relative path
			const childUrl = new URL(imp.spec, fileUrl).href;
			if (!childUrl.startsWith("file:")) {
				throw new Error(`Unsupported import specifier: ${imp.spec}`);
			}
			dependencies[imp.spec] = await loadEsmModuleFallback(context, childUrl, visited);
		}
	}
	// Prepare code for VM: remove static imports/exports, keep dynamic imports
	let evalCode = code
		// Remove static imports (including multiline, assertions)
		.replace(/import\s+[^;]*?;\s*/gs, "")
		// Remove import type statements
		.replace(/import\s+type\s+[^;]*?;\s*/gs, "")
		// Do NOT remove dynamic imports (import(...))
		// Remove export default statements, but keep the value
		.replace(/export\s+default\s+([\w$]+)/g, "")
		// Remove named export statements but keep the value
		.replace(/export\s+(const|let|var|function|class)\s+([\w$]+)/g, "$1 $2")
		// Remove other export statements
		.replace(/export\s+(default\s+)?/g, "")
		// Emulate import.meta.url
		.replace(/import\.meta\.url/g, JSON.stringify(fileUrl));
	// Track locally defined symbols (ignore those in comments)
	const localDefRegex = /(const|let|var|function|class)\s+([\w$]+)/g;
	let localDefs = new Set();
	let defMatch;
	while ((defMatch = localDefRegex.exec(code))) {
		if (!inComment(defMatch.index)) {
			localDefs.add(defMatch[2]);
		}
	}
	// Handle named exports: export const|let|var|function|class name ... (ignore those in comments)
	const namedExportRegex = /export\s+(const|let|var|function|class)\s+([\w$]+)/g;
	let namedExports = [];
	let namedMatch;
	while ((namedMatch = namedExportRegex.exec(code))) {
		if (!inComment(namedMatch.index) && localDefs.has(namedMatch[2])) {
			namedExports.push(namedMatch[2]);
		}
	}
	// Handle export default (ignore those in comments)
	let exportDefaultMatch = null;
	const exportDefaultRegex = /export\s+default\s+([\w$]+)/g;
	let exportDefaultMatchRaw;
	while ((exportDefaultMatchRaw = exportDefaultRegex.exec(code))) {
		if (!inComment(exportDefaultMatchRaw.index)) {
			exportDefaultMatch = exportDefaultMatchRaw;
			break;
		}
	}
	if (!context.__dynamicImport) {
		// Static import: assign exports to globalThis
		for (const name of namedExports) {
			evalCode += `\nglobalThis["${name}"] = ${name};`;
		}
		if (exportDefaultMatch) {
			evalCode += `\nglobalThis["default"] = ${exportDefaultMatch[1]};`;
		}
	}
	// Inject dependencies into context
	for (const [spec, ns] of Object.entries(dependencies)) {
		const modName = path.basename(spec, path.extname(spec));
		context[modName] = ns;
	}
	// Evaluate code in context
	const vm = await import("node:vm");
	const script = new vm.Script(evalCode, {
		filename: fileUrl,
		importModuleDynamically: async (specifier) => import(specifier)
	});
	script.runInContext(context);
	// For dynamic import, return only the namespace object (do not assign to globalThis)
	const namespace = {};
	for (const k of Object.keys(context)) {
		if (k !== "globalThis" && k !== "global") {
			namespace[k] = context[k];
		}
	}
	context[fileUrl] = namespace;
	return { namespace };
}

/**
 * Detects if a file is ESM based on extension or code content.
 * @param {string} fileUrl
 * @returns {Promise<boolean>}
 */
export async function isEsmFile(fileUrl) {
	const ext = path.extname(fileURLToPath(fileUrl)).toLowerCase();
	if (ext === ".mjs") return true;
	if (ext === ".cjs") return false;
	if (ext === ".js") {
		const code = await fs.readFile(fileURLToPath(fileUrl), "utf8");
		return /\bimport\b/.test(code);
	}
	return false;
}

/**
 * Example usage:
 * import { makeNodeishContext } from "./slothlet_helpers.mjs";
 * const context = makeNodeishContext();
 * const ns = await loadEsmModuleFallback(context, "file:///path/to/mod.mjs");
 */
