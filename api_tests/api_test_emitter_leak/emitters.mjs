/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_emitter_leak/emitters.mjs
 *	@Date: 2026-10-18T10:08:12-07:00 (1792343292)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T10:33:20-07:00 (1792344800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Emitters created and listened to from inside a module (#611).
 *
 * @description
 * Each emitter gets one listener through every registration method, from inside the api, and is then
 * dropped. A `FinalizationRegistry` counts the ones collected, so the test can ask how many are still
 * alive without holding them: a `WeakRef` would do, but every `deref()` keeps its target alive until
 * the current job ends.
 */

import { EventEmitter } from "node:events";

/**
 * How many emitters `create` made, and how many of them have been collected.
 * @type {{created: number, collected: number}}
 */
const counts = { created: 0, collected: 0 };

/**
 * Counts each collected emitter.
 * @type {FinalizationRegistry<undefined>}
 */
const finalizer = new FinalizationRegistry(() => {
	counts.collected++;
});

/**
 * Create `count` emitters, register a listener on each through `on`, `once`, `prependListener` and
 * `prependOnceListener`, and drop them.
 * @param {number} count - How many emitters to create.
 * @returns {number} The count created.
 */
export function create(count) {
	for (let index = 0; index < count; index++) {
		const emitter = new EventEmitter();
		emitter.on("data", () => index);
		emitter.once("end", () => index);
		emitter.prependListener("error", () => index);
		emitter.prependOnceListener("close", () => index);
		finalizer.register(emitter, undefined);
		counts.created++;
	}
	return count;
}

/**
 * How many of the emitters `create` made are still alive.
 * @returns {number} Live emitters.
 */
export function alive() {
	return counts.created - counts.collected;
}

/**
 * Register a listener from inside the api on an emitter the caller owns, through `on` and `once`. The
 * listeners are left on the emitter as `leafOn` / `leafOnce`, so the caller can find them again.
 * @param {EventEmitter} emitter - An emitter the caller created.
 * @returns {boolean} True once the listeners are attached.
 */
export function listen(emitter) {
	const leafOn = () => "on";
	const leafOnce = () => "once";
	emitter.on("tick", leafOn);
	emitter.once("tick", leafOnce);
	emitter.leafOn = leafOn;
	emitter.leafOnce = leafOnce;
	return true;
}
