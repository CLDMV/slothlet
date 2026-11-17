/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_serialize_tojson/owner/owner.mjs
 *	@Date: 2026-11-15T23:45:00-08:00 (1794815100)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:26:40-08:00 (1794882400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Data whose serialization the module's own `toJSON` gives: on a class's prototype, reading a private
 * field, as an own member closing over other data, nested in a plain object and as an array element.
 * @module api_test_serialize_tojson/owner
 */

/** A class whose instances serialize as their own members. */
class Settings {
	/**
	 * The instance's own members.
	 * @returns {object} A copy of them.
	 */
	toJSON() {
		return { ...this };
	}
}

/** A class whose instances serialize a private field and nested data. */
class Sealed {
	#hidden = "H";
	pub = 1;
	/**
	 * The public member, the private one under `hidden`, and nested data.
	 * @returns {object} The serialized form.
	 */
	toJSON() {
		return { pub: this.pub, hidden: this.#hidden, deep: { hidden: "H", ok: 2 }, list: [{ hidden: "H", ok: 3 }] };
	}
}

const held = { pub: 1, hidden: "H" };

export const cfg = Object.assign(new Settings(), { pub: 1, hidden: "H" });
export const sealed = new Sealed();
export const own = { pub: 1, toJSON: () => held };
export const holder = { pub: 1, inner: new Sealed() };
export const list = [Object.assign(new Settings(), { pub: 1, hidden: "H" })];
