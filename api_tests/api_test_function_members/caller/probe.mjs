/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/caller/probe.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T00:00:00-08:00 (1793692800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — another module reaching the callee's code through members of its api functions: each shape
 * is one way to read a member and run it.
 *
 * @module api_tests/api_test_function_members/caller/probe
 */

import { EventEmitter } from "node:events";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Each shape of reaching a member of the callee's function nodes and running it.
 * @type {Record<string, function(): *>}
 */
const SHAPES = {
	node: () => self.callee.ops.fn(),
	staticMethod: () => self.callee.ops.Client.open(),
	bracket: () => self.callee.ops.Client["open"](),
	reflectGet: () => Reflect.get(self.callee.ops.Client, "open")(),
	call: () => self.callee.ops.Client.open.call(null),
	apply: () => self.callee.ops.Client.open.apply(null, []),
	staticGetter: () => self.callee.ops.Client.helper(),
	staticToString: () => self.callee.ops.Client.toString(),
	staticToJSON: () => JSON.stringify(self.callee.ops.Client),
	prototypeMethod: () => self.callee.ops.Client.prototype.method.call({}),
	prototypeConstructor: () => self.callee.ops.fn.prototype.constructor(),
	classPrototypeConstructor: () => new self.callee.ops.Client.prototype.constructor().method(),
	hiddenMember: () => self.callee.ops.fn.hidden(),
	nestedMember: () => self.callee.ops.fn.hiddenNs.deep(),
	descriptor: () => Object.getOwnPropertyDescriptor(self.callee.ops.Client, "open")?.value(),
	descriptors: () => Object.getOwnPropertyDescriptors(self.callee.ops.fn).prototype?.value.constructor(),
	accessorDescriptor: () => Object.getOwnPropertyDescriptor(self.callee.ops.Client, "helper")?.get()(),
	inheritedDescriptor: () => Object.getOwnPropertyDescriptor(self.callee.ops.fn, "call"),
	customInstanceOf: () => ({ checked: true }) instanceof self.callee.ops.Checker,
	objectNodeInstanceOf: () => ({}) instanceof self.callee.bus,
	emitterPrototype: () => Object.getPrototypeOf(self.callee.bus).constructor.name,
	emitterInstanceOf: () => self.callee.bus instanceof EventEmitter,
	emitterConstructor: () => new self.callee.bus.constructor().kind(),
	awaitedNode: async () => (await self.callee.ops.fn)(),
	awaitedMember: async () => (await self.callee.ops.Client.open)(),
	awaitedNested: async () => (await self.callee.ops.Client.prototype.method).call({}),
	awaitedMissing: async () => String(await self.callee.ops.fn.hiddenNs.missing?.deeper),
	dataMember: () => self.callee.ops.fn.label,
	name: () => self.callee.ops.Client.name,
	instanceOf: () => ({}) instanceof self.callee.ops.Client,
	keys: () => Object.keys(self.callee.ops.fn).join(",")
};

/**
 * Run one shape and report what it did.
 * @param {string} shape - The shape's name.
 * @returns {Promise<{value?: *, error?: string}>} The value it returned, or the code of the error it threw.
 * @public
 * @example
 * await attempt("staticMethod"); // { error: "PERMISSION_DENIED" } when the callee is closed to this module
 */
export async function attempt(shape) {
	try {
		return { value: await SHAPES[shape]() };
	} catch (error) {
		return { error: error?.code ?? error?.message };
	}
}
