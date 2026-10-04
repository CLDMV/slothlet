/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_default_ownership_revert/notifications/helperA.mjs
 *	@Date: 2026-09-14T15:15:27-07:00 (1789424127)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:39-07:00 (1791090879)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture for #366/#372 ownership-revert coverage: file WITHOUT a default export in the
 * `notifications` multi-default folder (Rule 5 / C03) — its named exports get hoisted
 * directly onto the `notifications` namespace instead of nesting under `helperA`.
 *
 * Exports two RAW (non-function) values so their hoist constructs no UnifiedWrapper,
 * exercising `#assignWithRoutineRevert`'s no-wrapper `else` branch on rejection:
 *   - `shared`: collides with helperB.mjs's own `shared` hoist within this SAME build
 *     (same moduleID) — whichever of the two files is processed second finds a genuine
 *     prior ownership entry already registered by the other, exercising the
 *     `#revertOwnershipEntry` `restoreEntry` arm. Order-independent: regardless of which
 *     file the loader processes first, the second one to hoist `shared` is the one that
 *     collides and reverts.
 *   - `constructor`: `notifications` is a UnifiedWrapper namespace, and its proxy's own
 *     `constructor` trap answers `Object.prototype.constructor` for an ordinary
 *     framework-built namespace — so `targetApi.constructor` reads as already "existing"
 *     from the very first moment the namespace exists, with NO prior ownership
 *     registration ever having been made for that exact path. Hoisting this key always
 *     collides (order-independent) and, being the ONLY thing ever attempted at that path,
 *     always reverts via the `#revertOwnershipEntry` `removePath` arm (nothing to restore).
 */

export const shared = "helperA-value";
export const constructor = "not-a-function";
