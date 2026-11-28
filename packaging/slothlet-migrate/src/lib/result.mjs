/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/result.mjs
 *	@Date: 2026-11-16T16:05:55-08:00 (1794873955)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:36-08:00 (1795869036)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Collects what one file's migration changed and what it could not prove.
 * @module @cldmv/slothlet-migrate/lib/result
 * @internal
 */

import { entry as lookup } from "./data.mjs";
import { position } from "./source.mjs";

/**
 * @typedef {object} Finding
 * @property {string} file - File name (as given).
 * @property {number} line - 1-based line in the original text.
 * @property {number} column - 1-based column.
 * @property {string} entry - Mapping entry id (`kind|old`).
 * @property {string[]} [also] - Further entry ids the same finding covers.
 * @property {string|null} old - v3 name.
 * @property {string|null} new - v4 name (null when removed).
 * @property {string} message - What was done, or what to do.
 * @property {"rewrite"|"manual"|"info"} level - rewrite = changed in place; manual = needs a hand edit; info = behaviour to check, nothing to edit.
 */

/** Findings for one file. */
export class FileResult {
	/**
	 * @param {string} file - File name.
	 * @param {string} code - Original text (positions refer to it).
	 */
	constructor(file, code) {
		this.file = file;
		this.code = code;
		/** @type {Finding[]} */
		this.findings = [];
		this.seen = new Set();
	}

	/**
	 * Record a finding (deduplicated by entry, level and offset).
	 * @param {"rewrite"|"manual"|"info"} level - Level.
	 * @param {string} id - Mapping entry id.
	 * @param {number} offset - Offset in the original text.
	 * @param {string} [message] - Text; defaults to the entry's note.
	 * @param {{ also?: string[], to?: string }} [extra] - Extra ids; `to` overrides the v4 name shown (e.g. a removed alias rewritten to its replacement).
	 * @returns {void}
	 */
	add(level, id, offset, message, extra = {}) {
		const key = `${level}|${id}|${offset}`;
		if (this.seen.has(key)) return;
		this.seen.add(key);
		const e = lookup(id);
		const { line, column } = position(this.code, offset);
		const finding = { file: this.file, line, column, entry: id, old: e.old, new: extra.to ?? e.new, message: message ?? e.note, level };
		if (extra.also?.length) {
			for (const other of extra.also) lookup(other);
			finding.also = extra.also;
		}
		this.findings.push(finding);
	}

	/**
	 * A rewrite that was applied.
	 * @param {string} id - Entry id.
	 * @param {number} offset - Where.
	 * @param {string} [message] - Detail.
	 * @param {{ also?: string[] }} [extra] - Extra ids.
	 * @returns {void}
	 */
	rewrite(id, offset, message, extra) {
		this.add("rewrite", id, offset, message, extra);
	}

	/**
	 * Something that needs a hand edit.
	 * @param {string} id - Entry id.
	 * @param {number} offset - Where.
	 * @param {string} [message] - What to do.
	 * @param {{ also?: string[] }} [extra] - Extra ids.
	 * @returns {void}
	 */
	manual(id, offset, message, extra) {
		this.add("manual", id, offset, message, extra);
	}

	/**
	 * A behaviour change to check; nothing to edit.
	 * @param {string} id - Entry id.
	 * @param {number} offset - Where.
	 * @param {string} [message] - Detail.
	 * @returns {void}
	 */
	info(id, offset, message) {
		this.add("info", id, offset, message);
	}

	/**
	 * Findings sorted by position.
	 * @returns {Finding[]} Sorted findings.
	 */
	sorted() {
		return [...this.findings].sort((a, b) => a.line - b.line || a.column - b.column || a.entry.localeCompare(b.entry));
	}
}
