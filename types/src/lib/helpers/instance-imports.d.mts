/**
 * Whether a specifier names a file relative to (or absolute from) its importer, as opposed to a
 * bare package/builtin/subpath-import specifier.
 * @param {string} specifier - The import/require specifier as written.
 * @returns {boolean} True for `./`, `../`, `/` and `file:` specifiers.
 * @internal
 * @example
 * isFileSpecifier("../lib/state.mjs"); // true
 * isFileSpecifier("@cldmv/slothlet/runtime"); // false
 */
export function isFileSpecifier(specifier: string): boolean;
/**
 * Whether a module resolved at `child` (imported from `parent`) belongs to the importing leaf's
 * per-instance graph. Slothlet's own files are always shared. A file inside a `node_modules`
 * package is per instance only when the importer lives in that same package — a slothlet plugin
 * installed as a dependency keeps its own helpers per instance, while a relative path that
 * reaches into some other package does not duplicate that package.
 * @param {string} child - Resolved child (`file:` URL, path or vite id).
 * @param {string} parent - The importer (`file:` URL, path or vite id).
 * @returns {boolean} True when the child should carry the parent's instance query.
 * @internal
 * @example
 * isInstanceScopedFile("/app/lib/state.mjs", "/app/api/tally.mjs"); // true
 * isInstanceScopedFile("/app/node_modules/x/index.js", "/app/api/tally.mjs"); // false
 */
export function isInstanceScopedFile(child: string, parent: string): boolean;
/**
 * Copy the slothlet instance query from `parent` onto `child` when the import belongs to the
 * leaf's per-instance graph; otherwise return `child` unchanged. Works on `file:` URLs (Node) and
 * on vite ids (absolute paths with an optional query) alike.
 * @param {string} specifier - The specifier as written in the importer.
 * @param {string|undefined} parent - The importer's URL or id.
 * @param {string} child - The resolved child URL or id.
 * @returns {string} `child`, with the instance query appended when it applies.
 * @internal
 * @example
 * propagateInstanceQuery("../lib/state.mjs", "file:///app/api/tally.mjs?slothlet_instance=a", "file:///app/lib/state.mjs");
 * // → "file:///app/lib/state.mjs?slothlet_instance=a"
 */
export function propagateInstanceQuery(specifier: string, parent: string | undefined, child: string): string;
/**
 * Register the resolve hook with Node, once per process (idempotent across slothlet copies).
 * Uses the synchronous in-thread `module.registerHooks()` (Node >= 22.15 / 23.5, slothlet's engines
 * floor). The off-thread `module.register()` is deliberately not used: it adds a cross-thread round
 * trip to every import in the process and reorders module evaluation enough to break leaves that
 * start a fire-and-forget runtime import. A host without `registerHooks()` is left untouched.
 * @param {object} nodeModule - The `node:module` namespace.
 * @param {object} [registry=globalThis] - Where the process-wide "registered" flag lives; the global
 *   object in production, so every slothlet copy in the process sees one registration.
 * @returns {boolean} True when a hook is (now or already) registered.
 * @internal
 * @example
 * installInstanceImportHooks(await import("node:module"));
 */
export function installInstanceImportHooks(nodeModule: object, registry?: object): boolean;
/**
 * Vite plugin applying the same rule inside a vite module graph — for leaves a consumer loads
 * through slothlet's `import` hook under vitest (docs/TESTING.md), where Node's resolve hooks
 * never see the leaf's imports. Add it to the consumer's `vitest.config` `plugins`.
 * @returns {object} A vite plugin (`name`, `enforce`, `resolveId`).
 * @public
 * @example
 * // vitest.config.mjs
 * import { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
 * export default defineConfig({ plugins: [slothletInstanceImports()] });
 */
export function slothletInstanceImports(): object;
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/instance-imports.mjs
 *	@Date: 2026-09-28 20:32:55 -07:00 (1790652775)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 20:55:29 -07:00 (1790654129)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Carry a leaf's per-instance import query onto the relative helpers it imports (#518).
 * @module @cldmv/slothlet/helpers/instance-imports
 *
 * @description
 * The loader imports every leaf with a per-instance query
 * (`?slothlet_instance=<id>[&module=<moduleID>][&_reload=<timestamp>]`), so each instance — and each
 * reload — evaluates its own copy of the leaf. A module the leaf IMPORTS is resolved by the host,
 * which knows nothing about that query: a relative helper would be one module shared by every
 * instance and every reload, and module-level state in it would leak between instances.
 *
 * This module closes that gap for everything reachable through relative or `file:` specifiers,
 * at any depth:
 *
 * - **Native Node** — {@link installInstanceImportHooks} registers a process-wide, in-thread resolve
 *   hook (`module.registerHooks()`, Node >= 22.15 — slothlet's engines floor) that copies the
 *   importing module's instance parameter onto the child. Registered once per process; a no-op
 *   for every import whose parent carries no slothlet query.
 * - **Vite / vitest** — {@link slothletInstanceImports} is the same rule as a vite `resolveId`
 *   plugin, for leaves loaded through a consumer's `import` hook into a vite module graph (where
 *   Node's resolve hooks never run).
 *
 * A helper is ONE copy per instance. Only `slothlet_instance` is copied: not the leaf's `module`
 * (mount) parameter, so the base leaves and every `api.slothlet.api.add` mount share the copy; and
 * not the leaf's `_reload` stamp, so a partial reload (`api.slothlet.api.reload(…)`) re-imports the
 * reloaded leaves against the instance's existing helper copy — helper state survives it. A full
 * reload (`api.slothlet.reload()`) rotates the instance ID, which is what gives helpers a fresh
 * copy; edits to helper code therefore need a full reload.
 *
 * What stays shared: bare specifiers (`node_modules` packages, `node:` builtins, subpath `#imports`,
 * `@cldmv/slothlet` and its runtime), any file inside a `node_modules` package other than the
 * importer's own, and slothlet's own source files — the live-binding runtime must remain one
 * module per process.
 */
/**
 * Query parameters copied from a leaf onto its helpers: the instance only. The leaf's `module`
 * (mount) and `_reload` (partial-reload stamp) parameters are deliberately NOT copied — a helper is
 * one copy per instance, shared by every mount and kept across partial reloads; a full reload
 * rotates the instance ID and so yields a fresh copy.
 * @type {ReadonlyArray<string>}
 * @internal
 */
export const INSTANCE_QUERY_KEYS: ReadonlyArray<string>;
/**
 * Resolve-result shape shared by Node's resolve hooks.
 */
export type ResolveResult = {
    /**
     * - The resolved module URL.
     */
    url: string;
    /**
     * - The module format hint.
     */
    format?: string | undefined;
    /**
     * - Whether the chain was short-circuited.
     */
    shortCircuit?: boolean | undefined;
};
/**
 * Node's next-in-chain resolve function.
 */
export type NextResolve = (specifier: string, context?: object | undefined) => ResolveResult | Promise<ResolveResult>;
//# sourceMappingURL=instance-imports.d.mts.map