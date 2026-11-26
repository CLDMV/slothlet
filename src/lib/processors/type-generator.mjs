/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/type-generator.mjs
 *	@Date: 2026-02-14T18:14:33-08:00 (1771121673)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:18:28-08:00 (1795634308)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview TypeScript declaration file (.d.ts) generation
 * @module @cldmv/slothlet/processors/type-generator
 * @internal
 */

import * as nodeFs from "fs";
import * as nodePath from "path";
import { SlothletError } from "#errors";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { docLinesFor } from "#processors/type-docs";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	Date,
	DateMethods,
	filterList,
	JSON,
	listPush,
	Map,
	mapList,
	Objects,
	RegExpMethods,
	regExpReplace,
	Set,
	setFrom,
	SetMethods,
	splitText,
	StringMethods
} from "#helpers/intrinsics";

// Node's built-ins, as slothlet loaded: frozen copies of their members (see helpers/platform), so code that replaces one
// on Node's module object later does not run here.
const fs = Objects.freeze({ ...nodeFs });
const path = Objects.freeze({ ...nodePath });
const { resolveWrapper, runtime_rootFileOf } = unifiedWrapperInternals("lib/processors/type-generator");

/**
 * Root keys the framework owns: typed by `SlothletAPI` (extended below), never by the generated interface.
 * @type {Set<string>}
 * @private
 */
const FRAMEWORK_ROOT_KEYS = setFrom(["slothlet", "shutdown", "destroy"]);

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
 * @param {boolean} [options.includeDocumentation=true] - Copy each member's JSDoc from its originating export
 *   (description, `@param`, `@returns`, `@deprecated`, `@example`) onto the generated member, so hovering
 *   `api.x.y` or `self.x.y` shows the leaf's documentation. `false` leaves members without it. The comment that
 *   explains an `unknown` member (one with no module origin) is emitted either way.
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
			value: options.output
		});
	}

	if (!options.interfaceName) {
		throw new SlothletError("INVALID_CONFIG", {
			option: "types.interfaceName",
			expected: "a string interface name",
			value: options.interfaceName
		});
	}

	const outputPath = path.resolve(options.output);
	const outputDir = path.dirname(outputPath);

	const context = {
		ownership: findOwnership(api),
		routineNames: findRoutineNames(api),
		outputDir,
		docs: options.includeDocumentation !== false ? new Map() : null
	};

	// Describe the api, then render it.
	const members = describeMembers(api, "", context, new Set());
	const declaration = generateDeclaration(members, options, rootCallType(api, context), rootCallDocs(api, context));

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
 * The type of the api root's function when the root is one (#803): its root file's default export, as a member's type
 * is its export's. `api()` and a module's `self()` call it.
 * @param {*} api - The composed api.
 * @param {object} context - Shared generation state (`ownership`, `outputDir`).
 * @returns {string|null} The type expression, or `null` for an object root (or a root with no module file).
 * @private
 */
function rootCallType(api, context) {
	if (typeof api !== "function" || !context.ownership) return null;
	const instance = findInstance(api);
	const filePath = instance ? runtime_rootFileOf(instance) : null;
	return filePath ? originType({ filePath, exportPath: ["default"] }, context) : null;
}

/**
 * The JSDoc of the api root's function (its root file's default export), when documentation is on.
 * @param {*} api - The composed api.
 * @param {object} context - Shared generation state (`ownership`, `docs`).
 * @returns {string[]|null} The comment lines, or `null`.
 * @private
 */
function rootCallDocs(api, context) {
	if (!context.docs || typeof api !== "function" || !context.ownership) return null;
	const instance = findInstance(api);
	const filePath = instance ? runtime_rootFileOf(instance) : null;
	return filePath ? docLinesFor({ filePath, exportPath: ["default"] }, context.docs) : null;
}

/**
 * The JSDoc lines for a node's origin, when documentation is on.
 * @param {object|null} origin - The node's ownership origin.
 * @param {object} context - Shared generation state (`docs` is the per-run file cache, or `null` when off).
 * @returns {string[]|null} The comment lines, or `null`.
 * @private
 */
function nodeDocs(origin, context) {
	return context.docs ? docLinesFor(origin, context.docs) : null;
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
	for (let ofIndex = 0, ofList = Objects.keys(api); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (SetMethods.has(FRAMEWORK_ROOT_KEYS, key)) continue;
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
	const routines = findInstance(api)?.config?.routines?.entries;
	return setFrom(
		Arrays.isArray(routines)
			? filterList(
					mapList(routines, (routine) => routine?.name),
					Boolean
				)
			: []
	);
}

/**
 * Describe the members of one api level.
 * @param {*} value - The level (the root api, or a namespace).
 * @param {string} apiPath - Dotted path of `value` ("" at the root).
 * @param {object} context - Shared generation state (`ownership`, `routineNames`, `outputDir`).
 * @param {Set<*>} ancestors - Values on the current descent path (cycle guard).
 * @returns {Array<{key: string, type: string, comment: (string|null), docs?: (string[]|null)}>} One entry per member.
 * @private
 */
function describeMembers(value, apiPath, context, ancestors) {
	if (!value || (typeof value !== "object" && typeof value !== "function")) {
		return [];
	}
	if (SetMethods.has(ancestors, value)) return [];
	SetMethods.add(ancestors, value);
	try {
		const members = [];
		for (let ofIndex = 0, ofList = Objects.keys(value); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			// Skip the framework's reserved names and its own root surface (typed by SlothletAPI). A module's
			// `_`/`__`-prefixed export is a member of the api like any other, so it is typed.
			if (isFrameworkReservedKey(key) || (apiPath === "" && SetMethods.has(FRAMEWORK_ROOT_KEYS, key))) {
				continue;
			}
			const childPath = apiPath ? `${apiPath}.${key}` : key;
			listPush(members, { key, ...describeNode(value[key], childPath, context, ancestors) });
		}
		return members;
	} finally {
		SetMethods.delete(ancestors, value);
	}
}

/**
 * Describe one api node as a TypeScript type expression.
 * @param {*} value - The node's live value.
 * @param {string} apiPath - Dotted api path of the node.
 * @param {object} context - Shared generation state.
 * @param {Set<*>} ancestors - Cycle guard.
 * @returns {{type: string, comment: (string|null), docs: (string[]|null)}} The type, plus a comment when it needs
 *   one and the export's JSDoc lines when documentation is on.
 * @private
 */
function describeNode(value, apiPath, context, ancestors) {
	const origin = context.ownership?.getOrigin(apiPath) ?? null;
	const base = originType(origin, context);
	const isComposite = (typeof value === "object" && value !== null) || typeof value === "function";

	if (!base) {
		// The root slot of a configured routine holds the framework's routine cascade: it forwards its
		// arguments to every contribution and resolves to their result(s).
		if (StringMethods.indexOf(apiPath, ".") === -1 && typeof value === "function" && SetMethods.has(context.routineNames, apiPath)) {
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
	const extra = filterList(children, (child) => !isCoveredBy(origin, context.ownership.getOrigin(`${apiPath}.${child.key}`)));
	const docs = nodeDocs(origin, context);
	if (extra.length === 0) {
		return { type: base, comment: null, docs };
	}
	if (typeof value === "function") {
		return { type: `${base} & ${renderObject(extra, 1)}`, comment: null, docs };
	}
	// A plain object export whose members were partly replaced or extended: drop the replaced keys from
	// the export's type so the placed values win, rather than intersecting two conflicting types.
	const omitted = ArrayMethods.join(
		mapList(extra, (child) => JSON.stringify(child.key)),
		" | "
	);
	return { type: `Omit<${base}, ${omitted}> & ${renderObject(extra, 1)}`, comment: null, docs };
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
	return childPath.length === parentPath.length + 1 && ArrayMethods.every(parentPath, (segment, index) => segment === childPath[index]);
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
		segments = copyList(segments, 1);
	}
	const access = ArrayMethods.join(
		mapList(segments, (segment) => `[${JSON.stringify(segment)}]`),
		""
	);
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
	let relative = ArrayMethods.join(splitText(path.relative(outputDir, filePath), path.sep), "/");
	if (!StringMethods.startsWith(relative, ".")) relative = `./${relative}`;
	return regExpReplace(
		/\.tsx$/,
		regExpReplace(/\.(m|c)?ts$/, relative, (____match, kind) => `.${kind ?? ""}js`),
		".jsx"
	);
}

/**
 * Render members as an object type literal.
 * @param {Array<{key: string, type: string, comment: (string|null), docs?: (string[]|null)}>} members - Members to render.
 * @param {number} indent - Indentation depth of the members.
 * @returns {string} The object type (`{ ... }`).
 * @private
 */
function renderObject(members, indent) {
	const lines = ["{"];
	renderMembers(members, indent, lines);
	listPush(lines, `${StringMethods.repeat("\t", indent - 1)}}`);
	return ArrayMethods.join(lines, "\n");
}

/**
 * Append rendered members to `lines`, nesting object types one level deeper.
 * @param {Array<{key: string, type: string, comment: (string|null), docs?: (string[]|null)}>} members - Members to render.
 * @param {number} indent - Indentation depth.
 * @param {string[]} lines - Output lines.
 * @returns {void}
 * @private
 */
function renderMembers(members, indent, lines) {
	const pad = StringMethods.repeat("\t", indent);
	for (let ofIndex = 0, ofList = members; ofIndex < ofList.length; ofIndex++) {
		const { key, type, comment, docs } = ofList[ofIndex];
		if (docs) renderDocBlock(docs, comment, pad, lines);
		else if (comment) listPush(lines, `${pad}/** ${comment} */`);
		const name = RegExpMethods.exec(IDENTIFIER, key) !== null ? key : JSON.stringify(key);
		// Nested object literals were rendered at depth 1; re-indent them to this member's depth.
		const reindented = ArrayMethods.join(splitText(type, "\n"), `\n${pad}`);
		listPush(lines, `${pad}${name}: ${reindented};`);
	}
}

/**
 * Append a JSDoc block: the copied documentation lines, then the generator's own note when the member has one.
 * @param {string[]} docs - Comment content lines (already escaped).
 * @param {string|null} note - The generator's comment for the member, if any.
 * @param {string} pad - Indentation.
 * @param {string[]} lines - Output lines.
 * @returns {void}
 * @private
 */
function renderDocBlock(docs, note, pad, lines) {
	const content = note ? concatLists(docs, ["", note]) : docs;
	if (content.length === 1) {
		listPush(lines, `${pad}/** ${content[0]} */`);
		return;
	}
	listPush(lines, `${pad}/**`);
	for (let lineIndex = 0; lineIndex < content.length; lineIndex++) {
		listPush(lines, content[lineIndex] ? `${pad} * ${content[lineIndex]}` : `${pad} *`);
	}
	listPush(lines, `${pad} */`);
}

/**
 * Generate TypeScript declaration file content
 * @param {Array<{key: string, type: string, comment: (string|null), docs?: (string[]|null)}>} members - Root members.
 * @param {object} options - Generation options
 * @param {string|null} [rootCall=null] - The api root function's type, when the root is a function (#803).
 * @param {string[]|null} [rootDocs=null] - The root function's JSDoc lines, when documentation is on.
 * @returns {string} Declaration file content
 * @private
 */
function generateDeclaration(members, options, rootCall = null, rootDocs = null) {
	const interfaceName = options.interfaceName;
	const augment = options.augmentRuntime !== false;
	const lines = [];

	listPush(lines, "/**");
	listPush(lines, ` * Generated TypeScript declarations for Slothlet API`);
	listPush(lines, ` * @generated ${DateMethods.toISOString(new Date())}`);
	listPush(lines, " */");
	listPush(lines, "");

	if (augment) {
		listPush(lines, `import type { SlothletAPI } from "@cldmv/slothlet";`);
		listPush(lines, "");
	}

	listPush(lines, `export interface ${interfaceName} {`);
	// A function root makes the api, and `self`, callable as that function (#803). Its arguments and result are taken
	// from the function's own type; the call signature is inherited by `SlothletSelf` below.
	if (rootCall) {
		const fn = `Extract<${rootCall}, (...args: any[]) => any>`;
		const note = "The api root's own function (`api()`, and `self()` in a leaf).";
		if (rootDocs) renderDocBlock(rootDocs, note, "\t", lines);
		else listPush(lines, `\t/** ${note} */`);
		listPush(lines, `\t(...args: Parameters<${fn}>): ReturnType<${fn}>;`);
	}
	renderMembers(members, 1, lines);
	listPush(lines, "}");
	listPush(lines, "");

	// Type `self` for every leaf that imports it (#484). `self` is declared as the empty
	// `SlothletSelf` class in `@cldmv/slothlet/runtime`; an interface of the same name merges into
	// that class, so extending it here gives `self.*` the api's full shape in .ts, .mts and
	// JSDoc-checked .mjs/.cjs leaves alike. (A `declare const self` in this file would be scoped to
	// this module — the file has top-level exports — and could not retype an imported binding.)
	// `self` is the same bound api `slothlet()` returns, so it also carries the framework surface
	// (`self.slothlet.*`, `self.shutdown()`), which `SlothletAPI` describes. The two heritage clauses
	// merge into one `SlothletSelf` that extends both.
	if (augment) {
		listPush(lines, `declare module "@cldmv/slothlet/runtime" {`);
		listPush(lines, `\tinterface SlothletSelf extends ${interfaceName} {}`);
		listPush(lines, `\tinterface SlothletSelf extends SlothletAPI {}`);
		listPush(lines, "}");
		listPush(lines, "");
	}

	return ArrayMethods.join(lines, "\n");
}
