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
 * - a comment that turns this rule off: there are no exemptions.
 *
 * Code that has to reach the current global on purpose reads it as `globalThis.X`, with a one-line reason beside it.
 * `helpers/intrinsics` itself reads every global that way.
 *
 * Wired in `.configs/eslint.config.mjs` for `src/**`, so `npm run lint` (and the pre-commit hook) fail on a new use.
 */

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
			directive: "slothlet/captured-intrinsics has no exemptions: import the captured copy, or read the current global as `globalThis.X`."
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
		return {
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
