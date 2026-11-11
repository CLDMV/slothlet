/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_nested/outer/nested.mjs
 *	@Date: 2026-11-11T14:13:00-08:00 (1794435180)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T14:24:43-08:00 (1794435883)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file whose top level builds another slothlet instance and runs a function that instance handed out,
 * from a timer it starts while it loads.
 * @module api_test_load_nested/outer/nested
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const inner = await slothlet({
	base: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "inner"),
	runtime: "async",
	silent: true
});
const handed = await inner.maker.closure();

/** What the inner instance's function answered when a timer of this file's load ran it. */
export const answered = await new Promise((resolve) => {
	setTimeout(() => {
		try {
			resolve(handed());
		} catch (error) {
			resolve(error.code ?? String(error));
		}
	}, 1);
});

await inner.slothlet.shutdown();

export const loaded = () => true;
