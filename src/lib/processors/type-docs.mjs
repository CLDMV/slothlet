/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/type-docs.mjs
 *	@Date: 2026-11-25T11:00:00-08:00 (1795633200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:00:00-08:00 (1795633200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads the JSDoc of a module file's exports, for the type generator's `includeDocumentation` option.
 * @module @cldmv/slothlet/processors/type-docs
 * @internal
 *
 * @description
 * A light scan of the source text, not a parser: it skips strings, template literals, comments and regular
 * expression literals, tracks braces, and records each JSDoc block against the declaration that follows it —
 * a top-level declaration (`export function add`, `export default class`, `const stats = {`, `module.exports =`,
 * `exports.name =`) or a member of an object literal that one of those declarations starts. The type generator
 * looks a node's origin `exportPath` up here and copies the block onto the generated member.
 */

import * as nodeFs from "fs";
import {
	ArrayMethods,
	concatLists,
	copyList,
	listPush,
	Map,
	MapMethods,
	mapList,
	Math,
	Objects,
	RegExp,
	RegExpMethods,
	regExpReplace,
	SetMethods,
	setFrom,
	splitText,
	String,
	StringMethods
} from "#helpers/intrinsics";

// Node's built-ins, as slothlet loaded: frozen copies of their members (see helpers/platform), so code that replaces one
// on Node's module object later does not run here.
const fs = Objects.freeze({ ...nodeFs });

/**
 * JSDoc tags carried onto a generated member. Every other tag (`@type`, `@public`, `@internal`, …) is dropped: the
 * member's type comes from its export, and visibility tags describe the source file, not the api.
 * @type {Set<string>}
 * @private
 */
const KEPT_TAGS = setFrom(["param", "returns", "return", "deprecated", "example"]);

/**
 * Tags whose first word may be a `{type}` expression. The type is dropped: the generated member is typed from its
 * export, so a copied JSDoc type could only disagree with it.
 * @type {Set<string>}
 * @private
 */
const TYPED_TAGS = setFrom(["param", "returns", "return"]);

/**
 * Keywords after which a `/` starts a regular expression literal rather than a division.
 * @type {Set<string>}
 * @private
 */
const REGEX_KEYWORDS = setFrom([
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

const NAME = "[A-Za-z_$][\\w$]*";
const FREEZE = "(?:Object\\.freeze\\(\\s*)?";

/**
 * Declarations a JSDoc block can document at the top level of a file, tried in order at the position right after the
 * block. `space` is where the key lands (`exports` = the module's export names, `locals` = file-level bindings);
 * `key` builds the path from the match. CommonJS `module.exports` is the loader's `default`.
 * @type {Array<{pattern: RegExp, entries: function(Array<string>): Array<{space: string, path: string[]}>}>}
 * @private
 */
const TOP_LEVEL_DECLARATIONS = [
	{
		pattern: new RegExp(`export\\s+default\\s+(?:async\\s+)?function\\b\\s*\\*?\\s*(${NAME})?`, "y"),
		entries: (match) => withLocal([{ space: "exports", path: ["default"] }], match[1])
	},
	{
		pattern: new RegExp(`export\\s+default\\s+(?:abstract\\s+)?class\\b\\s*(${NAME})?`, "y"),
		entries: (match) => withLocal([{ space: "exports", path: ["default"] }], match[1])
	},
	{ pattern: /export\s+default\b/y, entries: () => [{ space: "exports", path: ["default"] }] },
	{
		pattern: new RegExp(`export\\s+(?:declare\\s+)?(?:async\\s+)?function\\b\\s*\\*?\\s*(${NAME})`, "y"),
		entries: (match) => withLocal([{ space: "exports", path: [match[1]] }], match[1])
	},
	{
		pattern: new RegExp(`export\\s+(?:declare\\s+)?(?:abstract\\s+)?class\\s+(${NAME})`, "y"),
		entries: (match) => withLocal([{ space: "exports", path: [match[1]] }], match[1])
	},
	{
		pattern: new RegExp(`export\\s+(?:declare\\s+)?(?:const|let|var)\\s+(${NAME})`, "y"),
		entries: (match) => withLocal([{ space: "exports", path: [match[1]] }], match[1])
	},
	{ pattern: /module\.exports\s*=/y, entries: () => [{ space: "exports", path: ["default"] }] },
	{
		pattern: new RegExp(`(?:module\\.)?exports\\.(${NAME})\\s*=`, "y"),
		entries: (match) => [{ space: "exports", path: ["default", match[1]] }]
	},
	{ pattern: new RegExp(`(?:async\\s+)?function\\b\\s*\\*?\\s*(${NAME})`, "y"), entries: (match) => withLocal([], match[1]) },
	{ pattern: new RegExp(`(?:abstract\\s+)?class\\s+(${NAME})`, "y"), entries: (match) => withLocal([], match[1]) },
	{ pattern: new RegExp(`(?:const|let|var)\\s+(${NAME})`, "y"), entries: (match) => withLocal([], match[1]) }
];

/**
 * A member of an object literal: `name(`, `name:`, `async name(`, `get name(`, `*name(`, `"quoted":`, or a shorthand
 * `name,` / `name }`.
 * @type {RegExp}
 * @private
 */
const OBJECT_MEMBER = new RegExp(
	`(?:static\\s+)?(?:async\\s+)?(?:(?:get|set)\\s+)?\\*?\\s*(?:(${NAME})|"([^"\\n]*)"|'([^'\\n]*)')\\s*[(:,}]`,
	"y"
);

/**
 * Text right before a top-level `{` that makes it an object literal worth descending into, tried in order.
 * @type {Array<{pattern: RegExp, frame: function(Array<string>): {space: string, path: string[]}}>}
 * @private
 */
const TOP_LEVEL_OBJECTS = [
	{ pattern: new RegExp(`export\\s+default\\s+${FREEZE}$`), frame: () => ({ space: "exports", path: ["default"] }) },
	{
		pattern: new RegExp(`export\\s+(?:const|let|var)\\s+(${NAME})(?:\\s*:[^=]*)?\\s*=\\s*${FREEZE}$`),
		frame: (match) => ({ space: "exports", path: [match[1]] })
	},
	{ pattern: new RegExp(`module\\.exports\\s*=\\s*${FREEZE}$`), frame: () => ({ space: "exports", path: ["default"] }) },
	{
		pattern: new RegExp(`(?:module\\.)?exports\\.(${NAME})\\s*=\\s*${FREEZE}$`),
		frame: (match) => ({ space: "exports", path: ["default", match[1]] })
	},
	{
		pattern: new RegExp(`(?:const|let|var)\\s+(${NAME})(?:\\s*:[^=]*)?\\s*=\\s*${FREEZE}$`),
		frame: (match) => ({ space: "locals", path: [match[1]] })
	}
];

/**
 * Text right before a `{` inside a tracked object literal that makes it a nested object member.
 * @type {RegExp}
 * @private
 */
const NESTED_OBJECT = new RegExp(`(?:^|[{,\\s])(?:(${NAME})|"([^"\\n]*)"|'([^'\\n]*)')\\s*:\\s*${FREEZE}$`);

/**
 * `export default name;` / `module.exports = name;` — the default export is a file-level binding documented elsewhere.
 * @type {RegExp}
 * @private
 */
const DEFAULT_ALIAS = new RegExp(`(?:export\\s+default|module\\.exports\\s*=)\\s+(${NAME})\\s*(?:;|\\r?\\n|$)`, "g");

/**
 * Words that start a declaration after `export default` (not a binding name).
 * @type {Set<string>}
 * @private
 */
const DECLARATION_WORDS = setFrom(["function", "class", "async", "abstract"]);

/**
 * `export { a, b as c }` lists.
 * @type {RegExp}
 * @private
 */
const EXPORT_LIST = /export\s*\{([^}]*)\}/g;

/**
 * Add a file-level binding entry when the declaration names one.
 * @param {Array<{space: string, path: string[]}>} entries - Entries so far.
 * @param {string|undefined} name - The declared binding name, if any.
 * @returns {Array<{space: string, path: string[]}>} The entries.
 * @private
 */
function withLocal(entries, name) {
	if (name) listPush(entries, { space: "locals", path: [name] });
	return entries;
}

/**
 * A copy of `path` with one more segment.
 * @param {string[]} path - The parent path.
 * @param {string} segment - The segment to add.
 * @returns {string[]} The new path.
 * @private
 */
function pathWith(path, segment) {
	const next = copyList(path);
	listPush(next, segment);
	return next;
}

/**
 * Run a sticky pattern at a position.
 * @param {RegExp} pattern - A sticky (`y`) pattern.
 * @param {string} text - Source text.
 * @param {number} position - Where the match must start.
 * @returns {Array<string>|null} The match, or `null`.
 * @private
 */
function matchAt(pattern, text, position) {
	pattern.lastIndex = position;
	return RegExpMethods.exec(pattern, text);
}

/**
 * Index of the next non-whitespace character at or after `position`.
 * @param {string} text - Source text.
 * @param {number} position - Start index.
 * @returns {number} The index (`text.length` when none).
 * @private
 */
function skipSpace(text, position) {
	while (position < text.length && RegExpMethods.exec(/\s/, text[position]) !== null) position++;
	return position;
}

/**
 * Whether a `/` at this point starts a regular expression literal, judged from the last significant source token.
 * @param {string} lastToken - The previous significant character, or word when it ended in one.
 * @returns {boolean} True for a regex literal.
 * @private
 */
function startsRegex(lastToken) {
	if (lastToken === "") return true;
	if (RegExpMethods.exec(/^[\w$]+$/, lastToken) !== null) return SetMethods.has(REGEX_KEYWORDS, lastToken);
	return lastToken !== ")" && lastToken !== "]";
}

/**
 * Scan a module's source and collect each documented declaration's JSDoc.
 * @param {string} text - Source text of the module.
 * @returns {{exports: Map<string, string>, locals: Map<string, string>, aliases: Map<string, string>}} JSDoc bodies
 *   keyed by dotted path, per space, plus export-name → binding aliases.
 * @private
 */
function scanSource(text) {
	const docs = { exports: new Map(), locals: new Map(), aliases: new Map() };
	// One frame per open brace: an object literal we track (`{space, path}`), a template `${` (`"template"`), or any
	// other block (`null`).
	const frames = [];
	let lastToken = "";
	let position = 0;

	const record = (entries, body) => {
		for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
			const { space, path } = entries[entryIndex];
			const key = ArrayMethods.join(path, ".");
			if (!MapMethods.has(docs[space], key)) MapMethods.set(docs[space], key, body);
		}
	};

	const documentNext = (body, after) => {
		const at = skipSpace(text, after);
		const frame = frames.length ? frames[frames.length - 1] : null;
		if (frames.length === 0) {
			for (let declIndex = 0; declIndex < TOP_LEVEL_DECLARATIONS.length; declIndex++) {
				const { pattern, entries } = TOP_LEVEL_DECLARATIONS[declIndex];
				const match = matchAt(pattern, text, at);
				if (match) {
					record(entries(match), body);
					return;
				}
			}
			return;
		}
		if (frame && typeof frame === "object") {
			const match = matchAt(OBJECT_MEMBER, text, at);
			if (match) record([{ space: frame.space, path: pathWith(frame.path, match[1] ?? match[2] ?? match[3]) }], body);
		}
	};

	const openFrame = () => {
		const top = frames.length ? frames[frames.length - 1] : null;
		const before = StringMethods.slice(text, Math.max(0, position - 400), position);
		if (frames.length === 0) {
			for (let objectIndex = 0; objectIndex < TOP_LEVEL_OBJECTS.length; objectIndex++) {
				const { pattern, frame } = TOP_LEVEL_OBJECTS[objectIndex];
				const match = RegExpMethods.exec(pattern, before);
				if (match) return frame(match);
			}
			return null;
		}
		if (top && typeof top === "object") {
			const match = RegExpMethods.exec(NESTED_OBJECT, before);
			if (match) return { space: top.space, path: pathWith(top.path, match[1] ?? match[2] ?? match[3]) };
		}
		return null;
	};

	// Skip a template literal body starting after its opening backtick (or after a closing `}` of `${`). Returns at the
	// closing backtick, or pushes a template frame at `${`.
	const skipTemplate = () => {
		while (position < text.length) {
			const char = text[position];
			if (char === "\\") {
				position += 2;
				continue;
			}
			if (char === "`") {
				position++;
				return;
			}
			if (char === "$" && text[position + 1] === "{") {
				listPush(frames, "template");
				position += 2;
				return;
			}
			position++;
		}
	};

	while (position < text.length) {
		const char = text[position];
		const next = text[position + 1];

		if (char === "/" && next === "*") {
			const end = StringMethods.indexOf(text, "*/", position + 2);
			const close = end === -1 ? text.length : end;
			if (text[position + 2] === "*" && text[position + 3] !== "/") {
				documentNext(StringMethods.slice(text, position + 3, close), close + 2);
			}
			position = close + 2;
			continue;
		}
		if (char === "/" && next === "/") {
			const end = StringMethods.indexOf(text, "\n", position);
			position = end === -1 ? text.length : end;
			continue;
		}
		if (char === '"' || char === "'") {
			position++;
			while (position < text.length && text[position] !== char && text[position] !== "\n") {
				position += text[position] === "\\" ? 2 : 1;
			}
			position++;
			lastToken = char;
			continue;
		}
		if (char === "`") {
			position++;
			skipTemplate();
			lastToken = "`";
			continue;
		}
		if (char === "/" && startsRegex(lastToken)) {
			position++;
			let inClass = false;
			while (position < text.length && text[position] !== "\n") {
				const inner = text[position];
				if (inner === "\\") {
					position += 2;
					continue;
				}
				if (inner === "[") inClass = true;
				else if (inner === "]") inClass = false;
				else if (inner === "/" && !inClass) break;
				position++;
			}
			position++;
			while (position < text.length && RegExpMethods.exec(/[a-z]/, text[position]) !== null) position++;
			lastToken = "/";
			continue;
		}
		if (char === "{") {
			listPush(frames, openFrame());
			position++;
			lastToken = "{";
			continue;
		}
		if (char === "}") {
			const closed = frames.length ? ArrayMethods.pop(frames) : null;
			position++;
			if (closed === "template") {
				skipTemplate();
				lastToken = "`";
			} else {
				lastToken = "}";
			}
			continue;
		}
		const word = matchAt(/[\w$]+/y, text, position);
		if (word) {
			lastToken = word[0];
			position += word[0].length;
			continue;
		}
		if (RegExpMethods.exec(/\s/, char) === null) lastToken = char;
		position++;
	}

	collectAliases(text, docs.aliases);
	return docs;
}

/**
 * Record which file-level binding each re-exported name refers to (`export { a as b }`, `export default a`,
 * `module.exports = a`), so a binding's JSDoc is found under the export name too.
 * @param {string} text - Source text.
 * @param {Map<string, string>} aliases - Export name → binding name (filled in).
 * @returns {void}
 * @private
 */
function collectAliases(text, aliases) {
	for (let match = resetExec(DEFAULT_ALIAS, text); match; match = RegExpMethods.exec(DEFAULT_ALIAS, text)) {
		if (!SetMethods.has(DECLARATION_WORDS, match[1])) MapMethods.set(aliases, "default", match[1]);
	}
	for (let match = resetExec(EXPORT_LIST, text); match; match = RegExpMethods.exec(EXPORT_LIST, text)) {
		const names = splitText(match[1], ",");
		for (let nameIndex = 0; nameIndex < names.length; nameIndex++) {
			const parts = RegExpMethods.exec(new RegExp(`^\\s*(${NAME})(?:\\s+as\\s+(${NAME}))?\\s*$`), names[nameIndex]);
			if (parts && parts[2]) MapMethods.set(aliases, parts[2], parts[1]);
		}
	}
}

/**
 * Run a global pattern from the start of `text`.
 * @param {RegExp} pattern - A global (`g`) pattern.
 * @param {string} text - Text to search.
 * @returns {Array<string>|null} The first match.
 * @private
 */
function resetExec(pattern, text) {
	pattern.lastIndex = 0;
	return RegExpMethods.exec(pattern, text);
}

/**
 * Drop a leading `{type}` expression (balanced braces) from a tag's text.
 * @param {string} body - The tag text after the tag name.
 * @returns {string} The text without the type.
 * @private
 */
function dropType(body) {
	const start = skipSpace(body, 0);
	if (body[start] !== "{") return body;
	let depth = 0;
	for (let index = start; index < body.length; index++) {
		if (body[index] === "{") depth++;
		else if (body[index] === "}" && --depth === 0) return StringMethods.trimStart(StringMethods.slice(body, index + 1));
	}
	return body;
}

/**
 * Turn a raw JSDoc body (the text between `/**` and `*\/`) into the lines to emit: the description, then the kept
 * tags. A `*\/` inside the text is escaped so it cannot close the generated comment early.
 * @param {string} raw - The JSDoc body.
 * @returns {string[]|null} The comment's content lines, or `null` when nothing worth carrying remains.
 * @private
 */
export function formatDocLines(raw) {
	const lines = mapList(splitText(raw, "\n"), (line) => StringMethods.trimEnd(regExpReplace(/^\s*\*? ?/, line, "")));
	const description = [];
	const tags = [];
	let current = null;
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		const tag = RegExpMethods.exec(/^@(\w+)\b\s?(.*)$/, line);
		if (tag) {
			current = { name: tag[1], lines: [tag[2]] };
			listPush(tags, current);
		} else if (current) {
			listPush(current.lines, line);
		} else {
			listPush(description, line);
		}
	}

	const out = [];
	appendList(out, trimBlank(description));
	for (let tagIndex = 0; tagIndex < tags.length; tagIndex++) {
		const { name, lines: tagLines } = tags[tagIndex];
		if (!SetMethods.has(KEPT_TAGS, name)) continue;
		// Only trailing blank lines go: a tag whose text starts on the next line (`@example` above a code block) keeps
		// that layout.
		const body = trimBlank(concatLists(["x"], tagLines));
		const first = body.length > 1 ? (SetMethods.has(TYPED_TAGS, name) ? dropType(body[1]) : body[1]) : "";
		listPush(out, first ? `@${name} ${first}` : `@${name}`);
		appendList(out, copyList(body, 2));
	}
	if (out.length === 0) return null;
	return mapList(out, (line) => regExpReplace(/\*\//g, line, "*\\/"));
}

/**
 * Append every item of `items` to `target`.
 * @param {string[]} target - List to extend.
 * @param {string[]} items - Items to add.
 * @returns {void}
 * @private
 */
function appendList(target, items) {
	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) listPush(target, items[itemIndex]);
}

/**
 * Drop leading and trailing blank lines.
 * @param {string[]} lines - Lines.
 * @returns {string[]} The trimmed copy.
 * @private
 */
function trimBlank(lines) {
	let start = 0;
	let end = lines.length;
	while (start < end && StringMethods.trim(lines[start]) === "") start++;
	while (end > start && StringMethods.trim(lines[end - 1]) === "") end--;
	return copyList(lines, start, end);
}

/**
 * The JSDoc lines for a node's originating export, read from its module file.
 * @param {{filePath: string, exportPath: string[]}|null} origin - The node's ownership origin.
 * @param {Map<string, object|null>} cache - Per-generation cache of scanned files (filePath → scan, or `null` when the
 *   file could not be read).
 * @returns {string[]|null} The comment's content lines, or `null` when the export carries no JSDoc.
 * @public
 *
 * @description
 * Lookup order: the export path as declared (`export function add`, a member of an exported object literal, a
 * CommonJS `exports.name =`); then the same path through a re-export alias; then the file-level binding it names,
 * for an export that refers to a binding declared elsewhere in the file (`module.exports = { shout }`,
 * `export default greet`, `export { add }`).
 *
 * @example
 * docLinesFor({ filePath: "/abs/api/math.mjs", exportPath: ["add"] }, new Map());
 * // ["Add two numbers.", "@param a - First addend.", "@param b - Second addend.", "@returns The sum."]
 */
export function docLinesFor(origin, cache) {
	if (!origin?.filePath || !origin.exportPath?.length) return null;
	let scanned = MapMethods.get(cache, origin.filePath);
	if (scanned === undefined) {
		try {
			scanned = scanSource(fs.readFileSync(origin.filePath, "utf8"));
		} catch {
			// A module whose file is gone or unreadable by the time types are generated: it still gets its type, just no
			// copied documentation.
			scanned = null;
		}
		MapMethods.set(cache, origin.filePath, scanned);
	}
	if (!scanned) return null;

	const exportPath = mapList(origin.exportPath, String);
	let raw = MapMethods.get(scanned.exports, ArrayMethods.join(exportPath, "."));
	if (raw === undefined) {
		const alias = MapMethods.get(scanned.aliases, exportPath[0]);
		const viaBinding = alias ? concatLists([alias], copyList(exportPath, 1)) : exportPath;
		for (let start = 0; raw === undefined && start < viaBinding.length; start++) {
			raw = MapMethods.get(scanned.locals, ArrayMethods.join(copyList(viaBinding, start), "."));
		}
	}
	return raw === undefined ? null : formatDocLines(raw);
}
