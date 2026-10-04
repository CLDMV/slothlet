/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/reserved-keys.mjs
 *	@Date: 2026-10-03T11:18:03-07:00 (1791051483)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:48:44-07:00 (1791092924)
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
