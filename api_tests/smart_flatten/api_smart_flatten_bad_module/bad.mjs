/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_bad_module/bad.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 00:00:00 -08:00 (1772467200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Momentum Inc. All rights reserved.
 */

/**
 * @fileoverview Intentionally throws on import to test MODULE_LOAD_FAILED error path (line 186 modes-processor.mjs).
 */

// Deliberately throw during module evaluation so loadModule() throws → SlothletError MODULE_LOAD_FAILED
throw new Error("Intentional bad module: testing MODULE_LOAD_FAILED error path");
