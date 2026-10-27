/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/reserved-keys.mjs
 *	@Date: 2026-10-03T11:18:03-07:00 (1791051483)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:35:16-07:00 (1792384516)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Framework-reserved property names, as plain Sets in a module with no imports.
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

/**
 * Property names reserved by the slothlet wrapper machinery — served as
 * `ComponentBase.INTERNAL_KEYS`; see that static for what each group is used for.
 * @type {Set<string>}
 */
export const WRAPPER_INTERNAL_KEYS = new Set([
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
export const IMPL_METADATA_KEYS = new Set(["__childFilePaths", "__filePath", "__childFilePathsPreMaterialize"]);

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
	return WRAPPER_INTERNAL_KEYS.has(key) || IMPL_METADATA_KEYS.has(key);
}

/**
 * The framework's root members (`slothlet`, `shutdown`, `destroy`), which only the host's write rules may name (#625).
 * @type {ReadonlySet<string>}
 * @private
 */
const FRAMEWORK_WRITE_ROOTS = Object.freeze(new Set(["slothlet", "shutdown", "destroy"]));

/**
 * The framework's own keys on api nodes, which only the host's write rules may name (#625).
 * @type {ReadonlySet<string>}
 * @private
 */
const FRAMEWORK_INTERNAL_WRITE_KEYS = Object.freeze(new Set([...WRAPPER_INTERNAL_KEYS, ...IMPL_METADATA_KEYS]));

/**
 * The literal prefix of a write rule's path pattern: its segments before the first one holding a glob character.
 * @param {string} pattern - The path pattern (`victim.store.*`).
 * @returns {string[]} The literal segments (`["victim", "store"]`).
 * @example
 * writeTargetLiteralPrefix("victim.**"); // ["victim"]
 */
export function writeTargetLiteralPrefix(pattern) {
	const prefix = [];
	for (const segment of String(pattern).split(".")) {
		if (/[*?{}[\]!()]/.test(segment)) break;
		prefix.push(segment);
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
	const segments = String(pattern).split(".");
	if (FRAMEWORK_WRITE_ROOTS.has(segments[0])) return true;
	return segments.some((segment) => FRAMEWORK_INTERNAL_WRITE_KEYS.has(segment));
}
