/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/keys.mjs
 *	@Date: 2026-11-16T16:06:48-08:00 (1794874008)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:35-08:00 (1795869035)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Key moves on an {@link ObjModel}: rename in place, or move into another (created
 * on demand) group, refusing on conflicts instead of guessing.
 * @module @cldmv/slothlet-migrate/lib/keys
 * @internal
 */

import { ObjModel, PropModel } from "./object-model.mjs";

/**
 * Path relative to the prefix an object literal sits at, or null when it lies outside it.
 * @param {string[]} path - Absolute key path.
 * @param {string[]} prefix - Where the literal sits.
 * @returns {string[]|null} Relative path (at least one segment).
 */
export function relative(path, prefix) {
	if (path.length <= prefix.length) return null;
	for (let i = 0; i < prefix.length; i++) if (path[i] !== prefix[i]) return null;
	return path.slice(prefix.length);
}

/**
 * Find a property by relative path through nested object literals.
 * @param {ObjModel} model - Root model.
 * @param {string[]} rel - Relative path.
 * @returns {{ obj: ObjModel, prop: PropModel }|null} The property and the literal holding it.
 */
export function locate(model, rel) {
	let obj = model;
	for (let i = 0; i < rel.length - 1; i++) {
		const p = obj.get(rel[i]);
		if (!p || !p.value) return null;
		obj = p.value;
	}
	const prop = obj.get(rel[rel.length - 1]);
	return prop ? { obj, prop } : null;
}

/**
 * Walk to (and create) a group.
 * @param {ObjModel} model - Root model.
 * @param {string[]} segs - Group path.
 * @param {object} [opts] - Options.
 * @param {ObjModel} [opts.hintObj] - Literal where a created group should take `hintIndex`.
 * @param {number} [opts.hintIndex] - Position for a group created inside `hintObj`.
 * @param {(seg: string, prop: PropModel, obj: ObjModel, dry: boolean) => boolean} [opts.scalar] - Turns a non-object value into a group when it can.
 * @param {boolean} [opts.dry] - Only check whether the walk can succeed.
 * @returns {ObjModel|boolean|null} The group (true in a dry run), or null when a non-object value is in the way.
 */
export function ensureGroup(model, segs, opts = {}) {
	let obj = model;
	for (const seg of segs) {
		const p = obj.get(seg);
		if (!p) {
			if (opts.dry) return true;
			obj = obj.addGroup(seg, obj === opts.hintObj ? opts.hintIndex : undefined);
			continue;
		}
		if (p.value) {
			obj = p.value;
			continue;
		}
		if (opts.scalar && opts.scalar(seg, p, obj, !!opts.dry)) {
			if (opts.dry) return true;
			obj = p.value;
			continue;
		}
		return null;
	}
	return opts.dry ? true : obj;
}

/**
 * Remove groups the migration emptied, walking up but never removing the root.
 * @param {ObjModel} obj - Possibly empty group.
 * @param {ObjModel} root - Root model.
 * @returns {void}
 */
export function prune(obj, root) {
	let cur = obj;
	while (cur !== root && cur.parent && cur.props.length === 0 && cur.trailingComments.length === 0) {
		const parent = cur.parent;
		const holder = parent.props.find((p) => p.value === cur);
		if (!holder) return;
		parent.remove(holder);
		cur = parent;
	}
}

/**
 * Move (or rename) one key.
 * @param {ObjModel} model - Root model of the literal.
 * @param {string[]} prefix - Where the literal sits.
 * @param {string[]} oldPath - Absolute v3 path.
 * @param {string[]} newPath - Absolute v4 path.
 * @param {object} opts - Options.
 * @param {string} opts.id - Mapping entry id.
 * @param {import("./result.mjs").FileResult} opts.result - Findings.
 * @param {(seg: string, prop: PropModel, obj: ObjModel, dry: boolean) => boolean} [opts.scalar] - See {@link ensureGroup}.
 * @param {(prop: PropModel) => void} [opts.transform] - Adjust the value after the move.
 * @param {string} [opts.label] - Wording for messages (defaults to the dotted paths).
 * @returns {boolean} True when the key moved.
 */
export function moveKey(model, prefix, oldPath, newPath, opts) {
	const rel = relative(oldPath, prefix);
	if (!rel) return false;
	const loc = locate(model, rel);
	if (!loc) return false;
	const { obj, prop } = loc;
	const offset = prop.node ? prop.node.start : (obj.node?.start ?? 0);
	const from = oldPath.join(".");
	const to = newPath.join(".");
	const newRel = relative(newPath, prefix);
	if (!newRel) {
		opts.result.manual(opts.id, offset, `${from} → ${to}: the new place is outside this object literal; move it by hand.`);
		return false;
	}
	if (locate(model, newRel)) {
		opts.result.manual(opts.id, offset, `${from} → ${to}: both are set; keep one and delete the other by hand.`);
		return false;
	}
	const parentSegs = newRel.slice(0, -1);
	const key = newRel[newRel.length - 1];
	const sameParent = parentSegs.length === rel.length - 1 && parentSegs.every((s, i) => s === rel[i]);
	if (sameParent) {
		prop.key = key;
		prop.dirty = true;
		opts.transform?.(prop);
		obj.touch();
		opts.result.rewrite(opts.id, offset, `${from} → ${to}`, { to });
		return true;
	}
	if (!ensureGroup(model, parentSegs, { scalar: opts.scalar, dry: true })) {
		opts.result.manual(opts.id, offset, `${from} → ${to}: ${parentSegs.join(".")} is not an object literal here; move it by hand.`);
		return false;
	}
	const index = obj.remove(prop);
	const target = ensureGroup(model, parentSegs, { hintObj: obj, hintIndex: index, scalar: opts.scalar });
	prop.key = key;
	opts.transform?.(prop);
	target.insert(prop);
	if (obj !== model) prune(obj, model);
	opts.result.rewrite(opts.id, offset, `${from} → ${to}`, { to });
	return true;
}

/**
 * Wrap a property's current value one level down: `key: v` → `key: { inner: v }`.
 * @param {PropModel} prop - Property.
 * @param {ObjModel} owner - Literal holding it.
 * @param {string} inner - Inner key.
 * @returns {ObjModel} The new group.
 */
export function wrapValue(prop, owner, inner) {
	const group = new ObjModel(owner.ctx, null, owner);
	const moved = new PropModel({
		type: "prop",
		key: inner,
		value: prop.value,
		valueNode: prop.value ? null : prop.valueNode,
		valueText: prop.valueText,
		order: prop.order
	});
	if (moved.value) moved.value.parent = group;
	group.insert(moved);
	prop.value = group;
	prop.valueText = null;
	prop.dirty = true;
	owner.touch();
	return group;
}
