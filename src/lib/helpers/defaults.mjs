/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/defaults.mjs
 *	@Date: 2026-09-07 09:49:38 -07:00 (1788799778)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-07 09:51:34 -07:00 (1788799894)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Single source of truth for default values shared across more than one compose-path
 * module. Each export here replaces what used to be an independently hand-typed literal duplicated
 * at every call site — change the value once, here, and every consumer moves with it. A value that
 * only one file ever reads belongs as a local constant in that file, not here.
 *
 * Also the backing content for the public `slothlet.defaults` namespace (attached in
 * `src/slothlet.mjs`): every export here is frozen and is the exact value the runtime reads — never
 * a duplicated literal — so `slothlet.defaults.<x>` can never drift from what slothlet itself does.
 * @module @cldmv/slothlet/helpers/defaults
 * @internal
 */
import { ComponentBase } from "#factories/component-base";
import { IMPL_METADATA_KEYS } from "#handlers/unified-wrapper";

/**
 * The default `apiDepth` (directory-traversal depth) applied when a caller does not specify one.
 * Unbounded by default. The config normalizer ({@link module:@cldmv/slothlet/helpers/config}) is
 * what every real compose path reads — it resolves `config.apiDepth` once and the mode processors
 * receive that already-normalized value. The mode processors' and the loader's own parameter
 * defaults exist only for the case where they are invoked directly, bypassing normalization (a
 * standalone call, a future direct consumer); they read this same constant so that case can never
 * silently disagree with the normalized default.
 * @type {number}
 */
export const DEFAULT_API_DEPTH = Infinity;

/**
 * The built-in `routines` list applied when a caller omits the `routines` config option entirely.
 * Each entry is `{ name, mode }` (bare mount-relative names, non-recursive, mode-defaulted `order`)
 * — see `docs/LIFECYCLE.md` ("Routines") for the full contract, including the `recursive`/`order`/
 * `destroy`-mode fields a caller-supplied entry may also set. Passing `routines` at all REPLACES
 * this list (it is the off-switch); a consumer that wants to extend rather than replace it spreads
 * this array: `slothlet.defaults.routines`.
 *
 * Frozen at every level (the array, and each entry object) so a consumer's spread copies the
 * entries by reference safely without risking a mutation here leaking across consumers.
 * @type {ReadonlyArray<{name: string, mode: "manual"|"startup"|"shutdown"|"destroy"}>}
 */
export const DEFAULT_ROUTINES = Object.freeze([
	Object.freeze({ name: "initialize", mode: "startup" }),
	Object.freeze({ name: "shutdown", mode: "shutdown" })
]);

/**
 * The complete set of framework-reserved export names — names a module export can never
 * meaningfully claim because the framework's own wrapper machinery already owns them.
 *
 * Derived as the union of {@link ComponentBase.INTERNAL_KEYS} (wrapper state/control properties)
 * and `IMPL_METADATA_KEYS` (child-adoption metadata) — the exact two Sets
 * `isFrameworkReservedKey()` (`#handlers/unified-wrapper`) checks against. Frozen so a consumer
 * cannot mutate the framework's own reserved-name set out from under it.
 * @type {ReadonlySet<string>}
 */
export const RESERVED_EXPORTS = Object.freeze(new Set([...ComponentBase.INTERNAL_KEYS, ...IMPL_METADATA_KEYS]));
