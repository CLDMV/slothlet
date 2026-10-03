/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/reserved-keys.mjs
 *	@Date: 2026-10-03 11:18:03 -07:00 (1791051483)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 11:18:11 -07:00 (1791051491)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
export const WRAPPER_INTERNAL_KEYS: Set<string>;
/**
 * Framework metadata that rides on a module implementation but is not an api member — served as
 * `IMPL_METADATA_KEYS` from `#handlers/unified-wrapper`. Matched by exact name, never by prefix.
 * @type {Set<string>}
 */
export const IMPL_METADATA_KEYS: Set<string>;
//# sourceMappingURL=reserved-keys.d.mts.map