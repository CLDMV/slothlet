/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/reserved-keys.mjs
 *	@Date: 2026-10-03T11:18:03-07:00 (1791051483)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:48:08-08:00 (1794635288)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Framework-reserved property names, as plain Sets in a module whose only import is helpers/intrinsics (no top-level await).
 * @module @cldmv/slothlet/helpers/reserved-keys
 * @internal
 *
 * @description
 * `ComponentBase.INTERNAL_KEYS` (`#factories/component-base`) and `IMPL_METADATA_KEYS`
 * (`#handlers/unified-wrapper`) are these exact Set objects. They live here so
 * `helpers/defaults` can build `slothlet.defaults.reservedExports` without loading the wrapper
 * classes, whose import graph reaches `helpers/platform` and its top-level await. index.mjs imports
 * `helpers/defaults` statically and index.cjs loads index.mjs through Node's synchronous
 * require(esm), which rejects any module graph containing top-level await.
 */

import {
	ArrayMethods,
	concatLists,
	listPush,
	Objects,
	RegExpMethods,
	setFrom,
	SetMethods,
	setToArray,
	splitText,
	String
} from "@cldmv/slothlet/helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "@cldmv/slothlet/helpers/instance-imports";

/**
 * Property names reserved by the slothlet wrapper machinery — served as
 * `ComponentBase.INTERNAL_KEYS`; see that static for what each group is used for.
 * @type {Set<string>}
 */
const WRAPPER_INTERNAL_KEYS = setFrom([
	// 4-underscore: true private state
	"____slothletInternal",
	"____slothlet",
	// 3-underscore: mutation APIs — access via resolveWrapper(proxy).___setImpl etc.
	"___getState",
	"___setImpl",
	"___resetLazy",
	"___invalidate",
	// 2-underscore: read-only info/mode/state props exposed through proxy
	"__state",
	"__invalid",
	"__mode",
	"__apiPath",
	"__slothletPath",
	"__isCallable",
	"__materializeOnCreate",
	"__displayName",
	"__type",
	"__metadata",
	"__filePath",
	"__sourceFolder",
	"__moduleID",
	"__materialized",
	"__inFlight",
	"__impl",
	// 1-underscore: internal method and raw impl alias
	"_impl",
	"_materialize"
	// NOTE: "slothlet"/"shutdown"/"destroy" are intentionally NOT listed here. They are
	// builtin namespace/lifecycle keys injected by buildFinalAPI directly onto the plain
	// root object (never a UnifiedWrapper — see api_builder.mjs buildFinalAPI), so this
	// Set — used to filter *wrapper* proxies (getTrap/setTrap/_extractFullImpl/
	// _collectCustomProperties) — never actually protects the root: every UnifiedWrapper
	// is, by construction, a NESTED node. Including them here only ever blocked
	// legitimately-named nested `shutdown`/`destroy`/`slothlet` exports from being read,
	// written, or serialized (see issue #176).
]);

/**
 * Framework metadata that rides on a module implementation but is not an api member — served as
 * `IMPL_METADATA_KEYS` from `#handlers/unified-wrapper`. Matched by exact name, never by prefix.
 * @type {Set<string>}
 */
const IMPL_METADATA_KEYS = setFrom(["__childFilePaths", "__filePath", "__childFilePathsPreMaterialize"]);

/**
 * Whether a property name belongs to the framework rather than to a module's exports.
 *
 * @param {string|symbol} key - Property name to classify.
 * @returns {boolean} True when the name is reserved by the framework.
 * @package
 *
 * @description
 * Matched against the framework's own reserved names — {@link WRAPPER_INTERNAL_KEYS} (wrapper state
 * and control props) plus {@link IMPL_METADATA_KEYS} — never by underscore prefix. Every check of
 * whether a key is the framework's goes through here, so the rule cannot drift between sites. The documented hidden-entry
 * rule (docs/MODULE-STRUCTURE.md) hides `.`/`__`-prefixed FILES and FOLDERS; it says nothing about
 * export names, and a module that writes `export const __priv` has deliberately put that member on
 * its surface. Treating the prefix as internal silently dropped such exports from the composed api
 * in lazy mode while eager served them.
 *
 * @example
 * isFrameworkReservedKey("__childFilePaths"); // true
 * isFrameworkReservedKey("__priv"); // false — a module's own export
 */
export function isFrameworkReservedKey(key) {
	if (typeof key !== "string") return false;
	return SetMethods.has(WRAPPER_INTERNAL_KEYS, key) || SetMethods.has(IMPL_METADATA_KEYS, key);
}

/**
 * The framework's root members (`slothlet`, `shutdown`, `destroy`), which only the host's write rules may name (#625).
 * @type {ReadonlySet<string>}
 * @private
 */
const FRAMEWORK_WRITE_ROOTS = Objects.freeze(setFrom(["slothlet", "shutdown", "destroy"]));

/**
 * The framework's own keys on api nodes, which only the host's write rules may name (#625).
 * @type {ReadonlySet<string>}
 * @private
 */
const FRAMEWORK_INTERNAL_WRITE_KEYS = Objects.freeze(
	setFrom(concatLists(setToArray(WRAPPER_INTERNAL_KEYS), setToArray(IMPL_METADATA_KEYS)))
);

/**
 * The literal prefix of a write rule's path pattern: its segments before the first one holding a glob character.
 * @param {string} pattern - The path pattern (`victim.store.*`).
 * @returns {string[]} The literal segments (`["victim", "store"]`).
 * @example
 * writeTargetLiteralPrefix("victim.**"); // ["victim"]
 */
export function writeTargetLiteralPrefix(pattern) {
	const prefix = [];
	for (let ofIndex = 0, ofList = splitText(String(pattern), "."); ofIndex < ofList.length; ofIndex++) {
		const segment = ofList[ofIndex];
		if (RegExpMethods.exec(/[*?{}[\]!()]/, segment) !== null) break;
		listPush(prefix, segment);
	}
	return prefix;
}

/**
 * Whether a write rule's path pattern names the framework's own: its namespace or root functions as the first
 * segment, or one of its internal keys as any segment. Such a target is the host's alone (#625).
 * @param {string} pattern - The path pattern.
 * @returns {boolean} Whether it names the framework's own.
 * @example
 * isFrameworkWriteTarget("slothlet.**"); // true
 * isFrameworkWriteTarget("victim.**.__metadata"); // true
 */
export function isFrameworkWriteTarget(pattern) {
	const segments = splitText(String(pattern), ".");
	if (SetMethods.has(FRAMEWORK_WRITE_ROOTS, segments[0])) return true;
	return ArrayMethods.some(segments, (segment) => SetMethods.has(FRAMEWORK_INTERNAL_WRITE_KEYS, segment));
}

/**
 * A member's value when the member holds data, read from its descriptor; `undefined` for an accessor.
 *
 * Walks over the api tree that look for wrappers still loading (draining loads on mount and on shutdown) read
 * members this way: a getter holds no load in flight, and it is the module's own code, which runs when something
 * reads it, as that reader — never as a side effect of the framework walking the tree (#597).
 *
 * @param {object|Function} owner - The object holding the member.
 * @param {string|symbol} key - The member.
 * @returns {*} Its value, or `undefined` for an accessor.
 * @internal
 *
 * @example
 * dataMemberOf({ get x() { return 1; }, y: 2 }, "y"); // 2 — and "x" gives undefined without running the getter
 */
export function dataMemberOf(owner, key) {
	const descriptor = Objects.getOwnPropertyDescriptor(owner, key);
	if (!descriptor) return owner[key];
	return Objects.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (
		!mayTakeInternals(consumer, [
			"lib/factories/component-base",
			"lib/handlers/permission-manager",
			"lib/handlers/unified-wrapper",
			"lib/helpers/defaults"
		])
	)
		throw ownBindingsRefusal("lib/helpers/reserved-keys", import.meta.url);
	return {
		get IMPL_METADATA_KEYS() {
			return IMPL_METADATA_KEYS;
		},
		get WRAPPER_INTERNAL_KEYS() {
			return WRAPPER_INTERNAL_KEYS;
		}
	};
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof WRAPPER_INTERNAL_KEYS} */
const guarded_WRAPPER_INTERNAL_KEYS = guardInternal(WRAPPER_INTERNAL_KEYS, "WRAPPER_INTERNAL_KEYS", import.meta.url);
/** @type {typeof IMPL_METADATA_KEYS} */
const guarded_IMPL_METADATA_KEYS = guardInternal(IMPL_METADATA_KEYS, "IMPL_METADATA_KEYS", import.meta.url);
export { guarded_WRAPPER_INTERNAL_KEYS as WRAPPER_INTERNAL_KEYS, guarded_IMPL_METADATA_KEYS as IMPL_METADATA_KEYS };
