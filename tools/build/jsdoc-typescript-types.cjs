/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/build/jsdoc-typescript-types.cjs
 *	@Date: 2026-05-31T08:04:06-07:00 (1780239846)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-08 06:36:16 -07:00 (1780925776)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview jsdoc plugin: translate TypeScript-style JSDoc type expressions into the
 * Closure-style grammar that jsdoc's type parser (catharsis) accepts (#121).
 *
 * @description
 * The source uses TypeScript-style JSDoc types so `tsc` can emit accurate `.d.mts`
 * declarations: `import("./x.mjs").Type`, arrow function types (`(a, b) => number`), tuples
 * (`[number, number, number]`), optional record properties (`{ a?: T }`), and intersections
 * (`A & B`). catharsis — used by `jsdoc` / `jsdoc-to-markdown` for `npm run docs:build` — has
 * no grammar for any of these and aborts the whole build.
 *
 * This plugin hooks `jsdocCommentFound` (which fires with the RAW comment string, before
 * catharsis parses it) and rewrites only the `{…}` type portion of type-bearing tags into the
 * closest meaning-preserving Closure form:
 *
 * | TypeScript JSDoc                | Rewritten (Closure)        | Fidelity                       |
 * | ------------------------------- | -------------------------- | ------------------------------ |
 * | `import("../x.mjs").Foo`        | `Foo`                      | full (module path isn't shown) |
 * | `(a: X, b: Y) => Z`             | `function(X, Y): Z`        | full                           |
 * | `(a, b) => number`              | `function(*, *): number`   | full                           |
 * | `(...xs: string[]) => string`   | `function(...string): string` | full                        |
 * | `[number, number, number]`      | `Array<number>`            | element type kept; arity lost  |
 * | `{ a: X, b?: Y }`               | `{ a: X, b: Y }`           | structure kept; `?` marker lost |
 * | `A & B & {…}`                   | `Object`                   | intersection has no Closure form |
 *
 * Runtime behaviour and the `tsc`-generated declarations are unaffected — this only changes what
 * catharsis sees while generating the markdown API docs.
 *
 * @module tools/build/jsdoc-typescript-types
 */

// Type-bearing tags whose `{…}` payload is a type expression catharsis will parse.
const TYPE_TAGS = /@(?:param|arg|argument|returns?|property|prop|type|typedef|yields?|template|member|this|callback|external|augments|extends)\b/;

/**
 * Strip `import("…").` prefixes, leaving the referenced type name.
 * Handles every position: bare, inside `Promise<…>`, `…[]`, unions, generics.
 * @param {string} type - Type expression.
 * @returns {string} Type expression with import() module prefixes removed.
 */
function stripImports(type) {
	return type.replace(/import\(\s*(['"])[^'"]*\1\s*\)\./g, "");
}

/**
 * Convert a single arrow-function type `(params) => Return` into Closure
 * `function(paramTypes): Return`. Parameter names are dropped (keeping their types, or `*`
 * when untyped); `...rest: T[]` becomes Closure variadic `...T`.
 * @param {string} type - Type expression possibly containing arrow functions.
 * @returns {string} Type expression with arrow functions rewritten.
 */
function convertArrows(type) {
	// Match `( … ) => ` then the return type up to a closing delimiter or end.
	return type.replace(/\(([^()]*)\)\s*=>\s*([^,}|>]+)/g, (_match, params, ret) => {
		const paramTypes = params
			.split(",")
			.map((p) => p.trim())
			.filter(Boolean)
			.map((p) => {
				const rest = p.startsWith("...");
				const bare = rest ? p.slice(3) : p;
				// `name: Type` → `Type`; bare `name` → `*`.
				let t = bare.includes(":") ? bare.slice(bare.indexOf(":") + 1).trim() : "*";
				// `string[]` → `string` for the variadic element form.
				if (rest) t = `...${t.replace(/\[\]$/, "")}`;
				return t;
			});
		return `function(${paramTypes.join(", ")}): ${ret.trim()}`;
	});
}

/**
 * Convert tuple types `[A, B, C]` into `Array<A>` (homogeneous) or `Array<*>` (mixed).
 * Only acts on bracket groups containing a comma, so `Foo[]` array suffixes are untouched.
 * @param {string} type - Type expression possibly containing tuples.
 * @returns {string} Type expression with tuples rewritten.
 */
function convertTuples(type) {
	return type.replace(/\[([^\][]*,[^\][]*)\]/g, (_match, inner) => {
		const parts = inner.split(",").map((p) => p.trim());
		const unique = [...new Set(parts)];
		return `Array<${unique.length === 1 ? unique[0] : "*"}>`;
	});
}

/**
 * Rewrite one type expression from TypeScript-style to Closure-style.
 * @param {string} type - The raw type expression (inner text of `{…}`).
 * @returns {string} Catharsis-parseable type expression.
 */
function rewriteType(type) {
	let t = stripImports(type);
	// Intersection has no Closure equivalent — collapse to Object. Done before other
	// transforms so a mixin like `A & B & { … }` doesn't get partially rewritten.
	if (/\s&\s/.test(t)) return "Object";
	t = convertArrows(t);
	t = convertTuples(t);
	// Optional record property marker `name?:` → `name:` (catharsis parses record types,
	// but not the optional `?`).
	t = t.replace(/\?\s*:/g, ":");
	return t;
}

/**
 * Extract the balanced `{…}` type starting at `open` and rewrite it in place.
 * @param {string} line - The comment line.
 * @param {number} open - Index of the opening `{`.
 * @returns {string|null} The line with the type rewritten, or null if braces are unbalanced.
 */
function rewriteBracedType(line, open) {
	let depth = 0;
	for (let i = open; i < line.length; i++) {
		if (line[i] === "{") depth++;
		else if (line[i] === "}") {
			depth--;
			if (depth === 0) {
				const inner = line.slice(open + 1, i);
				const rewritten = rewriteType(inner);
				return line.slice(0, open + 1) + rewritten + line.slice(i);
			}
		}
	}
	return null;
}

exports.handlers = {
	/**
	 * Rewrite TypeScript-style type expressions in each doc comment before catharsis parses it.
	 * @param {{ comment: string }} e - jsdoc comment event; `e.comment` is the raw comment text.
	 */
	jsdocCommentFound(e) {
		e.comment = e.comment
			.split("\n")
			.map((line) => {
				if (!TYPE_TAGS.test(line)) return line;
				const open = line.indexOf("{");
				if (open === -1) return line;
				return rewriteBracedType(line, open) ?? line;
			})
			.join("\n");
	}
};
