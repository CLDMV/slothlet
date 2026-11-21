/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/runner.mjs
 *	@Date: 2026-11-11T11:44:49-08:00 (1794426289)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:00-08:00 (1794431580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for what a file starts while it loads: a second module allowed the vault, which runs what it
 * is handed.
 * @module api_test_load_identity.runner
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run what it is handed.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 */
export const call = (fn) => fn();

/**
 * Map an array with what it is handed.
 * @param {Array<*>} list - The array.
 * @param {Function} fn - The function.
 * @returns {Array<*>} The results.
 */
export const map = (list, fn) => list.map(fn);

/**
 * Run a closure it asked `bag` for itself, handed nothing by its caller.
 * @returns {Promise<*>} What the closure returned.
 */
export const own = async () => (await self.bag.make())();

/**
 * Run a closure it asked `bag` for itself, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the closure returned.
 */
export const ownWith = async (callback) => (typeof callback === "function" ? (await self.bag.make())() : undefined);

/**
 * Run a closure it asked `bag` for itself, after an await, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the closure returned.
 */
export const ownWithLater = async (callback) => {
	if (typeof callback !== "function") return undefined;
	const fn = await self.bag.make();
	await null;
	return fn();
};

/**
 * Run an async closure it asked `bag` for itself, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the closure returned.
 */
export const ownWithAsync = async (callback) => (typeof callback === "function" ? (await self.bag.makeAsync())() : undefined);

/**
 * Map with a closure it asked `bag` for itself, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} The first result.
 */
export const ownWithMap = async (callback) => (typeof callback === "function" ? [1].map(await self.bag.make())[0] : undefined);

/**
 * Run the function a holder's `fn` member gives.
 * @param {{fn: Function}} holder - The holder.
 * @returns {*} What the function returned.
 */
export const callGot = (holder) => holder.fn();

/**
 * Run the function a holder's `fn` member settles to.
 * @param {{fn: Promise<Function>}} holder - The holder.
 * @returns {Promise<*>} What the function returned.
 */
export const callAwaited = async (holder) => (await holder.fn)();

/**
 * Run the function nested in data it is handed.
 * @param {{inner: {list: Array<Function>}}} data - The data.
 * @returns {*} What the function returned.
 */
export const callNested = (data) => data.inner.list[0]();

/** The function {@link keep} was handed last. */
let kept = null;

/**
 * Keep a function to run later.
 * @param {Function} fn - The function.
 * @returns {boolean} True.
 */
export const keep = (fn) => {
	kept = fn;
	return true;
};

/**
 * Run the function {@link keep} was handed, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {*} What the kept function returned.
 */
export const runKept = (callback) => (typeof callback === "function" ? kept() : undefined);

/** The closure {@link share} asked `bag` for last. */
let shared = null;

/**
 * Ask `bag` for a closure, keep it where {@link peek} hands it out, then run the function a holder's `fn` member
 * settles to.
 * @param {{fn: Promise<Function>}} holder - The holder.
 * @returns {Promise<*>} What the function returned.
 */
export const share = async (holder) => {
	shared = await self.bag.make();
	return (await holder.fn)();
};

/**
 * The closure {@link share} asked `bag` for last.
 * @returns {Function|null} The closure.
 */
export const peek = () => shared;

/**
 * Inside a call that was handed something, ask `bag` for an instance and run what `use` does with it.
 * @param {*} handed - What the call was handed.
 * @param {function(object, *): *} use - What to do with the instance and what was handed.
 * @returns {Promise<*>} What `use` returned.
 */
const withInstance = async (handed, use) => use(await self.bag.inst(), handed);

/**
 * Run a method of an instance it asked `bag` for, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the method returned.
 */
export const instRun = (callback) => withInstance(callback, (instance) => instance.run());

/**
 * Run a method of an instance it asked `bag` for after an await, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the method returned.
 */
export const instRunLater = (callback) =>
	withInstance(callback, async (instance) => {
		await null;
		return instance.run();
	});

/**
 * Run an async method of an instance it asked `bag` for, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the method returned.
 */
export const instLater = (callback) => withInstance(callback, (instance) => instance.later());

/**
 * Read a getter of an instance it asked `bag` for, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the getter returned.
 */
export const instGetter = (callback) => withInstance(callback, (instance) => instance.secret);

/**
 * Run the function it is handed with an instance it asked `bag` for as the receiver.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} What the function returned.
 */
export const instCall = (fn) => withInstance(fn, (instance, handed) => handed.call(instance));

/**
 * Bind the function it is handed to an instance it asked `bag` for and run it.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} What the function returned.
 */
export const instBind = (fn) => withInstance(fn, (instance, handed) => handed.bind(instance)());

/**
 * Run a method of an instance it asked `bag` for with the object it is handed as the receiver.
 * @param {object} receiver - The receiver.
 * @returns {Promise<*>} What the method returned.
 */
export const instForeign = (receiver) => withInstance(receiver, (instance, handed) => instance.run.call(handed));

/**
 * Run the class's own method, read through the class, on an instance it asked `bag` for.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the method returned.
 */
export const instProto = (callback) => withInstance(callback, async (instance) => (await self.bag.klass()).prototype.run.call(instance));

/**
 * Run a method of the instance it is handed.
 * @param {object} instance - The instance.
 * @returns {*} What the method returned.
 */
export const callRun = (instance) => instance.run();

/**
 * Read a getter of the instance it is handed.
 * @param {object} instance - The instance.
 * @returns {*} What the getter returned.
 */
export const readSecret = (instance) => instance.secret;

/** The instance {@link instShare} asked `bag` for last. */
let sharedInstance = null;

/**
 * Ask `bag` for an instance, keep it where {@link peekInstance} hands it out, then run the function a holder's `fn`
 * member settles to.
 * @param {{fn: Promise<Function>}} holder - The holder.
 * @returns {Promise<*>} What the function returned.
 */
export const instShare = async (holder) => {
	sharedInstance = await self.bag.inst();
	return (await holder.fn)();
};

/**
 * The instance {@link instShare} asked `bag` for last.
 * @returns {object|null} The instance.
 */
export const peekInstance = () => sharedInstance;
