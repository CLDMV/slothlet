/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/rogue.mjs
 *	@Date: 2026-10-12T20:59:52-07:00 (1791863992)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T23:13:28-07:00 (1791872008)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#609): a module the rules deny `secrets.**`, reading it every way a frozen node could expose it.
 * @module api_test_frozen_permissions.rogue
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a read, reporting what it gave or the code it threw.
 * @param {Function} read - The read.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
const attempt = (read) => {
	try {
		return { value: read() };
	} catch (error) {
		return { error: error.code ?? error.name };
	}
};

/**
 * Read a property's value through its descriptor, as reflection would.
 * @param {object} object - The object.
 * @param {string} key - The property.
 * @returns {unknown} The value the descriptor gives.
 */
const throughDescriptor = (object, key) => {
	const descriptor = Object.getOwnPropertyDescriptor(object, key);
	if (!descriptor) return undefined;
	return "value" in descriptor ? descriptor.value : descriptor.get?.call(object);
};

/**
 * Every way to read the `secrets` namespace's `key`.
 * @returns {object} The outcome of each read.
 */
export const readSecrets = () => ({
	direct: attempt(() => self.secrets.key),
	descriptor: attempt(() => throughDescriptor(self.secrets, "key")),
	json: attempt(() => JSON.stringify(self.secrets))
});

/**
 * Every way to read an element of an array member handed over by the host.
 * @param {string[]} list - The `secrets.list` member.
 * @returns {object} The outcome of each read.
 */
export const readList = (list) => ({
	direct: attempt(() => list[0]),
	descriptor: attempt(() => throughDescriptor(list, "0")),
	json: attempt(() => JSON.stringify(list))
});

/**
 * Every way to reach an array member's elements through the functions the array holds.
 * @param {string[]} labels - The `secrets.labels` member.
 * @returns {object} The outcome of each call.
 */
export const callLabels = (labels) => ({
	json: attempt(() => JSON.stringify(labels)),
	reveal: attempt(() => labels.reveal()),
	symbol: attempt(() => labels[Symbol.for("slothlet.test.peek")]())
});

/**
 * Serialize the `secrets` namespace.
 * @returns {{value?: unknown, error?: string}} The outcome.
 */
export const serializeSecrets = () => attempt(() => JSON.stringify(self.secrets));

/**
 * Serialize the `secrets.pair` member.
 * @returns {object} What the caller gets.
 */
export const serializePair = () => JSON.parse(JSON.stringify(self.secrets.pair));

export const callAliased = (aliased) => ({
	denied: attempt(() => aliased.denied()),
	allowed: attempt(() => aliased.allowed())
});

export const callNested = (inner) => attempt(() => inner.fn());

export const serializeSparse = () => attempt(() => JSON.stringify(self.sparse));
