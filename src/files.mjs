/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/files.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:27:44-08:00 (1794882464)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `@cldmv/slothlet/files`: the file list and importmap slothlet runs from in a browser.
 * @module @cldmv/slothlet/files
 * @public
 * @description
 * One namespace, usable in Node and in the page. In a browser slothlet cannot read the api folder, so a build step
 * (or an Electron main process) lists it once and hands the list to the page, together with the importmap that lets
 * the page resolve slothlet's own modules and the packages the api files import.
 *
 * - `files.assets(dir, { base })` — the file list and the importmap in one call (Node).
 * - `files.generate(dir)` — the file list alone (Node).
 * - `files.importmap(base)` — slothlet's own importmap alone (Node).
 * - `files.specifiers.slothlet(root)` / `files.specifiers.packages(root)` — the specifiers those maps are built from
 *   (Node).
 * - `files.resolver(base)` — the function that turns a listed file into a URL the page can import (page and Node).
 *
 * The Node functions read the disk. This module loads their code only when one is called, so a page can import
 * `@cldmv/slothlet/files` for `files.resolver`; calling a Node function in a browser rejects with `FILES_REQUIRES_NODE`.
 *
 * @example
 * // build.mjs (Node)
 * import { files } from "@cldmv/slothlet/files";
 * const { manifest, importmap } = await files.assets("./src/api");
 * // inline `importmap` into the page's <script type="importmap">, ship `manifest` to the page
 *
 * @example
 * // page.mjs (browser)
 * import { slothlet } from "@cldmv/slothlet";
 * import { files } from "@cldmv/slothlet/files";
 * const api = await slothlet({ loader: { files: manifest, resolve: files.resolver(new URL("./api/", import.meta.url)) } });
 */

import { createManifestResolver } from "#helpers/manifest-resolver";
import { isNode } from "#helpers/platform";
import { SlothletError } from "#errors";
import { Objects } from "#helpers/intrinsics";

/**
 * The Node-only half of this namespace, loaded the first time one of its functions is called.
 * @param {string} operation - The function called, as written (for the refusal).
 * @returns {Promise<object>} The module that implements it.
 * @throws {SlothletError} `FILES_REQUIRES_NODE` outside Node.js.
 * @private
 */
async function nodeOnly(operation) {
	if (!isNode) throw new SlothletError("FILES_REQUIRES_NODE", { operation }, null, { validationError: true });
	return import("#helpers/generate-manifest");
}

/**
 * List an api folder: the file list `slothlet()` loads from in a browser. Node only.
 * @param {string} dir - The api folder.
 * @returns {Promise<{ files: Array, directories: Array }>} The file list.
 * @public
 */
async function generate(dir) {
	return (await nodeOnly("files.generate()")).generateManifest(dir);
}

/**
 * The importmap for slothlet's own modules, served from `base`. Node only.
 * @param {string} [base="/node_modules/@cldmv/slothlet/"] - Where the page is served `@cldmv/slothlet` from.
 * @returns {Promise<{ imports: Object<string,string>, scopes: Object<string, Object<string,string>> }>} The importmap.
 * @public
 */
async function importmap(base) {
	return (await nodeOnly("files.importmap()")).generateImportMap(base);
}

/**
 * The file list and the full importmap (slothlet's own modules and the packages the api files import). Node only.
 * @param {string} dir - The api folder.
 * @param {object} [options] - Options.
 * @param {string} [options.base="/node_modules/@cldmv/slothlet/"] - Where the page is served `@cldmv/slothlet` from.
 * @returns {Promise<{ manifest: { files: Array, directories: Array }, importmap: { imports: Object<string,string>, scopes: Object<string, Object<string,string>> } }>}
 *   The file list and the importmap.
 * @public
 */
async function assets(dir, options) {
	return (await nodeOnly("files.assets()")).generateBrowserAssets(dir, options);
}

/**
 * The specifiers of slothlet's own the importmap maps. Node only.
 * @param {string} root - The `@cldmv/slothlet` package folder.
 * @returns {Promise<Set<string>>} The specifiers.
 * @public
 */
async function slothletSpecifiers(root) {
	return (await nodeOnly("files.specifiers.slothlet()")).collectSlothletSpecifiers(root);
}

/**
 * The importmap entries of any package, from its `exports`. Node only.
 * @param {string} root - The package's folder.
 * @returns {Promise<Map<string,string>>} Specifier to path inside the package.
 * @public
 */
async function packageSpecifiers(root) {
	return (await nodeOnly("files.specifiers.packages()")).collectPackageSpecifiers(root);
}

/**
 * The `@cldmv/slothlet/files` namespace.
 * @type {{
 *   assets: typeof assets,
 *   generate: typeof generate,
 *   importmap: typeof importmap,
 *   resolver: typeof createManifestResolver,
 *   specifiers: { packages: typeof packageSpecifiers, slothlet: typeof slothletSpecifiers }
 * }}
 * @public
 */
export const files = Objects.freeze({
	assets,
	generate,
	importmap,
	resolver: createManifestResolver,
	specifiers: Objects.freeze({ packages: packageSpecifiers, slothlet: slothletSpecifiers })
});
