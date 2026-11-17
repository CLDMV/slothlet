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

	/** Read the literal's properties and the comments between them. */
	#read() {
		const { node, ctx } = this;
		const inside = ctx.comments.filter((c) => c.start > node.start && c.end < node.end);
		let cursor = node.start + 1;
		for (const p of node.properties) {
			const leading = inside.filter((c) => c.start >= cursor && c.end <= p.start).map((c) => ctx.code.slice(c.start, c.end));
			cursor = p.end;
			const plain = p.type === "Property" && p.kind === "init" && !p.method && !p.computed;
			const key = plain ? staticName(p.key, false) : null;
			if (!plain || key === null) {
				this.props.push(new PropModel({ type: "other", node: p, comments: leading }));
				continue;
			}
			const model = new PropModel({ type: "prop", key, originalKey: key, node: p, valueNode: p.value, comments: leading });
			if (p.value.type === "ObjectExpression") model.value = new ObjModel(ctx, p.value, this);
			model.shorthand = p.shorthand;
			this.props.push(model);
		}
		this.trailingComments = inside.filter((c) => c.start >= cursor).map((c) => ctx.code.slice(c.start, c.end));
		const tail = ctx.code.slice(cursor, node.end - 1);
		this.trailingComma = node.properties.length > 0 && /^\s*,/.test(tail.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""));
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
		if (prop.comments.length) {
			const next = this.props[index];
			if (next) next.comments = [...prop.comments, ...next.comments];
			else this.trailingComments = [...prop.comments, ...this.trailingComments];
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
		const items = props.map((p) => ({ comments: p.comments, text: this.#propText(p) }));
		if (items.length === 0 && this.trailingComments.length === 0) return "{}";
		const hasLineComment = [...items.flatMap((i) => i.comments), ...this.trailingComments].some((c) => c.startsWith("//"));
		if (!this.multiline() && !hasLineComment) {
			const parts = items.map((i) => [...i.comments, i.text].join(" "));
			return `{ ${[...parts, ...this.trailingComments].join(", ")} }`;
		}
		const base = this.baseIndent();
		const inner = base + ctx.unit;
		const lines = [];
		items.forEach((item, i) => {
			for (const c of item.comments) lines.push(inner + c);
			const comma = i < items.length - 1 || this.trailingComma ? "," : "";
			lines.push(inner + item.text + comma);
		});
		for (const c of this.trailingComments) lines.push(inner + c);
		return `{\n${lines.join("\n")}\n${base}}`;
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
