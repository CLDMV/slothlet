/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/trusted-root.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Trusted-root markers and genuine-wrapper registry for permission hardening.
 * @module @cldmv/slothlet/handlers/trusted-root
 * @internal
 *
 * @description
 * Shared, module-private symbols/registries used by permission enforcement to distinguish
 * genuinely host-initiated calls from calls made inside an active context.
 *
 * - `TRUSTED_ROOT` marks the base context store created when a slothlet instance is set up. When a
 *   call/read occurs with **no active context** and the instance's base store carries this marker,
 *   the call is treated as host-initiated (allowed). This lets enforcement fail closed on a
 *   missing/forged caller inside a context while keeping ordinary external host calls working.
 * - `genuineWrappers` is a `WeakSet` of every real `UnifiedWrapper` instance. A caller identity
 *   (`ctx.currentWrapper`) that is not in this set is a forged object and is denied.
 * - `PROTECT_SENTINEL` marks owner-locked ("protected") context keys (used by owner-locked keys,
 *   H5): a key whose owner is this sentinel is write-once/unowned and can never be written by
 *   module-land code.
 *
 * These are reachable only via the package-internal `#handlers/trusted-root` specifier — never a
 * public export — so module-land code can neither read the markers nor spoof registry membership.
 */

/**
 * Marker set on a slothlet instance's base context store to identify host-initiated calls.
 * @type {symbol}
 * @internal
 */
export const TRUSTED_ROOT = Symbol("slothlet.trustedRoot");

/**
 * Registry of every genuine `UnifiedWrapper` instance. A caller identity absent from this set is a
 * forged object and is denied by permission enforcement.
 * @type {WeakSet<object>}
 * @internal
 */
export const genuineWrappers = new WeakSet();

/**
 * Sentinel owner for write-once/unowned ("protected") context keys.
 * @type {symbol}
 * @internal
 */
export const PROTECT_SENTINEL = Symbol("slothlet.protect");
