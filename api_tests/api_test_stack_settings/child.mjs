/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stack_settings/child.mjs
 *	@Date: 2026-11-14T12:00:00-08:00 (1794686400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T12:00:00-08:00 (1794686400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs every route of `settler` with one change in place, in a process of its own, and prints the answers
 * as `RESULT <json>`; a change fixed in place is made once, before the routes: `node --conditions=slothlet-dev child.mjs <change> <mode> <runtime> <attribution> <capture>`.
 * @module api_test_stack_settings.child
 */
import { writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { ROUTES } from "./routes.mjs";

const [change, mode, runtime, attribution, capture] = process.argv.slice(2);
const api = await slothlet({
	base: fileURLToPath(new URL("./api", import.meta.url)),
	mode,
	runtime,
	silent: true,
	permissions: { defaultPolicy: "allow", attribution, references: { capture: capture === "true" }, rules: ROUTES.rules }
});
const answers = {};
// A change fixed in place is made once, by settler's own code, and stays for every route.
const fixed = change.startsWith("fixed");
if (fixed) {
	try {
		answers.keep = await api.settler.keep(change);
	} catch (error) {
		answers.keep = error?.code ?? String(error?.message ?? error);
	}
}
for (const [route, run] of Object.entries(ROUTES.runs)) {
	try {
		answers[route] = await run(api, fixed ? "none" : change);
	} catch (error) {
		answers[route] = error?.code ?? String(error?.message ?? error);
	}
}
// Written straight to the descriptor: with a change fixed in place, slothlet refuses to place the listener a stream
// would register.
writeSync(1, `RESULT ${JSON.stringify(answers)}\n`);
