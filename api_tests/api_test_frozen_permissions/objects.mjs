/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/objects.mjs
 *	@Date: 2026-10-13T03:50:21-07:00 (1791888621)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-13T04:45:51-07:00 (1791891951)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture: an array holding an object element, and an array whose prototype supplies a function.
 */

export const items = [{ secret: "OBJSECRET" }];

export const lst = [1];
Object.setPrototypeOf(lst, Object.assign(Object.create(Array.prototype), { reveal: () => "PROTOSECRET" }));

export const acc = [];
Object.defineProperty(acc, 0, { get: () => "GETSECRET", set: () => {}, enumerable: true, configurable: true });
