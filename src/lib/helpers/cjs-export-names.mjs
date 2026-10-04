/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/cjs-export-names.mjs
 *	@Date: 2026-10-02T12:27:51-07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:52-07:00 (1791090892)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Static detection of a CommonJS module's named exports (#534).
 * @module @cldmv/slothlet/helpers/cjs-export-names
 *
 * @description
 * When an ESM leaf imports a CommonJS helper, Node exposes `default` (= `module.exports`) plus the
 * names its built-in lexer (cjs-module-lexer) finds by reading the source — the module has not run
 * yet when the importer links, so the names must come from the text. Slothlet's per-instance wrapper
 * for such a helper (see `instance-imports.mjs`) has to declare its export names at the same point,
 * so it reads them the same way.
 *
 * The scan recognises the patterns Node's lexer documents:
 *
 * - `exports.name = …`, `exports["name"] = …`, and the `module.exports.` forms of both;
 * - `Object.defineProperty(exports, "name", …)` (also on `module.exports`);
 * - `module.exports = { a, b: c, "d": e, f() {}, ...require("./x") }` object literals, including
 *   esbuild's `0 && (module.exports = { … })` annotation;
 * - re-exports: `module.exports = require("./x")`, `...require("./x")` in the literal,
 *   `__exportStar(require("./x"), exports)` and `__export(require("./x"))`, followed into the
 *   required file.
 *
 * It errs towards MORE names than Node's lexer, never fewer: an object-literal key is taken whatever
 * its value expression is, and a pattern inside a comment-free string still counts. An extra name is
 * harmless (it reads `undefined` from `module.exports`, as a real import of a missing key would),
 * while a missing one would turn an import that links natively into a SyntaxError.
 */

/**
 * Characters after which a `/` starts a regular-expression literal rather than a division.
 * @type {string}
 * @private
 */
const REGEX_PREFIX_CHARS = "(,=:[!&|?{};+-*%<>~^";

/**
 * Keywords after which a `/` starts a regular-expression literal.
 * @type {Set<string>}
 * @private
 */
const REGEX_PREFIX_WORDS = new Set([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"throw",
	"case",
	"do",
	"else",
	"yield",
	"await"
]);

/**
 * Index just past the string literal starting at `start` (a `'` or `"`).
 * @param {string} src - Source text.
 * @param {number} start - Index of the opening quote.
 * @returns {number} Index after the closing quote (or the end of the text).
 * @private
 */
function skipString(src, start) {
	const quote = src[start];
	let i = start + 1;
	while (i < src.length) {
		const ch = src[i];
		if (ch === "\\") i += 2;
		else if (ch === quote || ch === "\n") return i + 1;
		else i++;
	}
	return i;
}

/**
 * Replace every comment with spaces, keeping strings, template literals and regular expressions
 * intact (so a `//` or `/*` inside them is not mistaken for a comment). Line breaks are preserved.
 * @param {string} src - Source text.
 * @returns {string} The source without comments.
 * @private
 */
function stripComments(src) {
	let out = "";
	let i = 0;
	let last = "";
	// Brace depth of each open `${` in a template literal, innermost last.
	const templates = [];
	let depth = 0;
	/**
	 * Copy a template literal's text from `i` until its end or its next `${`.
	 * @returns {void}
	 */
	const templateText = () => {
		while (i < src.length) {
			const ch = src[i];
			if (ch === "\\") {
				out += src.slice(i, i + 2);
				i += 2;
			} else if (ch === "`") {
				out += ch;
				i++;
				last = "`";
				return;
			} else if (ch === "$" && src[i + 1] === "{") {
				out += "${";
				i += 2;
				templates.push(depth);
				depth++;
				last = "{";
				return;
			} else {
				out += ch;
				i++;
			}
		}
	};
	while (i < src.length) {
		const ch = src[i];
		const next = src[i + 1];
		if (ch === "/" && next === "/") {
			while (i < src.length && src[i] !== "\n") {
				out += " ";
				i++;
			}
		} else if (ch === "/" && next === "*") {
			const end = src.indexOf("*/", i + 2);
			const stop = end === -1 ? src.length : end + 2;
			out += src.slice(i, stop).replace(/[^\n]/g, " ");
			i = stop;
		} else if (ch === "'" || ch === '"') {
			const end = skipString(src, i);
			out += src.slice(i, end);
			i = end;
			last = ch;
		} else if (ch === "`") {
			out += ch;
			i++;
			templateText();
		} else if (ch === "/") {
			const word = /([A-Za-z_$][\w$]*)\s*$/.exec(out);
			const isRegex = last === "" || REGEX_PREFIX_CHARS.includes(last) || (word !== null && REGEX_PREFIX_WORDS.has(word[1]));
			if (isRegex) {
				let j = i + 1;
				let inClass = false;
				while (j < src.length && src[j] !== "\n") {
					const c = src[j];
					if (c === "\\") j++;
					else if (c === "[") inClass = true;
					else if (c === "]") inClass = false;
					else if (c === "/" && !inClass) break;
					j++;
				}
				// A regular expression's body never names an export; blank it so a bracket or quote in it
				// cannot unbalance the object-literal walk.
				out += "/" + " ".repeat(Math.max(0, j - i - 1)) + "/";
				i = j + 1;
				last = "/";
			} else {
				out += ch;
				i++;
				last = ch;
			}
		} else {
			if (ch === "{") depth++;
			else if (ch === "}") {
				depth--;
				if (templates.length && templates[templates.length - 1] === depth) {
					templates.pop();
					out += ch;
					i++;
					templateText();
					continue;
				}
			}
			out += ch;
			i++;
			if (!/\s/.test(ch)) last = /[\w$]/.test(ch) ? "a" : ch;
		}
	}
	return out;
}

/**
 * Single-character escapes of a JavaScript string literal, mapped to the character they stand for.
 * @type {Readonly<Record<string, string>>}
 * @private
 */
const SIMPLE_ESCAPES = Object.freeze({ b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", 0: "\0" });

/**
 * Decode the body of a quoted JavaScript string literal (without its quotes), the way the language
 * does: `\n`-style escapes, `\xHH`, `\uHHHH`, `\u{H…}`, line continuations, and any other escaped
 * character standing for itself (`\\`, `\'`, `\"`). A malformed `\x` / `\u` escape is a syntax
 * error in JavaScript, so such a body is returned undecoded.
 * @param {string} body - The text between the quotes.
 * @returns {string} The decoded string, or the raw body when it holds a malformed escape.
 * @private
 */
function decodeStringBody(body) {
	if (/\\(?:x(?![\da-f]{2})|u(?![\da-f]{4}|\{[\da-f]{1,6}\}))/i.test(body.replace(/\\\\/g, ""))) return body;
	// A line continuation is `\` + any line terminator; CRLF and CR count as one, so fold them to LF.
	body = body.replace(/\r\n?/g, "\n");
	let out = "";
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch !== "\\" || i === body.length - 1) {
			out += ch;
			continue;
		}
		const next = body[++i];
		if (next in SIMPLE_ESCAPES) out += SIMPLE_ESCAPES[next];
		else if (next === "x" && /^[\da-f]{2}$/i.test(body.slice(i + 1, i + 3))) {
			out += String.fromCharCode(parseInt(body.slice(i + 1, i + 3), 16));
			i += 2;
		} else if (next === "u" && body[i + 1] === "{") {
			const close = body.indexOf("}", i + 2);
			const codePoint = parseInt(body.slice(i + 2, close), 16);
			// An out-of-range code point is a syntax error in JavaScript: keep the raw body.
			if (codePoint > 0x10ffff) return body;
			out += String.fromCodePoint(codePoint);
			i = close;
		} else if (next === "u" && /^[\da-f]{4}$/i.test(body.slice(i + 1, i + 5))) {
			out += String.fromCharCode(parseInt(body.slice(i + 1, i + 5), 16));
			i += 4;
		} else if (next !== "\n" && next !== "\u2028" && next !== "\u2029") out += next; // else a line continuation
	}
	return out;
}

/**
 * Escape every regular-expression metacharacter in a string so it matches literally.
 * @param {string} text - Text to embed in a RegExp source.
 * @returns {string} The escaped text.
 * @private
 */
function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * Index just past a bracketed or quoted construct starting at `start`, or past one other character.
 * @param {string} src - Comment-free source.
 * @param {number} start - Index of the construct.
 * @returns {number} Index after it.
 * @private
 */
function skipBalanced(src, start) {
	const ch = src[start];
	if (ch === "'" || ch === '"') return skipString(src, start);
	if (ch === "`") {
		let i = start + 1;
		while (i < src.length && src[i] !== "`") {
			if (src[i] === "\\") i++;
			else if (src[i] === "$" && src[i + 1] === "{") {
				i = skipBalanced(src, i + 1) - 1;
			}
			i++;
		}
		return i + 1;
	}
	const close = ch === "(" ? ")" : ch === "[" ? "]" : ch === "{" ? "}" : null;
	if (close === null) return start + 1;
	let i = start + 1;
	while (i < src.length && src[i] !== close) i = skipBalanced(src, i);
	return i + 1;
}

/**
 * The require() specifier a text starts with (`require("./x")`), or null.
 * @param {string} text - Comment-free source text.
 * @returns {string|null} The specifier.
 * @private
 */
function leadingRequire(text) {
	const m = /^require\s*\(\s*(["'])((?:\\.|(?!\1)[^\\\n])*)\1\s*\)/.exec(text);
	return m ? decodeStringBody(m[2]) : null;
}

/**
 * Collect the keys of the object literal whose `{` is at `start`.
 * @param {string} src - Comment-free source.
 * @param {number} start - Index of the opening brace.
 * @param {Set<string>} names - Receives the keys.
 * @param {string[]} reexports - Receives the specifiers of `...require("x")` spreads.
 * @returns {void}
 * @private
 */
function readObjectKeys(src, start, names, reexports) {
	const end = skipBalanced(src, start) - 1;
	let i = start + 1;
	/**
	 * Skip whitespace from `i`.
	 * @returns {void}
	 */
	const ws = () => {
		while (i < end && /\s/.test(src[i])) i++;
	};
	/**
	 * Read one property-name token at `i` (identifier, string or number), or null.
	 * @returns {string|null} The name.
	 */
	const token = () => {
		ws();
		const ch = src[i];
		if (ch === "'" || ch === '"') {
			const stop = skipString(src, i);
			const name = decodeStringBody(src.slice(i + 1, stop - 1));
			i = stop;
			return name;
		}
		const m = /^(?:[A-Za-z_$\u0080-\uffff][\w$\u0080-\uffff]*|\d[\w.]*)/.exec(src.slice(i, end));
		if (!m) return null;
		i += m[0].length;
		return m[0];
	};
	while (i < end) {
		ws();
		if (src.startsWith("...", i)) {
			i += 3;
			ws();
			const spec = leadingRequire(src.slice(i, end));
			if (spec !== null) reexports.push(spec);
		} else if (src[i] === "[") {
			// Computed key: not statically known.
			i = skipBalanced(src, i);
		} else {
			let name = token();
			if (src[i] === "*") {
				i++;
				name = token();
			}
			ws();
			// `get x()`, `set x(v)`, `async x()`, `async *x()`: the modifier is followed by the real key.
			if ((name === "get" || name === "set" || name === "async") && i < end && !",:(}".includes(src[i])) {
				if (src[i] === "*") i++;
				name = token();
			}
			if (name !== null) names.add(name);
			// Node's lexer also follows a `key: require("./x")` value as a re-export of `./x`.
			if (src[i] === ":") {
				i++;
				ws();
				const spec = leadingRequire(src.slice(i, end));
				if (spec !== null) reexports.push(spec);
			}
		}
		// Skip the value (or method body) up to the next top-level comma.
		while (i < end && src[i] !== ",") i = skipBalanced(src, i);
		i++;
	}
}

/**
 * Scan CommonJS source for its named exports and re-exported specifiers.
 * @param {string} source - The module source.
 * @returns {{ names: Set<string>, reexports: string[] }} Names it assigns, and the specifiers whose
 *   exports it re-exports.
 * @internal
 * @example
 * scanCommonJSExports('exports.a = 1; module.exports.b = 2;').names; // Set { "a", "b" }
 */
export function scanCommonJSExports(source) {
	const src = stripComments(String(source).replace(/^#!.*/, ""));
	const names = new Set();
	const reexports = [];
	/**
	 * A quoted string literal pattern whose quote is capture group `group` and body group `group + 1`.
	 * @param {number} group - The quote's capture-group number.
	 * @returns {string} Regular-expression source.
	 */
	const str = (group) => `(["'])((?:\\\\.|(?!\\${group})[^\\\\\\n])*)\\${group}`;

	// exports.x = / exports["x"] = / module.exports.x = (not `==`/`===`, not `foo.exports`).
	const assign = new RegExp(
		String.raw`(?<![\w$.])(?:module\s*\.\s*)?exports\s*(?:\.\s*([A-Za-z_$\u0080-\uffff][\w$\u0080-\uffff]*)|\[\s*${str(2)}\s*\])\s*=(?!=)`,
		"g"
	);
	for (const m of src.matchAll(assign)) names.add(m[1] ?? decodeStringBody(m[3]));

	const define = new RegExp(String.raw`Object\s*\.\s*defineProperty\s*\(\s*(?:module\s*\.\s*)?exports\s*,\s*${str(1)}`, "g");
	for (const m of src.matchAll(define)) names.add(decodeStringBody(m[2]));

	// module.exports = { … } / module.exports = require("x").
	const whole = /(?<![\w$.])module\s*\.\s*exports\s*=(?!=)\s*/g;
	for (const m of src.matchAll(whole)) {
		const at = m.index + m[0].length;
		if (src[at] === "{") readObjectKeys(src, at, names, reexports);
		else {
			const spec = leadingRequire(src.slice(at));
			if (spec !== null) reexports.push(spec);
		}
	}

	// TypeScript / Babel star re-exports.
	const star = new RegExp(String.raw`__export(?:Star)?\s*\(\s*require\s*\(\s*${str(1)}\s*\)`, "g");
	for (const m of src.matchAll(star)) reexports.push(decodeStringBody(m[2]));

	// Babel's star re-export: `var _x = require("x"); Object.keys(_x).forEach(function (key) { … exports[key] … })`.
	const forEachKeys = /Object\s*\.\s*keys\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\.\s*forEach\s*\(/g;
	for (const m of src.matchAll(forEachKeys)) {
		const binding = new RegExp(
			String.raw`(?<![\w$.])${escapeRegExp(m[1])}\s*=\s*(?:[A-Za-z_$][\w$]*\s*\(\s*)?require\s*\(\s*${str(1)}\s*\)`
		).exec(src);
		if (binding) reexports.push(decodeStringBody(binding[2]));
	}

	return { names, reexports };
}

/**
 * The named exports an ESM importer sees for a CommonJS file: the scan of the file plus, recursively,
 * the names of every CommonJS file it re-exports. `default` is excluded (it is always
 * `module.exports`), as are names that are not well-formed strings.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} source - Its source text.
 * @param {object} io - File access.
 * @param {(file: string) => string} io.readFile - Read a file as UTF-8.
 * @param {(specifier: string, fromFile: string) => string} io.resolve - Resolve a require() specifier
 *   from a file to an absolute path (throws when it cannot).
 * @returns {string[]} The export names, in discovery order.
 * @internal
 * @example
 * commonJSExportNames("/app/lib/h.cjs", source, { readFile, resolve }); // ["bump", "label"]
 */
export function commonJSExportNames(filePath, source, io) {
	const names = new Set();
	const visited = new Set([filePath]);
	const queue = [[filePath, source]];
	while (queue.length) {
		const [file, text] = queue.shift();
		const scan = scanCommonJSExports(text);
		for (const name of scan.names) names.add(name);
		for (const spec of scan.reexports) {
			let target;
			try {
				target = io.resolve(spec, file);
				if (visited.has(target) || !/\.(?:c?js)$/.test(target)) continue;
				visited.add(target);
				queue.push([target, io.readFile(target)]);
			} catch {
				// An unresolvable or unreadable re-export contributes no names (Node's lexer skips it too).
			}
		}
	}
	names.delete("default");
	return [...names].filter((name) => typeof name === "string" && name.isWellFormed());
}
