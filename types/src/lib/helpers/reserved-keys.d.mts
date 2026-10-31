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
export function isFrameworkReservedKey(key: string | symbol): boolean;
/**
 * The literal prefix of a write rule's path pattern: its segments before the first one holding a glob character.
 * @param {string} pattern - The path pattern (`victim.store.*`).
 * @returns {string[]} The literal segments (`["victim", "store"]`).
 * @example
 * writeTargetLiteralPrefix("victim.**"); // ["victim"]
 */
export function writeTargetLiteralPrefix(pattern: string): string[];
/**
 * Whether a write rule's path pattern names the framework's own: its namespace or root functions as the first
 * segment, or one of its internal keys as any segment. Such a target is the host's alone (#625).
 * @param {string} pattern - The path pattern.
 * @returns {boolean} Whether it names the framework's own.
 * @example
 * isFrameworkWriteTarget("slothlet.**"); // true
 * isFrameworkWriteTarget("victim.**.__metadata"); // true
 */
export function isFrameworkWriteTarget(pattern: string): boolean;
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
export function dataMemberOf(owner: object | Function, key: string | symbol): any;
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
export const WRAPPER_INTERNAL_KEYS: Set<string>;
/**
 * Framework metadata that rides on a module implementation but is not an api member — served as
 * `IMPL_METADATA_KEYS` from `#handlers/unified-wrapper`. Matched by exact name, never by prefix.
 * @type {Set<string>}
 */
export const IMPL_METADATA_KEYS: Set<string>;
//# sourceMappingURL=reserved-keys.d.mts.map