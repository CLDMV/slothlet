/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/ci/eslint-captured-intrinsics.mjs
 *	@Date: 2026-11-13T01:04:06-08:00 (1794560646)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:51:35-08:00 (1794635495)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview ESLint rule: code in `src/` uses the built-ins `src/lib/helpers/intrinsics.mjs` took when slothlet
 * loaded, not the globals of the same name.
 *
 * @description
 * Module code shares the realm with slothlet and can assign `globalThis.Map`, `Object.keys`, `Date.now` or
 * `globalThis.String` after slothlet has loaded. `helpers/intrinsics` reads them once, at load, and every file of
 * `src/` imports what it uses from there. This rule reports:
 *
 * - a reference to any global variable that no import or declaration of the file binds (`new Map()`, `String(x)`,
 *   `Date.now()`, `new TypeError(…)`, `queueMicrotask(fn)`, `process.cwd()`, `console.warn(…)`), whether ESLint knows it
 *   as a configured global or not. Only `undefined`, `NaN` and `Infinity` (which the language makes read-only) and
 *   `globalThis` itself are left alone;
 * - a member read off one of the captured constructors other than `prototype` (and the members listed in
 *   `KEPT_MEMBERS`), whether the constructor is the global or the captured one: `Promise.resolve`, `Symbol.for`,
 *   `Date.now` and `NativeObject.keys` read a member a module can replace on the shared constructor. Their captured
 *   forms are `Promises.*`, `Symbols.*`, `Dates.*` and `Objects.*`. An import renamed (`import { Error as E }`) is
 *   checked by the name it imports;
 * - a member of one of Node's built-in modules read while slothlet runs rather than when the file loads: off what
 *   `process.getBuiltinModule(…)` or a helper of slothlet's around it (`nodeBuiltin(…)`, `builtin(…)`) returns, off
 *   `import("node:…")`, off `createRequire(…)("node:…")`, off a default or namespace import of a built-in, off a
 *   variable holding one of those, and the destructuring of one. Module code can replace `fs.readFileSync` or
 *   `module.createRequire` on Node's module object (and refresh the ES module namespaces with
 *   `module.syncBuiltinESMExports()`) after slothlet loads. A read at the file's top level, in a function called
 *   there and nowhere else, or in a function run on the spot there, happens as the file loads and is the capture; keep
 *   what it takes and call that. Named imports of a built-in are live bindings for the same reason: one used outside
 *   load is reported. Members of Node's loader state that slothlet patches or reads on purpose as they are
 *   (`KEPT_NODE_MEMBERS`) are left alone;
 * - a comment that turns this rule off: there are no exemptions.
 *
 * Code that has to reach the current global on purpose reads it as `globalThis.X`, with a one-line reason beside it.
 * `helpers/intrinsics` itself reads every global that way.
 *
 * Wired in `.configs/eslint.config.mjs` for `src/**`, so `npm run lint` (and the pre-commit hook) fail on a new use.
 */

import { builtinModules } from "node:module";

/**
 * The names Node's built-in modules can be imported by, with and without the `node:` scheme.
 * @type {Set<string>}
 */
const NODE_MODULE_NAMES = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

/**
 * Whether an import specifier names one of Node's built-in modules.
 * @param {*} specifier - The specifier.
 * @returns {boolean} True for a built-in.
 */
const isNodeSpecifier = (specifier) => typeof specifier === "string" && (specifier.startsWith("node:") || NODE_MODULE_NAMES.has(specifier));

/**
 * Names of the functions that hand out a Node built-in module: `process.getBuiltinModule` and slothlet's helpers around
 * it (`nodeBuiltin`, `builtin`, `runtime_builtin`).
 * @type {RegExp}
 */
const BUILTIN_GETTER = /(?:^|_|get)(?:node)?builtin(?:module)?$/i;

/**
 * Members read off a Node built-in module on purpose, as they are when read: Node's loader state slothlet patches or
 * reads (`Module._load`, `Module._resolveFilename`, `Module._cache`), and the `async_hooks` classes the boundary patch
 * layers onto (it covers whatever is in place when it is turned on).
 * @type {Set<string>}
 */
const KEPT_NODE_MEMBERS = new Set(["_load", "_resolveFilename", "_cache", "AsyncResource", "AsyncLocalStorage"]);

/**
 * Whether a node is a function.
 * @param {object} node - An AST node.
 * @returns {boolean} True for a function.
 */
const isFunction = (node) =>
	node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";

/**
 * Globals the language makes read-only, and `globalThis` itself.
 * @type {Set<string>}
 */
const LANGUAGE_CONSTANTS = new Set(["undefined", "NaN", "Infinity", "globalThis"]);

/**
 * Global names whose captured copy goes by another name.
 * @type {Record<string, string>}
 */
const RENAMED = {
	Object: "Objects (static functions) or NativeObject (the function)",
	Array: "Arrays",
	Function: "Functions",
	Proxy: "NativeProxy",
	process: "NativeProcess (data members) or Processes (functions)"
};

/**
 * Names `helpers/intrinsics` exports under the global's own name: a reference to the global is reported, and the
 * import of the same name is what to use.
 * @type {Set<string>}
 */
const SAME_NAME = new Set([
	"Reflect",
	"JSON",
	"Math",
	"Intl",
	"Map",
	"Set",
	"WeakMap",
	"WeakSet",
	"WeakRef",
	"Promise",
	"Symbol",
	"URL",
	"URLSearchParams",
	"String",
	"Boolean",
	"Number",
	"BigInt",
	"Date",
	"RegExp",
	"Error",
	"EvalError",
	"RangeError",
	"ReferenceError",
	"SyntaxError",
	"TypeError",
	"URIError",
	"AggregateError",
	"ArrayBuffer",
	"SharedArrayBuffer",
	"DataView",
	"Int8Array",
	"Uint8Array",
	"Uint8ClampedArray",
	"Int16Array",
	"Uint16Array",
	"Int32Array",
	"Uint32Array",
	"Float16Array",
	"Float32Array",
	"Float64Array",
	"BigInt64Array",
	"BigUint64Array",
	"FinalizationRegistry",
	"Iterator",
	"TextDecoder",
	"TextEncoder",
	"Blob",
	"EventTarget",
	"MessageChannel",
	"CryptoKey",
	"queueMicrotask",
	"structuredClone",
	"setTimeout",
	"setImmediate",
	"decodeURIComponent",
	"encodeURIComponent",
	"parseInt",
	"isNaN",
	"Buffer",
	"navigator"
]);

/**
 * Captured constructors and host objects whose own members (other than `prototype`) a module can replace. Reading such
 * a member is reported on the global and on the captured binding alike; the value names the frozen copy to use.
 * @type {Record<string, string>}
 */
const CONSTRUCTORS = {
	Map: "",
	Set: "",
	WeakMap: "",
	WeakSet: "",
	WeakRef: "",
	Promise: "Promises",
	Symbol: "Symbols",
	URL: "",
	URLSearchParams: "",
	NativeObject: "Objects",
	NativeProxy: "",
	String: "Strings",
	Boolean: "",
	Number: "Numbers",
	BigInt: "",
	Date: "Dates",
	RegExp: "",
	Error: "Errors",
	EvalError: "",
	RangeError: "",
	ReferenceError: "",
	SyntaxError: "",
	TypeError: "",
	URIError: "",
	AggregateError: "",
	ArrayBuffer: "ArrayBuffers",
	SharedArrayBuffer: "",
	DataView: "",
	Int8Array: "",
	Uint8Array: "",
	Uint8ClampedArray: "",
	Int16Array: "",
	Uint16Array: "",
	Int32Array: "",
	Uint32Array: "",
	Float16Array: "",
	Float32Array: "",
	Float64Array: "",
	BigInt64Array: "",
	BigUint64Array: "",
	FinalizationRegistry: "",
	Iterator: "Iterators",
	TextDecoder: "",
	TextEncoder: "",
	Blob: "",
	EventTarget: "",
	MessageChannel: "",
	CryptoKey: "",
	Buffer: "Buffers",
	NativeProcess: "Processes",
	navigator: ""
};

/**
 * Members read off a captured constructor or host object on purpose, as they are when read:
 * - `Error.stackTraceLimit` and `Error.prepareStackTrace` are what the engine reads off the realm's `Error` when it
 *   makes a stack; slothlet saves, sets and restores them around the stacks it reads;
 * - the data members of `process` and `navigator`: the host's configuration (`env`, the locale) as it is now;
 * - every well-known symbol of `Symbol`, which the language makes read-only (`Symbol.for` and `Symbol.keyFor` are not).
 * @type {Record<string, Set<string>>}
 */
const KEPT_MEMBERS = {
	Error: new Set(["stackTraceLimit", "prepareStackTrace"]),
	NativeProcess: new Set(["env", "pid", "argv", "versions", "platform", "execArgv"]),
	navigator: new Set(["language", "languages"])
};

/** The import source of the captured copies. */
const INTRINSICS = "@cldmv/slothlet/helpers/intrinsics";

/** A directive comment that turns rules off, with the rules it names (none: every rule). */
const DIRECTIVE = /^\s*eslint-disable(?:-next-line|-line)?(?:\s+(?<rules>.*))?$/s;

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
	meta: {
		type: "problem",
		docs: { description: "Use the built-ins helpers/intrinsics captured when slothlet loaded, not the globals" },
		schema: [],
		messages: {
			global:
				"`{{name}}` here is the global, which module code can replace after slothlet loads. Import {{use}} from @cldmv/slothlet/helpers/intrinsics.",
			unknown:
				"`{{name}}` here is a global, which module code can replace after slothlet loads. Take it in @cldmv/slothlet/helpers/intrinsics and import it, or read the current one as `globalThis.{{name}}` with a one-line reason.",
			member: "`{{name}}.{{member}}` reads a member module code can replace on the shared constructor.{{use}}",
			directive: "slothlet/captured-intrinsics has no exemptions: import the captured copy, or read the current global as `globalThis.X`.",
			nodeMember:
				"`{{name}}` reads a member of a Node built-in module after slothlet loaded, which module code can replace by then. Take it when the file loads (at its top level) and call that copy.",
			nodeBinding:
				"`{{name}}` is a live binding of a Node built-in module, which `module.syncBuiltinESMExports()` changes. Take it when the file loads (at its top level) and call that copy."
		}
	},
	create(context) {
		const sourceCode = context.sourceCode;
		/**
		 * Report a member read off a constructor, other than `prototype` or a member it keeps on purpose.
		 * @param {object} identifier - The constructor's identifier node.
		 * @param {string} name - The constructor's name (the imported name, for an import).
		 */
		const checkMember = (identifier, name) => {
			const parent = identifier.parent;
			if (parent?.type !== "MemberExpression" || parent.object !== identifier) return;
			const member = parent.computed ? null : parent.property.name;
			if (member === "prototype") return;
			// The well-known symbols are non-writable, non-configurable members of `Symbol`.
			if (name === "Symbol" && member !== "for" && member !== "keyFor") return;
			if (member !== null && KEPT_MEMBERS[name]?.has(member)) return;
			const copy = CONSTRUCTORS[name];
			context.report({
				node: parent,
				messageId: "member",
				data: { name, member: member ?? "[…]", use: copy ? ` Use ${copy}.${member ?? "[…]"}.` : "" }
			});
		};
		/**
		 * The variable an identifier refers to, from the scope it is in.
		 * @param {object} identifier - The identifier node.
		 * @returns {object|null} The variable, or null for a global.
		 */
		const variableOf = (identifier) => {
			for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
				const variable = scope.set.get(identifier.name);
				if (variable) return variable;
			}
			return null;
		};
		/**
		 * Whether an expression is one of Node's built-in modules, or an object one of them holds (`util.types`).
		 * @param {object} node - The expression.
		 * @param {number} [depth=0] - How many variables have been followed.
		 * @returns {boolean} True for such a value.
		 */
		const isNodeModule = (node, depth = 0) => {
			if (!node || depth > 8) return false;
			switch (node.type) {
				case "ChainExpression":
					return isNodeModule(node.expression, depth);
				case "AwaitExpression":
					return isNodeModule(node.argument, depth);
				case "ImportExpression":
					return isNodeSpecifier(node.source?.value);
				case "LogicalExpression":
					return isNodeModule(node.left, depth) || isNodeModule(node.right, depth);
				case "ConditionalExpression":
					return isNodeModule(node.consequent, depth) || isNodeModule(node.alternate, depth);
				case "MemberExpression":
					return isNodeModule(node.object, depth);
				case "CallExpression": {
					const callee = node.callee.type === "ChainExpression" ? node.callee.expression : node.callee;
					const name =
						callee.type === "Identifier"
							? callee.name
							: callee.type === "MemberExpression" && !callee.computed
								? callee.property.name
								: null;
					if (name !== null && BUILTIN_GETTER.test(name)) return true;
					// `createRequire(…)("node:…")`.
					if (callee.type === "CallExpression" && isNodeSpecifier(node.arguments[0]?.value)) {
						const inner = callee.callee;
						const innerName = inner.type === "Identifier" ? inner.name : inner.type === "MemberExpression" ? inner.property.name : null;
						if (innerName === "createRequire") return true;
					}
					return false;
				}
				case "Identifier": {
					const variable = variableOf(node);
					if (!variable) return false;
					for (const def of variable.defs) {
						if (def.type === "ImportBinding") {
							if (isNodeSpecifier(def.parent?.source?.value) && def.node.type !== "ImportSpecifier") return true;
						} else if (def.type === "Variable" && def.node.id.type === "Identifier" && isNodeModule(def.node.init, depth + 1)) {
							return true;
						}
					}
					return false;
				}
				default:
					return false;
			}
		};
		/**
		 * Whether a function runs only while the file loads: run on the spot where the file loads, or declared and only
		 * ever called where the file loads. An async function or a generator runs on past the load, so never.
		 * @param {object} fn - The function node.
		 * @param {Set<object>} seen - The functions being looked at (a recursion runs at load only if something else calls it there).
		 * @returns {boolean} True for such a function.
		 */
		const runsAtLoad = (fn, seen) => {
			if (fn.async || fn.generator || seen.has(fn)) return false;
			seen.add(fn);
			if (fn.parent.type === "CallExpression" && fn.parent.callee === fn) return isLoadTime(fn.parent, seen);
			let declared = null;
			// An exported function is called by other files, when they choose.
			if (fn.parent.type === "ExportNamedDeclaration" || fn.parent.type === "ExportDefaultDeclaration") return false;
			if (fn.parent.parent?.parent?.type === "ExportNamedDeclaration") return false;
			if (fn.type === "FunctionDeclaration") declared = fn;
			else if (fn.parent.type === "VariableDeclarator" && fn.parent.init === fn && fn.parent.id.type === "Identifier") declared = fn.parent;
			if (declared === null) return false;
			const variable = sourceCode.getDeclaredVariables(declared).find((candidate) => candidate.defs.length > 0);
			const calls = (variable?.references ?? []).filter((reference) => !reference.init);
			if (calls.length === 0) return false;
			return calls.every(
				({ identifier }) =>
					identifier.parent.type === "CallExpression" && identifier.parent.callee === identifier && isLoadTime(identifier.parent, seen)
			);
		};
		/**
		 * Whether code runs while the file loads: at its top level, outside every function but those that run there (see
		 * {@link runsAtLoad}), and outside the methods of a class.
		 * @param {object} node - The code.
		 * @param {Set<object>} [seen] - See {@link runsAtLoad}.
		 * @returns {boolean} True when it runs as the file loads.
		 */
		const isLoadTime = (node, seen = new Set()) => {
			for (let at = node.parent; at; at = at.parent) {
				if (isFunction(at)) return runsAtLoad(at, seen);
			}
			return true;
		};
		return {
			MemberExpression(node) {
				if (!isNodeModule(node.object) || isLoadTime(node)) return;
				const member = node.computed ? null : node.property.name;
				if (member !== null && KEPT_NODE_MEMBERS.has(member)) return;
				// One report per chain (`util.types.isProxy`): the read nearest the module, unless that one is kept.
				const inner = node.object.type === "ChainExpression" ? node.object.expression : node.object;
				if (
					inner.type === "MemberExpression" &&
					isNodeModule(inner.object) &&
					!(!inner.computed && KEPT_NODE_MEMBERS.has(inner.property.name))
				)
					return;
				context.report({ node, messageId: "nodeMember", data: { name: sourceCode.getText(node) } });
			},
			VariableDeclarator(node) {
				if (node.id.type !== "ObjectPattern" || !isNodeModule(node.init) || isLoadTime(node)) return;
				context.report({ node: node.id, messageId: "nodeMember", data: { name: sourceCode.getText(node.id) } });
			},
			AssignmentExpression(node) {
				if (node.left.type !== "ObjectPattern" || !isNodeModule(node.right) || isLoadTime(node)) return;
				context.report({ node: node.left, messageId: "nodeMember", data: { name: sourceCode.getText(node.left) } });
			},
			ImportDeclaration(node) {
				if (!isNodeSpecifier(node.source.value)) return;
				for (const variable of sourceCode.getDeclaredVariables(node)) {
					if (variable.defs[0]?.node.type !== "ImportSpecifier") continue;
					for (const reference of variable.references) {
						if (!isLoadTime(reference.identifier)) {
							context.report({ node: reference.identifier, messageId: "nodeBinding", data: { name: variable.name } });
						}
					}
				}
			},
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					const match = DIRECTIVE.exec(comment.value);
					if (!match) continue;
					// What follows ` -- ` is the directive's description, not a rule.
					const rules = (match.groups.rules ?? "").split(/\s--\s|\s--$/)[0].trim();
					if (!rules || rules.split(/\s*,\s*/).includes("slothlet/captured-intrinsics")) {
						context.report({ loc: comment.loc, messageId: "directive" });
					}
				}
			},
			"Program:exit"() {
				const globalScope = sourceCode.scopeManager.globalScope;
				// ESLint resolves a configured global (globals.node, globals.browser) to a variable of the global scope
				// with no definition; a name no configuration declares stays among the scope's unresolved references.
				const references = [...globalScope.through];
				for (const variable of globalScope.variables) {
					if (variable.defs.length === 0) references.push(...variable.references);
				}
				for (const reference of references) {
					const identifier = reference.identifier;
					const name = identifier.name;
					if (LANGUAGE_CONSTANTS.has(name)) continue;
					if (Object.hasOwn(CONSTRUCTORS, name)) checkMember(identifier, name);
					if (Object.hasOwn(RENAMED, name)) {
						context.report({ node: identifier, messageId: "global", data: { name, use: RENAMED[name] } });
					} else if (SAME_NAME.has(name)) {
						context.report({ node: identifier, messageId: "global", data: { name, use: `\`${name}\`` } });
					} else {
						context.report({ node: identifier, messageId: "unknown", data: { name } });
					}
				}
				// The captured constructors themselves: bindings imported from helpers/intrinsics, by the name imported.
				const moduleScope = globalScope.childScopes.find((scope) => scope.type === "module");
				if (!moduleScope) return;
				for (const variable of moduleScope.variables) {
					const def = variable.defs.find((candidate) => candidate.type === "ImportBinding");
					if (!def || def.parent?.source?.value !== INTRINSICS) continue;
					const imported = def.node.imported?.name ?? variable.name;
					if (!Object.hasOwn(CONSTRUCTORS, imported)) continue;
					for (const ref of variable.references) checkMember(ref.identifier, imported);
				}
			}
		};
	}
};

export default { rules: { "captured-intrinsics": rule } };
