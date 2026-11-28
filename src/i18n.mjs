/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/i18n.mjs
 *	@Date: 2026-11-16T17:59:11-08:00 (1794880751)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:36-08:00 (1795869036)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `@cldmv/slothlet/i18n`: the process-wide language slothlet's messages are written in.
 * @module @cldmv/slothlet/i18n
 * @public
 * @description
 * `init(options)` sets the language (detected from the environment when none is given), `language.get()` reads it,
 * `language.set(lang)` switches it, and `translate(code, params)` (alias `t`) renders a message. The same operations
 * are `api.slothlet.i18n.*` on an instance. `language.set` returns a promise only where the locale loads
 * asynchronously (a browser), so `await language.set(x)` works everywhere.
 *
 * @example
 * import { language, translate } from "@cldmv/slothlet/i18n";
 *
 * language.set("es-mx");
 * translate("INVALID_ARGUMENT", { argument: "x", expected: "string", received: "number" });
 */
export { init, language, t, translate } from "#i18n";
