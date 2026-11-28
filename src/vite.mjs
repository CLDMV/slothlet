/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/vite.mjs
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
 * @fileoverview `@cldmv/slothlet/vite`: the vite / vitest plugin.
 * @module @cldmv/slothlet/vite
 * @public
 * @description
 * Under vitest (or vite's module runner) slothlet's api files are loaded by vite rather than by Node's own loader. The
 * plugin gives each instance its own copy of every api file, refuses a module's import of slothlet's own files, and
 * records which module loaded which file, so `self`, `context` and permissions work as they do under Node.
 *
 * @example
 * // vitest.config.mjs
 * import { defineConfig } from "vitest/config";
 * import { plugin } from "@cldmv/slothlet/vite";
 *
 * export default defineConfig({ plugins: [plugin()] });
 */

export { slothletInstanceImports as plugin } from "#helpers/instance-imports";
