/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/sanitize.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:47-08:00 (1795869047)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `@cldmv/slothlet/sanitize`: the function slothlet turns file and folder names into api property names
 * with.
 * @module @cldmv/slothlet/sanitize
 * @public
 * @description
 * `sanitize(input, options)` takes the same options as the `sanitize` config option, so a build step or a test can
 * compute the property name slothlet gives a file without loading an api.
 *
 * @example
 * import { sanitize } from "@cldmv/slothlet/sanitize";
 *
 * sanitize("my-file"); // "myFile"
 * sanitize("auto-ip", { rules: { upper: ["ip"] } }); // "autoIP"
 */

export { sanitizePropertyName as sanitize } from "#helpers/sanitize";
