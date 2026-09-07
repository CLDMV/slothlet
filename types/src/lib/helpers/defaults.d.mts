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
 * @module @cldmv/slothlet/helpers/defaults
 * @internal
 */
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
export const DEFAULT_API_DEPTH: number;
//# sourceMappingURL=defaults.d.mts.map