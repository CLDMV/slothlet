/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_instances/maker.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:27:11-08:00 (1794374831)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hands out code that reads the runtime `context` and `self`: a closure, functions in data, a thenable, a
 * generator, and class instances.
 * @module api_test_returned_instances/maker
 */

import { self, context } from "@cldmv/slothlet/runtime";

/** A service whose methods read the runtime. */
class Service {
	user() {
		return context.user;
	}
	ping() {
		return self.other.ping();
	}
}

export const closure = () => () => context.user;
export const box = () => ({ user: () => context.user });
export const thenable = () => ({
	then(resolve) {
		resolve(context.user);
	}
});
export function* generator() {
	yield context.user;
}
export const boxedService = () => ({ service: new Service() });
export const service = () => new Service();
