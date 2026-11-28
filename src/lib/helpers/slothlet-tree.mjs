/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/slothlet-tree.mjs
 *	@Date: 2026-11-16T18:00:00-08:00 (1794880800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:45-08:00 (1795869045)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The fixed `api.slothlet.*` tree, as permission rule targets name it, and the check that a rule target
 * under `slothlet.` names something in it.
 * @module @cldmv/slothlet/helpers/slothlet-tree
 * @internal
 * @package
 */

import { compilePattern } from "#helpers/pattern-matcher";
import { ArrayMethods, Objects, RegExpMethods, setFrom, SetMethods, StringMethods } from "#helpers/intrinsics";

/**
 * Every member of the control namespace, with every optional group present (`diag` with `diagnostics: true`, `hook`
 * with hooks on). A test walks a live instance and compares, so a method added, renamed or removed must be listed here.
 * @type {ReadonlyArray<string>}
 */
export const SLOTHLET_TREE = Objects.freeze([
	"slothlet.api",
	"slothlet.api.add",
	"slothlet.api.leaves",
	"slothlet.api.modules",
	"slothlet.api.modules.add",
	"slothlet.api.modules.cache",
	"slothlet.api.modules.cache.clear",
	"slothlet.api.modules.cache.get",
	"slothlet.api.modules.discover",
	"slothlet.api.modules.remove",
	"slothlet.api.modules.sort",
	"slothlet.api.modules.stale",
	"slothlet.api.reload",
	"slothlet.api.remove",
	"slothlet.bind",
	"slothlet.caller",
	"slothlet.context",
	"slothlet.context.diagnostics",
	"slothlet.context.get",
	"slothlet.context.run",
	"slothlet.context.run.self",
	"slothlet.context.scope",
	"slothlet.context.set",
	"slothlet.diag",
	"slothlet.diag.api",
	"slothlet.diag.caches",
	"slothlet.diag.caches.get",
	"slothlet.diag.caches.has",
	"slothlet.diag.caches.ids",
	"slothlet.diag.context",
	"slothlet.diag.describe",
	"slothlet.diag.hook",
	"slothlet.diag.hook.compile",
	"slothlet.diag.hook.enabled",
	"slothlet.diag.inspect",
	"slothlet.diag.owner",
	"slothlet.diag.owner.get",
	"slothlet.diag.owner.list",
	"slothlet.diag.reference",
	"slothlet.env",
	"slothlet.event",
	"slothlet.event.deliver",
	"slothlet.event.emit",
	"slothlet.event.level",
	"slothlet.event.off",
	"slothlet.event.on",
	"slothlet.event.once",
	"slothlet.event.rules",
	"slothlet.event.rules.add",
	"slothlet.event.rules.remove",
	"slothlet.event.strategy",
	"slothlet.hook",
	"slothlet.hook.clear",
	"slothlet.hook.disable",
	"slothlet.hook.enable",
	"slothlet.hook.list",
	"slothlet.hook.off",
	"slothlet.hook.on",
	"slothlet.hook.pattern",
	"slothlet.hook.pattern.disable",
	"slothlet.hook.pattern.enable",
	"slothlet.hook.pattern.reset",
	"slothlet.hook.pin",
	"slothlet.hook.pin.disable",
	"slothlet.hook.pin.enable",
	"slothlet.hook.pin.enabled",
	"slothlet.hook.remove",
	"slothlet.i18n",
	"slothlet.i18n.init",
	"slothlet.i18n.language",
	"slothlet.i18n.language.get",
	"slothlet.i18n.language.set",
	"slothlet.i18n.t",
	"slothlet.i18n.translate",
	"slothlet.instance",
	"slothlet.instance.id",
	"slothlet.lifecycle",
	"slothlet.lifecycle.off",
	"slothlet.lifecycle.on",
	"slothlet.materialize",
	"slothlet.materialize.complete",
	"slothlet.materialize.get",
	"slothlet.materialize.wait",
	"slothlet.metadata",
	"slothlet.metadata.caller",
	"slothlet.metadata.get",
	"slothlet.metadata.global",
	"slothlet.metadata.remove",
	"slothlet.metadata.self",
	"slothlet.metadata.set",
	"slothlet.node",
	"slothlet.owner",
	"slothlet.owner.get",
	"slothlet.permissions",
	"slothlet.permissions.control",
	"slothlet.permissions.control.gating",
	"slothlet.permissions.control.gating.read",
	"slothlet.permissions.control.mode",
	"slothlet.permissions.control.report",
	"slothlet.permissions.control.seal",
	"slothlet.permissions.control.sealed",
	"slothlet.permissions.global",
	"slothlet.permissions.global.check",
	"slothlet.permissions.global.check.access",
	"slothlet.permissions.global.check.call",
	"slothlet.permissions.global.rules",
	"slothlet.permissions.global.rules.module",
	"slothlet.permissions.global.rules.path",
	"slothlet.permissions.principal",
	"slothlet.permissions.principal.invalidate",
	"slothlet.permissions.principal.register",
	"slothlet.permissions.principal.unregister",
	"slothlet.permissions.rules",
	"slothlet.permissions.rules.add",
	"slothlet.permissions.rules.remove",
	"slothlet.permissions.self",
	"slothlet.permissions.self.access",
	"slothlet.permissions.self.rules",
	"slothlet.pin",
	"slothlet.pin.caller",
	"slothlet.reload",
	"slothlet.restart",
	"slothlet.same",
	"slothlet.sanitize",
	"slothlet.shutdown",
	"slothlet.types",
	"slothlet.types.IN_FLIGHT",
	"slothlet.types.UNMATERIALIZED",
	"slothlet.version",
	"slothlet.versioning",
	"slothlet.versioning.default",
	"slothlet.versioning.list",
	"slothlet.versioning.metadata",
	"slothlet.versioning.metadata.get",
	"slothlet.versioning.metadata.set",
	"slothlet.versioning.remove",
	"slothlet.warnings",
	"slothlet.warnings.clear",
	"slothlet.warnings.get"
]);

/**
 * The members that are not groups: functions and values (no other member is listed below them).
 * @type {ReadonlyArray<string>}
 */
const SLOTHLET_LEAVES = Objects.freeze(
	ArrayMethods.filter(
		SLOTHLET_TREE,
		(member) => !ArrayMethods.some(SLOTHLET_TREE, (other) => StringMethods.startsWith(other, `${member}.`))
	)
);

/**
 * Members whose own keys are data rather than methods (the env snapshot, the config context and reference): a target
 * below one of these names a key slothlet does not know in advance, so any one is accepted.
 * @type {ReadonlyArray<string>}
 */
export const SLOTHLET_TREE_DATA = Objects.freeze(["slothlet.env", "slothlet.diag.context", "slothlet.diag.reference"]);

/**
 * The rule access levels that grant the write, whose targets may name a member not there yet.
 * @type {Set<string>}
 */
const WRITE_LEVELS = setFrom(["write", "full"]);

/**
 * Whether a rule target pattern under `slothlet.` can match anything in the fixed tree. A target whose level grants
 * the write (`:write`, `:full`) is accepted as it is: it names a place in the namespace, where a write the host grants
 * can add a member that is not there yet. For any other target only the path part counts (a hook `:type` or a level
 * `:call`, `:read`, `:access` suffix is left off), and a target below a data member is accepted whatever its key.
 * @param {string} target - A rule target that starts with `slothlet.`.
 * @returns {boolean} True when the pattern matches at least one member.
 * @example
 * namesSlothletMember("slothlet.permissions.rules.add"); // true
 * namesSlothletMember("slothlet.permissions.addRule"); // false
 * namesSlothletMember("slothlet.hook.**"); // true
 * namesSlothletMember("slothlet.planted:write"); // true
 * namesSlothletMember("slothlet.planted:full"); // true
 * namesSlothletMember("slothlet.planted:read"); // false
 * namesSlothletMember("slothlet.i18n.translate.name"); // true: a property of the function
 */
export function namesSlothletMember(target) {
	const colon = StringMethods.indexOf(target, ":");
	if (colon >= 0 && SetMethods.has(WRITE_LEVELS, StringMethods.slice(target, colon + 1))) return true;
	const path = colon >= 0 ? StringMethods.slice(target, 0, colon) : target;
	for (let i = 0; i < SLOTHLET_TREE_DATA.length; i++) {
		if (StringMethods.startsWith(path, `${SLOTHLET_TREE_DATA[i]}.`)) return true;
	}
	// A member that is not a group is a function or a value, with properties of its own (a function's `name` and
	// `length`): a literal path below one names one of those.
	const literal = RegExpMethods.exec(/^[^*?{}!()[\]]*/, path)[0];
	for (let i = 0; i < SLOTHLET_LEAVES.length; i++) {
		if (StringMethods.startsWith(literal, `${SLOTHLET_LEAVES[i]}.`)) return true;
	}
	const matches = compilePattern(path);
	return ArrayMethods.some(SLOTHLET_TREE, (member) => matches(member)) || matches("slothlet");
}
