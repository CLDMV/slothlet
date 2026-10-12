/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_then_data/inherited.mjs
 *	@Date: 2026-10-11T12:53:56-07:00 (1791748436)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T17:01:33-07:00 (1791763293)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a default that inherits a `then` holding data.
 * @module api_test_then_data.inherited
 */

export default Object.create({ then: 1 }, { ping: { value: () => "pong", enumerable: true } });
