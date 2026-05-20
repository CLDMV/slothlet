/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/data-reader.mjs
 *	@Date: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

// Cross-file reads of terminal data values exported by db/secrets.mjs.
// Each read is a property access, not a call — gated only when permissions.readGating is on.
export const readToken = () => self.db.secrets.token;
export const readBytes = () => self.db.secrets.bytes;

// Reads a value by export name — used to sweep every terminal-value type.
export const readByName = (name) => self.db.secrets[name];

// Reads the same data value twice — exercises the cached-property read path.
export const readTokenTwice = () => {
	void self.db.secrets.token;
	return self.db.secrets.token;
};
