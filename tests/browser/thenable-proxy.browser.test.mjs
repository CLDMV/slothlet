/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/thenable-proxy.browser.test.mjs
 *	@Date: 2026-10-10T09:31:46-07:00 (1791649906)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-10T09:31:46-07:00 (1791649906)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module value that is a Proxy answering `then` only from its `get` trap (#580 review).
 * The browser has no Proxy brand check, so the lazy materializer's `then` guard must not depend on one:
 * the folder is refused with MODULE_RESERVED_EXPORT instead of its load and shutdown hanging on that `then`.
 */

import { describe, it, expect } from "vitest";

/**
 * Serve inline module source as a blob URL.
 * @param {string} source - Module source.
 * @returns {string} Blob URL.
 */
const moduleUrl = (source) => URL.createObjectURL(new Blob([source], { type: "text/javascript" }));

const MODULES = {
	"ok.mjs": `export const ping = () => "pong";`,
	"session/session.mjs": `export default new Proxy({}, { get: (_target, key) => (key === "then" ? () => {} : key === "get" ? () => "session.get" : undefined) });`
};

const MANIFEST = {
	files: [{ path: "ok.mjs", name: "ok", fullName: "ok.mjs" }],
	directories: [
		{
			name: "session",
			path: "session",
			children: { files: [{ path: "session/session.mjs", name: "session", fullName: "session.mjs" }], directories: [] }
		}
	]
};

/**
 * Settle `promise`, or report a hang after `ms`.
 * @param {Promise<unknown>} promise - Promise under test.
 * @param {number} ms - Bound.
 * @returns {Promise<unknown>} The promise's outcome, or a rejection naming the hang.
 */
const bounded = (promise, ms) => {
	let timer;
	return Promise.race([promise, new Promise((_, reject) => (timer = setTimeout(() => reject(new Error("HUNG")), ms)))]).finally(() =>
		clearTimeout(timer)
	);
};

describe("a Proxy module value with a `then` from its get trap (browser)", () => {
	it.each(["lazy", "eager"])("is refused in %s mode instead of hanging the load", async (mode) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const urls = Object.fromEntries(Object.entries(MODULES).map(([path, source]) => [path, moduleUrl(source)]));
		const BASE = new URL("/thenable-proxy/", location.origin).href;
		let api;
		const compose = async () => {
			api = await slothlet({
				platform: "browser",
				base: BASE,
				manifest: MANIFEST,
				resolveModuleSpecifier: ({ path }) => urls[path],
				mode
			});
			await api.session;
		};
		await expect(bounded(compose(), 5000)).rejects.toMatchObject({ code: "MODULE_RESERVED_EXPORT" });
		if (api) await bounded(api.shutdown(), 5000);
		for (const url of Object.values(urls)) URL.revokeObjectURL(url);
	});
});
