/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tools/ci/eslint-captured-intrinsics.mjs
 *	@Date: 2026-11-13T01:04:06-08:00 (1794560646)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:18-08:00 (1795869198)
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
 * - a member read off the `prototype` of one of them (`Objects.prototype.hasOwnProperty`, `Promise.prototype.then`,
 *   `Map.prototype[name]`), anywhere in the file, its top level included: the prototype object is fixed, but its
 *   members are not, and a file of slothlet's can load after module code has run. Its captured forms are the
 *   `…Methods` (`ObjectMethods.hasOwnProperty(value, key)`) and `PrototypeFunctions` (the function itself). Writing a
 *   member (`EventTarget.prototype.addEventListener = patch`) is not a read; the reads `KEPT_PROTOTYPE_MEMBERS` lists
 *   are made on purpose;
 * - the same prototype handed to something that reads its members by key, anywhere in the file, its top level
 *   included: `getOwnPropertyDescriptor(RegExp.prototype, "source")` (and `getOwnPropertyDescriptors`), a
 *   `getPrototypeOf` of it, or a function of the file's own (`getterOf(DataView.prototype, "byteLength")`). Its captured
 *   form is `PrototypeFunctions`, which takes accessors as their getters (`PrototypeFunctions.RegExp.source`);
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

/**
 * Members read off a captured constructor's `prototype` on purpose, as they are when read: the `EventTarget` boundary
 * patch layers its listener methods over whatever is installed when it is turned on (another copy of slothlet's
 * patch, or the host's), as the `EventEmitter` patch does over `node:events`, and restores what it found.
 * @type {Record<string, Set<string>>}
 */
const KEPT_PROTOTYPE_MEMBERS = {
	EventTarget: new Set(["addEventListener", "removeEventListener"])
};

/**
 * Descriptors read off a captured constructor's `prototype` on purpose, as they are when read: the promise patch layers
 * its `then` over whatever descriptor is installed when it is turned on, and restores it; settling a promise checks that
 * `constructor` is still the one taken at load before handing back the promise the engine's `then` made.
 * @type {Record<string, Set<string>>}
 */
const KEPT_DESCRIPTOR_READS = {
	Promise: new Set(["then", "constructor"])
};

/**
 * Functions that read a prototype handed to them by key (or its own prototype): reported for a captured constructor's
 * `prototype`, as a member read off it is.
 * @type {Set<string>}
 */
const PROTOTYPE_READERS = new Set(["getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "getPrototypeOf"]);

/**
 * Captured holders of a built-in's data members whose `prototype` is the built-in's: a member read off it is reported
 * like one read off a captured constructor's.
 * @type {Set<string>}
 */
const PROTOTYPE_HOLDERS = new Set(["Objects", "Functions", "Arrays", "NativeFunction", "NativeArray"]);

/** The import source of the captured copies. */
const INTRINSICS = "#helpers/intrinsics";

/** The helper that hands out Node's built-in modules (`fs`, `path`, …) and slothlet's own copies of them. */
const PLATFORM = "#helpers/platform";

/** A directive comment that turns rules off, with the rules it names (none: every rule). */
const DIRECTIVE = /^\s*eslint-disable(?:-next-line|-line)?(?:\s+(?<rules>.*))?$/s;

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
	meta: {
		type: "problem",
		docs: { description: "Use the built-ins helpers/intrinsics captured when slothlet loaded, not the globals" },
		schema: [],
		messages: {
			global: "`{{name}}` here is the global, which module code can replace after slothlet loads. Import {{use}} from #helpers/intrinsics.",
			unknown:
				"`{{name}}` here is a global, which module code can replace after slothlet loads. Take it in #helpers/intrinsics and import it, or read the current one as `globalThis.{{name}}` with a one-line reason.",
			member: "`{{name}}.{{member}}` reads a member module code can replace on the shared constructor.{{use}}",
			prototypeMember:
				"`{{text}}` reads a member module code can replace on the shared prototype. Call the copy taken at load, `{{builtin}}Methods.{{member}}(value, …)`, or take the function itself as `PrototypeFunctions.{{builtin}}.{{member}}`, from #helpers/intrinsics.",
			prototypeHanded:
				"`{{text}}` reads the shared prototype's members (or its prototype) when it runs, which module code can replace by then, a file of slothlet's top level included. Take the function or getter from `PrototypeFunctions.{{builtin}}` in #helpers/intrinsics (add it there if it is missing).",
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
			if (member === "prototype") {
				checkPrototypeMember(parent, name);
				return;
			}
			if (!Object.hasOwn(CONSTRUCTORS, name)) return;
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
		 * Report a member read off a captured constructor's `prototype`, other than one it keeps on purpose. Writing the
		 * member (the target of an assignment) is not a read.
		 * @param {object} prototypeRead - The `X.prototype` member expression.
		 * @param {string} name - The constructor's name (the imported name, for an import).
		 */
		const checkPrototypeMember = (prototypeRead, name) => {
			const read = prototypeRead.parent;
			if (read?.type === "CallExpression" && read.arguments.includes(prototypeRead)) {
				checkPrototypeHanded(read, prototypeRead, name);
				return;
			}
			if (read?.type !== "MemberExpression" || read.object !== prototypeRead) return;
			if (read.parent?.type === "AssignmentExpression" && read.parent.left === read) return;
			const member = read.computed ? null : read.property.name;
			if (member !== null && KEPT_PROTOTYPE_MEMBERS[name]?.has(member)) return;
			const builtin =
				{
					Objects: "Object",
					NativeObject: "Object",
					Functions: "Function",
					NativeFunction: "Function",
					Arrays: "Array",
					NativeArray: "Array"
				}[name] ?? name;
			context.report({
				node: read,
				messageId: "prototypeMember",
				data: { text: sourceCode.getText(read), builtin, member: member ?? "[…]" }
			});
		};
		/**
		 * Report a captured constructor's `prototype` handed to a function that reads its members by key: one of
		 * {@link PROTOTYPE_READERS}, or a function of the file's own. A key read on purpose is left alone.
		 * @param {object} call - The call expression.
		 * @param {object} prototypeRead - The `X.prototype` argument.
		 * @param {string} name - The constructor's name (the imported name, for an import).
		 */
		const checkPrototypeHanded = (call, prototypeRead, name) => {
			const callee = call.callee.type === "ChainExpression" ? call.callee.expression : call.callee;
			const calleeName =
				callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" && !callee.computed ? callee.property.name : null;
			if (calleeName === null) return;
			let reads = PROTOTYPE_READERS.has(calleeName);
			if (!reads && callee.type === "Identifier") {
				const def = variableOf(callee)?.defs[0];
				reads =
					def?.type === "FunctionName" ||
					(def?.type === "Variable" && def.node.init !== null && def.node.init !== undefined && isFunction(def.node.init));
			}
			if (!reads) return;
			const key = call.arguments[call.arguments.indexOf(prototypeRead) + 1];
			if (key?.type === "Literal" && KEPT_DESCRIPTOR_READS[name]?.has(String(key.value))) return;
			const builtin =
				{
					Objects: "Object",
					NativeObject: "Object",
					Functions: "Function",
					NativeFunction: "Function",
					Arrays: "Array",
					NativeArray: "Array"
				}[name] ?? name;
			context.report({ node: call, messageId: "prototypeHanded", data: { text: sourceCode.getText(call).slice(0, 80), builtin } });
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
					const named = rules.split(/\s*,\s*/);
					if (!rules || named.includes("slothlet/captured-intrinsics") || named.includes("slothlet/captured-prototype-methods")) {
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
					if (!Object.hasOwn(CONSTRUCTORS, imported) && !PROTOTYPE_HOLDERS.has(imported)) continue;
					for (const ref of variable.references) checkMember(ref.identifier, imported);
				}
			}
		};
	}
};

/**
 * Methods the built-in prototypes hold, by name: a call `value.name(…)` with one of these names looks the method up on
 * the value's prototype when it runs, where module code can have replaced it. `then`, `catch` and `finally` are left
 * out: slothlet calls them on values module code hands it (a listener's result), and `await` reads `then` itself.
 * @type {Set<string>}
 */
const PROTOTYPE_METHODS = (() => {
	const names = new Set();
	const prototypes = [
		Array.prototype,
		String.prototype,
		Map.prototype,
		Set.prototype,
		WeakMap.prototype,
		WeakSet.prototype,
		WeakRef.prototype,
		Function.prototype,
		Object.prototype,
		RegExp.prototype,
		Date.prototype,
		Number.prototype,
		URLSearchParams.prototype,
		FinalizationRegistry.prototype
	];
	for (const proto of prototypes) {
		for (const name of Object.getOwnPropertyNames(proto)) {
			if (name !== "constructor" && typeof Object.getOwnPropertyDescriptor(proto, name).value === "function") names.add(name);
		}
	}
	for (const name of ["then", "catch", "finally"]) names.delete(name);
	return names;
})();

/**
 * The helpers of `helpers/intrinsics` that walk a `Map`, a `Set`, an array or a generator with the functions taken at
 * load: `for…of` (and `yield*`) over a call of one of these reads nothing module code can replace. A file names helpers
 * of its own that hand out such walks in the rule's `safeIterators` option.
 * @type {Set<string>}
 */
const SAFE_ITERATORS = new Set(["mapEntries", "mapKeys", "mapValues", "setValues", "generatorSteps", "asyncGeneratorSteps", "listSteps"]);

/**
 * Captured statics that walk their argument with its iterator, and what to use instead.
 * @type {Record<string, Record<string, string>>}
 */
const ITERATING_STATICS = {
	Arrays: { from: "copyList, mapList or setToArray" },
	Objects: { fromEntries: "objectFromEntries" },
	Promises: { all: "promiseAll", allSettled: "promiseAllSettled", race: "an indexed loop", any: "an indexed loop" }
};

/** @type {import("eslint").Rule.RuleModule} */
const prototypeRule = {
	meta: {
		type: "problem",
		docs: { description: "Call the methods built-in values inherit through the copies helpers/intrinsics took at load" },
		schema: [
			{
				type: "object",
				properties: { safeIterators: { type: "array", items: { type: "string" } } },
				additionalProperties: false
			}
		],
		messages: {
			method:
				"`{{text}}` looks `{{name}}` up on the value's prototype when it runs, which module code can replace after slothlet loads. Call the copy taken at load (`ArrayMethods.{{name}}(value, …)`, `StringMethods.…`, `MapMethods.…`) from #helpers/intrinsics.",
			forOf:
				"`for…of` asks the value for its iterator and steps it with `next`, both of which module code can replace. Walk an array by index, or a Map, Set or generator through mapEntries, mapKeys, mapValues, setValues or generatorSteps.",
			spread:
				"Spreading walks the value with its iterator, which module code can replace. Use copyList, concatLists, setToArray, appendList, or Reflect.apply / Reflect.construct with an array.",
			pattern: "Array destructuring walks the value with its iterator, which module code can replace. Read the elements by index.",
			delegate:
				"`yield*` walks the value with its iterator, which module code can replace. Loop over it by index or through a safe iterator.",
			iterating: "`{{text}}` walks its argument with the argument's iterator, which module code can replace. Use {{use}}.",
			arrayWrite:
				"`ArrayMethods.{{name}}` writes elements through any setter module code put at an index of the shared prototypes, or reads the array's `constructor` and `Symbol.species`. Use {{use}} from #helpers/intrinsics.",
			descriptor:
				"A property descriptor slothlet makes inherits `Object.prototype`, where module code can add `get`, `set` or `value`: give it `__proto__: null`.",
			construct:
				"`new {{name}}(…)` with an argument walks it with its iterator, which module code can replace. Construct it empty and add with the copies taken at load (setFrom, mapFrom)."
		}
	},
	create(context) {
		const sourceCode = context.sourceCode;
		const filename = context.filename ?? context.getFilename();
		// helpers/intrinsics takes the built-ins themselves.
		if (/[\\/]helpers[\\/]intrinsics\.mjs$/.test(filename)) return {};
		const safeIterators = new Set([...SAFE_ITERATORS, ...(context.options[0]?.safeIterators ?? [])]);
		/**
		 * Whether an expression is a call of a helper that hands out a walk reading nothing module code can replace.
		 * @param {object} node - The expression.
		 * @returns {boolean} True for such a call.
		 */
		const isSafeWalk = (node) => node.type === "CallExpression" && node.callee.type === "Identifier" && safeIterators.has(node.callee.name);
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
		 * Whether code runs while the file loads: outside every function. Module code cannot have run yet then.
		 * @param {object} node - The code.
		 * @returns {boolean} True at the file's top level.
		 */
		const atTopLevel = (node) => {
			for (let at = node.parent; at; at = at.parent)
				if (isFunction(at) || at.type === "MethodDefinition" || at.type === "PropertyDefinition") return false;
			return true;
		};
		/**
		 * Whether a receiver is one whose methods are not the built-in prototypes': slothlet's own objects (`this`,
		 * `super`, its handlers and managers), a binding imported from helpers/intrinsics or from a Node built-in module,
		 * or a variable holding a Node built-in module.
		 * @param {object} node - The receiver expression.
		 * @returns {boolean} True for such a receiver.
		 */
		const ownReceiver = (node, depth = 0) => {
			if (node.type === "ThisExpression" || node.type === "Super") return true;
			// An instance of a class constructed on the spot: its methods are that class's.
			if (node.type === "NewExpression") return true;
			const text = sourceCode.getText(node);
			if (/(^|\.)(handlers\??\.\w+|\w*[mM]anager|#\w*[mM]anager|ownership|\w*[hH]andler)$/.test(text)) return true;
			if (node.type !== "Identifier" || depth > 4) return false;
			const variable = variableOf(node);
			if (!variable) return false;
			for (const def of variable.defs) {
				if (def.type === "ImportBinding") {
					const from = def.parent?.source?.value;
					// helpers/platform hands out Node's built-in modules (null in a browser).
					if (from === INTRINSICS || from === PLATFORM || isNodeSpecifier(from)) return true;
				}
				if (def.type !== "Variable" || !def.node.init) continue;
				const init = def.node.init;
				// An object literal of slothlet's own: its methods are its own members.
				if (init.type === "ObjectExpression") return true;
				if (init.type === "Identifier" || init.type === "MemberExpression" || init.type === "ChainExpression")
					return ownReceiver(init.type === "ChainExpression" ? init.expression : init, depth + 1);
				if (init.type !== "CallExpression") continue;
				const callee = init.callee;
				const name =
					callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" && !callee.computed ? callee.property.name : "";
				if (BUILTIN_GETTER.test(name)) return true;
				// A record of functions slothlet builds at load: a frozen object literal, or what a function run on the spot makes.
				if (name === "freeze" && init.arguments[0]?.type === "ObjectExpression") return true;
				if (isFunction(callee) && atTopLevel(def.node)) return true;
			}
			return false;
		};
		const ARRAY_WRITES = {
			push: "listPush",
			unshift: "listUnshift",
			splice: "listSplice",
			concat: "concatLists",
			slice: "copyList",
			map: "mapList",
			filter: "filterList",
			flat: "concatLists",
			flatMap: "mapList and concatLists"
		};
		const DESCRIPTOR_KEYS = new Set(["writable", "enumerable", "configurable"]);
		const keyName = (property) =>
			property.type === "Property" && !property.computed
				? property.key.type === "Identifier"
					? property.key.name
					: property.key.type === "Literal"
						? String(property.key.value)
						: null
				: null;
		return {
			ObjectExpression(node) {
				if (atTopLevel(node)) return;
				const names = node.properties.map(keyName);
				if (names.includes("__proto__")) return;
				const parent = node.parent;
				const calleeName =
					parent?.type === "CallExpression" && parent.arguments[2] === node
						? parent.callee.type === "MemberExpression" && !parent.callee.computed
							? parent.callee.property.name
							: parent.callee.type === "Identifier"
								? parent.callee.name
								: ""
						: "";
				const spreadDescriptor =
					node.properties.some((p) => p.type === "SpreadElement") && names.some((k) => k === "value" || k === "get" || k === "set");
				if (calleeName === "defineProperty" || spreadDescriptor || names.some((k) => DESCRIPTOR_KEYS.has(k))) {
					context.report({ node, messageId: "descriptor" });
				}
			},
			CallExpression(node) {
				const callee = node.callee.type === "ChainExpression" ? node.callee.expression : node.callee;
				if (callee.type !== "MemberExpression") return;
				if (
					callee.object.type === "Identifier" &&
					callee.object.name === "ArrayMethods" &&
					!callee.computed &&
					Object.hasOwn(ARRAY_WRITES, callee.property.name) &&
					!atTopLevel(node)
				) {
					context.report({ node, messageId: "arrayWrite", data: { name: callee.property.name, use: ARRAY_WRITES[callee.property.name] } });
					return;
				}
				const name = callee.computed ? (callee.property.type === "Literal" ? String(callee.property.value) : null) : callee.property.name;
				if (name === null || callee.property.type === "PrivateIdentifier") return;
				// Captured statics that iterate.
				if (callee.object.type === "Identifier" && ITERATING_STATICS[callee.object.name]?.[name] && !atTopLevel(node)) {
					context.report({
						node,
						messageId: "iterating",
						data: { text: `${callee.object.name}.${name}`, use: ITERATING_STATICS[callee.object.name][name] }
					});
					return;
				}
				if (!PROTOTYPE_METHODS.has(name) || ownReceiver(callee.object) || atTopLevel(node)) return;
				context.report({
					node: callee,
					messageId: "method",
					data: { name, text: `${sourceCode.getText(callee.object).slice(0, 40)}.${name}(…)` }
				});
			},
			NewExpression(node) {
				if (node.callee.type !== "Identifier" || node.arguments.length === 0 || atTopLevel(node)) return;
				if (!["Map", "Set", "WeakMap", "WeakSet"].includes(node.callee.name)) return;
				context.report({ node, messageId: "construct", data: { name: node.callee.name } });
			},
			ForOfStatement(node) {
				if (atTopLevel(node)) return;
				if (isSafeWalk(node.right)) return;
				context.report({ node, messageId: "forOf" });
			},
			SpreadElement(node) {
				if (node.parent.type === "ObjectExpression" || atTopLevel(node)) return;
				context.report({ node, messageId: "spread" });
			},
			ArrayPattern(node) {
				if (atTopLevel(node)) return;
				context.report({ node, messageId: "pattern" });
			},
			YieldExpression(node) {
				if (!node.delegate || isSafeWalk(node.argument)) return;
				// An object literal of slothlet's own that is its own iterator (`next`, `return`, `throw` and the iterator
				// symbol as its own members) is walked through those members alone.
				if (node.argument.type === "Identifier") {
					const variable = variableOf(node.argument);
					const def = variable?.defs.find((candidate) => candidate.type === "Variable");
					if (def?.node.init?.type === "ObjectExpression") return;
				}
				context.report({ node, messageId: "delegate" });
			}
		};
	}
};

export default { rules: { "captured-intrinsics": rule, "captured-prototype-methods": prototypeRule } };
