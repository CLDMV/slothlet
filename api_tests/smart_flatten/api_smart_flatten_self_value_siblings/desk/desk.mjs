/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_self_value_siblings/desk/desk.mjs
 *	@Date: 2026-10-11T21:00:00-07:00 (1791784800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T21:00:00-07:00 (1791784800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named file whose default is a class instance, beside a
 * sibling. The instance is recorded on `globalThis` so a test can check the build never wrote to it.
 * @module api_smart_flatten_self_value_siblings.desk.desk
 */

/** A counter whose method reads a private field and a public one. */
class Desk {
	#opened = 0;
	constructor() {
		this.count = 1;
	}
	/** @returns {number} The incremented public count. */
	inc() {
		return ++this.count;
	}
	/** @returns {number} The incremented private count. */
	open() {
		return ++this.#opened;
	}
}

const desk = new Desk();
(globalThis.__slothletSelfValueSiblings ??= {}).desk = desk;

export default desk;
