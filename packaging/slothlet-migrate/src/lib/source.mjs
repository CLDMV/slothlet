/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/src/lib/source.mjs
 *	@Date: 2026-11-16T16:03:31-08:00 (1794873811)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:28:24-08:00 (1794875304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Parsing, AST walking and range edits shared by every rewriter.
 * @module @cldmv/slothlet-migrate/lib/source
 * @internal
 */

import * as acorn from "acorn";

const PARSE_OPTIONS = {
	ecmaVersion: "latest",
	allowHashBang: true,
	allowAwaitOutsideFunction: true,
	allowReturnOutsideFunction: true,
	allowImportExportEverywhere: true,
	locations: false
};

/**
 * Parse JavaScript source. Tries module first, then script (CommonJS files may use `with` or
 * octal escapes a module rejects).
 * @param {string} code - Source text.
 * @returns {{ ast: object, comments: object[] }} The program and its comments.
 * @throws {SyntaxError} When neither goal parses.
 */
export function parseProgram(code) {
	let firstError = null;
	for (const sourceType of ["module", "script"]) {
		const comments = [];
		try {
			const ast = acorn.parse(code, { ...PARSE_OPTIONS, sourceType, onComment: comments });
			return { ast, comments };
		} catch (error) {
			firstError ??= error;
		}
	}
	throw firstError;
}

/**
 * Parse a JSON document as an expression, keeping node ranges in the original text.
 * @param {string} text - JSON text.
 * @returns {{ ast: object, comments: object[] }} The top-level expression and its comments.
 */
export function parseJson(text) {
	const start = text.search(/\S/);
	if (start < 0) throw new SyntaxError("empty JSON document");
	const comments = [];
	const ast = acorn.parseExpressionAt(text, start, { ...PARSE_OPTIONS, sourceType: "module", onComment: comments });
	return { ast, comments };
}

/**
 * Whether a value is an ESTree node.
 * @param {unknown} value - Anything.
 * @returns {boolean} True for nodes.
 */
export function isNode(value) {
	return value !== null && typeof value === "object" && typeof value.type === "string";
}

/**
 * Depth-first walk. The visitor receives each node with its ancestor list (nearest last).
 * @param {object} root - Root node.
 * @param {(node: object, ancestors: object[]) => void} visit - Visitor.
 * @returns {void}
 */
export function walk(root, visit) {
	const ancestors = [];
	const step = (node) => {
		visit(node, ancestors);
		ancestors.push(node);
		for (const key of Object.keys(node)) {
			if (key === "type" || key === "start" || key === "end") continue;
			const value = node[key];
			if (Array.isArray(value)) {
				for (const item of value) if (isNode(item)) step(item);
			} else if (isNode(value)) {
				step(value);
			}
		}
		ancestors.pop();
	};
	step(root);
}

/**
 * The static name of a property key or member property: identifiers, and string literals.
 * @param {object} node - Key or property node.
 * @param {boolean} computed - Whether it was written in brackets.
 * @returns {string|null} The name, or null when it is dynamic.
 */
export function staticName(node, computed) {
	if (!node) return null;
	if (!computed && node.type === "Identifier") return node.name;
	if (node.type === "Literal" && typeof node.value === "string") return node.value;
	if (!computed && node.type === "PrivateIdentifier") return null;
	return null;
}

/**
 * Whether a node is a string literal (a plain string or a template with no expressions).
 * @param {object} node - Any node.
 * @returns {boolean} True for static strings.
 */
export function isStringLiteral(node) {
	return (
		!!node &&
		((node.type === "Literal" && typeof node.value === "string") || (node.type === "TemplateLiteral" && node.expressions.length === 0))
	);
}

/**
 * Value of a static string node.
 * @param {object} node - A node {@link isStringLiteral} accepted.
 * @returns {string} Its value.
 */
export function stringValue(node) {
	return node.type === "Literal" ? node.value : node.quasis[0].value.cooked;
}

/**
 * Re-quote a string the way the original literal was quoted.
 * @param {string} code - Source text.
 * @param {object} node - The original string node.
 * @param {string} value - New value.
 * @returns {string} The literal text.
 */
export function quoteLike(code, node, value) {
	const quote = node.type === "TemplateLiteral" ? "`" : code[node.start];
	if (quote === "'") return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
	if (quote === "`") return `\`${value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
	return JSON.stringify(value);
}

/**
 * Escape text for use inside a RegExp.
 * @param {string} text - Literal text.
 * @returns {string} Pattern source matching it exactly.
 */
export function escapeRegExp(text) {
	return text.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&");
}

/**
 * Line/column of an offset (both 1-based).
 * @param {string} code - Source text.
 * @param {number} offset - Character offset.
 * @returns {{ line: number, column: number }} Position.
 */
export function position(code, offset) {
	let line = 1;
	let lineStart = 0;
	for (let i = 0; i < offset && i < code.length; i++) {
		if (code.charCodeAt(i) === 10) {
			line++;
			lineStart = i + 1;
		}
	}
	return { line, column: offset - lineStart + 1 };
}

/**
 * Collects non-overlapping range replacements. A replacement that fully contains earlier ones
 * absorbs them (its text was built with {@link Editor#slice}, which already applied them).
 */
export class Editor {
	/**
	 * @param {string} code - Original text.
	 */
	constructor(code) {
		this.code = code;
		/** @type {Array<{ start: number, end: number, text: string }>} */
		this.edits = [];
	}

	/**
	 * Original text of a range with every edit inside it applied.
	 * @param {number} start - Start offset.
	 * @param {number} end - End offset.
	 * @returns {string} Edited text.
	 */
	slice(start, end) {
		const inner = this.edits.filter((e) => e.start >= start && e.end <= end).sort((a, b) => a.start - b.start);
		let out = "";
		let at = start;
		for (const e of inner) {
			out += this.code.slice(at, e.start) + e.text;
			at = e.end;
		}
		return out + this.code.slice(at, end);
	}

	/**
	 * Whether any edit touches the range.
	 * @param {number} start - Start offset.
	 * @param {number} end - End offset.
	 * @returns {boolean} True when an edit overlaps it.
	 */
	touched(start, end) {
		return this.edits.some((e) => e.start < end && e.end > start);
	}

	/**
	 * Replace a range.
	 * @param {number} start - Start offset.
	 * @param {number} end - End offset.
	 * @param {string} text - Replacement.
	 * @returns {boolean} False (and nothing changes) when it would cut through an earlier edit.
	 */
	replace(start, end, text) {
		const kept = [];
		for (const e of this.edits) {
			if (end > start && e.start >= start && e.end <= end) continue; // absorbed
			if (e.start < end && e.end > start) return false; // partial overlap
			if (start === end && e.start === start && e.end === start) return false; // two inserts at one point
			kept.push(e);
		}
		kept.push({ start, end, text });
		this.edits = kept;
		return true;
	}

	/**
	 * The edited text.
	 * @returns {string} Result.
	 */
	result() {
		return this.slice(0, this.code.length);
	}
}
