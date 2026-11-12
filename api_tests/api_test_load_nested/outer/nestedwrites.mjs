/**
 * @fileoverview A file that, while it loads, builds an inner instance on each runtime and has its functions change
 * their own `self`.
 * @module api_test_load_nested.outer.nestedwrites
 * @memberof module:api_test_load_nested
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";

/**
 * What this file's own top-level read of `self` answers.
 * @returns {string} The type read, or the code of the refusal.
 */
function ownRead() {
	try {
		return typeof self.nested;
	} catch (error) {
		return error.code ?? String(error);
	}
}

const INNER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "inner");
const CHANGES = ["writeSync", "writeAfterAwait", "readAfterAwait", "removeAfterAwait", "defineAfterAwait"];

const collected = { own: { alone: ownRead() } };
for (const runtime of ["async", "live"]) {
	const inner = await slothlet({ base: INNER, runtime, silent: true });
	collected[runtime] = {};
	for (const change of CHANGES) collected[runtime][change] = await inner.writer[change]();
	// While a call of the inner instance waits, this file's own code is still this file's.
	const waiting = inner.writer.writeAfterAwait();
	collected.own[runtime] = ownRead();
	await waiting;
	await inner.slothlet.shutdown();
}

/**
 * What each change answered in an inner instance built while this file loaded, by the inner instance's runtime.
 * @function outcomes
 * @memberof module:api_test_load_nested.outer.nestedwrites
 * @returns {{own: object, async: object, live: object}} The answers.
 * @example
 * api.nestedwrites.outcomes(); // { async: { writeSync: "ok", … }, live: { writeSync: "ok", … } }
 */
export const outcomes = () => collected;
