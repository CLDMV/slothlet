/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_multi_export_skip/utils.mjs
 *	@Date: 2026-03-05 00:00:00 -08:00 (1772928000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-05 00:00:00 -08:00 (1772928000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root-level utils.mjs that seeds api.utils.sharedKey via flatten-to-category.
 * When collision.initial = "skip", the second assignment from utils/utils.mjs is blocked,
 * exercising the DEBUG_MODE_FLATTEN_MULTI_EXPORT_BLOCKED debug path (modes-processor L543-546).
 * @module api_smart_flatten_multi_export_skip.utils
 */

/**
 * Shared key pre-populated at root level — blocks the utils/utils.mjs assignment via skip.
 * @returns {string} "root-shared"
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_multi_export_skip.utils.sharedKey();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_multi_export_skip.utils.sharedKey();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_multi_export_skip.utils.sharedKey();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_multi_export_skip.utils.sharedKey();
 */
export const sharedKey = () => "root-shared";
