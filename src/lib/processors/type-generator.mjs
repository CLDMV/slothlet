/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/type-generator.mjs
 *	@Date: 2026-02-14T18:14:33-08:00 (1771121673)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:38 -08:00 (1772425298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TypeScript declaration file (.d.ts) generation
 * @module @cldmv/slothlet/processors/type-generator
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
		// unreachable via tests (2026-03-04): typescript devDependency, always installed
		/* v8 ignore next */
		} catch (error) {
			throw new SlothletError("TYPESCRIPT_NOT_INSTALLED", { feature: "type-generation" }, error);
		}
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

	// Extract type information from source files
	for (const node of nodes) {
		if (node.metadata?.filePath) {
			node.typeInfo = await extractTypesFromFile(node.metadata.filePath, ts);
		}
	}

	// Generate declaration content
	const declaration = generateDeclaration(nodes, options);

	// Write to file
	const outputPath = path.resolve(options.output);
	const outputDir = path.dirname(outputPath);

	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

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
 * Extract type information from a source file
 * @param {string} filePath - Path to source file
 * @param {object} ts - TypeScript compiler instance
 * @returns {Promise<object>} Type information
 * @private
 */
async function extractTypesFromFile(filePath, ts) {
	try {
		const source = fs.readFileSync(filePath, "utf8");
		const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

		const exports = [];

		// Visit all nodes to find exports
		function visit(node) {
			// export function foo(...): ...
			if (ts.isFunctionDeclaration(node) && node.name) {
				const hasExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
				if (hasExport) {
					exports.push({
						name: node.name.text,
						type: "function",
						signature: extractFunctionSignature(node, source, ts)
					});
				}
			}

			// export const foo = (...) => ... OR export const foo = function(...) { ... }
			if (ts.isVariableStatement(node)) {
				const hasExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
				if (hasExport) {
					for (const decl of node.declarationList.declarations) {
						if (!decl.name || !ts.isIdentifier(decl.name)) continue;
						const init = decl.initializer;
						if (!init) continue;
						if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
							exports.push({
								name: decl.name.text,
								type: "function",
								signature: extractFunctionSignature(init, source, ts)
							});
						}
					}
				}
			}

			ts.forEachChild(node, visit);
		}

		visit(sourceFile);

		return { exports, sourceFile };
	} catch (error) {
		// If we can't parse the file, return empty type info
		return { exports: [] };
	}
}

/**
 * Extract function signature from AST node
 * @param {object} node - Function declaration node
 * @param {string} source - Source code
 * @param {object} ts - TypeScript compiler instance
 * @returns {string} Function signature
 * @private
 */
function extractFunctionSignature(node, source, ts) {
	const params = node.parameters
		.map((p) => {
			const name = p.name.getText(node.getSourceFile());
			const type = p.type ? p.type.getText(node.getSourceFile()) : "any";
			return `${name}: ${type}`;
		})
		.join(", ");

	const returnType = node.type ? node.type.getText(node.getSourceFile()) : "any";

	return `(${params}): ${returnType}`;
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
		if (value.type === "function") {
			lines.push(`${indentation}${key}${value.signature};`);
		} else if (typeof value === "object" && value !== null) {
			// Intermediate container object — recurse into it
			lines.push(`${indentation}${key}: {`);
			generateInterfaceContent(value, lines, indent + 1);
			lines.push(`${indentation}};`);
		}
	}
}
