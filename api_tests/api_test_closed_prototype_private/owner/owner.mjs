/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_closed_prototype_private/owner/owner.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T00:00:00-08:00 (1795334400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module with classes whose prototypes hold private members, closed three ways and left open. Runs the
 * probes on its own classes through `self`.
 * @module api_test_closed_prototype_private/owner
 */
import { self } from "@cldmv/slothlet/runtime";
import * as probes from "../../api_test_closed_prototype_private_lib/probes.mjs";

/** The members every class here holds. */
class Base {
	/** @returns {string} Marker. */
	hi() {
		return "hi";
	}

	/** @returns {string} The module's private marker. */
	_hidden() {
		return "secret";
	}

	/** @returns {string} The module's private marker, read through a getter. */
	get _acc() {
		return "acc";
	}
}

/**
 * A copy of {@link Base}'s members on a class of its own, so each prototype holds them itself.
 * @returns {Function} The class.
 */
function make() {
	const made = class {};
	Object.defineProperties(made.prototype, Object.getOwnPropertyDescriptors(Base.prototype));
	Object.defineProperty(made.prototype, "constructor", { value: made, writable: true, configurable: true });
	return made;
}

/** A class whose prototype is frozen. */
export const FrozenBox = make();
Object.freeze(FrozenBox.prototype);

/** A class whose prototype is sealed. */
export const SealedBox = make();
Object.seal(SealedBox.prototype);

/** A class whose prototype is closed to new members. */
export const ClosedBox = make();
Object.preventExtensions(ClosedBox.prototype);

/** A class whose prototype is left open. */
export const OpenBox = make();

/**
 * How a class's prototype lists, read through `self`.
 * @param {string} name - The class.
 * @returns {object} The answers.
 */
export function listing(name) {
	return probes.listing(self.owner, name);
}

/**
 * What the module reads of its own class's private members through `self`.
 * @param {string} name - The class.
 * @returns {object} The answers.
 */
export function privacy(name) {
	return probes.privacy(self.owner, name);
}
