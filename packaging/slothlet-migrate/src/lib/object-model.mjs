/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/src/lib/object-model.mjs
 *	@Date: 2026-11-16T16:04:29-08:00 (1794873869)
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
 * @fileoverview An editable model of an object literal. Keys can be renamed, moved between nested
 * groups, added and removed; untouched properties and values keep their original source text
 * (including any smaller edits already made inside them), so only the literals that change are
 * reprinted.
 * @module @cldmv/slothlet-migrate/lib/object-model
 * @internal
 */

import { staticName } from "./source.mjs";

const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * @typedef {object} ModelContext
 * @property {string} code - Source text.
 * @property {import("./source.mjs").Editor} editor - Edits collected so far.
 * @property {object[]} comments - Every comment in the file (acorn onComment output).
 * @property {boolean} json - Quote every key (JSON documents).
 * @property {string} unit - One indentation step.
 */

/**
 * A property of an {@link ObjModel}.
 */
export class PropModel {
	/**
	 * @param {object} init - Fields.
	 */
	constructor(init) {
		/** "prop" for a plain `key: value`, "other" for spreads, methods, accessors, computed keys. */
		this.type = init.type;
		/** Static key name (null for "other"). */
		this.key = init.key ?? null;
		/** Key as it was written (null for created properties). */
		this.originalKey = init.originalKey ?? null;
		/** Original Property / SpreadElement node (null for created properties). */
		this.node = init.node ?? null;
		/** Original value node (null for created properties). */
		this.valueNode = init.valueNode ?? null;
		/** Nested model when the value is (or became) an object literal. */
		this.value = init.value ?? null;
		/** Replacement value text (wins over valueNode). */
		this.valueText = init.valueText ?? null;
		/** Comment texts written just before this property. */
		this.comments = init.comments ?? [];
		/** True when the key, value or position changed. */
		this.dirty = !!init.dirty;
		/** Where the property was written (orders the members of a created group like the source). */
		this.order = init.order ?? (init.node ? init.node.start : Infinity);
		/** Literal the property was read from (null for created properties). */
		this.home = init.home ?? null;
		/** Original source spans around the property: `{ lead: [start, end], after: string, comments: number }`. */
		this.raw = init.raw ?? null;
	}
}

/**
 * Model of one object literal.
 */
export class ObjModel {
	/**
	 * @param {ModelContext} ctx - Shared context.
	 * @param {object|null} node - ObjectExpression (null for a created group).
	 * @param {ObjModel|null} parent - Enclosing model.
	 */
	constructor(ctx, node, parent = null) {
		this.ctx = ctx;
		this.node = node;
		this.parent = parent;
		/** @type {PropModel[]} */
		this.props = [];
		this.changed = !node;
		this.trailingComments = [];
		this.trailingComma = false;
		if (node) this.#read();
	}

	/** Read the literal's properties and the source text between them. */
	#read() {
		const { node, ctx } = this;
		const { code } = ctx;
		const inside = ctx.comments.filter((c) => c.start > node.start && c.end < node.end);
		const count = node.properties.length;
		let leadFrom = node.start + 1;
		for (let i = 0; i < count; i++) {
			const p = node.properties[i];
			const limit = i < count - 1 ? node.properties[i + 1].start : node.end - 1;
			const leading = inside.filter((c) => c.start >= leadFrom && c.end <= p.start).map((c) => code.slice(c.start, c.end));
			// The separator after the property: its comma, then any comment on the same line.
			const chars = code.slice(p.end, limit).split("");
			for (const c of inside) if (c.start >= p.end && c.end <= limit) for (let k = c.start; k < c.end; k++) chars[k - p.end] = " ";
			const masked = chars.join("");
			const comma = masked.indexOf(",");
			const commaEnd = comma >= 0 ? comma + 1 : 0;
			const nl = masked.indexOf("\n", commaEnd);
			const afterEnd = nl >= 0 ? (masked[nl - 1] === "\r" && nl - 1 >= commaEnd ? nl - 1 : nl) : commaEnd;
			const clean = comma < 0 ? true : masked.slice(0, comma).trim() === "";
			const raw = clean
				? { lead: [leadFrom, p.start], after: code.slice(p.end + commaEnd, p.end + afterEnd), comments: leading.length }
				: null;
			leadFrom = p.end + (clean ? afterEnd : 0);
			if (!clean) leadFrom = p.end;
			const plain = p.type === "Property" && p.kind === "init" && !p.method && !p.computed;
			const key = plain ? staticName(p.key, false) : null;
			if (!plain || key === null) {
				this.props.push(new PropModel({ type: "other", node: p, comments: leading, home: this, raw }));
				continue;
			}
			const model = new PropModel({ type: "prop", key, originalKey: key, node: p, valueNode: p.value, comments: leading, home: this, raw });
			if (p.value.type === "ObjectExpression") model.value = new ObjModel(ctx, p.value, this);
			model.shorthand = p.shorthand;
			this.props.push(model);
		}
		const last = node.properties[count - 1];
		const cursor = last ? last.end : node.start + 1;
		this.tailFrom = leadFrom;
		this.trailingComments = inside.filter((c) => c.start >= leadFrom).map((c) => code.slice(c.start, c.end));
		this.rawTrailing = this.trailingComments.length;
		const tail = code.slice(cursor, node.end - 1);
		this.trailingComma = count > 0 && /^\s*,/.test(tail.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""));
	}

	/** Mark this model and its ancestors as needing a reprint. */
	touch() {
		for (let m = this; m; m = m.parent) m.changed = true;
	}

	/**
	 * Find a plain property by key.
	 * @param {string} key - Key name.
	 * @returns {PropModel|undefined} The property.
	 */
	get(key) {
		return this.props.find((p) => p.type === "prop" && p.key === key);
	}

	/**
	 * Whether the literal has spreads or other properties whose keys are not visible.
	 * @returns {boolean} True when some keys may come from elsewhere.
	 */
	hasOpaque() {
		return this.props.some((p) => p.type === "other");
	}

	/**
	 * Remove a property.
	 * @param {PropModel} prop - Property to remove.
	 * @returns {number} Its former index.
	 */
	remove(prop) {
		const index = this.props.indexOf(prop);
		if (index >= 0) {
			this.props.splice(index, 1);
			this.touch();
		}
		return index;
	}

	/**
	 * Delete a property for good; comments written above it stay, on the property that follows.
	 * @param {PropModel} prop - Property to delete.
	 * @returns {number} Its former index.
	 */
	drop(prop) {
		const index = this.remove(prop);
		const trailing = prop.raw?.after.trim();
		const kept = [...prop.comments, ...(trailing ? [trailing] : [])];
		if (kept.length) {
			const next = this.props[index];
			if (next) next.comments = [...kept, ...next.comments];
			else this.trailingComments = [...kept, ...this.trailingComments];
		}
		return index;
	}

	/**
	 * Insert a property.
	 * @param {PropModel} prop - Property.
	 * @param {number} [index] - Position (end when omitted).
	 * @returns {PropModel} The property.
	 */
	insert(prop, index = this.props.length) {
		prop.dirty = true;
		if (prop.value) prop.value.parent = this;
		this.props.splice(Math.max(0, Math.min(index, this.props.length)), 0, prop);
		this.touch();
		return prop;
	}

	/**
	 * Add a created property holding raw value text.
	 * @param {string} key - Key.
	 * @param {string} valueText - Value source.
	 * @param {number} [index] - Position.
	 * @returns {PropModel} The property.
	 */
	addRaw(key, valueText, index) {
		return this.insert(new PropModel({ type: "prop", key, valueText }), index);
	}

	/**
	 * Add a created, empty group.
	 * @param {string} key - Key.
	 * @param {number} [index] - Position.
	 * @returns {ObjModel} The group.
	 */
	addGroup(key, index) {
		const group = new ObjModel(this.ctx, null, this);
		this.insert(new PropModel({ type: "prop", key, value: group }), index);
		return group;
	}

	/**
	 * Whether the literal was written over several lines (created groups follow their parent).
	 * @returns {boolean} True for multi-line.
	 */
	multiline() {
		if (this.node) return this.ctx.code.slice(this.node.start, this.node.end).includes("\n");
		return this.parent ? this.parent.multiline() : false;
	}

	/**
	 * Indentation of the line the literal starts on.
	 * @returns {string} Leading whitespace.
	 */
	baseIndent() {
		if (!this.node) return this.parent ? this.parent.baseIndent() + this.ctx.unit : "";
		const { code } = this.ctx;
		const lineStart = code.lastIndexOf("\n", this.node.start - 1) + 1;
		return /^[ \t]*/.exec(code.slice(lineStart))[0];
	}

	/**
	 * Source text of the literal, reprinted when it changed.
	 * @returns {string} Text.
	 */
	print() {
		const { ctx } = this;
		if (!this.changed && this.node) return ctx.editor.slice(this.node.start, this.node.end);
		const props = this.node ? this.props : [...this.props].sort((a, b) => a.order - b.order);
		const items = props.map((p) => ({ prop: p, comments: p.comments, text: this.#propText(p) }));
		if (items.length === 0 && this.trailingComments.length === 0) return "{}";
		const afterOf = (p) => (p.raw && p.raw.after.trim() ? p.raw.after : "");
		const hasLineComment = [...items.flatMap((i) => i.comments), ...this.trailingComments, ...props.map(afterOf)].some((c) =>
			c.trimStart().startsWith("//")
		);
		const keepsSource = !!this.node && props.some((p) => p.home === this && p.raw);
		const multi = this.multiline() || hasLineComment;
		const base = this.baseIndent();
		const inner = base + ctx.unit;
		if (!keepsSource) {
			if (!multi) {
				const parts = items.map((i) => [...i.comments, i.text].join(" "));
				return `{ ${[...parts, ...this.trailingComments].join(", ")} }`;
			}
			const lines = [];
			items.forEach((item, i) => {
				for (const c of item.comments) lines.push(inner + c);
				const comma = i < items.length - 1 || this.trailingComma ? "," : "";
				lines.push(inner + item.text + comma + afterOf(item.prop));
			});
			for (const c of this.trailingComments) lines.push(inner + c);
			return `{\n${lines.join("\n")}\n${base}}`;
		}
		// The literal existed: untouched properties keep their original separators, indentation and trailing comments.
		let out = "{";
		items.forEach((item, i) => {
			const p = item.prop;
			const own = p.home === this && p.raw && p.comments.length === p.raw.comments;
			if (own) out += ctx.editor.slice(p.raw.lead[0], p.raw.lead[1]);
			else if (multi) out += [...item.comments.map((c) => `\n${inner}${c}`), `\n${inner}`].join("");
			else out += ` ${item.comments.map((c) => `${c} `).join("")}`;
			out += item.text + (i < items.length - 1 || this.trailingComma ? "," : "") + afterOf(p);
		});
		if (this.trailingComments.length === this.rawTrailing) out += ctx.editor.slice(this.tailFrom, this.node.end - 1);
		else if (multi) out += this.trailingComments.map((c) => `\n${inner}${c}`).join("") + `\n${base}`;
		else out += ` ${this.trailingComments.map((c) => `${c} `).join("")}`;
		return `${out}}`;
	}

	/**
	 * Text of one property.
	 * @param {PropModel} p - Property.
	 * @returns {string} Text.
	 */
	#propText(p) {
		const { ctx } = this;
		if (p.type === "other") return ctx.editor.slice(p.node.start, p.node.end);
		const keyUnchanged = p.originalKey !== null && p.key === p.originalKey;
		const valueUnchanged = p.valueText === null && (!p.value || !p.value.changed) && p.valueNode;
		if (keyUnchanged && valueUnchanged && p.node) return ctx.editor.slice(p.node.start, p.node.end);
		const keyText = keyUnchanged && p.node ? ctx.editor.slice(p.node.key.start, p.node.key.end) : formatKey(p.key, ctx.json);
		let valueText;
		if (p.valueText !== null) valueText = p.valueText;
		else if (p.value) valueText = p.value.print();
		else valueText = ctx.editor.slice(p.valueNode.start, p.valueNode.end);
		if (!ctx.json && IDENT.test(keyText) && keyText === valueText) return keyText; // shorthand
		return `${keyText}: ${valueText}`;
	}
}

/**
 * Print a key the way it must be written.
 * @param {string} key - Key.
 * @param {boolean} json - Always quote.
 * @returns {string} Key text.
 */
export function formatKey(key, json) {
	return !json && IDENT.test(key) ? key : JSON.stringify(key);
}

/**
 * Guess the indentation step used in a file.
 * @param {string} code - Source text.
 * @returns {string} A tab or a run of spaces.
 */
export function detectIndentUnit(code) {
	const m = /\n([ \t]+)\S/.exec(code);
	if (!m) return "\t";
	if (m[1].startsWith("\t")) return "\t";
	return m[1].length >= 4 ? "    " : "  ";
}
