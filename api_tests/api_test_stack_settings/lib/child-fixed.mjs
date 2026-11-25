/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stack_settings/lib/child-fixed.mjs
 *	@Date: 2026-11-15T23:41:50-08:00 (1794814910)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:06:42-08:00 (1795536402)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `settler` fixes one stack setting in place (for `ownRealm`, the host does the same to the realm slothlet
 * reads stacks from, which it reaches through the call sites slothlet's exported reader hands it: module code may not
 * import that reader), then the other modules and the host go about their work:
 * `good` calls the node only it may call, `settler` reads the vault it is denied, and the host registers listeners and
 * writes to a stream. Prints the answers as `RESULT <json>`:
 * `node --conditions=slothlet-dev child-fixed.mjs <change> <mode> <runtime> <attribution> <capture>`.
 * @module api_test_stack_settings.lib.child-fixed
 */
import { EventEmitter } from "node:events";
import { writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { readStack, stackSites } from "#helpers/stack-read";
import { ROUTES } from "./routes.mjs";

const [change, mode, runtime, attribution, capture] = process.argv.slice(2);
const api = await slothlet({
	base: fileURLToPath(new URL("../api", import.meta.url)),
	mode,
	runtime,
	silent: true,
	permissions: { policy: "allow", caller: { attribution, capture: capture === "true" }, rules: ROUTES.rules }
});
const answers = {};

/**
 * Record what a step answers, a refusal by its code.
 * @param {string} name - The step.
 * @param {function(): unknown} step - The step.
 * @returns {Promise<void>}
 */
async function record(name, step) {
	try {
		answers[name] = await step();
	} catch (error) {
		answers[name] = error?.code ?? String(error?.message ?? error);
	}
}

/**
 * Fix the frame budget of the realm slothlet reads stacks from at 0, and try a stand-in for its `Error` and its
 * formatter.
 * @returns {void}
 */
function fixOwnRealm() {
	const site = readStack(stackSites)?.value?.[0];
	const realm = Object.getPrototypeOf(site).constructor.constructor("return globalThis")();
	const stand = function Error() {};
	stand.prepareStackTrace = () => "Error\n    at readOnly (good.mjs:3:14)";
	for (const attempt of [
		() => Object.defineProperty(realm, "Error", { configurable: false, writable: false, value: stand }),
		() => Object.defineProperty(realm.Error, "prepareStackTrace", { configurable: false, writable: false, value: () => "" }),
		() => Object.defineProperty(realm.Function.prototype, "prepareStackTrace", { configurable: false, get: () => () => "" })
	]) {
		try {
			attempt();
		} catch {
			// Fixed by slothlet: the next one is tried.
		}
	}
	Object.defineProperty(realm.Error, "stackTraceLimit", { configurable: false, writable: false, value: 0 });
}

await record("keep", () => (change === "ownRealm" ? fixOwnRealm() : api.settler.keep(change)));
await record("good", () => api.good.readOnly());
await record("goodLater", async () => {
	await null;
	return api.good.readOnly();
});
await record("settler", () => api.settler.own("none"));
await record("handedToGood", async () => api.good.runIt(await api.settler.give("none")));
await record("hostListener", () => {
	const emitter = new EventEmitter();
	let heard = null;
	emitter.on("note", (value) => (heard = value));
	emitter.emit("note", "heard");
	return heard;
});
await record(
	"hostStream",
	() => new Promise((resolve, reject) => process.stdout.write("", (error) => (error ? reject(error) : resolve("written"))))
);
await record("hostTimer", () => new Promise((resolve) => setTimeout(() => resolve("ran"), 1)));
writeSync(1, `RESULT ${JSON.stringify(answers)}\n`);
