/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/conn.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:43-07:00 (1791090883)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview restart() fixture (#504): the module's top level creates the emitter, so every fresh
 * import yields a new one stamped with the import generation.
 * @module api_test_restart.conn
 */
import { EventEmitter } from "node:events";

const state = (globalThis.__slothletRestartFixture ??= { imports: 0, shutdowns: [] });

const conn = new EventEmitter();
conn.generation = ++state.imports;

export default conn;
