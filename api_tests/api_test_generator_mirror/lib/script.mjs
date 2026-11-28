/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_generator_mirror/lib/script.mjs
 *	@Date: 2026-11-25T07:54:04-08:00 (1795622044)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:08-08:00 (1795868888)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A script of reads, writes and steps on a module's generator objects. The test runs it on the module
 * imported as a plain module and on the module through slothlet, as the host and as another module, and compares.
 * @module api_test_generator_mirror/lib/script
 */

import { attempt, inside } from "./act.mjs";

/**
 * Step a generator object with a command, answering the step's value.
 * @param {Generator|AsyncGenerator} it - The generator object.
 * @param {string} [command] - The command.
 * @returns {Promise<*>} The value of the step.
 */
const step = async (it, command) => (await it.next(command)).value;

/**
 * Run the script.
 * @param {object} gen - The generator module: `make`, `keep`, `change`, `alter`, `isKept`.
 * @param {boolean} isAsync - Whether to take async generators.
 * @returns {Promise<Array<*>>} What each line answered.
 */
export async function script(gen, isAsync) {
	const log = [];
	const it = await gen.make(isAsync);
	// Each member as the generator object holds it, open to change.
	log.push(inside(it));
	// Writes in strict code, as an object holding the members as data answers them.
	log.push(attempt(() => (it.fixed = "other")));
	log.push(attempt(() => (it.label = "written")));
	log.push(attempt(() => (it.view = "through")));
	log.push(attempt(() => (it.extra = 1)));
	log.push(attempt(() => delete it.hidden));
	log.push(attempt(() => (Object.defineProperty(it, "defined", { value: 2, enumerable: true }), true)));
	log.push(inside(it));
	// The generator's own code sees what was written, and what it changes is seen after.
	log.push(await step(it));
	for (const command of ["add", "relabel", "reorder", "redefine", "seal"]) {
		log.push(await step(it, command));
		log.push(inside(it));
	}
	// Closed after it was handed out: writes as a sealed object answers them.
	log.push(attempt(() => (it.label = "sealed-write")));
	log.push(attempt(() => (it.more = 1)));
	log.push(attempt(() => delete it.label));
	log.push(await step(it, "freeze"));
	log.push(inside(it));
	log.push(attempt(() => (it.label = "frozen-write")));
	// A generator object the module keeps and changes in calls that do not hand it in.
	const kept = await gen.keep(isAsync);
	log.push(inside(kept));
	for (const command of ["add", "drop", "reorder"]) {
		log.push(await gen.change(command));
		log.push(inside(kept));
	}
	log.push(attempt(() => (kept.label = "host")));
	log.push(attempt(() => (kept.mine = "host")));
	log.push(await gen.change("prevent"));
	log.push(inside(kept));
	log.push(attempt(() => (kept.after = 1)));
	// Handed out again, it is the same object, as it now is.
	const again = await gen.keep(isAsync);
	log.push(again === kept);
	log.push(await gen.isKept(kept));
	log.push(inside(again));
	// A generator object handed back to the module and changed there.
	const other = await gen.make(isAsync);
	other.extra = "given";
	for (const command of ["add", "redefine", "seal"]) {
		log.push(await gen.alter(other, command));
		log.push(inside(other));
	}
	log.push(attempt(() => (other.label = "after-seal")));
	log.push(await step(other));
	log.push(inside(other));
	return log;
}
