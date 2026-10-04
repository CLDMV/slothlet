/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/type-generator.mjs
 *	@Date: 2026-02-14T18:14:33-08:00 (1771121673)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:39 -07:00 (1791083019)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview TypeScript declaration file (.d.ts) generation
 * @module @cldmv/slothlet/processors/type-generator
 * @internal
 */

import fs from "fs";
import path from "path";
import { SlothletError } from "@cldmv/slothlet/errors";
import { resolveWrapper } from "#handlers/unified-wrapper";

/**
 * Root keys the framework owns: typed by `SlothletAPI` (extended below), never by the generated interface.
 * @type {Set<string>}
 * @private
 */
const FRAMEWORK_ROOT_KEYS = new Set(["slothlet", "shutdown", "destroy"]);

/**
 * Identifier test for an unquoted interface member name.
 * @type {RegExp}
 * @private
 */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Generate TypeScript declaration file for a Slothlet API
 * @param {object} api - The loaded Slothlet API (a live, composed instance)
 * @param {object} options - Generation options
 * @param {string} options.output - Output file path for .d.ts
 * @param {string} options.interfaceName - Name of the interface to generate
 * @param {boolean} [options.includeDocumentation=true] - Include the per-member comments that explain an
 *   `unknown` member (a member with no module origin). Accepted for compatibility; the explanation is
 *   always emitted, since an unexplained `unknown` is a worse surprise than one extra comment line.
 * @param {boolean} [options.augmentRuntime=true] - Extend `SlothletSelf` from `@cldmv/slothlet/runtime`
 *   with the generated interface, so an imported `self` is typed as the api. Turn it off when several
 *   generated interfaces live in one TypeScript program and only one of them should type `self`.
 * @returns {Promise<{output: string, filePath: string}>} Generated declaration and output path
 * @public
 *
 * @description
 * Every member references the export slothlet actually placed there — `typeof import("<leaf>")["k"]` —
 * read from the ownership records' module origin (#484), so the declaration carries each leaf's own
 * type (JSDoc, TypeScript, CommonJS alike) instead of a signature guessed from its file's syntax. A
 * namespace becomes a nested object of its members; a callable namespace intersects its function's
 * type with the members merged onto it; a member with no module origin is `unknown`, with a comment.
 */
export async function generateTypes(api, options) {
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

	const outputPath = path.resolve(options.output);
	const outputDir = path.dirname(outputPath);

	const context = {
		ownership: findOwnership(api),
		routineNames: findRoutineNames(api),
		outputDir
	};

	// Describe the api, then render it.
	const members = describeMembers(api, "", context, new Set());
	const declaration = generateDeclaration(members, options);

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
 * Find the ownership records behind a composed api by resolving any of its wrapper-backed members.
 * @param {*} api - The composed api.
 * @returns {object|null} The instance's `OwnershipManager`, or `null` for a value slothlet did not compose.
 * @private
 */
function findOwnership(api) {
	const inner = findInstance(api);
	return inner?.handlers?.ownership ?? null;
}

/**
 * Find the Slothlet instance behind a composed api (through the first wrapper-backed member).
 * @param {*} api - The composed api.
 * @returns {object|null} The instance, or `null`.
 * @private
 */
function findInstance(api) {
	if (!api || (typeof api !== "object" && typeof api !== "function")) return null;
	for (const key of Object.keys(api)) {
		if (FRAMEWORK_ROOT_KEYS.has(key)) continue;
		const wrapper = resolveWrapper(api[key]);
		if (wrapper?.slothlet) return wrapper.slothlet;
	}
	return null;
}

/**
 * The instance's configured routine names — their root slots hold the framework's routine cascade.
 * @param {*} api - The composed api.
 * @returns {Set<string>} Routine names (empty when unknown).
 * @private
 */
function findRoutineNames(api) {
	const routines = findInstance(api)?.config?.routines;
	return new Set(Array.isArray(routines) ? routines.map((routine) => routine?.name).filter(Boolean) : []);
}

/**
 * Describe the members of one api level.
 * @param {*} value - The level (the root api, or a namespace).
 * @param {string} apiPath - Dotted path of `value` ("" at the root).
 * @param {object} context - Shared generation state (`ownership`, `routineNames`, `outputDir`).
 * @param {Set<*>} ancestors - Values on the current descent path (cycle guard).
 * @returns {Array<{key: string, type: string, comment: (string|null)}>} One entry per member.
 * @private
 */
function describeMembers(value, apiPath, context, ancestors) {
	if (!value || (typeof value !== "object" && typeof value !== "function")) {
		return [];
	}
	if (ancestors.has(value)) return [];
	ancestors.add(value);
	try {
		const members = [];
		for (const key of Object.keys(value)) {
			// Skip internal properties and the framework's own root surface (typed by SlothletAPI).
			if (key.startsWith("_") || (apiPath === "" && FRAMEWORK_ROOT_KEYS.has(key))) {
				continue;
			}
			const childPath = apiPath ? `${apiPath}.${key}` : key;
			members.push({ key, ...describeNode(value[key], childPath, context, ancestors) });
		}
		return members;
	} finally {
		ancestors.delete(value);
	}
}

/**
 * Describe one api node as a TypeScript type expression.
 * @param {*} value - The node's live value.
 * @param {string} apiPath - Dotted api path of the node.
 * @param {object} context - Shared generation state.
 * @param {Set<*>} ancestors - Cycle guard.
 * @returns {{type: string, comment: (string|null)}} The type, plus a comment when it needs one.
 * @private
 */
function describeNode(value, apiPath, context, ancestors) {
	const origin = context.ownership?.getOrigin(apiPath) ?? null;
	const base = originType(origin, context);
	const isComposite = (typeof value === "object" && value !== null) || typeof value === "function";

	if (!base) {
		// The root slot of a configured routine holds the framework's routine cascade: it forwards its
		// arguments to every contribution and resolves to their result(s).
		if (apiPath.indexOf(".") === -1 && typeof value === "function" && context.routineNames.has(apiPath)) {
			return { type: "(...args: unknown[]) => Promise<unknown>", comment: `Routine cascade: runs every \`${apiPath}\` contribution.` };
		}
		const children = isComposite ? describeMembers(value, apiPath, context, ancestors) : [];
		if (children.length > 0) {
			const comment = typeof value === "function" ? "Callable with no module origin: only its members are typed." : null;
			return { type: renderObject(children, 1), comment };
		}
		return { type: "unknown", comment: noOriginReason(origin) };
	}

	// A member the base type already describes (it is that export's own property) is not repeated;
	// the rest — members merged onto an export from elsewhere — are added to it.
	const children = isComposite ? describeMembers(value, apiPath, context, ancestors) : [];
	const extra = children.filter((child) => !isCoveredBy(origin, context.ownership.getOrigin(`${apiPath}.${child.key}`)));
	if (extra.length === 0) {
		return { type: base, comment: null };
	}
	if (typeof value === "function") {
		return { type: `${base} & ${renderObject(extra, 1)}`, comment: null };
	}
	// A plain object export whose members were partly replaced or extended: drop the replaced keys from
	// the export's type so the placed values win, rather than intersecting two conflicting types.
	const omitted = extra.map((child) => JSON.stringify(child.key)).join(" | ");
	return { type: `Omit<${base}, ${omitted}> & ${renderObject(extra, 1)}`, comment: null };
}

/**
 * Whether a child's origin is exactly the parent export's own property of the same name.
 * @param {object} parentOrigin - The parent node's origin (with an exportPath).
 * @param {object|null} childOrigin - The child's origin.
 * @returns {boolean} True when the parent's type already describes the child.
 * @private
 */
function isCoveredBy(parentOrigin, childOrigin) {
	if (!childOrigin?.exportPath || childOrigin.filePath !== parentOrigin.filePath) return false;
	const parentPath = parentOrigin.exportPath;
	const childPath = childOrigin.exportPath;
	return childPath.length === parentPath.length + 1 && parentPath.every((segment, index) => segment === childPath[index]);
}

/**
 * Explain why a node is typed `unknown`.
 * @param {object|null} origin - The node's ownership origin, if any.
 * @returns {string} The explanation.
 * @private
 */
function noOriginReason(origin) {
	if (!origin) {
		return "No module origin: slothlet holds no ownership record for this member.";
	}
	return "No module origin: not an export of a module file (a runtime assignment, in-memory api.add() exports, or a slothlet-created value).";
}

/**
 * The `typeof import(...)` type of a node's originating export.
 * @param {object|null} origin - Ownership origin (`filePath` + `exportPath`).
 * @param {object} context - Shared generation state (`outputDir`, `ownership`).
 * @returns {string|null} The type expression, or `null` when the node has no module origin.
 * @private
 */
function originType(origin, context) {
	if (!origin?.exportPath || !origin.filePath) return null;
	let segments = origin.exportPath;
	// A CommonJS module's exports ARE `module.exports`; the loader exposes that object as `default`, but
	// TypeScript types `import("x.cjs")` itself as `module.exports` (its `["default"]` is not the same
	// type under NodeNext or Bundler), so the leading `default` segment is dropped.
	if (segments[0] === "default" && context.ownership.isCommonJSModule(origin.filePath)) {
		segments = segments.slice(1);
	}
	const access = segments.map((segment) => `[${JSON.stringify(segment)}]`).join("");
	return `typeof import(${JSON.stringify(importSpecifier(origin.filePath, context.outputDir))})${access}`;
}

/**
 * A relative import specifier from the generated file's directory to a leaf file, with the extension a
 * TypeScript import names at runtime (`.ts`→`.js`, `.mts`→`.mjs`, `.cts`→`.cjs`), so NodeNext and
 * Bundler resolution both find the source.
 * @param {string} filePath - Absolute leaf path.
 * @param {string} outputDir - Absolute directory of the generated file.
 * @returns {string} POSIX relative specifier starting with `./` or `../`.
 * @private
 */
function importSpecifier(filePath, outputDir) {
	let relative = path.relative(outputDir, filePath).split(path.sep).join("/");
	if (!relative.startsWith(".")) relative = `./${relative}`;
	return relative.replace(/\.(m|c)?ts$/, (____match, kind) => `.${kind ?? ""}js`).replace(/\.tsx$/, ".jsx");
}

/**
 * Render members as an object type literal.
 * @param {Array<{key: string, type: string, comment: (string|null)}>} members - Members to render.
 * @param {number} indent - Indentation depth of the members.
 * @returns {string} The object type (`{ ... }`).
 * @private
 */
function renderObject(members, indent) {
	const lines = ["{"];
	renderMembers(members, indent, lines);
	lines.push(`${"\t".repeat(indent - 1)}}`);
	return lines.join("\n");
}

/**
 * Append rendered members to `lines`, nesting object types one level deeper.
 * @param {Array<{key: string, type: string, comment: (string|null)}>} members - Members to render.
 * @param {number} indent - Indentation depth.
 * @param {string[]} lines - Output lines.
 * @returns {void}
 * @private
 */
function renderMembers(members, indent, lines) {
	const pad = "\t".repeat(indent);
	for (const { key, type, comment } of members) {
		if (comment) lines.push(`${pad}/** ${comment} */`);
		const name = IDENTIFIER.test(key) ? key : JSON.stringify(key);
		// Nested object literals were rendered at depth 1; re-indent them to this member's depth.
		const reindented = type.split("\n").join(`\n${pad}`);
		lines.push(`${pad}${name}: ${reindented};`);
	}
}

/**
 * Generate TypeScript declaration file content
 * @param {Array<{key: string, type: string, comment: (string|null)}>} members - Root members.
 * @param {object} options - Generation options
 * @returns {string} Declaration file content
 * @private
 */
function generateDeclaration(members, options) {
	const interfaceName = options.interfaceName;
	const augment = options.augmentRuntime !== false;
	const lines = [];

	lines.push("/**");
	lines.push(` * Generated TypeScript declarations for Slothlet API`);
	lines.push(` * @generated ${new Date().toISOString()}`);
	lines.push(" */");
	lines.push("");

	if (augment) {
		lines.push(`import type { SlothletAPI } from "@cldmv/slothlet";`);
		lines.push("");
	}

	lines.push(`export interface ${interfaceName} {`);
	renderMembers(members, 1, lines);
	lines.push("}");
	lines.push("");

	// Type `self` for every leaf that imports it (#484). `self` is declared as the empty
	// `SlothletSelf` class in `@cldmv/slothlet/runtime`; an interface of the same name merges into
	// that class, so extending it here gives `self.*` the api's full shape in .ts, .mts and
	// JSDoc-checked .mjs/.cjs leaves alike. (A `declare const self` in this file would be scoped to
	// this module — the file has top-level exports — and could not retype an imported binding.)
	// `self` is the same bound api `slothlet()` returns, so it also carries the framework surface
	// (`self.slothlet.*`, `self.shutdown()`), which `SlothletAPI` describes. The two heritage clauses
	// merge into one `SlothletSelf` that extends both.
	if (augment) {
		lines.push(`declare module "@cldmv/slothlet/runtime" {`);
		lines.push(`\tinterface SlothletSelf extends ${interfaceName} {}`);
		lines.push(`\tinterface SlothletSelf extends SlothletAPI {}`);
		lines.push("}");
		lines.push("");
	}

	return lines.join("\n");
}
