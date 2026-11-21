/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members_proto/victim/victim.mjs
 *	@Date: 2026-11-04T22:51:02-08:00 (1793861462)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:52:46-08:00 (1793861566)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Owner module of the prototype fixture (#630): a class instance and a class hierarchy whose
 * prototypes are the module's own code.
 * @module api_test_inherited_members_proto/victim/victim
 */

class Foo {
	/** @returns {string} Marker. */
	secret() {
		return "secret";
	}
}

/** A base class. */
export class Base {
	/** @returns {string} Marker. */
	static kind() {
		return "base";
	}
}

/** A class extending another one of the module's. */
export class Derived extends Base {}

/** An instance of a class of the module's. */
export const inst = new Foo();

/**
 * Report the module's real prototypes, so a test can tell whether anything changed them.
 * @returns {{fooMembers: string[], baseMembers: string[], secret: string}} Own member names and the method's answer.
 */
export function check() {
	return {
		fooMembers: Object.getOwnPropertyNames(Foo.prototype).sort(),
		baseMembers: Object.getOwnPropertyNames(Base).sort(),
		secret: Foo.prototype.secret()
	};
}
