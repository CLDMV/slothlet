/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/cjs-export-names.mjs
 *	@Date: 2026-10-02T12:27:51-07:00 (1790969271)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:48:01-08:00 (1794635281)
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

import {
	ArrayMethods,
	filterList,
	matchAllOf,
	Math,
	Objects,
	parseInt,
	RegExp,
	RegExpMethods,
	regExpReplace,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	String,
	StringMethods,
	Strings
} from "@cldmv/slothlet/helpers/intrinsics";

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
const REGEX_PREFIX_WORDS = setFrom([
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
				out += StringMethods.slice(src, i, i + 2);
				i += 2;
			} else if (ch === "`") {
				out += ch;
				i++;
				last = "`";
				return;
			} else if (ch === "$" && src[i + 1] === "{") {
				out += "${";
				i += 2;
				ArrayMethods.push(templates, depth);
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
			const end = StringMethods.indexOf(src, "*/", i + 2);
			const stop = end === -1 ? src.length : end + 2;
			out += regExpReplace(/[^\n]/g, StringMethods.slice(src, i, stop), " ");
			i = stop;
		} else if (ch === "'" || ch === '"') {
			const end = skipString(src, i);
			out += StringMethods.slice(src, i, end);
			i = end;
			last = ch;
		} else if (ch === "`") {
			out += ch;
			i++;
			templateText();
		} else if (ch === "/") {
			const word = RegExpMethods.exec(/([A-Za-z_$][\w$]*)\s*$/, out);
			const isRegex =
				last === "" || StringMethods.includes(REGEX_PREFIX_CHARS, last) || (word !== null && SetMethods.has(REGEX_PREFIX_WORDS, word[1]));
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
				out += "/" + StringMethods.repeat(" ", Math.max(0, j - i - 1)) + "/";
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
					ArrayMethods.pop(templates);
					out += ch;
					i++;
					templateText();
					continue;
				}
			}
			out += ch;
			i++;
			if (!(RegExpMethods.exec(/\s/, ch) !== null)) last = RegExpMethods.exec(/[\w$]/, ch) !== null ? "a" : ch;
		}
	}
	return out;
}

/**
 * Single-character escapes of a JavaScript string literal, mapped to the character they stand for.
 * @type {Readonly<Record<string, string>>}
 * @private
 */
const SIMPLE_ESCAPES = Objects.freeze({ b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", 0: "\0" });

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
	if (RegExpMethods.exec(/\\(?:x(?![\da-f]{2})|u(?![\da-f]{4}|\{[\da-f]{1,6}\}))/i, regExpReplace(/\\\\/g, body, "")) !== null) return body;
	// A line continuation is `\` + any line terminator; CRLF and CR count as one, so fold them to LF.
	body = regExpReplace(/\r\n?/g, body, "\n");
	let out = "";
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch !== "\\" || i === body.length - 1) {
			out += ch;
			continue;
		}
		const next = body[++i];
		if (next in SIMPLE_ESCAPES) out += SIMPLE_ESCAPES[next];
		else if (next === "x" && RegExpMethods.exec(/^[\da-f]{2}$/i, StringMethods.slice(body, i + 1, i + 3)) !== null) {
			out += Strings.fromCharCode(parseInt(StringMethods.slice(body, i + 1, i + 3), 16));
			i += 2;
		} else if (next === "u" && body[i + 1] === "{") {
			const close = StringMethods.indexOf(body, "}", i + 2);
			const codePoint = parseInt(StringMethods.slice(body, i + 2, close), 16);
			// An out-of-range code point is a syntax error in JavaScript: keep the raw body.
			if (codePoint > 0x10ffff) return body;
			out += Strings.fromCodePoint(codePoint);
			i = close;
		} else if (next === "u" && RegExpMethods.exec(/^[\da-f]{4}$/i, StringMethods.slice(body, i + 1, i + 5)) !== null) {
			out += Strings.fromCharCode(parseInt(StringMethods.slice(body, i + 1, i + 5), 16));
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
	return regExpReplace(/[.*+?^${}()|[\]\\/]/g, text, "\\$&");
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
	const m = RegExpMethods.exec(/^require\s*\(\s*(["'])((?:\\.|(?!\1)[^\\\n])*)\1\s*\)/, text);
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
		while (i < end && RegExpMethods.exec(/\s/, src[i]) !== null) i++;
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
			const name = decodeStringBody(StringMethods.slice(src, i + 1, stop - 1));
			i = stop;
			return name;
		}
		const m = RegExpMethods.exec(/^(?:[A-Za-z_$\u0080-\uffff][\w$\u0080-\uffff]*|\d[\w.]*)/, StringMethods.slice(src, i, end));
		if (!m) return null;
		i += m[0].length;
		return m[0];
	};
	while (i < end) {
		ws();
		if (StringMethods.startsWith(src, "...", i)) {
			i += 3;
			ws();
			const spec = leadingRequire(StringMethods.slice(src, i, end));
			if (spec !== null) ArrayMethods.push(reexports, spec);
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
			if ((name === "get" || name === "set" || name === "async") && i < end && !StringMethods.includes(",:(}", src[i])) {
				if (src[i] === "*") i++;
				name = token();
			}
			if (name !== null) SetMethods.add(names, name);
			// Node's lexer also follows a `key: require("./x")` value as a re-export of `./x`.
			if (src[i] === ":") {
				i++;
				ws();
				const spec = leadingRequire(StringMethods.slice(src, i, end));
				if (spec !== null) ArrayMethods.push(reexports, spec);
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
	const src = stripComments(regExpReplace(/^#!.*/, String(source), ""));
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
		Strings.raw`(?<![\w$.])(?:module\s*\.\s*)?exports\s*(?:\.\s*([A-Za-z_$\u0080-\uffff][\w$\u0080-\uffff]*)|\[\s*${str(2)}\s*\])\s*=(?!=)`,
		"g"
	);
	for (let i = 0, found = matchAllOf(src, assign); i < found.length; i++)
		SetMethods.add(names, found[i][1] ?? decodeStringBody(found[i][3]));

	const define = new RegExp(Strings.raw`Object\s*\.\s*defineProperty\s*\(\s*(?:module\s*\.\s*)?exports\s*,\s*${str(1)}`, "g");
	for (let i = 0, found = matchAllOf(src, define); i < found.length; i++) SetMethods.add(names, decodeStringBody(found[i][2]));

	// module.exports = { … } / module.exports = require("x").
	const whole = /(?<![\w$.])module\s*\.\s*exports\s*=(?!=)\s*/g;
	for (let i = 0, found = matchAllOf(src, whole); i < found.length; i++) {
		const m = found[i];
		const at = m.index + m[0].length;
		if (src[at] === "{") readObjectKeys(src, at, names, reexports);
		else {
			const spec = leadingRequire(StringMethods.slice(src, at));
			if (spec !== null) ArrayMethods.push(reexports, spec);
		}
	}

	// TypeScript / Babel star re-exports.
	const star = new RegExp(Strings.raw`__export(?:Star)?\s*\(\s*require\s*\(\s*${str(1)}\s*\)`, "g");
	for (let i = 0, found = matchAllOf(src, star); i < found.length; i++) ArrayMethods.push(reexports, decodeStringBody(found[i][2]));

	// Babel's star re-export: `var _x = require("x"); Object.keys(_x).forEach(function (key) { … exports[key] … })`.
	const forEachKeys = /Object\s*\.\s*keys\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\.\s*forEach\s*\(/g;
	for (let i = 0, found = matchAllOf(src, forEachKeys); i < found.length; i++) {
		const m = found[i];
		const binding = RegExpMethods.exec(
			new RegExp(Strings.raw`(?<![\w$.])${escapeRegExp(m[1])}\s*=\s*(?:[A-Za-z_$][\w$]*\s*\(\s*)?require\s*\(\s*${str(1)}\s*\)`),
			src
		);
		if (binding) ArrayMethods.push(reexports, decodeStringBody(binding[2]));
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
	const visited = setFrom([filePath]);
	const queue = [[filePath, source]];
	while (queue.length) {
		const unpacked1 = ArrayMethods.shift(queue),
			file = unpacked1[0],
			text = unpacked1[1];
		const scan = scanCommonJSExports(text);
		for (const name of setValues(scan.names)) SetMethods.add(names, name);
		for (let ofIndex = 0, ofList = scan.reexports; ofIndex < ofList.length; ofIndex++) {
			const spec = ofList[ofIndex];
			let target;
			try {
				target = io.resolve(spec, file);
				if (SetMethods.has(visited, target) || !(RegExpMethods.exec(/\.(?:c?js)$/, target) !== null)) continue;
				SetMethods.add(visited, target);
				ArrayMethods.push(queue, [target, io.readFile(target)]);
			} catch {
				// An unresolvable or unreadable re-export contributes no names (Node's lexer skips it too).
			}
		}
	}
	SetMethods.delete(names, "default");
	return filterList(setToArray(names), (name) => typeof name === "string" && StringMethods.isWellFormed(name));
}
