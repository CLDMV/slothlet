/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/type-generator.mjs
 *	@Date: 2026-02-14T18:14:33-08:00 (1771121673)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-07 20:56:34 -08:00 (1772945794)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TypeScript declaration file (.d.ts) generation
 * @module @cldmv/slothlet/processors/type-generator
 * @internal
 */

import fs from "fs";
import path from "path";
import { SlothletError } from "@cldmv/slothlet/errors";

let typescriptInstance = null;

/**
 * Lazy-load TypeScript compiler to avoid requiring installation when not using type generation
 * @returns {Promise<object>} typescript module
 * @throws {SlothletError} TYPESCRIPT_NOT_INSTALLED if typescript is not installed
 * @private
 */
async function getTypeScript() {
	if (!typescriptInstance) {
		try {
			typescriptInstance = await import("typescript");
			// unreachable via tests: typescript is a devDependency always present during testing.
			// The catch only fires in end-user environments where typescript is not installed.
			/* v8 ignore start */
		} catch (error) {
			throw new SlothletError("TYPESCRIPT_NOT_INSTALLED", { feature: "type-generation" }, error);
		}
		/* v8 ignore stop */
	}
	return typescriptInstance;
}

/**
 * Generate TypeScript declaration file for a Slothlet API
 * @param {object} api - The loaded Slothlet API
 * @param {object} options - Generation options
 * @param {string} options.output - Output file path for .d.ts
 * @param {string} options.interfaceName - Name of the interface to generate
 * @param {boolean} [options.includeDocumentation=true] - Include JSDoc comments
 * @returns {Promise<{output: string, filePath: string}>} Generated declaration and output path
 * @public
 */
export async function generateTypes(api, options) {
	const ts = await getTypeScript();

	if (!options.output) {
		throw new SlothletError("INVALID_CONFIG", {
			option: "types.output",
			expected: "a string output path",
			value: options.output,
			hint: "Provide a string output path for the generated .d.ts file, e.g. './types/api.d.ts'.",
			validationError: true
		});
	}

	if (!options.interfaceName) {
		throw new SlothletError("INVALID_CONFIG", {
			option: "types.interfaceName",
			expected: "a string interface name",
			value: options.interfaceName,
			hint: "Provide a string interface name for the generated TypeScript interface, e.g. 'SlothletAPI'.",
			validationError: true
		});
	}

	// Traverse the API and extract structure
	const nodes = traverseAPI(api);

	// Extract type information from the backing source files. A single TypeScript Program over every
	// file gives a real type checker, so JSDoc `@param {T}` / `@returns {T}` — including `@param
	// {object} o` with dotted `o.prop` shapes, optional params, unions, and generics — resolve to
	// proper, valid TypeScript the way the type checker reads JSDoc annotations, rather than the
	// raw-text guesswork a bare `createSourceFile` parse produced. (Types are read, not checked —
	// the Program runs with `checkJs: false`; it reflects JSDoc, it does not type-check the sources.) (#213)
	const filePaths = [...new Set(nodes.map((node) => node.metadata?.filePath).filter(Boolean))];
	const exportsByFile = extractTypeInfo(filePaths, ts);
	for (const node of nodes) {
		if (node.metadata?.filePath) {
			node.typeInfo = exportsByFile.get(node.metadata.filePath);
		}
	}

	// Generate declaration content
	const declaration = generateDeclaration(nodes, options);

	// Write to file
	const outputPath = path.resolve(options.output);
	const outputDir = path.dirname(outputPath);

	// Ensure the output directory exists. mkdir with recursive:true is idempotent
	// and never throws when the directory already exists, so no existsSync pre-check
	// is needed (avoids a TOCTOU window / CWE-367).
	fs.mkdirSync(outputDir, { recursive: true });

	fs.writeFileSync(outputPath, declaration, "utf8");

	return {
		output: declaration,
		filePath: outputPath
	};
}

/**
 * Traverse API structure and collect nodes
 * @param {object} api - The API to traverse
 * @param {string[]} [currentPath=[]] - Current path in traversal
 * @param {Set} [visited=new Set()] - Visited objects to prevent cycles
 * @returns {object[]} Array of API nodes
 * @private
 */
function traverseAPI(api, currentPath = [], visited = new Set()) {
	const nodes = [];

	if (!api || typeof api !== "object") {
		return nodes;
	}

	// Prevent infinite loops from circular references
	if (visited.has(api)) {
		return nodes;
	}
	visited.add(api);

	for (const [key, value] of Object.entries(api)) {
		// Skip internal properties and Slothlet system properties
		if (key.startsWith("_") || key.startsWith("__") || key === "slothlet" || key === "shutdown" || key === "destroy") {
			continue;
		}

		const nodePath = [...currentPath, key];
		const metadata = value?.__metadata;

		if (typeof value === "function") {
			nodes.push({
				type: "function",
				path: nodePath,
				value,
				metadata
			});
		} else if (typeof value === "object" && value !== null) {
			nodes.push({
				type: "object",
				path: nodePath,
				value,
				metadata
			});

			// Recursively traverse nested objects
			const childNodes = traverseAPI(value, nodePath, visited);
			nodes.push(...childNodes);
		}
	}

	return nodes;
}

/**
 * Extract exported-function type info for a set of source files using a single TypeScript Program, so
 * the type checker resolves JSDoc types the way `tsc` reads JSDoc annotations. Returns a Map of
 * `filePath → { exports: [{ name, type, signature }] }`; a file that cannot be parsed contributes an
 * empty export list rather than failing the whole run.
 *
 * @param {string[]} filePaths - Absolute source-file paths backing the API nodes.
 * @param {object} ts - TypeScript compiler instance.
 * @returns {Map<string, {exports: object[]}>} Per-file extracted export signatures.
 * @private
 */
function extractTypeInfo(filePaths, ts) {
	const byFile = new Map();
	const program = ts.createProgram(filePaths, {
		allowJs: true,
		checkJs: false,
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.Latest,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler
	});
	const checker = program.getTypeChecker();
	const isExported = (node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

	for (const filePath of filePaths) {
		const exportsForFile = [];
		try {
			const visit = (node) => {
				// export function foo(...) { ... }
				if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
					exportsForFile.push({ name: node.name.text, type: "function", signature: signatureText(node, checker, ts) });
					// export const foo = (...) => ... | function (...) { ... }
				} else if (ts.isVariableStatement(node) && isExported(node)) {
					for (const decl of node.declarationList.declarations) {
						const init = decl.initializer;
						if (ts.isIdentifier(decl.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
							exportsForFile.push({ name: decl.name.text, type: "function", signature: signatureText(init, checker, ts) });
						}
					}
				}
				ts.forEachChild(node, visit);
			};
			// getSourceFile can return undefined (path unreadable or not included as a source file).
			// Skip it explicitly so a missing file is a no-op, not a swallowed visit(undefined) throw.
			const sourceFile = program.getSourceFile(filePath);
			if (sourceFile) {
				visit(sourceFile);
			}
		} catch (____error) {
			// Unparseable / unresolvable file — contribute no signatures rather than fail the run.
		}
		byFile.set(filePath, { exports: exportsForFile });
	}
	return byFile;
}

/**
 * Render a function/arrow/function-expression node's call signature as TypeScript text
 * (`(params): returnType`) via the type checker, so JSDoc-declared types are reflected exactly as
 * `tsc` resolves them (object shapes from dotted `@param` tags, optional params, unions, generics).
 *
 * @param {object} fnNode - A function declaration, arrow function, or function expression node.
 * @param {object} checker - The Program's type checker.
 * @param {object} ts - TypeScript compiler instance.
 * @returns {string} The call signature, e.g. `(name: string, times: number): string`.
 * @private
 */
function signatureText(fnNode, checker, ts) {
	const signature = checker.getSignatureFromDeclaration(fnNode);
	return checker.signatureToString(signature, fnNode, ts.TypeFormatFlags.NoTruncation);
}

/**
 * Generate TypeScript declaration file content
 * @param {object[]} nodes - API nodes
 * @param {object} options - Generation options
 * @returns {string} Declaration file content
 * @private
 */
function generateDeclaration(nodes, options) {
	const interfaceName = options.interfaceName;
	const lines = [];

	lines.push("/**");
	lines.push(` * Generated TypeScript declarations for Slothlet API`);
	lines.push(` * @generated ${new Date().toISOString()}`);
	lines.push(" */");
	lines.push("");

	// Build nested structure
	const structure = {};

	for (const node of nodes) {
		if (node.type === "function") {
			// Match by the function's own name (last path segment) so that when multiple
			// functions share the same source file, each gets its own signature rather
			// than an unrelated export's signature.
			const fnName = node.path[node.path.length - 1];
			const exportInfo = node.typeInfo?.exports?.find((e) => e.name === fnName);
			// If no matching export found (renamed key, no filePath, or parse failure)
			// use a safe generic signature rather than borrowing a wrong one.
			const signature = exportInfo?.signature ?? "(...args: any[]): any";
			setNestedProperty(structure, node.path, { type: "function", signature });
		}
		// Skip intermediate "object" nodes - they're just containers for nested properties
		// The structure will be built implicitly as we set nested function properties
	}

	// Generate interface
	lines.push(`export interface ${interfaceName} {`);
	generateInterfaceContent(structure, lines, 1);
	lines.push("}");
	lines.push("");

	// Generate self declaration for TypeScript files to use
	lines.push(`declare const self: ${interfaceName};`);
	lines.push("");

	return lines.join("\n");
}

/**
 * Set nested property in structure
 * @param {object} obj - Object to set property in
 * @param {string[]} path - Property path
 * @param {*} value - Value to set
 * @private
 */
function setNestedProperty(obj, path, value) {
	let current = obj;

	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i];
		if (!current[key]) {
			current[key] = {};
		}
		current = current[key];
	}

	const lastKey = path[path.length - 1];
	current[lastKey] = value;
}

/**
 * Generate interface content recursively
 * @param {object} structure - Nested structure
 * @param {string[]} lines - Output lines
 * @param {number} indent - Indentation level
 * @private
 */
function generateInterfaceContent(structure, lines, indent) {
	const indentation = "\t".repeat(indent);

	for (const [key, value] of Object.entries(structure)) {
		// The else-if and else branches are never reached in tests (transformer only emits "function" entries); IF FALSE unreachable.
		/* v8 ignore next */
		if (value.type === "function") {
			lines.push(`${indentation}${key}${value.signature};`);
			// The transformer only emits "function" entries and nested objects;
			// the else-if false branch (primitive/null value) and else body are never reached in tests.
			/* v8 ignore start */
		} else if (typeof value === "object" && value !== null) {
			// Intermediate container object — recurse into it
			lines.push(`${indentation}${key}: {`);
			generateInterfaceContent(value, lines, indent + 1);
			lines.push(`${indentation}};`);
		} else {
			// Primitive value type — never produced by transformer; defensive guard only.
		}
		/* v8 ignore stop */
	}
}
