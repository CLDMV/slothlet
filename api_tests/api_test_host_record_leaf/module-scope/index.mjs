/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /index.mjs
 *	@Date: 2026-11-08T14:31:32-08:00 (1794177092)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T14:42:09-08:00 (1794177729)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper of the `ext.b` module in a package scope of its own (#717): it reaches `outside/hash.mjs`
 * through its `package.json` `"imports"` (`#outside`), which slothlet does not load under the instance's tag.
 * @module api_tests/api_test_host_record_leaf/module-scope
 */

export { open } from "#outside";
