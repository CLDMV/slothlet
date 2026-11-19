/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/config.mjs
 *	@Date: 2026-11-16T16:07:40-08:00 (1794874060)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-19T08:57:36-08:00 (1795107456)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rewrites a v3 slothlet() config object literal (or a config JSON document) to v4.
 * Values defined elsewhere are followed when they are a `const` object literal in the same file;
 * anything else is left alone (the leftover scan reports v3 keys written anywhere in the file).
 * @module @cldmv/slothlet-migrate/lib/config
 * @internal
 */

import { ENTRIES, entry } from "./data.mjs";
import { ensureGroup, locate, moveKey, prune, relative, wrapValue } from "./keys.mjs";
import { ObjModel } from "./object-model.mjs";
import { isStringLiteral, stringValue } from "./source.mjs";

/** Config rows with their own handling (everything else with old and new is a plain key move). */
const SPECIAL = new Set([
	"config|allowMutation",
	"config|api.collision",
	"config|api.mutations.allowCollisionOverride",
	"config|collectLifecycleHooks",
	"config|collision",
	"config|dir",
	"config|manifest.files[].fullName",
	"config|permissions.references",
	"config|permissions.enabled",
	"config|routines",
	"config|scanHiddenFolders",
	"config|suppressFixes",
	"config|hidden",
	"config|context",
	"config|permissions.mode",
	"config|scope.isolation"
]);

/** Plain key moves, in table order (a parent's own move runs before moves into it). */
const MOVES = ENTRIES.filter(
	(e) => e.kind === "config" && e.old && e.new && (e.action === "rename" || e.action === "move") && !SPECIAL.has(e.id)
).map((e) => ({
	id: e.id,
	from: e.old.split("."),
	to: e.new.split(".")
}));

/** Patterns that give v3's scanHiddenFolders: true in v4. */
export const HIDDEN_REINCLUDE = ["!**/.*/", "!**/__*/"];

/**
 * @typedef {object} RewriteContext
 * @property {string} code - Source text.
 * @property {import("./source.mjs").Editor} editor - Edits.
 * @property {object[]} comments - Comments.
 * @property {boolean} json - JSON document.
 * @property {string} unit - Indent step.
 * @property {string} quote - Preferred string quote.
 * @property {import("./result.mjs").FileResult} result - Findings.
 * @property {(name: string) => object|null} resolveConst - `const name = { … }` initializer, when unique.
 * @property {Map<object, string>} visited - Literals already rewritten, with the role they had.
 * @property {Set<object>} processed - Every object literal a rewriter took responsibility for.
 */

/**
 * Quote a string for the file being edited.
 * @param {RewriteContext} ctx - Context.
 * @param {string} value - Value.
 * @returns {string} Literal text.
 */
export function q(ctx, value) {
	if (ctx.json || ctx.quote === '"') return JSON.stringify(value);
	return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * Mark a literal and every object literal nested inside it as handled.
 * @param {object} node - ObjectExpression.
 * @param {Set<object>} set - Processed set.
 * @returns {void}
 */
export function markProcessed(node, set) {
	const stack = [node];
	while (stack.length) {
		const n = stack.pop();
		if (!n || typeof n !== "object") continue;
		if (n.type === "ObjectExpression") set.add(n);
		if (n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression") continue;
		for (const k of Object.keys(n)) {
			const v = n[k];
			if (Array.isArray(v)) stack.push(...v);
			else if (v && typeof v === "object" && typeof v.type === "string") stack.push(v);
		}
	}
}

/**
 * Turn a scalar `api.collision: "merge"` into `{ mode: "merge" }` so `override` can join it.
 * @param {string} seg - Segment being entered.
 * @param {import("./object-model.mjs").PropModel} prop - Its property.
 * @param {ObjModel} obj - Literal holding it.
 * @param {boolean} dry - Only check.
 * @returns {boolean} True when the value is (or became) a group.
 */
function collisionScalar(seg, prop, obj, dry) {
	if (seg !== "collision" || prop.valueText !== null || !prop.valueNode || !isStringLiteral(prop.valueNode)) return false;
	if (!dry) wrapValue(prop, obj, "mode");
	return true;
}

/**
 * Follow `const` fragments referenced from a literal: `{ ...base }` and `{ permissions: perms }`.
 * @param {ObjModel} model - Literal model.
 * @param {string[]} prefix - Where it sits.
 * @param {RewriteContext} ctx - Context.
 * @param {(node: object, prefix: string[]) => void} visit - Rewrites a fragment.
 * @returns {void}
 */
export function followFragments(model, prefix, ctx, visit) {
	for (const p of model.props) {
		if (p.type === "other") {
			if (p.node.type === "SpreadElement" && p.node.argument.type === "Identifier") {
				const target = ctx.resolveConst(p.node.argument.name);
				if (target) visit(target, prefix);
			}
			continue;
		}
		if (p.value) followFragments(p.value, [...prefix, p.key], ctx, visit);
		else if (p.valueNode && p.valueNode.type === "Identifier") {
			const target = ctx.resolveConst(p.valueNode.name);
			if (target) visit(target, [...prefix, p.key]);
		}
	}
}

/**
 * Rewrite one config literal (and the const fragments it uses).
 * @param {object} node - ObjectExpression.
 * @param {string[]} prefix - Config path the literal sits at ([] for the whole config).
 * @param {RewriteContext} ctx - Context.
 * @param {boolean} isRoot - It is the object passed to slothlet() itself.
 * @returns {void}
 */
export function rewriteConfigNode(node, prefix, ctx, isRoot) {
	const role = `config:${prefix.join(".")}`;
	const seen = ctx.visited.get(node);
	if (seen) {
		if (seen !== role)
			ctx.result.manual("config|dir", node.start, `This object is used as two different things (${seen}, ${role}); migrate it by hand.`);
		return;
	}
	ctx.visited.set(node, role);
	markProcessed(node, ctx.processed);
	const model = new ObjModel(ctx, node);
	followFragments(model, prefix, ctx, (n, p) => rewriteConfigNode(n, p, ctx, false));
	applyConfigRules(model, prefix, ctx, isRoot);
	if (model.changed) ctx.editor.replace(node.start, node.end, model.print());
}

/**
 * Apply every config rule to one literal.
 * @param {ObjModel} model - Literal model.
 * @param {string[]} prefix - Where it sits.
 * @param {RewriteContext} ctx - Context.
 * @param {boolean} isRoot - Whole config.
 * @returns {void}
 */
export function applyConfigRules(model, prefix, ctx, isRoot) {
	const { result } = ctx;
	const at = (path) => {
		const rel = relative(path.split("."), prefix);
		return rel ? locate(model, rel) : null;
	};
	const move = (id, from, to, extra = {}) => moveKey(model, prefix, from.split("."), to.split("."), { id, result, ...extra });

	// routines: [...] → routines: { entries: [...] } (before autoRoutines / stackRoutines move into it)
	const routines = at("routines");
	if (routines && !routines.prop.value) {
		const { prop, obj } = routines;
		if (prop.valueNode && prop.valueNode.type === "ArrayExpression") {
			wrapValue(prop, obj, "entries");
			result.rewrite("config|routines", prop.node.start, "routines: [...] → routines: { entries: [...] }");
		} else {
			result.manual("config|routines", prop.node.start, "routines is a group in v4: write routines: { entries: <your array> }.");
		}
	}

	// root-level collision alias → api.collision
	move("config|collision", "collision", "api.collision");

	// api.collision per-phase object → api.collision.mode
	const collision = at("api.collision");
	if (collision && collision.prop.value) {
		const keys = collision.prop.value.props.map((p) => p.key);
		const isPhaseForm = keys.length > 0 && keys.every((k) => k === "initial" || k === "api");
		if (isPhaseForm) {
			wrapValue(collision.prop, collision.obj, "mode");
			result.rewrite(
				"config|api.collision",
				collision.prop.node.start,
				"api.collision: { initial, api } → api.collision: { mode: { initial, api } }"
			);
		}
	} else if (collision && collision.prop.valueNode && !isStringLiteral(collision.prop.valueNode) && collision.prop.valueText === null) {
		result.manual(
			"config|api.collision",
			collision.prop.node.start,
			"api.collision is a group in v4: a mode string stays as is; the per-phase { initial, api } form moves to api.collision.mode."
		);
	}
	move("config|api.mutations.allowCollisionOverride", "api.mutations.allowCollisionOverride", "api.collision.override", {
		scalar: collisionScalar
	});

	// allowMutation (v2): false → api.mutations.{add,remove,reload}: false; true → drop
	const allow = at("allowMutation");
	if (allow) {
		const { prop, obj } = allow;
		const v = prop.valueNode;
		if (v && v.type === "Literal" && typeof v.value === "boolean" && prop.valueText === null) {
			const index = obj.drop(prop);
			if (v.value === false) {
				const group = relative(["api", "mutations"], prefix)
					? ensureGroup(model, relative(["api", "mutations"], prefix), { hintObj: obj, hintIndex: index })
					: null;
				if (!group) {
					obj.insert(prop, index);
					result.manual(
						"config|allowMutation",
						prop.node.start,
						"allowMutation: false → api.mutations: { add: false, remove: false, reload: false }; api.mutations is not an object literal here."
					);
				} else {
					for (const k of ["add", "remove", "reload"]) if (!group.get(k)) group.addRaw(k, "false");
					result.rewrite(
						"config|allowMutation",
						prop.node.start,
						"allowMutation: false → api.mutations: { add: false, remove: false, reload: false }"
					);
				}
			} else {
				result.rewrite("config|allowMutation", prop.node.start, "allowMutation: true removed (mutations are allowed by default)");
			}
		} else {
			result.manual(
				"config|allowMutation",
				prop.node.start,
				"allowMutation is gone: use api.mutations: { add, remove, reload } (false blocks that operation)."
			);
		}
	}

	rewriteCollectLifecycleHooks(at, model, prefix, ctx);
	move("config|dir", "dir", "base");

	// permissions.enabled → permissions.mode (true / false are aliases of "on" / "off")
	move("config|permissions.enabled", "permissions.enabled", "permissions.mode");

	const refsBefore = at("permissions.references");
	for (const m of MOVES) move(m.id, m.from.join("."), m.to.join("."));
	if (refsBefore && !at("permissions.references")) {
		result.rewrite(
			"config|permissions.references",
			refsBefore.prop.node?.start ?? 0,
			"permissions.references removed (capture moved to permissions.caller.capture)"
		);
	}

	// manifest.files[].fullName → loader.files.files[].full (after manifest → loader.files)
	for (const path of ["loader.files.files", "manifest.files"]) {
		const files = at(path);
		if (!files || files.prop.valueText !== null || !files.prop.valueNode || files.prop.valueNode.type !== "ArrayExpression") continue;
		for (const el of files.prop.valueNode.elements) {
			if (!el || el.type !== "ObjectExpression") continue;
			for (const p of el.properties) {
				if (p.type !== "Property" || p.computed || p.method) continue;
				const name = p.key.type === "Identifier" ? p.key.name : p.key.value;
				if (name !== "fullName") continue;
				const keyText = ctx.json ? '"full"' : "full";
				const ok = p.shorthand
					? ctx.editor.replace(p.start, p.end, `${keyText}: fullName`)
					: ctx.editor.replace(p.key.start, p.key.end, keyText);
				if (ok) {
					result.rewrite("config|manifest.files[].fullName", p.start, "files[].fullName → files[].full");
				}
			}
		}
	}

	// permissions.references: dissolved once capture moved out
	const refs = at("permissions.references");
	if (refs) {
		const { prop, obj } = refs;
		if (prop.value && prop.value.props.length === 0) {
			obj.drop(prop);
			prune(obj, model);
			result.rewrite(
				"config|permissions.references",
				prop.node?.start ?? 0,
				"permissions.references removed (capture moved to permissions.caller.capture)"
			);
		} else {
			result.manual(
				"config|permissions.references",
				prop.node?.start ?? 0,
				"permissions.references is gone; its only option moved to permissions.caller.capture."
			);
		}
	}

	// scanHiddenFolders: true → hidden "!" patterns; false → drop
	const scan = at("scanHiddenFolders");
	if (scan) {
		const { prop, obj } = scan;
		const v = prop.valueNode;
		if (v && v.type === "Literal" && typeof v.value === "boolean" && prop.valueText === null) {
			if (v.value === false) {
				obj.drop(prop);
				result.rewrite("config|scanHiddenFolders", prop.node.start, "scanHiddenFolders: false removed (the default)");
			} else if (addHiddenPatterns(obj, prop, ctx)) {
				result.rewrite(
					"config|scanHiddenFolders",
					prop.node.start,
					`scanHiddenFolders: true → hidden: [..., ${HIDDEN_REINCLUDE.map((p) => q(ctx, p)).join(", ")}]`
				);
			} else {
				result.manual(
					"config|scanHiddenFolders",
					prop.node.start,
					`scanHiddenFolders is gone: add ${HIDDEN_REINCLUDE.map((p) => JSON.stringify(p)).join(", ")} to hidden.`
				);
			}
		} else {
			result.manual(
				"config|scanHiddenFolders",
				prop.node.start,
				`scanHiddenFolders is gone: add ${HIDDEN_REINCLUDE.map((p) => JSON.stringify(p)).join(", ")} to hidden where it was true.`
			);
		}
	}

	// suppressFixes: removed, no replacement
	const fixes = at("suppressFixes");
	if (fixes) {
		fixes.obj.drop(fixes.prop);
		result.rewrite(
			"config|suppressFixes",
			fixes.prop.node.start,
			"suppressFixes removed (no replacement: the v3 fixes it switched off are always on in v4)"
		);
		result.manual(
			"config|suppressFixes",
			fixes.prop.node.start,
			"suppressFixes was removed; check the code that relied on a suppressed fix."
		);
	}

	// behaviour rows: nothing to edit, worth a look
	const hidden = at("hidden");
	if (hidden && hidden.prop.node) result.info("config|hidden", hidden.prop.node.start);
	if (isRoot || prefix.length === 0) {
		const context = at("context");
		if (context) result.info("config|context", context.prop.node?.start ?? 0);
	}
	const mode = at("permissions.mode");
	if (mode && mode.prop.node) result.info("config|permissions.mode", mode.prop.node.start);
	const isolation = at("scope.isolation");
	if (isolation && isolation.prop.node) result.info("config|scope.isolation", isolation.prop.node.start);

	// v4 default changes the config does not override
	if (isRoot && !model.hasOpaque() && model.node) {
		if (!locate(model, ["routines", "auto"])) {
			result.info(
				"config|autoRoutines",
				model.node.start,
				"routines.auto now defaults to true (v3: autoRoutines false): startup / shutdown / destroy routines run by themselves. Set routines: { auto: false } to keep the v3 behaviour."
			);
		}
		if (!locate(model, ["routines", "stack"])) {
			result.info(
				"config|stackRoutines",
				model.node.start,
				"routines.stack now defaults to true (v3: stackRoutines false): every module's routine with the same name runs. Set routines: { stack: false } to keep the v3 behaviour."
			);
		}
	}
}

/** Routine modes v3's `collectLifecycleHooks: true` replaced with its two root-anchored routines. */
const TEARDOWN_MODES = new Set(["shutdown", "destroy"]);

/**
 * `collectLifecycleHooks: true` is the explicit routines v3 built from it: every shutdown / destroy
 * routine dropped, then `^**.shutdown` and `^**.destroy` added, and auto firing on unless set.
 * @param {(path: string) => ({ obj: ObjModel, prop: import("./object-model.mjs").PropModel }|null)} at - Locate by absolute path.
 * @param {ObjModel} model - Literal model.
 * @param {string[]} prefix - Where it sits.
 * @param {RewriteContext} ctx - Context.
 * @returns {void}
 */
function rewriteCollectLifecycleHooks(at, model, prefix, ctx) {
	const found = at("collectLifecycleHooks");
	if (!found) return;
	const { prop, obj } = found;
	const { result } = ctx;
	const id = "config|collectLifecycleHooks";
	const offset = prop.node?.start ?? 0;
	const v = prop.valueNode;
	const manual = (why) =>
		result.manual(
			id,
			offset,
			`collectLifecycleHooks: true → routines.entries with the root-anchored ^**.shutdown and ^**.destroy routines (and routines.auto: true); ${why}`
		);
	if (!v || prop.valueText !== null || v.type !== "Literal" || typeof v.value !== "boolean") {
		manual("its value is not a plain true / false, so write it by hand.");
		return;
	}
	if (v.value === false) {
		obj.drop(prop);
		result.rewrite(id, offset, "collectLifecycleHooks: false removed (the default)");
		return;
	}
	const routinesRel = relative(["routines"], prefix);
	if (!routinesRel) {
		manual("routines does not sit inside this object literal.");
		return;
	}
	const key = (k) => (ctx.json ? JSON.stringify(k) : k);
	const entry = (name, mode, order) =>
		`{ ${key("name")}: ${q(ctx, name)}, ${key("mode")}: ${q(ctx, mode)}${order ? `, ${key("order")}: ${q(ctx, order)}` : ""} }`;
	const added = [entry("^**.shutdown", "shutdown", "depth"), entry("^**.destroy", "destroy", "depth")];

	// Entries after the drop: v3's defaults, or the configured list, minus every shutdown / destroy routine.
	const existing = at("routines.entries");
	const routines = at("routines");
	let list;
	let arr = null;
	if (existing) {
		arr = existing.prop.valueNode;
		if (existing.prop.valueText !== null || !arr || arr.type !== "ArrayExpression") {
			manual("routines.entries is not an array literal, so the shutdown / destroy routines cannot be dropped from it automatically.");
			return;
		}
		if (ctx.comments.some((c) => c.start > arr.start && c.end < arr.end)) {
			manual("routines.entries holds comments, so it is left for you to edit.");
			return;
		}
		list = [];
		for (const el of arr.elements) {
			const mode = routineMode(el);
			if (mode === undefined) {
				manual("routines.entries has an element whose mode cannot be read statically.");
				return;
			}
			if (!TEARDOWN_MODES.has(mode)) list.push(ctx.editor.slice(el.start, el.end));
		}
	} else if (routines && !routines.prop.value) {
		manual("routines is not an object literal here.");
		return;
	} else {
		list = [entry("initialize", "startup")];
	}
	list.push(...added);

	const explicitAuto = at("autoRoutines") || at("routines.auto");
	const index = obj.drop(prop);
	const group = ensureGroup(model, routinesRel, { hintObj: obj, hintIndex: index });
	if (!group) {
		obj.insert(prop, index);
		manual("routines is not an object literal here.");
		return;
	}
	if (!explicitAuto) group.addRaw("auto", "true");
	let text;
	if (arr && ctx.code.slice(arr.start, arr.end).includes("\n")) {
		const lineStart = ctx.code.lastIndexOf("\n", arr.start - 1) + 1;
		const arrIndent = /^[ \t]*/.exec(ctx.code.slice(lineStart))[0];
		const inner = arrIndent + ctx.unit;
		text = `[\n${list.map((t) => inner + t).join(",\n")}\n${arrIndent}]`;
	} else {
		text = `[${list.join(", ")}]`;
	}
	if (existing) {
		existing.prop.valueText = text;
		existing.prop.dirty = true;
		existing.obj.touch();
	} else {
		group.addRaw("entries", text);
	}
	result.rewrite(
		id,
		offset,
		"collectLifecycleHooks: true → routines.entries with the root-anchored ^**.shutdown and ^**.destroy routines" +
			(explicitAuto ? "" : " and routines.auto: true")
	);
}

/**
 * The mode of one routines.entries element.
 * @param {object|null} el - Array element.
 * @returns {string|null|undefined} The mode ("manual" when none is written), or undefined when it cannot be read statically.
 */
function routineMode(el) {
	if (!el) return undefined;
	if (isStringLiteral(el)) {
		const value = stringValue(el);
		const colon = value.indexOf(":");
		return colon < 0 ? "manual" : value.slice(colon + 1);
	}
	if (el.type !== "ObjectExpression") return undefined;
	let mode = "manual";
	for (const p of el.properties) {
		if (p.type !== "Property" || p.computed || p.kind !== "init") return undefined;
		const name = p.key.type === "Identifier" ? p.key.name : p.key.value;
		if (name !== "mode") continue;
		if (!isStringLiteral(p.value)) return undefined;
		mode = stringValue(p.value);
	}
	return mode;
}

/**
 * Replace `scanHiddenFolders: true` with the equivalent hidden patterns.
 * @param {ObjModel} obj - Literal holding it.
 * @param {import("./object-model.mjs").PropModel} prop - The scanHiddenFolders property.
 * @param {RewriteContext} ctx - Context.
 * @returns {boolean} False when hidden exists but is not an array literal.
 */
export function addHiddenPatterns(obj, prop, ctx) {
	const patterns = HIDDEN_REINCLUDE.map((p) => q(ctx, p));
	const hidden = obj.get("hidden");
	if (!hidden) {
		const index = obj.remove(prop);
		const created = obj.addRaw("hidden", `[${patterns.join(", ")}]`, index);
		created.comments = prop.comments;
		created.home = prop.home;
		created.raw = prop.raw;
		return true;
	}
	const arr = hidden.valueNode;
	if (hidden.valueText !== null || !arr || arr.type !== "ArrayExpression") return false;
	const existing = arr.elements.filter(Boolean);
	const already = new Set(existing.filter(isStringLiteral).map(stringValue));
	const add = patterns.filter((_, i) => !already.has(HIDDEN_REINCLUDE[i]));
	const inner = ctx.editor.slice(arr.start + 1, arr.end - 1).replace(/,\s*$/, "");
	hidden.valueText = existing.length ? `[${inner.trimEnd()}${add.length ? ", " + add.join(", ") : ""}]` : `[${add.join(", ")}]`;
	hidden.dirty = true;
	obj.drop(prop);
	obj.touch();
	return true;
}

/** Entries this module rewrites or reports (for the coverage test's error messages). */
export const HANDLED = new Set([...SPECIAL, ...MOVES.map((m) => m.id)]);
for (const id of HANDLED) entry(id);
