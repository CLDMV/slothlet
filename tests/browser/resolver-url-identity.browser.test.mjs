/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/resolver-url-identity.browser.test.mjs
 *	@Date: 2026-10-11T10:30:00-07:00 (1791740400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T10:30:00-07:00 (1791740400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module imported from a URL that does not spell its manifest path is still told
 * apart from the host after an `await` (#601 review).
 *
 * @description
 * In the live runtime, a call suspended alone is resolved from the call stack, matching each frame's
 * location against the module's file. A resolver may hand the loader a `blob:` or `data:` URL, or an
 * `http(s):` URL on another path, none of which ends in the manifest path. Unless the URL the loader
 * actually imported is matched too, the module's own frames name nothing, and its code after an
 * `await` runs as the host: `self` refuses it, and any other api reference it holds passes every rule.
 */

import { describe, it, expect } from "vitest";

const ROGUE = `
import { self } from "@cldmv/slothlet/runtime";
export const callAfterAwait = async () => {
	await null;
	try {
		return "LEAK:" + (await self.math.add(1, 2));
	} catch (error) {
		return /PERMISSION_DENIED/.test(error.message) ? "denied" : "err:" + error.message;
	}
};
`;
const MATH = `export const add = (a, b) => a + b;`;

const MANIFEST = {
	files: [
		{ path: "math.mjs", name: "math", fullName: "math.mjs" },
		{ path: "rogue.mjs", name: "rogue", fullName: "rogue.mjs" }
	],
	directories: []
};

/**
 * Module URLs of each kind a resolver can hand back.
 * @type {Record<string, (source: string) => string>}
 */
const URL_KINDS = {
	blob: (source) => URL.createObjectURL(new Blob([source], { type: "text/javascript" })),
	data: (source) => "data:text/javascript;charset=utf-8," + encodeURIComponent(source)
};

describe("a module imported from a URL other than its manifest path (browser, live runtime)", () => {
	it.each(Object.keys(URL_KINDS))("is not taken for the host after an await (%s: URL)", async (kind) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const urls = { "math.mjs": URL_KINDS[kind](MATH), "rogue.mjs": URL_KINDS[kind](ROGUE) };
		const api = await slothlet({
			platform: "browser",
			base: new URL("/resolver-url-identity/", location.origin).href,
			manifest: MANIFEST,
			resolveModuleSpecifier: ({ path }) => urls[path],
			mode: "eager",
			runtime: "live",
			permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "rogue.**", effect: "allow" }] }
		});
		try {
			expect(await api.rogue.callAfterAwait()).toBe("denied");
		} finally {
			await api.shutdown();
			if (kind === "blob") for (const url of Object.values(urls)) URL.revokeObjectURL(url);
		}
	});
});
