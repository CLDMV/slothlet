/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_instances/things.mjs
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
 * @fileoverview Returns instances of the language's and Node's own classes, and of a class of its own with a private
 * field.
 * @module api_test_returned_instances/things
 */

/** An account whose balance is a private field. */
class Account {
	#balance = 5;
	get balance() {
		return this.#balance;
	}
	deposit(amount) {
		this.#balance += amount;
		return this;
	}
	static is(value) {
		return #balance in value;
	}
}

/** One account this module holds. */
const held = new Account();

export const url = () => new URL("http://x/y?a=1");
export const response = () => new Response("hi");
export const abort = () => new AbortController();
export const format = () => new Intl.NumberFormat("en");
export const encoder = () => new TextEncoder();
export const account = () => new Account();
export const same = () => held;
export const isHeld = (value) => value === held;
export const isAccount = (value) => Account.is(value);
