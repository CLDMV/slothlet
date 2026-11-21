/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/helpers/browser-env.mjs
 *	@Date: 2026-11-15T12:30:00-08:00 (1794774600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:04-08:00 (1794882484)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Compose a fixture folder in browser mode from a manifest built from a list of its files, and mount
 * more of the fixture later, for the shared rows under `tests/browser/cases/`.
 *
 * @description
 * A browser instance only reaches the files its manifest names, and `api.slothlet.api.add()` mounts a folder or file
 * of that manifest. A row that mounts a folder outside the instance's root (the Node rows mount other fixture folders
 * by path) names it with `mountTarget`, which adds it to the manifest under a name of its own after the instance is
 * built, so the root never lists it. The resolver maps each manifest path back to the file vite serves.
 * @module tests/browser/helpers/browser-env
 */

/**
 * The manifest, the URL map and the base URL each instance was built with.
 * @type {WeakMap<object, {manifest: object, urls: Map<string, string>, base: string, fixture: string, mounts: number}>}
 */
const INSTANCES = new WeakMap();

/**
 * The URL of a fixture file or folder, as vite serves it.
 * @param {string} fixture - The fixture folder, relative to the repository.
 * @param {string} [rel=""] - A path inside it.
 * @returns {string} The URL.
 */
const served = (fixture, rel = "") => new URL("/" + fixture + "/" + rel, location.origin).href;

/**
 * Add a file to a manifest node by its path, creating the folders on the way.
 * @param {object} root - The manifest's top node.
 * @param {string} rel - The file's path in the manifest.
 * @returns {void}
 */
function place(root, rel) {
	const segments = rel.split("/");
	const fullName = segments.pop();
	let node = root;
	for (let i = 0; i < segments.length; i++) {
		const path = segments.slice(0, i + 1).join("/");
		let dir = node.directories.find((entry) => entry.path === path);
		if (!dir) {
			dir = { name: segments[i], path, children: { files: [], directories: [] } };
			node.directories.push(dir);
		}
		node = dir.children;
	}
	node.files.push({ path: rel, name: fullName.replace(/\.[^.]+$/, ""), full: fullName });
}

/**
 * The browser environment the shared rows run in.
 * @type {object}
 */
export const env = {
	platform: "browser",

	/**
	 * Build an instance over a folder of a fixture.
	 * @param {{fixture: string, root?: string, files: string[], options?: object}} spec - The fixture, the folder inside
	 *   it that is the api root, the files under that folder, and the instance options.
	 * @returns {Promise<object>} The api.
	 */
	async compose({ fixture, root = "", files, options = {} }) {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const prefix = root ? root + "/" : "";
		const manifest = { files: [], directories: [] };
		const urls = new Map();
		for (const rel of files) {
			place(manifest, rel);
			urls.set(rel, served(fixture, prefix + rel));
		}
		const base = served(fixture, prefix);
		const api = await slothlet({
			base,
			loader: {
				platform: "browser",
				files: manifest,
				resolve: ({ path }) => urls.get(path) ?? new URL(path, base).href
			},
			silent: true,
			...options
		});
		INSTANCES.set(api, { manifest, urls, base, fixture, mounts: 0 });
		return api;
	},

	/**
	 * What to hand `api.slothlet.api.add()` to mount a folder or file of the fixture.
	 * @param {object} api - The api `compose` built.
	 * @param {{from: string, files?: string[]}} spec - The folder or file, relative to the fixture, and for a folder its
	 *   files relative to it. `from` equal to the instance's root mounts the root's own manifest.
	 * @returns {string} The add's path.
	 */
	mountTarget(api, { from, files = [] }) {
		const instance = INSTANCES.get(api);
		const isFile = /\.[^/]+$/.test(from);
		if (!isFile && served(instance.fixture, from ? from + "/" : "") === instance.base) return instance.base;
		const name = `mounted${++instance.mounts}`;
		const entries = isFile ? [[from.split("/").pop(), from]] : files.map((rel) => [rel, from + "/" + rel]);
		for (const [rel, real] of entries) {
			place(instance.manifest, name + "/" + rel);
			instance.urls.set(name + "/" + rel, served(instance.fixture, real));
		}
		return instance.base + name + (isFile ? "/" + entries[0][0] : "");
	},

	/**
	 * Import a fixture file as plain JavaScript imports it.
	 * @param {string} fixture - The fixture folder.
	 * @param {string} rel - The file, relative to it.
	 * @returns {Promise<object>} Its namespace.
	 */
	plain(fixture, rel) {
		return import(/* @vite-ignore */ served(fixture, rel) + "?plain-twin");
	}
};
