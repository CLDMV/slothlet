/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/typescript.mjs
 *	@Date: 2026-02-14T14:39:47-08:00 (1771108787)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:39 -08:00 (1772425299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TypeScript file transformation using esbuild (fast mode)
 * @module @cldmv/slothlet/processors/typescript
 */

// NO static imports of esbuild/typescript - only dynamic imports when needed
import fs from "fs";
import path from "path";
import { SlothletError } from "@cldmv/slothlet/errors";

let esbuildInstance = null;
let typescriptInstance = null;

/**
 * Lazy-load esbuild to avoid requiring installation when not using TypeScript
 * @returns {Promise<object>} esbuild module
 * @throws {SlothletError} TYPESCRIPT_ESBUILD_NOT_INSTALLED if esbuild is not installed
 * @private
 */
async function getEsbuild() {
	if (!esbuildInstance) {
		try {
			esbuildInstance = await import("esbuild");
		// istanbul ignore next — unreachable via tests (2026-03-04): `esbuild` is a
		// devDependency of this package and is always installed; the catch only fires
		// when the package is absent, which cannot occur in a normal install.
		} catch (error) {
			throw new SlothletError(
				"TYPESCRIPT_ESBUILD_NOT_INSTALLED",
				{ mode: "fast" },
				error
			);
		}
	}
	return esbuildInstance;
}

/**
 * Lazy-load TypeScript compiler to avoid requiring installation when not using strict mode
 * @returns {Promise<object>} typescript module
 * @throws {SlothletError} TYPESCRIPT_TSC_NOT_INSTALLED if typescript is not installed
 * @private
 */
async function getTypeScript() {
	if (!typescriptInstance) {
		try {
			typescriptInstance = await import("typescript");
		// istanbul ignore next — unreachable via tests (2026-03-04): `typescript` is a
		// devDependency of this package and is always installed; the catch only fires
		// when the package is absent, which cannot occur in a normal install.
		} catch (error) {
			throw new SlothletError(
				"TYPESCRIPT_TSC_NOT_INSTALLED",
				{ mode: "strict" },
				error
			);
		}
	}
	return typescriptInstance;
}

/**
 * Transform TypeScript code to JavaScript using esbuild
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} [options={}] - esbuild transform options
 * @param {string} [options.target] - ECMAScript target version (default: "es2020")
 * @param {string} [options.format] - Module format (default: "esm")
 * @param {boolean} [options.sourcemap] - Generate source maps (default: false)
 * @returns {Promise<string>} Transformed JavaScript code
 * @throws {SlothletError} If transformation fails
 * @public
 */
export async function transformTypeScript(filePath, options = {}) {
	const esbuild = await getEsbuild(); // Lazy load - only when actually needed
	const code = fs.readFileSync(filePath, "utf8");
	
	const result = await esbuild.transform(code, {
		loader: "ts",
		format: options.format || "esm",
		target: options.target || "es2020",
		sourcemap: options.sourcemap || false,
		...options
	});
	
	return result.code;
}

/**
 * Create a data URL for dynamic import with cache busting
 * @param {string} code - JavaScript code to encode
 * @returns {string} Data URL suitable for dynamic import
 * @public
 */
export function createDataUrl(code) {
	// Use proper JavaScript MIME type
	const encoded = encodeURIComponent(code);
	const timestamp = Date.now();
	return `data:text/javascript;charset=utf-8,${encoded}#t=${timestamp}`;
}

/**
 * Transform TypeScript code to JavaScript using tsc with type checking
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} [options={}] - TypeScript compiler options
 * @param {string} [options.target] - ECMAScript target version (default: "ES2020")
 * @param {string} [options.module] - Module format (default: "ESNext")
 * @param {boolean} [options.strict] - Enable strict type checking (default: true)
 * @param {boolean} [options.skipTypeCheck] - Skip type checking and only transform (default: false)
 * @param {string} [options.typeDefinitionPath] - Path to .d.ts file for type checking
 * @returns {Promise<{code: string, diagnostics: object[]}>} Transformed code and type diagnostics
 * @throws {SlothletError} If transformation fails
 * @public
 */
export async function transformTypeScriptStrict(filePath, options = {}) {
	const ts = await getTypeScript(); // Lazy load - only when actually needed
	const code = fs.readFileSync(filePath, "utf8");
	
	// Map target string to ScriptTarget enum
	const targetMap = {
		es3: ts.ScriptTarget.ES3,
		es5: ts.ScriptTarget.ES5,
		es6: ts.ScriptTarget.ES2015,
		es2015: ts.ScriptTarget.ES2015,
		es2016: ts.ScriptTarget.ES2016,
		es2017: ts.ScriptTarget.ES2017,
		es2018: ts.ScriptTarget.ES2018,
		es2019: ts.ScriptTarget.ES2019,
		es2020: ts.ScriptTarget.ES2020,
		es2021: ts.ScriptTarget.ES2021,
		es2022: ts.ScriptTarget.ES2022,
		esnext: ts.ScriptTarget.ESNext,
		latest: ts.ScriptTarget.Latest
	};
	
	// Map module string to ModuleKind enum
	const moduleMap = {
		none: ts.ModuleKind.None,
		commonjs: ts.ModuleKind.CommonJS,
		amd: ts.ModuleKind.AMD,
		system: ts.ModuleKind.System,
		umd: ts.ModuleKind.UMD,
		es6: ts.ModuleKind.ES2015,
		es2015: ts.ModuleKind.ES2015,
		es2020: ts.ModuleKind.ES2020,
		es2022: ts.ModuleKind.ES2022,
		esnext: ts.ModuleKind.ESNext,
		node16: ts.ModuleKind.Node16,
		nodenext: ts.ModuleKind.NodeNext
	};
	
	const targetKey = (options.target || "es2020").toLowerCase();
	const moduleKey = (options.module || "esnext").toLowerCase();
	
	const compilerOptions = {
		target: targetMap[targetKey] || ts.ScriptTarget.ES2020,
		module: moduleMap[moduleKey] || ts.ModuleKind.ESNext,
		strict: options.strict !== false,
		esModuleInterop: true,
		skipLibCheck: true,
		noEmit: false, // We need emit for transformation
		...(options.typeDefinitionPath && {
			typeRoots: [path.dirname(options.typeDefinitionPath)],
			types: [path.basename(options.typeDefinitionPath, '.d.ts')]
		}),
		...options.compilerOptions
	};
	
	// Perform type checking using Program API if not skipped
	let diagnostics = [];
	if (!options.skipTypeCheck) {
		// Create a temporary in-memory compiler host
		const host = ts.createCompilerHost(compilerOptions);
		
		// Override readFile to provide our code
		const originalReadFile = host.readFile;
		host.readFile = (fileName) => {
			if (fileName === filePath) {
				return code;
			}
			return originalReadFile.call(host, fileName);
		};
		
		// Create program with single file
		const program = ts.createProgram([filePath], compilerOptions, host);
		
		// Get all diagnostics (semantic + syntactic)
		const allDiagnostics = [
			...program.getSemanticDiagnostics(),
			...program.getSyntacticDiagnostics()
		];
		
		// Filter to only this file's diagnostics
		diagnostics = allDiagnostics.filter(d => d.file && d.file.fileName === filePath);
	}
	
	// Transform using transpileModule (fast, doesn't require full type checking)
	const result = ts.transpileModule(code, {
		compilerOptions,
		fileName: filePath
	});
	
	return {
		code: result.outputText,
		diagnostics
	};
}

/**
 * Format TypeScript diagnostics into readable error messages
 * @param {object[]} diagnostics - TypeScript diagnostic objects
 * @param {object} ts - TypeScript module instance
 * @returns {string[]} Array of formatted error messages
 * @private
 */
export function formatDiagnostics(diagnostics, ts) {
	return diagnostics.map(diagnostic => {
		const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
		if (diagnostic.file && diagnostic.start !== undefined) {
			const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			const fileName = diagnostic.file.fileName;
			return `${fileName}:${line + 1}:${character + 1} - ${message}`;
		}
		return message;
	});
}
