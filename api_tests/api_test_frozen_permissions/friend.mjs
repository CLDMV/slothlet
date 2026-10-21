/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/friend.mjs
 *	@Date: 2026-10-16T12:15:37-07:00 (1792178137)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T12:15:57-07:00 (1792178157)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#603): a module the rules allow, reflecting over members the host hands it.
 * @module api_test_frozen_permissions.friend
 */

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
 * Describe every own property of a member, as reflection over it would.
 * @param {object} node - The member.
 * @returns {{value?: unknown, error?: string}} The keys described, or the code it threw.
 */
export const describeAll = (node) => attempt(() => Reflect.ownKeys(Object.getOwnPropertyDescriptors(node)).map(String));
