/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/lib/promise-probe.mjs
 *	@Date: 2026-11-11T11:09:11-08:00 (1794424151)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:13-08:00 (1795536313)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs one case of a module doing something with a promise another module holds in data, in a process of
 * its own, and prints which rejections the process reported as unhandled.
 *
 * Usage: node --conditions=slothlet-dev promise-probe.mjs <plain|precise|fast> <async|live> <case>
 * @module api_test_crossing_rules/promise-probe
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [kind, runtime, name] = process.argv.slice(2);

/** The message of each rejection the process reported as unhandled. */
const reported = [];
process.on("unhandledRejection", (reason) => reported.push(String(reason?.message ?? reason)));

let pledge;
let taker;
let shape;
if (kind === "plain") {
	pledge = await import("../../api_test_crossing_rules_pledge/api/pledge.mjs");
	taker = await import("../../api_test_crossing_rules_taker/api/taker.mjs");
	shape = taker.take(name, pledge);
} else {
	const { default: slothlet } = await import("@cldmv/slothlet");
	const api = await slothlet({
		base: path.join(here, "..", "api"),
		runtime,
		silent: true,
		permissions: { policy: "allow", caller: { attribution: kind } }
	});
	await api.slothlet.api.add("pledge", path.join(here, "..", "..", "api_test_crossing_rules_pledge", "api"), { id: "pledge" });
	await api.slothlet.api.add("taker", path.join(here, "..", "..", "api_test_crossing_rules_taker", "api"), { id: "taker" });
	pledge = api.pledge;
	taker = api.taker;
	shape = await taker.take(name);
}
await pledge.settle();
// Unhandled rejections are reported once the microtask queue has drained.
await new Promise((resolve) => setTimeout(resolve, 25));
const outcome = await taker.outcome();
await new Promise((resolve) => setTimeout(resolve, 25));
console.log(JSON.stringify({ shape, outcome, reported }));
process.exit(0);
