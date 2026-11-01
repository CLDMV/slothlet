/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/callee/ops.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The callee for the fifth round of caller-supplied-code tests (#597): it may call the vault's secret,
 * runs the code nested in what the supplier's functions return, and hands out code of its own.
 *
 * @module api_tests/api_test_caller_supplied_round5/callee/ops
 */

import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { self } from "@cldmv/slothlet/runtime";

/**
 * The callee's TypeScript CommonJS helper, loaded on first use: only an engine that strips types can load it.
 * @returns {{apply: function(Function): *}} The helper.
 * @private
 */
const typed = () => createRequire(import.meta.url)("./__lib/helper.cts");

/**
 * The secret, called as the callee.
 * @returns {string} The secret.
 * @public
 * @example
 * api.callee.ops.secretDirect(); // "s3cret"
 */
export function secretDirect() {
	return self.vault.secret.secret();
}

/**
 * The secret, called from a closure the callee's TypeScript CommonJS helper runs; handed an object, so the call is
 * checked for supplied code.
 * @param {object} _ - Anything.
 * @returns {string} The secret.
 * @public
 * @example
 * api.callee.ops.ownViaTypeScript({}); // "s3cret"
 */
export function ownViaTypeScript(_) {
	return typed().apply(() => self.vault.secret.secret());
}

/**
 * Nothing; a target to hook.
 * @returns {string} "pong".
 * @public
 * @example
 * api.callee.ops.ping(); // "pong"
 */
export function ping() {
	return "pong";
}

/**
 * A closure calling the secret: the callee hands out what it may do.
 * @returns {Function} The closure.
 * @public
 * @example
 * api.callee.ops.makeClient()(); // "s3cret"
 */
export function makeClient() {
	return () => self.vault.secret.secret();
}

/**
 * An object whose method calls the secret.
 * @returns {object} The object.
 * @public
 * @example
 * api.callee.ops.makeObject().fn(); // "s3cret"
 */
export function makeObject() {
	return { fn: () => self.vault.secret.secret() };
}

/**
 * A class instance whose method and getter call the secret, through a private field.
 * @returns {object} The instance.
 * @public
 * @example
 * api.callee.ops.makeInstance().secret(); // "s3cret"
 */
export function makeInstance() {
	class Client {
		#vault = () => self.vault.secret.secret();

		secret() {
			return this.#vault();
		}

		get g() {
			return this.#vault();
		}
	}
	return new Client();
}

/**
 * A generator yielding the secret.
 * @returns {Generator<string>} The generator.
 * @public
 * @example
 * [...api.callee.ops.makeGen()]; // ["s3cret"]
 */
export function* makeGen() {
	yield self.vault.secret.secret();
}

/**
 * Construct the supplier's exported class through `self`.
 * @returns {string} What its constructor got.
 * @public
 * @example
 * api.callee.ops.constructNamed(); // "PERMISSION_DENIED"
 */
export function constructNamed() {
	return new self.supplier.ctor.Named().v;
}

/**
 * Construct the supplier's exported constructor function through `self`.
 * @returns {string} What its body got.
 * @public
 * @example
 * api.callee.ops.constructFn(); // "PERMISSION_DENIED"
 */
export function constructFn() {
	return new self.supplier.ctor.Fn().v;
}

/**
 * Read a member of the supplier's exported Proxy through `self`.
 * @returns {*} The member.
 * @public
 * @example
 * api.callee.ops.readTrap(); // 1
 */
export function readTrap() {
	return self.supplier.trap.p.x;
}

/**
 * Run the supplier's code nested in one of its shapes, read through `self`.
 * @param {string} name - The shape.
 * @returns {Promise<*>} What the supplier's code returned.
 * @public
 * @example
 * await api.callee.ops.viaSelf("objFn"); // "PERMISSION_DENIED"
 */
export async function viaSelf(name) {
	const shape = () => self.supplier.bag.shape(name);
	switch (name) {
		case "objFn":
			return shape().fn();
		case "arrFn":
			return shape()[0]();
		case "getter":
			return shape().value;
		case "thenable":
			return await shape();
		case "iterable":
			return [...shape()][0];
		case "asyncIterable":
			for await (const value of shape()) return value;
			return undefined;
		case "protoIter":
		case "frozenIter":
		case "sealedIter":
			return shape().next().value;
		case "frozenGen":
			return [...shape()][0];
		case "ownProp":
			return shape().helper();
		case "staticM":
			return self.supplier.bag.shape("klass").stat();
		case "protoCall":
			return self.supplier.bag.shape("klass").prototype.m.call({});
		case "newInstanceGetter":
			return new (self.supplier.bag.shape("klass"))(1).g;
		case "newInstanceMethod":
			return new (self.supplier.bag.shape("klass"))(1).m();
		case "instanceGetter":
			return self.supplier.bag.shape("instance").g;
		case "instanceMethod":
			return self.supplier.bag.shape("instance").m();
		case "boundPush":
		case "boundNameless":
			return shape()();
		default:
			throw new Error(`unknown shape ${name}`);
	}
}

/**
 * Hand a closure of the callee's through the supplier's `echo` and call what comes back.
 * @returns {string} What the closure got.
 * @public
 * @example
 * api.callee.ops.passThrough(); // "s3cret"
 */
export function passThrough() {
	const own = () => self.vault.secret.secret();
	return self.supplier.bag.echo(own)();
}

/**
 * Add a module at runtime.
 * @param {string} dir - The module's folder.
 * @returns {Promise<void>} Settles once it is added.
 * @public
 * @example
 * await api.callee.ops.addPlug(dir);
 */
export async function addPlug(dir) {
	await self.slothlet.api.add("plug", dir, { moduleID: "plug-mod" });
}

/**
 * Reload the module this module added.
 * @returns {Promise<void>} Settles once it is reloaded.
 * @public
 * @example
 * await api.callee.ops.reloadPlug();
 */
export async function reloadPlug() {
	await self.slothlet.api.reload("plug-mod");
}

/**
 * Schedule a timer whose async callback rejects, with the rejection left unhandled.
 * @param {string} tag - The rejection's message.
 * @returns {void}
 * @public
 * @example
 * api.callee.ops.timerRejects("lost");
 */
export function timerRejects(tag) {
	setTimeout(async () => {
		throw new Error(tag);
	}, 0);
}

/**
 * Schedule a timer whose callback returns a rejected promise its own code handles.
 * @param {string} tag - The rejection's message.
 * @returns {void}
 * @public
 * @example
 * api.callee.ops.timerHandles("caught");
 */
export function timerHandles(tag) {
	setTimeout(() => {
		const rejected = Promise.reject(new Error(tag));
		rejected.catch(() => {});
		return rejected;
	}, 0);
}

/**
 * Emit to an async listener that rejects, with the rejection left unhandled.
 * @param {string} tag - The rejection's message.
 * @returns {void}
 * @public
 * @example
 * api.callee.ops.listenerRejects("lost");
 */
export function listenerRejects(tag) {
	const emitter = new EventEmitter();
	emitter.on("go", async () => {
		throw new Error(tag);
	});
	setTimeout(() => emitter.emit("go"), 0);
}

/**
 * Emit to a listener that returns a rejected promise its own code handles.
 * @param {string} tag - The rejection's message.
 * @returns {void}
 * @public
 * @example
 * api.callee.ops.listenerHandles("caught");
 */
export function listenerHandles(tag) {
	const emitter = new EventEmitter();
	emitter.on("go", () => {
		const rejected = Promise.reject(new Error(tag));
		rejected.catch(() => {});
		return rejected;
	});
	setTimeout(() => emitter.emit("go"), 0);
}

/**
 * Call a function with no arguments.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.callee.ops.call(() => 1); // 1
 */
export function call(fn) {
	return fn();
}
