/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/ci/eslint-captured-intrinsics.mjs
 *	@Date: 2026-11-13T01:04:06-08:00 (1794560646)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T01:04:06-08:00 (1794560646)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview ESLint rule: code in `src/` uses the built-ins `src/lib/helpers/intrinsics.mjs` took when slothlet
 * loaded, not the globals of the same name.
 *
 * @description
 * Module code shares the realm with slothlet and can assign `globalThis.Map`, `Object.keys` or `Promise.resolve` after
 * slothlet has loaded. `helpers/intrinsics` reads them once, at load, and every file of `src/` imports what it uses from
 * there. This rule reports:
 *
 * - a reference to one of the global names below that no import or declaration of the file binds (`new Map()`,
 *   `Object.keys(x)`, `Array.isArray(x)`, `Function.prototype`, `new Proxy(…)` with no import);
 * - a member read off one of the constructors other than `prototype` (and other than a well-known symbol on `Symbol`),
 *   whether the constructor is the global or the captured one: `Promise.resolve`, `Symbol.for`, `Map.groupBy` and
 *   `NativeObject.keys` read a member a module can replace on the shared constructor. Their captured forms are
 *   `Promises.*`, `Symbols.*` and `Objects.*`.
 *
 * Code that has to reach the current global on purpose reads it as `globalThis.X`, which the rule leaves alone, or
 * carries an `eslint-disable-next-line slothlet/captured-intrinsics -- <reason>` comment.
 *
 * Wired in `.configs/eslint.config.mjs` for `src/**`, so `npm run lint` (and the pre-commit hook) fail on a new use.
 */

/**
 * Global names whose statics are captured as a frozen copy: any reference to the global is reported, with the copy
 * to use.
 * @type {Record<string, string>}
 */
const STATIC_COPIES = {
	Object: "Objects (static functions) or NativeObject (the function)",
	Array: "Arrays",
	Function: "Functions",
	Proxy: "NativeProxy"
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
	"Map",
	"Set",
	"WeakMap",
	"WeakSet",
	"WeakRef",
	"Promise",
	"Symbol",
	"URL",
	"URLSearchParams"
]);

/**
 * Constructors whose own members (other than `prototype`) a module can replace. Reading such a member is reported
 * on the global and on the captured binding alike.
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
	NativeProxy: ""
};

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
	meta: {
		type: "problem",
		docs: { description: "Use the built-ins helpers/intrinsics captured when slothlet loaded, not the globals" },
		schema: [],
		messages: {
			global:
				"`{{name}}` here is the global, which module code can replace after slothlet loads. Import {{use}} from @cldmv/slothlet/helpers/intrinsics.",
			member: "`{{name}}.{{member}}` reads a member module code can replace on the shared constructor.{{use}}"
		}
	},
	create(context) {
		const sourceCode = context.sourceCode;
		/**
		 * Report a member read off a constructor, other than `prototype` or a well-known symbol on `Symbol`.
		 * @param {object} identifier - The constructor's identifier node.
		 * @param {string} name - The constructor's name.
		 */
		const checkMember = (identifier, name) => {
			const parent = identifier.parent;
			if (parent?.type !== "MemberExpression" || parent.object !== identifier) return;
			const member = parent.computed ? null : parent.property.name;
			if (member === "prototype") return;
			// The well-known symbols are non-writable, non-configurable members of `Symbol`.
			if (name === "Symbol" && member !== "for" && member !== "keyFor") return;
			const copy = CONSTRUCTORS[name];
			context.report({
				node: parent,
				messageId: "member",
				data: { name, member: member ?? "[…]", use: copy ? ` Use ${copy}.${member ?? "[…]"}.` : "" }
			});
		};
		return {
			"Program:exit"() {
				const globalScope = sourceCode.scopeManager.globalScope;
				// ESLint resolves a configured global (globals.node, globals.browser) to a variable of the global scope;
				// a name no configuration declares stays among the scope's unresolved references.
				const references = [...globalScope.through];
				for (const name of [...Object.keys(STATIC_COPIES), ...SAME_NAME]) {
					const variable = globalScope.set.get(name);
					if (variable) references.push(...variable.references);
				}
				for (const reference of references) {
					const identifier = reference.identifier;
					const name = identifier.name;
					if (Object.hasOwn(STATIC_COPIES, name)) {
						context.report({ node: identifier, messageId: "global", data: { name, use: STATIC_COPIES[name] } });
					} else if (SAME_NAME.has(name)) {
						if (Object.hasOwn(CONSTRUCTORS, name)) checkMember(identifier, name);
						context.report({ node: identifier, messageId: "global", data: { name, use: `\`${name}\`` } });
					}
				}
				// The captured constructors themselves: imported bindings of the file's module scope.
				const moduleScope = globalScope.childScopes.find((scope) => scope.type === "module");
				if (!moduleScope) return;
				for (const variable of moduleScope.variables) {
					if (!Object.hasOwn(CONSTRUCTORS, variable.name)) continue;
					if (!variable.defs.some((def) => def.type === "ImportBinding")) continue;
					for (const reference of variable.references) checkMember(reference.identifier, variable.name);
				}
			}
		};
	}
};

export default { rules: { "captured-intrinsics": rule } };
